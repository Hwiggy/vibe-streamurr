export const meta = {
  name: 'obs-upstream-triage',
  description: 'Triage all 1182 open upstream obs-studio issues/PRs against current code; adversarially verify implement candidates',
  phases: [
    { title: 'Triage', detail: '59 area batches, each item classified with code evidence' },
    { title: 'Verify', detail: 'skeptic per IMPLEMENT candidate tries to refute scope/size/evidence' },
  ],
}

const REPO = 'C:/Users/hwign/Projects/obs-studio'
const VERDICTS = ['IMPLEMENT', 'ALREADY_ADDRESSED', 'OUT_OF_SCOPE', 'DEFER_LARGE', 'CANNOT_VERIFY']

const ITEM = {
  type: 'object',
  properties: {
    number: { type: 'integer' },
    kind: { type: 'string', enum: ['issue', 'pr'] },
    title: { type: 'string' },
    verdict: { type: 'string', enum: VERDICTS },
    reasoning: { type: 'string', description: '2-6 sentences. Why this verdict. Must reference code evidence where possible.' },
    code_evidence: { type: 'array', items: { type: 'string' }, description: 'path:line refs (repo-relative) inspected, each with a short note' },
    related: { type: 'array', items: { type: 'integer' }, description: 'other open issue/PR numbers that are the same topic (e.g. issue fixed by a PR)' },
    slice: {
      type: 'object',
      description: 'Required iff verdict=IMPLEMENT',
      properties: {
        summary: { type: 'string' },
        approach: { type: 'string', enum: ['cherry-pick-pr', 'partial-pr', 'new-change'] },
        files: { type: 'array', items: { type: 'string' } },
        est_lines_changed: { type: 'integer' },
        test_plan: { type: 'string', description: 'What can be tested on this Windows x64 box (MSVC build of affected targets, cmocka tests in test/cmocka, script). If the code is linux/mac-only say so: it will be UNTESTED.' },
        platform: { type: 'string', enum: ['windows', 'linux', 'macos', 'cross-platform', 'build-only'] },
      },
      required: ['summary', 'approach', 'files', 'est_lines_changed', 'test_plan', 'platform'],
    },
  },
  required: ['number', 'kind', 'title', 'verdict', 'reasoning', 'code_evidence', 'related'],
}
const BATCH_SCHEMA = {
  type: 'object',
  properties: { notes_file: { type: 'string' }, items: { type: 'array', items: ITEM } },
  required: ['notes_file', 'items'],
}
const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    number: { type: 'integer' },
    upheld: { type: 'boolean', description: 'true only if the IMPLEMENT verdict survives your attempt to refute it' },
    corrected_verdict: { type: 'string', enum: VERDICTS },
    reasoning: { type: 'string' },
    slice_adjustments: { type: 'string', description: 'Concrete corrections to the slice plan (files, approach, pitfalls), or empty' },
  },
  required: ['number', 'upheld', 'corrected_verdict', 'reasoning', 'slice_adjustments'],
}

const RULES = `
HARD RULES (shared working tree, other agents run concurrently):
- READ-ONLY on source. Do not edit, create, or delete anything except the single notes file you are told to write.
- Never run: git checkout/switch/reset/stash/commit/merge/rebase/cherry-pick/fetch/push/pull, gh, or anything that posts to GitHub. Read-only git (log, show, diff, grep, merge-base, merge-tree --write-tree, branch --contains) is fine.
- Do NOT call the GitHub REST API (shared 60 req/hr anonymous limit). Item bodies are in ${REPO}/notes/upstream-triage/data/all.json. Issue comment threads are NOT available; reason from body + code. You MAY use WebFetch on https://github.com/obsproject/obs-studio/issues/N (or /pull/N) sparingly (at most 3 per batch) when the comment thread would decide the verdict (e.g. a maintainer already rejected it).
- Open PR heads are available locally as refs/upstream-pr/<N>. Inspect with: git log --oneline master..refs/upstream-pr/N ; git diff master...refs/upstream-pr/N --stat ; git diff master...refs/upstream-pr/N . Check whether it still applies: git merge-tree --write-tree master refs/upstream-pr/N (non-zero exit / conflict lines = conflicts).
- Current code = branch master at HEAD (OBS Studio, late 2026). Use Grep/Read to justify claims with real path:line references.`

