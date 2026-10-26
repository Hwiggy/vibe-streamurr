# Triage batch build-ci-docs-04

- Batch id: build-ci-docs-04 (area hint: build-ci-docs)
- Items: 13601, 13658, 13676, 13678, 13740, 13743, 13745, 13748, 13756, 13763, 13817, 13864, 13910, 13945, 13966, 13993, 14033, 14058, 14059, 14068, 14075, 14085
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; PR heads from `refs/upstream-pr/<N>`. Local git is 2.33, which has no `merge-tree --write-tree`, so applicability was checked with the legacy three-way form `git merge-tree $(git merge-base master PR) master PR` and a count of `+<<<<<<<` markers. WebFetch was used twice (PR 13864 and PR 13756) to read maintainer comments.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 13601 | issue | DEFER_LARGE |
| 13658 | issue | CANNOT_VERIFY |
| 13676 | PR | DEFER_LARGE |
| 13678 | issue | CANNOT_VERIFY |
| 13740 | issue | DEFER_LARGE |
| 13743 | PR | DEFER_LARGE |
| 13745 | PR | DEFER_LARGE |
| 13748 | PR | DEFER_LARGE |
| 13756 | PR | CANNOT_VERIFY |
| 13763 | PR | IMPLEMENT (cherry-pick) |
| 13817 | PR | OUT_OF_SCOPE |
| 13864 | PR | DEFER_LARGE |
| 13910 | PR | IMPLEMENT (cherry-pick) |
| 13945 | issue | OUT_OF_SCOPE |
| 13966 | PR | IMPLEMENT (cherry-pick) |
| 13993 | PR | IMPLEMENT (cherry-pick) |
| 14033 | PR | IMPLEMENT (cherry-pick) |
| 14058 | PR | IMPLEMENT (partial-pr) |
| 14059 | PR | DEFER_LARGE |
| 14068 | issue | CANNOT_VERIFY |
| 14075 | PR | IMPLEMENT (cherry-pick) |
| 14085 | issue | CANNOT_VERIFY |

---

### [#13601](https://github.com/obsproject/obs-studio/issues/13601) — fails to build with mbedtls 4.1.0

**Verdict:** DEFER_LARGE

The report is a compile failure on Arch Linux: `librtmp/rtmp.h` includes `mbedtls/ctr_drbg.h`, and mbedtls 4 removed that header when it moved to TF-PSA-Crypto. The defect is real. Since then, upstream commit `71ef44f06` ("cmake: Require MbedTLS 3 and exclude 4 or later") has pinned every `find_package(MbedTLS 3...<4)`. With mbedtls 4 installed, the build now stops at configure with a clear version error instead of a confusing compile error. That is a mitigation, not v4 support. Real support means porting librtmp's HMAC, MD5 and RNG code, plus the frontend signature verification, to the PSA API. That is crypto work under active design review (see #13864, labelled `needs/design`, and the competing alternative-backend PRs #13676 and #14059). It also cannot be tested here because the bundled deps ship mbedtls 3.6.4.

Evidence:
- `plugins/obs-outputs/librtmp/rtmp.h:63` includes `<mbedtls/ctr_drbg.h>` (removed in mbedtls 4)
- `plugins/obs-outputs/CMakeLists.txt:3`, `frontend/cmake/os-windows.cmake:9`, `frontend/cmake/feature-whatsnew.cmake:9`: `find_package(MbedTLS 3...<4 REQUIRED)` (commit 71ef44f06)
- `frontend/utility/crypto-helpers-mbedtls.cpp:12-32` uses `mbedtls_pk_*` / `mbedtls_md`, which would also need review for v4
- `.deps/obs-deps-2026-10-23-x64/include/mbedtls/build_info.h:37`: bundled version is 3.6.4

Related: #13864, #13676, #14059

### [#13658](https://github.com/obsproject/obs-studio/issues/13658) — OBS freezes when drag&drop any element on the software

**Verdict:** CANNOT_VERIFY

