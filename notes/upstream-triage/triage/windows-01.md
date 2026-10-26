# Upstream triage — batch windows-01

- Batch: windows-01 (area hint: windows)
- Items: 3119, 4831, 4878, 4929, 5397, 5405, 5478, 5502, 5516, 5624, 5735, 5841, 6525, 6810, 6819, 7288, 7708, 8075, 8644, 8706 (all issues, no PRs)
- Date: 2026-10-26
- Base commit: 72e866557 (master)
- Method: issue bodies from `notes/upstream-triage/data/all.json`, current code read on master. No comment threads were fetched (WebFetch not used for this batch).

Summary:

| # | Verdict |
|---|---|
| 3119 | DEFER_LARGE |
| 4831 | ALREADY_ADDRESSED |
| 4878 | CANNOT_VERIFY |
| 4929 | IMPLEMENT |
| 5397 | DEFER_LARGE |
| 5405 | IMPLEMENT |
| 5478 | DEFER_LARGE |
| 5502 | ALREADY_ADDRESSED |
| 5516 | CANNOT_VERIFY |
| 5624 | CANNOT_VERIFY |
| 5735 | CANNOT_VERIFY |
| 5841 | CANNOT_VERIFY |
| 6525 | CANNOT_VERIFY |
| 6810 | ALREADY_ADDRESSED |
| 6819 | OUT_OF_SCOPE |
| 7288 | IMPLEMENT |
| 7708 | CANNOT_VERIFY |
| 8075 | OUT_OF_SCOPE |
| 8644 | CANNOT_VERIFY |
| 8706 | IMPLEMENT |

---

### [#3119](https://github.com/obsproject/obs-studio/issues/3119) — When a web interface is shown, and I have to alt-tab out, focus is not restored when alt-tabbing back in.

**Verdict: DEFER_LARGE**

A blind NVDA user reports that after alt-tabbing out of the OAuth login dialog (Twitch etc., a CEF browser) and back, keyboard focus does not go back to the web content, and the screen reader can't find the page. This is a real accessibility bug (labelled confirmed). The browser widget is in the `obs-browser` submodule (`plugins/obs-browser/panel/browser-panel.cpp`), which is a separate upstream repo. A fix means sending focus back to the CEF browser host when the window is activated again, and testing it with a screen reader. Changes to the submodule can't be committed cleanly in this fork without forking obs-browser too, and we can't test accessibility here.

Evidence:
- `plugins/obs-browser/panel/browser-panel.cpp:181` — the panel widget only sets `Qt::ClickFocus`. Nothing restores focus to the CEF window on activation.
- `.gitmodules` — `plugins/obs-browser` is a separate submodule.
- `frontend/oauth/*` — the OAuth dialogs host the browser panel and have no focus handling of their own.

Related: none.

### [#4831](https://github.com/obsproject/obs-studio/issues/4831) — [Improvement] Preview of property window will flicker once while switching monitor

**Verdict: ALREADY_ADDRESSED**

The reporter traced the flicker to `obs_source_update()` running twice per change. That came from the then-new undo/redo update callback plus the visual update callback. On current master the Properties dialog passes `nullptr` as the update callback, with the comment "No special handling required for undo/redo". Only `obs_source_update` runs, as the visual-update callback, once per control change. The monitor list property has no modified callback, so it doesn't trigger an extra refresh-and-update cycle either.

Evidence:
- `frontend/dialogs/OBSBasicProperties.cpp:72-74` — `OBSPropertiesView(..., (PropertiesUpdateCallback) nullptr, (PropertiesVisualUpdateCb)obs_source_update)`.
- `shared/properties-view/properties-view.cpp:2104-2129` — the deferred `callback` is skipped when null; `visUpdateCb` runs once per `ControlChanged`.
- `plugins/win-capture/duplicator-monitor-capture.c:810-811` — `monitor_id` list has no `obs_property_set_modified_callback`.

Related: none.

### [#4878](https://github.com/obsproject/obs-studio/issues/4878) — Window capture bug #4877 still happens in 27.0.1

**Verdict: CANNOT_VERIFY**

