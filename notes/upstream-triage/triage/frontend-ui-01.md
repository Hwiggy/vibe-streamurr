# Triage batch frontend-ui-01

- Batch: frontend-ui-01 (area hint: frontend-ui)
- Items: 3647, 4555, 5083, 5597, 7360, 7924, 8120, 8160, 8998, 9036, 9155, 9558, 9629, 9749, 9860, 9938, 9947, 10147, 10228, 10390, 10525
- Date: 2026-10-26
- Base commit: master @ 72e866557
- Method: I read the item bodies from `notes/upstream-triage/data/all.json` and checked them against the code with grep and read. I fetched one comment thread (#7360). PR heads come from `refs/upstream-pr/N`. The local git is 2.33, which has no `merge-tree --write-tree`, so I checked whether PRs apply with `git diff master...ref | git apply --check`.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 3647 | issue | CANNOT_VERIFY |
| 4555 | issue | CANNOT_VERIFY |
| 5083 | issue | CANNOT_VERIFY |
| 5597 | issue | DEFER_LARGE |
| 7360 | issue | CANNOT_VERIFY |
| 7924 | PR | IMPLEMENT (partial-pr, reworked) |
| 8120 | issue | IMPLEMENT |
| 8160 | issue | CANNOT_VERIFY |
| 8998 | issue | CANNOT_VERIFY |
| 9036 | issue | CANNOT_VERIFY |
| 9155 | issue | IMPLEMENT (partial: menus/popups only) |
| 9558 | issue | IMPLEMENT |
| 9629 | PR | DEFER_LARGE |
| 9749 | issue | CANNOT_VERIFY |
| 9860 | issue | IMPLEMENT |
| 9938 | issue | CANNOT_VERIFY |
| 9947 | issue | CANNOT_VERIFY |
| 10147 | issue | IMPLEMENT (tooltip disclosure) |
| 10228 | issue | CANNOT_VERIFY |
| 10390 | issue | CANNOT_VERIFY |
| 10525 | issue | CANNOT_VERIFY |

---

### [#3647](https://github.com/obsproject/obs-studio/issues/3647) — Hotkeys disappears

**Verdict:** CANNOT_VERIFY

**Reasoning:** The report says show/hide hotkeys for a scene item are lost after a restart once the item is inside a group, and the item is then missing from the Hotkeys list. The issue is labelled confirmed, but it was filed against 26.0.2, and I could not find the defect by reading the current code. The paths all look consistent:
- Item hotkeys are registered against the owning scene or group source and read from that source's `context.hotkey_data`.
- When an item moves into a group, its bindings are re-registered under the group.
- The Hotkeys page sorts group sources into the "sources" bucket by name, so they should still be listed.

Finding the cause needs a repro on a current build.

**Evidence:**
- `libobs/obs-scene.c:2179-2221`: `init_hotkeys` registers `libobs.show_scene_item.<id>` on `scene->source` and reads bindings from that source's `context.hotkey_data`.
- `libobs/obs-scene.c:2343-2344`: items in private scenes get no hotkeys at all.
- `libobs/obs-scene.c:3841-3851, 3909-3910`: `obs_sceneitem_move_hotkeys` moves bindings into a group when items are reordered into it.
- `frontend/settings/OBSBasicSettings.cpp:2863-2877`: `HandleSource` buckets a group (where `obs_scene_from_source` returns NULL) under "sources".
- `frontend/widgets/OBSBasic_SceneCollections.cpp:884, 1223`: groups are saved and loaded through a separate "groups" array.

**Related:** #9558 (also a group-handling bug)

---

### [#4555](https://github.com/obsproject/obs-studio/issues/4555) — Group in Studio Mode not in right position when start up

**Verdict:** CANNOT_VERIFY

**Reasoning:** A group whose children use a non-default positional alignment lands in a different place after a restart in Studio Mode. Group bounds are recomputed from the children's transforms (`remove_group_transform` and the group-resize logic in obs-scene.c). From reading the code I cannot tell which load-order or alignment step is wrong, and the reporter says one part of the problem cannot be reproduced. This needs a repro and debugging; I found no defect I could point to.

**Evidence:**
- `libobs/obs-scene.c:3889-3893`: `remove_group_transform` is applied during reorder. Group transforms are rebuilt from child state, and that is where any defect would be.

**Related:** #3647, #9558

---

### [#5083](https://github.com/obsproject/obs-studio/issues/5083) — Saved Program projector shows only gray when studio mode is off at startup

**Verdict:** CANNOT_VERIFY

**Reasoning:** A saved StudioProgram projector opens with a NULL source and renders through `obs_render_main_texture()` whatever the Studio Mode state is. Saved projectors are loaded in the scene-collection load, after `SetPreviewProgramMode` has been applied in `OBSInit`. Nothing in the projector render path depends on Studio Mode for this projector type, so I cannot explain a gray frame from the code. The issue has 25 comments and may be timing or display related on the reporter's GPU.

**Evidence:**
- `frontend/widgets/OBSProjector.cpp:159-210`: `OBSRender` falls back to `obs_render_main_texture()` when there is no source. Only the `Preview` type branches on `IsPreviewProgramMode()`.
- `frontend/widgets/OBSBasic_Projectors.cpp:239-274`: `OpenSavedProjector` opens non-source types with a nullptr source.
- `frontend/widgets/OBSBasic_SceneCollections.cpp:1399-1408`: saved projectors are loaded at the end of collection load.
- `frontend/widgets/OBSBasic.cpp:960-964`: Studio Mode is applied during `OBSInit`.

**Related:** none

---

### [#5597](https://github.com/obsproject/obs-studio/issues/5597) — Revision of the interface for configuring shortcut keys — make it more accessible

**Verdict:** DEFER_LARGE

**Reasoning:** This asks for a redesign of how the Hotkeys settings page behaves with screen readers (NVDA). `OBSHotkeyEdit` is a `QLineEdit` that captures any key press as the binding, so screen-reader key commands are easily captured as hotkeys by accident. Fixing that properly needs a new interaction model, for example an explicit "record" button or mode plus accessible labelling. That is a UX design decision, not a small slice.

**Evidence:**
- `frontend/settings/OBSHotkeyEdit.hpp:39`: `class OBSHotkeyEdit : public QLineEdit`, which captures keys whenever it has focus.
- `frontend/settings/OBSBasicSettings_A11y.cpp` exists, but it covers colour accessibility, not screen-reader interaction with hotkeys.

**Related:** #7924 (hotkey and focus interaction)

---

### [#7360](https://github.com/obsproject/obs-studio/issues/7360) — Letter 'a' is missing at the end

**Verdict:** CANNOT_VERIFY

**Reasoning:** I fetched the thread (one WebFetch). The maintainer (RytoEX) concluded this is theme padding and layout combined with display scaling, not a translation or code bug. The issue does not name which widget is affected, the screenshots cannot be read here, and the themes have been reworked since 2022. I cannot point at a specific stylesheet rule to change.

**Evidence:**
- Thread: the maintainer calls it "an issue in the theme that is exacerbated by display scaling". The reporter says the older theme did not show the problem.
- Translations are managed through Crowdin (`frontend/data/locale/*.ini`), and the string itself is correct.

**Related:** #8160, #9947 (scaling and layout)

---

### [#7924](https://github.com/obsproject/obs-studio/pull/7924) — frontend: Disable hotkeys when typing or in modal dialog

**Verdict:** IMPLEMENT (partial-pr, reworked)

**Reasoning:** This is a real, long-standing bug: hotkeys fire while the user types in text fields (upstream #7824). The PR is small: 48 added and 4 removed lines across 3 files, under GPL-2.0-or-later. It connects `QApplication::focusChanged` and suppresses hotkeys while focus is in a `QLineEdit`, `QTextEdit`, `QPlainTextEdit`, `QSpinBox` or `QDoubleSpinBox`, or inside a modal window.

It no longer applies cleanly: `git apply --check` fails on `frontend/OBSApp.cpp` and `frontend/OBSApp.hpp` because of context drift. It also has a design flaw against current master. It drives `DisableHotkeys()` and `UpdateHotkeyFocusSetting()`, which overwrite the `enableHotkeysInFocus` and `enableHotkeysOutOfFocus` flags. `OBSBasicSourceSelect` is non-modal (`show()`, not `exec()`) and calls `DisableHotkeys()` explicitly. With the PR, moving focus inside that dialog to a non-editable widget would call `UpdateHotkeyFocusSetting()` and turn hotkeys back on while the dialog is still open.

**Evidence:**
- `frontend/OBSApp.cpp:1230-1258`: `ResetHotkeyState`, `UpdateHotkeyFocusSetting` and `DisableHotkeys` all mutate the same two flags.
- `frontend/OBSApp.cpp:1356-1358`: the existing `applicationStateChanged` hookup, which is where the new connect goes.
- `frontend/dialogs/OBSBasicSourceSelect.cpp:288, 293`: explicit `DisableHotkeys` in the constructor and `UpdateHotkeyFocusSetting` in the destructor.
- `frontend/widgets/OBSBasic_SceneItems.cpp:830-831`: the source-select dialog is shown non-modal.
- `frontend/widgets/OBSBasic_MainControls.cpp:217-218`: Settings is `exec()`'d, so it is modal and covered by the PR's `isModal()` check.
- `frontend/settings/OBSBasicSettings.cpp:909, 944`: the explicit Disable and Update calls that the PR removes.
- `frontend/settings/OBSHotkeyEdit.hpp:39`: `OBSHotkeyEdit` is a `QLineEdit`, so hotkeys are also suppressed while a binding is being captured, which is correct.

**Related:** #5597, #9749

**Slice plan:**
1. Take the PR's `IsWidgetEditable()` helper and the `focusChanged` hookup (credit cg2121 with a `Co-authored-by` line or keep the original authorship).
2. Instead of calling `DisableHotkeys()` and `UpdateHotkeyFocusSetting()`, add a separate `bool hotkeysSuppressedByFocus` member. Make `ResetHotkeyState` compute `enabled && !hotkeysSuppressedByFocus`. In `WidgetFocusChanged`, set the member and call `ResetHotkeyState(applicationState()==Qt::ApplicationActive)`. This leaves explicit `DisableHotkeys()` callers such as SourceSelect working on their own.
3. Keep the explicit `DisableHotkeys` and `UpdateHotkeyFocusSetting` calls in `OBSBasicSettings`, or drop them as the PR does, since the modal check covers Settings. Keeping them is the safer choice.

Estimated size: about 50 lines in `frontend/OBSApp.cpp` and `frontend/OBSApp.hpp`.

---

### [#8120](https://github.com/obsproject/obs-studio/issues/8120) — VST Settings are not preserved properly

**Verdict:** IMPLEMENT

**Reasoning:** The defect is clear in the code. `vst_save` stores `chunk_hash`, the MD5 of the plugin binary. `vst_update` restores the saved chunk only when that MD5 still matches, or when no hash was stored. Any plugin update changes the binary, so the user's saved state is silently thrown away. The VST2 `AEffect::uniqueID` identifies the plugin across versions, so it is the right identity check. `setChunk` already refuses parameter-array data whose length does not match `numParams`, so loading an older param blob into a newer plugin is safe. Chunk-based plugins are expected to handle their own version migration.

**Evidence:**
- `plugins/obs-vst/obs-vst.cpp:72-83`: `getFileMD5`.
- `plugins/obs-vst/obs-vst.cpp:122-129`: the restore is gated on the MD5 match.
- `plugins/obs-vst/obs-vst.cpp:141-145`: `vst_save` writes `chunk_hash`.
- `plugins/obs-vst/vst_header/aeffectx.h:289`: `int32_t uniqueID` in `AEffect`.
- `plugins/obs-vst/VSTPlugin.cpp:136-158`: `loadEffectFromPath` sets `effect` synchronously, so the unique ID is available right after it.
- `plugins/obs-vst/VSTPlugin.cpp:395-401`: the parameter-count guard in `setChunk`.

**Related:** none

**Slice plan:**
1. Add `int32_t VSTPlugin::getEffectUniqueID()`, which returns `effect ? effect->uniqueID : 0`.
2. In `vst_save`, also write `obs_data_set_int(settings, "chunk_unique_id", id)`.
3. In `vst_update`, if the saved `chunk_unique_id` is non-zero and equals the loaded effect's `uniqueID`, restore the chunk even when the MD5 differs. Otherwise keep the existing MD5 logic, so old saves without the new key behave as before.

Files: `plugins/obs-vst/obs-vst.cpp`, `plugins/obs-vst/VSTPlugin.cpp`, `plugins/obs-vst/headers/VSTPlugin.h`. Estimated size: about 20 lines. Build-test obs-vst with MSVC. A runtime test needs a VST2 plugin and two versions of it; if none is available, mark it UNTESTED.

---

### [#8160](https://github.com/obsproject/obs-studio/issues/8160) — 4k Displays messes with the UI interface and popups

**Verdict:** CANNOT_VERIFY

**Reasoning:** Button text is clipped and context menus are truncated after the window is dragged to a 4K monitor. This is a mixed-DPI and Qt scaling behaviour on Windows 11 that has not been tied to any OBS code path. Themes and the Qt version have changed a lot since 29.0. It needs a repro on current builds with specific monitor scaling settings.

**Evidence:** No OBS code overrides per-monitor DPI handling for menus; that is left to Qt. The OBS-side layout lives in the theme files `frontend/data/themes/*.obt`.

**Related:** #7360, #9947, #10525, #8998

---

### [#8998](https://github.com/obsproject/obs-studio/issues/8998) — Window capture properties dropdown flickers at 124% system zoom

**Verdict:** CANNOT_VERIFY

**Reasoning:** The window-list combo box flickers on hover only at a non-standard scale factor (124%). This points at Qt fractional-scaling or hover repaint behaviour on that system. I found no OBS-specific code involved, and it needs a repro.

**Evidence:** The properties combo boxes are generic `QComboBox` widgets created by `OBSPropertiesView`. Nothing in OBS is specific to scaling.

**Related:** #8160, #10525

---

### [#9036](https://github.com/obsproject/obs-studio/issues/9036) — Screen tearing with full screen preview but not windowed preview

**Verdict:** CANNOT_VERIFY

**Reasoning:** Tearing in fullscreen projectors on one particular dual-PC capture-card setup depends on the GPU, driver, swap chain and presentation mode. The bug cannot be confirmed from code without the hardware.

**Evidence:** Fullscreen projectors use `OBSQTDisplay` with `showFullScreen` (`frontend/widgets/OBSProjector.cpp:128-134`). Presentation is handled in libobs-d3d11 swap-chain code, and whether it tears depends on the hardware.

**Related:** none

---

### [#9155](https://github.com/obsproject/obs-studio/issues/9155) — Display capture fails to hide OBS window and menu after minimizing and restoring

**Verdict:** IMPLEMENT (partial: menus and popups only)

**Reasoning:** There are two symptoms.

1. Menus and dropdowns show up in captures. This one has a clear cause. `OBSApp::notify` applies `WDA_EXCLUDEFROMCAPTURE` only to top-level windows of type `Dialog`, `Window` or `Tool`. Menus and combo-box popups are `Qt::Popup` windows, so they never get the affinity. Adding `Qt::Popup` (and optionally `Qt::ToolTip`) to that filter fixes it. On Windows, QMenu and combo popups are native top-level HWNDs that are created before the Show event is delivered.
2. A black rectangle appears after minimise-to-tray and restore. The Show event re-applies affinity and the affinity normally survives a hide, so this looks like DWM or Windows Graphics Capture behaviour. I could not find its root cause, and it is not part of this slice.

**Evidence:**
- `frontend/OBSApp.cpp:1515-1555`: the Show-event hook and the window-type filter that excludes `Qt::Popup`.
- `frontend/widgets/OBSBasic.cpp:2018-2042`: `SetDisplayAffinity` and the `WDA_EXCLUDEFROMCAPTURE` logic. Projectors are already skipped through the `isOBSProjectorWindow` property.
- `frontend/widgets/OBSBasic.cpp:1639-1658`: the minimise-to-tray path, which is a hide and show and would re-trigger the hook.

**Related:** none

**Slice plan:** In `frontend/OBSApp.cpp` `OBSApp::notify`, add `|| windowType == Qt::WindowType::Popup` (and possibly `ToolTip`) to the type check. This is 1 to 2 lines. Test on Windows 11: enable "Hide OBS windows from screen capture", add a Display Capture using WGC, open a menu and a combo dropdown, and confirm they do not appear in the preview. The minimise and restore black-window part remains open and should be noted as not addressed.

---

### [#9558](https://github.com/obsproject/obs-studio/issues/9558) — Copy transform to an item within a group does not work

**Verdict:** IMPLEMENT

**Reasoning:** The defect is clear. `on_actionPasteTransform_triggered` walks only the top-level scene items with `obs_scene_enum_items` and never recurses into groups, so selected items inside a group are skipped. Every comparable multi-item operation in the same frontend (rotate, scale, centre-align) recurses with `obs_sceneitem_group_enum_items` when an item is a group. Undo and redo already capture group children, because `obs_scene_save_transform_states` covers scenes and groups.

**Evidence:**
- `frontend/widgets/OBSBasic_Clipboard.cpp:39-66`: the paste lambda and the non-recursive `obs_scene_enum_items(GetCurrentScene(), func, nullptr)`.
- `frontend/widgets/OBSBasic_SceneItems.cpp:1089-1093, 1164-1168, 1222-1226`: the recursive pattern used by `RotateSelectedSources`, `MultiplySelectedItemScale` and `CenterAlignSelectedItems`.
- `libobs/obs-scene.c:2547-2569`: `obs_scene_save_transform_states` handles "scenes_and_groups".

**Related:** #3647, #4555

**Slice plan:**
1. Turn the lambda into a static function `PasteTransformToSelected(obs_scene_t*, obs_sceneitem_t*, void*)`.
2. At its top, add `if (obs_sceneitem_is_group(item)) obs_sceneitem_group_enum_items(item, PasteTransformToSelected, param);`, then keep the existing selected, locked and apply logic.

File: `frontend/widgets/OBSBasic_Clipboard.cpp`. Estimated size: about 15 lines. Test: build the frontend, group a Text source, copy the transform from an ungrouped item, paste it onto the grouped item, and check that undo restores it.

---

### [#9629](https://github.com/obsproject/obs-studio/pull/9629) — UI: Add setting to copy screenshots to clipboard

**Verdict:** DEFER_LARGE

**Reasoning:** The feature is reasonable and was written by a maintainer (jpark37). The PR targets the pre-reorganisation `UI/` tree, so `git apply --check` fails on every file. Since then, `ScreenshotObj` has moved to `frontend/utility/ScreenshotObj.cpp` and been refactored to take an `Options` struct (commit 13d5c007b), and it is now shared with `ThumbnailItem`. The PR rewrites the render, stage and copy pipeline into dual SDR and HDR texrenders and stage surfaces, and adds a settings checkbox in the `.ui` form plus a locale string. Porting it is a re-implementation of about 150 lines against the refactored class. It touches the HDR and colour-space paths, which cannot be validated here (no HDR display, no macOS), and it risks breaking thumbnails. It does not fit the small-slice criteria.

**Evidence:**
- `git diff master...refs/upstream-pr/9629 --stat`: 7 files, 149 added and 46 removed lines, all under `UI/`.
- `frontend/utility/ScreenshotObj.cpp:35-42`: the current constructors take `Options`.
- `git show --stat 13d5c007b`: the "Refactor ScreenshotObj options" commit, which also touches `ThumbnailItem.cpp`.
- `frontend/widgets/OBSBasic_Screenshots.cpp:32`: the current construction site.

**Related:** none

---

### [#9749](https://github.com/obsproject/obs-studio/issues/9749) — CTRL and hotkeys bug

**Verdict:** CANNOT_VERIFY

**Reasoning:** About once a week, a bare Ctrl press stops the stream, and the log shows "Stopping stream due to hotkey". The reporter cannot reproduce it on demand; a PC restart clears it, and so does pressing the real binding. This suggests a stuck modifier or key state in the Windows hotkey polling, where a previous Numpad 8 press was never seen as released. Nothing in the code can be confirmed without a repro, and the libobs hotkey thread is shared and sensitive to change.

**Evidence:**
- `frontend/widgets/OBSBasic_Hotkeys.cpp:131-150`: `MAKE_CALLBACK` and the streaming hotkey pair, which logs "Stopping stream due to hotkey".
- Key state polling is in `libobs/obs-windows.c`, the Windows hotkey platform code.

**Related:** #7924

---

### [#9860](https://github.com/obsproject/obs-studio/issues/9860) — False dialog for settings change

**Verdict:** IMPLEMENT

**Reasoning:** The defect is clear. In Settings > Stream, choosing "Show All..." in the service combo emits `currentIndexChanged`. `on_service_currentIndexChanged` is auto-connected by `setupUi` and handles the item by calling `LoadServices(true)`, which repopulates the list with signals blocked and restores `lastService`. The same signal is also hooked by `HookWidget(ui->service, COMBO_CHANGED, STREAM1_CHANGED)`, which runs after it, so `Stream1Changed` marks the stream settings dirty and enables Apply even though the selected service has not changed.

**Evidence:**
- `frontend/settings/OBSBasicSettings_Stream.cpp:577-582`: the ShowAll branch, which reloads and returns.
- `frontend/settings/OBSBasicSettings_Stream.cpp:463-512`: `LoadServices` blocks signals and restores `lastService`.
- `frontend/settings/OBSBasicSettings.cpp:350`: `setupUi`, which auto-connects the `on_` slot first.
- `frontend/settings/OBSBasicSettings.cpp:401`: `HookWidget(ui->service, COMBO_CHANGED, STREAM1_CHANGED)`.
- `frontend/settings/OBSBasicSettings.cpp:4280-4287`: `Stream1Changed` sets `stream1Changed` and enables the Apply button.
- `frontend/settings/OBSBasicSettings_Stream.cpp:726-730`: `lastService` is updated in `UpdateServerList`.

**Related:** none

**Slice plan:**
1. Add a `bool serviceListReloading = false` member to `OBSBasicSettings`.
2. In the ShowAll branch, after `LoadServices(true)`, set it to true only if `ui->service->currentText() == lastService`, meaning the selection was really restored.
3. In `Stream1Changed`, add: `if (serviceListReloading && sender() == ui->service) { serviceListReloading = false; return; }`.

Files: `frontend/settings/OBSBasicSettings.hpp`, `frontend/settings/OBSBasicSettings.cpp`, `frontend/settings/OBSBasicSettings_Stream.cpp`. Estimated size: about 10 lines. Test: open Settings > Stream, choose Show All, click away, confirm Apply stays disabled and closing shows no prompt. Then pick a real service and confirm Apply becomes enabled.

---

### [#9938](https://github.com/obsproject/obs-studio/issues/9938) — Window position shifts after maximize toggle

**Verdict:** CANNOT_VERIFY

**Reasoning:** The window only drifts on Windows 10 with the taskbar on the top or left, and it started with OBS 30 (the Qt 6.6 bump). OBS has no code that touches geometry when the window is maximised or restored. `changeEvent` handles only minimise and the preview. The drift is very likely a Qt or Windows frame-geometry issue, but I cannot confirm that from OBS code.

**Evidence:**
- `frontend/widgets/OBSBasic.cpp:1639-1658`: `changeEvent` has no geometry handling for maximise.
- `frontend/widgets/OBSBasic.cpp:438`: `restoreGeometry` runs only at startup.

**Related:** none

---

### [#9947](https://github.com/obsproject/obs-studio/issues/9947) — A gray line around preview window

**Verdict:** CANNOT_VERIFY

**Reasoning:** A one-pixel gray border appears around the preview at certain resolution and scaling combinations (1920x1200 at 100%, and 125% or 150% on 2K displays). This is a rounding issue in the theme or display at fractional sizes. The themes have been rewritten since 30.0, and there is no repro or code location I can confirm.

**Evidence:** The preview is `OBSBasicPreview` inside `previewContainer` (`frontend/widgets/OBSBasic_Preview.cpp:265-270`). The border and background come from the theme `.obt` files.

**Related:** #7360, #8160

---

### [#10147](https://github.com/obsproject/obs-studio/issues/10147) — Reconnect strategy not disclosed, settings unclear (exponential backoff)

**Verdict:** IMPLEMENT (disclose the behaviour in the UI)

**Reasoning:** libobs multiplies the retry delay by about 1.5 (with jitter) after each failed attempt, capped at 15 minutes, but Settings presents "Retry Delay" as if it were a fixed interval. Changing the algorithm or exposing the constants would be a design decision. The smallest useful slice is a tooltip on the Retry Delay control that explains it is the initial delay and grows on each attempt up to 15 minutes. The status-bar message already shows the actual delay for each attempt.

**Evidence:**
- `libobs/obs-output.c:32-33`: `RECONNECT_RETRY_MAX_MSEC` (15 min) and `RECONNECT_RETRY_BASE_EXP` (1.5).
- `libobs/obs-output.c:244`: the exponent with jitter.
- `libobs/obs-output.c:2959, 2978-2982`: the growth and the cap.
- `frontend/forms/OBSBasicSettings.ui:8480`: the `reconnectRetryDelay` spinbox has no tooltip.
- `frontend/data/locale/en-US.ini:1120-1122`: the existing Reconnect, RetryDelay and MaxRetries strings.
- `frontend/data/locale/en-US.ini:699`: the status bar already reports the per-attempt delay.

**Related:** none

**Slice plan:**
1. Add `Basic.Settings.Output.RetryDelay.ToolTip="Delay before the first reconnect attempt. Each subsequent attempt waits about 1.5x longer than the previous one, up to a maximum of 15 minutes."` to `frontend/data/locale/en-US.ini`.
2. Set the `toolTip` property on `reconnectRetryDelay` and its label in `frontend/forms/OBSBasicSettings.ui`, using a key string as the existing tooltips in that file do.

Estimated size: about 8 lines. Test: build, open Settings > Advanced, and hover over the control.

---

### [#10228](https://github.com/obsproject/obs-studio/issues/10228) — Crash on close after update; docks moved or missing on restart

**Verdict:** CANNOT_VERIFY

**Reasoning:** OBS crashes on exit, and the dock layout is lost because the crash happens before the state is saved. The crash log is only an external URL; its stack is not available here, and an exit crash on 30.0.2 is usually caused by a third-party plugin. The missing docks follow from the crash and are not a separate defect. There is no actionable stack.

**Evidence:** `frontend/widgets/OBSBasic.cpp:1763-1768`: UI state (including `PreviewEnabled` and `PreviewProgramMode`) is saved during the close sequence, so a crash before that point loses it.

**Related:** none

---

### [#10390](https://github.com/obsproject/obs-studio/issues/10390) — Activate Preview keybinding only works sporadically

**Verdict:** CANNOT_VERIFY

**Reasoning:** The preview enable and disable hotkeys are an ordinary frontend hotkey pair. They are routed to the UI thread and gated on `previewEnabled`, which `EnablePreview` and `DisablePreview` update synchronously. The report is on Arch with Wayland: it gets worse under Wayland, separate bindings sometimes fail too, and only the single-key toggle fails on X11 and Windows. That points at Wayland key-event delivery and the libobs hotkey-pair same-key logic. I found no frontend defect.

**Evidence:**
- `frontend/widgets/OBSBasic_Hotkeys.cpp:76-81`: callbacks are routed to the UI thread.
- `frontend/widgets/OBSBasic_Hotkeys.cpp:131-140`: `MAKE_CALLBACK`.
- `frontend/widgets/OBSBasic_Hotkeys.cpp:249-254`: the preview pair.
- `frontend/widgets/OBSBasic_Preview.cpp:283-301`: `EnablePreview` and `DisablePreview` set `previewEnabled`.

**Related:** none

---

### [#10525](https://github.com/obsproject/obs-studio/issues/10525) — Dropdown menus broken on a secondary monitor

**Verdict:** CANNOT_VERIFY

**Reasoning:** Context menus do not appear on the secondary monitor in 30.1.x but do in 29.1.3. This is a regression that matches the Qt 6.6 upgrade, and I suspect Qt's per-monitor DPI or popup positioning on mixed-DPI setups. OBS creates menus through standard `QMenu::exec` calls, and nothing in OBS positions popups per screen. This could not be reproduced here (single monitor) and does not trace to OBS code.

**Evidence:** Menus are created with `popup.exec(QCursor::pos())` throughout `frontend/widgets/*`, with no screen-specific handling.

**Related:** #8160, #8998
