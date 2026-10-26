# Upstream triage — batch scripting-api-01

- Batch: scripting-api-01 (area hint: scripting-api; several items are actually libobs/frontend/plugins)
- Items: 4628, 5282, 6491, 6674, 7912, 8596, 8936, 9464, 9973, 10217, 10380, 10532, 10533, 11161, 11246, 11372, 11538, 11696, 12096, 12116, 12172, 12285
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; code read at master; PR heads at `refs/upstream-pr/<N>`.
  Local git is 2.33 (no `merge-tree --write-tree`), so applicability was checked with the legacy
  three-way `git merge-tree <merge-base> master refs/upstream-pr/N` and counting `+<<<<<<<` markers.
  No GitHub comment threads were fetched.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 4628 | issue | IMPLEMENT |
| 5282 | issue | DEFER_LARGE |
| 6491 | issue | CANNOT_VERIFY |
| 6674 | issue | DEFER_LARGE |
| 7912 | issue | IMPLEMENT |
| 8596 | issue | IMPLEMENT |
| 8936 | issue | IMPLEMENT |
| 9464 | issue | IMPLEMENT |
| 9973 | PR | IMPLEMENT (cherry-pick) |
| 10217 | issue | DEFER_LARGE |
| 10380 | issue | CANNOT_VERIFY |
| 10532 | issue | ALREADY_ADDRESSED |
| 10533 | issue | ALREADY_ADDRESSED |
| 11161 | PR | DEFER_LARGE |
| 11246 | issue | ALREADY_ADDRESSED |
| 11372 | issue | IMPLEMENT |
| 11538 | issue | IMPLEMENT (docs) |
| 11696 | issue | IMPLEMENT (partial: invalid size fallback) |
| 12096 | issue | CANNOT_VERIFY |
| 12116 | issue | IMPLEMENT |
| 12172 | PR | IMPLEMENT (cherry-pick, trivial conflict) |
| 12285 | PR | ALREADY_ADDRESSED |

---

### [#4628](https://github.com/obsproject/obs-studio/issues/4628) — Python scripting 'stderr_logger' does not reimplement 'isatty'

**Verdict: IMPLEMENT**

The Python startup script replaces `sys.stdout`/`sys.stderr` with tiny logger classes that only define
`write` and `flush`. Libraries (youtube_dl, many others) call `sys.stderr.isatty()`, which raises
`AttributeError`. Confirmed directly in code.

Evidence:
- `shared/obs-scripting/obs-scripting-python.c:35-47` — `stdout_logger` / `stderr_logger` define only `write` and `flush`.

Slice plan:
- Add `def isatty(self): return False` to both logger classes in the embedded `startup_script` (optionally also `fileno` is NOT added, since raising is the correct behaviour for a non-file stream).
- Files: `shared/obs-scripting/obs-scripting-python.c` (~4 lines).
- Test: requires a Python-enabled build; on this box the obs-scripting Python module may not be configured — mark UNTESTED unless the build has `ENABLE_SCRIPTING_PYTHON`. Manual check: script calling `sys.stderr.isatty()` returns False.

Related: none.

---

### [#5282](https://github.com/obsproject/obs-studio/issues/5282) — Deadlock between threads using data->sources_mutex and current_lua_script->mutex

**Verdict: DEFER_LARGE**

Lock-order inversion between libobs internal locks and the single per-script Lua mutex. Every Lua
callback (signals, frontend events, source callbacks) takes `current_lua_script->mutex`
(`lock_callback()`), and those callbacks are invoked from libobs while libobs holds its own locks
(e.g. sources mutex during signal emission), while the script, holding its mutex, calls back into libobs
which takes those same locks. Fixing this needs a redesign of Lua script locking (e.g. per-thread
Lua states, deferring callbacks to a single thread, or a recursive/global ordering), not a local patch.

Evidence:
- `shared/obs-scripting/obs-scripting-lua.h:89-98` — `lock_callback()` takes the script mutex around every callback.
- `shared/obs-scripting/obs-scripting-lua.c:296,338,385,431,509` — callback wrappers lock the script mutex.
- `shared/obs-scripting/obs-scripting-lua-source.c:164-171` — `lock_script()` for source callbacks.

Related: 6674 (same design root cause).

---

