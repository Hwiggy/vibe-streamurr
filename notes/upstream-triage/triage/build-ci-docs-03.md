# Upstream triage — batch build-ci-docs-03

- Batch id: build-ci-docs-03 (area hint: build-ci-docs; several items are actually Linux/Flatpak/FreeBSD/browser/macOS runtime reports)
- Items: 12269, 12340, 12377, 12459, 12468, 12541, 12821, 12931, 12944, 12955, 13048, 13054, 13079, 13169, 13199, 13294, 13377, 13392, 13413, 13444, 13465, 13499
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; PR heads inspected via `refs/upstream-pr/<N>` (`git diff master...refs/upstream-pr/N`). The local git is 2.33, which has no `merge-tree --write-tree`, so applicability was checked with legacy `git merge-tree <merge-base> master <pr>` and counting `+<<<<<<<` conflict markers. No WebFetch used.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 12269 | PR | IMPLEMENT (cherry-pick) |
| 12340 | issue | CANNOT_VERIFY |
| 12377 | PR | IMPLEMENT (cherry-pick) |
| 12459 | issue | CANNOT_VERIFY |
| 12468 | PR | OUT_OF_SCOPE |
| 12541 | issue | DEFER_LARGE |
| 12821 | PR | IMPLEMENT (partial-pr) |
| 12931 | PR | DEFER_LARGE |
| 12944 | issue | CANNOT_VERIFY |
| 12955 | issue | CANNOT_VERIFY |
| 13048 | issue | CANNOT_VERIFY |
| 13054 | PR | ALREADY_ADDRESSED |
| 13079 | issue | OUT_OF_SCOPE |
| 13169 | issue | DEFER_LARGE |
| 13199 | PR | IMPLEMENT (cherry-pick) |
| 13294 | PR | IMPLEMENT (cherry-pick) |
| 13377 | issue | CANNOT_VERIFY |
| 13392 | PR | ALREADY_ADDRESSED |
| 13413 | PR | IMPLEMENT (cherry-pick) |
| 13444 | issue | IMPLEMENT (new-change, first slice only) |
| 13465 | PR | IMPLEMENT (cherry-pick) |
| 13499 | issue | DEFER_LARGE |

---

### [#12269](https://github.com/obsproject/obs-studio/pull/12269) — docs: Fix uniunstall to uninstall typo in AJA README

**Verdict: IMPLEMENT** (cherry-pick-pr)

The typo is still on master. The PR is one commit that changes one line and applies cleanly.

Evidence:
- `plugins/aja/README.md:30`: "To uniunstall the Linux kernel module".
- PR commit `ca4c5a8a6` changes only that line; no conflicts against master.

Slice: `git cherry-pick ca4c5a8a6` (keep author nakanoh). Test: docs only, check by reading the file. No build needed.

Related: none.

### [#12340](https://github.com/obsproject/obs-studio/issues/12340) — VAAPI QSV encoders not available in current Flatpak

**Verdict: CANNOT_VERIFY**

On an Intel N100/N150 iGPU, the Flatpak build of OBS shows no VAAPI or QSV encoders, but the distro package does. Whether these encoders appear depends on the VA driver and the oneVPL runtime that the Flatpak runtime/GL extension ships. OBS only probes for them. Nothing in the probe path is shown to be wrong for this hardware. The cause is the runtime/driver packaging (intel-media-driver support for ADL-N inside the freedesktop runtime), which is outside the OBS tree and needs that hardware to reproduce. The reporter's side note, that VAAPI encoders appear only in Advanced output mode, is expected Simple-mode behaviour and not a bug.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-vaapi.c:1008-1020`: `vaapi_device_codec_supported` only reports what the VA driver advertises.
- `plugins/obs-ffmpeg/vaapi-utils.h:20-29`: probing helpers. Support comes entirely from the driver.

Related: none.

### [#12377](https://github.com/obsproject/obs-studio/pull/12377) — CI: Cleanup flatpak-builder-lint action

**Verdict: IMPLEMENT** (cherry-pick-pr)

This is from tytan652 (the Flatpak maintainer). It replaces the jq post-processing of flatpak-builder-lint JSON with the tool's built-in `--gha-format` option. The net change removes about 34 lines from one composite action, and it applies cleanly. The jq block is still on master.

