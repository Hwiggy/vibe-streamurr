# Upstream triage — batch scripting-api-02

- Batch id: scripting-api-02 (area hint: scripting-api; several items are actually frontend API / plugins)
- Items: 12577, 12770, 12823, 13014, 13073, 13107, 13124, 13128, 13143, 13380, 13448, 13467, 13580, 13584, 13633, 13639, 13687, 13768, 13887, 14029, 14043
- Date: 2026-10-26
- Base commit: master @ 72e866557
- Method: item bodies from `notes/upstream-triage/data/all.json`; PR heads inspected via `refs/upstream-pr/<N>`.
  Local git is 2.33 (no `merge-tree --write-tree`), so applicability was checked with
  `git diff master...refs/upstream-pr/N | git apply --check` (read-only). No WebFetch used.

Summary:

| # | Kind | Verdict |
|---|------|---------|
| 12577 | PR | DEFER_LARGE |
| 12770 | PR | DEFER_LARGE |
| 12823 | PR | IMPLEMENT (cherry-pick) |
| 13014 | PR | IMPLEMENT (new-change; PR itself unsound) |
| 13073 | PR | DEFER_LARGE |
| 13107 | PR | CANNOT_VERIFY |
| 13124 | issue | OUT_OF_SCOPE (obs-websocket submodule) |
| 13128 | PR | IMPLEMENT (combined with 13143/13887) |
| 13143 | PR | IMPLEMENT (combined, manual port; PR no longer applies) |
| 13380 | PR | DEFER_LARGE |
| 13448 | PR | CANNOT_VERIFY |
| 13467 | PR | IMPLEMENT (cherry-pick + leak follow-up) |
| 13580 | issue | IMPLEMENT (new-change) |
| 13584 | PR | IMPLEMENT (cherry-pick) |
| 13633 | PR | DEFER_LARGE |
| 13639 | PR | DEFER_LARGE |
| 13687 | PR | IMPLEMENT (partial-pr manual port) |
| 13768 | issue | DEFER_LARGE |
| 13887 | issue | IMPLEMENT (same slice as 13143) |
| 14029 | issue | DEFER_LARGE |
| 14043 | PR | IMPLEMENT (cherry-pick) |

---

### [#12577](https://github.com/obsproject/obs-studio/pull/12577) — frontend, libobs, plugins: Natural sorting for files, profile and scene names

**Verdict: DEFER_LARGE**

Natural (numeric-aware, locale-aware) sorting for drag&drop, profile/scene-collection menus, slideshow mk2 and VLC playlists. Valuable but it adds new public libobs APIs (`dstr` natural compare for char/wchar, new locale functions in `util/platform.h` for both platform-nix.c and platform-windows.c) plus Qt wrapper templates; 14 files, +704/-141. New exported libobs API surface is a maintainer design decision and the size is well past a small slice. Applies cleanly (`git apply --check` ok).

Evidence:
- `git diff master...refs/upstream-pr/12577 --stat`: 14 files, 704+/141-; touches `libobs/util/dstr.h`, `libobs/util/platform.h` (new EXPORTs).
- `plugins/image-source/obs-slideshow-mk2.c`, `plugins/vlc-video/vlc-video-source.c` directory enumeration currently uses OS order.

Related: 13073, 13380 (slideshow work by same/other authors).

---

### [#12770](https://github.com/obsproject/obs-studio/pull/12770) — Frontend: Expose Studio mode "Swap preview/program after transitioning" via the frontend API

**Verdict: DEFER_LARGE**

Adds `obs_frontend_get/set_swap_scenes_mode()` plus a new frontend event. The mechanics are small (85 lines, applies), but (a) it is new public frontend API/ABI whose shape is a maintainer decision, and a fork-only export is of little value since third-party plugins target upstream; (b) as written it inserts `OBS_FRONTEND_EVENT_SWAP_SCENES_MODE_CHANGED` *before* `OBS_FRONTEND_EVENT_REPLAY_BUFFER_SAVING`, which renumbers an existing enum value — an ABI break for every compiled plugin. Not taken as-is; revisit only if upstream accepts an API.

Evidence:
- `frontend/api/obs-frontend-api.h:66-70` — `CANVAS_ADDED`, `CANVAS_REMOVED`, `REPLAY_BUFFER_SAVING` is the last enum value; PR inserts before it.
- `frontend/widgets/OBSBasic.hpp:1512` `bool swapScenesMode = true;` — currently only toggled by UI lambda at `frontend/widgets/OBSBasic_StudioMode.cpp:131-133`, persisted at `OBSBasic.cpp:957,1766`.