The UI hangs when dragging scene items on CachyOS with the Flatpak build. The reporter installed third-party plugins first and suspects them. There is no stack or backtrace, only a general log, and nothing points to a specific code path in the preview or scene-tree drag handling. It cannot be reproduced or tied to a defect without a stack trace or a clean-profile repro.

Evidence:
- The body attaches only a general log with no hang backtrace. The reporter's own steps include "installed some plugins, maybe the problem are them".

Related: none

### [#13676](https://github.com/obsproject/obs-studio/pull/13676) — cmake: Add OpenSSL as an alternative to MbedTLS

**Verdict:** DEFER_LARGE

This adds a `CRYPTO_BACKEND=openssl` option, backports the OpenSSL code from upstream librtmp, and adds certificate verification and frontend signature verification on OpenSSL. The diff is 10 files, +353/-74, and it no longer merges cleanly: legacy merge-tree finds 4 conflict hunks. Choosing a second (or third) crypto backend is an architectural and security decision that upstream has not settled. #14059 proposes GnuTLS for the same purpose and #13864 proposes moving to mbedtls 4. This is not a small slice.

Evidence:
- `git diff master...refs/upstream-pr/13676 --stat`: 10 files, 353+/74-
- legacy `git merge-tree`: 4 conflicts against master 72e866557
- current single backend: `plugins/obs-outputs/CMakeLists.txt:3` (MbedTLS only)

Related: #13601, #13864, #14059

### [#13678](https://github.com/obsproject/obs-studio/issues/13678) — Window capture borderless (client area) crop problem

The original title is in Chinese and translates as "window capture borderless-mode crop problem".

**Verdict:** CANNOT_VERIFY

This affects Windows Graphics Capture with "client area" enabled. The reporter's sequence is: start Minecraft un-maximized, then maximize it (or toggle fullscreen and then maximize). After that a thin strip of the border shows at the top, and black bars can appear at the bottom. Toggling the client-area option fixes it. The reporter guesses that the captured frame has black padding that `get_client_box` does not account for. In the code, `get_client_box` computes the crop from `GetClientRect`, `ClientToScreen` and `DWMWA_EXTENDED_FRAME_BOUNDS` on every frame, and `on_frame_arrived` already calls `frame_pool.Recreate` whenever `ContentSize` changes. So resizing is already handled, and the reporter's suggested fix ("detect resize") is already in the code. What remains seems to come from a mismatch between frame-surface padding and DWM bounds that appears only for this game's window behaviour. It needs a repro to pin down. I could not identify a deterministic defect.

Evidence:
- `libobs-winrt/winrt-capture.cpp:39-77`: `get_client_box` derives the crop from live window geometry each frame
- `libobs-winrt/winrt-capture.cpp:132-139`: uses `GetDesc` because `ContentSize` is "not reliable"
- `libobs-winrt/winrt-capture.cpp:180-189`: frame pool recreated on content-size change (resize already handled)
- `libobs-winrt/winrt-capture.cpp:284`: `winrt_capture_device_loss_rebuild` is what the toggle triggers

Related: none

### [#13740](https://github.com/obsproject/obs-studio/issues/13740) — OBS does not properly hook applications (PCSX2 2.7.57 or newer) that load the Agility SDK via Independent devices

**Verdict:** DEFER_LARGE

The diagnosis is accurate. `hook_d3d12()` resolves the system `d3d12.dll`, creates a throwaway device and detours `ID3D12CommandQueue::ExecuteCommandLists` at the address from that device's vtable. PCSX2 later loads an Agility SDK `D3D12Core` through the Independent Devices API, so its command queues use a different implementation, and the hook installed earlier never fires. Fixing this means detecting late-loaded or independent D3D12 cores and re-hooking, or hooking at a different layer. That is a non-trivial graphics-hook design change with anti-cheat and stability risk, and it cannot be tested without PCSX2 and DX12 hardware.

Evidence:
- `plugins/win-capture/graphics-hook/d3d12-capture.cpp:403-438`: `hook_d3d12` uses `get_system_module("d3d12.dll")` and hooks `ExecuteCommandLists` once
- nothing in `plugins/win-capture` references `D3D12SDKConfiguration` or `D3D12Core` (checked with `git grep`)