const VERDICT_GUIDE = `
VERDICTS (pick exactly one per item):
- IMPLEMENT: In scope for OBS Studio itself, actionable, and a SMALL self-contained slice exists (rough guide: <= ~200 changed lines, touches a few files, no new dependency, no UX redesign needing maintainer design decisions, no service/partner agreements). You can point at the exact code to change. Bug fixes with a clear root cause in code, small cleanups/tech-debt PRs that still apply, doc fixes, small requested options with obvious placement. For PRs: prefer 'cherry-pick-pr' when the PR is coherent and applies (contributions to obs-studio are GPL-2.0-or-later, same license as this fork; authorship will be preserved), 'partial-pr' if only part is sound/small.
- ALREADY_ADDRESSED: current code already fixes/implements it (cite the code), or the PR's change is already in master.
- OUT_OF_SCOPE: not relevant to the scope of the OBS Studio project: support/config questions, third-party plugin or OS/driver bugs, requests better served by a plugin, unsupported platforms, service additions against rtmp-services policy, spam/empty, or things upstream maintainers have explicitly rejected. Explain why.
- DEFER_LARGE: in scope and plausibly valid, but no small slice exists (big feature, architecture change, needs design/UX decision, large rewrite, depends on new deps, PR too large or heavily conflicting).
- CANNOT_VERIFY: in scope but cannot be justified from code: hardware/driver/GPU specific, needs repro, insufficient information, crash with no actionable stack.
Be decisive and evidence-driven. A bug report counts as IMPLEMENT only if you can identify the defect in the code, not just plausibly.`

const batches = args.batches

phase('Triage')
const results = await pipeline(
  batches,
  (b) => agent(`You are triaging open upstream GitHub items for the OBS Studio repository checked out at ${REPO} (this is a private fork that will never be upstreamed; we want to decide which items to implement locally as the smallest possible slice).

Your batch: ${b.id} (area hint: ${b.area}). Items: ${b.numbers.join(', ')}.
Load them with: python -c "import json;d={i['number']:i for i in json.load(open(r'${REPO}/notes/upstream-triage/data/all.json',encoding='utf-8'))};[print(json.dumps(d[n],ensure_ascii=False)) for n in [${b.numbers.join(',')}]]"
(The area hint is a keyword heuristic; ignore it if wrong.)
${RULES}
${VERDICT_GUIDE}

For EVERY item in the batch (all ${b.numbers.length}, none skipped): read it, investigate the relevant code, decide the verdict, and gather path:line evidence. For IMPLEMENT give a concrete slice plan.

Then write a markdown notes file at ${REPO}/notes/upstream-triage/triage/${b.id}.md with: a header (batch id, items, date 2026-10-26, base commit = output of git rev-parse --short master), then one section per item: "### [#N](https://github.com/obsproject/obs-studio/issues/N) — <title>" (use /pull/N for PRs), verdict, reasoning, evidence bullets, related items, and the slice plan if IMPLEMENT. Paraphrase; do not paste large blocks of issue text. This file is the permanent record of the reasoning.

Return the structured result (notes_file = repo-relative path).`, { label: `triage:${b.id}`, phase: 'Triage', schema: BATCH_SCHEMA }),
  (res, b) => {
    if (!res) return null
    const got = new Set(res.items.map(i => i.number))
    const missing = b.numbers.filter(n => !got.has(n))
    if (missing.length) log(`${b.id}: missing ${missing.join(',')}`)
    const cands = res.items.filter(i => i.verdict === 'IMPLEMENT')
    return parallel(cands.map(it => () => agent(`You are a skeptical reviewer for a triage decision on the OBS Studio repo at ${REPO}. Another agent marked upstream ${it.kind} #${it.number} ("${it.title}") as IMPLEMENT (to be implemented locally in a private fork as the smallest possible slice).
Their reasoning: ${it.reasoning}
Their evidence: ${(it.code_evidence || []).join(' | ')}
Their slice plan: ${JSON.stringify(it.slice || {})}

The item body is in ${REPO}/notes/upstream-triage/data/all.json (python -c "import json;print([i for i in json.load(open(r'${REPO}/notes/upstream-triage/data/all.json',encoding='utf-8')) if i['number']==${it.number}][0])").
${RULES}
${VERDICT_GUIDE}

Try hard to REFUTE the IMPLEMENT verdict. Check independently: Is the defect/feature really present in current master code (re-read the code yourself; is it already fixed)? Is it in OBS Studio's scope? Is the slice truly small and self-contained, and does it not require a maintainer UX/design decision? For a PR: does it still apply (merge-tree), is it correct, is it complete, are there review concerns visible in the diff? Would the change risk regressions? If uncertain whether it is real or small, set upheld=false and give the corrected verdict. If upheld, give any concrete slice adjustments (pitfalls, extra files, better test).`, { label: `verify:#${it.number}`, phase: 'Verify', schema: VERIFY_SCHEMA })))
      .then(vs => ({ batch: b.id, notes_file: res.notes_file, items: res.items, missing, verifications: vs.filter(Boolean) }))
  },
)
return results.filter(Boolean)