Evidence:
- `.github/actions/flatpak-builder-lint/action.yaml:34-40` (and following): current `result="$(flatpak-builder-lint ...)"` plus jq mapping.
- `.github/workflows/build-project.yaml:265`, `.github/workflows/publish.yaml:90`: the lint runs inside the `ghcr.io/flathub-infra/flatpak-github-actions:freedesktop-26.08` container, which ships a recent flatpak-builder-lint with `--gha-format`.
- PR commit `d017cdd95`: one file, +4/-38, no conflicts.

Slice: `git cherry-pick d017cdd95`. Test: UNTESTED. It is a GitHub Actions composite action that runs only in the Flathub container. Locally you can only check the YAML syntax.

Related: 12541 (same Flatpak CI job).

### [#12459](https://github.com/obsproject/obs-studio/issues/12459) — Buffered async video lags behind

**Verdict: CANNOT_VERIFY**

The reporter sees A/V desync with the `sync-async-source` test input on Ubuntu, and a 1 s startup delay when the test uses absolute timestamps. The async frame selection and timestamp-jump logic in libobs is complex and timing dependent. The report has no root-cause analysis, and I could not identify a specific defect from reading the code. Confirming it needs a Linux build with test inputs and an A/V timing measurement.

Evidence:
- `test/test-input/sync-async-source.c:63,83-84`: the test source uses relative timestamps starting at 0, which the reporter modifies.
- `libobs/obs-source.c:1621-1663`: timestamp jump handling with `MAX_TS_VAR`.
- `libobs/obs-source.c:4124-4193`: `ready_async_frame` and `frame_out_of_bounds` frame selection.

Related: none.

### [#12468](https://github.com/obsproject/obs-studio/pull/12468) — FreeBSD compatibility patches

**Verdict: OUT_OF_SCOPE**

FreeBSD is not an officially supported OBS platform (label `platform/other`), and the PR is now mostly superseded or incorrect:
1. The `platform-x11.cpp` header additions are already on master.
2. The CMake hunk targets `add_obs_plugin`, which has since been renamed to `add_core_module`. It would also rewrite `x86_64` to `amd64` on every OS, which would make the `ARCHITECTURES x64 x86_64` check fail on Linux x86_64 (it compares against `CMAKE_SYSTEM_PROCESSOR`) and silently disable obs-qsv11.
3. The obs-vst enablement fixes only `VSTPlugin.h`, while `obs-vst.cpp` still guards its loader paths with `__linux__` only.

This is better kept in the FreeBSD port's own patch set.

Evidence:
- `frontend/utility/platform-x11.cpp:41-48`: `<sys/param.h>`, `<sys/queue.h>`, `<sys/socket.h>` are already included under `__FreeBSD__`.
- `cmake/common/helpers_common.cmake:459-505`: `add_core_module`, which compares the architecture against `CMAKE_SYSTEM_PROCESSOR` on non-Windows/macOS.
- `plugins/CMakeLists.txt:94-98`: obs-qsv11 `ARCHITECTURES x64 x86_64`. The PR's amd64 rewrite would break this on Linux.
- `plugins/obs-vst/headers/VSTPlugin.h:76`, `plugins/obs-vst/obs-vst.cpp:106,193,228,248`: `__linux__`-only guards that the PR leaves untouched.
- `cmake/common/osconfig.cmake:15-19`: FreeBSD already maps to `OS_FREEBSD` and the Linux CMake path.

Related: 13079 (FreeBSD runtime abort).

### [#12541](https://github.com/obsproject/obs-studio/issues/12541) — OBS sources missing from Flatpak sources extension

**Verdict: DEFER_LARGE**

The diagnosis holds. The manifest's OBS module uses a `dir` source with `"path": "../"`. flatpak-builder does not bundle sources outside the manifest root into the Sources extension, so the OBS sources are missing from it. The fix is a change to the release pipeline: copy or relocate the manifest to the repo root in CI and rewrite its relative paths, in both build-project and publish workflows. The Flathub requester says the requirement is "not final". The change interacts with flatpak-builder caching keyed on the manifest path, and it only matters for Flathub publishing, which this fork never does. It cannot be tested outside GitHub's Flatpak runners and needs a maintainer and Flathub decision on the approach.

Evidence:
- `build-aux/com.obsproject.Studio.json:163-168`: `{"type": "dir", "path": "../"}`.
- `.github/workflows/build-project.yaml:341-353`: manifest-path `build-aux/com.obsproject.Studio.json` passed to flatpak-builder.
- `.github/workflows/publish.yaml:171-187`: the same in the publish flow.