Related: 13633 (another new frontend API).

---

### [#12823](https://github.com/obsproject/obs-studio/pull/12823) — obs-scripting: Add missing calldata types

**Verdict: IMPLEMENT (cherry-pick-pr)**

Scripts can currently only cast calldata pointers to `obs_source_t` and `obs_sceneitem_t`; signals that carry `scene`, `output` or `canvas` pointers (e.g. scene `item_add`, output `start/stop`) are unusable from Python/Lua. The PR adds `calldata_scene`, `calldata_output`, `calldata_canvas` following the exact pattern of the existing helpers, plus docs. Scripting-only, no C ABI change, 159 added lines, applies cleanly.

Evidence:
- `shared/obs-scripting/obs-scripting-python.c:966-1010` existing `calldata_source` / `calldata_sceneitem`; registered at `:1205-1206`.
- `shared/obs-scripting/obs-scripting-lua.c` has the parallel Lua helpers (PR adds next to `calldata_sceneitem`).
- `docs/sphinx/scripting.rst:320-336` documents only the two existing helpers.

Slice:
- Cherry-pick both commits `f055b8b87` (code) and `155c1ee91` (docs) from `refs/upstream-pr/12823`.
- Files: `shared/obs-scripting/obs-scripting-python.c`, `shared/obs-scripting/obs-scripting-lua.c`, `docs/sphinx/scripting.rst`.
- Test: build `obs-scripting` (MSVC, Python+Lua enabled) on Windows; load a small Python and Lua script connecting to a scene `item_add` signal and calling `calldata_scene(cd, "scene")`; verify a non-None object. If scripting runtime not configured in the build, mark UNTESTED (build-only).

Related: 13584.

---

### [#13014](https://github.com/obsproject/obs-studio/pull/13014) — obs-scripting: Replace deprecated PySys_SetArgv

**Verdict: IMPLEMENT (new-change; do not cherry-pick)**

`PySys_SetArgv` is deprecated (since 3.11) and slated for removal, and the current code only suppresses the warning. The PR, however, is unsound: it calls `Py_InitializeFromConfig` *after* `Py_Initialize()` has already run (line 1624), uses `PyConfig`/`Py_InitializeFromConfig`/`PyWideStringList_Append`/`Py_ExitStatusException` which are not in the runtime-import shim (Windows/macOS use `RUNTIME_LINK`, so it would not link), sets `config.safe_path` (3.11+ only) under a 3.8 guard, and `Py_ExitStatusException` would terminate OBS on failure. A tiny, safe alternative exists: set `sys.argv` (and keep the old `sys.path[0] = ''` side effect) with `PyRun_SimpleString`, which is already imported.

Evidence:
- `shared/obs-scripting/obs-scripting-python.c:1624` `Py_Initialize();` already called before argv setup.
- `shared/obs-scripting/obs-scripting-python.c:1640-1648` `PySys_SetArgv(argc, argv)` wrapped in `PRAGMA_WARN_DEPRECATION`.
- `shared/obs-scripting/obs-scripting-python-import.h:23-26` `RUNTIME_LINK`; `:90,176` and `obs-scripting-python-import.c:148` import shim for `PySys_SetArgv` (no PyConfig symbols).

Slice:
- Replace the `PySys_SetArgv` block with `PyRun_SimpleString("import sys\nsys.argv = ['']\nif '' not in sys.path: sys.path.insert(0, '')")` (matching `PySys_SetArgvEx(…, updatepath=1)` behaviour for an empty argv[0]).
- Remove `PySys_SetArgv` from `obs-scripting-python-import.h` / `.c` so a future Python without the symbol does not fail the runtime import.
- ~15 lines across `shared/obs-scripting/obs-scripting-python.c`, `obs-scripting-python-import.c`, `obs-scripting-python-import.h`.
- Test: build obs-scripting on Windows with Python 3.x installed, load a Python script that prints `sys.argv` and imports `tkinter`-free module; check log. Otherwise UNTESTED.

Related: none.

---

### [#13073](https://github.com/obsproject/obs-studio/pull/13073) — frontend, plugins: Slideshow rework

**Verdict: DEFER_LARGE**

