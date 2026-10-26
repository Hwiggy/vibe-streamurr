# Triage batch frontend-ui-03

- Batch: frontend-ui-03 (area hint: frontend-ui)
- Items: 12190, 12192, 12202, 12259, 12312, 12326, 12342, 12458, 12470, 12531, 12623, 12624, 12626, 12676, 12678, 12729, 12758, 12787, 12845, 12854, 12855
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies come from `notes/upstream-triage/data/all.json`. PR heads were checked as `refs/upstream-pr/N`. Local git is 2.33, which has no `merge-tree --write-tree`, so applicability was checked with the legacy three-way `git merge-tree <base> master <pr>` and a count of conflict markers. One WebFetch was used, for #12458.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 12190 | PR | DEFER_LARGE |
| 12192 | issue | CANNOT_VERIFY |
| 12202 | PR | DEFER_LARGE |
| 12259 | PR | DEFER_LARGE |
| 12312 | PR | DEFER_LARGE |
| 12326 | PR | IMPLEMENT (cherry-pick, conflicts are trivial) |
| 12342 | issue | IMPLEMENT (status bar strings only) |
| 12458 | issue | CANNOT_VERIFY |
| 12470 | issue | CANNOT_VERIFY |
| 12531 | issue | CANNOT_VERIFY |
| 12623 | issue | CANNOT_VERIFY |
| 12624 | PR | DEFER_LARGE |
| 12626 | issue | IMPLEMENT (via PR #12729) |
| 12676 | issue | DEFER_LARGE |
| 12678 | PR | DEFER_LARGE |
| 12729 | PR | IMPLEMENT (cherry-pick) |
| 12758 | issue | CANNOT_VERIFY |
| 12787 | issue | DEFER_LARGE |
| 12845 | issue | CANNOT_VERIFY |
| 12854 | PR | IMPLEMENT (cherry-pick) |
| 12855 | issue | CANNOT_VERIFY |

---

### [#12190](https://github.com/obsproject/obs-studio/pull/12190) — frontend: Move Preview into dock widget
**Verdict: DEFER_LARGE**

The PR turns the preview into a fixed OBSDock and changes the allowed areas of every dock. This is a UI architecture change, and it depends on another PR (#12188). The author says it is unfinished: browser docks still need their allowed areas fixed and `addDock` needs an override. The diff rewrites most of `OBSBasic.ui`.
- 13 files, +798/-756, most of it in `frontend/forms/OBSBasic.ui` (1344 lines changed).
- Legacy merge-tree against master shows 2 conflict hunks.
- It is a step toward future UI work (toolbar, sidebar, canvases) and does not fix anything for users today.

### [#12192](https://github.com/obsproject/obs-studio/issues/12192) — Window Capture causes crosshair cursor in Noita to disappear
**Verdict: CANNOT_VERIFY**

The report says any active window capture, even of another window, hides Noita's custom cursor. The reporter does not know whether OBS or Windows causes it. OBS only reads the cursor (`GetCursorInfo`/`CopyIcon`) or asks WGC to include it. Nothing in the code changes the system cursor, so this looks like Windows capture API behaviour. Confirming it needs the game and a repro.
- `plugins/win-capture/cursor-capture.c:205,216`: read-only cursor query and copy.
- `plugins/win-capture/dc-capture.c:109,159`: BitBlt path, also read-only.
- `libobs-winrt/winrt-capture.cpp:324,392,507`: WGC `IsCursorCaptureEnabled` toggles OS-side cursor compositing.

### [#12202](https://github.com/obsproject/obs-studio/pull/12202) — frontend: Make OBSAbout self contained
**Verdict: DEFER_LARGE**

This is a refactor with no user-facing value. It moves `patronJson` and its thread from OBSBasic into a file-static in `OBSAbout`. It no longer applies cleanly (3 conflict hunks in `OBSAbout.cpp` and `OBSBasic.cpp`). It also changes behaviour: the new `~OBSAbout()` calls `patronJsonThread->wait()`, so closing the About dialog during a slow network fetch blocks the UI thread. Today that wait only happens at application shutdown (`OBSBasic::applicationShutdown`). Rebasing a refactor with no payoff plus a new risk is not worth doing in this fork.
- `frontend/dialogs/OBSAbout.cpp` (master) uses `OBSBasic::Get()->patronJson` and `patronJsonThread`.
- The PR adds `OBSAbout::~OBSAbout()` with a blocking `wait()`.

### [#12259](https://github.com/obsproject/obs-studio/pull/12259) — frontend: Add template for Qt's invokeMethod
**Verdict: DEFER_LARGE**

This cleanup adds a helper template in `shared/qt/wrappers/qt-wrappers.hpp` and moves `MediaControls` and `OBSBasicFilters` to it. Behaviour does not change. It has 6 conflict hunks against master. The author meant it as an API proposal pending maintainer acceptance ("If this is accepted, I'll PR for other places later"). This is a code-style decision for upstream, not a fix.
- 5 files, +81/-102. The template sits in `shared/qt/wrappers/qt-wrappers.hpp`.

### [#12312](https://github.com/obsproject/obs-studio/pull/12312) — frontend: Add notification system
**Verdict: DEFER_LARGE**

This is a new feature (toasts, a bell widget, a notification dialog, do-not-disturb) at 34 files and +1135 lines. It is labelled "Seeking Testers", has 10 conflict hunks, and needs UX/design sign-off.
- New files include `frontend/widgets/Notification.cpp/.hpp` and `frontend/widgets/OBSBasic_Notifications.cpp`. It also touches the status bar, recording, replay buffer and screenshot code.

### [#12326](https://github.com/obsproject/obs-studio/pull/12326) — Improve UI behavior when available codecs/settings change
**Verdict: IMPLEMENT (cherry-pick-pr, resolving trivial conflicts by hand)**

The defect is still in master. If a saved encoder or quality value is no longer offered (for example an encoder plugin was removed or added), `LoadSimpleOutputSettings` falls back to index 0. It does not mark the combo box as changed, so Apply stays disabled. When only one option is left, the user can never trigger a change, and the profile stays broken. The advanced path has the same problem when the saved stream or recording encoder is missing. `QueryAllowedToClose` also rejects an invalid simple recording encoder even when recording quality is "Stream", where that combo box is hidden and cannot be fixed.
- `frontend/settings/OBSBasicSettings.cpp:1807-1823`: `idx == -1` falls back to `idx = 0`, with no `changed` property and no `EnableApplyButton`.
- `frontend/settings/OBSBasicSettings.cpp:1970-1981`: `LoadAdvOutputStreamingEncoderProperties` has no else branch when `SetComboByValue` fails and the encoder is not hidden.
- `frontend/settings/OBSBasicSettings.cpp:2088`: `advOutRecEncoder->setCurrentIndex(-1)` without marking a change.
- `frontend/settings/OBSBasicSettings.cpp:3874-3877`: the simple-mode check includes `simpleOutRecEncoder`/`simpleOutRecAEncoder` regardless of recording quality.
- Conflicts come only from upstream's later brace-style change (`if (idx == -1) {`). The logic itself is unchanged.
- Related: upstream #8529 (OpenH264/x264 on Fedora), cited by the PR.

**Slice plan**
- Cherry-pick d87d043a4 and 22cb8efe8 (author Asahi Lina <lina@asahilina.net>, GPL-2.0-or-later, keep authorship). Resolve the conflicts by keeping master's brace style and adding the PR's `changed` property, `outputSettingReset`, `outputsChanged = true; EnableApplyButton(true);` and the reordered `QueryAllowedToClose` check.
- Files: `frontend/settings/OBSBasicSettings.cpp` (about 35 lines).
- Test: MSVC build of the `obs-studio` frontend target. Manual check: set `SimpleOutput/StreamEncoder` in `basic.ini` to a nonexistent id, open Settings, confirm Apply is enabled and saving writes a valid encoder. Set RecQuality=Stream with an invalid RecEncoder and confirm Settings can be closed.

### [#12342](https://github.com/obsproject/obs-studio/issues/12342) — Some strings aren't available for translation
**Verdict: IMPLEMENT (new-change, status bar subset only)**

The status bar strings are hardcoded English concatenations and cannot be translated in Crowdin. The other items in the report (settings `Kbps`/`sec`/`kHz`, NTSC/PAL framerate labels, transform `px`/degree suffixes) are spread across many widgets. The decimal-separator part depends on how OBS sets up its locale, which is the scope of #12624, so it is left out of this slice.
- `frontend/widgets/OBSBasicStatusBar.cpp:122`: `setText("0 kbps")`.
- `frontend/widgets/OBSBasicStatusBar.cpp:196`: `QString::number(kbitsPerSec,'f',0) + QString(" kbps")`.
- `frontend/widgets/OBSBasicStatusBar.cpp:218`: `QString("CPU: ") + ... + QString("%")`.
- `frontend/widgets/OBSBasicStatusBar.cpp:232`: `QString::asprintf("%.2f / %.2f FPS", ...)`.
- `frontend/data/locale/en-US.ini:699-709`: existing `Basic.StatusBar.*` keys. No kbps, CPU or FPS key exists.

**Slice plan**
- Add `Basic.StatusBar.Kbps="%1 kbps"`, `Basic.StatusBar.CPUUsage="CPU: %1%"` and `Basic.StatusBar.FPS="%1 / %2 FPS"` to `frontend/data/locale/en-US.ini`. Do not edit the other locale files; Crowdin manages them.
- Replace the four hardcoded constructions with `QTStr(...).arg(...)`. Keep the numeric formatting as it is (`QString::number`) so the slice does not depend on #12624.
- Files: `frontend/widgets/OBSBasicStatusBar.cpp`, `frontend/data/locale/en-US.ini` (about 12 lines).
- Test: MSVC build. Run OBS in en-US and confirm the status bar reads the same as before. Edit the strings temporarily in a local ini to confirm they are picked up.

### [#12458](https://github.com/obsproject/obs-studio/issues/12458) — Crash when renaming a newly created profile and then opening settings
**Verdict: CANNOT_VERIFY**

The issue is confirmed and assigned upstream (Warchamp7). Duplicate #13726 reports the same crash for pre-29 profiles. Neither thread names a root cause or stack frames (checked with one WebFetch), and the crash log is on obsproject.com, which this triage cannot read. I read the rename path and found no dangling reference I could prove. `SetupRenameProfile` copies the profile directory, erases the old entry from the cache, calls `ActivateProfile(newProfile)` without a reset (outputs, service and encoders are not rebuilt), then deletes the old directory. A plausible candidate is something in memory still pointing at the deleted old profile directory, which Settings later reads. That is not proven, so this needs a debugger repro.
- `frontend/widgets/OBSBasic_Profiles.cpp:115-140`: `SetupRenameProfile` (copy, erase, `ActivateProfile(newProfile)` with reset=false, `RemoveProfile`).
- `frontend/widgets/OBSBasic_Profiles.cpp:184-196`: `RemoveProfile` runs `remove_all` on the old path.
- `frontend/widgets/OBSBasic_Profiles.cpp:668-742`: `ActivateProfile`. Outputs and service are rebuilt only when `reset` is true.
- `frontend/settings/OBSBasicSettings.cpp:1934-1939,3391,5209-5216`: Settings reads JSON from `GetCurrentProfile().path`.
- Next step: reproduce under a debugger on Windows. The repro is cheap (clean settings, cancel the wizard, rename, open Settings), so this is a good candidate for a later session.

### [#12470](https://github.com/obsproject/obs-studio/issues/12470) — Dock title buttons are truncated
**Verdict: CANNOT_VERIFY**

The reporter bisected the regression to b46e5bb1c ("frontend: Fix dock title button sizes"). That commit added `min-width`, `min-height`, `icon-size` and `padding` to `QDockWidget::close-button`/`float-button`. Together these can exceed the title bar height that Qt computes from the title font and padding on some platform styles. The report is from Ubuntu MATE only. The same rules were meant to fix sizing on other platforms, so reverting them would bring that problem back. Choosing a fix needs visual checks on the affected desktop, which this Windows machine cannot do.
- `frontend/data/themes/Yami.obt:939-949`: button min-size, icon-size and padding added by b46e5bb1c.
- `frontend/data/themes/Yami.obt:930-937`: `QDockWidget::title` padding, `var(--padding_base) var(--padding_large)`.

### [#12531](https://github.com/obsproject/obs-studio/issues/12531) — Last frame of layered window continues to be visible after window is empty
**Verdict: CANNOT_VERIFY**

When a transparent layered overlay window (RALibretro) becomes empty, the capture keeps showing its last frame. The reporter links the long-standing #2321. Window capture uses WGC or BitBlt. WGC only sends frames when the OS composes a new one, and BitBlt does not handle per-pixel-alpha layered windows well. Neither path has a clear OBS defect to fix. This needs the specific application and a repro to tell OBS behaviour apart from Windows behaviour.
- `libobs-winrt/winrt-capture.cpp`: frame-arrived driven, so a stale texture stays when no new frame arrives.
- `plugins/win-capture/dc-capture.c:171`: BitBlt path.
- Related: upstream #2321.

### [#12623](https://github.com/obsproject/obs-studio/issues/12623) — Fullscreen video preview stops
**Verdict: CANNOT_VERIFY**

On macOS 14, ScreenCaptureKit capture of a browser freezes when the browser enters native fullscreen, which moves it to its own Space. This is specific to macOS and ScreenCaptureKit, and this triage runs on Windows. Nothing in the bug report points to a defect in OBS code.
- Code lives in `plugins/mac-capture/mac-sck-*.m` (not testable here).

### [#12624](https://github.com/obsproject/obs-studio/pull/12624) — frontend: Use system locale with UTF-8 instead of 'C'
**Verdict: DEFER_LARGE**

The diff is small (+89/-40) and still applies (0 conflict hunks), but the effect is global. It switches the Windows CRT to the system locale with a UTF-8 code page, adds an `activeCodePage=UTF-8` manifest (which changes every ANSI Win32 API call in the process and in all loaded plugins), changes the default `std::locale`, stops setting `QLocale` from the OBS language, and changes the log timestamp format. Any of these can silently change float parsing or formatting and string handling in third-party plugins. Upstream needs to decide this; it is not a small slice. It is the proper basis for the decimal-mark part of #12342.
- Touches `frontend/obs-main.cpp`, `frontend/OBSApp.cpp`, `frontend/cmake/windows/obs.manifest`, `libobs/util/lexer.c`, `libobs/util/dstr.c`, `libobs/util/cf-lexer.c`, `libobs/obs.h`, `libobs/obs-win-crash-handler.c` and `plugins/text-freetype2/find-font.c`.
- Related: #12342, and upstream #13097 (prerequisite split out by the author).

### [#12626](https://github.com/obsproject/obs-studio/issues/12626) — The 'Captions (Experimental)' menu frequently crashes when opened.
**Verdict: IMPLEMENT (via cherry-pick of PR #12729)**

The screenshot shows a hang ("not responding") when opening Tools > Captions (Experimental). The root cause is in code and is fixed by #12729. Opening the dialog fills the provider combo box without blocking signals, so `on_provider_currentIndexChanged` restarts the caption thread. `CaptionStream::Read` has a lost-wakeup race: it records `wait_size` and `cur_size` under one lock, releases it, and takes the lock again. A `Stop()` that lands in that window, or before the wait, calls `notify_one` before anyone is waiting. `cv.wait(lock)` has no predicate and no stop flag, so the reader thread blocks forever, and the join in the UI thread hangs.
- `plugins/frontend-tools/captions-mssapi-stream.cpp:115-125`: lock, unlock, relock, then an unconditional `cv.wait`.
- `plugins/frontend-tools/captions-mssapi-stream.cpp:34-42`: `Stop()` frees the buffer and notifies, with no stop flag.
- `plugins/frontend-tools/captions-mssapi.cpp:129-135`: the `{notify, stop}` handle order gives data events priority over stop.
- `plugins/frontend-tools/captions.cpp:108-118`: provider combo filled and `setCurrentIndex` called without `blockSignals`.
- Related: #12729.

**Slice plan:** see #12729 (same change).

### [#12676](https://github.com/obsproject/obs-studio/issues/12676) — Unable to select the window of an auto-minimise application
**Verdict: DEFER_LARGE (needs a UX/behaviour decision; the code change itself is tiny)**

The cause is confirmed in code. The Window Capture property list is filled with `EXCLUDE_MINIMIZED`, which drops iconic and cloaked windows. Finding the window at capture time already uses `INCLUDE_MINIMIZED`, so a minimized window would capture fine once selected. Game Capture already lists minimized windows. Switching the list mode is a one-line change, but it would also list many cloaked or background UWP windows. Upstream excluded these on purpose, and whether to show them (or only iconic-but-not-cloaked ones, which would need a new search mode) is a design decision. The Sandboxie and Game Capture parts of the report are environment-specific.
- `plugins/win-capture/window-capture.c:535`: `ms_fill_window_list(p, EXCLUDE_MINIMIZED, NULL)`.
- `plugins/win-capture/window-capture.c:632-634`: capture lookup uses `INCLUDE_MINIMIZED`.
- `plugins/win-capture/game-capture.c:2248`: the game capture list uses `INCLUDE_MINIMIZED`.
- `libobs/util/windows/window-helpers.c:292-297`: `check_window_valid` excludes `IsIconic || IsWindowCloaked` under `EXCLUDE_MINIMIZED`.
- Possible future slice: add an `INCLUDE_ICONIC_EXCLUDE_CLOAKED`-style mode and use it at window-capture.c:535 (about 15 lines).

### [#12678](https://github.com/obsproject/obs-studio/pull/12678) — frontend: Add new component SlidingStackedWidget
**Verdict: DEFER_LARGE**

The PR adds a 301-line widget that nothing uses. The author says it is for future onboarding UI and will not be used in Settings. It still applies (0 conflicts), but it would be dead code in this fork. It is also derived from a third-party repository (timschneeb/SlidingStackedWidget), so the licence would need checking before importing. Revisit only if a consumer lands.
- New files: `frontend/components/SlidingStackedWidget.cpp/.hpp`, `frontend/cmake/ui-components.cmake`.

### [#12729](https://github.com/obsproject/obs-studio/pull/12729) — frontend, captions: Fix caption dialog hang
**Verdict: IMPLEMENT (cherry-pick-pr)**

The PR fixes the race described under #12626:
1. `Read` and `Stop` use a single lock scope plus a `stop` flag, so `Read` never waits after `Stop`.
2. Signals are blocked while the provider combo is populated, so opening the dialog no longer restarts the thread.
3. `CopyTo` reads `buf->size` under the mutex.
4. The stop event is first in `WaitForMultipleObjects`, so stop wins when both events are signalled.
5. Locale names are converted with `os_utf8_to_wcs_ptr`/`os_wcs_to_utf8_ptr` instead of per-char casts.

It applies cleanly (0 conflict hunks), touches 4 files (+21/-36) and needs no new includes (`util/platform.h` is already included through `captions-mssapi.hpp` and `captions.cpp`).
- Master defect lines: see the #12626 evidence.
- `plugins/frontend-tools/captions-mssapi-stream.cpp:180-190`: `CopyTo` reads `buf->size` before taking the lock.
- Related: #12626.

**Slice plan**
- `git cherry-pick 9530d310e 3f8c76455 a839091af 29edf383b` (author Henri Kulotie <dankirk_88@msn.com>, GPL-2.0-or-later, keep authorship).
- Files: `plugins/frontend-tools/captions-mssapi-stream.cpp/.hpp`, `plugins/frontend-tools/captions-mssapi.cpp`, `plugins/frontend-tools/captions.cpp`.
- Test (Windows-only code, so testable on this machine): MSVC build of the `frontend-tools` target. Run OBS, enable captions with a mic source, then open and close Tools > Captions repeatedly and confirm there is no hang. Speech recognition output itself depends on an installed SAPI recognizer for the locale; if none is available, mark that part UNTESTED.

### [#12758](https://github.com/obsproject/obs-studio/issues/12758) — Qt GUI burns most of a CPU core repeatedly decoding icons
**Verdict: CANNOT_VERIFY**

The backtrace shows `QDockWidget::paintEvent` → `QStyleSheetStyle::drawControl(CE_DockWidgetTitle)` → `QFusionStyle::subElementRect(SE_DockWidgetTitleBarText)` → `standardIcon(SP_TitleBarNormalButton)` → `iconFromTheme`. Qt's Fusion style rebuilds a QIcon from resources on every dock title paint, which is a Qt inefficiency. The high CPU also means dock titles are repainted continuously on that system (Arch, Qt 6 version-specific). The fix belongs either in Qt or in finding which OBS widget keeps invalidating the dock. Neither can be identified from code alone or reproduced on Windows.
- `frontend/data/themes/Yami.obt:921-928`: `titlebar-close-icon`/`titlebar-normal-icon` are set, but Fusion still queries `standardIcon` for layout.
- An OBS-side workaround is not obvious: QStyle subElementRect for dock titles always asks for the standard icon.

### [#12787](https://github.com/obsproject/obs-studio/issues/12787) — Global Hotkeys with modifiers require delays to work
**Verdict: DEFER_LARGE**

The root cause is identified. libobs detects global hotkeys by polling key state every 25 ms (`xcb_query_keymap` on X11, and the equivalent on other platforms). A QMK macro with no delays presses and releases the whole chord inside one poll interval, so OBS never sees the keys held down together. Discord works because it uses event-based hooks. A fix means replacing polling with event-driven input (XInput2/XRecord on X11, a low-level keyboard hook on Windows). That is a platform architecture change, not a small slice. Shortening the poll interval would only narrow the window and would cost CPU.
- `libobs/obs-hotkey.c:1157-1179`: `obs_hotkey_thread` loops on `os_event_timedwait(..., 25)` and calls `query_hotkeys()`.
- `libobs/obs-nix-x11.c:1046-1080`: `xcb_query_keymap` snapshot for `is_pressed`.

### [#12845](https://github.com/obsproject/obs-studio/issues/12845) — OBS Crashes when window closes (when controller is connected)
**Verdict: CANNOT_VERIFY**

The crash happens on Arch with the Flatpak build when a game closes and focus returns to OBS while a specific Bluetooth/2.4 GHz controller is connected. The gdb backtrace is an attachment and is not in the item data. OBS core has no gamepad handling, so the crash is likely in Qt, the platform input stack or a Flatpak-bundled library. There is nothing in the code to act on.

### [#12854](https://github.com/obsproject/obs-studio/pull/12854) — frontend: Escape "&" in non-hardcoded menu items
**Verdict: IMPLEMENT (cherry-pick-pr)**

Qt treats `&` in QAction text as a mnemonic marker. Profile names, scene collection names, undo item names, projector monitor names and plugin-provided transition and filter names go into menus unescaped, so a profile called "A&B" displays as "AB" with an underline. The PR adds `EscapeMenuItem()` (`&` → `&&`) in `qt-wrappers` and applies it to those menus. Because the displayed text no longer equals the raw name, it also changes `OBSStudioAPI` to match profiles and collections through the existing `profile_name`/`collection_name` properties instead of `action->text()`. That fixes a latent mismatch in `obs_frontend_set_current_profile`/`_scene_collection`. It applies cleanly (0 conflict hunks), at 9 files and +22/-14.
- `frontend/widgets/OBSBasic_Profiles.cpp:316`: `new QAction(qProfileName, this)`, unescaped.
- `frontend/widgets/OBSBasic_SceneCollections.cpp:401`: `new QAction(qCollectionName, this)`, unescaped.
- `frontend/OBSStudioAPI.cpp:154,203`: compares `action->text()` to the requested name.
- No other `action->text()` lookups exist in the profile, collection or transition code (grep), so escaping does not break other comparisons.
- Related: upstream #12853 (the issue it fixes).

**Slice plan**
- `git cherry-pick 16bd8ebd2 30532def2` (author Henri Kulotie <dankirk_88@msn.com>, GPL-2.0-or-later, keep authorship).
- Files: `shared/qt/wrappers/qt-wrappers.cpp/.hpp`, `frontend/OBSStudioAPI.cpp`, `frontend/dialogs/OBSBasicFilters.cpp`, `frontend/utility/undo_stack.cpp`, `frontend/widgets/OBSBasic.hpp`, `frontend/widgets/OBSBasic_Profiles.cpp`, `frontend/widgets/OBSBasic_SceneCollections.cpp`, `frontend/widgets/OBSBasic_Transitions.cpp`.
- Test: MSVC build. Create a profile and a scene collection named `A&B`, confirm the menus show `A&B` and switching works. Rename a source to include `&`, confirm the Undo menu text. Switching profiles through the frontend API (for example the obs-websocket SetCurrentProfile request, if available) is UNTESTED unless a client is at hand.

### [#12855](https://github.com/obsproject/obs-studio/issues/12855) — OpenGL window capture hangs when the window becomes active
**Verdict: CANNOT_VERIFY**

The report says Window Capture of an OpenGL game hangs on focus after upgrading to OBS 31. It gives no capture method, game, stack or hang dump. It depends on the GPU, driver and application, and there is no code defect to point to.
- `plugins/win-capture/window-capture.c:179`: the method selection (BitBlt/WGC) is not stated in the report.
