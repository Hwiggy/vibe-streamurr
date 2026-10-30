export const meta = {
  name: 'obs-upstream-implement',
  description: 'Implement 295 verified IMPLEMENT units as smallest-slice commits in isolated worktrees, review each, fix if needed',
  phases: [
    { title: 'Implement', detail: 'one worktree agent per unit commits to impl/<lead>' },
    { title: 'Review', detail: 'independent read-only review of each commit' },
    { title: 'Fix', detail: 'amend on impl/<lead>-r2 when review finds problems' },
  ],
}

const REPO = 'C:/Users/hwign/Projects/obs-studio'
const FMT = 'C:/Users/hwign/AppData/Local/Temp/claude/c--Users-hwign-Projects-obs-studio/497b5fed-849a-4e96-ae00-ea7c733b7f4f/scratchpad/fmtvenv/Scripts/clang-format.exe'
const UNITS = `${REPO}/notes/upstream-triage/data/units.json`

const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    lead: { type: 'integer' },
    status: { type: 'string', enum: ['committed', 'dropped'] },
    branch: { type: 'string' },
    commit: { type: 'string' },
    subject: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    platform: { type: 'string', enum: ['windows', 'linux', 'macos', 'cross-platform', 'build-only', 'docs'] },
    build_targets: { type: 'array', items: { type: 'string' }, description: 'CMake target names on Windows whose compile covers the change (e.g. libobs, obs-studio, win-capture, obs-ffmpeg). Empty if nothing compiles on Windows.' },
    drop_reason: { type: 'string', description: 'if dropped: why, and the corrected verdict (ALREADY_ADDRESSED / DEFER_LARGE / OUT_OF_SCOPE / CANNOT_VERIFY)' },
    members_addressed: { type: 'array', items: { type: 'integer' } },
  },
  required: ['lead', 'status', 'branch', 'commit', 'subject', 'files', 'platform', 'build_targets', 'drop_reason', 'members_addressed'],
}
const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    problems: { type: 'array', items: { type: 'string' }, description: 'concrete, actionable defects only (bug, missing case, unrelated change, style violation, bad commit message, licensing/authorship gap)' },
    drop: { type: 'boolean', description: 'true if the change should not be applied at all (wrong, harmful, not actually small)' },
    reasoning: { type: 'string' },
  },
  required: ['ok', 'problems', 'drop', 'reasoning'],
}

const SHARED = `
CONTEXT: ${REPO} is a private fork of OBS Studio (never upstreamed; never open PRs/issues/comments on GitHub; never push). Every open upstream issue/PR was triaged; your unit was judged IMPLEMENT and survived a skeptic. Read ${REPO}/CLAUDE.md conventions (already in your context). Unit details (triage reasoning, code evidence, slice plan, skeptic's adjustments) are in ${UNITS}; load yours with:
  python -c "import json;u=[x for x in json.load(open(r'${UNITS}',encoding='utf-8')) if x['lead']==LEAD][0];print(json.dumps(u,indent=1,ensure_ascii=False))"
Raw issue/PR bodies: ${REPO}/notes/upstream-triage/data/all.json (git-ignored; do not copy text into commits beyond short quotes). Upstream PR heads are local refs: refs/upstream-pr/<N>. Do NOT call the GitHub API. Do NOT run 'git <cmd> --help' or 'git help' (opens the user's browser). Git is 2.33.
NEVER: push, fetch, open PRs, modify ${REPO}'s main working tree or the branch triage/upstream-2026-10-26, touch submodule contents (plugins/obs-browser, plugins/obs-websocket, deps/libdshowcapture/src are submodules — changes there are out of reach: drop with reason), or build (no build dir in worktrees; the integrator builds).`

const COMMIT_TEMPLATE = `
COMMIT MESSAGE FORMAT (exactly these sections, wrapped at 72 cols):
<module>: <Imperative summary, upstream style, <= 72 chars>

<What was wrong / requested, the root cause with path:line references, what this commit changes, and why it is the smallest slice. Mention anything deliberately left out.>

Upstream: <one line per member: https://github.com/obsproject/obs-studio/issues/N or /pull/N — short title — how it is addressed (fixed / partially / superseded-by-this)>
Origin: <"New change written for this fork." OR "Squashed from upstream PR #N (K commits) by Name <email>[, adapted: what changed]." Include the original commit subjects as an indented list for PR-derived changes.>
License: GPL-2.0-or-later, the project license. <For PR-derived code: "Contributed to obsproject/obs-studio under the project license; original authorship kept as the commit author / Co-authored-by." For new code: "Original code written for this fork.">
Notes: notes/upstream-triage/decisions/<LEAD>.md, <triage batch file(s)>
Testing: PENDING-INTEGRATION

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
(For PR-derived commits also add "Co-authored-by: Name <email>" lines for any other PR commit authors.)
Leave the literal "Testing: PENDING-INTEGRATION" line — the integrator replaces it with real build results or UNTESTED.`

const units = args.units