Related: 12377.

### [#12821](https://github.com/obsproject/obs-studio/pull/12821) — docs: Minor fixes for canvases

**Verdict: IMPLEMENT** (partial-pr)

The documentation gaps the PR fixes are all still present on master:
- `obs_canvas_get_signal_handler`, `obs_render_canvas_texture` and `obs_render_canvas_texture_src_color_only` are exported but not documented.
- The global `source_create_canvas` signal exists but is not documented.
- The `obs.h` comment for `obs_render_canvas_texture_src_color_only` wrongly says "main output".

The page also really is missing from navigation: `reference-canvases` is not in any toctree. The PR text says it adds it, but the current PR diff does not contain that hunk. One hunk conflicts with master, because `obs_canvas_video_active` was since added at the end of `reference-canvases.rst`. The fix is trivial: keep both blocks.

Evidence:
- `libobs/obs.h:849,852,2696`: undocumented exports. Line 851 has the wrong "main output" comment.
- `libobs/obs.c:1085`, `libobs/obs-source.c:541-545`: the `source_create_canvas` signal is declared and emitted. `source_create` is emitted only for the main canvas, which matches the PR's wording.
- `docs/sphinx/reference-canvases.rst:300-308`: the file ends with `obs_canvas_video_active`, which is the conflict point.
- `docs/sphinx/index.rst:28-35`, `docs/sphinx/reference-core-objects.rst:4-13`: no toctree entry for `reference-canvases`.

Slice: cherry-pick `6794e3149` and `682c94ef2`. On the conflict, keep `obs_canvas_video_active` and append the two render functions after it. Add `Canvases (obs_canvas_t) <reference-canvases>` to the toctree in `reference-core-objects.rst`. About 25 lines. Test: build the Sphinx docs if sphinx is installed locally (`sphinx-build docs/sphinx out`). Otherwise mark UNTESTED, docs only. The `obs.h` comment change has no effect on compiled output.

Related: none.

### [#12931](https://github.com/obsproject/obs-studio/pull/12931) — ci: Build for ubuntu-24.04-arm

**Verdict: DEFER_LARGE**

The PR adds an aarch64 Ubuntu 26.04 target to the CI matrix and packaging. That means taking on a new officially built platform: the support burden, CEF/browser availability on arm64 Linux, and the artifact/publish layout are all project-level decisions. The diff also has a defect. `if: ${{ fromJSON(...) }} && matrix.target == 'x86_64'` mixes a `${{ }}` expression with bare text, so the condition is a non-empty string and always truthy. The arm64 job would upload a conflicting sources artifact. The PR text is also inconsistent: the title says 24.04, the body says 26.04. Nothing can be tested off GitHub's arm runners.

Evidence:
- `.github/workflows/build-project.yaml:180-247`: the single-arch `ubuntu-build` job (`os: [ubuntu-26.04]`, hardcoded `x86_64` artifacts at 240/247).
- `.github/scripts/.build.zsh:51-53`, `.github/scripts/.package.zsh:51-53`: the target list has only `ubuntu-x86_64`.
- PR `1ec213376`: the buggy `if:` on the "Upload Source Tarball" step.

Related: none.

### [#12944](https://github.com/obsproject/obs-studio/issues/12944) — Browser sources broken on Flatpak in 32.0.4

**Verdict: CANNOT_VERIFY**

After a reboot, CEF fails to initialize in the Flatpak build. The reporter only guesses at the 32.0.3 shutdown changes. A likely candidate is stale Chromium profile/singleton state in the shared `root_cache_path`, but the report and logs here do not establish a cause. It depends on the Flatpak sandbox and needs a repro. obs-browser is also a submodule (`plugins/obs-browser`), and it has since moved to 2.27.4.

Evidence:
- `plugins/obs-browser/obs-browser-plugin.cpp:312`: `chrome_runtime = true`.
- `plugins/obs-browser/obs-browser-plugin.cpp:361-363`: `cache_path`/`root_cache_path` set to the OBS config dir, which is shared across sessions.
- `.gitmodules`: obs-browser is an external submodule.

Related: 12955, 13048, 13499.

### [#12955](https://github.com/obsproject/obs-studio/issues/12955) — Flatpak crashing: obs killed by SIGSEGV

**Verdict: CANNOT_VERIFY**