Large behavioural rework of slideshow mk2 (changes default visibility behaviour, new stop/restart semantics, position preservation, transition recreation). +256/-178 in one file, multiple UX/behaviour changes that need maintainer sign-off (changing defaults affects existing users). Applies, but not a small slice.

Evidence:
- `plugins/image-source/obs-slideshow-mk2.c` (whole-file rework per `git diff --stat`).
- Default-changing behaviour is a product decision, not a bug fix.

Related: 12577, 13380.

---

### [#13107](https://github.com/obsproject/obs-studio/pull/13107) — plugins, util: Prioritize stop events over processing

**Verdict: CANNOT_VERIFY**

Reorders `WaitForMultipleObjects` handle arrays so stop events win, and refactors the Windows IPC pipe server (manual-reset events, ERROR_PIPE_CONNECTED handling, cancellation). There is no concrete reproducible failure: on shutdown `ipc_pipe_server_free` already `CancelIoEx`es the pending `ConnectNamedPipe`, which signals `ready_event` and unblocks the thread, so the claimed hang is not demonstrable from code. The `ERROR_PIPE_CONNECTED` gap is real but only reachable if a client connects between `CreateNamedPipe` and `ConnectNamedPipe`, which the game-capture sequence makes practically impossible. It also changes the injected graphics-hook DLL's copy thread, which is compatibility-sensitive. The rtmp-windows `WAIT_ABANDONED` change concerns events (never abandoned). Needs a repro before touching game capture IPC.

Evidence:
- `shared/ipc-util/ipc-util/pipe-windows.c:112-153` server thread (`WaitForSingleObject(ready_event)` then loop on `{ready_event, stop_event}`).
- `shared/ipc-util/ipc-util/pipe-windows.c:161-167` `ipc_pipe_internal_wait_for_connection` treats only success/IO_PENDING as ok.
- PR touches `plugins/win-capture/graphics-hook/graphics-hook.c` copy_thread.

Related: none.

---

### [#13124](https://github.com/obsproject/obs-studio/issues/13124) — Websocket returns invalid bounds with GetSceneItemTransform

**Verdict: OUT_OF_SCOPE (belongs to obs-websocket repo)**

Confirmed in code: `GetSceneItemTransform` serialises `bounds.x/y` raw (0 when bounds type is NONE), while `SetSceneItemTransform` validates `boundsWidth`/`boundsHeight` with a minimum of 1.0, so a round-trip fails. However the code lives in the `plugins/obs-websocket` git submodule (separate upstream repository obsproject/obs-websocket); fixing it here would require forking that submodule. Should be reported/fixed in obs-websocket (e.g. accept 0 when boundsType is NONE, or allow 0.0 minimum).

Evidence:
- `.gitmodules` — `plugins/obs-websocket` is a submodule (`https://github.com/obsproject/obs-websocket.git`).
- `plugins/obs-websocket/src/requesthandler/RequestHandler_SceneItems.cpp:474-477` `ValidateOptionalNumber("boundsWidth", …, 1.0, 90001.0)`.
- `plugins/obs-websocket/src/utils/Obs_ObjectHelper.cpp:78` `ret["boundsWidth"] = osi.bounds.x;`.

Related: none.

---

### [#13128](https://github.com/obsproject/obs-studio/pull/13128) — frontend: Fix crash on startup when using tbar apis in non-studio-mode

**Verdict: IMPLEMENT (new-change combining 13128 + 13143; fixes 13887)**

Root cause confirmed: `tBar` is a raw pointer with no initialiser and is only created in `CreateProgramOptions()` when studio mode is enabled; when studio mode is disabled `programOptions` (its parent) is deleted, leaving `tBar` dangling. `obs_frontend_get_tbar_position()` dereferences `main->tBar` directly and `set/release` invoke `TBarChanged/TBarReleased`, which dereference `tBar` unconditionally → crash outside studio mode. The PR adds `!tBar || !previewProgramMode` guards; the `previewProgramMode` check is what actually protects (the `!tBar` check is UB on an uninitialised pointer), so the local slice also initialises `tBar = nullptr` and nulls it when `programOptions` is deleted. PR applies but is merged into the combined slice below.