### [#6491](https://github.com/obsproject/obs-studio/issues/6491) — StereoTool VST: 'Could not find locale.ini path' then crash

**Verdict: CANNOT_VERIFY**

On Windows the frontend resolves data files with paths relative to the process working directory
(`data/obs-studio/` then `OBS_DATA_PATH`), so a VST plug-in whose load/save file dialog changes the
process CWD breaks the lookup; `GetLocaleNames()` then throws an uncaught `const char*`, crashing.
This is a strong hypothesis but it depends on a proprietary third-party VST's behaviour and cannot be
reproduced here. A robust fix (absolute data paths anchored on the executable location for frontend and
libobs module data) is broader; a narrow mitigation (save/restore CWD around the VST editor in
`plugins/obs-vst`) is speculative without a repro.

Evidence:
- `frontend/OBSApp.cpp:1727-1732` — throws "Could not find locale.ini path".
- `frontend/utility/platform-windows.cpp:40-58` — `check_path` builds a relative path and tests `os_file_exists`.

Related: none.

---

### [#6674](https://github.com/obsproject/obs-studio/issues/6674) — Lua: Deadlocks in scripts that implement video sources and call obs_enter_graphics

**Verdict: DEFER_LARGE**

Classic ABBA: the graphics thread holds the graphics context and calls `video_render`, which takes the
script mutex (`lock_script()`); meanwhile `create`/`destroy`/`script_unload` run with the script mutex
held and call `obs_enter_graphics()`. Python solves a similar problem by releasing the GIL around
`obs_enter_graphics` (`obspython.i:135-138`), but Lua has one non-reentrant state per script; it
cannot simply release the mutex mid-call safely. Requires a locking redesign.

Evidence:
- `shared/obs-scripting/obs-scripting-lua-source.c:179-204` — create runs under `definition_mutex` + script mutex.
- `shared/obs-scripting/obs-scripting-lua-source.c:164-171` — `lock_script()` used by render callbacks too.
- `shared/obs-scripting/obspython/obspython.i:135-138` — Python special-cases `obs_enter_graphics` with `%thread`.

Related: 5282.

---

### [#7912](https://github.com/obsproject/obs-studio/issues/7912) — obs_source_set_sync_offset() from a module/script has no real effect

**Verdict: IMPLEMENT**

Root cause found. In `source_output_audio_data`, when the sync offset changes the code only forces a
re-placement of audio (`push_back = false`) if the *previous* offset was non-zero. On the first change
from 0 to X, `push_back` stays true, so audio keeps being appended contiguously to the existing buffer
and the new offset is never applied (`last_sync_offset` is then updated, so it never retries). A second
change (X -> Y, previous non-zero) does take effect — exactly the "call it twice" behaviour reported.
The UI appears to work because spin-box edits generate several successive changes. Guard dates from
`41fa9c1bd` (2016) and has no stated rationale; at startup `next_audio_sys_ts_min` is 0 so `push_back`
is false anyway, making the guard unnecessary.

Evidence:
- `libobs/obs-source.c:1675-1685` — `if (source->last_sync_offset != sync_offset) { if (source->last_sync_offset) push_back = false; ... }`.
- `libobs/obs-source.c:4583-4597` — setter just stores the value.
- `git show 41fa9c1bd` — commit that introduced the guard.

Slice plan:
- Drop the inner `if (source->last_sync_offset)` so any offset change sets `push_back = false`.
- Files: `libobs/obs-source.c` (~2 lines).
- Test: libobs builds on Windows (MSVC). Behavioural check (record with offset set once via script) is manual — UNTESTED unless done by hand.

Related: none.

---

### [#8596](https://github.com/obsproject/obs-studio/issues/8596) — Editable list buttons (VLC playlist) lack screen-reader labels

**Verdict: IMPLEMENT**

The editable-list side buttons are icon-only `QPushButton`s with no text, tooltip or accessible name,
so NVDA announces only "button". Applies to every `OBS_PROPERTY_EDITABLE_LIST` (VLC source, slideshow).

Evidence:
- `shared/properties-view/properties-view.cpp:713-722` — `NewButton()` creates an icon-only button.
- `shared/properties-view/properties-view.cpp:760-765` — add/remove/edit/up/down buttons created via `NewButton`.
- `frontend/data/locale/en-US.ini:18-25` — existing keys `Add`, `Remove`, `MoveUp`, `MoveDown`; `Basic.PropertiesWindow.EditEditableListEntry` exists for edit.

