# Upstream triage — batch frontend-ui-04

- Batch: frontend-ui-04 (area hint: frontend-ui)
- Items: 12941, 12988, 13091, 13097, 13139, 13177, 13187, 13213, 13260, 13278, 13323, 13357, 13363, 13381, 13385, 13394, 13397, 13403, 13404, 13414, 13421
- Date: 2026-10-26
- Base commit: 72e866557 (`git rev-parse --short master`)
- Method: item bodies from `notes/upstream-triage/data/all.json`; PR heads at `refs/upstream-pr/<N>`. No GitHub API or WebFetch was used for this batch.
- Note on applicability: the local git is 2.33, which has no `merge-tree --write-tree`, so every PR showed up as "CONFLICT" under that command. Applicability was re-checked with `git diff master...refs/upstream-pr/N | git apply --check`. Clean: 12988, 13097, 13139, 13177, 13357, 13363, 13381, 13397, 13404, 13414. Do not apply: 13187, 13213, 13260, 13323 (the cause is context drift, mostly the brace-style and Qt 6.10 cleanup commits on master).

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 12941 | issue | CANNOT_VERIFY |
| 12988 | PR | DEFER_LARGE |
| 13091 | issue | IMPLEMENT (new-change) |
| 13097 | PR | IMPLEMENT (partial-pr: ctype casts + log time format; no manifest) |
| 13139 | PR | IMPLEMENT (cherry-pick) |
| 13177 | PR | IMPLEMENT (new-change; PR has a copy/paste bug) |
| 13187 | PR | IMPLEMENT (new-change, minimal port) |
| 13213 | PR | DEFER_LARGE |
| 13260 | PR | IMPLEMENT (cherry-pick w/ conflict resolution) |
| 13278 | issue | IMPLEMENT (via #13381) |
| 13323 | PR | IMPLEMENT (cherry-pick w/ trivial rebase) |
| 13357 | PR | IMPLEMENT (cherry-pick) |
| 13363 | PR | DEFER_LARGE |
| 13381 | PR | IMPLEMENT (cherry-pick) |
| 13385 | issue | IMPLEMENT (new-change) |
| 13394 | issue | DEFER_LARGE |
| 13397 | PR | DEFER_LARGE |
| 13403 | issue | IMPLEMENT (via #13404) |
| 13404 | PR | IMPLEMENT (cherry-pick) |
| 13414 | PR | IMPLEMENT (cherry-pick) |
| 13421 | issue | DEFER_LARGE |

---

### [#12941](https://github.com/obsproject/obs-studio/issues/12941) — Some hotkeys get replaced with numbers

**Verdict: CANNOT_VERIFY**

Reasoning: On Arch Linux, binding `[` or `]` records `8` or `9`, and outside the OBS window only the digit triggers the hotkey. That fits a keyboard layout where `[`/`]` come from AltGr+8/9 (for example German): the hotkey edit stores the base key of the native keycode/keysym, and libobs has no AltGr / ISO_Level3 modifier, so it cannot represent "AltGr+8". The report does not give the keyboard layout, and the log cannot be fetched here, so the root cause is still a hypothesis. If it is confirmed, the fix is AltGr support in the libobs hotkey model, which is a design change and not a small slice.

Evidence:
- `frontend/settings/OBSHotkeyEdit.cpp:54`: the key comes from `obs_key_from_virtual_key(event->nativeVirtualKey())`, which is layout-level and not the produced character.
- `frontend/settings/OBSHotkeyEdit.cpp:38-44`: only Shift/Ctrl/Alt/Meta are treated as modifiers, with no AltGr.
- `libobs/obs-nix-x11.c:570`: the only Level3-ish key is `OBS_KEY_MODE_SWITCH`, and it is not a modifier.

Related: none.

---

### [#12988](https://github.com/obsproject/obs-studio/pull/12988) — frontend: Create new popup widgets

**Verdict: DEFER_LARGE**

Reasoning: This is a draft maintainer PR (Warchamp7) adding an Idian AbstractPopup framework plus Guide/Info/Tooltip widgets and an app-wide tooltip observer. It is about 1350 added lines across 22 files and is labeled "Seeking Testers". It is a UI framework feature, not a small slice.

Evidence:
- `git diff master...refs/upstream-pr/12988 --stat`: 22 files, +1348/-11 (`shared/qt/idian/components/AbstractPopup.cpp` alone is 450 lines).
- Draft, `kind/feature`, `area/ui-ux`.

Related: none.

---

### [#13091](https://github.com/obsproject/obs-studio/issues/13091) — Hotkey erroneously triggered when unrelated modifier key is pressed

**Verdict: IMPLEMENT (new-change)**

Reasoning: The defect is in `handle_binding`. Strict modifier matching is the default (`libobs/obs.c:1167`). With Ctrl+F1 held, tapping Alt makes `modifiers_match_` false, so the code jumps to `reset`, which releases the binding and sets `binding->modifiers_match=false`. When Alt is released, the next query fails the `!binding->modifiers_match` check, and `reset` sets `binding->modifiers_match = true`. The query after that sees modifiers matching and F1 still held, so it presses the binding again. Nothing records that the trigger key was never released. Upstream PR #13363 rewrites the whole function; this note recommends a narrower fix instead (see #13363 for why).

Evidence:
- `libobs/obs-hotkey.c:1035-1067`: `handle_binding` logic and the `reset:` path that restores `modifiers_match`.
- `libobs/obs-hotkey.c:993-1000`: `modifiers_match` uses strict equality when strict mode is on.
- `libobs/obs.c:1167`: `hotkeys->strict_modifiers = true`.
- `libobs/obs-internal.h` (`struct obs_hotkey_binding`): holds only `pressed` and `modifiers_match`.

Slice plan:
- Add a `bool wait_key_release` to `struct obs_hotkey_binding` in `libobs/obs-internal.h`. The struct is internal, so there is no ABI exposure.
- In `handle_binding`, when a currently `pressed` binding with a real key (`!modifiers_only`) is released because the modifiers stopped matching while `is_pressed(binding->key.key)` is still true, set `wait_key_release = true`.
- At the top of `handle_binding`, if `wait_key_release` is set: clear it once the key is no longer pressed; otherwise update `binding->modifiers_match = modifiers_match_` and return without pressing.
- This keeps current key-then-modifier ordering semantics (unlike #13363) and only blocks the re-trigger. About 15 lines.
- Test: MSVC build of libobs/obs-frontend on Windows. Manual check: bind Ctrl+F1 to start/stop recording, hold Ctrl+F1, tap Alt/Shift/Win, and confirm recording does not toggle. The hotkey thread needs a real platform context, so no cmocka coverage. Linux/macOS: UNTESTED.

Related: #13363.

---

### [#13097](https://github.com/obsproject/obs-studio/pull/13097) — frontend, libobs: Base work for localization and utf-8

**Verdict: IMPLEMENT (partial-pr)**

Reasoning: The PR has three independent commits.
1. `efdd7b86c` casts ctype arguments to `unsigned char`. Passing a negative `char` (UTF-8 bytes >= 0x80) to `isdigit`/`toupper` is undefined behavior and asserts in the MSVC debug CRT. This is a clear correctness fix.
2. `fad011f97` replaces the locale-dependent `%X` in log and crash-log headers with `%H:%M:%S`, which makes the format deterministic. Small and harmless.
3. `017c69a14` sets the process-wide UTF-8 active code page in `obs.manifest`. That changes ANSI API behavior for every third-party plugin loaded into the process, so it is a policy decision for maintainers and is excluded.
The PR applies cleanly to master (`git apply --check`). Side effect to note: the unsigned compare in `astrcmpi`/`strref_cmp*` changes ordering for non-ASCII bytes. They now sort after ASCII, which is the conventional byte order.

Evidence:
- `libobs/util/dstr.c` `astrcmpi`/`astrcmpi_n`: `toupper(*str1)` called on plain `char`.
- `libobs/util/lexer.c` `strref_cmpi*`: same pattern.
- `frontend/OBSApp_Themes.cpp` (`ParseThemeVariables` / `ParseMathVariable`): `isdigit(*ch)` / `isspace(*ch)` on theme file bytes.
- `frontend/OBSApp.cpp` `CurrentDateTimeString`: `"%Y-%m-%d, %X"`.

Slice plan:
- `git cherry-pick -x efdd7b86c fad011f97` (author Dankirk preserved; GPL-2.0-or-later contribution). Skip `017c69a14`.
- Files: libobs/util/{dstr.c,lexer.c,cf-lexer.c}, frontend/OBSApp_Themes.cpp, plugins/text-freetype2/find-font.c, frontend/OBSApp.cpp, libobs/obs-win-crash-handler.c. Do not take the obs.h doc hunk that refers to the manifest. About 45 lines.
- Test: MSVC build. cmocka `test/cmocka` covers dstr; run the existing tests and add a quick check that `astrcmpi("\xC3\xA9", "\xC3\xA9") == 0`, if feasible.

Related: #13260 (touches the same ParseMathVariable function; both can apply).

---

### [#13139](https://github.com/obsproject/obs-studio/pull/13139) — frontend: Add stay-on-top in the LogViewer window

**Verdict: IMPLEMENT (cherry-pick-pr)**

Reasoning: This is a small opt-in feature with an obvious placement: a checkbox next to "Show on startup" in the Log Viewer, persisted in user.ini `[LogViewer] OnTop`. The checkbox is hidden on Wayland, where stay-on-top is not supported. The PR is 50 lines and applies cleanly. One minor gap: if `OnTop` is set in config, the window flag is applied even on Wayland. This is harmless but could be guarded with `has_stay_on_top_support()` while picking.

Evidence:
- `frontend/dialogs/OBSLogViewer.cpp`: the constructor already persists `ShowLogStartup` the same way.
- `frontend/data/locale/en-US.ini`: no existing bare `AlwaysOnTop` key (only `Basic.MainMenu.View.AlwaysOnTop` at line 871), so the new key does not collide.
- `git diff master...refs/upstream-pr/13139 --stat`: 4 files, +50.

Slice plan:
- `git cherry-pick -x 1f94e9631 de3ca2d2c` (author psyirius). Optionally gate `if (alwaysOnTop)` with `has_stay_on_top_support()`.
- Test: MSVC build and manual GUI check on Windows (toggle the checkbox, reopen the viewer). Wayland path: UNTESTED.

Related: none.

---

### [#13177](https://github.com/obsproject/obs-studio/pull/13177) — frontend: Fix the UI color for estimated memory values

**Verdict: IMPLEMENT (new-change, based on PR idea)**

Reasoning: The bug is real. Both replay-buffer estimate labels get `setProperty("class", "text-warning")` when the estimate exceeds the maximum, and nothing ever clears it, so the label stays orange after the value drops back under the limit. `setObjectName("")` does not reset the class. The PR fixes this, but it has a copy/paste bug: in `SimpleReplayBufferChanged` it calls `idian::Utils::removeClass/addClass` on `ui->advRBEstimate` instead of `ui->simpleRBEstimate`, so Simple mode would still be wrong. Write a corrected minimal change instead of cherry-picking.

Evidence:
- `frontend/settings/OBSBasicSettings.cpp:5167-5182`: simple mode sets `text-warning` and never removes it.
- `frontend/settings/OBSBasicSettings.cpp:5268-5289`: advanced mode has the same pattern.
- `shared/qt/idian/include/Idian/Utils.hpp:55-61`: `addClass`, `removeClass` and `toggleClass(widget, class, bool)` are available. Idian Utils is already used in frontend (for example `frontend/widgets/AudioMixer.cpp`).
- PR diff: `idian::Utils::removeClass(ui->advRBEstimate, ...)` inside `SimpleReplayBufferChanged` (the wrong widget).

Slice plan:
- `#include <Idian/Utils.hpp>` in OBSBasicSettings.cpp.
- In both functions, replace the `setProperty("class","text-warning")` line with `idian::Utils::toggleClass(<label>, "text-warning", streamQuality/varRateControl && memMB > memMaxMB)`, evaluated on every call. This also clears the class in the "unknown" branch. Keep the existing `polish` call, or rely on toggleClass if it repolishes. About 10 lines.
- Credit hre0 / PR #13177 in the commit message as the source of the idea.
- Test: MSVC build. Manual check: Settings > Output > Replay Buffer, raise the max time until it turns orange, then lower it and confirm it returns to normal in both Simple and Advanced modes.

Related: upstream issue #13171 (not in this batch).

---

### [#13187](https://github.com/obsproject/obs-studio/pull/13187) — frontend: Fix user config subfolder creation

**Verdict: IMPLEMENT (new-change, minimal port of PR)**

Reasoning: global.ini `[Locations] Configuration` can point to any existing folder (`std::filesystem::exists` check). `InitUserConfig` then opens `<loc>/obs-studio/user.ini` with `CONFIG_OPEN_ALWAYS` without making sure `<loc>/obs-studio` exists. `MakeUserDirs()` only creates subfolders under the default AppConfig path. The open fails, AppInit throws, and OBS exits. The PR restructures InitGlobalConfig/InitUserConfig and no longer applies, but the minimal fix is a few lines.

Evidence:
- `frontend/OBSApp.cpp:613-616`: `userConfigLocation` is taken if it exists.
- `frontend/OBSApp.cpp:638-646`: `InitUserConfig` opens `/obs-studio/user.ini` without creating the directory.
- `frontend/OBSApp.cpp:434-470`: `MakeUserDirs` uses `GetAppConfigPath` (the default location) only.
- `git apply --check` of the PR fails at `frontend/OBSApp.cpp:1055`.

Slice plan:
- At the start of `OBSApp::InitUserConfig`, `std::error_code ec; std::filesystem::create_directories(userConfigLocation / "obs-studio", ec);`. If `ec` is set, log `LOG_ERROR` and return false. About 8 lines in `frontend/OBSApp.cpp`.
- Credit Warchamp7 / PR #13187.
- Test: MSVC build. Manual check: set `Configuration=C:\tmp\obscfg` (existing, empty) in global.ini, launch, and confirm `C:\tmp\obscfg\obs-studio\user.ini` is created and OBS starts.

Related: none.

---

### [#13213](https://github.com/obsproject/obs-studio/pull/13213) — frontend: Add auto light/dark theme switching support

**Verdict: DEFER_LARGE**

Reasoning: This is a draft feature with new settings UI (a Match System mode plus separate light and dark theme pickers), a new watcher class and a new config. It is enabled by default, and the author asks for consensus. It is about 240 lines across 12 files and no longer applies (`OBSApp.hpp`, `OBSBasicSettings.ui`). It is a UX decision for maintainers. The existing `themeWatcher` on master is a QFileSystemWatcher for theme files and has nothing to do with OS color scheme.

Evidence:
- `git diff --stat`: 12 files, +239/-15. `git apply --check` fails.
- `frontend/OBSApp.hpp:119`: `QPointer<QFileSystemWatcher> themeWatcher` (file watcher only). No `Qt::ColorScheme` usage in frontend.

Related: none.

---

### [#13260](https://github.com/obsproject/obs-studio/pull/13260) — frontend: Cleanup some theme variable handling

**Verdict: IMPLEMENT (cherry-pick-pr with conflict resolution)**

Reasoning: The PR fixes a stack overflow crash at startup (EvalMath and ParseMathVariable recursing into each other), confirmed with a WinDbg dump. The defect is visible on master:
- `ParseMathVariable` calls `EvalMath(..., recursion+1)` but then calls `ParseMathVariable(vars, val)`, which resets recursion to 0.
- `EvalMath` calls `ParseMathVariable(vars, args[i], 0)`, which also resets to 0.
Together the depth guard never fires for cyclic calc() variables. In addition, `EvalMath` reads `args[1]` before the `args.length() != 3` check, which is an out-of-range access, and `ResolveVariable` reads `vars[key]` before checking `contains`. The PR touches one file (about 70 lines). It fails `git apply` only because master's brace-style commit (`30b63c684`) changed context.

Evidence:
- `frontend/OBSApp_Themes.cpp:608-609`: `EvalMath(..., recursion + 1)` followed by `ParseMathVariable(vars, val)`, where recursion is dropped.
- `frontend/OBSApp_Themes.cpp:657-658`: `ParseMathVariable(vars, args[0], 0)` / `args[2], 0`.
- `frontend/OBSApp_Themes.cpp:636-637` then `:648`: `args[1]` used before the length check.
- `frontend/OBSApp_Themes.cpp:552-572`: `ResolveVariable` loops on `vars[key]` before `contains(key)`.

Slice plan:
- Cherry-pick `769ea6023 3687f791c b9533ee85 a02fdc350` with `-x` (author Warchamp7). Resolve conflicts by adapting to the braced style on master. The `std::optional<QString>` return needs `<optional>`; check that the include is present.
- Test: MSVC build. Manual check: create a user theme `.ovt` with cyclic `calc()` variables and confirm OBS logs "Maximum recursion levels hit!" and starts instead of overflowing the stack. Also confirm the stock themes render the same as before.

Related: #13097 (adjacent ctype edits in the same file).

---

### [#13278](https://github.com/obsproject/obs-studio/issues/13278) — OBS Dock size issue

**Verdict: IMPLEMENT (via PR #13381)**

Reasoning: The issue is confirmed upstream (`issue/confirmed`). Dock sizes are lost when OBS was closed maximized and dynamically added docks (stats or browser) are present. The cause is QTBUG-46620: `restoreGeometry` in a maximized state followed by `restoreState` while the window does not yet have its maximized size. Maintainer PR #13381 adds the documented workaround.

Evidence:
- `frontend/widgets/OBSBasic.cpp:435-447`: `restoreGeometry` on the saved geometry.
- `frontend/widgets/OBSBasic.cpp:1119-1127`: `restoreState(dockState)` later in OBSInit.

Slice plan: see #13381.

Related: #13381.

---

### [#13323](https://github.com/obsproject/obs-studio/pull/13323) — frontend: call setDesktopFileName earlier

**Verdict: IMPLEMENT (cherry-pick-pr, trivial rebase)**

Reasoning: Qt 6.10.1+ registers the D-Bus app ID during QGuiApplication construction when not sandboxed, so the desktop file name has to be set before the `OBSApp` constructor runs. Master still calls `setDesktopFileName` at the end of the OBSApp constructor. Master now requires Qt >= 6.10 (commit `0c2f09a1e`), so the condition always holds. The change moves one line. The patch fails only because of context drift.

Evidence:
- `frontend/OBSApp.cpp:1008`: `setDesktopFileName("com.obsproject.Studio");` inside the constructor.
- `frontend/obs-main.cpp:501-504`: pre-construction static Qt setup (`setHighDpiScaleFactorRoundingPolicy`, `addLibraryPath`).
- `frontend/obs-main.cpp:534`: `OBSApp program(argc, argv, ...)`.

Slice plan:
- Remove the line at `frontend/OBSApp.cpp:1008`. Add `QGuiApplication::setDesktopFileName("com.obsproject.Studio");` in `run_program` before `OBSApp program(...)` (after line 501). Use `cherry-pick -x ff3c8ad41` and fix the context (author leia-uwu).
- Test: MSVC build only (setDesktopFileName has no effect on Windows). The Linux portal behavior is UNTESTED.

Related: none.

---

### [#13357](https://github.com/obsproject/obs-studio/pull/13357) — fix: Supress a Settings UI Streching

**Verdict: IMPLEMENT (cherry-pick-pr)**

Reasoning: A one-line `.ui` change. `advStreamTrackWidget` (a QStackedWidget holding the audio track radio buttons) has `vsizetype=Preferred`, so it stretches vertically in a tall Settings window. Setting it to `Fixed` stops that. The PR applies cleanly.

Evidence:
- `frontend/forms/OBSBasicSettings.ui:3285-3288`: `advStreamTrackWidget` sizePolicy `hsizetype="Maximum" vsizetype="Preferred"`.

Slice plan:
- `git cherry-pick -x 60e2ae2b0` (author suogesi).
- Test: MSVC build. Manual check: Settings > Output (Advanced) > Streaming, maximize the window, and confirm the track selector does not stretch.

Related: upstream issue #13286 (not in this batch).

---

### [#13363](https://github.com/obsproject/obs-studio/pull/13363) — Fix: Behavior of hotkeys more like other apps now

**Verdict: DEFER_LARGE**

Reasoning: The PR rewrites `handle_binding` and changes hotkey semantics globally: modifiers must now be pressed before the key, which is a behavior change that needs a maintainer decision. Review also found two regressions:
1. `if (no_press) return;` at the top of `handle_binding` skips releasing already-pressed bindings while presses are suppressed (focus or "no_press" mode), so push-to-talk and similar bindings could stick. Current code still releases in that state.
2. In `inject_hotkey`, the arguments to the new `input_match_modifiers(input, hotkey, strict)` are swapped (`binding->key.modifiers` is passed as the input), which reverses the non-strict subset check.
A narrower fix for #13091 is planned instead (see that item).

Evidence:
- PR diff of `libobs/obs-hotkey.c`: `handle_binding` begins with `if (no_press) return;`, and `inject_hotkey` calls `input_match_modifiers(binding->key.modifiers, event->hotkey.modifiers, ...)`.
- Master `libobs/obs-hotkey.c:1056-1067`: `no_press` only blocks `press_released_binding`; the reset/release path still runs.

Related: #13091.

---

### [#13381](https://github.com/obsproject/obs-studio/pull/13381) — frontend: Fix wrong dock sizes at startup

**Verdict: IMPLEMENT (cherry-pick-pr)**

Reasoning: A 6-line maintainer workaround for QTBUG-46620. If the restored window is maximized, it calls `setGeometry(screen()->availableGeometry())` right after the geometry restore, so the later `restoreState` sees the correct size. It is still a draft upstream, but it is self-contained and applies cleanly.

Evidence:
- `frontend/widgets/OBSBasic.cpp:435-458`: the geometry restore and stats dock positioning block where the workaround is inserted.
- `frontend/widgets/OBSBasic.cpp:1119-1127`: the later `restoreState`.

Slice plan:
- `git cherry-pick -x f4ce962e4` (author Warchamp7).
- Test: MSVC build. Manual check on Windows: enable the stats dock, resize docks, close OBS while maximized, relaunch, and confirm sizes persist. Linux: UNTESTED.

Related: #13278.

---

### [#13385](https://github.com/obsproject/obs-studio/issues/13385) — Hotkey using "Alt + C" or "Alt + O" is unable to be set in UI

**Verdict: IMPLEMENT (new-change)**

Reasoning: On KDE, the platform theme adds mnemonics to the QDialogButtonBox standard buttons (`&OK`, `&Cancel`). Qt checks shortcuts before delivering a KeyPress: it sends `QEvent::ShortcutOverride` to the focus widget, and if the widget does not accept it, the mnemonic fires. `OBSHotkeyEdit` overrides only `keyPressEvent`, `keyReleaseEvent` and `mousePressEvent`, and never accepts ShortcutOverride. Alt+C therefore activates Cancel and Alt+O activates OK. The fix is to accept ShortcutOverride while the hotkey edit has focus.

Evidence:
- `frontend/settings/OBSHotkeyEdit.hpp:79-83`: only key and mouse handlers; no `event()` or ShortcutOverride handling.
- `frontend/forms/OBSBasicSettings.ui:8790-8792`: QDialogButtonBox with standard Ok/Cancel/Apply (the platform theme adds mnemonics).

Slice plan:
- In `OBSHotkeyEdit`, add `bool event(QEvent *e) override` (or handle it in an event filter). If `e->type() == QEvent::ShortcutOverride`, call `e->accept()` and return true; otherwise return `QLineEdit::event(e)`. The key then reaches `keyPressEvent` as normal. About 12 lines in `frontend/settings/OBSHotkeyEdit.{hpp,cpp}`.
- This also stops other app shortcuts (for example Ctrl+Z) from firing while a hotkey is being captured, which is the desired behavior.
- Test: MSVC build. Manual check on Windows: give a button a mnemonic, or use the main window's Alt menu accelerators, and confirm Alt+letter is captured as a hotkey. The KDE-specific path is UNTESTED.

Related: none.

---

### [#13394](https://github.com/obsproject/obs-studio/issues/13394) — Migrate string-based exceptions during initialization to localized error codes/types

**Verdict: DEFER_LARGE**

Reasoning: This is valid tech debt filed by a maintainer, but the request is for a designed exception hierarchy with localized messages, following the new CODESTYLE. Master has about 30 `throw "..."` sites across OBSApp, OBSBasic, PluginManager and Simple/AdvancedOutput, all caught as `const char *` in `run_program`. A design is needed first, including how to localize "Failed to load locale" itself, plus new locale strings, so there is no small self-contained slice.

Evidence:
- `frontend/OBSApp.cpp:1133,1136,1139,1142,1184,1731,1736`: string throws during init.
- `frontend/widgets/OBSBasic.cpp:879-895`, `frontend/plugin-manager/PluginManager.cpp:93`, `frontend/utility/{Simple,Advanced}Output.cpp`: more throw sites.
- `frontend/obs-main.cpp:693-696`: `catch (const char *error)` followed by `OBSErrorBox`.

Related: none.

---

### [#13397](https://github.com/obsproject/obs-studio/pull/13397) — libobs, frontend: Add functions to save json with defaults

**Verdict: DEFER_LARGE**

Reasoning: The code is small (+92 lines, applies cleanly), but it changes the scene collection persistence format: default values get written into every saved source. Once saved, later changes to plugin defaults no longer reach existing sources, files get larger, and every scene collection is affected on its next save. It also adds three new exported libobs APIs. It continues an earlier PR (#10693) that was not merged. This is a data-format and API policy decision for maintainers, not a bug fix.

Evidence:
- PR diff of `frontend/widgets/OBSBasic_SceneCollections.cpp`: `OBSBasic::Save` and export switch to `obs_data_save_json_pretty_safe_with_defaults`.
- PR diff of `libobs/obs-data.h`: three new `EXPORT` functions. Master already has `obs_data_get_json_pretty_with_defaults` (`libobs/obs-data.h:70`).

Related: none.

---

### [#13403](https://github.com/obsproject/obs-studio/issues/13403) — Prevent loading Mouse1/Mouse2 as hotkeys

**Verdict: IMPLEMENT (via PR #13404)**

Reasoning: The UI refuses Left/Right mouse buttons as hotkeys, but libobs loads them from JSON (or from `obs_hotkey_load_bindings` called by a plugin) without checks. `create_binding` is the shared point for both load paths, so the guard belongs there. Separately, `load_binding` has a real bug: `if (!modifiers && ...)` tests the pointer `modifiers` (always non-null) instead of `*modifiers`, so the empty or invalid key check never runs.

Evidence:
- `frontend/settings/OBSHotkeyEdit.cpp:91-102`: the UI ignores `Qt::LeftButton` and `Qt::RightButton`.
- `libobs/obs-hotkey.c:458-467`: `create_binding` has no validation.
- `libobs/obs-hotkey.c:476-485`: `uint32_t *modifiers = &combo.modifiers; ... if (!modifiers && ...)` is a pointer test (bug).
- `libobs/obs-hotkey.c:502-516`: `obs_hotkey_load_bindings` also goes through `create_binding`.

Slice plan: see #13404.

Related: #13404.

---

### [#13404](https://github.com/obsproject/obs-studio/pull/13404) — libobs: Reject hotkey bindings on Mouse1/Mouse2

**Verdict: IMPLEMENT (cherry-pick-pr)**

Reasoning: The PR adds `valid_binding()` (rejects out-of-range keys, empty combos and MOUSE1/MOUSE2) to `create_binding` and fixes the `!modifiers` to `!*modifiers` pointer bug. It is 15 lines in one file and applies cleanly. Rejecting empty combos in `obs_hotkey_load_bindings` is safe because the frontend already filters empty combos before calling it.

Evidence:
- `libobs/obs-hotkey.c:458-485` (see #13403).
- `frontend/settings/OBSHotkeyWidget.cpp:61,81`: the frontend only passes non-empty combos to `obs_hotkey_load_bindings`.

Slice plan:
- `git cherry-pick -x ba1dda96f` (author mbokinala).
- Test: MSVC build. Manual check: add `"libobs.mute": [{"key": "OBS_KEY_MOUSE1"}]` to a scene collection JSON, launch, and confirm the binding is not loaded or shown, while Mouse3 still works. A cmocka test is possible only if the hotkey subsystem can start headless. Otherwise mark UNTESTED for runtime.

Related: #13403.

---

### [#13414](https://github.com/obsproject/obs-studio/pull/13414) — frontend: Handle stuck upload dialog for crash logs

**Verdict: IMPLEMENT (cherry-pick-pr)**

Reasoning: `CrashHandler::uploadCrashLogToServer` returns early when the crash log is empty or unreadable, without emitting a signal. `LogUploadDialog` waits for `logUploadFinished` or `logUploadFailed` (relayed in OBSApp), so it spins forever. The one-line fix emits `crashLogUploadFailed` with the existing localized `LogUploadDialog.Errors.NoLogFile` string. It applies cleanly.

Evidence:
- `frontend/utility/CrashHandler.cpp:288-291`: early `return` with only a `blog` call.
- `frontend/utility/CrashHandler.hpp:94`: the `crashLogUploadFailed(const QString &)` signal exists.
- `frontend/OBSApp.cpp:1360-1363`: relays it to `logUploadFailed(LogFileType::CrashLog, ...)`, which the dialog handles.
- `frontend/data/locale/en-US.ini:483`: `LogUploadDialog.Errors.NoLogFile` exists.

Slice plan:
- `git cherry-pick -x 8f224ca01` (author rue08).
- Test: MSVC build. Manual check on Windows: empty the newest file in `%APPDATA%\obs-studio\crashes`, then Help > Crash Reports > Upload Last Crash Report, and confirm the error state appears instead of an endless spinner.

Related: upstream issue #13401 (not in this batch).

---

### [#13421](https://github.com/obsproject/obs-studio/issues/13421) — Improve clipboard management / Add proper MIME data serialization/handling

**Verdict: DEFER_LARGE**

Reasoning: This is an architecture task opened by a maintainer. It replaces the ad-hoc clipboard structs in OBSBasic (which hold raw source pointers) with a clipboard service and a MIME serialization layer, and calls for a strong grasp of code architecture. That is a large redesign, not a small slice.

Evidence:
- `frontend/widgets/OBSBasic.hpp`: clipboard/copy state members (copied source weak refs, filter and transform copy flags) referenced by the issue.

Related: none.
