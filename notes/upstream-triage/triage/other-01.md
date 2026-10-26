# Upstream triage — batch other-01

- Batch: other-01 (area hint: other)
- Items: #13767
- Date: 2026-10-26
- Base commit: 72e866557 (master)

### [#13767](https://github.com/obsproject/obs-studio/issues/13767) — OBS Studio 34.0

**Verdict:** OUT_OF_SCOPE (meta/tracking issue; nothing to implement)

**Reasoning:** Opened by a maintainer (Warchamp7) as a parent tracking issue for tasks and PRs slated
for the next major version (34.0). The body contains no bug, feature request or code change of its
own; it only aggregates other issues/PRs, which are triaged individually in their own batches.
There is no slice to implement and nothing to verify against code. Bumping the version number
locally would be meaningless for a private fork and would misrepresent the libobs API version.

**Evidence:**
- `libobs/obs-config.h:30` — `LIBOBS_API_MAJOR_VER 33`; `libobs/obs-config.h:37` — minor 0. Master is
  on the 33.x line (`git describe --tags master` -> `33.0.0`), so 34.0 is the future upstream release
  this issue tracks.
- Issue body: one sentence describing it as a parent tracking issue; no linked code, no repro.

**Related:** none identifiable from the body (sub-issues are not listed in the local data dump).
