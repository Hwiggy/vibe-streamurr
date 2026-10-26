# Upstream triage — batch frontend-ui-02

- Batch: frontend-ui-02 (area hint: frontend-ui)
- Items: 10632, 10782, 10948, 11001, 11041, 11075, 11090, 11171, 11526, 11552, 11639, 11706, 11773, 11784, 11838, 11878, 11958, 11981, 12072, 12164, 12176
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; PR heads from `refs/upstream-pr/<N>`. The local git is 2.33, which has no `merge-tree --write-tree`, so I checked whether each PR applies with `git diff master...refs/upstream-pr/N | git apply --check` (read-only). I used one WebFetch, for the #10948 thread.

Summary:

| # | Kind | Verdict |
|---|------|---------|
| 10632 | issue | CANNOT_VERIFY |
| 10782 | issue | CANNOT_VERIFY |
| 10948 | issue | DEFER_LARGE |
| 11001 | issue | DEFER_LARGE |
| 11041 | issue | OUT_OF_SCOPE |
| 11075 | PR | IMPLEMENT (partial-pr, port to moved file) |
| 11090 | issue | CANNOT_VERIFY |
| 11171 | PR | DEFER_LARGE |
| 11526 | issue | DEFER_LARGE |
| 11552 | issue | OUT_OF_SCOPE |
| 11639 | issue | CANNOT_VERIFY |
| 11706 | PR | IMPLEMENT (cherry-pick-pr) |
| 11773 | PR | DEFER_LARGE |
| 11784 | PR | DEFER_LARGE |
| 11838 | PR | IMPLEMENT (partial-pr, rebase) |
| 11878 | issue | CANNOT_VERIFY |
| 11958 | issue | DEFER_LARGE |
| 11981 | issue | DEFER_LARGE |
| 12072 | issue | IMPLEMENT (new-change) |
| 12164 | PR | DEFER_LARGE |
| 12176 | issue | CANNOT_VERIFY |

---

### [#10632](https://github.com/obsproject/obs-studio/issues/10632) — Issues capturing reMarkable Screen Share as a Window Capture
**Verdict: CANNOT_VERIFY**

The reMarkable desktop app's screen-share window does not work with Window Capture. With BitBlt the image freezes after the first frame, and with WGC nothing is captured. A frozen BitBlt image is normal for windows that render through DirectComposition or hardware acceleration. The WGC failure depends on how that app builds its window. No defect is visible in OBS code, and checking it would need the third-party app.
- Evidence: `plugins/win-capture/window-capture.c:632-634` (method-dependent window lookup; generic BitBlt/WGC paths, nothing app-specific).
- Related: none.

### [#10782](https://github.com/obsproject/obs-studio/issues/10782) — Cursor is invisible in-game (Valorant, LoL) with Window Capture
**Verdict: CANNOT_VERIFY**

The report is that the game's own cursor disappears while WGC Window Capture is active, with or without "Capture Cursor". The cursor is drawn by Windows Graphics Capture and the game itself, and OBS does not hide the on-screen cursor. I found no OBS code path that would cause this. It is probably an OS or game interaction (anti-cheat, hardware cursor) and needs a reproduction.
- Evidence: `plugins/win-capture/window-capture.c:632` (WGC path uses `ms_find_window_top_level`; cursor handled by the WGC capture session, not by modifying the target window).
- Related: none.

### [#10948](https://github.com/obsproject/obs-studio/issues/10948) — In Chinese environment, font does not follow the OS (renders Songti)
**Verdict: DEFER_LARGE**

The root cause is visible. The base theme's font stack is `'Open Sans', '.AppleSystemUIFont', Helvetica, Arial, 'MS Shell Dlg', sans-serif`. For CJK glyphs, Qt falls through to `MS Shell Dlg`, which Chinese Windows maps to SimSun (Songti). Adding `Microsoft YaHei UI` to the stack would fix Simplified Chinese only. Because of Han unification it would give Traditional Chinese and Japanese users the wrong glyph forms; they use JhengHei and Yu Gothic UI. A proper fix needs locale-aware font selection, which is a design decision. In the thread (fetched once), a maintainer suspected a Qt issue, and a contributor noted that a similar earlier attempt (PR #7390) only fixed Simplified Chinese. No approved approach exists.
- Evidence: `frontend/data/themes/Yami.obt:596` (font-family stack); `frontend/obs-main.cpp:537-539` (only Open Sans is bundled, which has no CJK coverage).
- Related: upstream PR #7390 (closed, earlier attempt).