In Studio Mode, a window capture appears about 1 s after switching to a scene that contains it. The current code is very different from 27.0.1. For BitBlt, `wc_hide` clears `last_rect`, and the next resize check (`RESIZE_CHECK_TIME` = 0.2 s) restarts capture, so a 1 s delay can't come from this path any more. For WGC, the capture is freed on hide and rebuilt on the next tick after show. The remaining delay is how long WGC takes to deliver its first frame, which the OS controls. Freeing on hide is intentional (it saves resources). We can't point to a defect without a repro on current builds.

Evidence:
- `plugins/win-capture/window-capture.c:36-37` — `WC_CHECK_TIMER 1.0f`, `RESIZE_CHECK_TIME 0.2f`.
- `plugins/win-capture/window-capture.c:569-588` — `wc_hide` frees `capture_winrt` and resets `last_rect`.
- `plugins/win-capture/window-capture.c:688-700` — resize/reset check.
- `plugins/win-capture/window-capture.c:739-` — WGC re-init on tick when `capture_winrt == NULL`.

Related: #5516 (also show/hide of WGC window capture in studio mode).

### [#4929](https://github.com/obsproject/obs-studio/issues/4929) — OBS unable to send frames while SetSyncSource(NULL) is not called before Running the graph.

**Verdict: IMPLEMENT**

A DirectShow graph (OBS Virtual Camera → SampleGrabber → NullRenderer) gets only one frame from OBS unless the app removes the graph reference clock. Root cause, found in code: the virtual camera stamps samples with absolute reference-clock time (`filter_time = GetTime()`, read from the graph clock when the worker thread starts in `Pause()`, then `+= interval`). DirectShow sample times must be stream time, i.e. relative to the `tStart` passed to `IBaseFilter::Run`. `VCamFilter::Run` and libdshowcapture's `OutputFilter::Run` both ignore `tStart`. A clock-scheduled renderer therefore sees a timestamp far in the future and waits. With `SetSyncSource(NULL)` there is no scheduling, which is why that workaround works. Consumers that ignore timestamps (most apps) are unaffected.

Evidence:
- `plugins/win-dshow/virtualcam-module/virtualcam-filter.cpp:148-158` — `GetTime()` returns `clock->GetTime()`, which is absolute reference time.
- `plugins/win-dshow/virtualcam-module/virtualcam-filter.cpp:169-201` — `filter_time = GetTime()` at thread start, then `Frame(filter_time)` and `filter_time += obs_interval`.
- `plugins/win-dshow/virtualcam-module/virtualcam-filter.cpp:306` — `UnlockSampleData(ts, ts + obs_interval)`.
- `deps/libdshowcapture/src/source/output-filter.cpp:589-594` — `SetTime(&startTime, &endTime)` is called with those values unchanged.
- `deps/libdshowcapture/src/source/output-filter.cpp:771-778` — `OutputFilter::Run` has `DSHOW_UNUSED(tStart)`.

Slice plan (new-change, obs-studio only, no submodule change):
1. Add `volatile long long run_start = 0;` (or `std::atomic<int64_t>`) to `VCamFilter` (`virtualcam-filter.hpp`).
2. In `VCamFilter::Run(REFERENCE_TIME tStart)`, store `tStart` before calling `OutputFilter::Run`.
3. In `VCamFilter::Frame` (or right before `UnlockSampleData`), when a reference clock is present convert to stream time: `int64_t st = (int64_t)ts - run_start;` and pass `st`, `st + obs_interval`. When there's no clock (`clock` null, `tStart` == 0), behaviour stays the same.
4. Reset `run_start` on `Stop()`.
About 15–25 lines.

Test plan: build `win-dshow`/`obs-virtualcam-module` with MSVC on this box. A runtime check needs a DirectShow graph with the default clock and a renderer that schedules by timestamp (GraphStudioNext, or a small test harness). If that isn't done, record **UNTESTED (runtime)** in the commit. Also check that a timestamp-ignoring consumer (camera app or browser) still gets video.

Related: none.

### [#5397](https://github.com/obsproject/obs-studio/issues/5397) — Game Capture unable to capture child windows

**Verdict: DEFER_LARGE**

Amiga Forever / C64 Forever render into child windows, and OBS's window pickers only list top-level windows, so the capture shows a grey frame. Supporting child HWNDs means changing the window enumeration and the picker UI, and BitBlt/WGC behave differently with child windows (WGC can't capture child HWNDs directly). It needs a design decision on how child windows are listed and matched. It's not a small fix, and it serves only a niche set of apps.

