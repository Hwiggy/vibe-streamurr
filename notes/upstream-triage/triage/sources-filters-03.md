# Upstream triage — batch sources-filters-03

- Batch id: sources-filters-03 (area hint: sources-filters)
- Items: 10434, 10448, 10466, 10488, 10492, 10599, 10605, 10637, 10645, 10669, 10681, 10682, 10685, 10700, 10735, 10743, 10852, 11003, 11045, 11077, 11089, 11091
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; PR heads from `refs/upstream-pr/<N>`; code read on master. No GitHub comment threads were fetched (0 WebFetch used).
- Applicability check: local git is 2.33 (no `merge-tree --write-tree`), so each PR diff (`git diff master...refs/upstream-pr/N`) was checked with `git apply --cached --check` against a throw-away index (`GIT_INDEX_FILE` in the scratchpad, `git read-tree master`). Most "does not apply" results come from the upstream clang-format column-limit change 80 -> 120 (commit a1fbf1015), not from logic conflicts.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 10434 | PR | IMPLEMENT (partial-pr, reformat + extend to read_from_end) |
| 10448 | issue | IMPLEMENT (new-change) |
| 10466 | issue | IMPLEMENT (new-change) |
| 10488 | issue | CANNOT_VERIFY |
| 10492 | PR | ALREADY_ADDRESSED |
| 10599 | issue | DEFER_LARGE |
| 10605 | PR | IMPLEMENT (partial-pr, F32 only + premultiply) |
| 10637 | issue | CANNOT_VERIFY |
| 10645 | issue | CANNOT_VERIFY |
| 10669 | issue | CANNOT_VERIFY |
| 10681 | issue | DEFER_LARGE |
| 10682 | issue | CANNOT_VERIFY |
| 10685 | issue | CANNOT_VERIFY |
| 10700 | issue | IMPLEMENT (new-change) |
| 10735 | PR | IMPLEMENT (partial-pr, with gradient fix) |
| 10743 | issue | IMPLEMENT (new-change) |
| 10852 | issue | CANNOT_VERIFY |
| 11003 | issue | CANNOT_VERIFY |
| 11045 | PR | DEFER_LARGE (superseded locally by 10434 slice) |
| 11077 | PR | IMPLEMENT (cherry-pick, reformat) |
| 11089 | issue | CANNOT_VERIFY |
| 11091 | PR | IMPLEMENT (cherry-pick + one extra call site) |

---

### [#10434](https://github.com/obsproject/obs-studio/pull/10434) — text-freetype2: Fix bug with null characters

**Verdict: IMPLEMENT** (partial-pr)

Reasoning: Fixes upstream issue #7595 (text file containing NUL bytes renders only up to the first NUL). Root cause confirmed on master: `load_text_from_file` reads the whole file then sizes and converts using `strlen(tmp_read)`, which stops at the first NUL (`plugins/text-freetype2/text-functionality.c:416-417`). The same `strlen` pattern exists in `read_from_end` (chat-log mode) further down the file. The PR also fixes the `fread(buf, filesize, 1, f)` call that returns an item count rather than a byte count. Patch fails to apply only because of the 120-column reformat; logic is unchanged on master. Chosen over #11045 because it is self-contained in the plugin and does not change libobs utf8 behaviour.

Evidence:
- `plugins/text-freetype2/text-functionality.c:416-417` — `bzalloc((strlen(tmp_read)+1)*sizeof(wchar_t))` / `os_utf8_to_wcs(tmp_read, strlen(tmp_read), ...)`.
- `plugins/text-freetype2/text-functionality.c` `read_from_end` (~line 490+) — identical `strlen`-based conversion for the UTF-8 branch.
- `git apply --check` fails at text-functionality.c:458 (formatting drift only).

Related: #11045 (alternative fix for same bug), upstream issue #7595.

Slice plan:
- Re-apply the PR hunk by hand in `load_text_from_file` (fread byte count + strip NUL bytes into a sanitized buffer, convert with explicit length), clang-format to 120 cols.
- Apply the same NUL-stripping to the UTF-8 branch of `read_from_end` (small extension; note in commit).
- Preserve authorship (lourencop01) via `--author` / Co-authored-by.
- Files: `plugins/text-freetype2/text-functionality.c`. ~30 lines.
- Test: MSVC build of `text-freetype2`; manual: Text (FreeType 2) source reading a file with embedded NUL bytes, verify all text renders, plus chat-log mode.

