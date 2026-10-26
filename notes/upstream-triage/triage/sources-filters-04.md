# Upstream triage — batch sources-filters-04

- Batch id: sources-filters-04 (area hint: sources-filters)
- Items: 11192, 11195, 11223, 11236, 11257, 11267, 11297, 11318, 11321, 11362, 11364, 11382, 11402, 11446, 11506, 11537, 11544, 11587, 11648, 11711, 11730, 11749 (all issues, no PRs)
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: issue bodies from `notes/upstream-triage/data/all.json`; no comment threads, no WebFetch used. Every verdict is backed by reading the current code on master.

## Summary

| # | Verdict |
|---|---------|
| 11192 | ALREADY_ADDRESSED |
| 11195 | CANNOT_VERIFY |
| 11223 | CANNOT_VERIFY |
| 11236 | CANNOT_VERIFY |
| 11257 | ALREADY_ADDRESSED |
| 11267 | OUT_OF_SCOPE |
| 11297 | CANNOT_VERIFY |
| 11318 | CANNOT_VERIFY |
| 11321 | CANNOT_VERIFY |
| 11362 | ALREADY_ADDRESSED |
| 11364 | IMPLEMENT |
| 11382 | IMPLEMENT |
| 11402 | CANNOT_VERIFY |
| 11446 | DEFER_LARGE |
| 11506 | IMPLEMENT |
| 11537 | IMPLEMENT |
| 11544 | CANNOT_VERIFY |
| 11587 | CANNOT_VERIFY |
| 11648 | IMPLEMENT |
| 11711 | DEFER_LARGE |
| 11730 | CANNOT_VERIFY |
| 11749 | CANNOT_VERIFY |

---

### [#11192](https://github.com/obsproject/obs-studio/issues/11192) — Show/Hide transitions don't copy when duplicating a source
**Verdict: ALREADY_ADDRESSED**

Fixed upstream by commit 8c946e792 ("frontend: Make sure all scene item properties are copied", Sep 2025, first in 32.1.0). Copy now records the show/hide transition id, settings and duration, and paste (duplicate or reference) rebuilds them on the new scene item.

Evidence:
- `frontend/widgets/OBSBasic_Clipboard.cpp:96-110`: copySceneItem stores the transition ids, settings and durations.
- `frontend/dialogs/OBSBasicSourceSelect.cpp:119-138`: setupSceneItem creates the transitions and applies them with obs_sceneitem_set_transition.
- `frontend/dialogs/OBSBasicSourceSelect.cpp:176-192`: setupExistingSource passes the copy info through on the duplicate path.

Side observation (separate from this issue): `OBSBasicSourceSelect.cpp:188-191` `std::move`s `show/hide_transition_settings` and `private_settings` out of the clipboard entry, which is passed in by reference. A second paste of the same clipboard therefore gets empty transition settings (defaults) and no private settings. This could be a small follow-up fix that copies instead of moving. It was not filed as its own item.

Related: none in batch.

### [#11195](https://github.com/obsproject/obs-studio/issues/11195) — Can not seek via slider when playing some mp3 files with album cover
**Verdict: CANNOT_VERIFY**

This needs the reporter's specific file. The media-playback code does not treat attached-picture (cover art) streams specially. No `AV_DISPOSITION_ATTACHED_PIC` check exists in `shared/media-playback/`, so a cover art stream counts as a video stream (`has_video`). `seek_to` always seeks on stream index 0 (`shared/media-playback/media-playback/media.c:520-536`) and then flushes the video decoder (`:540-545`). If the stream order or the single-frame "video" stream breaks pts/next-frame logic after a seek, that would match the report. That is only a hypothesis. Without the file I cannot show which path fails.

Evidence:
- `shared/media-playback/media-playback/media.c:520-549`: seek_to uses `m->fmt->streams[0]` and `av_seek_frame(m->fmt, 0, ...)`.
- Grep: no `attached_pic` or `AV_DISPOSITION` handling in media.c or decode.c.