Slice plan:
- Add a `const QString &name` parameter to `NewButton`, call `button->setToolTip(name); button->setAccessibleName(name);`.
- Pass `tr("Add")`, `tr("Remove")`, `tr("Basic.PropertiesWindow.EditEditableListEntry").arg(desc)` (or a new key), `tr("MoveUp")`, `tr("MoveDown")`.
- Files: `shared/properties-view/properties-view.cpp` (~15 lines).
- Test: MSVC build of `properties-view`/frontend on this box; visual check of tooltips. Screen reader check UNTESTED.

Related: none.

---

### [#8936](https://github.com/obsproject/obs-studio/issues/8936) — Lua scripting OBS_ALIGN_* constants return nil

**Verdict: IMPLEMENT**

The `OBS_ALIGN_*` macros (and `MODULE_*`, `OBS_OUTPUT_*`, `OBS_VIDEO_*` codes) live in `obs-defs.h`,
which `obs.h` `#include`s but SWIG does not follow nested includes, and neither interface file
`%include`s `obs-defs.h`. Hence the constants are missing in both Lua and Python.

Evidence:
- `libobs/obs-defs.h:23-27` — `#define OBS_ALIGN_*`.
- `libobs/obs.h:33` — `#include "obs-defs.h"` (not seen by SWIG).
- `shared/obs-scripting/obslua/obslua.i:85-104` and `obspython/obspython.i:107-133` — `%include` lists lack `obs-defs.h`.

Slice plan:
- Add `%include "obs-defs.h"` before `%include "obs.h"` in both `.i` files (header is pure `#define`s, safe for SWIG).
- Files: `shared/obs-scripting/obslua/obslua.i`, `shared/obs-scripting/obspython/obspython.i` (2 lines).
- Test: needs SWIG + scripting build; if not configured locally, UNTESTED. Manual: `obs.OBS_ALIGN_LEFT == 1`.

Related: 11538, 12116, 9973 (same SWIG interface files).

---

### [#9464](https://github.com/obsproject/obs-studio/issues/9464) — Keep hotkeys if plugin is not loaded

**Verdict: IMPLEMENT**

Frontend hotkeys live in the profile config by name and are only overwritten for hotkeys present
(`OBSBasicSettings.cpp:3741`), and a source of a missing type registers no hotkeys so
`save_context_hotkeys` returns NULL and the loaded `hotkey_data` is kept. But when a plugin registers
hotkeys on *another* plugin-independent source (e.g. filters registering on their parent source), on
save the parent's `hotkey_data` is replaced with only the hotkeys currently registered, dropping the
plugin's saved bindings. Merging the previously loaded data first preserves unknown entries.

Evidence:
- `libobs/obs-hotkey.c:714-722` — `save_context_hotkeys` builds a fresh object from registered hotkeys only.
- `libobs/obs.c:2471-2477` — saved object replaces `context.hotkey_data`.
- `libobs/obs-hotkey.c:706-712` — registered hotkeys are always written (even empty arrays), so merged stale data is overridden for known hotkeys.

Slice plan:
- In `save_context_hotkeys`, after `obs_data_create()`, call `obs_data_apply(result, context->hotkey_data)` (if non-NULL) before enumerating registered hotkeys.
- Files: `libobs/obs-hotkey.c` (~3 lines). Trade-off: hotkey names a plugin stops using persist in the JSON (harmless).
- Test: libobs builds on Windows; behavioural check with a plugin removed is manual — UNTESTED otherwise.

Related: none.

---

### [#9973](https://github.com/obsproject/obs-studio/pull/9973) — obs-scripting: Fix memory leak in returned char *

**Verdict: IMPLEMENT (cherry-pick-pr)**

Adds `%newobject` for functions returning `bmalloc`'d strings so SWIG frees them with the existing
`newfree` typemap. Master has the typemap but no `%newobject` declarations, so these leak in both Lua
and Python. Merges cleanly (0 conflict markers).