Related: none

### [#13743](https://github.com/obsproject/obs-studio/pull/13743) — build-aux: Update formatter and linter scripts

**Verdict:** DEFER_LARGE

This is a rewrite of the lint and format tooling: new Bash, Zsh and PowerShell launchers, zizmor and xmllint support, GitHub annotation output, swift-format lint fixes in libobs-metal and the mac virtualcam, and gersemi 0.28 formatting changes. The diff is 6 commits, 42 files, +1157/-276. It merges without conflicts, but it is developer tooling far beyond a small slice, and it mainly prepares for the CI rewrite (#13748).

Evidence:
- `git diff master...refs/upstream-pr/13743 --shortstat`: 42 files, 1157+/276-
- legacy merge-tree: 0 conflicts

Related: #13745, #13748

### [#13745](https://github.com/obsproject/obs-studio/pull/13745) — cmake: Fix conceptual issues and clean up warning usage

**Verdict:** DEFER_LARGE

This PR is stacked on #13743: the branch contains all six of its commits plus 13 CMake commits, 95 files and +1281/-364 in total. The CMake-only part (commits ba52d6ad6..3f7d16682) is still 57 files, +125/-89, and has 1 conflict when applied without #13743. It also changes policy handling in `CMakePresets.json` and turns warnings into errors on CI, which are build-policy decisions. A few commits stand alone and could be picked later on their own merits. The best candidate is bed6a0b0e, "Fix sub-project locations on Windows": `cmake/windows/architecture.cmake` currently writes `build_x86` / `build_x64` under `CMAKE_SOURCE_DIR` instead of next to the build directory. With the default presets, the build directory already sits in the source dir, so this matters only for custom build dirs.

Evidence:
- `git log master..refs/upstream-pr/13745`: 19 commits (6 from #13743)
- `git diff 5d0407fe5 3f7d16682 --shortstat`: 57 files, 125+/89-, 1 conflict on master
- `cmake/windows/architecture.cmake` (master): `-B ${CMAKE_SOURCE_DIR}/build_x86` sub-project paths

Related: #13743, #13748

### [#13748](https://github.com/obsproject/obs-studio/pull/13748) — CI: Full rewrite of CI implementation

**Verdict:** DEFER_LARGE

This is a complete rewrite of the GitHub Actions CI: 301 files, +12594/-5854, and 13 conflict hunks against master. It depends on #13743 and #13745. It is far too large for a slice. CI changes are also of limited value to a private fork that does not publish releases from this workflow.

Evidence:
- `git diff master...refs/upstream-pr/13748 --shortstat`: 301 files changed
- legacy merge-tree: 13 conflicts

Related: #13743, #13745

### [#13756](https://github.com/obsproject/obs-studio/pull/13756) — Fix PayPal Broken link

**Verdict:** CANNOT_VERIFY

This removes the `paypal.me/obsproject` funding link from `README.rst`. The only basis is the author's claim that the link is broken. The PR thread (read once with WebFetch) has no maintainer confirmation that the link is dead or that PayPal is no longer accepted. The only maintainer comment asks the author to fill out the template. Which donation channels the project lists is the upstream organisation's call, and I cannot confirm the link status from code. The PR applies cleanly if this is confirmed later.

Evidence:
- `README.rst:46-49`: lists Patreon, OpenCollective and PayPal (`https://www.paypal.me/obsproject`)
- PR thread: no maintainer decision; labelled `area/documentation` only

Related: none

### [#13763](https://github.com/obsproject/obs-studio/pull/13763) — cmake: Use 'CMAKE_OBJDUMP' instead of 'objdump' directly

**Verdict:** IMPLEMENT (cherry-pick-pr)

Eight find modules call a bare `objdump` in their Linux/FreeBSD SONAME probe. `Findqrcodegencpp.cmake` already uses `${CMAKE_OBJDUMP}`, which CMake fills in from the active toolchain (cross or LLVM toolchains, and Gentoo's prefixed binutils; downstream bug https://bugs.gentoo.org/946059). The change is a mechanical 8-line edit for consistency, and it merges cleanly.

Evidence:
- `cmake/finders/FindFFmpeg.cmake:255`, `FindLibrist.cmake:60`, `FindLibrnnoise.cmake:60`, `FindLibspeexdsp.cmake:60`, `FindLibsrt.cmake:60`, `FindLibx264.cmake:60`, `FindLuajit.cmake:60`, `Findjansson.cmake:60`: bare `objdump -p`
- `cmake/finders/Findqrcodegencpp.cmake:57`: already uses `${CMAKE_OBJDUMP}`
- legacy merge-tree: 0 conflicts

Slice plan: cherry-pick `7e229763f` (author Chiitoo), 8 files, 8+/8-. GPL-2.0-or-later contribution; keep authorship.
Test plan: the changed lines run only in the `CMAKE_HOST_SYSTEM_NAME MATCHES "Linux|FreeBSD"` branch, so they cannot run on this Windows box. Run a Windows CMake configure (`cmake --preset windows-x64`) to confirm the finders still parse. Mark the Linux behaviour UNTESTED in the commit message.

Related: none

### [#13817](https://github.com/obsproject/obs-studio/pull/13817) — cmake: Fixes for OpenBSD support

**Verdict:** OUT_OF_SCOPE

This adds about 124 lines of new `os-openbsd.cmake` files for libobs and the frontend, largely copied from the FreeBSD configs, minus libprocstat, libpci, libsysinfo and PulseAudio. OpenBSD is not a supported OBS platform. Upstream only routes it through the generic Unix branch in `osconfig.cmake`. The fork cannot build or test OpenBSD, and duplicating the FreeBSD config adds maintenance cost with no supported user. Under the triage rules, unsupported platforms are out of scope. The PR merges cleanly if this is ever wanted.

Evidence:
- `cmake/common/osconfig.cmake:15`: `Linux|FreeBSD|OpenBSD` already sent through the Unix path
- `git diff master...refs/upstream-pr/13817 --stat`: new `frontend/cmake/os-openbsd.cmake` (53 lines), `libobs/cmake/os-openbsd.cmake` (71 lines)

Related: none

### [#13864](https://github.com/obsproject/obs-studio/pull/13864) — obs-outputs: upgrade mbedtls dependency to v4

**Verdict:** DEFER_LARGE

This ports librtmp to mbedtls 4 / PSA (HMAC through `psa_mac_*`, MD5 through `psa_hash_*`, drops ctr_drbg/entropy, adds `psa_crypto_init`), with version gates so mbedtls 3 keeps working. It is 7 files, +94/-7, and merges cleanly. It is still not a safe slice:

1. Maintainers labelled it `needs/design` and are still discussing the CMake version range: `SameMajorVersion` means `3...<5` cannot match, and a reviewer asked to strip the range (thread read with WebFetch).
2. The PR removes the `<4` cap for the frontend too (`os-windows.cmake`, `feature-whatsnew.cmake`) without porting or reviewing `crypto-helpers-mbedtls.cpp` for v4.
3. Every PSA call ignores its return status, which the author flags as a concern. In crypto code, a silently failed HMAC setup is a correctness risk.
4. The v4 path cannot be tested here, because the bundled deps are mbedtls 3.6.4.

Evidence:
- `git diff master...refs/upstream-pr/13864 --stat`: 7 files
- `plugins/obs-outputs/librtmp/handshake.h` (PR): `HMAC_setup` ignores `psa_import_key` / `psa_mac_sign_setup` return values
- `frontend/utility/crypto-helpers-mbedtls.cpp:12-32`: not touched by the PR even though its version cap is removed
- `.deps/obs-deps-2026-10-23-x64/include/mbedtls/build_info.h:37`: 3.6.4

Related: #13601, #13676, #14059

### [#13910](https://github.com/obsproject/obs-studio/pull/13910) — cmake: Copy WebGPU DLLs for obs-browser

**Verdict:** IMPLEMENT (cherry-pick-pr)

On Windows, the CEF post-build copy and `install()` list copies `chrome_elf`, `libEGL`, `libGLESv2` and `v8_context_snapshot`, but not `dxcompiler.dll` / `dxil.dll`, so WebGPU in browser sources does not work. macOS already ships WebGPU support (per the PR author, an OBS team member). The CEF 7871 package this fork uses does contain both DLLs, so the change is 4 lines in one file and applies cleanly. Cost: about 25.8 MB extra in the install. Caveat: building with the old CEF 5060 package, which lacks these DLLs, would make the copy fail. This fork's deps use 7871.

Evidence:
- `cmake/windows/helpers.cmake:122-125`: copy list without dxcompiler/dxil
- `cmake/windows/helpers.cmake:137-146`: install list without dxcompiler/dxil
- `.deps/cef_binary_7871_windows_x64/Release/dxcompiler.dll`, `.../dxil.dll` are present
- legacy merge-tree: 0 conflicts

Slice plan: cherry-pick `1125fc17b` (author WizardCM), `cmake/windows/helpers.cmake` only, 4+/1-.
Test plan: Windows x64 build of obs-browser. Check that `dxcompiler.dll` and `dxil.dll` land in `build_x64/rundir/<Config>/obs-plugins/64bit/`, then open a browser source at https://webgpu.github.io/webgpu-samples/ to confirm WebGPU. That last check needs a GPU and a manual run; if it is not done, mark it UNTESTED.

Related: none

### [#13945](https://github.com/obsproject/obs-studio/issues/13945) — obs takes ages to load with many fonts installed

**Verdict:** OUT_OF_SCOPE

With about 6600 fonts installed, startup takes about 60 s. With `-platform windows:fontengine=gdi` it takes about 10 s. OBS does not enumerate system fonts at startup itself. It only registers three bundled fonts with `QFontDatabase::addApplicationFont`, and Qt 6's DirectWrite font database then populates every installed family. The slowness is inside Qt's DirectWrite backend, and the reporter already has a workaround (the GDI font engine). Forcing GDI for everyone would change text rendering for all users, which is a UX decision. Report this to Qt.

Evidence:
- `frontend/obs-main.cpp:537-539`: only `addApplicationFont` for OpenSans; no family enumeration in OBS code
- `git grep QFontDatabase` in frontend/shared: no other startup enumeration (`shared/qt/plain-text-edit/plain-text-edit.cpp:10` is a lazily created widget)

Related: none

### [#13966](https://github.com/obsproject/obs-studio/pull/13966) — docs: fix "soure" typo in CONTRIBUTING.md

**Verdict:** IMPLEMENT (cherry-pick-pr)

This is a one-word typo fix ("soure" to "source"), and the typo is still present on master. It applies cleanly. The author account disclosed that an AI agent wrote the change. A one-word spelling fix carries no copyright or licensing concern.

Evidence:
- `CONTRIBUTING.md:91`: "...Objective-C++ soure code"
- legacy merge-tree: 0 conflicts

Slice plan: cherry-pick `99942dceb`, 1 file, 1+/1-.
Test plan: documentation only; check the diff. No build needed.

Related: none

### [#13993](https://github.com/obsproject/obs-studio/pull/13993) — .editorconfig: Add 120 column guidelines

**Verdict:** IMPLEMENT (cherry-pick-pr)

This adds `guidelines = 120` to the `[*]` section so that editors with a guidelines extension (VS EditorGuidelines, some VS Code extensions) draw a ruler at the project's 120-column limit. clang-format enforces the limit for code but not for comments. Editors that do not know the key ignore it. It applies cleanly.

Evidence:
- `.editorconfig:9-14`: `[*]` section without a guideline key
- legacy merge-tree: 0 conflicts

Slice plan: cherry-pick `ebd3768c0` (author derrod), 1 line.
Test plan: open the repo in Visual Studio with EditorGuidelines installed and check that the ruler appears at column 120. Otherwise check the diff only. There is no build impact.

Related: none

### [#14033](https://github.com/obsproject/obs-studio/pull/14033) — cmake: Set a global IDE folder for autogen targets

**Verdict:** IMPLEMENT (cherry-pick-pr)

Sets the global `AUTOGEN_TARGETS_FOLDER` property so that Qt `*_autogen` / `*_autogen_timestamp_deps` targets are grouped in an "autogen" folder in IDEs instead of cluttering the frontend and plugins folders. It is 3 lines in `bootstrap.cmake`, has no effect on build output, and applies cleanly.

Evidence:
- `cmake/common/bootstrap.cmake:82`: end of the file, where the property is added; no existing `AUTOGEN_TARGETS_FOLDER`
- legacy merge-tree: 0 conflicts

Slice plan: cherry-pick `479ba8ac5` (author PatTheMav), 3+ lines.
Test plan: `cmake --preset windows-x64`, open `obs-studio.sln` in Visual Studio and check that the `*_autogen` projects sit under an "autogen" solution folder. Build the frontend target to confirm there is no regression.

Related: none

### [#14058](https://github.com/obsproject/obs-studio/pull/14058) — libobs: Deprecate `video_output_get_frame_rate()`

**Verdict:** IMPLEMENT (partial-pr)

The defect is real. `video_output_get_frame_rate()` resolves to the root `video_t` through `get_const_root()`, while an encoder-scaled child `video_t` created with an FPS divisor stores `fps_den *= divisor` in its own `info`. The function therefore reports the parent frame rate. Its only in-tree caller, `flv-mux.c`, passes `obs_encoder_video(vencoder)` and so writes the wrong `framerate` into FLV metadata when an encoder uses a frame-rate divisor. `video_output_get_info()` returns the child's own info.

The PR as submitted is not safe to take whole, for two reasons:

1. Adding `OBS_DEPRECATED` without migrating `flv-mux.c` triggers `-Wdeprecated-declarations`. With `CMAKE_COMPILE_WARNING_AS_ERROR` on by default, that breaks the obs-outputs build unless `OBS_COMPILE_DEPRECATION_AS_WARNING` is set.
2. Its RST uses `.. deprecated: 34.0` with a single colon, which Sphinx treats as a comment. The existing docs use `.. deprecated:: X`.

Evidence:
- `libobs/media-io/video-io.c:378-383`: `get_const_root` walks to the parent
- `libobs/media-io/video-io.c:606-614`: frame rate is computed from the root's `fps_num` / `fps_den`
- `libobs/media-io/video-io.c:670`: child `new_video->info.fps_den *= divisor`
- `libobs/media-io/video-io.c:504-507`: `video_output_get_info` returns the child's own info
- `plugins/obs-outputs/flv-mux.c:194,215`: only caller, passes the encoder's video
- `cmake/common/compiler_common.cmake:52,61,85-86`: `-Wdeprecated-declarations` plus warnings-as-errors by default
- `docs/sphinx/reference-core.rst:367`: correct `.. deprecated:: 31.1` syntax

Slice plan (partial, about 10 lines):
1. `libobs/media-io/video-io.h:323`: mark the function `OBS_DEPRECATED` (as in the PR).
2. `plugins/obs-outputs/flv-mux.c:215`: replace the call with `video_output_get_info(video)` and compute `(double)info->fps_num / info->fps_den`, with a NULL guard. This fixes the divisor bug in FLV metadata and avoids the deprecation warning.
3. `docs/sphinx/reference-libobs-media-io.rst:229`: add a correctly formed `.. deprecated:: 34.0` with the replacement note.

Credit tt2468 (PR #14058) in the commit message for the deprecation idea.

Test plan: build `libobs` and `obs-outputs` on Windows x64 with MSVC (warnings as errors) and confirm no C4996 errors. Runtime check: record to FLV with an encoder FPS divisor of 2, then inspect the metadata `framerate` (e.g. with `ffprobe`) and expect half the base FPS. If the runtime check is not done, mark it UNTESTED.

Related: none

### [#14059](https://github.com/obsproject/obs-studio/pull/14059) — cmake: Add GnuTLS and Nettle as an alternative to MbedTLS

**Verdict:** DEFER_LARGE

This adds a `CRYPTO_BACKEND=gnutls` option (a new `cmake/common/crypto-backend.cmake`), GnuTLS paths in librtmp, and a 22-line GnuTLS signature verifier for the frontend updater. It is 9 files, +151/-27, and merges cleanly. The motivation is real: Fedora plans to drop mbedtls and mbedtls has announced a possible EOL. But this is a crypto-backend architecture decision competing with #13676 (OpenSSL) and #13864 (mbedtls 4), and it touches the security-sensitive update signature check. The fork's Windows target cannot exercise it. It needs an upstream design decision first.

Evidence:
- `git diff master...refs/upstream-pr/14059 --stat`: 9 files including a new `frontend/utility/crypto-helpers-gnutls.cpp`
- `frontend/utility/crypto-helpers-mbedtls.cpp`: the existing (only) verifier implementation

Related: #13601, #13676, #13864

### [#14068](https://github.com/obsproject/obs-studio/issues/14068) — Cannot resize OBS on Golden Gate

**Verdict:** CANNOT_VERIFY

On macOS 27, the window cannot be resized by dragging its borders. There is no log, and no detail on whether this affects all windows or only the main window, or whether docks are locked. Window-edge hit-testing on macOS is handled by Qt's Cocoa platform plugin, not OBS code, so this is likely a Qt or macOS 27 compatibility issue. It cannot be checked on this Windows box.

Evidence:
- The body has no log URL and only one repro step.

Related: none

### [#14075](https://github.com/obsproject/obs-studio/pull/14075) — Fix nvml type clash with latest nv-codec-headers

**Verdict:** IMPLEMENT (cherry-pick-pr)

`obs-nvenc-test.cpp` hand-declares the NVML types it needs, including `typedef int nvmlReturn_t;`. The newest nv-codec-headers ship their own NVML declarations, with `nvmlReturn_t` as an enum, so the two definitions clash and the build fails. The PR defines `NVML_API_VERSION` before including the ffnvcodec headers. That is the guard real `nvml.h` defines, and it tells ffnvcodec to skip its own NVML block. The author, BtbN, maintains nv-codec-headers. It is a one-line change that applies cleanly. The bundled 2026-10-23 headers contain no NVML declarations, so with today's deps the define has no effect, and it keeps the build working after a headers bump.

Evidence:
- `plugins/obs-nvenc/obs-nvenc-test/obs-nvenc-test.cpp:8-9`: ffnvcodec includes
- `plugins/obs-nvenc/obs-nvenc-test/obs-nvenc-test.cpp:25-31`: local NVML defines and `typedef int nvmlReturn_t`
- `grep -rn nvml .deps/obs-deps-2026-10-23-x64/include/ffnvcodec/`: no matches (current deps unaffected)

Slice plan: cherry-pick `55eff4e51` (author BtbN), 1 line.
Test plan: Windows x64 MSVC build of the `obs-nvenc-test` target against the current deps, to confirm no regression. The clash itself can only be reproduced with newer nv-codec-headers than the bundled ones, so the fix is UNTESTED against the new headers.

Related: none

### [#14085](https://github.com/obsproject/obs-studio/issues/14085) — Constant Crashing on Bazzite Linux 44 (Fedora Fork) After October 24 Flatpak Update

**Verdict:** CANNOT_VERIFY

OBS 33.0.0-rc3 (Flatpak) dies with SIGILL inside the bundled `libcef.so`, at identical offsets, even with no browser sources. It started after a Flatpak update that also bumped the KDE runtime to 6.11. On x86, Chromium's `CHECK` / `IMMEDIATE_CRASH` lowers to `int3; ud2`, so a SIGILL in CEF is almost certainly an internal assertion firing, not a code-generation bug. Without a symbolized stack, the failing assertion and whether the trigger is OBS code, CEF or the runtime cannot be determined. This is Flatpak and pre-release specific, and nothing in OBS source points to a defect.

Evidence:
- The body describes SIGILL in `/app/lib/obs-modules/core/libcef.so` with no symbolized backtrace
- The crashes started the same day as the `org.kde.Platform//6.11` runtime update

Related: none