This is an intermittent SIGSEGV on exit, and occasionally while recording, in the Fedora Flatpak. The only data is a systemd-coredump summary ("jump to an invalid address") with no symbolized OBS frames. There is nothing to tie it to specific code.

Evidence: none actionable. The report contains no OBS stack frames.

Related: 12944.

### [#13048](https://github.com/obsproject/obs-studio/issues/13048) — CEF takes over app identity

**Verdict: CANNOT_VERIFY**

On KDE, when a browser source talks to D-Bus/portal APIs first, the desktop attributes OBS to "Chromium" (for example in the inhibit list and the screencast portal title). Chromium probably registers its own desktop ID with the host portal registry. A plausible mitigation is to pass OBS's desktop ID to CEF, for example through `CHROME_DESKTOP` or by disabling more portal features in CEF. obs-browser currently does neither. But the mechanism is not confirmed in code here, the fix belongs in the obs-browser submodule, and it needs a KDE session to verify.

Evidence:
- `plugins/obs-browser/browser-app.cpp:136`: CEF already disables some features (including `GlobalShortcutsPortal`) through `--disable-features`.
- `plugins/obs-browser/browser-app.cpp:172`: only `ozone-platform` is set. There is no `CHROME_DESKTOP` or app-ID setting anywhere in `plugins/obs-browser/*.cpp`.

Related: 12944.

### [#13054](https://github.com/obsproject/obs-studio/pull/13054) — chore: Update outdated GitHub Actions versions

**Verdict: ALREADY_ADDRESSED**

Master already uses newer, SHA-pinned versions than this PR proposes: checkout v6.0.2, upload-artifact v7.0.1, download-artifact v8.0.1, cache v5.0.5. The PR conflicts with master in 46 places.

Evidence:
- `.github/workflows/*.yaml`: 34x `actions/checkout@de0fac2e... # v6.0.2`, `actions/upload-artifact@043fb46d... # v7.0.1`, `actions/download-artifact@3e5f45b2... # v8.0.1`.
- PR `0bdee61cb`: unpinned `@v6`/`@v7` tags.

Related: none.

### [#13079](https://github.com/obsproject/obs-studio/issues/13079) — error at run-time: QWidget: Cannot create a QWidget without QApplication

**Verdict: OUT_OF_SCOPE**

This is a FreeBSD 15 port build (unsupported platform) that aborts at startup only in optimized builds, and works when compiled with debug options. A release-only failure like this points to a toolchain, packaging or Qt-port problem on FreeBSD, not to an OBS code path you can find by reading the code. The upstream supported platforms (Windows, macOS, Ubuntu/Flatpak) do not show it.

Evidence:
- `cmake/common/osconfig.cmake:15-19`: FreeBSD is only handled opportunistically through the Linux path.
- The report's backtrace stops inside `libQt6Core` with no OBS frames.

Related: 12468.

### [#13169](https://github.com/obsproject/obs-studio/issues/13169) — Global hotkeys not working in OBS Studio (Flatpak) on Kubuntu 25.10

**Verdict: DEFER_LARGE**

This is a known Wayland limitation, and the report is mostly a support question. Wayland does not deliver key events to unfocused clients, and OBS's Wayland hotkey backend intentionally returns false for out-of-focus queries. Global hotkeys on Wayland would need a new `org.freedesktop.portal.GlobalShortcuts` integration. That is a sizeable feature that changes the hotkey model, because the portal binds shortcuts by ID and the compositor chooses the keys. It needs design work.

Evidence:
- `libobs/obs-nix-wayland.c:261-269`: `obs_nix_wayland_hotkeys_platform_is_pressed` always returns false, with the comment that Wayland never delivers out-of-focus key events.
- No GlobalShortcuts portal usage in `libobs/` or `frontend/`. The only mention is CEF's disable list at `plugins/obs-browser/browser-app.cpp:136`.

Related: none.

### [#13199](https://github.com/obsproject/obs-studio/pull/13199) — shared/bpm: Replace `sprintf` usage

**Verdict: IMPLEMENT** (cherry-pick-pr)

The `sprintf` is still on master. It triggers `-Wdeprecated-declarations` under AppleClang (including ASAN builds), and `-Werror` turns that into a build failure. The replacement uses `strftime`'s return length and a bounded `snprintf` into the 64-byte buffer. Behaviour is the same. One file, applies cleanly.