### [#11001](https://github.com/obsproject/obs-studio/issues/11001) — OBS does not remember maximized window layout
**Verdict: DEFER_LARGE**

When the window goes from maximized to normal, QMainWindow redistributes the dock sizes, and they are not restored on re-maximize. OBS saves dock state only at shutdown and restores it only at init. `changeEvent` handles only minimize. Keeping a separate layout per window state (save on leaving maximized, restore on re-maximize) is a UX behaviour change with edge cases, for example dock edits made while in the normal state. It needs a design decision, not a bug fix.
- Evidence: `frontend/widgets/OBSBasic.cpp:1639-1658` (changeEvent: only minimize handling); `frontend/widgets/OBSBasic.cpp:1751` (DockState saved once at close); `frontend/widgets/OBSBasic.cpp:1118-1127` (restoreState at init).
- Related: #12176.

### [#11041](https://github.com/obsproject/obs-studio/issues/11041) — OBS previews incorrect on HDR (NV12, Rec.709)
**Verdict: OUT_OF_SCOPE**

The reporter says the preview looks correct on the monitor and that output is correct. Only PrtSc and PowerToys colour-picker values differ. Those tools read the HDR (scRGB) desktop and tone-map or convert it, so their values are not the SDR values. That is expected Windows HDR behaviour for screenshot tools, not an OBS rendering defect.
- Evidence: the report body itself ("color sources seem to appear normally on my monitor"); the OBS preview renders through the swapchain colour-space path, which is not involved in PrtSc conversion.
- Related: none.

### [#11075](https://github.com/obsproject/obs-studio/pull/11075) — UI: Fix mem leak if --disable-missing-files-check
**Verdict: IMPLEMENT** (partial-pr: port to the moved file)

The PR still targets `UI/window-basic-main.cpp`, which no longer exists, so it does not apply. The bug is still in master. `LoadData` always creates an `obs_missing_files_t`, and when `--disable-missing-files-check` is set it never calls `ShowMissingFilesDialog`. That function is the only place that destroys the list (or hands it to the dialog), so the list leaks on every scene collection load while the flag is set.
- Evidence: `frontend/widgets/OBSBasic_SceneCollections.cpp:1347` (`obs_missing_files_create()` unconditional); `:1504-1506` (dialog/ownership only when the check is enabled); `:1670-1684` (`ShowMissingFilesDialog` destroys the list or gives it to the dialog); `frontend/OBSApp.cpp:1411-1414` (flag accessor).
- Related: upstream issue #11074.
- **Slice plan:** in `OBSBasic::LoadData` (`frontend/widgets/OBSBasic_SceneCollections.cpp` ~1504) add an `else { obs_missing_files_destroy(files); }` to the `IsMissingFilesCheckDisabled()` check. That is about 3 lines and the smallest correct fix. Optionally port the PR's full approach (skip collection when disabled, null-guard `addMissingFiles` and the transition loader), but that touches more call sites (`LoadTransitions(..., addMissingFiles, files)` at `:1354`). Credit kamalmostafa in the commit message.
- Test plan: MSVC build of the `obs-studio` frontend target. Launch with `--disable-missing-files-check` and a collection that references a missing file, and confirm no dialog and no crash. The leak can only be confirmed by inspection (or the libobs leak counter at shutdown in a debug build).

### [#11090](https://github.com/obsproject/obs-studio/issues/11090) — OBS crashes whenever I do anything dock-related
**Verdict: CANNOT_VERIFY**

The crash happens even in safe mode, goes away when run as administrator, and goes away with a clean portable install. That points to file permissions or a corrupt profile in the user's config directory, not to a code defect. No crash stack is in the body, and the crash-log URL can't be fetched offline.
- Evidence: none actionable in code; the dock code paths (`frontend/widgets/OBSBasic_Docks.cpp`) behave the same whether or not OBS runs elevated.
- Related: none.

### [#11171](https://github.com/obsproject/obs-studio/pull/11171) — frontend: Refactor main window menus
**Verdict: DEFER_LARGE**

This is a pure cleanup with no user-visible fix: about 782 changed lines over 12 files, moving menu code into a new file. It no longer applies (`git apply --check` fails in `OBSBasic.cpp`, `OBSBasic.hpp`, `OBSBasic_Preview.cpp`). Rebasing a refactor this size has no payoff for this fork.
- Evidence: `git diff master...refs/upstream-pr/11171 --stat` (12 files, +312/-470); apply-check conflicts listed above.
- Related: none.