Related: none.

### [#11223](https://github.com/obsproject/obs-studio/issues/11223) — Browser playing video, unable to control time bar
**Verdict: CANNOT_VERIFY**

The report has no steps, no log and no URL. Seeking inside a web page's video player is handled by the page in CEF (obs-browser submodule) through Interact, not by OBS media controls. Nothing in the report can be checked against code.

Evidence: the body has empty repro steps and "Log URL: no".

Related: none.

### [#11236](https://github.com/obsproject/obs-studio/issues/11236) — VLC crashes OBS after some time
**Verdict: CANNOT_VERIFY**

The only evidence is an external crash log, which is not available here. The repro is vague ("after some time", "lost connection sometimes"). The crash is probably inside libVLC (a third-party runtime loaded dynamically by `plugins/vlc-video/vlc-video-plugin.c`). With no stack I cannot find a defect in `plugins/vlc-video/vlc-video-source.c`.

Related: 11297, 11506, 11711 (other VLC source items).

### [#11257](https://github.com/obsproject/obs-studio/issues/11257) — Image Mask/Blend filepath doesn't update with Missing Files
**Verdict: ALREADY_ADDRESSED**

Fixed upstream by b09303010 ("frontend, obs-filters: Add missing file support for filters", Dec 2025). The mask filter now has a `missing_files` callback that rewrites `image_path`, and the frontend Missing Files dialog now collects files from filters as well.

Evidence:
- `plugins/obs-filters/mask-filter.c:349-360`: missing_file_callback sets SETTING_IMAGE_PATH and calls obs_source_update.
- `plugins/obs-filters/mask-filter.c:362-375`: mask_filter_missing_files.
- `plugins/obs-filters/mask-filter.c:389, 406`: `.missing_files` is registered on both mask filter versions.
- `libobs/obs-source.c:1041-1047`: obs_source_replace_missing_file passes `context.data`, so the callback's cast to `mask_filter_data*` is correct.
- `plugins/obs-filters/color-grade-filter.c:481-508`: the LUT filter got the same handling.

Related: none.

### [#11267](https://github.com/obsproject/obs-studio/issues/11267) — Camera extension not found until restart (macOS)
**Verdict: OUT_OF_SCOPE**

The reporter says this is not an OBS bug. It is a development question about the reporter's own Qt app and macOS CoreMediaIO camera extensions. OBS has nothing to fix.

Evidence: the issue body says "This is not an obs bug ... I tried to add a camera extension virtual camera to a Qt project".

Related: none.

### [#11297](https://github.com/obsproject/obs-studio/issues/11297) — VLC source loses alpha channel
**Verdict: CANNOT_VERIFY**

The report does not name the codec or container. The VLC source already maps alpha-carrying chromas: RGBA/BGRA pass through and YUVA is converted to RGBA (`plugins/vlc-video/vlc-video-source.c:141-142, 189`). Unknown chromas fall back to BGRA (`:211-212`), which keeps alpha whenever the decoder outputs it. The most likely cause is that libVLC's decoder drops alpha for the asset (for example VP8/VP9 WebM alpha). That would be a libVLC limitation, and the Media Source (FFmpeg/libvpx) supports those files. Without the file I cannot point to a defect in OBS.

Related: 11236, 11506, 11711.

### [#11318](https://github.com/obsproject/obs-studio/issues/11318) — Text source with custom text extents has text cut off
**Verdict: CANNOT_VERIFY**

This is Windows text (GDI+), `plugins/obs-text/gdiplus/obs-text.cpp`. The clipping depends on how glyphs fall at wrap points with custom extents. It is a font and measurement edge case that needs the exact font, text and extents to reproduce. The screenshots do not give enough to pin a defect in the extents or wrap measurement code.

Related: none.

### [#11321](https://github.com/obsproject/obs-studio/issues/11321) — Release-News (What's New) window has fixed-size text
**Verdict: CANNOT_VERIFY**