Evidence:
- `plugins/win-capture/window-capture.c:631-634` — WGC uses `ms_find_window_top_level`, BitBlt uses `ms_find_window`. Both only search top-level windows.

Related: none.

### [#5405](https://github.com/obsproject/obs-studio/issues/5405) — Substract Windows taskbar height when calculating dimensions for pop-up windows

**Verdict: IMPLEMENT**

On small or high-DPI screens (for example 1366x768 at 125%, about 1093x614 logical), the Filters dialog opens at its `.ui` default height of 726 px. That is taller than the available screen area, so the taskbar covers the bottom buttons. The Settings dialog already fixes the same problem in `showEvent` by clamping the height to `screen()->availableGeometry()` minus the title bar. The Filters dialog has no such clamp.

Evidence:
- `frontend/forms/OBSBasicFilters.ui:9-10` — default size is 861x726.
- `frontend/dialogs/OBSBasicFilters.hpp:123-125` — no `showEvent` override.
- `frontend/settings/OBSBasicSettings.cpp:3927-3938` — existing pattern: clamp to the available height on show.

Slice plan (new-change):
- Add `void showEvent(QShowEvent *event) override;` to `OBSBasicFilters` and implement it the same way as `OBSBasicSettings::showEvent`: clamp the height to `availableGeometry().height() - PM_TitleBarHeight`, and also clamp the width to the available width. Optionally move the window so its frame top is inside the available geometry. About 20 lines in `frontend/dialogs/OBSBasicFilters.{hpp,cpp}`.

Test plan: build the `obs-studio` frontend with MSVC. Manual check: set the display to a low resolution or 125%+ scaling (or use a small virtual display), open Filters, and confirm the bottom buttons are visible. Note it as UNTESTED if this can't be done here.

Related: none.

### [#5478](https://github.com/obsproject/obs-studio/issues/5478) — Copy transform from an item within a group does not work

**Verdict: DEFER_LARGE**

Copy Transform reads `obs_sceneitem_get_info2` and crop from the selected item. For an item inside a group, these values are relative to the group, so pasting them onto a top-level item gives the wrong result. Paste also enumerates only the top-level items of the scene, so selected items inside groups are skipped. A correct fix converts between group-relative and absolute transforms in both directions. libobs only has that logic as static helpers (`get_ungrouped_transform`, `apply_group_transform`), so it would need new public libobs API. It also needs a decision on whether copied transforms are absolute or relative. That makes it more than a small slice.

Evidence:
- `frontend/widgets/OBSBasic_Clipboard.cpp:28-37` — copy takes the raw `info2` and crop.
- `frontend/widgets/OBSBasic_Clipboard.cpp:39-63` — paste uses `obs_scene_enum_items`, which only covers the top level.
- `libobs/obs-scene.c:3318`, `libobs/obs-scene.c:3372` — the group transform conversion helpers are `static`.

Related: none.

### [#5502](https://github.com/obsproject/obs-studio/issues/5502) — Display capture randomly captures different display after a display port connected screen is powered off and back on

**Verdict: ALREADY_ADDRESSED**

In 27.1.3, display capture stored a monitor index, which can change when DisplayPort monitors power-cycle. Current code stores `monitor_id`, the device interface path from `EnumDisplayDevicesA(..., EDD_GET_DEVICE_INTERFACE_NAME)`, and matches monitors by that path. The fallback matching only runs when no exact match exists. Re-enumeration order no longer changes which monitor is selected.

Evidence:
- `plugins/win-capture/duplicator-monitor-capture.c:184-200` — `enum_monitor` compares `device->DeviceID`.
- `plugins/win-capture/duplicator-monitor-capture.c:282-292` — `find_monitor` does an exact match first, then falls back.
- `plugins/win-capture/duplicator-monitor-capture.c:298-303,379` — the setting is the string `monitor_id`.

Related: none.

### [#5516](https://github.com/obsproject/obs-studio/issues/5516) — Window and display captures disappear after undo/redo.

**Verdict: CANNOT_VERIFY**

