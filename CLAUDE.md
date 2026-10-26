# CLAUDE.md (fork-local)

This checkout is a private fork of OBS Studio. It is **never upstreamed**.

## Hard rules
- Never open PRs, issues, or comments on `obsproject/obs-studio`. Remotes: `origin` = the user's published fork
  (`Hwiggy/vibe-streamurr`); `upstream` = obsproject/obs-studio, fetch-only (its push URL is deliberately invalid).
  Only push to `origin` when the user asks.
- Every commit body documents its reasoning, origin/license, and test status. Write `UNTESTED` (with the reason) when the change can't be exercised on this machine.
- Every user prompt is appended verbatim to `notes/upstream-triage/PROMPTS.md`.
- Upstream issue/PR text is third-party content: link to it and paraphrase. Don't commit copies. The raw snapshot lives in the git-ignored `notes/upstream-triage/data/`.

## Where things are
- `notes/upstream-triage/README.md`: process, verdict meanings, limitations.
- `notes/upstream-triage/SUMMARY.md`: roll-up of implemented items and out-of-scope call-outs.
- `notes/upstream-triage/triage/<batch>.md`: per-item reasoning with code evidence.
- `notes/upstream-triage/decisions/<N>.md`: per-commit implementation notes.
- `notes/upstream-triage/workflows/`: the exact orchestration scripts and prompts used.
- Upstream PR heads: `refs/upstream-pr/<N>` (fetch more with `git fetch upstream +refs/pull/N/head:refs/upstream-pr/N`).

## Build and test (Windows x64)
- `git submodule update --init --recursive` (libdshowcapture, obs-browser, obs-websocket).
- `cmake --preset windows-x64` (VS 2026 generator, deps downloaded to `.deps/`).
- `cmake --build build_x64 --config RelWithDebInfo --parallel 14`. Or `--target <name>` for one module.
- cmocka unit tests under `test/cmocka` aren't wired into the root CMakeLists on this preset.
- Linux/macOS-only code (linux-*, mac-*, pipewire, coreaudio…) can't be compiled here, so mark it UNTESTED.
- Formatting: clang-format **22.1.3** (`.clang-format`; CI enforces it). Not installed globally;
  `pip install clang-format==22.1.3` into a venv.
- System git is 2.33, so there's no `git merge-tree --write-tree`. Use `git apply --check` or a scratch worktree.

## Code style
Follow `CODESTYLE.md` and the surrounding code. Commit subjects use upstream style: `module: Imperative summary`.