Evidence:
- `shared/obs-scripting/obslua/obslua.i:51-53`, `obspython/obspython.i:63-65` — `newfree` typemap defined but unused.
- `frontend/api/obs-frontend-api.h:139,144,244,249-251` and `libobs/util/platform.h:50,104,107,114,167,197` — return caller-owned `char *`.
- `git diff master...refs/upstream-pr/9973` — 26 lines across the two `.i` files.

Slice plan:
- Cherry-pick `13c9cf26e` (author CodeYan01, GPL-2.0-or-later). Optionally extend with `obs_frontend_get_current_profile_path`, `os_quick_read_mbs_file`, `os_get_executable_path_ptr`, also caller-owned.
- Test: SWIG scripting build if available; else UNTESTED.

Related: 8936, 11538, 12116.

---

### [#10217](https://github.com/obsproject/obs-studio/issues/10217) — No support for vertex texture fetch in Lua

**Verdict: DEFER_LARGE**

Not Lua specific: the graphics backends bind textures only to the pixel stage. D3D11 `device_load_texture`
calls only `PSSetShaderResources`, and samplers only `PSSetSamplers`. Supporting VTF needs per-stage texture
tracking in d3d11, GL and Metal backends plus effect-parser handling (VS must use `SampleLevel`/`Load`).
A graphics-API feature, not a small fix.

Evidence:
- `libobs-d3d11/d3d11-subsystem.cpp:1873-1881` — `device_load_texture_internal` binds PS only.
- `libobs-d3d11/d3d11-shader.cpp:339-376` — texture params loaded via `device_load_texture`, samplers via `PSSetSamplers`.

Related: none.

---

### [#10380](https://github.com/obsproject/obs-studio/issues/10380) — Decklink output wrong pixel format on some resolutions

**Verdict: CANNOT_VERIFY**

Decklink output always creates frames in `bmdFormat8BitBGRA` (or 10-bit RGBXLE for HDR). The report
(UltraStudio 4K Mini at UHD60) suggests the device needs a different format/row layout, but no
details on which format is needed; hardware-specific and untestable here.

Evidence:
- `plugins/decklink/decklink-device-instance.cpp:600` and `:754-755` — output pixel format fixed to BGRA/RGBXLE.

Related: none.

---

### [#10532](https://github.com/obsproject/obs-studio/issues/10532) — Websocket crash on GetCurrentProgramScene while current scene is unset

**Verdict: ALREADY_ADDRESSED**

The precondition (removing all scenes via websocket) is now blocked: `RemoveScene` refuses to remove the
last scene of the main canvas, so the current program scene can no longer become unset through the API.
(Note `GetCurrentProgramScene` would still assign a NULL `const char*` into json if it were NULL, but
the reachable path is closed; obs-websocket is a separate submodule.)

Evidence:
- `plugins/obs-websocket/src/requesthandler/RequestHandler_Scenes.cpp:307-309` — "You cannot remove the last scene in the collection."
- `plugins/obs-websocket/src/requesthandler/RequestHandler_Scenes.cpp:127-135` — getter.

Related: 10533.

---

### [#10533](https://github.com/obsproject/obs-studio/issues/10533) — Websocket crash when recreating active scene

**Verdict: ALREADY_ADDRESSED**

Same root cause as 10532 (removing every scene including the active one); blocked by the last-scene
check in `RemoveScene`.

Evidence:
- `plugins/obs-websocket/src/requesthandler/RequestHandler_Scenes.cpp:307-309`.

Related: 10532.

---

### [#11161](https://github.com/obsproject/obs-studio/pull/11161) — Compressor filter: N sidechain sources

**Verdict: DEFER_LARGE**

Feature PR marked "Request for Comments": rewrites the compressor sidechain (≈350 lines changed in
`compressor-filter.c`), adds a new editable-list widget type for sources in properties-view, and adds a
property flag to `libobs/obs-properties.h` (public API). Has a merge conflict with master and changes
saved settings format; needs maintainer design decisions.

Evidence:
- `git diff master...refs/upstream-pr/11161 --stat` — 4 files, +261/-178, incl. `libobs/obs-properties.h`.
- legacy merge-tree: 1 conflict block.

Related: none.

---

### [#11246](https://github.com/obsproject/obs-studio/issues/11246) — pt-BR: No obs-websocket menu in Tools (macOS)

**Verdict: ALREADY_ADDRESSED**

