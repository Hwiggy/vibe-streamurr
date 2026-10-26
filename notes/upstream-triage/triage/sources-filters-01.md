# Upstream triage: batch sources-filters-01

- **Batch:** sources-filters-01 (area hint: sources-filters)
- **Items:** 2310, 2507, 3385, 4120, 4649, 4667, 4986, 5027, 5035, 5077, 5152, 5182, 5198, 5528, 6692, 6853, 7338, 7595, 7623, 7747, 7824, 7851
- **Date:** 2026-10-26
- **Base commit:** `72e866557` (master)
- **Method:** I read the item bodies from `notes/upstream-triage/data/all.json` and checked them against the current code on master. Open PRs were inspected from `refs/upstream-pr/N`. The local git is 2.33, which lacks `merge-tree --write-tree`, so conflicts were checked with the legacy three-argument `git merge-tree <base> master <pr>` and a count of `+<<<<<<<` markers. I used one WebFetch, for #7595, to read the comment thread for the root cause.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 2310 | issue | ALREADY_ADDRESSED |
| 2507 | PR | DEFER_LARGE |
| 3385 | issue | DEFER_LARGE |
| 4120 | issue | IMPLEMENT (same slice as #5528) |
| 4649 | issue | OUT_OF_SCOPE |
| 4667 | issue | IMPLEMENT |
| 4986 | issue | OUT_OF_SCOPE |
| 5027 | issue | ALREADY_ADDRESSED |
| 5035 | issue | IMPLEMENT |
| 5077 | issue | DEFER_LARGE |
| 5152 | issue | DEFER_LARGE |
| 5182 | issue | ALREADY_ADDRESSED |
| 5198 | issue | DEFER_LARGE |
| 5528 | issue | IMPLEMENT |
| 6692 | issue | DEFER_LARGE |
| 6853 | issue | CANNOT_VERIFY |
| 7338 | issue | CANNOT_VERIFY |
| 7595 | issue | IMPLEMENT |
| 7623 | issue | DEFER_LARGE |
| 7747 | issue | CANNOT_VERIFY |
| 7824 | issue | IMPLEMENT |
| 7851 | PR | DEFER_LARGE |

---

### [#2310](https://github.com/obsproject/obs-studio/issues/2310) — Media Source set to 0x0 if transform is being modified when playback ends

**Verdict:** ALREADY_ADDRESSED

**Reasoning:** If a media source ends while its stretch handle is being dragged, the source reports a 0x0 size, and the old scale calculation then produced a degenerate scale. `OBSBasicPreview::StretchItem` now returns early when the source width or height is 0, and a comment there explains this exact case. The guard came from commit `fcfc2eb5f` ("UI: Fix 0,0 size transform bug when resizing sources", 2023-05-19).

**Evidence:**
- `frontend/widgets/OBSBasicPreview.cpp:1614-1622`: reads `source_cx`/`source_cy` and returns early when either is 0.
- `git log -L` on those lines points to commit `fcfc2eb5f`.

**Related:** none

---

### [#2507](https://github.com/obsproject/obs-studio/pull/2507) — UI: Add ctrl + scroll to zoom scene items

**Verdict:** DEFER_LARGE

**Reasoning:** The PR is a single commit (+126/-17 lines in `OBSBasicPreview.cpp/.hpp`) and merges without textual conflicts. It still needs a design decision and some porting:
1. Pressing Ctrl on its own now turns on a "zoom items mode" and changes the cursor. Ctrl already has several jobs in the preview: multi-select, turning off snapping while moving or stretching, and other modifier checks. The new mode overloads that key.
2. It references `SUPPORTS_FRACTIONAL_SCALING`, which no longer exists anywhere in `frontend/`. It also uses `App()->GetMainWindow()` and `devicePixelRatioF`, while master now uses `OBSBasic::Get()` and `GetDevicePixelRatio()`. The macro would silently fall back to the integer DPI ratio.
3. The zoom changes are not recorded in undo/redo, unlike other transform edits.

Upstream has left it open since 2020. This is new UX, not a fix.

**Evidence:**
- `git diff master...refs/upstream-pr/2507 --stat`: 2 files, +126/-17.
- `frontend/widgets/OBSBasicPreview.cpp:598-612`: the current `wheelEvent` handles only the Space+scroll preview zoom.
- `frontend/widgets/OBSBasicPreview.cpp:642,790,821,1148,1608,1674`: existing uses of `Qt::ControlModifier` in the preview.
- `grep SUPPORTS_FRACTIONAL_SCALING frontend` finds nothing, so the macro the PR depends on is gone.

**Related:** none

---

### [#3385](https://github.com/obsproject/obs-studio/issues/3385) — obs_frontend_set_current_scene crashes if not used in Studio Mode

**Verdict:** DEFER_LARGE

**Reasoning:** The root cause is a deadlock, not a crash; the report itself says OBS hangs. Lua timers run on the video tick thread. `lua_tick` calls `timer_call`, which takes the per-script mutex through `lock_callback()`. The script then calls `obs_frontend_set_current_scene`. Off the UI thread, that call uses `WaitConnection()` (`Qt::BlockingQueuedConnection`) to run `OBSBasic::SetCurrentScene`. Outside Studio Mode, `SetCurrentScene` fires `OBS_FRONTEND_EVENT_SCENE_CHANGED` synchronously on the UI thread. The Lua `frontend_event_callback` for that event calls `lock_callback()` on the same script mutex, which the tick thread is still holding while it waits for the UI thread. Each thread waits for the other.

Fixing it needs one of two changes:
- Change the threading contract of a public frontend API by making the call asynchronous off the UI thread. Plugins such as obs-websocket rely on it being synchronous.
- Restructure scripting locking so the script mutex is released around frontend calls.

Neither is a small slice.

**Evidence:**
- `frontend/OBSStudioAPI.cpp:67-76`: `WaitConnection()` in both the Studio Mode and the normal path.
- `shared/qt/wrappers/qt-wrappers.hpp:82-85`: `WaitConnection` is `BlockingQueuedConnection` off the UI thread.
- `shared/obs-scripting/obs-scripting-lua.c:1039-1081`: `lua_tick` runs timers on the tick thread.
- `shared/obs-scripting/obs-scripting-lua.c:289-298`: `timer_call` holds `lock_callback()` while it runs.
- `shared/obs-scripting/obs-scripting-lua.h:89-98`: `lock_callback` locks `current_lua_script->mutex`.
- `shared/obs-scripting/obs-scripting-lua-frontend.c:201-217`: `frontend_event_callback` locks the same mutex.

**Related:** none

---

### [#4120](https://github.com/obsproject/obs-studio/issues/4120) — Shutdown source when not visible option is not working in Studio Mode

**Verdict:** IMPLEMENT (shares its root cause and slice with #5528)

**Reasoning:** The browser source has `OBS_SOURCE_AUDIO`. For a source with audio, `obs_sceneitem_set_visible(false)` does not call `set_visibility()` straight away. It queues an `item_action` on `item->audio_actions`. That queue is drained only inside `scene_audio_render`. The audio thread renders only the active tree of the view channels, which means only the program side. In Studio Mode the preview scene is not active (it is shown in the AUX view only), so its audio is never rendered. The hide action is never applied, `obs_source_remove_active_child` never runs, and the browser's `show_refs` never reaches 0. As a result `BrowserSource::SetShowing(false)` is never called and the page is never unloaded.

Outside Studio Mode the scene is on program, its audio renders, and the action is applied. That matches the report exactly.

**Evidence:**
- `libobs/obs-scene.c:3050-3056`: for sources with audio, the visibility change is queued instead of applied.
- `libobs/obs-scene.c:2248-2251`: `source_has_audio` includes `OBS_SOURCE_COMPOSITE`, so nested scenes are queued too.
- `libobs/obs-scene.c:1640-1652`: `process_all_audio_actions` is called only from `scene_audio_render`.
- `libobs/obs-audio.c:575-605`: the audio render order is built only from active sources in the view channels (`obs_source_active` check).
- `libobs/obs-source.c:1418-1423`: the show/hide callbacks fire from `show_refs`.
- `plugins/obs-browser/obs-browser-plugin.cpp:504-509`: `show`/`hide` call `SetShowing`.
- `plugins/obs-browser/obs-browser-source.cpp:381,560`: shutdown depends on `obs_source_showing`.

**Slice:** see #5528.

**Related:** 5528

---

### [#4649](https://github.com/obsproject/obs-studio/issues/4649) — obs_frontend_get_current_preview_scene doesn't honour Studio Mode's Program view

**Verdict:** OUT_OF_SCOPE (works as designed)

**Reasoning:** With "Duplicate Scene" on, the program side renders a private duplicate (`obs_scene_duplicate(..., OBS_SCENE_DUP_PRIVATE_*)`). `programScene` deliberately stores a weak ref to the original public scene, so `obs_frontend_get_current_scene()` returns that original by design. The private copy is hidden from the public scene list on purpose.

A script that needs the program-side item transforms can read the actual program source through `obs_get_output_source(0)` and `obs_transition_get_active_source()`. Changing what the frontend API returns would break other API consumers that rely on getting the public scene. This is not a defect.

**Evidence:**
- `frontend/OBSStudioAPI.cpp:57-65`: `get_current_scene` returns `programScene` in Studio Mode.
- `frontend/OBSStudioAPI.cpp:568-576`: `get_current_preview_scene` returns `GetCurrentSceneSource()`.
- `frontend/widgets/OBSBasic_StudioMode.cpp:205-221`: the private duplicate is set on the transition while `programScene` keeps the original.
- `frontend/widgets/OBSBasic_Transitions.cpp:304-308`: `programScene` is set to the original source.

**Related:** none

---

### [#4667](https://github.com/obsproject/obs-studio/issues/4667) — Last frame of media source flashes before starting video playback

**Verdict:** IMPLEMENT

**Reasoning:** The report uses "Restart playback when source becomes active" with "Show nothing when playback ends" and "Loop" both off. In that configuration:
1. `ffmpeg_source_deactivate` stops playback but clears the async frame only when `is_clear_on_media_end` is set. The last decoded frame stays as the source's current async frame.
2. On re-activation, `ffmpeg_source_activate` calls `obs_source_media_restart`. This only queues a `MEDIA_ACTION_RESTART`, which `process_media_actions` handles on a later video tick.
3. The source is therefore rendered at least once with the stale frame before `ffmpeg_source_start` outputs `NULL` and new frames arrive. That is the flash.

When restart-on-activate is set, the frame left over at deactivate is never meant to be shown again. With clear/loop off, `ffmpeg_source_start` already clears it. With clear/loop on, it shows a preloaded first frame. So clearing at deactivate is safe.

**Evidence:**
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:662-674`: deactivate clears only when `is_clear_on_media_end`.
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:654-660`: activate queues a restart.
- `libobs/obs-source.c:5814-5830`: `obs_source_media_restart` pushes to `media_actions`, which is processed later (`libobs/obs-source.c:1315`).
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:318-333`: `ffmpeg_source_start` outputs `NULL` when not preloading.

**Slice:**
- In `ffmpeg_source_deactivate`, when `restart_on_activate` is set and `s->media` exists, always call `obs_source_output_video(s->source, NULL)` after `media_playback_stop`. Drop the `is_clear_on_media_end` condition.
- Estimate: about 3 changed lines in `plugins/obs-ffmpeg/obs-ffmpeg-source.c`.

**Test plan:** Build the `obs-ffmpeg` plugin with MSVC on this box. Manual check: a scene with a local mp4, Restart on activate on, Show-nothing off, Loop off; switch scenes repeatedly and confirm no last-frame flash. There is no automated test, so this needs a manual GUI run; otherwise mark it UNTESTED.

**Related:** none

---

### [#4986](https://github.com/obsproject/obs-studio/issues/4986) — Hide/Show transition copy and paste behavior is inconsistent

**Verdict:** OUT_OF_SCOPE (works as designed)

**Reasoning:** Show/hide transitions are per-scene-item properties. "Add Existing" creates a new scene item for the group source in scene 2 and does not copy per-item properties from another scene's item. The children inside a group, however, are items of the group's own internal scene. That scene is shared by every reference to the group, so their transitions show up everywhere.

The inconsistency the user sees follows directly from groups being shared sub-scenes. Copying the outer item's transition on "Add Existing" would be a new feature that also needs a decision on which existing item to copy from. "Copy/Paste" of transitions already exists for users who want it.

**Evidence:**
- `libobs/obs-scene.c:3029-3031`: the transition is per item, and the group's children are enumerated through the group's own scene.
- `libobs/obs-scene.c:3649-3691`: a group's children live in the shared `subscene` (`item->source->context.data`).

**Related:** 5035

---

### [#5027](https://github.com/obsproject/obs-studio/issues/5027) — "Discard" button makes media source start from the beginning

**Verdict:** ALREADY_ADDRESSED

**Reasoning:** Clicking Discard or Save re-applies settings through `obs_source_update`. When this was reported, `ffmpeg_source_update` always restarted media. Commit `d1a7070d1` ("obs-ffmpeg: Prevent media source restart", 2022-09-25) changed it to restart only when the input path, local/stinger mode, hardware decode, range, speed, or ffmpeg options actually change. Re-applying identical settings to a local file no longer restarts playback.

Network inputs still restart on any update by design. The report's secondary "properties marked modified on first open" point has no reproduction steps and cannot be pinned to code.

**Evidence:**
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:399,418-419`: restart only when local/stinger mode or the input path changes.
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:438-441`: restart when hardware decode, range, speed, or options change.
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:478-497`: the source is reopened and restarted only when `should_restart_media` is set.

**Related:** none

---

### [#5035](https://github.com/obsproject/obs-studio/issues/5035) — The group source reference count is incorrect

**Verdict:** IMPLEMENT

**Reasoning:** `obs_sceneitem_group_ungroup()` copies the group's children into the parent scene and then calls `detach_sceneitem(item)` and `obs_sceneitem_release(item)` on the group item. Unlike `obs_sceneitem_remove_internal()`, it never calls `set_visibility(item, false)`. So `obs_source_remove_active_child(scene, group_source)` is never called, and the group source plus its subtree keep the activate/show refs the parent scene gave them.

When the group is used only in that scene, the leak is hidden: the group source is destroyed, and `remove_all_items` deactivates the children. In the reported steps the group is also referenced by Scene2, so it survives with leaked activate refs. The media source inside stays "active" and keeps appearing in the Audio Mixer even in an unrelated Scene3, which is what the report shows.

**Evidence:**
- `libobs/obs-scene.c:3649-3691`: ungroup calls `detach_sceneitem(item)` and releases it with no deactivation.
- `libobs/obs-scene.c:2410-2423`: `obs_sceneitem_remove_internal` calls `set_visibility(item, false)` before detaching.
- `libobs/obs-scene.c:1096-1115`: `set_visibility(false)` calls `obs_source_remove_active_child` when `active_refs > 0`.
- `libobs/obs-scene.c:2371-2393`: `obs_sceneitem_destroy` does not deactivate either.
- `libobs/obs-source.c:4759-4771`: `remove_active_child` deactivates the child per parent `show_ref`.

**Slice:**
- In `obs_sceneitem_group_ungroup`, call `set_visibility(item, false);` while `item->parent` is still valid. It must come before `detach_sceneitem(item)`, inside the `full_lock(scene)` section, the same order `obs_sceneitem_remove_internal` uses.
- Optionally also clear the show/hide transitions the same way remove does.
- Estimate: about 2-5 lines in `libobs/obs-scene.c`.

**Test plan:** Build libobs with MSVC. The cmocka tests in `test/cmocka` can't easily construct scenes because they need a graphics/audio context. Manual check: follow the report's steps and confirm the media source is not listed in the mixer for Scene3. Likely UNTESTED unless a GUI run is done.

**Related:** 4986

---

### [#5077](https://github.com/obsproject/obs-studio/issues/5077) — Scene Organization Tools

**Verdict:** DEFER_LARGE

**Reasoning:** This is a tracking issue for a funded bounty project (scene folders and organization), with details in discussion #5076. It is a large frontend feature that needs maintainer UX design. There is no small slice.

**Evidence:**
- This is a tracking and bounty issue only; the body links discussion #5076.
- `frontend/widgets/OBSBasic_Scenes.cpp`: the scene list is still a flat list, with no folder model.

**Related:** none

---

### [#5152](https://github.com/obsproject/obs-studio/issues/5152) — Sources flicker when undo-ing or redo-ing a deleted source

**Verdict:** DEFER_LARGE

**Reasoning:** The cause is confirmed in code. Deleting a source stores a full `BackupScene` before and after. The undo/redo lambda in `CreateSceneUndoRedoAction` then restores a scene by calling `obs_source_update(scene_source, scene_settings)`. That reloads the whole scene, so every item is removed and re-created, and they all flicker. Fixing it needs a diff-based restore (re-add only the missing item and reorder), which changes how the undo system works for all scene-level actions. That is not a small slice.

**Evidence:**
- `frontend/widgets/OBSBasic_SceneItems.cpp:897-927`: delete uses whole-scene `BackupScene` undo/redo data.
- `frontend/widgets/OBSBasic_Scenes.cpp:818-852`: undo/redo calls `obs_source_update` on the scene with the saved settings, which reloads all items.

**Related:** none

---

### [#5182](https://github.com/obsproject/obs-studio/issues/5182) — Missing files doesn't include missing 'Image Mask/Blend' filter path

**Verdict:** ALREADY_ADDRESSED

**Reasoning:** The mask filter now implements `.missing_files` for both v1 and v2. The frontend scan walks every source's filters through `addMissingFilterFiles`. Both were added in commit `b09303010` ("frontend, obs-filters: Add missing file support for filters", 2025-12-27).

**Evidence:**
- `plugins/obs-filters/mask-filter.c:349-375`: `missing_file_callback` and `mask_filter_missing_files`.
- `plugins/obs-filters/mask-filter.c:389,406`: `.missing_files` is registered for v1 and v2.
- `frontend/widgets/OBSBasic_SceneCollections.cpp:1170-1187`: `addMissingFilterFiles` is called through `obs_source_enum_filters`.

**Related:** none

---

### [#5198](https://github.com/obsproject/obs-studio/issues/5198) — Some OBS texts appear in reverse order when using Hebrew language (right to left)

**Verdict:** DEFER_LARGE

**Reasoning:** OBS loads translations from its own INI locale files rather than a `QTranslator`. It never sets an application layout direction, so the UI stays left-to-right for Hebrew, Arabic and Persian. Mixed Hebrew/English strings are then laid out with a left-to-right base direction, which reverses the word order.

The proper fix is to set `Qt::RightToLeft` for RTL locales. That mirrors the whole UI, including the preview, docks, volume meters and custom-painted widgets, and needs a UX and QA pass. Patching individual strings with RLM marks belongs in Crowdin translations, not code. There is no small, safe slice.

**Evidence:**
- `grep LayoutDirection frontend` finds only widget-local overrides, at `frontend/components/VolumeControl.cpp:262,331` and `frontend/settings/OBSBasicSettings_Stream.cpp:1012`.
- There is no app-wide RTL handling anywhere.

**Related:** none

---

### [#5528](https://github.com/obsproject/obs-studio/issues/5528) — No show/hide callback to nested scene item

**Verdict:** IMPLEMENT

**Reasoning:** This has the same root cause as #4120. Nested scenes and groups are `OBS_SOURCE_COMPOSITE`, so `source_has_audio()` is true for them. Toggling their visibility only queues an audio action. Those actions are applied in `scene_audio_render`, which runs only for scenes in the active (program) tree.

In the reported setup, Scene 2 is in the Studio Mode preview and not on program. Hiding "Scene 1" inside Scene 2 never runs `set_visibility(false)`, so `obs_source_remove_active_child` never runs and the source gets no `hide`. The leftover `active_refs == 1` also stops the next show from calling `obs_source_add_active_child`, because the call is gated on the 0→1 transition. So neither callback fires.

**Evidence:**
- `libobs/obs-scene.c:3014-3057`: `obs_sceneitem_set_visible` queues the change when `source_has_audio`, and the `add_active_child` call is gated on `active_refs` 0→1.
- `libobs/obs-scene.c:2248-2251`: `source_has_audio` includes `COMPOSITE`.
- `libobs/obs-scene.c:1586-1590,1640-1652`: queued actions are processed only in `scene_audio_render`.
- `libobs/obs-audio.c:575-605`: audio renders only active trees.
- `libobs/obs-scene.c:990-1004`: `scene_video_tick` does not process pending actions.

**Slice (shared with #4120):**
- In `scene_video_tick`, when `!obs_source_active(scene->source)`, take `audio_lock(scene)`. Then call `process_all_audio_actions(item, audio_output_get_sample_rate(obs_get_audio()))` for each item and release the lock. Such a scene is not being audio-rendered, so its queued visibility actions would otherwise never apply.
- The audio thread processes the same queue under the same `audio_lock`, so the two paths are serialized. The `ts=0` path applies all actions immediately, the same as the existing "no audio playing" branch at `obs-scene.c:1640`.
- Estimate: about 15 lines in `libobs/obs-scene.c`.

**Test plan:** Build libobs and obs-browser with MSVC on Windows. Manual check: in Studio Mode, toggle the eye on a browser source with "Shutdown when not visible" in a preview-only scene, and confirm it reloads. Toggle a nested scene in a preview-only scene and confirm the show/hide signals. There is no cmocka coverage, so this is UNTESTED unless a GUI run is done.

**Related:** 4120

---

### [#6692](https://github.com/obsproject/obs-studio/issues/6692) — Sources with Video Delay (Async) show a stillframe from the distant past when re-enabled

**Verdict:** DEFER_LARGE

**Reasoning:** The async delay filter keeps its cached frames across hide/show. It resets only on settings changes or a detected timestamp jump. Even after a reset, the filter returns `NULL` until the delay is filled, and libobs then keeps showing the source's last `cur_async_frame`, which is the old still image.

Fixing it needs a design decision among three options the reporter lists:
- keep caching while hidden;
- output transparent or black frames until the buffer refills;
- flush the source's displayed frame from a filter.

It also affects the render-delay filter. Any of these touches libobs async-frame semantics, not just the filter.

**Evidence:**
- `plugins/obs-filters/async-delay-filter.c:149-178`: the video path resets only on `reset_video` or a timestamp jump, and otherwise returns `NULL` until `interval` is reached.
- `plugins/obs-filters/async-delay-filter.c:78-91`: the reset is set only by `update`.
- There is no `.hide`/`.deactivate` handler in the filter.

**Related:** none

---

### [#6853](https://github.com/obsproject/obs-studio/issues/6853) — Text (GDI+) does not apply the font to Kazakh specific symbols

**Verdict:** CANNOT_VERIFY

**Reasoning:** `TextSource::UpdateFont` already builds the font with `lfCharSet = DEFAULT_CHARSET` and passes it to GDI+, so OBS does not restrict the charset. The fallback to a stock font for specific Cyrillic Extended codepoints comes from GDI+ and Windows font linking behaving that way with this particular font (Rodin). This is font- and OS-specific, and there is no OBS-side defect to point at.

**Evidence:**
- `plugins/obs-text/gdiplus/obs-text.cpp:311-336`: `LOGFONT` with `DEFAULT_CHARSET`, then `new Font(hdc, hfont)`.

**Related:** none

---

### [#7338](https://github.com/obsproject/obs-studio/issues/7338) — [Media Source] Playback of intra-refresh video is inconsistent

**Verdict:** CANNOT_VERIFY

**Reasoning:** One code path fits the symptoms (audio plays but video stays black, and it works if a keyframe was seen earlier in the same session). For non-local inputs, media-playback drops every decoded video frame until a frame with `AV_FRAME_FLAG_KEY` arrives, and `got_first_keyframe` is never reset.

However, FFmpeg's H.264 decoder normally flags recovery-point (intra-refresh) frames as key frames. Whether this gate is really the cause depends on the encoder's SEI output and the FFmpeg version (HEVC NVENC in particular). Confirming it needs a reproduction with an intra-refresh UDP or SRT stream, which this box can't easily set up. Bypassing the gate blindly would bring back garbage frames for normal streams.

**Evidence:**
- `shared/media-playback/media-playback/media.c:480-485`: frames are dropped until the first `AV_FRAME_FLAG_KEY` for non-local files.

**Related:** none

---

### [#7595](https://github.com/obsproject/obs-studio/issues/7595) — 'Text (FreeType 2)' element only reading first line of file (when 'Read from file' is checked)

**Verdict:** IMPLEMENT

**Reasoning:** The comment thread was checked via one WebFetch. The reporter's file had NUL bytes after each line, and a maintainer confirmed that NUL handling is the problem. In `load_text_from_file` and `read_from_end`, the whole file is read into `tmp_read`, but its length is then taken with `strlen(tmp_read)` for both the allocation and `os_utf8_to_wcs`. Everything after the first embedded `\0` is silently dropped, so only the first line is shown.

The smallest fix is to remove NUL bytes from the bytes actually read, before the conversion. The same `remove_cr` pass already strips `\r` afterwards. An earlier upstream PR (#7622) took a length-based approach but was never reviewed, and it is not an open PR in this data set.

**Evidence:**
- `plugins/text-freetype2/text-functionality.c:405-420`: `fread` of the full file, then `strlen(tmp_read)` truncates at the first NUL.
- `plugins/text-freetype2/text-functionality.c:490-500`: the same pattern in `read_from_end` (chat log mode).
- `plugins/text-freetype2/text-functionality.c:358-368`: the existing `remove_cr` compaction helper.

**Slice:**
- In both UTF-8 paths, read with `fread(tmp_read, 1, size, f)` to get the real byte count `n`.
- Compact out `'\0'` bytes in `tmp_read[0..n)` with a small static helper like `remove_cr`, then NUL-terminate.
- Leave the UTF-16 BOM path alone. It is already byte-length based, but `wchar_t` is 4 bytes on Linux, which is a separate issue that I have noted and left out of scope.
- Estimate: about 20-25 lines in `plugins/text-freetype2/text-functionality.c`.

**Test plan:** Build `text-freetype2` with MSVC on Windows. Manual check: a text file with lines separated by `\n\0` should render all lines, and normal files should render unchanged. Optionally, write a scratch C harness that calls the helper. No existing cmocka test covers this plugin.

**Related:** none

---

### [#7623](https://github.com/obsproject/obs-studio/issues/7623) — White image gets alpha blended as grey image

**Verdict:** DEFER_LARGE

**Reasoning:** With "Apply alpha in linear space" off, the image source premultiplies in gamma (sRGB) space (`GS_IMAGE_ALPHA_PREMULTIPLY`). The texture is then sampled as sRGB, which linearizes the already premultiplied value (roughly a^2.2), and blended with `ONE, INVSRCALPHA` in linear space. White at partial alpha therefore comes out darker than the background: grey.

The existing "linear alpha" option is the intended fix for correct linear-light compositing. Matching browser-style gamma-space blending by default would mean changing the compositing pipeline and its defaults. That affects how every existing scene looks and needs maintainer design input, so it is not a small slice.

**Evidence:**
- `plugins/image-source/image-source.c:56`: `GS_IMAGE_ALPHA_PREMULTIPLY_SRGB` is used only when `linear_alpha`; otherwise it is `GS_IMAGE_ALPHA_PREMULTIPLY`.
- `plugins/image-source/image-source.c:129`: the default is `linear_alpha = false`.
- `plugins/image-source/image-source.c:218-226`: the premultiplied blend `ONE, INVSRCALPHA`.

**Related:** none

---

### [#7747](https://github.com/obsproject/obs-studio/issues/7747) — Browser Source crash on exit of OBS

**Verdict:** CANNOT_VERIFY

**Reasoning:** This is a shutdown crash on OBS 28.1.2. The crash log is only in an external gist and there are no reproduction steps beyond opening and closing OBS. obs-browser and CEF have been updated many times since then; master is on obs-browser 2.27.4 (commit `95d5223b6`). Without a current stack trace I can't tie it to code.

**Evidence:**
- The body has only a gist link and no stack trace.
- `git log -1 95d5223b6`: obs-browser was bumped to 2.27.4, so the 28.1.2-era CEF code no longer applies.

**Related:** none

---

### [#7824](https://github.com/obsproject/obs-studio/issues/7824) — OBS Crashes when switching scenes by hotkey and an Image source file dialog is open

**Verdict:** IMPLEMENT

**Reasoning:** The "Browse" button in the context bar runs `ImageSourceToolbar::on_browse_clicked`. That slot opens a modal file dialog through `OpenFile(this, ...)`, which runs a nested event loop. A scene-switch hotkey handled during that loop changes the selection, which calls `OBSBasic::ClearContextBar()`. That function `delete`s the toolbar widget directly.

When the dialog returns, the slot keeps running on a deleted `this`: it touches `ui->path`, `props`, `SaveOldProperties`, and so on. That is a use-after-free crash, and it matches the report of no crash log being written. `ColorSourceToolbar::on_choose_clicked` and `TextSourceToolbar::on_selectFont_clicked`/`on_selectColor_clicked` follow the same pattern with modal color and font dialogs.

**Evidence:**
- `frontend/components/ImageSourceToolbar.cpp:25-54`: `this` is used after the `OpenFile` dialog returns.
- `frontend/widgets/OBSBasic_ContextToolbar.cpp:64-71`: `ClearContextBar` does `delete la->widget()` synchronously.
- `frontend/components/ColorSourceToolbar.cpp:50` and `frontend/components/TextSourceToolbar.cpp:50,93`: the same modal-dialog pattern.

**Slice:**
- In each of these slots, take `QPointer<...> guard(this);` before opening the dialog and `if (!guard) return;` right after it returns.
- The local `OBSSource source` ref keeps the source alive, but applying the change after the toolbar is gone is not required.
- Optionally switch `ClearContextBar` to `deleteLater()`, but the guard is the minimal and safe fix.
- Estimate: about 15-20 lines across `ImageSourceToolbar.cpp`, `ColorSourceToolbar.cpp` and `TextSourceToolbar.cpp`.

**Test plan:** Build the frontend (`obs-studio` target) with MSVC on Windows. Manual check: follow the report's steps (hotkey scene switch while the Browse dialog is open) and confirm there is no crash. There is no automated coverage.

**Related:** none

---

### [#7851](https://github.com/obsproject/obs-studio/pull/7851) — UI: Resize projector window by resolution or scale

**Verdict:** DEFER_LARGE

**Reasoning:** This is a new feature: a "Resize Window" context menu with preset resolutions and a new custom-size dialog. The PR includes a new `.ui` form, two new source files and new locale strings, for +455 lines across 10 files. It does not merge cleanly into master: the legacy merge-tree check found 2 conflict hunks against base `64cb68af5` (Feb 2025). It also changes `OBSBasicSettings` visibility. Its predecessor, #4378, was put on hold upstream over UX concerns. This is too large and too dependent on design decisions for a small slice.

**Evidence:**
- `git diff master...refs/upstream-pr/7851 --stat`: 10 files, +455/-1.
- Legacy `git merge-tree` reported 2 conflict hunks.
- The PR touches `frontend/settings/OBSBasicSettings.hpp/.cpp` and adds `frontend/forms/OBSProjectorCustomSizeSetting.ui`.

**Related:** none
