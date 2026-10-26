# Upstream issue/PR triage (fork-local)

This fork of [obsproject/obs-studio](https://github.com/obsproject/obs-studio)
(published as `Hwiggy/vibe-streamurr`, the `origin` remote) is never upstreamed: no PRs are
opened from it to upstream. The `upstream` remote is fetch-only. This folder records how every open upstream issue and PR was triaged
against this fork's code, and why.

## Snapshot

- Fetched 2026-10-26 from the anonymous GitHub REST API: 1182 open items
  (834 issues, 348 PRs).
- Base commit: `72e866557` (master, "CI: Update deps to 2026-10-23 release").
- Work branch: `triage/upstream-2026-10-26`.
- Raw item text lives in `data/` (git-ignored, third-party content). To regenerate:
  `curl "https://api.github.com/repos/obsproject/obs-studio/issues?state=open&per_page=100&page=N"`
  for N=1..10, plus `&direction=asc` pages 1..3 (page-based paging stops at 1000 items), merged by number.
- PR heads were fetched over git (no API cost) into `refs/upstream-pr/<N>`:
  `tr -d '\r' < data/refspecs.txt | xargs -n 60 git fetch --no-tags upstream`.

## Limitations

- Issue/PR **comment threads were not read** in bulk (60 requests/hour anonymous API limit).
  Verdicts are based on the item body plus the current code. Agents could consult a few
  threads via the web page when a maintainer decision would settle the verdict.
- Testing is on Windows 11 x64, MSVC (VS 2026), `windows-x64` preset only. Linux and macOS
  code is compile-untested here and marked UNTESTED in commits.

## Verdicts

| Verdict | Meaning |
|---|---|
| IMPLEMENT | In scope, defect/feature confirmed in code, small self-contained slice exists |
| ALREADY_ADDRESSED | Current code already covers it |
| OUT_OF_SCOPE | Not OBS Studio's concern (support, third-party, plugin territory, policy, rejected) |
| DEFER_LARGE | Valid and in scope, but no small slice (big feature, design decision, large or conflicting PR) |
| CANNOT_VERIFY | Can't be justified from code (hardware/driver-specific, needs repro, no info) |

## Layout

- `PROMPTS.md`: every user prompt, verbatim.
- `workflows/`: the exact orchestration scripts and sub-agent prompts used.
- `triage/<batch>.md`: per-item reasoning with code evidence (one file per area batch).
- `SUMMARY.md`: the roll-up: what was implemented, and every out-of-scope call-out with links.
- `decisions/`: per-commit notes for implemented items.

## Process

1. Items were bucketed by area keyword (see `workflows/01-triage-batches.json`).
2. One agent per batch classified each item with `path:line` evidence.
3. Each IMPLEMENT candidate got an independent skeptic who tried to refute it.
   Only candidates that survived were implemented.
4. Implementation: one commit per item (or tightly related cluster), with the reasoning,
   license note, and test status (or `UNTESTED`) in the commit body.