Evidence:
- `frontend/widgets/OBSBasic.hpp:1519` `QSlider *tBar;` (no initialiser).
- `frontend/widgets/OBSBasic_StudioMode.cpp:96-108` creation inside `CreateProgramOptions`; `:259` `delete programOptions;` (tBar is a child via layout).
- `frontend/OBSStudioAPI.cpp:110-123` API wrappers; `:122` `return main->tBar->value();`.
- `frontend/widgets/OBSBasic_Transitions.cpp:750-831` `TBarReleased`, `TBarChanged`, `GetTbarPosition` dereference `tBar` unguarded.

Slice (shared with #13143/#13887): see #13143.

Related: 13143, 13887.

---

### [#13143](https://github.com/obsproject/obs-studio/pull/13143) — frontend: Fix setting the T-bar position through the API

**Verdict: IMPLEMENT (partial-pr / manual port; PR no longer applies)**

Root cause confirmed: `obs_frontend_set_tbar_position()` invokes `OBSBasic::TBarChanged(position)` directly, which drives the transition but never moves the slider. `TBarReleased()` decides finish vs. cancel from `tBar->value()`, which is still 0, so it always takes the "Manual transition cancelled" branch; `obs_frontend_get_tbar_position()` likewise returns 0. Fix: set the slider value (its `valueChanged` signal already calls `TBarChanged`), on the UI thread. PR fails `git apply --check` because master now uses the function-pointer `invokeMethod` overload, so port by hand.

Evidence:
- `frontend/OBSStudioAPI.cpp:115-118` `QMetaObject::invokeMethod(main, &OBSBasic::TBarChanged, position);`.
- `frontend/widgets/OBSBasic_Transitions.cpp:750-776` `TBarReleased` reads `tBar->value()`; cancel branch at `val <= T_BAR_CLAMP`.
- `frontend/widgets/OBSBasic_StudioMode.cpp:102` `connect(tBar, &QSlider::valueChanged, this, &OBSBasic::TBarChanged);`.

Combined slice (13128 + 13143 + 13887), ~30 lines:
1. `frontend/widgets/OBSBasic.hpp`: `QSlider *tBar = nullptr;`; declare `void SetTbarPosition(int position);`.
2. `frontend/widgets/OBSBasic_StudioMode.cpp`: after `delete programOptions;` set `tBar = nullptr;`.
3. `frontend/widgets/OBSBasic_Transitions.cpp`: early-return guards `if (!tBar || !previewProgramMode)` in `TBarReleased`, `TBarChanged`, `GetTbarPosition` (return 0); add `SetTbarPosition()` that guards then `tBar->setValue(position)`.
4. `frontend/OBSStudioAPI.cpp`: `set_tbar_position` → `QMetaObject::invokeMethod(main, [=]{ main->SetTbarPosition(position); })` (keep UI-thread marshalling); `get_tbar_position` → `main->GetTbarPosition()`.
- Test: MSVC build of `obs-studio` frontend on Windows; manual: enable studio mode, call the API from a small Python/Lua script (`obs_frontend_set_tbar_position` / `obs_frontend_release_tbar` are exposed via the obs_frontend scripting bindings, if present; otherwise a tiny test plugin) — set 1023 then release → log "Manual transition … finished"; disable studio mode and call get/set/release → no crash. If not run interactively, mark UNTESTED.
- Authorship: credit psyirius (13128) and djordje-mancic (13143) in commit message (Co-authored-by) since logic comes from their PRs (GPL-2.0-or-later).

Related: 13128, 13887.

---

### [#13380](https://github.com/obsproject/obs-studio/pull/13380) — plugins: Remove legacy slideshow source

**Verdict: DEFER_LARGE**

Deletes the 1071-line legacy `obs-slideshow.c` and adds migration logic to mk2. The legacy v1 source is still registered (`OBS_SOURCE_CAP_OBSOLETE`) so existing scene collections keep their exact behaviour; removing it changes behaviour for existing users (mk2 semantics differ) and is an upstream deprecation-timeline decision. The PR no longer applies (`obs-slideshow.c` has changed, e.g. webp support). Pure cleanup with no user benefit for this fork.

Evidence:
- `plugins/image-source/obs-slideshow.c:1043-1047` v1 `slideshow_info` with `OBS_SOURCE_CAP_OBSOLETE`.
- `plugins/image-source/obs-slideshow-mk2.c:1147-1149` v2 `.version = 2`.
- `plugins/image-source/image-source.c:409-410` both registered.
- `git apply --check` fails on `plugins/image-source/obs-slideshow.c:1`.

Related: 13073, 12577.

---

### [#13448](https://github.com/obsproject/obs-studio/pull/13448) — plugins/compressor: Fix ducking trigger when sidechain source is muted

**Verdict: CANNOT_VERIFY**

Claims (for issue #13170) that muting the sidechain leaves the compressor stuck ducking. Code does not show that: the sidechain capture callback is still invoked when muted and explicitly pushes zero samples, and an underflowing sidechain buffer is also zero-filled, so `analyze_sidechain` naturally decays the envelope with the release coefficient. The PR also changes semantics (an inactive-but-configured sidechain now ignores the signal entirely) without a demonstrated defect. Needs a repro (possibly a case where the sidechain source stops emitting audio callbacks altogether, e.g. deactivated, where `max_sidechain_frames`-based buffering might behave differently).

Evidence:
- `plugins/obs-filters/compressor-filter.c:144-179` `sidechain_capture` → `if (muted) deque_push_back_zero(...)`.
- `plugins/obs-filters/compressor-filter.c:98-122` `get_sidechain_data` zero-fills on underflow.
- `plugins/obs-filters/compressor-filter.c:325-353` `analyze_sidechain` release path.
- `libobs/obs-source.c:1522-1531` `source_signal_audio_data` passes `muted` to callbacks.

Related: issue #13170 (not in batch).

---

### [#13467](https://github.com/obsproject/obs-studio/pull/13467) — plugins/text-freetype2: Clean up file access code

**Verdict: IMPLEMENT (cherry-pick-pr + small follow-up)**

By Lain (project lead). Fixes #7595 (null bytes in text files truncate/garble text), fixes inverted `fread` size/count arguments, replaces one-byte-at-a-time `fread` loop in "read from end" (log) mode with 1 KiB chunks, removes the bogus UTF-16 BOM path. Single file, +53/-77, applies cleanly. Review found one regression to fix in a follow-up commit: the new `read_from_end` returns early (`cur_pos == filesize`, also on the short-read warning path) without `fclose(tmp_file)`, leaking a FILE handle every refresh for an empty file.

Evidence:
- `plugins/text-freetype2/text-functionality.c:359-368` current `remove_cr` stops at first `\0`.
- `plugins/text-freetype2/text-functionality.c` `load_text_from_file` uses `fread(tmp_read, filesize, 1, …)` and `strlen(tmp_read)` (truncates at NUL).
- `plugins/text-freetype2/text-freetype2.c:298-304` file re-read on change; `cache_glyphs` handles NULL text (`text-functionality.c:274-277`).

Slice:
- Cherry-pick the 5 commits from `refs/upstream-pr/13467` (8939fbce4..8b33d161a) preserving authorship.
- Follow-up commit: add `fclose(tmp_file);` before the early `return` when `cur_pos == filesize` and in the short-read `break` path in `read_from_end`.
- Test: build `text-freetype2` (built on Windows though deprecated there); manual test with a file containing NUL bytes and a log file in "read from end" mode with N lines. Otherwise UNTESTED.

Related: none in batch.

---

### [#13580](https://github.com/obsproject/obs-studio/issues/13580) — Closing a VST plugin window with the red cross doesn't signal that it's closed

**Verdict: IMPLEMENT (new-change)**

Root cause confirmed: closing the editor via the window's X triggers `EditorWidget::closeEvent` → `VSTPlugin::onEditorClosed()`, which clears `editorWidget`, but nothing tells the open properties dialog to refresh. The Open/Close button visibility is only recomputed in `vst_properties`/`vst_changed` or the button callbacks, so the dialog keeps showing "Close Plug-in Interface" (whose callback is then a no-op since `isEditorOpen()` is false). obs-vst is in-tree (not a submodule).

Evidence:
- `plugins/obs-vst/EditorWidget.cpp:27-31` `closeEvent` → `plugin->onEditorClosed()`.
- `plugins/obs-vst/VSTPlugin.cpp:296-309` `onEditorClosed` — no properties refresh.
- `plugins/obs-vst/obs-vst.cpp:55-70` close button callback (only path that flips visibility); `:296-323` visibility derived from `isEditorOpen()`.
- `plugins/obs-vst/headers/VSTPlugin.h:47` `obs_source_t *sourceContext` available.

Slice:
- In `EditorWidget::closeEvent`, when `event->spontaneous()` (user/OS-initiated close, not our `close()` from the button), after `plugin->onEditorClosed()` call `obs_source_update_properties(plugin->sourceContext)` (add an accessor or make the call inside `VSTPlugin` via a new `onEditorClosed(bool notify)` parameter). ~6 lines in `plugins/obs-vst/EditorWidget.cpp`, `plugins/obs-vst/VSTPlugin.cpp`, `plugins/obs-vst/headers/VSTPlugin.h`.
- Test: Windows MSVC build of obs-vst; needs a VST2 plugin with an editor to verify manually. If none available: UNTESTED (build-only).

Related: none.

---

### [#13584](https://github.com/obsproject/obs-studio/pull/13584) — obs-scripting: Add obs_properties_add_button2

**Verdict: IMPLEMENT (cherry-pick-pr)**

`obs_properties_add_button` is documented as deprecated in favour of `obs_properties_add_button2`, but in scripting `add_button2` is either unavailable or (via SWIG) exposed as the raw C function that cannot take a script callable. The scripting `properties_add_button` already calls `obs_properties_add_button2` internally, so the PR simply registers the same handler under the new name, `%ignore`s the raw SWIG binding, and updates the two bundled example scripts. 6 one-line changes, applies.

Evidence:
- `shared/obs-scripting/obs-scripting-python.c:867-886` `properties_add_button` → `obs_properties_add_button2(...)`; registered at `:1220`.
- `shared/obs-scripting/obslua/obslua.i`, `obspython/obspython.i` `%ignore obs_properties_add_button;` only.
- `docs/sphinx/reference-properties.rst:262-270` deprecation note; `:290` tells scripters to use `obs_properties_add_button`.

Slice:
- Cherry-pick `32678fdeb`. Optionally adjust `docs/sphinx/scripting.rst:289` to mention the alias.
- Test: build obs-scripting (MSVC); run bundled `countdown.lua` and `url-text.py` and click the buttons. If scripting runtime unavailable: UNTESTED.

Related: 12823.

---

### [#13633](https://github.com/obsproject/obs-studio/pull/13633) — frontend: API call obs_frontend_add_transition()

**Verdict: DEFER_LARGE**

New public frontend API (`obs_source_t *obs_frontend_add_transition(...)`) plus refactor of `OBSBasic::AddTransition`. Same reasoning as #12770: new exported API surface is an upstream design decision and a fork-only export has little value. The PR is also not compile-clean as shown: it places default arguments on the out-of-line definition in `OBSBasic_Transitions.cpp` (`const char *transitionName = nullptr, bool showProperties = true`) while also changing the header declaration, which is a redefinition-of-default-argument error.

Evidence:
- `git diff master...refs/upstream-pr/13633 -- frontend/widgets/OBSBasic_Transitions.cpp` shows defaults on the definition.
- `frontend/api/obs-frontend-internal.hpp` vtable would grow (ABI-relevant for frontend API consumers).

Related: 12770, 13639 (same author).

---

### [#13639](https://github.com/obsproject/obs-studio/pull/13639) — libobs & frontend: fallback transitions when plugin is absent

**Verdict: DEFER_LARGE**

Introduces a new libobs source flag `OBS_SOURCE_FALLBACK` and new export `obs_source_create_private_with_fallback()`, plus frontend handling so a transition whose plugin is missing is kept (rendered as cut). Plausible and modest in lines (71), but it adds public libobs API/flags and UI semantics that need maintainer design approval; not something to fork-diverge on.

Evidence:
- PR touches `libobs/obs.h`, `libobs/obs-source.h`, `libobs/obs-source.c` (new exported API), `frontend/widgets/OBSBasic_Transitions.cpp`.

Related: 13633.

---

### [#13687](https://github.com/obsproject/obs-studio/pull/13687) — libobs: Resolve bin_path and data_path to absolute paths for modules

**Verdict: IMPLEMENT (partial-pr / manual port)**

By notr1ch (maintainer). Since master now calls `SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_DEFAULT_DIRS)` (no CWD search), relative module paths (e.g. the graphics-hook DLL path handed to inject-helper) can fail to load ("inject -4"). The fix resolves `bin_path`/`data_path` to absolute paths (normalising `\` back to `/` on Windows) before handing them to module callbacks. The PR only fails to apply because `process_found_module` moved; the target code is unchanged in substance.

Evidence:
- `frontend/obs-main.cpp:932`, `plugins/win-capture/inject-helper/inject-helper.c:101` `SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_DEFAULT_DIRS)`.
- `libobs/obs-module.c:755-795` `process_found_module`: `info.bin_path = parsed_bin_path.array; info.data_path = parsed_data_dir;` (relative).
- `plugins/win-capture/game-capture.c:918-955` `inject_hook` uses `obs_module_file(...)`/`get_hook_path` → `create_inject_process`.
- `libobs/util/platform.h:114` `os_get_abs_path_ptr` exists.

Slice:
- Port the PR's `fixup_path()` helper and the two `info.*_path = fixup_path(os_get_abs_path_ptr(...))` lines (with matching `bfree`) into the current `process_found_module` (~26 lines, `libobs/obs-module.c`). Credit Richard Stanway (notr1ch) as author/co-author.
- Note: the second callback site near `libobs/obs-module.c:~690` (`module_path` for typed module info) is not covered by the PR; leave as-is to keep the slice minimal and note it.
- Test: Windows MSVC build of libobs + win-capture; launch OBS from a different working directory, check log module paths are absolute and game capture via inject-helper works.

Related: none.

---

### [#13768](https://github.com/obsproject/obs-studio/issues/13768) — Removal of deprecated hiding APIs

**Verdict: DEFER_LARGE**

Upstream tracking issue for eventually removing `obs_source_set_hidden`/`obs_source_is_hidden` (deprecated in #13122). Deprecation is already in master; actual removal is a scheduled ABI break for a future major version. Removing early in a private fork would only break third-party plugins compiled against upstream. Nothing to do until upstream's removal milestone.

Evidence:
- `libobs/obs.h:1109,1112` `OBS_DEPRECATED` on both functions.
- Commits `cc6c7629f libobs: Deprecate source hiding`, `6d22a9a7f docs: Add deprecation notice for source hiding` in master.

Related: none.

---

### [#13887](https://github.com/obsproject/obs-studio/issues/13887) — T-Bar controlled via frontend API always cancels the transition

**Verdict: IMPLEMENT (fixed by the #13143 combined slice)**

Same root cause as #13143: `obs_frontend_set_tbar_position` never updates the slider, so `TBarReleased` reads 0 and cancels; `get_tbar_position` returns 0. The reporter's suggested fix (drive the widget so the slider is the single source of truth) is exactly the #13143 approach.

Evidence:
- `frontend/OBSStudioAPI.cpp:115-123`.
- `frontend/widgets/OBSBasic_Transitions.cpp:750-776`.

Slice: see #13143 (single commit covering 13128, 13143, 13887).

Related: 13143, 13128.

---

### [#14029](https://github.com/obsproject/obs-studio/issues/14029) — Re-enable legacy plugin warning icon before legacy paths are disabled

**Verdict: DEFER_LARGE (maintainer-scheduled; "do not open PRs")**

Tracking issue: the warning icon in the plugin manager's legacy notice was intentionally removed for 33.0 and is planned to return around 33.2. The code is present but commented out. This is a timed UX decision owned by upstream, explicitly closed to contributions; nothing to implement now.

Evidence:
- `frontend/plugin-manager/InstalledPluginRow.cpp:106-117` warning icon `QLabel` creation and `addWidget` commented out.
- `frontend/plugin-manager/InstalledPluginRow.cpp:161` `getWarningIcon()` still present.

Related: none.

---

### [#14043](https://github.com/obsproject/obs-studio/pull/14043) — plugins/effects: fix int-in-float-arithmetic typos

**Verdict: IMPLEMENT (cherry-pick-pr)**

Two `yuv *= 65535. / 4095;` lines are inconsistent with the two identical lines written `65535. / 4095.;` in the same file, and `float4 color = 8*E;` is the only int literal in the sharpness kernel. No behaviour change on HLSL/desktop GLSL (implicit promotion), but correct and consistent for strict GLSL front-ends. 3 lines, applies.

Evidence:
- `libobs/data/format_conversion.effect:754,808` `65535. / 4095.;` vs `:767,781` `65535. / 4095;`.
- `plugins/obs-filters/data/sharpness.effect:50` `float4 color = 8*E;`.

Slice:
- Cherry-pick `96ed4d161`.
- Test: Windows build, run OBS with a P010/I010-type source (or any) and the Sharpen filter on D3D11 to confirm shaders still compile (check log for effect errors). Shader compile on OpenGL path UNTESTED on this box.

Related: none.