### [#11526](https://github.com/obsproject/obs-studio/issues/11526) — Crossbar settings reset when Video Capture Device properties are opened
**Verdict: DEFER_LARGE**

Crossbar routing is set only through the native DirectShow dialog (`OpenDialog(ConfigCrossbar)`), and OBS never saves it. Opening the properties dialog (even with Cancel) re-applies the source settings. That re-activates the device, and libdshowcapture rebuilds the graph with the default crossbar routing. A fix means saving and restoring the crossbar input/output routing in the source settings and applying it in libdshowcapture (a submodule) when the graph is built. That is a feature-sized change in a separate dependency.
- Evidence: `plugins/win-dshow/win-dshow.cpp:377-382` (crossbar only via native dialog); `plugins/win-dshow/win-dshow.cpp:1534-1538,1950` (button only, no persisted setting); `deps/libdshowcapture/src` submodule owns graph construction.
- Related: none.

### [#11552](https://github.com/obsproject/obs-studio/issues/11552) — Buttons on docks are very small
**Verdict: OUT_OF_SCOPE**

This started after installing and then uninstalling the third-party StreamElements plugin. It survives reinstalling OBS, so it comes from leftover user config or theme state, or from OS scaling, not from OBS code. It is a support issue: resetting the profile or theme fixes it.
- Evidence: theme sizing is driven by `--obsFontScale` / `--font_base_value` in `frontend/data/themes/Yami.obt:123-143`. A third-party theme or setting left in the user config would override it.
- Related: none.

### [#11639](https://github.com/obsproject/obs-studio/issues/11639) — Slideshow does not crossfade properly in Studio Mode preview
**Verdict: CANNOT_VERIFY**

The report is that a new slideshow fades through black while an older one crossfades. Slideshow mk2 decodes slides asynchronously (`os_task_queue_queue_task(..., decode_image, ...)`), so a fade could start before the next image is decoded. I could not confirm that the cause depends on studio mode or tie it to a specific line. It needs a reproduction and a comparison of the two sources' settings.
- Evidence: `plugins/image-source/obs-slideshow-mk2.c:297-312` (async decode of new slide sources); `:334-369` (source reuse/creation).
- Related: none.

### [#11706](https://github.com/obsproject/obs-studio/pull/11706) — frontend: Fix repeated log entries
**Verdict: IMPLEMENT** (cherry-pick-pr)

`too_many_repeated_entries` only treats lines as repeats when the format-string pointer is unchanged. Loggers that build the format in a temporary buffer get a new pointer every call, for example win-dshow's `ffmpeg_log`, which uses a `DStr`. Their repeated lines are never suppressed and can flood the log. The PR adds a second check: same length and same character sum count as a repeat. It is 5 lines, self-contained, and applies cleanly to master. The risk of a false positive is small, because two different lines would need the same length and the same sum and still log 30 times before suppression.
- Evidence: `frontend/obs-main.cpp:160-193` (pointer-only check at `:176`); `plugins/win-dshow/win-dshow.cpp:108-128` (DStr-built format); `git apply --check` succeeds.
- Related: none.
- **Slice plan:** `git cherry-pick 868d81d97` (refs/upstream-pr/11706), keeping authorship. Changes `frontend/obs-main.cpp` (+5).
- Test plan: MSVC build of the frontend. Run OBS with a source that spams ffmpeg warnings, or run a quick plugin or script that blogs the same text through a heap-allocated format string, and confirm the "Last log entry repeated for N more lines" marker appears.

### [#11773](https://github.com/obsproject/obs-studio/pull/11773) — frontend: Make OBSProjector a parent window
**Verdict: DEFER_LARGE**