The What's New dialog (`frontend/dialogs/OBSWhatsNew.cpp`) hosts a CEF browser panel from the obs-browser submodule that shows remote HTML. Text scaling on Linux HiDPI depends on how CEF/obs-browser derives the device scale factor and on the remote page's CSS. Neither lives in this repository's frontend code, and I could not reproduce it (Linux-only, Windows box).

Related: none.

### [#11362](https://github.com/obsproject/obs-studio/issues/11362) — Image Slideshow private image sources passed to `obs_enum_sources`
**Verdict: ALREADY_ADDRESSED**

In 30.2.3, obs_enum_sources walked `obs->data.public_sources` with no private check. Current master walks the unified source hash and explicitly skips private sources (`!s->context.private`). That check arrived with commit 3d57b1fd6 (Introduce Canvases). The slideshow creates its images with obs_source_create_private, so they are now filtered out.

Evidence:
- `libobs/obs.c:1840-1866`: obs_enum_sources has `if (!s->context.private)` at line 1850.
- `git show 30.2.3:libobs/obs.c`: the old loop over public_sources had no private check.
- `plugins/image-source/obs-slideshow-mk2.c:305`, `plugins/image-source/obs-slideshow.c:167`: the slideshow images are created private.

Related: none.

### [#11364](https://github.com/obsproject/obs-studio/issues/11364) — Track matte stinger hangs on last frame after opening settings
**Verdict: IMPLEMENT**

Root cause found. `stinger_update` builds the private ffmpeg media source settings with `is_track_matte = s->track_matte_enabled` **before** it reads `track_matte_enabled` from the new settings. On first load the struct is zeroed, so the media source is created with `is_track_matte=false` even when track matte is enabled. After the user presses OK in properties, `s->track_matte_enabled` is already true, so the new media source gets `is_track_matte=true`. The ffmpeg source only skips clearing the last frame on media end when `is_track_matte` is true. So the last frame stays for the stinger's 250 ms duration padding only after properties have been opened. That is exactly the reported "only after opening settings" behaviour.

Evidence:
- `plugins/obs-transitions/transition-stinger.c:80`: `is_track_matte` is set from the stale `s->track_matte_enabled`.
- `plugins/obs-transitions/transition-stinger.c:107`: `s->track_matte_enabled` is assigned only afterwards.
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:277`: `if (s->is_clear_on_media_end && !s->is_track_matte)` clears the frame.
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:524`: preload_first_frame_proc also depends on is_track_matte.
- `plugins/obs-transitions/transition-stinger.c:548`: duration is the media duration plus 250 ms padding.
- 4af00587a (Lain): is_track_matte was added on purpose so track-matte stingers keep the last frame "to prevent the last frame from having risk of flashing".

Slice plan:
- In `stinger_update`, read `track_matte_enabled` (and the layout and other matte fields) from `settings` before building `media_settings`. Keep `track_matte_was_enabled` captured before the assignment, then pass the fresh value as `is_track_matte`. About 10 changed lines in one file.
- Caveat for the commit body: this makes behaviour consistent with upstream's intended design (4af00587a): track-matte stingers keep their last frame until the transition ends. It does **not** remove the hold. If the hold itself is unwanted, that is a separate design choice: drop the `!s->is_track_matte` condition, which would bring back the flash 4af00587a guarded against.
- Test: MSVC build of obs-transitions. Runtime check: load a track-matte stinger, run the transition before and after opening properties, and confirm both behave the same. Needs a GUI run, so mark UNTESTED if not done manually.

Related: none.

### [#11382](https://github.com/obsproject/obs-studio/issues/11382) — Media Source has no option to select YUV color space
**Verdict: IMPLEMENT**