const results = await pipeline(
  units,
  (u) => agent(`You are implementing one unit of upstream OBS Studio work in an isolated git worktree (your current working directory; confirm with git rev-parse --show-toplevel and work ONLY there).
${SHARED}

YOUR UNIT: lead #${u.lead}, members ${u.members.join(', ')}. Load details with LEAD=${u.lead}.

STEPS
1. git checkout -b impl/${u.lead}   (from your worktree's current HEAD; that HEAD is the fork's integration base).
2. Re-read the relevant code in your worktree and confirm the problem still exists. If it is already fixed, or on closer inspection is not small/self-contained, or the change lives in a submodule: DROP (no commit), status=dropped with a precise drop_reason including the corrected verdict.
3. Implement the SMALLEST slice that resolves the member items:
   - PR-based ("cherry-pick-pr"/"partial-pr"): git cherry-pick -x the PR's commits (git log --reverse --format=%H HEAD..refs/upstream-pr/N; if the PR branch contains unrelated merge/base commits use git merge-base HEAD refs/upstream-pr/N to scope it). Resolve conflicts minimally. Then squash to ONE commit preserving authorship: git reset --soft <base> && git commit --author="<first PR commit author>". If several member PRs compete for the same fix, pick the best-justified one, mention the others as superseded in the commit body. For "partial-pr", apply only the sound part and say what was left out and why.
   - "new-change": write the code yourself, matching surrounding style/idiom/comment density. No speculative extras.
   - If a member is a docs-only or locale change: only edit en-US.ini for new strings (other locales are Crowdin-managed upstream).
4. Format: run "${FMT}" -i on every touched .c/.h/.cpp/.hpp/.m/.mm file, then check git diff shows NO unrelated reformatting (if it does, revert those hunks — the tree is already clang-format clean, so it shouldn't).
5. Write notes/upstream-triage/decisions/${u.lead}.md (in the worktree): title, member links, problem summary (paraphrased), root cause with path:line, what changed, alternatives rejected, risks, how to test (what a human should do at runtime), platform. Include it in the same commit.
6. Commit everything as ONE commit on impl/${u.lead}.
${COMMIT_TEMPLATE}
7. Verify: git log -1 --stat; git show --format=%B -s HEAD. Ensure only intended files changed.

Return the structured result. commit = full SHA. build_targets = CMake targets on Windows that compile the touched code (look at the module's CMakeLists add_library/add_executable/add_obs_plugin target names), empty if the touched code is not built on Windows (linux-*/mac-* only, docs, CI yaml).`, { label: `impl:#${u.lead}`, phase: 'Implement', isolation: 'worktree', schema: IMPL_SCHEMA }),

  (impl, u) => {
    if (!impl || impl.status !== 'committed') return { impl, review: null, final_branch: null }
    return agent(`You are an independent, skeptical code reviewer. In the OBS Studio fork at ${REPO}, branch ${impl.branch} (commit ${impl.commit}) implements upstream unit #${u.lead} (members ${u.members.join(', ')}).
${SHARED}
You are READ-ONLY: do not modify files, do not checkout/switch, do not commit. Use: git show ${impl.commit} ; git show ${impl.commit}:<path> ; Read/Grep on ${REPO} for surrounding master code (the main tree is at the integration base, which equals the commit's parent for unrelated files).

Load the unit with LEAD=${u.lead}. Review the commit for:
- Correctness: does it actually fix the described defect/feature? Edge cases, null checks, resource leaks, threading/locking consistent with surrounding code, ABI/API compatibility of libobs public headers (no breaking changes to exported structs/functions), config/back-compat of saved settings.
- Minimality: smallest slice; no unrelated changes or reformatting; no speculative features.
- Style: matches CODESTYLE.md / surrounding idiom; would pass clang-format 22.1.3.
- New UI strings present in frontend/data/locale/en-US.ini (or the plugin's data/locale/en-US.ini).
- Commit message: all required sections present (Upstream, Origin, License, Notes, Testing: PENDING-INTEGRATION, Co-Authored-By), accurate, PR authorship preserved (author / Co-authored-by) when PR-derived; decisions/${u.lead}.md present and accurate; no large verbatim copies of issue text.
Set ok=true only if there are no actionable problems. drop=true only if the change is wrong/harmful or should not be applied at all.`, { label: `review:#${u.lead}`, phase: 'Review', schema: REVIEW_SCHEMA })
      .then(review => ({ impl, review, final_branch: impl.branch }))
  },

  (r, u) => {
    if (!r || !r.review || r.review.ok || r.review.drop) return r
    return agent(`You are fixing review findings on one commit in an isolated git worktree (your current working directory; confirm with git rev-parse --show-toplevel).
${SHARED}
Unit #${u.lead} (members ${u.members.join(', ')}); load with LEAD=${u.lead}.
Branch ${r.impl.branch} (commit ${r.impl.commit}) has these review problems:
${r.review.problems.map((p, i) => `${i + 1}. ${p}`).join('\n')}
Reviewer reasoning: ${r.review.reasoning}

STEPS: git checkout -b impl/${u.lead}-r2 ${r.impl.commit} ; fix each valid problem (if you judge a problem invalid, leave it and explain in decisions/${u.lead}.md under "Review notes"); run "${FMT}" -i on touched C/C++ files; keep it ONE commit: git commit --amend (preserve the original --author; keep "Testing: PENDING-INTEGRATION"; append to decisions/${u.lead}.md a "Review notes" section listing each finding and how it was resolved). If the problems reveal the change should not be applied at all, return status=dropped with drop_reason.
${COMMIT_TEMPLATE}
Return the structured result with branch=impl/${u.lead}-r2 and the new full SHA.`, { label: `fix:#${u.lead}`, phase: 'Fix', isolation: 'worktree', schema: IMPL_SCHEMA })
      .then(fix => ({ ...r, fix, final_branch: fix && fix.status === 'committed' ? fix.branch : null }))
  },
)

return results.map((r, i) => ({ lead: units[i].lead, members: units[i].members, ...(r || { error: true }) }))
