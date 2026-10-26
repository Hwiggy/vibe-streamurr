# Triage batch frontend-ui-05

- Batch: frontend-ui-05 (area hint: frontend-ui)
- Items: 13452, 13494, 13500, 13508, 13520, 13534, 13546, 13552, 13736, 13766, 13829, 13895, 13909, 13911, 13920, 13954, 14007, 14045, 14046, 14053, 14055
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: I read the item bodies from `notes/upstream-triage/data/all.json`, read the PR heads from `refs/upstream-pr/N`, and looked up the code on master. Local git is 2.33, which has no `merge-tree --write-tree`. To check whether each PR applies, I ran `git apply --cached --check` against a temporary index (`GIT_INDEX_FILE`) in the scratchpad. I checked once without `-3`, then with `-3`, so the shared index was never touched. I used one WebFetch, on issue #13494.

PR apply results: 13508, 13520, 13546, 13766, 13954, 14007, 14045, 14046, 14053 and 14055 apply cleanly. 13500 and 13911 do not apply cleanly but apply with a 3-way merge, which means context drift.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 13452 | issue | CANNOT_VERIFY |
| 13494 | issue | IMPLEMENT (via PR #13621) |
| 13500 | PR | DEFER_LARGE |
| 13508 | PR | CANNOT_VERIFY |
| 13520 | PR | IMPLEMENT |
| 13534 | issue | IMPLEMENT (new change in win-dshow) |
| 13546 | PR | IMPLEMENT |
| 13552 | issue | CANNOT_VERIFY |
| 13736 | issue | CANNOT_VERIFY |
| 13766 | PR | IMPLEMENT |
| 13829 | issue | OUT_OF_SCOPE |
| 13895 | issue | CANNOT_VERIFY |
| 13909 | issue | IMPLEMENT (via PR #13911) |
| 13911 | PR | IMPLEMENT |
| 13920 | issue | DEFER_LARGE |
| 13954 | PR | ALREADY_ADDRESSED |
| 14007 | PR | IMPLEMENT |
| 14045 | PR | IMPLEMENT |
| 14046 | PR | IMPLEMENT |
| 14053 | PR | IMPLEMENT |
| 14055 | PR | IMPLEMENT (partial) |

---

### [#13452](https://github.com/obsproject/obs-studio/issues/13452) — preview projector lags
**Verdict: CANNOT_VERIFY**

The report says a capture-card source shown in a projector runs at about 30 fps instead of the configured FPS on Windows 10. Steps and details are minimal and there is only a log URL. Projector rendering is a draw callback on an `OBSQTDisplay` (`frontend/widgets/OBSProjector.cpp:74-80`). Frame pacing there depends on the GPU, the swap chain and the monitor refresh rate. Nothing in the code shows a 30 fps cap. It needs a repro on the reporter's hardware.

- `frontend/widgets/OBSProjector.cpp:74-80`: the draw callback is registered on DisplayCreated, with no FPS limiting in the frontend.

Related: none.

### [#13494](https://github.com/obsproject/obs-studio/issues/13494) — Unable to exit OBS Studio via system tray, if window was never visible
**Verdict: IMPLEMENT** (cherry-pick of related PR #13621, which is not in this batch)

The tray Exit action is connected straight to `OBSBasic::close` (`frontend/widgets/OBSBasic_SysTray.cpp:84`). `OBSBasic::close` calls `OBSMainWindow::close()` (`frontend/widgets/OBSBasic.cpp:1560-1567`). In the issue thread (one WebFetch), testers confirmed the bug only happens on Wayland and only when the main window was never shown. If the window is created but never shown, its `QWindow` has no `QPlatformWindow`. `QWindow::close()` then reports success without closing anything, so `QWidgetPrivate::close`'s `handleClose` fallback never runs and `closeEvent` is never called.

The fix is upstream PR #13621 (`refs/upstream-pr/13621`, by the reporter). In `OBSBasic::close()`, when `windowHandle() && !windowHandle()->handle()`, it sends a `QCloseEvent` to `this` directly. It is about 17 lines and needs no new dependency.

- `frontend/widgets/OBSBasic_SysTray.cpp:84`: `connect(exit, &QAction::triggered, this, &OBSBasic::close)`.
- `frontend/widgets/OBSBasic.cpp:1560-1567`: `OBSBasic::close()` defers to `OBSMainWindow::close()` and has no path for a window that was never shown.
- `frontend/widgets/OBSBasic_SysTray.cpp:129-135`: the start-in-tray path never shows the window.

Related: #13621 (fix PR), #10933 (earlier duplicate).

**Slice:** cherry-pick `refs/upstream-pr/13621` (commits 85feff4 and b1d6fda), about 17 lines in `frontend/widgets/OBSBasic.cpp`. Check for duplicate work if another batch also picks #13621.
**Test:** build the frontend on Windows (MSVC). The behaviour is Linux/Wayland only, so it is UNTESTED on this machine.

### [#13500](https://github.com/obsproject/obs-studio/pull/13500) — frontend: Remove sender() usage from UI handlers
**Verdict: DEFER_LARGE**

This is a cleanup across 24 files (+195/−279, about 474 changed lines). It changes signal and slot signatures in scene items, transitions, projectors, the volume control and settings. It no longer applies cleanly: `VolumeControl.hpp` and `OBSBasicSettings.hpp` conflict without a 3-way merge. It fixes no bug that a user can see, and it is well over the slice budget. Every handler it touches would need manual UI regression testing.

- `git diff master...refs/upstream-pr/13500 --stat`: 24 files, 195 insertions and 279 deletions.
- The apply check fails at `frontend/components/VolumeControl.hpp:113` and `frontend/settings/OBSBasicSettings.hpp:386`.

Related: upstream issue #13444.

### [#13508](https://github.com/obsproject/obs-studio/pull/13508) — frontend: Make CropItem anchor logic stateless
**Verdict: CANNOT_VERIFY**

The PR replaces the hand-written anchor calculation in `OBSBasicPreview::CropItem` (`frontend/widgets/OBSBasicPreview.cpp:1517-1540`) with the existing helper `CalculateStretchPos(tl, br)` (`:1336-1360`). It claims the result is the same, but it is not:

- Left, right, top and bottom alignment give identical results.
- For center alignment, the old code anchors at `stretchItemSize * 0.5`, the center of the original item. The new code anchors at `tl + (br - tl) / 2`, the center of the cropped area.

So alt-crop dragging a center-aligned item moves differently after the change. The new behaviour may well be more correct, but that needs interactive GUI testing and a call on the intended UX. The PR is a refactor that brings an unflagged behaviour change, so I cannot verify it as a safe cleanup from the code alone.

- `frontend/widgets/OBSBasicPreview.cpp:1336-1360`: `CalculateStretchPos` handles the center case as the midpoint of tl/br.
- `frontend/widgets/OBSBasicPreview.cpp:1517-1540`: the old code puts the center anchor at `stretchItemSize * 0.5`.

Related: none.

### [#13520](https://github.com/obsproject/obs-studio/pull/13520) — libobs: Prevent loading Mouse1/Mouse2 as hotkeys
**Verdict: IMPLEMENT**

The frontend refuses left and right clicks as hotkeys (`frontend/settings/OBSHotkeyEdit.cpp:96-101` returns early for `Qt::LeftButton` and `Qt::RightButton`). libobs has no such check, so a hand-edited scene collection or a plugin can bind OBS_KEY_MOUSE1/2, which then fires on every click. The PR adds a guard in `create_binding()` (`libobs/obs-hotkey.c:458`), which both callers use: `load_binding` at :485 and `obs_hotkey_load_bindings` at :513. It is 13 lines and applies cleanly.

- `frontend/settings/OBSHotkeyEdit.cpp:96-101`: the UI already blocks left and right mouse buttons.
- `libobs/obs-hotkey.c:458-466`: `create_binding` has no key check.

Related: upstream issue #13403.

**Slice:** cherry-pick `refs/upstream-pr/13520` (d8a25eec2), 13 lines in `libobs/obs-hotkey.c`.
**Test:** MSVC build of libobs. Manual check: hand-edit a scene collection to bind `OBS_KEY_MOUSE1`, then load it and confirm no binding appears in Settings → Hotkeys.

### [#13534](https://github.com/obsproject/obs-studio/issues/13534) — Video properties window is open, shows not responding at OBS shutdown
**Verdict: IMPLEMENT** (new change)

The defect is clear in the code:

- The "Configure Video" button queues `Action::ConfigVideo` (`plugins/win-dshow/win-dshow.cpp:1513-1520`).
- The DShow worker thread then calls `device.OpenDialog(nullptr, ...)` (`:369-383`).
- That calls the modal `OleCreatePropertyFrame` with no owner window (`deps/libdshowcapture/src/source/dshowcapture.cpp:133`), which blocks the worker thread until the user closes the dialog.
- At shutdown, `~DShowInput` queues `Action::Shutdown` and calls `WaitForSingleObject(thread, INFINITE)` (`plugins/win-dshow/win-dshow.cpp:267-278`).

So the UI thread hangs and shows "Not Responding" until the user closes the property page by hand. This matches the report exactly.

**Slice:** in `~DShowInput`, before the wait, call `EnumThreadWindows(GetThreadId(thread), ...)` and post `WM_CLOSE` to the thread's visible top-level windows. The property frame handles WM_CLOSE as Cancel, `OpenDialog` returns, the thread reads the Shutdown action and exits. About 20 lines, Windows only, in `plugins/win-dshow/win-dshow.cpp`, with no change to the libdshowcapture submodule.
**Test:** MSVC build of win-dshow. A runtime test needs a DirectShow camera or a virtual camera device; if none is present, mark it UNTESTED.

Related: upstream #3977 and #4362 (older reports of the same thing).

### [#13546](https://github.com/obsproject/obs-studio/pull/13546) — frontend: Fix rescale dropdown enable desync
**Verdict: IMPLEMENT**

`UpdateMultitrackVideo()` calls `ui->advOutRescale->setDisabled(disable_video)` unconditionally (`frontend/settings/OBSBasicSettings.cpp:5899`). That re-enables the resolution combo even when the rescale filter is "Disabled". The normal rule elsewhere is that the combo is enabled only when the filter is not `OBS_SCALE_DISABLE` (`:817-822` and `:1879`). The PR folds that condition in. It is a one-line change and applies cleanly.

- `frontend/settings/OBSBasicSettings.cpp:811`: the "Disabled" entry is added first, at index 0, so the PR's `currentIndex() == 0` check is correct. When cherry-picking, consider `currentData() == OBS_SCALE_DISABLE` instead, to match line 819.
- `frontend/settings/OBSBasicSettings.cpp:5897-5900`: the unconditional enable.

Related: upstream issue #11908.

**Slice:** cherry-pick `refs/upstream-pr/13546` (3e8374f80), one line.
**Test:** MSVC build of the frontend. Manual check: Settings → Output (Advanced), toggle Multitrack Video, and confirm the rescale resolution combo stays disabled while the filter is "Disabled".

### [#13552](https://github.com/obsproject/obs-studio/issues/13552) — Mouse element dragging issues on the video preview window when using Fractional Scaling
**Verdict: CANNOT_VERIFY**

This is KDE Plasma on Wayland at 150% fractional scaling. `GetMouseEventPos` already scales with `main->GetDevicePixelRatio()` and `previewScale` (`frontend/widgets/OBSBasicPreview.cpp:64-75`). The mismatch probably comes from the Wayland surface's buffer scale differing from the DPR Qt reports to the main window, which depends on the compositor and the Qt version. I cannot find a concrete defect in OBS code, and it cannot be reproduced on this Windows machine.

- `frontend/widgets/OBSBasicPreview.cpp:64-75`: the mouse mapping uses the main window's DPR.
- `frontend/widgets/OBSBasic.cpp:294-296`: the DPI source.

Related: none.

### [#13736](https://github.com/obsproject/obs-studio/issues/13736) — clicking menu bar icon crashes the app
**Verdict: CANNOT_VERIFY**

This is a crash on clicking the macOS menu-bar (tray) icon, only on macOS 27 betas. The tray activation handler does nothing on Apple (`frontend/widgets/OBSBasic_SysTray.cpp:86-97`, `#ifdef __APPLE__ UNUSED_PARAMETER`), so the crash is most likely inside Qt's `QSystemTrayIcon` / NSStatusItem on a beta OS. There is no symbolicated stack in the item body. It cannot be reproduced here and may be an OS or Qt regression.

- `frontend/widgets/OBSBasic_SysTray.cpp:86-97`: `IconActivated` has no macOS-specific logic.

Related: none.

### [#13766](https://github.com/obsproject/obs-studio/pull/13766) — frontend: Auto release OBS data objects
**Verdict: IMPLEMENT**

This cleanup replaces manual `obs_data_release` calls with `OBSDataAutoRelease` in 11 files (+17/−34), and it applies cleanly. I checked reference counts at the sensitive sites:

- `OBSBasicProperties::oldSettings` becomes `OBSDataAutoRelease`, initialised from `obs_data_create()` (`frontend/dialogs/OBSBasicProperties.cpp:50`). The manual release at :67 is removed, and the net reference count is unchanged.
- `Load()` now owns `data` through AutoRelease, and `LoadData` takes `OBSData`, which adds a reference. The trailing `obs_data_release(data)` inside `LoadData` is removed (`frontend/widgets/OBSBasic_SceneCollections.cpp:1135-1166` and :1191). The early-return path in `Load` (data == NULL) never releases, so nothing is released twice.
- In `ApplyEncoderDefaults` (`frontend/utility/AdvancedOutput.cpp:36-44`), the "construct `OBSData`, then release" idiom becomes a single AutoRelease, which is equivalent.

It is pure tech debt with no behaviour change.

Related: none.

**Slice:** cherry-pick `refs/upstream-pr/13766` (3f3d32dbf).
**Test:** MSVC build of the frontend. Manual check: start OBS, load a scene collection, open and cancel source properties, open Settings → Output, and check the log for leaks or crashes at shutdown.

### [#13829](https://github.com/obsproject/obs-studio/issues/13829) — Window Capture Automatic selects BitBlt for Delta Force and produces a stale frame, while WGC works correctly
**Verdict: OUT_OF_SCOPE**

"Automatic" capture-method selection is a deliberate, short list of window classes: browsers and UWP windows go to WGC, and everything else goes to BitBlt (`plugins/win-capture/window-capture.c:113-123`, :140-168). The report asks to special-case one game. The only practical change would be to add `UnrealWindow`, which would switch every Unreal Engine game to WGC. That is a policy change upstream has not asked for. Games should use Game Capture, and the user's own workaround of choosing WGC by hand works. This is per-application tuning, not a defect.

- `plugins/win-capture/window-capture.c:113-123`: the WGC class allowlist.
- `plugins/win-capture/window-capture.c:140-168`: `choose_method` falls back to BitBlt.

Related: none.

### [#13895](https://github.com/obsproject/obs-studio/issues/13895) — UI Is Hidden When Re-opening not Through System Tray
**Verdict: CANNOT_VERIFY**

On macOS, with "minimize to tray" on, minimizing calls `ToggleShowHide()` (`frontend/widgets/OBSBasic.cpp:1644-1648`). That hides the window and the Dock icon (`frontend/widgets/OBSBasic_MainControls.cpp:557-583`) while the window stays in the minimized state. Reopening through Spotlight goes through Cocoa's app-reopen path. OBS has no handler for it (no `applicationStateChanged` or reopen handling beyond hotkeys, `frontend/OBSApp.cpp:1356-1357`), so the window probably comes back still minimized or with the preview disabled. I cannot confirm the exact failing path, or test a fix, without macOS.

- `frontend/widgets/OBSBasic.cpp:1639-1659`: `changeEvent` handles minimize-to-tray.
- `frontend/OBSApp.cpp:1356-1357`: `applicationStateChanged` only resets the hotkey state.

Related: #13494 (tray show/hide state).

### [#13909](https://github.com/obsproject/obs-studio/issues/13909) — Inconsistent dock toolbar spacing before theme change
**Verdict: IMPLEMENT** (via PR #13911)

The dock toolbar height after a cold start differs from the height after the theme is reapplied. PR #13911, by the same author, explains the root cause: `restoreState()` resizing does not invalidate `QToolBarLayout`'s cached layout the way a StyleChange does. The fix is to reapply the stylesheet once after init. See #13911.

- `frontend/OBSApp_Themes.cpp:994`: `setStyleSheet(stylesheet)` is the only place a repolish of every widget happens, at theme load, which runs before the main window is built.

Related: #13911.

### [#13911](https://github.com/obsproject/obs-studio/pull/13911) — frontend: Fix subtle layout issues on cold start
**Verdict: IMPLEMENT**

The PR adds `qApp->setStyleSheet(qApp->styleSheet())` at the end of `OBSBasic::OBSInit()`, which forces a StyleChange on every widget after `restoreState()`. It is 3 lines. The original hunk targets an old `PluginsFailedToLoad` block that has since moved into `App()->handlePluginLoadState()` (commit 11a8445aa), so it only applies with a 3-way merge. Resolve it by putting the call after `App()->handlePluginLoadState();` at the end of `OBSInit` (`frontend/widgets/OBSBasic.cpp:1246-1247`).

- `frontend/widgets/OBSBasic.cpp:874-1248`: `OBSInit`, which ends with `handlePluginLoadState()`.

Related: #13909.

**Slice:** cherry-pick `refs/upstream-pr/13911` (974233eaa) and resolve the context conflict, about 3 lines.
**Test:** MSVC build. Manual check: measure dock toolbar heights at startup, then again after a Settings → Appearance round trip; they should match.

### [#13920](https://github.com/obsproject/obs-studio/issues/13920) — Migrate certain styling classes to dedicated widgets
**Verdict: DEFER_LARGE**

This is a maintainer's own tracking issue (Warchamp7), and it says it is not to be claimed. It covers turning class-property styling helpers such as `.dialog-container` into dedicated widget subclasses across the UI. That is a design-led refactor of the theme and widget structure, not a small slice.

Related: #13954 (same author, idian styling work).

### [#13954](https://github.com/obsproject/obs-studio/pull/13954) — idian: Polish queue logic cleanup
**Verdict: ALREADY_ADDRESSED**

The PR calls itself an alternative fix for upstream #13953, which is the source icon colour appearing inverted. That bug is already fixed on master by commit 2a4dfeb55 ("frontend: Fix source icon state appearing inverted", by the same author), which adds an explicit `style()->polish(iconLabel)` before `applyColorToIcon` in `frontend/components/SourceTreeItem.cpp`. What remains of the PR is an optional rework of the idian polish queue: it renames `repolish` to `polishNow`, changes the queue container and changes `polishChildren` semantics. The author left that as one of two options for maintainers to choose between, so it is a design choice and not a fix this fork needs.

- `git log -S"style()->polish(iconLabel)" master`: 2a4dfeb55.
- `shared/qt/idian/include/Idian/Utils.cpp` and `Utils.hpp`: the current queue implementation works. Its callers are `StateEventFilter.cpp:48`, `CollapsibleGroup.cpp:102` and `Row.cpp:66,75`.

Related: #13953 (fixed on master), #13920.

### [#14007](https://github.com/obsproject/obs-studio/pull/14007) — libobs, frontend: Fix file path handling issues
**Verdict: IMPLEMENT**

This is three small, real fixes (+14/−6), and it applies cleanly:

1. **`os_stat` buffer overflow.** `libobs/util/platform.c:96-97` passes `sizeof(w_file)`, which is 1024 bytes, as the length of a `wchar_t[512]` buffer, so a long UTF-8 path can overflow the stack. The fix uses `_countof`.
2. **`BPtr` leak.** `BPtr::operator=(BPtr&&)` overwrites `ptr` without freeing it, which leaks memory (`libobs/util/util.hpp:50-55`). The fix frees `ptr` first, and makes the move constructor initialise `ptr(nullptr)` so the new `bfree` never reads garbage.
3. **Path separator consistency.** `os_get_path_ptr_internal` (`libobs/util/platform-windows.c:420-432`), `os_get_config_path_ptr` on nix, and `GetAppConfigPathPtr` in portable mode (`frontend/OBSApp.cpp:1783-1799`) append a separator even when `name` is empty. `os_get_path_internal` (`platform-windows.c:406-408`) already skips the separator, so the fix makes the ptr variants match.

Related: upstream PR #13749 (the parent feature these were split from).

**Slice:** cherry-pick `refs/upstream-pr/14007` (88f9ad90b, b2f22417b, b197334a3).
**Test:** MSVC build of libobs and the frontend. Run the existing cmocka tests in `test/cmocka` if they build. The nix path change is UNTESTED on this machine.

### [#14045](https://github.com/obsproject/obs-studio/pull/14045) — frontend: Fix blank projectors on startup
**Verdict: IMPLEMENT**

The root cause is visible in the constructor. `OBSProjector::OBSProjector` calls `SetMonitor(monitor)` (`frontend/widgets/OBSProjector.cpp:50-54`). That calls `showFullScreen()` (`:125-131`), which can create the native display and emit `DisplayCreated` synchronously. The `DisplayCreated` → `addDrawCallback` connection is only made later (`:80`), so the signal can be missed and the fullscreen projector restored at startup stays blank. The PR moves the resize/`SetMonitor` block to just before `show()`, after the connection. It is 6+/6− and applies cleanly.

- `frontend/widgets/OBSProjector.cpp:50-54`: `SetMonitor` is called before the connection.
- `frontend/widgets/OBSProjector.cpp:80`: `connect(this, &OBSQTDisplay::DisplayCreated, ...)`.
- `frontend/widgets/OBSProjector.cpp:125-131`: `SetMonitor` calls `showFullScreen()`.

Related: none.

**Slice:** cherry-pick `refs/upstream-pr/14045` (2a9e44340).
**Test:** MSVC build. Manual check: open a fullscreen projector, restart OBS, and confirm the projector renders. The original repro needs a high-resolution monitor and may not reproduce here.

### [#14046](https://github.com/obsproject/obs-studio/pull/14046) — frontend: Sanitize filenames in Advanced mode
**Verdict: IMPLEMENT**

Simple output passes the filename format through `GetFormatString(filenameFormat, nullptr, nullptr)` (`frontend/utility/SimpleOutput.cpp:857`). That calls `remove_reserved_file_characters` and replaces `:*?"|<>` (`frontend/OBSApp.cpp:1622-1673`). `AdvancedOutput::StartRecording` passes the raw `filenameFormat` both to `GetRecordingFilename` and to the split-file `format` setting (`frontend/utility/AdvancedOutput.cpp:818-838`). A format containing `:` therefore fails to open the file on Windows. The PR mirrors the Simple mode handling (+4/−3) and applies cleanly. The Advanced replay buffer already sanitizes (`AdvancedOutput.cpp:902`).

Related: upstream issue #13786.

**Slice:** cherry-pick `refs/upstream-pr/14046` (4ceaae360).
**Test:** MSVC build. Manual check: in Advanced output, set the filename format to `%CCYY-%MM-%DD %hh:%mm`, start recording, and confirm the file is created with `_` in place of `:`.

### [#14053](https://github.com/obsproject/obs-studio/pull/14053) — frontend: Defer exit confirmation until main window is shown
**Verdict: IMPLEMENT**

`promptToClose()` calls `SetShowing(true)` and then opens the modal confirm dialog synchronously (`frontend/widgets/OBSBasic.cpp:1809-1825`). But `SetShowing(true)` only *queues* `show()` with `QTimer::singleShot(0, ...)` (`frontend/widgets/OBSBasic_MainControls.cpp:585-589`). The dialog is therefore mapped before its parent, and on KDE Wayland the main window then covers the dialog. The PR has `closeEvent` call `SetShowing(true)` and queue `promptToClose` with `singleShot(0)` (`:1594-1607`). `promptToClose` now returns void, guards against re-entry, and calls `closeWindow()` itself. It is small (+11/−10) and applies cleanly. The re-entry guard covers a second close arriving before the queued prompt runs.

- `frontend/widgets/OBSBasic_MainControls.cpp:585-589`: show is deferred.
- `frontend/widgets/OBSBasic.cpp:1594-1607` and `:1809-1825`: the current synchronous prompt.

Related: upstream issue #13003.

**Slice:** cherry-pick `refs/upstream-pr/14053` (1dacfdd8d). It is co-authored, so keep the trailers.
**Test:** MSVC build. Manual check on Windows: with Confirm on Exit enabled and recording active, close from the tray while the window is hidden, and confirm the dialog appears and both Cancel and Ok work. The KDE Wayland ordering is UNTESTED.

### [#14055](https://github.com/obsproject/obs-studio/pull/14055) — frontend: Localize initialization errors
**Verdict: IMPLEMENT** (partial-pr)

The PR replaces `throw "..."` in `OBSApp::AppInit` (`frontend/OBSApp.cpp:1133-1142` and :1184) with a helper that shows a localized `OBSErrorBox` and throws `std::runtime_error`. It adds 5 en-US strings. It also changes `run_program`'s handler from `catch (const char *)` to `catch (const std::exception &)` (`frontend/obs-main.cpp:693`).

That catch change is a regression. Other `const char *` throws are still reachable inside the same try block:

- `PluginManager::loadAllPlugins` (`frontend/plugin-manager/PluginManager.cpp:93`), when core modules fail to load.
- The output handler constructors (`frontend/utility/AdvancedOutput.cpp:84-189` and `SimpleOutput.cpp:53-78`), reached through `ResetOutputs` in `OBSInit`.
- `GetLocaleNames` (`frontend/OBSApp.cpp:1731`, :1736).

With only the `std::exception` handler, any of these would call `std::terminate` instead of showing an error box.

**Slice:** apply the PR's `OBSApp.cpp` and `en-US.ini` changes. In `obs-main.cpp`, keep the existing `catch (const char *error)`, which logs and shows `OBSErrorBox`, and add a `catch (const std::exception &error)` that only logs, because the helper has already shown the box. About 50 lines in 3 files.
**Test:** MSVC build. Manual check: make the user config dir unwritable or force `InitTheme` to fail, and confirm a localized error box appears and the process exits cleanly.

Related: upstream issue #13394 (structured exception type).