In Studio Mode, undoing a transform in a non-program scene leaves a WGC window capture black with a 0x0 size until the scene is re-selected. Undo calls `SetCurrentScene(source, true)` and then reloads transform states. That can hide and show the scene's sources, which frees and rebuilds the WGC capture (`wc_hide`). The tick should then rebuild it. Nothing in the current code would leave it permanently at 0x0, and the report is from 27.1.3, before several WGC rewrites. It needs a repro on current builds.

Evidence:
- `frontend/widgets/OBSBasic_SceneItems.cpp:1039-1046` — `undo_redo` calls `SetCurrentScene(..., true)`.
- `plugins/win-capture/window-capture.c:569-588` — `wc_hide` frees the WGC capture.

Related: #4878.

### [#5624](https://github.com/obsproject/obs-studio/issues/5624) — Full screen projector seems to be broken with multiple displays

**Verdict: CANNOT_VERIFY**

On a 5-monitor setup with mixed GPUs and a USB DisplayLink adapter, every fullscreen projector opens on the first display. `SetMonitor` sets the geometry to `QGuiApplication::screens()[monitor]` and calls `showFullScreen()`. That works on ordinary multi-monitor setups. The failure is probably caused by how Qt or Windows handles windows across adapters or mixed DPI. A possible hardening would be to call `windowHandle()->setScreen()` before `setGeometry`, but we can't show it fixes this hardware setup, and it can't be tested here.

Evidence:
- `frontend/widgets/OBSProjector.cpp:125-131` — `SetMonitor`.

Related: none.

### [#5735](https://github.com/obsproject/obs-studio/issues/5735) — Intermittent track matte glitch

**Verdict: CANNOT_VERIFY**

With a track-matte stinger, one or a few frames of the old scene occasionally appear after the transition. This is timing-dependent (more scenes and sources make it more likely). It looks like the matte video's last frame and the transition end don't line up. There's no deterministic defect to point to in `transition-stinger.c` without a repro and frame-level tracing.

Evidence:
- `plugins/obs-transitions/transition-stinger.c:35-113` — track matte state and texrender setup.

Related: none.

### [#5841](https://github.com/obsproject/obs-studio/issues/5841) — OBS Studio>24.0.3 use Game Capture cause Minecraft 1.8.9 crash

**Verdict: CANNOT_VERIFY**

Minecraft 1.8.9 (old LWJGL/OpenGL) crashes when switching to fullscreen while Game Capture is hooked, but only on a hybrid laptop's iGPU-attached internal display. This depends on the hardware and driver, there's no crash stack, and it regressed long ago (after 24.0.3). The GL hook code can't be checked against it without that hardware.

Evidence:
- `plugins/win-capture/graphics-hook/gl-capture.c` — the GL hook path (no specific defect found).

Related: none.

### [#6525](https://github.com/obsproject/obs-studio/issues/6525) — CPU usage in Stats tab inaccurate and consistently underreported.

**Verdict: CANNOT_VERIFY**

OBS reports process CPU time (kernel + user from `GetProcessTimes`) divided by elapsed wall time and logical CPU count. That is the classic time-based metric. On Windows 8+, Task Manager shows "% Processor Utility", which is scaled by CPU frequency (turbo) and is usually higher. Task Manager can also include the obs-browser helper processes. The gap comes from what each tool measures, not from a bug in OBS's calculation. Changing the metric (for example to PDH "% Processor Utility") would be a product decision, not a bug fix.

Evidence:
- `libobs/util/platform-windows.c:295-325` — `os_cpu_usage_info_start/query`.

Related: none.

### [#6810](https://github.com/obsproject/obs-studio/issues/6810) — Starting virtual cam in plugin event - crash in OBSBasic::OnActivate

**Verdict: ALREADY_ADDRESSED**

The crash was a null dereference of `taskBtn` (a QWinTaskbarButton) in `TaskbarOverlaySetStatus` when the virtual camera was started from the first `SCENE_CHANGED` frontend event. That event fires during scene collection load, before taskbar init. The QtWinExtras code has been replaced by direct `ITaskbarList4` COM calls that use a cached `HWND`. If they run before `TaskbarOverlayInit()`, `hwnd` is just null and `SetOverlayIcon` fails without crashing. The first `SCENE_CHANGED` (`OBSBasic.cpp:1012`) still fires before `TaskbarOverlayInit()` (`OBSBasic.cpp:1151`), so the overlay icon may be missing in that case, but it won't crash.