This restructures the projector so that a Qt-owned top-level window contains an OBSQTDisplay, to fix Wayland and explicit-sync problems (#6283). It conflicts with master (`frontend/widgets/OBSProjector.cpp:34` hunk fails). The author says Windows and macOS testing is still needed, and it includes GNOME-specific fullscreen workarounds. A cross-platform windowing change like this can't be validated on this Windows-only box and is not a small slice.
- Evidence: `git apply --check` fails on `frontend/widgets/OBSProjector.cpp`; projector setup around `frontend/widgets/OBSProjector.cpp:25-40`.
- Related: upstream #6283, #11558.

### [#11784](https://github.com/obsproject/obs-studio/pull/11784) — frontend: Use qobject_cast when casting QObjects
**Verdict: DEFER_LARGE**

The PR applies cleanly, but it is a broad style and tech-debt sweep: 38 files, +423/-341, including a SourceTree model API change (`setModel(SourceTreeModel*)`) and large reflows of the AutoConfig wizard pages. It fixes no bug that users see. It is far over the small-slice limit, and the churn would make later upstream syncs harder.
- Evidence: `git diff master...refs/upstream-pr/11784 --stat` (38 files); commit `017330d95` changes `frontend/components/SourceTree.{cpp,hpp}` API.
- Related: none.

### [#11838](https://github.com/obsproject/obs-studio/pull/11838) — frontend: Add --config-dir flag
**Verdict: IMPLEMENT** (partial-pr: rebase onto current OBSApp.cpp)

This adds a `--config-dir <path>` command-line flag, which is useful for running several isolated instances on every OS. Today portable mode only exists on Windows or with `ENABLE_PORTABLE_CONFIG`. Every frontend config location, including the `plugin_config` directory passed to `obs_startup`, comes from `GetAppConfigPath` / `GetAppConfigPathPtr`, so overriding those two functions is enough. The PR is 25 lines, but the context in `OBSApp.cpp` has moved, so it needs a manual rebase. `os_mkdirs` creates missing directories. The only direct `os_get_config_path` callers left are importers (which look up other apps' configs), user-plugin search paths, and the virtualcam marker, all of which should keep their current behaviour.
- Evidence: `frontend/OBSApp.cpp:1760-1800` (GetAppConfigPath/Ptr with portable branch); `frontend/OBSApp.cpp:434-480` (MakeUserDirs derives every dir from GetAppConfigPath); `frontend/OBSApp.cpp:1223-1227` (plugin_config path to `obs_startup`); `frontend/obs-main.cpp:962-963,1040` (arg parsing/help next to `--portable`); `frontend/OBSApp.cpp:424-431` (`os_mkdirs`).
- Related: upstream PR #11837 (alternative multi-instance approach).
- **Slice plan:** add `string opt_config_dir;` in `frontend/obs-main.cpp`, parse `--config-dir <path>` in the argv loop, and add a help line. Add `extern string opt_config_dir;` in `frontend/OBSApp.cpp` and put an early-return branch at the top of `GetAppConfigPath` and `GetAppConfigPathPtr` that formats `"%s/%s"` with the override, taking precedence over portable mode. Port commit `63bd103b6` by hand, keeping its author. About 25 lines.
- Test plan: MSVC build. Run `obs64 --config-dir C:\tmp\obscfg` and confirm `obs-studio/basic`, `logs` and `plugin_config` are created under that directory and the log shows paths there. Run without the flag and confirm the default `%APPDATA%` behaviour is unchanged. macOS and Linux are UNTESTED.

### [#11878](https://github.com/obsproject/obs-studio/issues/11878) — Hotkey not active on startup (Fedora 41)
**Verdict: CANNOT_VERIFY**

On Fedora 41 a Super+R hotkey only works after opening Settings and pressing OK. The session type (X11 or Wayland) isn't stated, and Wayland gives no global hotkeys at all. Opening Settings re-registers every hotkey, so the startup registration may be missing something. Without the log or knowing the session, I can't find a defect in the hotkey load path. The extra request ("work when unfocused") is the Wayland global-shortcut limitation.
- Evidence: the hotkey load/registration path in `frontend/widgets/OBSBasic.cpp` (InitHotkeys) and the X11 backend in `libobs/obs-nix-x11.c`; nothing Linux-specific can be checked here.
- Related: none.

### [#11958](https://github.com/obsproject/obs-studio/issues/11958) — Unexpected projector behaviour switching into/out of Studio Mode
**Verdict: DEFER_LARGE**

The current behaviour is by design. Opening a projector outside studio mode creates a `ProjectorType::Preview` projector, and in studio mode that projector follows the preview scene. Making it follow program instead is a UX semantics change, and the reporter also says it needs discussion first. There is no defect to fix without a maintainer decision.
- Evidence: `frontend/widgets/OBSBasic_Projectors.cpp:179,212` (Preview type used for preview projectors); `frontend/widgets/OBSProjector.cpp:193-205` (Preview projector renders preview vs program by studio mode); `frontend/widgets/OBSBasic_StudioMode.cpp:408-413` (separate StudioProgram projector exists).
- Related: none.

### [#11981](https://github.com/obsproject/obs-studio/issues/11981) — Configuration wizard can be resized too short for its content
**Verdict: DEFER_LARGE**

The AutoConfig QWizard can be shrunk until its combo boxes collapse. The reporter wants scroll bars. That means wrapping the page contents of five `.ui` forms in QScrollAreas, or adjusting their size policies, and checking the result on several platforms and DEs (the report is from KDE Wayland). This is UI layout rework, not a one-line defect; the wizard sets no size constraints in code.
- Evidence: `frontend/wizards/AutoConfig.cpp:~77-84` (QWizard ModernStyle, pages set, no size constraints); `frontend/forms/AutoConfig*.ui` (5 page forms).
- Related: none.

### [#12072](https://github.com/obsproject/obs-studio/issues/12072) — "Always on top" not applied to popped-out docks on launch
**Verdict: IMPLEMENT** (new-change, Windows)

The cause is the order of calls. In `OBSBasic::OBSInit`, `SetAlwaysOnTop(this, true)` runs before the saved dock layout is restored with `restoreState`. On Windows, `SetAlwaysOnTop` calls `SetWindowPos(HWND_TOPMOST)` on the main window. Win32 makes the windows a window currently owns topmost along with it, but floating docks created later by `restoreState` are not topmost. Toggling the option later works because by then the floating docks exist, which matches the report.
- Evidence: `frontend/widgets/OBSBasic.cpp:1056-1066` (always-on-top applied); `frontend/widgets/OBSBasic.cpp:1118-1127` (dock restoreState afterwards); `frontend/utility/platform-windows.cpp:183-188` (SetWindowPos HWND_TOPMOST on main HWND only); `frontend/widgets/OBSBasic_MainControls.cpp:496-501` (manual toggle re-applies and works).
- Related: none.
- **Slice plan:** in `frontend/widgets/OBSBasic.cpp`, right after the DockState `restoreState` block (~line 1127), add a Windows-only re-application: `#ifdef _WIN32 if (ui->actionAlwaysOnTop->isChecked()) SetAlwaysOnTop(this, true); #endif`. Do not move the original block, because on X11 `SetAlwaysOnTop` calls `setWindowFlags` + `show()` and must keep its current position. About 5 lines.
- Test plan: MSVC build on this Windows machine. Enable View > Always On Top, float a dock, restart OBS, and confirm the floating dock stays above other windows. If floating docks turn out not to be owned windows, re-applying topmost to `this` has no effect on them. Then the fallback is to call `SetAlwaysOnTop(dock, true)` on each floating `QDockWidget`. Check this during testing.

### [#12164](https://github.com/obsproject/obs-studio/pull/12164) — libobs/utils: Fix window selection behavior for window capture
**Verdict: DEFER_LARGE**

The goal is to make several Window Capture sources pick different windows when titles, classes and executables are identical. The PR applies, but the design is flawed:
1. It adds a process-global `DARRAY(HWND)` in libobs `window-helpers.c` with no locking, even though several plugins and threads call `ms_find_window`.
2. `ms_find_window` / `ms_find_window_top_level` record every result, including lookups from game-capture (`game-capture.c:1166`) and win-wasapi (`win-wasapi.cpp:860`). Those modules never call `remove_captured_window`, so their windows stay excluded for the life of the process and the list leaks.
3. It adds a new exported libobs symbol.

A correct fix needs a per-caller exclusion API (the caller passes the HWNDs to avoid), which is a design change across libobs and plugins.
- Evidence: PR diff `libobs/util/windows/window-helpers.c` (global `captured_windows`, `add_to_captured_list` in both find functions); `plugins/win-capture/game-capture.c:1166`, `plugins/win-wasapi/win-wasapi.cpp:860` (other callers that never remove); `plugins/win-capture/window-capture.c:632-634`.
- Related: upstream issue #12088.

### [#12176](https://github.com/obsproject/obs-studio/issues/12176) — Dock positions lost on exit/relaunch (macOS)
**Verdict: CANNOT_VERIFY**

On macOS 15, docks above the preview come back out of proportion after a restart. The init order is: restore geometry, then `show()` (on non-Windows, after always-on-top), then `restoreState`. Dock sizes may therefore be distributed against a window that is not yet at its final size on macOS. I can't pin this to a definite line without a macOS repro, and this box can't test macOS.
- Evidence: `frontend/widgets/OBSBasic.cpp:434-438` (restoreGeometry); `frontend/widgets/OBSBasic.cpp:1075-1078` (show() on non-Windows); `frontend/widgets/OBSBasic.cpp:1118-1127` (restoreState later); `frontend/widgets/OBSBasic.cpp:1751` (state saved at close).
- Related: #11001.