This is a small requested option with an obvious place in the UI, next to the existing "YUV Color Range" override. Today the color space comes only from the frame's tagged `colorspace`, and there is no override. A stream mis-tagged as BT.601 (for example an SRT feed) is decoded with the 601 matrix, and the user cannot correct it. Untagged streams already default to 709 (`libobs/media-io/video-matrices.c:182-183`), so the reported case is a mis-tagged stream.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:201-204`: the only override is `color_range`.
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:304`: `.force_range = s->range` is passed into mp_media_info.
- `shared/media-playback/media-playback/media.c:126-144`: convert_color_space uses only frame tags.
- `shared/media-playback/media-playback/media.c:428-429`: new_space comes from tags, while new_range already honours `force_range`.
- `shared/media-playback/media-playback/media.c:208-229, 241`: get_sws_colorspace for the swscale path, also tag-only.
- `shared/media-playback/media-playback/media.h:77`, `media-playback.h:42`: force_range field (template for a force_space field).

Slice plan:
- Add `enum video_colorspace force_space` to `mp_media_info` (media-playback.h) and `mp_media` (media.h), and copy it in mp_media_init next to force_range (media.c ~886).
- In media.c:428, use `m->force_space != VIDEO_CS_DEFAULT ? m->force_space : convert_color_space(...)`.
- In mp_media_init_scaling (media.c:241), map a forced 601/709 to SWS_CS_ITU601/SWS_CS_ITU709.
- In obs-ffmpeg-source.c: add a `color_space` int list (Auto / Rec. 601 / Rec. 709) after color_range, store it in `struct ffmpeg_source`, read it in update (restart media when it changes, the same way `range` does at ~439), and pass `.force_space`.
- Add locale strings `ColorSpace`, `ColorSpace.Auto`, `ColorSpace.601`, `ColorSpace.709` to `plugins/obs-ffmpeg/data/locale/en-US.ini`.
- Estimate: about 50 lines across 5 files.
- Test: MSVC build of obs-ffmpeg and media-playback. Runtime: play a 709 clip tagged as 601 (`ffmpeg -colorspace bt470bg`), toggle the option and compare. Manual and GUI-based, so mark UNTESTED if not done.

Related: none.

### [#11402](https://github.com/obsproject/obs-studio/issues/11402) — Screen readers fail to read some menu items in context menus
**Verdict: CANNOT_VERIFY**

This happens only with the Windows high-contrast theme plus OBS's "System" theme, with NVDA or Narrator. The source context menu is built with standard QMenu/QAction (frontend/widgets/OBSBasic_ContextMenu-style code), so the missing accessible names point to Qt's Windows UIA bridge or the style, not OBS code. The reporter links #3363, where it was discussed as a Qt behaviour. I cannot reproduce or find a defect without assistive-tech testing.

Related: none in batch (upstream #3363).

### [#11446](https://github.com/obsproject/obs-studio/issues/11446) — Hiding group does not trigger child's "Hide Transition"
**Verdict: DEFER_LARGE**

Scene-item show/hide transitions run per item when that item's own visibility changes (`libobs/obs-scene.c:3009, 3029` → obs_sceneitem_do_transition `:4054-4094`). Hiding a group turns off the group item's own visibility and removes the group's whole render immediately. The children's visibility does not change, so their hide transitions never run. Showing the group re-activates the children, which is why show "works". Fixing this means delaying the group hide until all child hide transitions finish, or propagating visibility. That is a libobs scene/group semantics change that needs a design decision (interaction with the group's own hide transition, nested groups, and nested scenes, upstream #8005).

Evidence:
- `libobs/obs-scene.c:4054-4094`: transitions are tied to a single item's visible flag.
- `libobs/obs-scene.c:3009, 3029`: the call sites are only on the item's own set_visible path.

Related: upstream #8005 (not in batch).

### [#11506](https://github.com/obsproject/obs-studio/issues/11506) — VLC "Shuffle" does not reshuffle when scene is reloaded
**Verdict: IMPLEMENT**

The shuffle happens only in `vlcs_update` (`plugins/vlc-video/vlc-video-source.c:688-713`), so it runs once when settings change. With "Stop when not visible, restart when visible", `vlcs_deactivate` only stops the list player (`:987-997`) and `vlcs_activate` just calls play again (`:975-985`), which restarts the current item in the same order. The reporter's workaround (properties, then OK) works because it re-runs vlcs_update. For a "restart" behaviour combined with shuffle, a fresh shuffle on restart is the reasonable expectation.

Slice plan:
- Move the Fisher-Yates block (`:692-713`) and the media-list rebuild (`:720-730`) into a static helper, `vlcs_shuffle_and_set_list(struct vlc_source *c)`, that swaps `c->files` under `c->mutex`.
- In `vlcs_activate`, when `c->behavior == BEHAVIOR_STOP_RESTART && c->shuffle && c->files.num > 1`, call the helper before `libvlc_media_list_player_play_`. Restart-on-activate starts at the first item of the new list. Optionally do the same in `vlcs_restart` (media_restart/hotkey).
- Estimate: about 40 to 60 lines, one file.
- Test: MSVC build of vlc-video (needs the libVLC headers that are already vendored in `plugins/vlc-video`). Runtime needs VLC installed, so likely UNTESTED.

Related: 11236, 11297, 11711.

### [#11537](https://github.com/obsproject/obs-studio/issues/11537) — Media source hangs (RTSP), but OBS is unaware
**Verdict: IMPLEMENT**

Root cause in current code: for network inputs, media-playback sets the FFmpeg option `stimeout` (`shared/media-playback/media-playback/media.c:689-690`). `stimeout` was the RTSP demuxer's socket I/O timeout, but FFmpeg deprecated it (renamed to `timeout`) and removed it when FF_API_OLD_RTSP_OPTIONS ended (libavformat 61). This tree builds against libavformat 62 (`.deps/obs-deps-2026-10-23-x64/include/libavformat/version_major.h:32`). The option is now silently ignored, so an RTSP session that stops delivering packets blocks in av_read_frame indefinitely. The interrupt callback (`media.c:642-656`) only aborts on kill/stop. The source never reaches the EOF and reconnect path (`plugins/obs-ffmpeg/obs-ffmpeg-source.c:274-285` media_stopped, which sets destroy_media and leads to a reconnect). The reporter saw this on 30.2.3 (an older FFmpeg, where stimeout still worked). The current code has a definite regression of the same failure mode, so fixing the option name is the smallest slice that addresses the issue.

Evidence:
- `shared/media-playback/media-playback/media.c:689-693`: `av_dict_set(&opts, "stimeout", "30000000", 0);`.
- `shared/media-playback/media-playback/media.c:642-656`: interrupt_callback only checks kill/stopping.
- `.deps/.../libavformat/version_major.h:32`: LIBAVFORMAT_VERSION_MAJOR 62.

Slice plan:
- In init_avformat, for paths starting with `rtsp://` or `rtsps://`, set `"timeout"` (microseconds, the RTSP socket I/O timeout in FFmpeg ≥5) to 30000000 with `AV_DICT_DONT_OVERWRITE`, so user `ffmpeg_options` still win. Keep `stimeout` only under `#if LIBAVFORMAT_VERSION_MAJOR < 61`, or drop it.
- Do not set `timeout` for every protocol, because its meaning differs (for example rtmp/udp listen semantics).
- Estimate: about 10 lines, one file.
- Test: MSVC build of media-playback/obs-ffmpeg. Runtime needs an RTSP server that stalls (for example mediamtx plus ffmpeg publisher, then SIGSTOP the publisher). Likely UNTESTED on this box.