Evidence:
- `shared/bpm/bpm.c:10-12`: `strftime` followed by `sprintf(m_time->rfc3339_str + strlen(...), ".%03ldZ", ...)`.
- `shared/bpm/bpm-internal.h:19,22`: `RFC3339_MAX_LENGTH (64)` buffer.

Slice: `git cherry-pick a85953452`. Test: build the `bpm` static library and its consumers (obs-outputs/obs-webrtc) with MSVC on this box. The Windows build compiles `shared/bpm`, which checks that it still compiles. The AppleClang warning itself is UNTESTED (no macOS).

Related: none.

### [#13294](https://github.com/obsproject/obs-studio/pull/13294) — obs-ffmpeg: Fix build when ENABLE_HEVC=false

**Verdict: IMPLEMENT** (cherry-pick-pr)

The bug is confirmed in code. `vaapi_device_hevc_supported` is only declared under `#ifdef ENABLE_HEVC`, but `vaapi_device_codec_supported` calls it unconditionally. With `-DENABLE_HEVC=OFF` that is an implicit declaration and an undefined symbol. The PR wraps the `case CODEC_HEVC:` in a guard. It uses `#if ENABLE_HEVC`, matching the file's existing `#if ENABLE_HEVC` at 828/842. The surrounding code mostly uses `#ifdef`, which is equivalent here because the macro is defined to 1.

Evidence:
- `plugins/obs-ffmpeg/vaapi-utils.h:25-29`: the HEVC helpers are declared only `#ifdef ENABLE_HEVC`.
- `plugins/obs-ffmpeg/obs-ffmpeg-vaapi.c:1008-1020`: the unguarded `case CODEC_HEVC: return vaapi_device_hevc_supported(path);`.
- `plugins/obs-ffmpeg/obs-ffmpeg-vaapi.c:28,110,277,597,828,842`: the existing HEVC guards in the same file.

Slice: `git cherry-pick 64dcf4486` (+2 lines). Test: UNTESTED. `obs-ffmpeg-vaapi.c` is compiled only on Linux and cannot be built with MSVC on this Windows box.

Related: 12340 (VAAPI, unrelated cause).

### [#13377](https://github.com/obsproject/obs-studio/issues/13377) — [macOS 26 Tahoe] OBS crashes on quit when Elgato Camera Hub is running simultaneously

**Verdict: CANNOT_VERIFY**

The crash is in `objc_release` while Qt's cocoa platform plugin (`libqcocoa.dylib`) deallocates an NSArray at quit. It reproduces only while a third-party app (Elgato Camera Hub) is running, and the label is `area/accessibility`. That points to a Qt/macOS accessibility teardown bug triggered by an external accessibility client, not to an identifiable OBS defect. It is macOS 26 only and cannot be reproduced or debugged here.

Evidence:
- The crash stack (from the issue) has no OBS frames above `libqcocoa`. Labels `area/dependency` and `area/accessibility` say the cause sits in Qt.

Related: none.

### [#13392](https://github.com/obsproject/obs-studio/pull/13392) — cmake: Switch preset to VS 2026

**Verdict: ALREADY_ADDRESSED**

Master already uses the VS 2026 generator in both Windows presets. Commit `83bb52b68` ("CI: Update to Windows 2025 with VS 2026") changed it.

Evidence:
- `CMakePresets.json:161,190`: `"generator": "Visual Studio 18 2026"`.

Related: none.

### [#13413](https://github.com/obsproject/obs-studio/pull/13413) — shared/properties-view: Remove unused signals

**Verdict: IMPLEMENT** (cherry-pick-pr)

Nothing in the tree, including the obs-browser and obs-websocket submodules, connects to `PropertiesRefreshed` or `PropertiesResized`. The only occurrences are their declarations and the `emit` calls. `OBSPropertiesView` lives in `shared/`, which is statically linked and not exported plugin API, so removing the signals cannot break external consumers. The PR removes 5 lines and applies cleanly.

Evidence:
- `shared/properties-view/properties-view.hpp:141,143`: signal declarations.
- `shared/properties-view/properties-view.cpp:165,251`: the only emits. A repo-wide grep finds no `connect` to either signal.

Slice: `git cherry-pick 28bfa7310`. Test: build the `obs-studio` frontend target with MSVC (properties-view is compiled into it). The moc output must regenerate cleanly.

Related: none.

### [#13444](https://github.com/obsproject/obs-studio/issues/13444) — Refactor out usages of sender()