The pt-BR title "Configurações do servidor WebSocket" matches Qt's macOS text-heuristic menu role
("config…"), so Qt moved the action into the application menu. The frontend API now forces
`QAction::NoRole` on all tools-menu actions (commit `d3c5d2ce0`, "frontend: Set Frontend-API QActions role to NoRole").

Evidence:
- `frontend/OBSStudioAPI.cpp:317-323` and `:333-334` — `action->setMenuRole(QAction::NoRole)`.
- `plugins/obs-websocket/data/locale/pt-BR.ini:2` — translated title begins with "Configurações".

Related: none.

---

### [#11372](https://github.com/obsproject/obs-studio/issues/11372) — obs_frontend_set_tbar_position() does not update the T-bar slider

**Verdict: IMPLEMENT**

Regression from `8d4a0b364` ("UI: Use valueChanged() signal for T-Bar everywhere"), which removed
`tBar->setValue(value)` from `TBarChanged` because the slider's `valueChanged` now drives `TBarChanged`.
The API still invokes `TBarChanged` directly, so the transition moves but the slider (and
`obs_frontend_get_tbar_position`, which reads `tBar->value()`) do not.

Evidence:
- `frontend/OBSStudioAPI.cpp:115-123` — set invokes `OBSBasic::TBarChanged`; get returns `main->tBar->value()`.
- `frontend/widgets/OBSBasic_StudioMode.cpp:96-103` — `valueChanged` -> `TBarChanged`.
- `git show 8d4a0b36451218cd13af58828eb7788e1df12551` — removal of `tBar->setValue(value)`.

Slice plan:
- In `obs_frontend_set_tbar_position`, invoke a lambda on `main` that calls `main->tBar->setValue(position)` when `tBar` exists (signal drives `TBarChanged`), falling back to `TBarChanged(position)` otherwise.
- Files: `frontend/OBSStudioAPI.cpp` (~6 lines).
- Test: MSVC frontend build on this box; functional test needs a plugin/script calling the API — likely UNTESTED.

Related: none.

---

### [#11538](https://github.com/obsproject/obs-studio/issues/11538) — frontend_source_list_free not found in obspython

**Verdict: IMPLEMENT (docs)**

`obs_frontend_source_list_free` is a `static inline` in the header and cannot be exported; in scripting,
`obs_frontend_get_scenes` (and friends) are hand-wrapped to return native lists, which must be released
with `source_list_release`. This is not documented in the scripting docs, which only describe
`obs_enum_sources` etc.

Evidence:
- `frontend/api/obs-frontend-api.h:80` — `static inline void obs_frontend_source_list_free`.
- `shared/obs-scripting/obs-scripting-python-frontend.c:52-60`, `obs-scripting-lua-frontend.c:52` — wrappers return lists.
- `docs/sphinx/scripting.rst:186-312` — "Other Differences From the C API" lacks frontend list functions.

Slice plan:
- Add entries for `obs_frontend_get_scenes()`, `obs_frontend_get_transitions()` (and other list-returning frontend wrappers present in the python/lua frontend files) stating they return lists released with `source_list_release()`.
- Files: `docs/sphinx/scripting.rst` (~20 lines).
- Test: docs only (optionally build sphinx); no code test needed.

Related: 12116, 8936, 9973.

---

### [#11696](https://github.com/obsproject/obs-studio/issues/11696) — Image Slide Show: aspect ratio doesn't work, size 0x0

**Verdict: IMPLEMENT (partial)**

Slideshow mk2 (`a4f229002`) intentionally dropped "Automatic" and aspect-ratio presets because images are
decoded lazily; the combo offers only the canvas resolution. But the size field is an editable combo,
and any value that is not `WxH` (e.g. "16:9", "Automatic" from old settings) makes `sscanf` fail and sets
`cx = cy = 0`, giving a 0x0 source — the reported transform behaviour. Bringing back "Automatic" is a
design decision (out of slice); fixing the 0x0 fallback and accepting `W:H` is small.

Evidence:
- `plugins/image-source/obs-slideshow-mk2.c:535-543` — failed parse -> `cx = cy = 0` (`valid` then unused).
- `plugins/image-source/obs-slideshow-mk2.c:570-573` — 0x0 passed to `obs_transition_set_size`.
- `plugins/image-source/obs-slideshow-mk2.c:1017-1021` — combo only lists canvas resolution.
- `plugins/image-source/obs-slideshow.c:427-460,859-912` — legacy slideshow parsed `W:H` and "Automatic".