Related: none.

### [#11544](https://github.com/obsproject/obs-studio/issues/11544) — Hotkeys intermittent after clicking on a browser dock
**Verdict: CANNOT_VERIFY**

Browser docks are CEF windows from the obs-browser submodule. Once one has focus, the hotkey path depends on the focus-behaviour setting and on how CEF consumes keyboard messages on Windows. The report has no log, and the behaviour is "intermittent". I cannot find a specific defect in `libobs/obs-hotkey.c` or the frontend without a repro.

Related: none.

### [#11587](https://github.com/obsproject/obs-studio/issues/11587) — Window capture shifts content when un-maximizing browsers
**Verdict: CANNOT_VERIFY**

The 21 px offset after un-maximize happens only with Chromium/Firefox windows, which use custom non-client frames. The window capture size updates, but the content offset does not until the source is re-initialised. This points at client-area or frame-bound caching in the WGC/BitBlt capture (`plugins/win-capture/window-capture.c`, `libobs-winrt`), interacting with DWM extended frame bounds. It is plausible but not provable from code without a repro, and it is OS/compositor specific.

Related: none.

### [#11648](https://github.com/obsproject/obs-studio/issues/11648) — obs_scene_find_source race / possible use-after-free
**Verdict: IMPLEMENT**

Confirmed in code. obs_scene_find_source finds the item under `full_lock(scene)` but returns it unreferenced after `full_unlock`. Item removal also runs under the scene lock, and the item is released after unlocking (`remove_all_items` pattern, `libobs/obs-scene.c:206-229`). So a caller's later `obs_sceneitem_addref` can race with the final release. Taking the reference inside the lock closes the window. There is no existing ref-returning variant.