**Verdict: IMPLEMENT** (new-change, first slice only)

This is a tech-debt tracking issue from a maintainer, and it says the work does not need to land in one PR. There are 45 `sender()` uses across about 15 frontend files, which is too many for one small slice. The smallest coherent first slice is the issue's own example plus its twin: the two path item delegates. Both use `dynamic_cast<QLineEdit *>(sender())` in an `updateText()` slot connected to `editingFinished`. Replace each with a lambda that captures the container widget and emits `commitData(container)`, then delete the `updateText` slot. The other files are left for later slices.

Evidence:
- `frontend/importer/ImporterEntryPathItemDelegate.cpp:64,156-161`: `connect(text, &QLineEdit::editingFinished, this, &...::updateText)`, and `updateText` uses `sender()`.
- `frontend/utility/RemuxEntryPathItemDelegate.cpp:81,212`: the same pattern.
- Other `sender()` users, deferred: `frontend/components/VolumeControl.cpp`, `frontend/settings/OBSBasicSettings.cpp`, `frontend/widgets/OBSBasic_*.cpp`, `frontend/widgets/OBSProjector.cpp`, `frontend/utility/ExtraBrowsersModel.cpp`.

Slice: in both delegates' `createEditor`, replace the `editingFinished` connect with `connect(text, &QLineEdit::editingFinished, this, [this, container]() { emit commitData(container); });`. Remove the `updateText()` slot from the .cpp/.hpp files. About 20 lines across 4 files. Test: MSVC build of the frontend, then manually edit a path in the Remux dialog and the Import Scene Collection dialog and confirm it commits.

Related: none.

### [#13465](https://github.com/obsproject/obs-studio/pull/13465) — cmake: Propagate OBS_VERSION_OVERRIDE on Windows

**Verdict: IMPLEMENT** (cherry-pick-pr)

The bug is confirmed. The Windows multi-architecture helper re-invokes CMake for the secondary architectures (x86, and x64 when the parent is ARM64) without forwarding `OBS_VERSION_OVERRIDE`. Those child configures then fall back to `git describe`, which fails fatally in a clone without tags, or yields a different version. Forwarding the variable as `-DOBS_VERSION_OVERRIDE:STRING=${...}` passes an empty string when it is unset. So the PR also switches `versionconfig.cmake` from `DEFINED` checks to empty-string checks, which keeps "unset" and "empty" equivalent. Two files, +5/-2, applies cleanly.

Evidence:
- `cmake/windows/architecture.cmake:15-45`: three `execute_process` child configures pass `VIRTUALCAM_GUID` and `CMAKE_MESSAGE_LOG_LEVEL`, but not `OBS_VERSION_OVERRIDE`.
- `cmake/common/versionconfig.cmake:9,26`: `if(NOT DEFINED OBS_VERSION_OVERRIDE ...)` / `elseif(DEFINED OBS_VERSION_OVERRIDE)`.
- `cmake/common/versionconfig.cmake:19-21`: `FATAL_ERROR` when `git describe` errors.

Slice: `git cherry-pick 6fb172e0b`. Test: on this Windows x64 box, configure the `windows-x64` preset with `-DOBS_VERSION_OVERRIDE=32.1.0`. Check that the build_x86 child configure reports the overridden version (for example `OBS_VERSION` in `build_x86/CMakeCache.txt`), and that a configure without the override still uses `git describe`.

Related: none.

### [#13499](https://github.com/obsproject/obs-studio/issues/13499) — obs-browser: Use CEF official methods of replacing/disabling error pages

**Verdict: DEFER_LARGE**

This tracking issue is blocked on an external dependency: CEF has no API yet for overriding or disabling Chrome-runtime error pages (chromiumembedded/cef#3852). The workaround is already in place in the obs-browser submodule: on load errors other than `ERR_ABORTED` it blanks the page with JavaScript, and the code links to this issue with a FIXME. Nothing can be implemented until CEF ships the API, and the change would land in the obs-browser submodule, not in this tree.

Evidence:
- `plugins/obs-browser/browser-client.cpp:672-686`: the `OnLoadError` workaround, with comments referencing #13499 and cef#3852.
- `plugins/obs-browser/obs-browser-plugin.cpp:312`: `settings.chrome_runtime = true`.
- `.gitmodules`: `plugins/obs-browser` is an external submodule.

Related: 12944.