Side note (not this issue's crash): `TaskbarOverlaySetStatus` calls `taskbarIcon->Release()` on an uninitialized pointer if `CoCreateInstance` fails, and leaks `taskbarIcon` when `hicon` is null. That's a possible 3-line hardening if another batch picks it up.

Evidence:
- `frontend/utility/platform-windows.cpp:384-433` — the new COM-based implementation; the bad Release is at ~396, the leak at ~427.
- `frontend/widgets/OBSBasic.cpp:1012`, `frontend/widgets/OBSBasic.cpp:1151` — order of the event and the init call.
- `frontend/widgets/OBSBasic.hpp:706` — the OnActivate call site.

Related: none.

### [#6819](https://github.com/obsproject/obs-studio/issues/6819) — WIN11 Desktop Audio bound to Windows General Audio

**Verdict: OUT_OF_SCOPE**

On Windows 11, WASAPI loopback capture follows the system master volume and mute ("post-fader"); on Windows 10 it didn't. OBS just opens a loopback stream on the render endpoint. What that stream contains (pre- or post-volume) is decided by the OS audio engine, not OBS. The issue is labelled needs/more-info. The supported way to capture audio that isn't affected by volume is per-application capture (`wasapi_process_output`), which already exists.

Evidence:
- `plugins/win-wasapi/win-wasapi.cpp` — loopback uses `AUDCLNT_STREAMFLAGS_LOOPBACK` on the endpoint, with no volume processing in OBS.

Related: none.

### [#7288](https://github.com/obsproject/obs-studio/issues/7288) — Can not use PrtSc as a part of hotkey

**Verdict: IMPLEMENT**

On Windows, Print Screen (`VK_SNAPSHOT`) only produces a key-up message (WM_KEYUP/WM_SYSKEYUP), never a key-down. Qt therefore never sends `keyPressEvent` for `Qt::Key_Print`, and `OBSHotkeyEdit` only listens to key presses. Only the modifier gets recorded, which matches the report ("Ctrl" instead of "Ctrl + PrtSc"). macOS already has a `keyReleaseEvent` workaround for Caps Lock with the same problem. Detecting the hotkey at runtime works, because libobs polls `GetAsyncKeyState`, and `obs_key_to_virtual_key` already maps `OBS_KEY_PRINT` to `VK_SNAPSHOT`.

Evidence:
- `frontend/settings/OBSHotkeyEdit.cpp:30-59` — only `keyPressEvent` records keys.
- `frontend/settings/OBSHotkeyEdit.cpp:71-89` and `frontend/settings/OBSHotkeyEdit.hpp:80-82` — the `keyReleaseEvent` override exists only under `__APPLE__`.
- `libobs/obs-windows.c:378-379` — `OBS_KEY_PRINT` maps to `VK_SNAPSHOT`.
- `libobs/obs-windows.c:976` — runtime detection via `GetAsyncKeyState`.

Slice plan (new-change):
- `OBSHotkeyEdit.hpp`: declare `keyReleaseEvent` for `__APPLE__ || _WIN32`.
- `OBSHotkeyEdit.cpp`: under `_WIN32`, implement `keyReleaseEvent`. If not autorepeat and `event->key() == Qt::Key_Print`, build `new_key.key = obs_key_from_virtual_key(VK_SNAPSHOT)` (or `event->nativeVirtualKey()`) and `modifiers = TranslateQtKeyboardEventModifiers(event->modifiers())`, then call `HandleNewKey`. Otherwise call the base class. Keep the Apple branch as is. About 20 lines.

Test plan: MSVC build of the frontend, then manually set Ctrl+PrtSc as a hotkey in Settings > Hotkeys on this Windows box and check that it triggers. On Windows 11 the "Use Print screen key to open Snipping Tool" setting may swallow the key; record that if seen.

Related: none.

### [#7708](https://github.com/obsproject/obs-studio/issues/7708) — [Windows] Future drivers will not continue to support Vulkan 1.0 apps without VK_KHR_get_physical_device_properties2

**Verdict: CANNOT_VERIFY**

The Vulkan capture layer raises the app's `apiVersion` from 1.0 to 1.1 (a commented HACK) so it can use 1.1 entry points such as `vkGetPhysicalDeviceImageFormatProperties2`. The linked Vulkan-Loader issue says newer loaders/drivers won't honour a layer-side bump. The robust fix is to enable `VK_KHR_get_physical_device_properties2` (and the external-memory capabilities extension) and use the KHR entry points for 1.0 apps. The hack is clearly in the code. But whether it actually breaks depends on loader and driver versions we can't reproduce here. The fix is in the hooked instance-creation path, where a regression crashes games, so it can't be validated without a Vulkan 1.0 test app and an affected driver.

Evidence:
- `plugins/win-capture/graphics-hook/vulkan-capture.c:1252-1271` — apiVersion bump hack.
- `plugins/win-capture/graphics-hook/vulkan-capture.c:1321,1370` — use of `GetPhysicalDeviceImageFormatProperties2`.

Related: none.

### [#8075](https://github.com/obsproject/obs-studio/issues/8075) — uninstall.exe is unsigned

**Verdict: OUT_OF_SCOPE**

The Windows installer and uninstaller (NSIS) and code signing belong to upstream's release infrastructure, not this source tree. The repo has no NSIS script or uninstaller build step, and this private fork has no code-signing identity. Nothing actionable here.

Evidence:
- Searching the repo for `WriteUninstaller` / `uninstall.exe` in `.nsi`, `.cmake`, CI YAML and PS1 files finds nothing.

Related: none.

### [#8644](https://github.com/obsproject/obs-studio/issues/8644) — after using "power saving" from windows yuy2 not more there and useable

**Verdict: CANNOT_VERIFY**

After Windows sleep, the YUY2 format disappears from a capture device's format list until reboot. The formats OBS shows come from the device driver's enumeration (libdshowcapture). Losing a format after resume points to a driver or device problem. The report gives no device, no log (only forum links) and no repro beyond "sleep", so there's no OBS code to point to.

Evidence:
- `plugins/win-dshow/win-dshow.cpp` — formats are listed from the device caps that libdshowcapture returns.

Related: none.

### [#8706](https://github.com/obsproject/obs-studio/issues/8706) — Incorrect capture area size when capturing a system DPI aware process with a different system DPI than the OBS process

**Verdict: IMPLEMENT**

BitBlt window capture sets its thread's DPI awareness to the target window's context so that `GetClientRect` returns the coordinates the target sees. If the target is system-DPI-aware with a different system DPI than OBS (possible with "fix scaling for apps"), `SetThreadDpiAwarenessContext` fails and returns NULL. The failure isn't handled, so `GetClientRect` runs in OBS's own context and the capture rectangle has the wrong size. Defect in code: the return value of the set call is only used to decide whether to restore, and there is no fallback.

Evidence:
- `plugins/win-capture/window-capture.c:681-687` — `previous = set_thread_dpi_awareness_context(context)` with no failure handling, then `GetClientRect`.
- `plugins/win-capture/window-capture.c:736-737` — restore only if `previous` is non-null.
- `plugins/win-capture/window-capture.c:318-331` — the dynamically loaded DPI functions; `GetDpiForWindow` would be loaded the same way.

Slice plan (new-change, ~30–40 lines in `window-capture.c`):
1. Also load `GetDpiForWindow` (user32, Win10 1607+) next to the existing pointers.
2. In the BitBlt branch, if `previous == NULL` after the set call (failure), switch the thread to `DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2` (remember the returned previous so it can be restored). Get the physical client rect. Scale width and height to the target's logical size with `MulDiv(v, GetDpiForWindow(wc->window), monitor_dpi)`, where `monitor_dpi` is `GetDpiForWindow` evaluated in the per-monitor context (or `GetDpiForMonitor` via shcore, loaded dynamically). Use the scaled rect for the resize check and `dc_capture_init`.
3. Keep the existing path when the set call succeeds. The reporter warns about possible 1-pixel rounding differences; accept them in this fallback.

Test plan: MSVC build of `win-capture`. Runtime repro on this box: start a system-DPI-aware app (for example an older MFC or WinForms app), change the primary display scale with "fix scaling for apps" enabled, start OBS, and capture it with BitBlt. Mark **UNTESTED (runtime)** if the repro can't be set up.

Related: none.