Evidence:
- `libobs/obs-scene.c:2033-2053`: lock, find, unlock, return the raw pointer.
- `libobs/obs-scene.c:2395-2399`: obs_sceneitem_addref is a plain atomic increment with no "get_ref if alive" check.
- `libobs/obs.h:1724-1726`: current declarations.
- `docs/sphinx/reference-scenes.rst:233-247`: current docs.

Slice plan:
- Add `EXPORT obs_sceneitem_t *obs_scene_find_source_ref(obs_scene_t *scene, const char *name);` (and the `_recursive` variant if it stays small). It is implemented like the existing function but calls `obs_sceneitem_addref(item)` before `full_unlock`. The caller must release the item.
- Document it in reference-scenes.rst. Note that this is a fork-only API that upstream plugins will not use.
- Estimate: about 40 lines across 3 files.
- Test: MSVC build of libobs. A cmocka test is possible in test/cmocka only if a headless obs_startup is feasible there, so most likely build-only and functionally UNTESTED.

Related: none.

### [#11711](https://github.com/obsproject/obs-studio/issues/11711) — Sidechain on VLC is delayed
**Verdict: DEFER_LARGE**

The cause is architectural. Audio filters run when a source pushes audio, not at mix time. The compressor reads the sidechain deque at that moment (`plugins/obs-filters/compressor-filter.c:144-165` capture, `:415+` filter_audio). The VLC source pushes audio with its own pts (`plugins/vlc-video/vlc-video-source.c:464-476`), ahead of when that audio will be mixed, so libobs buffers it. The mic sidechain data used for the gain therefore comes from earlier in real time than the VLC audio it is applied to, and ducking audibly lags. A correct fix needs sidechain timestamps aligned to the filtered audio's timestamps (timestamp-indexed buffering in the compressor), or filtering at mix time. Neither is a small, safe slice.

Related: 11236, 11297, 11506.

### [#11730](https://github.com/obsproject/obs-studio/issues/11730) — Image source color differs from the actual picture (macOS)
**Verdict: CANNOT_VERIFY**

The image is not provided. "Faded" colors on macOS usually mean an embedded ICC profile (for example Display P3 or Adobe RGB) that the image loader ignores, since OBS decodes to sRGB-assumed textures. Whether that applies cannot be confirmed without the file. Adding ICC color management to the image loader would be a large feature anyway.

Related: none.

### [#11749](https://github.com/obsproject/obs-studio/issues/11749) — Failed to transition to some scene randomly when interrupting the transition
**Verdict: CANNOT_VERIFY**

The repro is rapid clicking between scenes with mixed per-scene transition overrides (3.3 s fades vs a 330 ms luma wipe). It is a timing-dependent interaction in the frontend transition override logic (`frontend/widgets/OBSBasic_Transitions.cpp`) and libobs transition start/stop. The report has only a video, and I could not isolate a deterministic defect from the code.

Related: none.
