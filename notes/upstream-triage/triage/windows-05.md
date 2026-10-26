# Upstream triage — batch windows-05

- Batch: windows-05 (area hint: windows)
- Items: 13719, 13724, 13728, 13731, 13732, 13788, 13810, 13828, 13841, 13858, 13867, 13893, 13897, 13903, 13919, 13962, 13977, 13989
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; PR heads from `refs/upstream-pr/<N>`; code read at master. No comment threads consulted, no WebFetch used.
- Apply check: the local git is 2.33, which has no `merge-tree --write-tree`. Instead I ran `git diff master...refs/upstream-pr/N | git apply --check` against the working tree, whose sources match master. All 14 PRs in this batch apply cleanly.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 13719 | issue | OUT_OF_SCOPE (works as designed) |
| 13724 | issue | IMPLEMENT (via PR #13841) |
| 13728 | PR | IMPLEMENT (cherry-pick) |
| 13731 | PR | IMPLEMENT (cherry-pick) |
| 13732 | PR | IMPLEMENT (cherry-pick) |
| 13788 | PR | IMPLEMENT (cherry-pick) |
| 13810 | PR | DEFER_LARGE |
| 13828 | PR | IMPLEMENT (cherry-pick) |
| 13841 | PR | IMPLEMENT (cherry-pick) |
| 13858 | PR | IMPLEMENT (cherry-pick) |
| 13867 | PR | DEFER_LARGE (needs libdshowcapture submodule change) |
| 13893 | issue | CANNOT_VERIFY |
| 13897 | PR | IMPLEMENT (cherry-pick) |
| 13903 | PR | DEFER_LARGE |
| 13919 | PR | DEFER_LARGE (needs libdshowcapture submodule change) |
| 13962 | PR | IMPLEMENT (cherry-pick) |
| 13977 | PR | DEFER_LARGE |
| 13989 | issue | CANNOT_VERIFY |

Overlaps to watch while applying: #13858 and #13962 both edit `plugins/win-capture/window-capture.c`, in separate hunks. Apply #13858 first, then #13962. #13841, #13867 and #13919 all edit `plugins/win-dshow/win-dshow.cpp`. #13810 is a large A-to-W API sweep that probably overlaps #13788 (`EnumDisplayDevicesA`).

---

### [#13719](https://github.com/obsproject/obs-studio/issues/13719) — Regression: Automatic Display Capture now selects DXGI instead of Windows Graphics Capture on Windows 10

**Verdict: OUT_OF_SCOPE (works as designed; this is a configuration/support question)**

The reporter says Display Capture set to "Automatic" now picks DXGI Desktop Duplication, which misses NVIDIA Frame Generation frames, where it used to pick WGC. In the code, Automatic always defaults to DXGI. It only switches to WGC in two cases: the monitor is not enumerable on OBS's adapter (`gs_duplicator_get_monitor_index == -1`), or the machine runs on battery and has two or more adapters. So the earlier WGC choice was almost certainly caused by the environment, such as a driver reinstall or a change in adapter/monitor topology, not by a code change. The reporter also says they are not asking for the default to change. Detecting Frame Generation would be a heuristic that needs a vendor API and a maintainer design decision. The supported workaround is to select "Windows 10 (1903 and up)" manually, and the reporter confirms it works.

Evidence:
- `plugins/win-capture/duplicator-monitor-capture.c:250-278` — `choose_method`: AUTO becomes DXGI. It only becomes WGC when `dxgi_index == -1` or (on battery and `gs_get_adapter_count() >= 2`).
- `plugins/win-capture/duplicator-monitor-capture.c:300` — the method is chosen once from settings at update.

Related: none.

### [#13724](https://github.com/obsproject/obs-studio/issues/13724) — OBS Studio Freezes Up When Exiting Program When 1st Razer Kiyo Configure Video Screen Is Open

**Verdict: IMPLEMENT (by cherry-picking PR #13841)**

Root cause found in code. "Configure Video" queues `Action::ConfigVideo`, and the DirectShow worker thread then runs `device.OpenDialog(nullptr, ...)`. That dialog is a modal `OleCreatePropertyFrame` that runs a message loop on the worker thread. On shutdown, `~DShowInput` queues `Action::Shutdown` and then calls `WaitForSingleObject(thread, INFINITE)`. The thread is blocked inside the modal dialog, so OBS hangs until the user closes the dialog. This is the same bug as upstream #13534, which PR #13841 fixes. The issue is labelled `issue/confirmed`.

Evidence:
- `plugins/win-dshow/win-dshow.cpp:266-277` — the destructor waits forever on the DShow thread.
- `plugins/win-dshow/win-dshow.cpp:369-383` — the ConfigVideo/Audio/Crossbar actions open dialogs on that thread.
- `deps/libdshowcapture/src/source/dshowcapture.cpp:133` — `OleCreatePropertyFrame` (modal).

Related: 13841 (#13534 upstream).

Slice: see #13841. Cherry-picking it closes this issue.

### [#13728](https://github.com/obsproject/obs-studio/pull/13728) — virtualcam-module: Make placeholder initialization thread-safe

**Verdict: IMPLEMENT (cherry-pick-pr)**

There is a real data race. `placeholder.cpp` keeps a file-static `std::vector<uint8_t> placeholder`, a `bool initialized`, and non-static globals `int cx, cy`. Every `VCamFilter` calls `initialize_placeholder()` from its own thread, and a host app can create many filters. Two threads can run `convert_placeholder`, which calls `placeholder.resize()`, at the same time. Another filter can also be holding `placeholder.data()` while that happens, leaving a dangling pointer. The PR replaces this with a C++11 function-local static, whose initialization is thread-safe, holding an immutable struct. It also checks the return value of `GdiplusStartup`. The PR is one file, +61/-28, and applies cleanly. In passing, it also stops exporting the stray global symbols `cx`/`cy`.

Evidence:
- `plugins/win-dshow/virtualcam-module/placeholder.cpp:11-13` — unsynchronized static state; `cx`/`cy` are non-static globals.
- `plugins/win-dshow/virtualcam-module/placeholder.cpp:39,44` — `placeholder.resize` and the write through `&placeholder[0]`.
- `plugins/win-dshow/virtualcam-module/placeholder.cpp:121` — `initialize_placeholder` has no locking.
- `plugins/win-dshow/virtualcam-module/virtualcam-filter.cpp:181-183` — called for every filter instance and caches the raw pointer.

Related: 13731.

Slice: `git cherry-pick becd548c3` (refs/upstream-pr/13728).
Files: `plugins/win-dshow/virtualcam-module/placeholder.cpp`.
Test: an MSVC build of the `obs-virtualcam-module` targets is possible here. Checking at runtime that the placeholder shows (start OBS, open a DirectShow consumer while the virtual camera is stopped) is possible on Windows. The race itself is not reproducible, so mark it UNTESTED for the crash.

### [#13731](https://github.com/obsproject/obs-studio/pull/13731) — virtualcam-module: Improve lock tracking for DLL unloading

**Verdict: IMPLEMENT (cherry-pick-pr)**

`DllCanUnloadNow` returns S_OK whenever `locks == 0`. `VCamFactory` objects are handed out to clients, but they never contribute to `locks`, so COM can unload the DLL while a client still holds a factory. `VCamFilter` also increments `locks` and calls AddRef only at the end of its constructor, after it has started its worker thread. The PR moves the increment to the top of the constructor and adds increment/decrement calls to the `VCamFactory` constructor and destructor. It is 5 changed lines and applies cleanly. The PR text links this to the virtual camera host crashes in #10566.

Evidence:
- `plugins/win-dshow/virtualcam-module/virtualcam-module.cpp:19` — the factory constructor does not touch `locks`.
- `plugins/win-dshow/virtualcam-module/virtualcam-module.cpp:241-244` — `DllCanUnloadNow` relies only on `locks`.
- `plugins/win-dshow/virtualcam-module/virtualcam-filter.cpp:96-99` — the thread starts before `AddRef`/`locks++`.

Related: 13728.

Slice: `git cherry-pick 170ce6e6e`.
Files: `virtualcam-filter.cpp`, `virtualcam-module.cpp`.
Test: MSVC build of the virtualcam module, then a manual virtual camera smoke test. The unload race is UNTESTED.

### [#13732](https://github.com/obsproject/obs-studio/pull/13732) — Fix a few vertex buffer related issues

**Verdict: IMPLEMENT (cherry-pick-pr)**

The PR fixes three things:
1. When a vertex buffer, index buffer or vertex shader is destroyed, `gs_vertexbuffer_destroy`, `gs_indexbuffer_destroy` and `gs_shader_destroy` clear only `last*`, not `cur*`. That leaves the device with dangling pointers.
2. `NumBuffersExpected`/`MakeBufferList` always push a position buffer. Fullscreen-triangle draws such as `render_convert_plane` and `update_async_texrender` have no positions. The PR derives `hasPositions` from the `SV_Position` input semantic.
3. Some callers don't reset the vertex and index buffers to NULL before a `gs_draw` with no buffer.

I checked the semantic name. The d3d11 shader processor names the position input layout slot `SV_Position` (`d3d11-shaderprocessor.cpp:132`), so `hasPositions` will be set correctly for normal shaders. The PR is 11 files, +49/-7, and applies cleanly. It is a correctness and hardening change in the core renderer, so it needs a runtime smoke test.

Evidence:
- `libobs-d3d11/d3d11-subsystem.cpp:2902-2908,2957-2960` — destroy functions do not clear `curVertexBuffer`/`curIndexBuffer`.
- `libobs-d3d11/d3d11-subsystem.hpp:740-750` — `NumBuffersExpected` always counts +1 for positions.
- `libobs-d3d11/d3d11-vertexbuffer.cpp:48-52` — position buffer pushed unconditionally.
- `libobs-d3d11/d3d11-shaderprocessor.cpp:132` — layout slot named `SV_Position`.
- `libobs/obs-video.c:337`, `libobs/obs-source.c:2461` — `gs_draw(GS_TRIS, 0, 3)` with no explicit vertex/index buffer reset.

Related: none.

Slice: `git cherry-pick 0b002cb49 800d51c59`.
Files: libobs-d3d11 (5 files), `libobs/obs-video.c`, `libobs/obs-source.c`, `plugins/nv-filters/nvidia-videofx-filter.c`, and 3 frontend preview files.
Test: build OBS with MSVC on x64. Run OBS with an async media source, a video capture device or media source, the preview, and GPU conversion, and check for no regressions. The crash itself was not reproduced, so mark it UNTESTED.

### [#13788](https://github.com/obsproject/obs-studio/pull/13788) — win-capture: Skip disconnected display devices

**Verdict: IMPLEMENT (cherry-pick-pr)**

In both monitor enumeration and the properties list, the display capture code calls `EnumDisplayDevicesA(mi.szDevice, 0, ...)` and assumes that monitor index 0 under an adapter is the active one. Microsoft's documentation says to filter on `DISPLAY_DEVICE_ATTACHED_TO_DESKTOP`. When index 0 is a stale or disconnected monitor entry, OBS records the wrong DeviceID. That causes duplicate or wrong monitor matches, which is the problem in upstream #8040. The PR adds a small loop helper and uses it in both places. It is +13/-4 and applies cleanly. It may conflict with #13810, which moves calls to the W APIs.

Evidence:
- `plugins/win-capture/duplicator-monitor-capture.c:198` — `EnumDisplayDevicesA(..., 0, ...)` in `enum_monitor`.
- `plugins/win-capture/duplicator-monitor-capture.c:747` — the same in `enum_monitor_props`.

Related: 13810 (possible textual overlap).

Slice: `git cherry-pick 9e5f99475`.
Files: `plugins/win-capture/duplicator-monitor-capture.c`.
Test: MSVC build of win-capture. Check on a single- or multi-monitor box that Display Capture lists the monitors and captures them. The disconnected-monitor scenario needs specific hardware, so mark it UNTESTED.

### [#13810](https://github.com/obsproject/obs-studio/pull/13810) — win-api: Switch Windows -A apis to -W variants

**Verdict: DEFER_LARGE**

The direction is reasonable: drop ANSI code-page dependence and move toward UTF-8 or wide path handling. But the PR is 12 commits touching 54 files (+727/-745). It bundles the dependent PR #13749, plugin loader path-length changes, `std::filesystem` refactors in the frontend, and new handling of printf `%ls`/`%S`. That is a cross-cutting rewrite, not a small slice. It also overlaps several other window-capture and win-capture PRs. It should be reconsidered as separate per-commit slices only after #13749 lands upstream.

Evidence:
- `git diff master...refs/upstream-pr/13810 --stat` — 54 files, 727+/745-.
- `plugins/win-capture/duplicator-monitor-capture.c:195-198` — an example of the remaining A-API usage the PR targets.

Related: 13788 (overlap), #13749 and #13097 upstream.

### [#13828](https://github.com/obsproject/obs-studio/pull/13828) — libobs-winrt: Capture secondary windows

**Verdict: IMPLEMENT (cherry-pick-pr)**

WGC window capture does not include a window's owned popups and menus, such as Pro Tools menus or Blender preference windows. Windows 11 24H2 added `GraphicsCaptureSession.IncludeSecondaryWindows`. The PR enables it when the property exists at runtime, following the same pattern the file already uses for `IsCursorCaptureEnabled`. It is guarded by `NTDDI_WIN11_GE` and only applies to window capture (`window != NULL`). The repo's presets build against SDK 10.0.26100, which defines `NTDDI_WIN11_GE`. It is +23 lines, one file, and applies cleanly. Caveat: it changes behavior for every WGC window capture on 24H2 with no option to turn it off. That is acceptable for this fork; note it in the commit.

Evidence:
- `libobs-winrt/winrt-capture.cpp:17-27` — the existing `IsPropertyPresent` runtime check pattern for cursor capture.
- `libobs-winrt/winrt-capture.cpp:314,380` — the two `CreateCaptureSession` sites the PR hooks.
- `CMakePresets.json:159` — Windows SDK 10.0.26100.0. The local SDK 10.0.26100 `sdkddkver.h:164` defines `NTDDI_WIN11_GE`.

Related: 13962.

Slice: `git cherry-pick e5ebea46c`.
Files: `libobs-winrt/winrt-capture.cpp`.
Test: MSVC build of libobs-winrt. A runtime check that a child window is captured needs a Windows 11 24H2+ machine. This box is Windows 11 build 26200, so it can be tested manually with Window Capture (WGC) of an app showing a menu.

### [#13841](https://github.com/obsproject/obs-studio/pull/13841) — win-dshow: Close device dialogs during shutdown

**Verdict: IMPLEMENT (cherry-pick-pr)**

This is the fix for the hang described under #13724 and #13534. Before the destructor waits on the thread, it enumerates the DShow worker thread's windows and posts `WM_CLOSE` to the visible ones. The modal property frame then returns and the thread can process `Action::Shutdown`. It is +9 lines, one file, and applies cleanly. The approach is safe because `EnumThreadWindows` only touches windows owned by that worker thread.

Evidence:
- `plugins/win-dshow/win-dshow.cpp:266-277` — destructor.
- `plugins/win-dshow/win-dshow.cpp:369-383` — dialogs opened on the worker thread.
- `plugins/win-dshow/win-dshow.cpp:250` — the thread created with `CreateThread`, whose handle the PR passes to `GetThreadId`.

Related: 13724, #13534 upstream.

Slice: `git cherry-pick d2774adb8`.
Files: `plugins/win-dshow/win-dshow.cpp`.
Test: MSVC build of win-dshow. Manual test: add a Video Capture Device (a webcam is needed), open Configure Video, then close OBS and check it exits. If no camera is available, mark it UNTESTED.

### [#13858](https://github.com/obsproject/obs-studio/pull/13858) — win-capture: Initialize window capture immediately

**Verdict: IMPLEMENT (cherry-pick-pr)**

`wc_create` zero-allocates the struct, so `check_window_timer` starts at 0. `wc_tick` won't look for the window until the timer reaches `WC_CHECK_TIMER`, which is about 1 second. A new or duplicated window capture (for example, studio mode with duplicate sources) therefore shows black for about a second. `wc_update` already calls `force_reset()`, which sets `check_window_timer = WC_CHECK_TIMER`. The PR makes `wc_create` call `wc_update` instead of `update_settings` plus `log_settings`. It is 2 lines plus a forward declaration and applies cleanly. It fixes upstream #4878.

Evidence:
- `plugins/win-capture/window-capture.c:346-347` — create path skips `force_reset`.
- `plugins/win-capture/window-capture.c:386-395` — `force_reset` primes the timer.
- `plugins/win-capture/window-capture.c:397-404` — `wc_update`.
- `plugins/win-capture/window-capture.c:617-621` — the timer gate in `wc_tick`.

Related: 13962 (same file; apply this first), #4878 upstream.

Slice: `git cherry-pick d6696d75e`.
Files: `plugins/win-capture/window-capture.c`.
Test: MSVC build of win-capture. Manual test: add a Window Capture and check the image appears without the 1-second black delay. Testable on this box.

### [#13867](https://github.com/obsproject/obs-studio/pull/13867) — win-dshow: Set audio devices to OBS sample rate

**Verdict: DEFER_LARGE (depends on an unmerged libdshowcapture submodule change)**

The goal is valid: DirectShow audio stays at the device's default rate, for example 44.1 kHz while OBS runs at 48 kHz. But the OBS-side change only sets `audioConfig.sampleRate`. In the vendored libdshowcapture, `AudioConfig::useDefaultConfig` stays true, so `SetupAudioCapture` takes the default media type. `sampleRate` is only used by `GetClosestAudioMediaType` when `!useDefaultConfig`. Without obsproject/libdshowcapture#33 the PR does nothing. Carrying it would mean forking and bumping the `deps/libdshowcapture/src` submodule, which is outside a small slice for this fork. Revisit once upstream libdshowcapture merges #33.

Evidence:
- `plugins/win-dshow/win-dshow.cpp:1028-1032` — where the PR would set `sampleRate`.
- `deps/libdshowcapture/src/source/device.cpp:484-510` — the `useDefaultConfig` path ignores `sampleRate`.
- `deps/libdshowcapture/src/dshowcapture.hpp:200-201` — the `sampleRate` field.
- `git ls-tree master deps/libdshowcapture/src` — submodule commit 8878638.

Related: 13919 (also depends on a libdshowcapture PR).

### [#13893](https://github.com/obsproject/obs-studio/issues/13893) — [Windows 10] Poor frame pacing with WGC window capture

**Verdict: CANNOT_VERIFY**

The reporter sees a periodic duplicate frame when capturing a 60 fps swapchain via WGC on a 360 Hz adaptive-sync display. Their theory is that OBS samples the latest WGC frame on its own video clock. That matches the architecture: the WGC frame-arrived callback updates a texture, and OBS renders whatever is newest at each output tick. But no specific defect can be pointed to. Phase drift between an independent source clock and the OBS output clock is inherent to that design. Fixing it would need frame-timestamp-aware sampling, a significant design change, rather than a bug fix. The report also depends on specific hardware: a 360 Hz VRR monitor and a custom DXGI media swapchain presenter. It reproduces on every OBS version back to 29. Not actionable from code without a repro.

Evidence:
- `libobs-winrt/winrt-capture.cpp:380` and the frame-arrived handling — the latest frame is consumed on the OBS render tick.
- `plugins/win-capture/window-capture.c:803-815` — `wc_render` draws the current WGC texture.

Related: none.

### [#13897](https://github.com/obsproject/obs-studio/pull/13897) — win-dshow: Check both registry views for virtual camera

**Verdict: IMPLEMENT (cherry-pick-pr)**

`obs_module_load` registers the virtual camera output only when `vcam_installed(false)` returns true, which checks only the 32-bit registry view. On Windows on ARM, or when only the 64-bit filter is registered (portable installs), the Start Virtual Camera button never appears, even though 64-bit consumers could use it. The PR checks both views and adds diagnostic log lines showing the registered InprocServer32 path. It is +22/-1, one file, and applies cleanly. It uses existing helpers (`os_wcs_to_utf8_ptr`, `BPtr`).

Evidence:
- `plugins/win-dshow/dshow-plugin.cpp:21-41` — `vcam_installed(bool b64)` exists but is only ever called with `false`.
- `plugins/win-dshow/dshow-plugin.cpp:48-50` — registration is gated on the 32-bit view only.

Related: 13728, 13731 (virtualcam area).

Slice: `git cherry-pick b5a926c93`.
Files: `plugins/win-dshow/dshow-plugin.cpp`.
Test: MSVC x64 build of win-dshow. Check the log lines on startup with the installed virtual camera. The ARM64-only scenario is UNTESTED (no ARM hardware).

### [#13903](https://github.com/obsproject/obs-studio/pull/13903) — win-wasapi: Use Stable IDs for audio devices

**Verdict: DEFER_LARGE (needs API/design decisions; PR still in flux)**

The motivation is valid. WASAPI endpoint IDs change after Windows or driver updates, and Windows 11 24H2 added `PKEY_AudioEndpoint_StableId`. The diff is only about 119 lines, but it needs decisions:
- It adds a new exported libobs API, `get_audio_device_ids` in `util/windows/device-enum.h`, which is a long-term ABI commitment.
- It adds new persisted keys: `MonitoringDeviceStableId` in basic.ini and `device_stable_id` in source settings.
- It silently rewrites the user's saved `device_id` inside `BuildUpdateParams`.
- It adds `#include <util/windows/device-enum.h>` to `OBSBasic.cpp` and `OBSBasicSettings.cpp` without an `_WIN32` guard, which can break Linux/macOS frontend builds.
- The head still contains a "squash later" fixup commit, so it is not final.

Revisit when upstream settles the design.

Evidence:
- `git diff master...refs/upstream-pr/13903` — unguarded includes in `frontend/widgets/OBSBasic.cpp` and `frontend/settings/OBSBasicSettings.cpp`; new EXPORT in `libobs/util/windows/device-enum.h`.
- `libobs/util/windows/device-enum.h:9-10` — currently only `enum_graphics_device_luids` is exported.
- `plugins/win-wasapi/win-wasapi.cpp:488-492` — `BuildUpdateParams`, where settings would be rewritten.

Related: none in batch.

### [#13919](https://github.com/obsproject/obs-studio/pull/13919) — win-dshow: Restore saving and restoring camera properties

**Verdict: DEFER_LARGE (depends on an unmerged libdshowcapture PR; feature with prior history)**

This is a frequently requested feature: persist the camera's Configure Video settings. It is based on Exeldro's earlier PR #5480. It depends on obsproject/libdshowcapture#63, which would require bumping the `deps/libdshowcapture/src` submodule to an unmerged commit. It is +103 lines in `win-dshow.cpp`, but without the library side it won't compile or work. Earlier attempts at this feature did not land upstream, which suggests open design concerns. Defer until the libdshowcapture side lands.

Evidence:
- `git diff master...refs/upstream-pr/13919 --stat` — `win-dshow.cpp` +103.
- `git ls-tree master deps/libdshowcapture/src` — pinned submodule 8878638 without the #63 API.

Related: 13867, 13841 (same file).

### [#13962](https://github.com/obsproject/obs-studio/pull/13962) — win-capture: Improve automatic capture method selection

**Verdict: IMPLEMENT (cherry-pick-pr)**

Windows that use DirectComposition with `WS_EX_NOREDIRECTIONBITMAP` have no GDI redirection surface. BitBlt captures them as black or blank. Today, Automatic mode chooses WGC only from hard-coded window class lists, so such windows end up on BitBlt. The PR checks the extended style of the target window and prefers WGC for it. It splits `method` into `configured_method` and `method_in_use`, so the choice is re-evaluated when the target window is re-found in `wc_tick`. It is +38/-16 in one file and applies cleanly (I checked separately against master; it should also stack after #13858, since the hunks don't overlap).

Review notes for the commit message:
- When `method_in_use` changes from BitBlt to WGC on re-find, the old `dc_capture` isn't freed until destroy. That is harmless.
- `method_in_use` is written in `wc_tick` without `update_mutex`, the same as the existing `wc->method` writes.

Evidence:
- `plugins/win-capture/window-capture.c:140-169` — `choose_method` depends only on the class lists.
- `plugins/win-capture/window-capture.c:206,222` — `wgc_supported` global; method chosen once in `update_settings`.
- `plugins/win-capture/window-capture.c:632` — window re-found in tick without re-evaluating the method.

Related: 13858 (same file), 13828.

Slice: `git cherry-pick 5c0fad5df` (after 13858).
Files: `plugins/win-capture/window-capture.c`.
Test: MSVC build of win-capture. Manual test: Window Capture in Automatic mode of a DComp/no-redirection-bitmap window (for example, some WinUI or transparent apps), checking the log line "method chosen". Normal BitBlt windows should be unchanged. Testable on this box if such an app is available; otherwise mark it UNTESTED for the transparent case.

### [#13977](https://github.com/obsproject/obs-studio/pull/13977) — graphics-hook: Synchronize Vulkan captures with semaphores

**Verdict: DEFER_LARGE**

The problem is plausible. When an app uses separate graphics and present queues, a barrier on the present queue does not order work against the graphics queue, so the copy can read a half-rendered image. This matches symptoms in upstream #11023. The fix is +234/-29 of new per-swapchain-image semaphore plumbing in the Vulkan layer. It intercepts present and submit and handles swapchain recreation. That exceeds the small-slice size, and mistakes risk deadlocks or validation errors inside third-party games. Verifying it needs Vulkan apps with split queues and validation layers. Defer to upstream review.

Evidence:
- `git diff master...refs/upstream-pr/13977 --stat` — `vulkan-capture.c` +258 changed lines, `vulkan-capture.h` +5.
- `plugins/win-capture/graphics-hook/vulkan-capture.c` — current capture relies on barriers only (no semaphore wait in the copy submission).

Related: #11023 upstream.

### [#13989](https://github.com/obsproject/obs-studio/issues/13989) — Video Capture Device fails with DirectShow Run failed (0x80004005) starting with OBS 30.2.0-beta1

**Verdict: CANNOT_VERIFY**

An Epiphan AV.io HD and a Blackmagic ATEM fail with "DShow: Run failed (0x80004005)" on one PC, from 30.2.0-beta1 onward. They work in 30.1.2, and OBS 32 works on another PC. I checked the history. The libdshowcapture submodule is the same commit in 30.1.2 and 30.2.0-beta1 (`ef8c1d2e`). The only win-dshow changes between those tags are the CUDA decoder addition, the FFmpeg 7 compile fix, the virtual camera enablement refactor, and MSVC runtime flags. None of these touch graph `Run()`. The regression is therefore probably environmental (the bundled deps or FFmpeg update, or a driver/filter interaction on that PC), and the reporter says it is machine-specific. A generic E_FAIL from the device's filter graph cannot be traced to code without the hardware.

Evidence:
- `git ls-tree 30.1.2 plugins/win-dshow/` and `git ls-tree 30.2.0-beta1 plugins/win-dshow/` — both pin `libdshowcapture` at `ef8c1d2e`.
- `git log 30.1.2..30.2.0-beta1 -- plugins/win-dshow` — `ce4c99be4` (CUDA decoder), `e693f644a` (FFmpeg 7), `78cd07bd5`, `3af1b78f3`; none touch graph start.

Related: none.