### [#10448](https://github.com/obsproject/obs-studio/issues/10448) — Selecting multiple sources and applying Show or Hide transitions only affects the first source

**Verdict: IMPLEMENT** (new-change)

Reasoning: Defect confirmed. In `OBSBasic::CreateVisibilityTransitionMenu` the `setTransition` and `setDuration` lambdas act only on `GetCurrentSceneItem()`, while the sibling "Paste" lambda in the same menu already iterates `GetAllSelectedSourceItems()`. So multi-select apply is an established UI convention that the set path simply misses.

Evidence:
- `frontend/widgets/OBSBasic_Transitions.cpp:1007-1063` — `setTransition` uses `main->GetCurrentSceneItem()` only.
- `frontend/widgets/OBSBasic_Transitions.cpp:1064-1070` — `setDuration` uses `GetCurrentSceneItem()` only.
- `frontend/widgets/OBSBasic_Transitions.cpp:1107-1122` — `pasteTransition` loops `GetAllSelectedSourceItems()` and calls `PasteShowHideTransition` per item.
- `frontend/widgets/OBSBasic_SceneItems.cpp:1025-1028` — `GetAllSelectedSourceItems()` helper.

Related: #10852 (different show/hide transition bug).

Slice plan:
- Factor the body of `setTransition` into a per-item helper (create private transition, set duration default, push undo action) and call it for every row in `GetAllSelectedSourceItems()` (skip null items). Open the properties window only once (for the first item) to avoid N dialogs.
- Make `setDuration` loop over all selected items.
- Files: `frontend/widgets/OBSBasic_Transitions.cpp` (maybe a declaration in `frontend/widgets/OBSBasic.hpp`). ~50 lines.
- Test: MSVC build of obs-studio frontend; manual: select 3 sources, set Show Transition = Fade, verify each item reports Fade; undo restores each.

### [#10466](https://github.com/obsproject/obs-studio/issues/10466) — Segfault from sceneitem infinite recursion nesting

**Verdict: IMPLEMENT** (new-change)

Reasoning: Defect confirmed. Adding a source to a scene goes through `obs_scene_add` which rejects recursion via `obs_source_add_active_child` (descendant check). But moving an existing item into a group via drag/drop uses `obs_scene_reorder_items2` (and the API `obs_sceneitem_group_add_item`), which re-parent items into the group's scene with no recursion check. In the repro, Scene B holds Scene A and Group A (Group A also lives in Scene A); dropping Scene A into Group A makes Group A contain Scene A which contains Group A -> infinite render recursion. The SourceTree drop handler already rejects "group into group" but not "scene containing the group into the group".

Evidence:
- `libobs/obs-scene.c:2281-2285` — `obs_scene_add` refuses on `!obs_source_add_active_child(...)` ("infinite source recursion").
- `libobs/obs-source.c:4725-4748` — descendant check via `obs_source_enum_full_tree`.
- `libobs/obs-scene.c:3701-3735` — `obs_sceneitem_group_add_item` has no recursion check.
- `libobs/obs-scene.c:3856-3920` — `obs_scene_reorder_items2` re-parents sub-items into group scenes with no check.
- `frontend/components/SourceTree.cpp:218-224` — only rejects dropping groups onto groups.
- `libobs/obs.h:1246` — `obs_source_enum_full_tree` is public, usable from the frontend.

Related: none in batch.

Slice plan:
- In `SourceTree::dropEvent`, after the `dropGroup && hasGroups` rejection, if `dropGroup` is set, for each dragged item run `obs_source_enum_full_tree(item_source, cb, &info)` looking for the group's source (or item source == group source); if found, call `QListView::dropEvent(event)` and return (same pattern as the existing invalid-drop branch).
- Defensive: add the same descendant check to `obs_sceneitem_group_add_item` in libobs (return early with a LOG_WARNING).
- Files: `frontend/components/SourceTree.cpp`, `libobs/obs-scene.c`. ~35 lines.
- Test: MSVC build; manual repro steps from the issue, verify drop is rejected and no crash.