Slice plan:
- If `WxH` parse fails, try `W:H` and derive size from canvas base height (`cy = base_height`, `cx = cy*W/H`); otherwise fall back to canvas base resolution instead of 0x0.
- Optionally add the aspect presets back to the combo list.
- Files: `plugins/image-source/obs-slideshow-mk2.c` (~25 lines).
- Test: MSVC build of image-source; manual check in OBS that "16:9" yields a non-zero size.

Related: none.

---

### [#12096](https://github.com/obsproject/obs-studio/issues/12096) — Loading Python crashes OBS instantly

**Verdict: CANNOT_VERIFY**

Python 3.10 is within the supported runtime range (loader probes down from 3.12), and no crash stack is
in the report body (log links not fetched). Steam install + multiple Python installs; environment-specific.

Evidence:
- `shared/obs-scripting/obs-scripting-python-import.c:42,76-101` — runtime version probing.

Related: none.

---

### [#12116](https://github.com/obsproject/obs-studio/issues/12116) — can not use obs_source_enum_filters() in python script

**Verdict: IMPLEMENT**

Lua `%ignore`s `obs_source_enum_filters` and provides a hand-written wrapper returning a table of
ref-counted filters. Python does neither: the raw C signature (callback pointer + void*) is exported,
which is unusable from Python. Port the Lua wrapper pattern (same as Python's existing `obs_enum_sources`).

Evidence:
- `shared/obs-scripting/obslua/obslua.i:68` — `%ignore obs_source_enum_filters;` (missing in `obspython.i:79-80`).
- `shared/obs-scripting/obs-scripting-lua.c:588-609,1012` — Lua wrapper.
- `shared/obs-scripting/obs-scripting-python.c:1012-1033,1199-1220` — Python `enum_sources` pattern and `DEF_FUNC` table.

Slice plan:
- `obspython.i`: add `%ignore obs_source_enum_filters;`.
- `obs-scripting-python.c`: add `source_enum_filters_proc` + `source_enum_filters(PyObject*, args)` returning a list of addref'd filters; register `DEF_FUNC("obs_source_enum_filters", ...)`.
- `docs/sphinx/scripting.rst`: document it (release with `source_list_release`).
- Files: 3, ~40 lines.
- Test: needs Python scripting build; else UNTESTED.

Related: 11538, 8936, 9973.

---

### [#12172](https://github.com/obsproject/obs-studio/pull/12172) — plugins: Replace reinterpret_cast with static_cast

**Verdict: IMPLEMENT (cherry-pick-pr)**

Pure no-op cleanup (void* -> T* conversions) in Windows/decklink plugins. All target casts still exist
on master. One trivial conflict in `win-dshow.cpp` `UpdateDShowInput` (master added braces around the
`if`); resolve by keeping master's braces with `static_cast`.

Evidence:
- `git diff master...refs/upstream-pr/12172 --stat` — 6 files, 29/29 lines.
- `grep -c reinterpret_cast`: obs-text 9, win-dshow 12, win-dshow-encoder 5, win-wasapi 2, decklink 1+1 still present.
- legacy merge-tree: one conflict block in `plugins/win-dshow/win-dshow.cpp`.

Slice plan:
- Cherry-pick `c73c88dda` (author safocl), resolve the single brace conflict.
- Test: MSVC build of win-dshow, win-wasapi, obs-text, decklink on this box.

Related: none.

---

### [#12285](https://github.com/obsproject/obs-studio/pull/12285) — libobs: Only load modules once

**Verdict: ALREADY_ADDRESSED**

Master already skips a plugin whose module name is already loaded, with a better log message, in the
module-loading callback (from `11a8445aa` "frontend: Update app module loading behavior"). The PR's
alternative check inside `obs_open_module` would also leak the dlopen handle and strings on early return.

Evidence:
- `libobs/obs-module.c:516-526` — "Skipping plugin '%s' at '%s', already loaded from '%s'".
- `git diff master...refs/upstream-pr/12285` — 5-line check in `obs_open_module` after `os_dlopen`.

Related: none.
