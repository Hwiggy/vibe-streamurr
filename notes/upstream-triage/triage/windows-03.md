# Upstream triage — batch windows-03

- Batch: windows-03 (area hint: windows)
- Items: 11401, 11434, 11516, 11568, 11632, 11678, 11704, 11722, 11928, 11961, 11970, 11973, 12000, 12050, 12088, 12113, 12162, 12244, 12248, 12483
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`, code read at master, PR heads at `refs/upstream-pr/<N>`.
  The local git is 2.33, which has no `merge-tree --write-tree`. Applicability was checked with
  `git diff master...refs/upstream-pr/N | git apply --check` instead. All four PRs in this batch apply cleanly.
  One WebFetch was used, on PR #12248, to read the maintainer discussion.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 11401 | issue | DEFER_LARGE |
| 11434 | issue | OUT_OF_SCOPE |
| 11516 | issue | CANNOT_VERIFY |
| 11568 | PR | IMPLEMENT (cherry-pick) |
| 11632 | issue | IMPLEMENT (new change) |
| 11678 | issue | CANNOT_VERIFY |
| 11704 | issue | CANNOT_VERIFY |
| 11722 | issue | CANNOT_VERIFY |
| 11928 | issue | OUT_OF_SCOPE |
| 11961 | issue | CANNOT_VERIFY |
| 11970 | issue | OUT_OF_SCOPE |
| 11973 | issue | CANNOT_VERIFY |
| 12000 | PR | IMPLEMENT (partial PR) |
| 12050 | issue | DEFER_LARGE |
| 12088 | issue | DEFER_LARGE |
| 12113 | issue | CANNOT_VERIFY |
| 12162 | issue | IMPLEMENT (new change) |
| 12244 | issue | IMPLEMENT (through PR #12248) |
| 12248 | PR | IMPLEMENT (partial PR) |
| 12483 | PR | IMPLEMENT (partial PR) |

---

### [#11401](https://github.com/obsproject/obs-studio/issues/11401) — Invisible buttons in OBS Studio's UI when using a high-contrast theme in Windows
**Verdict: DEFER_LARGE**

When Windows high contrast is on, OBS forces the special "System" theme. That theme sets the small tool-button icons to fixed SVGs from `:/res/images/*.svg`, which are dark glyphs. Those glyphs vanish on a black high-contrast background. A real fix needs icons that follow the palette, or a light/dark choice of icon set based on the high-contrast scheme. That is theme and UX design work across many icon classes, not a one-line change.

Evidence:
- `frontend/data/themes/System.obt:6-9`: the theme exists only for accessibility.
- `frontend/data/themes/System.obt:35-72`: icons are hard-coded to `:/res/images/plus.svg`, `minus.svg`, `trash.svg`, and others.
- `frontend/OBSApp_Themes.cpp:927-929, 1095`: high contrast forces `com.obsproject.System`.
- `frontend/utility/platform-windows.cpp:436-441`: `HighContrastEnabled()` uses `SPI_GETHIGHCONTRAST`.

Related: none.

### [#11434](https://github.com/obsproject/obs-studio/issues/11434) — Installer .exe fails on Windows 10 Pro
**Verdict: OUT_OF_SCOPE**

The NSIS installer is not in this repository. `git ls-files` finds no `.nsi` or installer sources. The message almost certainly comes from the installer's minimum Windows build check, so the user's Windows 10 build is probably older than the supported minimum. This is a support or OS-version matter that we cannot fix in this tree.

Evidence:
- `git ls-files | grep -i "nsi\|installer"` returns nothing related to the Windows installer.

Related: none.

### [#11516](https://github.com/obsproject/obs-studio/issues/11516) — Entering infinite wait when WASAPISource is destroyed
**Verdict: CANNOT_VERIFY**

The report says `Deactivate()` and `~WASAPISource()` run at the same time on two threads. That would leave `Stop()` waiting forever on `idleSignal` after the reconnect thread has been told to exit. In current libobs the two calls cannot overlap. `tick_sources` holds a reference to each source while it ticks, and `deactivate` runs inside that tick. Destruction is deferred to the destruction task thread and also calls `obs_context_wait`. Single-threaded paths also reach `idleSignal`:
- With RTWQ, `Stop()` sets `receiveSignal`, which wakes the waiting sample work item.
- `OnSampleReady` and `OnStartCapture` both call `SetEvent(idleSignal)` once `stopSignal` is set.
- A pending reconnect waits on `stopSignal` and then calls `Start()`, which reaches `OnStartCapture`.

There is no reproduction on current code and no stack beyond screenshots from a beta, so the deadlock could not be confirmed.

Evidence:
- `plugins/win-wasapi/win-wasapi.cpp:441-471`: `Stop()` waits on `idleSignal` when `reconnectThread` is valid.
- `plugins/win-wasapi/win-wasapi.cpp:598-605`: `Deactivate()`.
- `plugins/win-wasapi/win-wasapi.cpp:1100-1128`: the reconnect thread waits on `stopSignal` and then calls `Start()`.
- `plugins/win-wasapi/win-wasapi.cpp:1267-1273, 1338-1343`: `idleSignal` is set when stopping.
- `libobs/obs-video.c:63-86`: tick holds a source reference across `obs_source_video_tick`.
- `libobs/obs-source.c:798-812`: destroy is deferred and runs `obs_context_wait`.

Related: none.

### [#11568](https://github.com/obsproject/obs-studio/pull/11568) — game-capture: reset hook_stop signal
**Verdict: IMPLEMENT (cherry-pick-pr)**

The defect is confirmed. `EVENT_CAPTURE_STOP` is a named auto-reset event (`create_event` uses `CreateEventW(NULL, false, false, ...)`).
- OBS sets it in `stop_capture()`.
- Only the hook clears it, inside `capture_should_stop()`, and only while the hooked game is presenting frames.
- If the game never renders, the event stays signalled.

On the next capture attempt, `init_events()` reopens the same named event. `game_capture_tick` then reads it as "hook stop signal received" and calls `stop_capture()`, which sets the event again. Capture loops and never starts. Calling `ResetEvent` right after opening clears the stale state. The handle is opened with `EVENT_MODIFY_STATE`, so the call is allowed.

Evidence:
- `shared/obs-hook-config/hook-helpers.h:7,10-13`: `GC_EVENT_FLAGS` includes `EVENT_MODIFY_STATE`, and the event is auto-reset.
- `plugins/win-capture/game-capture.c:311-318`: `stop_capture` calls `SetEvent(hook_stop)`.
- `plugins/win-capture/game-capture.c:1222-1228`: `init_events` opens `hook_stop`.
- `plugins/win-capture/game-capture.c:1739-1742`: tick treats a signalled `hook_stop` as a stop request.
- `plugins/win-capture/graphics-hook/graphics-hook.h:193-220`: the hook checks the stop event only while capture is active.
- The PR diff is one line (`ResetEvent(gc->hook_stop);`) and applies cleanly.

Slice: cherry-pick commit `5616050f2`. It changes 1 line in `plugins/win-capture/game-capture.c`.
Test: build `win-capture` with MSVC, then capture a non-rendering window (for example a paused or minimised D3D app), switch modes, and recapture. If no such app is available, mark the runtime check UNTESTED.

Related: none.

### [#11632](https://github.com/obsproject/obs-studio/issues/11632) — Groups will "drift" when their positional alignment isn't top left and one of their items is moved
**Verdict: IMPLEMENT (new-change)**

The root cause is in `resize_group()`. For non-left or non-top alignment it computes the group's new position from the float extent: `maxv`, or `(maxv - minv) * 0.5 + minv`. That point is then mapped through the old `draw_transform`. The origin inside `draw_transform` is built differently by `update_item_transform()` and `add_alignment()`:
- the width is the ceiled `scene->cx` (`ceilf(scale.x)` in `resize_scene_base`),
- it is truncated to `uint32_t` after scaling,
- and for centre alignment it uses integer `cx / 2`.

When item positions are fractional, which is the normal case while dragging, the float anchor and the integer origin differ by up to about one pixel. Each resize therefore moves the group by that difference, and every drag event triggers a resize, so the group drifts. Top-left alignment uses `minv` with origin 0, so it is not affected, which matches the report.

Evidence:
- `libobs/obs-scene.c:3484-3520`: `resize_group` computes `new_pos` from float `minv` and `maxv`.
- `libobs/obs-scene.c:3468-3471`: `scene->cx = ceilf(scale.x)`.
- `libobs/obs-scene.c:626-655`: the origin uses integer `cx` (`(uint32_t)(cx*scale)`) through `add_alignment`.
- `libobs/obs-scene.c:325-336`: `add_alignment` uses `cx / 2` integer division.

Slice (libobs, about 20 lines):
- In `resize_group`, compute the anchor in group-local units so that it matches the origin that `update_item_transform` will build with the new size. Use `minv` plus the alignment offset taken from `add_alignment(&o, group->align, (int)(uint32_t)(ceilf(scale.x) * sx), (int)(uint32_t)(ceilf(scale.y) * sy))`, divided by the group's output scale `sx`/`sy` (guard against zero).
- Then transform that anchor through `draw_transform` as the code does today.
- Leave the top-left path numerically unchanged.

Test: build libobs and the frontend. Create two colour sources in a group, set the group alignment to centre or bottom-right, and drag a child repeatedly; the group should not move. A cmocka test is possible if a headless scene context can be made; otherwise the runtime check is manual or UNTESTED.

Related: none.

### [#11678](https://github.com/obsproject/obs-studio/issues/11678) — "Hide OBS windows from screen capture" does not hide floating docks consistently
**Verdict: CANNOT_VERIFY**

Display affinity is applied on `QEvent::Show` to any top-level `Dialog`, `Window` or `Tool` window, and only when the current affinity differs. A floating `QDockWidget` is a `Qt::Tool` window, so it is covered. The black box is the classic `WDA_MONITOR`-like rendering. It most likely comes from the DWM/HWND lifecycle when a dock's native window is re-parented (dock, then float again) or restored before it is shown. The logic does not show which case causes it. A repro with window-handle inspection would be needed, and the result may depend on the Windows build.

Evidence:
- `frontend/OBSApp.cpp:1518-1552`: the global `notify` hook applies affinity on Show for Dialog, Window and Tool.
- `frontend/widgets/OBSBasic.cpp:2018-2048`: `SetDisplayAffinity` skips when the current affinity is already `EXCLUDEFROMCAPTURE`.
- `frontend/utility/platform-windows.cpp:217-235`: version gate (build 19041 or later).

Related: #11961.

### [#11704](https://github.com/obsproject/obs-studio/issues/11704) — Audio speed and pitch increase when switching virtual desktops with OBS audio control
**Verdict: CANNOT_VERIFY**

This affects browser-source audio that OBS controls, which is CEF audio routed by the obs-browser submodule. Switching virtual desktops probably changes CEF or Chromium throttling or timing on the hidden desktop. Nothing in the report or the core audio path points to a specific defect, and there is no repro data beyond a video. It may be Chromium behaviour.

Evidence: obs-browser is an external submodule (`plugins/obs-browser`); there is no core code path to cite.

Related: none.

### [#11722](https://github.com/obsproject/obs-studio/issues/11722) — Drag to resize doesn't work for game capture sources
**Verdict: CANNOT_VERIFY**

Preview resizing is generic and has nothing specific to game capture. The report gives no information on the capture state (hooked or not, source size), the bounds settings, or the scaling mode, and it has no follow-up. Without a repro the cause cannot be found. One candidate is a zero-size unhooked source, which makes the stretch handles no-ops.

Evidence: no game-capture-specific transform code; the transform logic is shared in `libobs/obs-scene.c:600-672`.

Related: none.

### [#11928](https://github.com/obsproject/obs-studio/issues/11928) — Diacritics do not work on Windows when OBS is open
**Verdict: OUT_OF_SCOPE**

OBS's own hotkey handling on Windows polls `GetAsyncKeyState`. It installs no keyboard hook and never calls `ToUnicode`, which is the usual way a program breaks dead keys. The reporter runs an "Input" plugin (input-overlay), which uses a global keyboard hook, and also Logitech and SteelSeries software. The behaviour is almost certainly caused by that third-party plugin.

Evidence:
- `libobs/obs-windows.c:976`: hotkey state is read with `GetAsyncKeyState`.
- `libobs/obs-windows.c:1022-1040`: key names use `MapVirtualKey` and `GetKeyNameTextW` only.
- No `SetWindowsHookEx` or `ToUnicode` anywhere in `libobs` or `frontend`.

Related: #11973 (keyboard layout, different symptom).

### [#11961](https://github.com/obsproject/obs-studio/issues/11961) — OBS ignores main interface but captures certain sub-windows
**Verdict: CANNOT_VERIFY**

The report gives the OBS version only as "Other", gives no detail on which windows leak, and does not say whether "Hide OBS windows from screen capture" is even enabled. In the current code every shown top-level Dialog, Window or Tool window gets `WDA_EXCLUDEFROMCAPTURE` when the setting is on. Display Capture also has its own separate cursor and window exclusion. There is not enough information to find a gap; a window type outside Dialog, Window and Tool, or plugin windows, are guesses.

Evidence: `frontend/OBSApp.cpp:1543-1550`, `frontend/widgets/OBSBasic.cpp:2018-2048`.

Related: #11678.

### [#11970](https://github.com/obsproject/obs-studio/issues/11970) — DShow filter: no size box in preview, no image, but driver accepted
**Verdict: OUT_OF_SCOPE**

This is a third-party camera vendor asking for help with their own DirectShow filter driver. It is a developer support question about a proprietary driver, not an OBS defect, and there are no logs or steps.

Evidence: none applicable. The report concerns an external `.ds` filter.

Related: none.

### [#11973](https://github.com/obsproject/obs-studio/issues/11973) — Shortcut incorrectly saved
**Verdict: CANNOT_VERIFY**

On a French AZERTY keyboard, a hotkey on the `"` key (VK `'3'`) reportedly becomes `'` (VK `'4'`) after a restart. The code path looks consistent:
- Qt gives `nativeVirtualKey()`.
- `obs_key_from_virtual_key` maps it to the first `obs_key_t` with that VK, which for `'3'` is `OBS_KEY_3`.
- The key is saved by name and reloaded through the same table.

No step in that path would map VK `'3'` to VK `'4'`. The steps are empty and the log was not examined, so the defect cannot be confirmed from code.

Evidence:
- `frontend/settings/OBSHotkeyEdit.cpp:54`: `obs_key_from_virtual_key(event->nativeVirtualKey())`.
- `libobs/obs-windows.c:1047-1058`: first-match reverse lookup.
- `libobs/obs-windows.c:476-489, 650-680`: `OBS_KEY_3` maps to `'3'`; `OBS_KEY_0x33` duplicates it at a later index.

Related: #11928.

### [#12000](https://github.com/obsproject/obs-studio/pull/12000) — frontend: Improve HAGS detection for GoLiveApi data
**Verdict: IMPLEMENT (partial-pr)**

The GoLiveApi capability report (Enhanced Broadcasting) currently reads HAGS from the `HwSchMode` registry value. When the value is missing, the code assumes a hard-coded default, which can be wrong. libobs-d3d11 already queries the real state through `D3DKMTQueryAdapterInfo(KMTQAITYPE_WDDM_2_7_CAPS)`. The PR does the same for each adapter in `system_gpu_data()`. The PR is by a maintainer, is small (61 added and 2 removed lines across 2 files), and applies cleanly. The `D3DKMT*` functions come from gdi32, which is a default MSVC link library.

One defect needs fixing. `capabilities.gpu->at(ovi.adapter)` can throw `std::out_of_range`, because `system_gpu_data()` skips adapters (the Microsoft Basic Render Driver, and adapters whose `GetDesc` fails). That makes the list index differ from the DXGI adapter index.

Evidence:
- `frontend/utility/system-info-windows.cpp:14-50`: adapter enumeration skips some adapters.
- `libobs-d3d11/d3d11-subsystem.cpp:470, 539-542`: the existing HAGS query that the PR mirrors.
- PR commits `5fc1b5416`, `a0c79ac80`, `53a8c0cf3`.

Slice: cherry-pick the 3 commits, then add a follow-up that guards the lookup (`if (ovi.adapter < capabilities.gpu->size())`). Ideally match by LUID or by the enumeration index stored alongside each entry. About 65 lines.
Test: MSVC build of the `obs-studio` frontend target. Log the produced GoLiveApi JSON on this machine, or inspect it in a debugger, and check that `gpu[].hags` is filled.

Related: none.

### [#12050](https://github.com/obsproject/obs-studio/issues/12050) — Global audio device settings reset after Windows update
**Verdict: DEFER_LARGE**

The global audio devices are stored only by WASAPI endpoint ID (`device_id`). Windows updates and driver reinstalls can give the same physical device a new endpoint ID. The saved ID then no longer resolves, and the UI shows "[Device not connected or not available]". Fixing this needs a fallback matching strategy, such as persisting the friendly name and re-binding by name when the ID is missing. That fallback needs design decisions about ambiguity (several devices with the same name) and changes to the settings schema, so it is not a minimal bug fix.

Evidence:
- `plugins/win-wasapi/win-wasapi.cpp:27, 491`: only `device_id` is persisted and used.
- `frontend/widgets/OBSBasic_SceneItems.cpp:108`: global devices are reset by ID.

Related: none.

### [#12088](https://github.com/obsproject/obs-studio/issues/12088) — Window capture: same exe and same window title select the same window
**Verdict: DEFER_LARGE**

Window identity is encoded as `title:class:exe`. Two windows of the same program with the same title and class produce the same string, so whichever one is found first is captured. Telling them apart needs a new persistent discriminator; HWNDs do not survive restarts. That is a design change to the window-matching format shared by window capture, game capture and audio capture.

Evidence:
- `libobs/util/windows/window-helpers.c:233-278`: `add_window` builds the `title:class:exe` key.

Related: none.

### [#12113](https://github.com/obsproject/obs-studio/issues/12113) — Failed to recreate D3D11: Failed to create swap RTV (80070057)
**Verdict: CANNOT_VERIFY**

The crash happens during D3D11 device-loss recovery in a fullscreen projector and returns `E_INVALIDARG`. It looks GPU- or driver-specific and random. The crash log gives no actionable root cause in our code.

Evidence:
- `libobs-d3d11/d3d11-subsystem.cpp:140`: the `"Failed to create swap RTV"` throw site.

Related: none.

### [#12162](https://github.com/obsproject/obs-studio/issues/12162) — OBS hangs on exit when the update check TLS handshake stalls
**Verdict: IMPLEMENT (new-change)**

The root cause is confirmed. The update and "What's New" checks call `FetchAndVerifyFile` and then `GetRemoteFile` without a timeout. `GetRemoteFile` sets `CURLOPT_TIMEOUT` only when `timeoutSec` is non-zero, and it never sets `CURLOPT_CONNECTTIMEOUT`. libcurl's default connect timeout, which covers the TLS handshake, is 300 s. That matches the "exactly 5 minutes" hang in the report. On shutdown, `OBSBasic` calls `wait()` on `whatsNewInitThread`, `updateCheckThread` and `introCheckThread`, so exit blocks until curl gives up.

Smallest slice: set `CURLOPT_CONNECTTIMEOUT` in `GetRemoteFile` (for example 15–30 s). This bounds the connect and handshake phase for every caller without breaking long transfers such as the updater.exe download, which a total `CURLOPT_TIMEOUT` would risk. Cancelling requests on exit (an abort flag with `CURLOPT_XFERINFOFUNCTION`) would remove the hang completely, but it is a larger change and is left out.

Evidence:
- `frontend/utility/RemoteTextThread.cpp:126-200`: `GetRemoteFile` has no connect timeout, and its total timeout is applied only when non-zero.
- `frontend/utility/RemoteTextThread.hpp:60-63`: `timeoutSec = 0` default.
- `frontend/utility/WhatsNewInfoThread.cpp:206, 246`: `FetchAndVerifyFile` passes no timeout.
- `frontend/utility/AutoUpdateThread.cpp:195, 217, 253`: update checks use `FetchAndVerifyFile`.
- `frontend/widgets/OBSBasic.cpp:1852-1860`: shutdown waits on these threads.

Slice: 1–3 lines in `frontend/utility/RemoteTextThread.cpp`, adding `curl_easy_setopt(curl.get(), CURLOPT_CONNECTTIMEOUT, 30L);`, and optionally the same in the `RemoteTextThread::run` path at line 86.
Test: MSVC build of the frontend. To test at runtime, point a hosts entry for the update host at a local TCP listener that accepts the connection and never answers the TLS ClientHello, then confirm exit takes 30 s or less. If that is not practical, mark it UNTESTED.

Related: none.

### [#12244](https://github.com/obsproject/obs-studio/issues/12244) — [Windows] Display Capture unable to select between identical monitors
**Verdict: IMPLEMENT (through the #12248 slice)**

Display Capture builds the monitor ID by calling `EnumDisplayDevicesA(mi.szDevice, 0, ...)`, which looks only at child index 0 of each adapter output. It never checks `DISPLAY_DEVICE_ACTIVE`. Windows can keep stale or inactive monitor children at index 0 (see the discussion in upstream #5502 and #8181). Two outputs can then report the wrong or the same interface ID, so the dropdown values collide and selecting either one captures the first match. The fix is PR #12248, adjusted as described below.

Evidence:
- `plugins/win-capture/duplicator-monitor-capture.c:185-211`: `enum_monitor` matches only index 0.
- `plugins/win-capture/duplicator-monitor-capture.c:747-755`: `enum_monitor_props` adds the index-0 `DeviceID`.

Related: #12248.

### [#12248](https://github.com/obsproject/obs-studio/pull/12248) — win-capture: Fix display capture for identical monitors
**Verdict: IMPLEMENT (partial-pr)**

The current PR head, after a rewrite that dropped the original DeviceName approach, loops over every monitor child of each output and uses only `DISPLAY_DEVICE_ACTIVE` ones, keeping the `szDevice` fallback. It is 25 added and 11 removed lines in one file and applies cleanly.

Maintainer feedback (RytoEX, read with WebFetch) asked whether this works around bad Windows API data. There is no approving or blocking review. Since this fork will never be upstreamed, the active-flag filter is a defensible correctness improvement: it never picks an inactive monitor's ID.

Two small issues to fix:
1. In `enum_monitor`, the loop keeps going after a match, so a later active, non-matching child resets `match` to false and enumeration continues. It should `break` on match.
2. In `enum_monitor_props`, more than one active child, as in clone mode, would add duplicate list entries. It should add only the first active child.

Evidence:
- `git diff master...refs/upstream-pr/12248`, commits `7bfb7205e` and `10144db19`.
- `plugins/win-capture/duplicator-monitor-capture.c:198-208, 747-755`.

Slice: cherry-pick both commits (keeping authorship), then add a follow-up commit that breaks on the first match and on the first active child. About 40 lines in `plugins/win-capture/duplicator-monitor-capture.c`.
Test: MSVC build of `win-capture`. Check that the monitor list still fills and capture works on this machine's monitors. The identical-monitor case is UNTESTED (no hardware).

Related: #12244.

### [#12483](https://github.com/obsproject/obs-studio/pull/12483) — obs-text: Fix changing fonts for Qt 6.7+
**Verdict: IMPLEMENT (partial-pr)**

Since Qt 6.7, the Windows font dialog uses DirectWrite. Variable-font weights (Light, Medium, SemiBold and so on) now appear as styles of a single family instead of separate GDI families. The GDI+ text source builds its `LOGFONT` only from the face name and the bold flag, and it ignores style changes in its change detection. Picking a different weight therefore has no effect. The maintainer's PR (RytoEX) does three things:
- stores `weight` in the font object from properties-view,
- passes it to `lfWeight`,
- includes style and weight in change detection.

It is 13 lines across 2 files and applies cleanly.

One regression to fix. Settings saved before the change have no `weight` key, so `weight == 0` gives `FW_DONTCARE` and silently drops bold for existing bold text sources. Also, in `MakeQFont`, `QFont::setWeight(0)` is outside Qt 6's allowed 1–1000 range, so Qt warns and ignores it.

Evidence:
- `plugins/obs-text/gdiplus/obs-text.cpp:318`: `lf.lfWeight = bold ? FW_BOLD : FW_DONTCARE;`.
- `plugins/obs-text/gdiplus/obs-text.cpp:753-779`: change detection ignores style and weight.
- `shared/properties-view/properties-view.cpp:846-856`: `MakeQFont` restores only family and style.
- PR commits `9c0bd9291`, `cfb54c288`, `91cb6bebd`.

Slice: cherry-pick the 3 commits, then add a follow-up of about 4 lines:
- in `UpdateFont`, use `lf.lfWeight = weight ? weight : (bold ? FW_BOLD : FW_DONTCARE);`,
- in `MakeQFont`, call `setWeight` only when `weight > 0`.

Test: MSVC build of `obs-text` and the frontend. On this Windows box, choose a variable font (for example Bahnschrift or Segoe UI Variable) at different weights, and check that an older scene with bold text still renders bold.

Related: upstream #12393 (the issue the PR fixes; not in this batch).