### [#10488](https://github.com/obsproject/obs-studio/issues/10488) — Video with "Restart when active" delayed on scene switch in v30.1

**Verdict: CANNOT_VERIFY**

Reasoning: Report is a one-frame timing regression between 30.0 and 30.1 in the media source on activation. No specific code change is identified in the report, and the media source / ffmpeg playback path has been substantially reworked since 30.1. Root cause cannot be pinned from code alone; needs a repro with frame-level capture on current master.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c` — restart-on-activate path (activate callback restarts playback asynchronously, so a frame of "nothing" before the first decoded frame is plausible but not provably a regression).

Related: #10852.

### [#10492](https://github.com/obsproject/obs-studio/pull/10492) — libobs: Fix image slideshow transitioning from wrong source

**Verdict: ALREADY_ADDRESSED**

Reasoning: The PR moves source B into slot A at `obs_transition_start` when the previous transition never finished (stop not called because audio was not rendered). Master already handles the interrupted-transition case: `obs_transition_start` now calls `obs_transition_set(transition, transition_sources[1])` whenever the transition is still active, which promotes B to A. This was added by upstream commit 0df94d5cae "image-source: Fix interrupted transitions" (2026-02-04). The PR no longer applies.

Evidence:
- `libobs/obs-source-transition.c:338-340` — `if (transition_active(transition)) obs_transition_set(transition, transition->transition_sources[1]);`
- `libobs/obs-source-transition.c:317-320` — `transition_active` is true while either audio or video is still transitioning (exactly the stuck-audio case the PR describes).
- `git blame` -> 0df94d5cae (Warchamp7).

Related: upstream issue #6320, #10599.

### [#10599](https://github.com/obsproject/obs-studio/issues/10599) — Reworked Image Slideshow Asynchronus feature does not work

**Verdict: DEFER_LARGE**

Reasoning: The 30.1 slideshow rework made image loading asynchronous; it never added folder watching/rescanning. The reporter expects the playlist to track files added/removed in the folder while active. The file list is built in update and only re-validated for the missing-files dialog. Live rescanning is a feature that needs design decisions (rescan cadence, interaction with preloading and slide order/randomisation, hotkey indices). Not a small bug fix.

Evidence:
- `plugins/image-source/obs-slideshow-mk2.c:289,305` — slides are created as private image sources from the list built at update.
- `plugins/image-source/obs-slideshow-mk2.c:1100-1129` — `os_file_exists` is only used for `missing_files`, not during playback.

Related: #10492, #10700.

### [#10605](https://github.com/obsproject/obs-studio/pull/10605) — libobs: Use floating point textures when loading floating point image files

**Verdict: IMPLEMENT** (partial-pr)

Reasoning: Master still converts RGBAF16/F32 decoded images down to 8-bit BGRA; `convert_format` has no float cases. FFmpeg minimum is 8.0 so the pixel formats exist without version guards. However the PR copies float data straight regardless of `alpha_mode`, while the image source requests `GS_IMAGE_ALPHA_PREMULTIPLY` / `PREMULTIPLY_SRGB`, so float images with alpha would be uploaded un-premultiplied (wrong blending). Take the PR but only for RGBAF32LE, and premultiply RGB by A in place when `alpha_mode != GS_IMAGE_ALPHA_STRAIGHT` (float formats are linear, so a plain multiply is correct). Drop F16 (would need half-float math) to keep the slice small. PR fails to apply only due to formatting drift.

Evidence:
- `libobs/graphics/graphics-ffmpeg.c` `convert_format` — only BGRA/RGBA/BGR0/RGBA64BE cases; `AV_PIX_FMT_RGBAF*` absent on master (grep).
- `libobs/CMakeLists.txt:15` — `find_package(FFmpeg 8.0 REQUIRED ...)`.
- `plugins/image-source/image-source.c:55-56` — image source uses PREMULTIPLY alpha modes.
- `git apply --check` fails at graphics-ffmpeg.c:116 (formatting).

Related: none.

Slice plan:
- Port `ffmpeg_image_copy_data_straight(..., channel_bits)` change and the RGBAF32LE branch + `GS_RGBA32F` mapping; add a premultiply loop for non-straight alpha modes. Skip the whitespace-only commit.
- Files: `libobs/graphics/graphics-ffmpeg.c`. ~40 lines. Author: Lain-B preserved.
- Test: MSVC build of libobs; manual: load a 32-bit float RGBA TIFF/EXR in an Image source and compare against an 8-bit export; check alpha edges.

### [#10637](https://github.com/obsproject/obs-studio/issues/10637) — NVIDIA Noise Removal Filter breaks when changing its value (since updating to OBS 30)

**Verdict: CANNOT_VERIFY**

Reasoning: The log shows `NvAFX_Load() failed with error 1` at initialisation, i.e. the NVIDIA Audio Effects SDK/driver failed before the intensity change. On master the update path only calls `NvAFX_SetFloat(INTENSITY_RATIO)` under the mutex when intensity changes, which looks correct; the failure is SDK/GPU-specific and the plugin has since moved to `plugins/nv-filters` with SDK 3.0 support. Needs NVIDIA hardware and the specific SDK version.

Evidence:
- `plugins/nv-filters/nvidia-audiofx-filter.c:323-325` — `NvAFX_Load` failure logging.
- `plugins/nv-filters/nvidia-audiofx-filter.c:470-484` — intensity update path.

Related: none.

### [#10645](https://github.com/obsproject/obs-studio/issues/10645) — Scenes, sources, filters vanishing into thin air

**Verdict: CANNOT_VERIFY**

Reasoning: Scene collection reportedly emptied after a GPU change / Windows reinstall. No reproducible steps, no identified code path; master already backs up corrupt collection files before creating a default scene. Insufficient information.

Evidence:
- `frontend/widgets/OBSBasic_SceneCollections.cpp:1140-1163` — corrupt-file rename + default scene creation path.

Related: #10682.

### [#10669](https://github.com/obsproject/obs-studio/issues/10669) — Resizing and moving sources doesn't follow the mouse pointer right

**Verdict: CANNOT_VERIFY**

Reasoning: Fedora KDE 40 (Wayland, very likely fractional scaling). Pointer-to-preview mapping offsets of this kind come from Qt/Wayland device-pixel-ratio handling and compositor behaviour; no defect identifiable in OBS code without the environment. Needs repro on that platform.

Evidence:
- `frontend/widgets/OBSBasicPreview.cpp` — preview mouse mapping uses Qt device pixel ratio; no obvious bug on Windows.

Related: none.

### [#10681](https://github.com/obsproject/obs-studio/issues/10681) — Additive blending breaks scene transparency

**Verdict: DEFER_LARGE**

Reasoning: Behaviour follows from the blend definitions: additive uses ONE/ONE for both colour and alpha, so an opaque black FX layer adds alpha=1 and makes the nested scene opaque. Groups render their items directly into the parent (no isolated texture), which is why blending leaks out of groups. The request is "isolated group blending like GIMP" and/or changing additive alpha semantics; both alter existing rendering for every user and need a maintainer design decision.

Evidence:
- `libobs/obs-scene.c:78-84` — OBS_BLEND_ADDITIVE = ONE, ONE, ONE, ONE, ADD.
- `libobs/obs-scene.c:736-741` — `item_texture_enabled`: nested scenes use a texrender, groups (`is_group`) do not.

Related: none.

### [#10682](https://github.com/obsproject/obs-studio/issues/10682) — Crash on boot for particular `basic/scenes/Untitled.json`

**Verdict: CANNOT_VERIFY**

Reasoning: The supplied collection has two text_ft2 sources, no scenes, empty `scene_order` and empty `current_scene`. On master the loader falls back to enumerating scenes and calls `SetCurrentScene` with whatever it finds (possibly null). No crash log/stack is provided (macOS, "no crash logs generated"), so the crashing line cannot be identified; may already be fixed by the collection-load rework. Needs a repro on master with a debugger.

Evidence:
- `frontend/widgets/OBSBasic_SceneCollections.cpp:1381-1393` — `!curScene` fallback then `SetCurrentScene(curScene.Get(), true)` which may be null when the file has zero scenes.

Related: #10645.

### [#10685](https://github.com/obsproject/obs-studio/issues/10685) — Mouse Cursor Disappears When Hovering Text Inputs

**Verdict: CANNOT_VERIFY**

Reasoning: Only the default white scheme at size 1 I-beam disappears. Hypothesis from code: that I-beam is a 32bpp colour cursor without alpha that uses XOR (inverting) pixels; `copy_from_color` then derives alpha purely from the AND mask, so inverting pixels (AND=1) become fully transparent. Monochrome cursors go through `copy_from_mask` which does handle inversion. This is plausible but cannot be confirmed without dumping the actual cursor bitmaps on Windows 10, and the fix (per-pixel invert vs alpha blending) needs a design choice. Note it as a lead.

Evidence:
- `plugins/win-capture/cursor-capture.c:58-86` — `copy_from_color` applies `apply_mask` only when no alpha, mapping AND=1 to alpha 0.
- `plugins/win-capture/cursor-capture.c:89-130` — `copy_from_mask` handles "source inverted" pixels for monochrome cursors only.
- `plugins/win-capture/cursor-capture.c:236` — single blend mode per cursor (INVDSTCOLOR for monochrome).

Related: none.

### [#10700](https://github.com/obsproject/obs-studio/issues/10700) — Image source not updating when original file is delete then replaced with the same filename

**Verdict: IMPLEMENT** (new-change)

Reasoning: The image source polls once per second and reloads only when `st_mtime` (1-second resolution) differs from the stored value. The stored timestamp is captured at decode time. Two failure modes follow from the code: (a) a replacement file that keeps the original modification time (Windows Explorer copy preserves mtime) is never detected; (b) if the poll catches the new file while it is still being written, the partial file is decoded (fails or is truncated) and its mtime recorded; when the writer finishes within the same second the mtime is unchanged, so the source never reloads. Both are fixed by also tracking file size (and on failure, forcing a retry).

Evidence:
- `plugins/image-source/image-source.c:33-39` — `get_modified_timestamp` returns only `st_mtime`.
- `plugins/image-source/image-source.c:54-56` — timestamp stored right before decoding.
- `plugins/image-source/image-source.c:245-252` — reload only if `file_timestamp != t`.

Related: #10599.

Slice plan:
- Add `off_t file_size` (or `int64_t`) to `struct image_source`; replace the timestamp helper with one that fills both mtime and size from `os_stat`; reload when either differs.
- Optionally, when `!context->image.loaded` after a load, reset the stored mtime to -1 so the next poll retries (bounded to while showing).
- Files: `plugins/image-source/image-source.c`. ~20 lines.
- Test: MSVC build of image-source; manual: delete image and copy a different image (with preserved older mtime) to the same path; verify it refreshes within ~1s.

### [#10735](https://github.com/obsproject/obs-studio/pull/10735) — obs-text: Render only when changed

**Verdict: IMPLEMENT** (partial-pr)

Reasoning: GDI+ text rendering is expensive and master re-renders on every `Update` and every file-poll even when nothing changed (e.g. obs-websocket setting identical text). The PR applies cleanly. Review found one bug: the change check uses the local `gradient` flag, so turning the gradient OFF (which later forces `color2 = color`, `opacity2 = opacity`) does not mark `needs_render` and the old gradient stays on screen. Fix by computing the effective color2/opacity2 (after the `!gradient` override) before comparing, or by comparing the members after assignment.

Evidence:
- `plugins/obs-text/gdiplus/obs-text.cpp:733` — local `bool gradient` from settings.
- `plugins/obs-text/gdiplus/obs-text.cpp:787-806` — members assigned, then `if (!gradient) { color2 = color; opacity2 = opacity; }`.
- `plugins/obs-text/gdiplus/obs-text.cpp:852` — unconditional `RenderText()` on master.
- `git apply --check` succeeds.

Related: none.

Slice plan:
- Cherry-pick 3e0a0c9be (author exeldro), then a follow-up commit (or amend in the local port) that snapshots old color2/opacity2 and compares them with the final post-override values to set `needs_render`.
- Files: `plugins/obs-text/gdiplus/obs-text.cpp`. ~55 lines.
- Test: Windows-only plugin, buildable with MSVC here; manual: toggle gradient on/off, change text via file and properties, confirm re-render; set identical text and confirm no re-render (debugger/breakpoint on RenderText).

### [#10743](https://github.com/obsproject/obs-studio/issues/10743) — Selected Scale Filter is missing in Logs

**Verdict: IMPLEMENT** (new-change)

Reasoning: libobs logs the canvas downscale filter on video reset, but encoder GPU rescaling (Settings > Output > Rescale Output, multitrack, WHIP simulcast) sets `gpu_scale_type` on the encoder and creates/reuses an encoder-only video mix without logging the filter. Adding a single LOG_INFO line where the scaled mix is chosen is small and diagnostic-only.

Evidence:
- `libobs/obs.c:1554-1589` — "downscale filter" logged only in video reset.
- `libobs/obs-encoder.c:240-310` — encoder-only scaled mix creation using `encoder->gpu_scale_type`, no logging.
- `frontend/utility/AdvancedOutput.cpp:321-322,377-378` — frontend sets scaled size + gpu scale type.

Related: none.

Slice plan:
- Add a small static `get_scale_type_name(enum obs_scale_type)` in `libobs/obs-encoder.c` (or move the switch from obs.c into a shared inline in `obs-internal.h` and reuse it in both places).
- In the GPU-scaling setup function, after a mix is reused or created, `blog(LOG_INFO, "encoder '%s': GPU rescale to %ux%u (%s filter)", ...)`.
- Files: `libobs/obs-encoder.c` (+ optionally `libobs/obs.c`, `libobs/obs-internal.h`). ~25 lines.
- Test: MSVC build of libobs; start a recording with Advanced output rescale enabled and check the log line.

### [#10852](https://github.com/obsproject/obs-studio/issues/10852) — Show Transition/Hide Transition -> Fade only working once

**Verdict: CANNOT_VERIFY**

Reasoning: Labelled confirmed upstream, but the interaction is between show/hide transitions (which add/remove the transition as an active child of the scene and set/clear the item source in the transition) and the media source's restart-on-activate / close-when-inactive / "show nothing when ended" options. No single defect is identifiable by reading `obs_sceneitem_do_transition` and the transition stop handling; it needs a debugger repro on master to see whether the media source fails to receive an activate or receives it while still "ended".

Evidence:
- `libobs/obs-scene.c:4043-4095` — `obs_sceneitem_transition_stop` / `obs_sceneitem_do_transition`.
- `libobs/obs-scene.c:4059-4063` — force-stop of any running show/hide transition before starting a new one.

Related: #10448, #10488.

### [#11003](https://github.com/obsproject/obs-studio/issues/11003) — Captured Game Crashes to Desktop When Switching Scenes

**Verdict: CANNOT_VERIFY**

Reasoning: Null-pointer read inside `graphics_hook32.dll` with Half-Life 1 (OpenGL, 32-bit) on one machine only; not reproducible on a second identical setup. No symbolised stack. The graphics hook is also now versioned separately. Hardware/driver/environment-specific.

Evidence:
- `plugins/win-capture/graphics-hook/gl-capture.c` — the relevant hook; no identifiable null deref without a stack.

Related: none.

### [#11045](https://github.com/obsproject/obs-studio/pull/11045) — libobs/util,text-freetype2: Permit internal nulls

**Verdict: DEFER_LARGE**

Reasoning: Same bug as #10434 but a broader refactor (text_len plumbed through the whole plugin plus a libobs `utf8.c` change). Review on master: the libobs change is effectively behaviour-neutral (with an explicit size the old loop already did not stop at NUL) but adds a `strlen`/`wcslen` pass; the plugin change makes the UTF-16 branch produce no text at all on platforms with 4-byte `wchar_t` (Linux/macOS), and `text_len` is computed as converted-count + 1, so the terminating NUL is counted as a glyph in vertex buffers. It conflicts with master in two files. The local fork takes the smaller #10434 slice instead; this PR stays deferred.

Evidence:
- `git diff master...refs/upstream-pr/11045` — `if (sizeof(wchar_t) == 2) {...}` leaves `srcdata->text` NULL otherwise; `text_len = os_utf8_to_wcs(..., NULL, 0) + 1`.
- `libobs/util/utf8.c` — size-bounded loops already ignore NUL when `insize != 0`.
- `git apply --check` fails on text-freetype2.c and text-functionality.c.

Related: #10434, upstream issue #7595.

### [#11077](https://github.com/obsproject/obs-studio/pull/11077) — text-freetype2: Use the pixel format for reading pixels

**Verdict: IMPLEMENT** (cherry-pick, re-applied after reformat)

Reasoning: `get_pixel_value` decides between 8-bit gray and 1-bit mono by the requested render mode. FreeType can return 1-bit (`FT_PIXEL_MODE_MONO`) bitmaps for bitmap/strike fonts even when NORMAL rendering was requested, so such glyphs are misread as gray bytes (garbled text). Using `slot->bitmap.pixel_mode` is the correct source of truth. The logic on master is unchanged; the patch fails only on formatting.

Evidence:
- `plugins/text-freetype2/text-functionality.c:238-249` — `if (render_mode == FT_RENDER_MODE_NORMAL) return buf_row[x];` else bit-unpack.
- `plugins/text-freetype2/text-functionality.c:251-271` — `rasterize` passes `render_mode`, not the bitmap's pixel mode.

Related: none.

Slice plan:
- Re-apply the 15-line diff (signature change of `get_pixel_value`/`rasterize`, call sites) under 120-column formatting; keep kkartaltepe authorship.
- Files: `plugins/text-freetype2/text-functionality.c` (and header if the prototype is declared there). ~15 lines.
- Test: MSVC build of text-freetype2; manual: render with a bitmap font (e.g. a .fon / BDF font) at native size with and without antialiasing.

### [#11089](https://github.com/obsproject/obs-studio/issues/11089) — 2160p Track Matte Stinger is cut early

**Verdict: CANNOT_VERIFY**

Reasoning: Only the 2160p track-matte export ends early; 1080p/1440p versions of the same stinger are fine. That points at decode throughput / hardware decoding of a 4K matte file rather than a deterministic code path (the stinger ends on media end or duration). Needs the user's files and hardware.

Evidence:
- `plugins/obs-transitions/transition-stinger.c` — stinger completion is driven by media duration / media_ended; no resolution-specific logic.

Related: none.

### [#11091](https://github.com/obsproject/obs-studio/pull/11091) — libobs: Fix global transition source signals

**Verdict: IMPLEMENT** (cherry-pick)

Reasoning: `source_transition_start/stop/video_stop` are declared as global signals and documented, but are emitted via `obs_source_dosignal`, which suppresses the global signal for private sources; all transitions (scene transitions and show/hide transitions) are created private, so the global signals never fire. The PR adds `obs_transition_dosignal` without the private check and uses it at the transition call sites. Applies cleanly. Master has one additional call site the PR does not touch: the stop signal emitted inside `obs_transition_set` when a running transition is interrupted; convert it too for consistency.

Evidence:
- `libobs/obs-internal.h:1039-1050` — `obs_source_dosignal` gates global signal on `!source->context.private`.
- `libobs/obs.c:1102-1104` — global signal declarations `source_transition_start/stop`.
- `docs/sphinx/reference-core.rst:726,734` — documented global signals.
- `libobs/obs-source-transition.c:377,418,660,760,848` — five emit sites (PR covers 377,660,760,848; 418 is new on master).
- `git apply --check` succeeds.

Related: #10492.

Slice plan:
- Cherry-pick 95882ac99 (author Penwy); add follow-up change for line 418 in `obs_transition_set`.
- Files: `libobs/obs-internal.h`, `libobs/obs-source-transition.c`. ~20 lines.
- Test: MSVC build of libobs; manual/script: connect to global `source_transition_start/stop` via a Lua/Python script or obs-websocket and switch scenes; verify the callbacks fire.
