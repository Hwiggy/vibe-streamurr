# Upstream triage — batch sources-filters-02

- Batch id: sources-filters-02 (area hint: sources-filters; several items are actually frontend/UI)
- Items: 7874, 7969, 8005, 8035, 8446, 8528, 8714, 8906, 9125, 9321, 9345, 9811, 9934, 9961, 10031, 10060, 10120, 10227, 10322, 10382, 10406, 10425
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json` (no comment threads, no WebFetch used); code read on master with grep/sed. Read-only on source.

Summary:

| # | Kind | Verdict |
|---|------|---------|
| 7874 | issue | CANNOT_VERIFY |
| 7969 | issue | CANNOT_VERIFY |
| 8005 | issue | CANNOT_VERIFY |
| 8035 | issue | IMPLEMENT |
| 8446 | PR | DEFER_LARGE |
| 8528 | issue | IMPLEMENT |
| 8714 | issue | IMPLEMENT |
| 8906 | issue | CANNOT_VERIFY |
| 9125 | issue | OUT_OF_SCOPE |
| 9321 | issue | CANNOT_VERIFY |
| 9345 | issue | CANNOT_VERIFY |
| 9811 | issue | DEFER_LARGE |
| 9934 | issue | IMPLEMENT |
| 9961 | issue | DEFER_LARGE |
| 10031 | issue | IMPLEMENT |
| 10060 | issue | IMPLEMENT |
| 10120 | issue | CANNOT_VERIFY |
| 10227 | issue | DEFER_LARGE |
| 10322 | issue | OUT_OF_SCOPE |
| 10382 | issue | IMPLEMENT |
| 10406 | issue | CANNOT_VERIFY |
| 10425 | issue | CANNOT_VERIFY |

---

### [#7874](https://github.com/obsproject/obs-studio/issues/7874) — A/V desync when playing media source

**Verdict: CANNOT_VERIFY**

macOS 12, OBS 28.1.2. The reporter plays a sync-test clip through a Media Source, records it several times, and sees the A/V offset change by up to ±100 ms between recordings. Media Source timing comes from `shared/media-playback/media-playback/media.c` (thread loop around lines 800-830 and `mp_media_calc_next_ns`) and from libobs async-frame and audio timestamp alignment. Nothing in the report points to a specific code defect. The jitter may come from the audio device clock, from where playback starts relative to the recording start, or from the async video frame buffer. Investigating it would need a repro and logs on macOS.

- Evidence: `shared/media-playback/media-playback/media.c:800-830` (frame scheduling loop); no deterministic offset bug identified.
- Related: none.

### [#7969](https://github.com/obsproject/obs-studio/issues/7969) — CMMediaType '' is unsupported logs on OSX followed by black input

**Verdict: CANNOT_VERIFY**

The reporter quoted the legacy plugin (`plugins/mac-avcapture/legacy/av-capture.mm:839`). The current plugin has the same check at `plugins/mac-avcapture/OBSAVCapture.m:257-271`. That check reads the device's `activeFormat` media type and rejects anything that is not Video or Muxed. The log shows an empty FourCC (media type 0), so the GoPro Webcam virtual device reported an invalid or empty active format. This looks like third-party driver behaviour, and the reporter says it matches what happens when the camera is disconnected. Accepting media type 0 would just feed garbage into the pipeline. This needs the GoPro hardware and macOS to look into, and it cannot be justified from code alone.

- `plugins/mac-avcapture/OBSAVCapture.m:255-271`: rejects non-video/muxed `activeFormat`.
- `plugins/mac-avcapture/legacy/av-capture.mm:839`: same check in the legacy module the report quoted.
- Related: none.

### [#8005](https://github.com/obsproject/obs-studio/issues/8005) — Folders causing visibility issues in nested subscenes with show transitions

**Verdict: CANNOT_VERIFY**

This needs a specific setup: a group with a show transition, a nested scene that also has a show transition, and a display capture inside. It only fails on the first toggle after a restart. Show transitions for group children are started in `obs_sceneitem_set_visible` (`libobs/obs-scene.c:3029-3031`, `group_item_transition`). Active-child refcounting runs through `obs_source_add_active_child` and `obs_source_remove_active_child` (`libobs/obs-source.c:4732-4771`). It is plausibly the same family of show/active refcount asymmetry as #9961, but I could not pin down a defect from the description. The display-capture dependency suggests timing around activation or first frame.

- `libobs/obs-scene.c:3029-3043`: group child transitions plus active-ref increment.
- `libobs/obs-source.c:4732-4771`: parent show_refs and activate_refs propagated to children.
- Related: #9961.

### [#8035](https://github.com/obsproject/obs-studio/issues/8035) — Scene Collection importer finds no XSplit Scene

**Verdict: IMPLEMENT**

`XSplitImporter::FindFiles` only looks in `%ProgramData%\SplitMediaLabs\XSplit\Presentation2.0\`. The reporter, citing XSplit's support article, says current XSplit Broadcaster stores presentations in `%ProgramData%\XSplit\Broadcaster\Presentation\`. The defect is a hard-coded legacy path. The fix is small and Windows-only.

- `frontend/importers/xsplit.cpp:507`: only the legacy path is searched.
- `frontend/importers/xsplit.cpp:513-529`: the readdir loop looks for `Placements.bpres`. `os_readdir` and `os_closedir` are NULL-safe (`libobs/util/platform-windows.c:568-571`, `587-593`).
- Related: none.

**Slice plan**
- Files: `frontend/importers/xsplit.cpp`.
- Change: loop over two candidate subpaths, the new `XSplit\Broadcaster\Presentation\` first and then the legacy `SplitMediaLabs\XSplit\Presentation2.0\`. For each, call `os_get_program_data_path` and `os_opendir`, skip it if NULL, collect `Placements.bpres` if present, and push every hit into `res`. Keep the `#ifdef _WIN32` guard. About 20 lines.
- Test plan: Windows MSVC build of the `obs-studio` frontend target. Manual test: create `C:\ProgramData\XSplit\Broadcaster\Presentation\Placements.bpres` (copy any valid XSplit placement XML, or a minimal `<configuration>` file), then run Import → automatic search and confirm it is listed. I do not have a real XSplit export, so behaviour against genuine XSplit data is UNTESTED unless one can be found.

### [#8446](https://github.com/obsproject/obs-studio/pull/8446) — UI: Add Manage Scene Collections dialog

**Verdict: DEFER_LARGE**

This PR adds a new scene collection manager dialog, moves the scene collection menu into the scenes dock, adds bulk actions, caps the menu at the 10 most recent collections, and adds an IconLabel shared widget. `git diff master...refs/upstream-pr/8446 --stat` shows 56 files changed, +4361/-484, across 10+ commits including theme and stylesheet edits. It is a UX redesign that needs maintainer design sign-off, and it is far above the small-slice threshold. The local git build does not support `merge-tree --write-tree` (it errored with "unknown rev"), so I could not check whether it applies cleanly. It is clearly large either way. The narrow problem it partly addresses, a very long collection menu, is handled by the small slice in #9934.

- `git log master..refs/upstream-pr/8446`: 4407b0ad3, 59f4fde3b, 1f8d6cc6b, ab8d31168, ef9bb7c47, 9b83d2e77, etc.
- `frontend/widgets/OBSBasic_SceneCollections.cpp:375-408`: current menu population that the PR replaces.
- Related: #9934.

### [#8528](https://github.com/obsproject/obs-studio/issues/8528) — bug: list of existing broadcasts is not seen with a screen reader when tabbing

**Verdict: IMPLEMENT**

The "existing broadcasts" list in the YouTube actions dialog is built from `ClickableLabel` widgets added to a QScrollArea. `ClickableLabel` is a plain `QLabel` subclass that only handles `mousePressEvent`. It has the default `Qt::NoFocus` policy, no keyboard activation and no accessible name, so Tab skips every entry and a keyboard or screen-reader user cannot select a broadcast. That matches the report exactly.

- `frontend/components/ClickableLabel.hpp:6-21`: mouse-only, no focus policy, no key handling.
- `frontend/dialogs/OBSYoutubeActions.cpp:182-223`: each broadcast entry is a `ClickableLabel` with rich text, and selection happens on `clicked`.
- `frontend/forms/OBSYoutubeActions.ui:494-519`: `ytEventList` tab with `scrollArea` / `scrollAreaWidgetContents`.
- Related: none.

**Slice plan**
- Files: `frontend/components/ClickableLabel.hpp`, `frontend/dialogs/OBSYoutubeActions.cpp`.
- Change: in `ClickableLabel`, add a `keyPressEvent` override that emits `clicked()` on Space, Enter or Return and otherwise falls through to `QLabel`. This is harmless for other users of the class because they keep NoFocus. In `OBSYoutubeActions.cpp`, for each broadcast label call `setFocusPolicy(Qt::StrongFocus)` and `setAccessibleName(title)`, and set `setAccessibleDescription` to the plain-text status line. Optionally call `scrollArea->ensureWidgetVisible` on focus. About 25 lines.
- Test plan: Windows MSVC build of the frontend. A runtime check needs YouTube OAuth keys, which are compiled in only with official credentials, so the dialog cannot be opened in a local build. Runtime behaviour is UNTESTED. Build-only verification.

### [#8714](https://github.com/obsproject/obs-studio/issues/8714) — Auto scene switcher window size cannot be reduced smaller than the longest source title

**Verdict: IMPLEMENT**

In the Automatic Scene Switcher dialog, the `windows` QComboBox has no `sizeAdjustPolicy`, so it uses Qt's default `AdjustToContentsOnFirstShow`. Its minimum width therefore becomes the width of the longest window title, which pins the dialog's minimum width (1780 px in the report). The root cause is clear in the `.ui` file.

- `plugins/frontend-tools/forms/auto-scene-switcher.ui:20-27`: `windows` combo is editable with `maxVisibleItems` set, but has no sizeAdjustPolicy or minimumContentsLength.
- `plugins/frontend-tools/auto-scene-switcher.cpp:109`: adds every window title as an item.
- Related: none.

**Slice plan**
- Files: `plugins/frontend-tools/forms/auto-scene-switcher.ui`.
- Change: on the `windows` combo, set `sizeAdjustPolicy` = `QComboBox::AdjustToMinimumContentsLengthWithIcon` and `minimumContentsLength` = 20, and give it an Expanding horizontal size policy. Long titles are then elided in the field, while the popup still shows the full text. About 15 lines of XML.
- Test plan: Windows MSVC build of the `frontend-tools` target. Open a window with a very long title, open Tools → Automatic Scene Switcher, and confirm the dialog can be narrowed. Testable on this box.

### [#8906](https://github.com/obsproject/obs-studio/issues/8906) — Crop/Pad Filter and Transform on Window Capture doesn't reset correctly when window is restored after being maximized

**Verdict: CANNOT_VERIFY**

After a maximize and restore of Firefox, Edge or Thunderbird, the window capture's effective size or offset is wrong until the source is hidden and shown again, which recreates the capture. In the WGC path, `on_frame_arrived` sizes the texture from the surface `desc` and only calls `frame_pool.Recreate` after copying. The first frame after a resize is therefore copied from a stale-sized pool buffer. `get_client_box` uses DWM extended frame bounds, which differ for maximized windows. One hypothesis: the browser stops producing frames after restore (static content), so the stale-sized frame persists. That would explain why hide/show fixes it. I could not confirm this from code alone. It depends on the app's frame cadence and the capture method (WGC or BitBlt), and needs a Windows repro with those apps.

- `libobs-winrt/winrt-capture.cpp:132-191`: frame size is taken from `desc`, and the pool is recreated after the copy.
- `libobs-winrt/winrt-capture.cpp:39-76`: client box from `DWMWA_EXTENDED_FRAME_BOUNDS` and `ClientToScreen`.
- Related: #10406 (same symptom).

### [#9125](https://github.com/obsproject/obs-studio/issues/9125) — File resources are not automatically restored after reboot

**Verdict: OUT_OF_SCOPE**

This is a Flatpak build on Arch. Files picked through the file chooser go through the XDG Document Portal and get `/run/user/<uid>/doc/<id>/...` paths. Those paths only survive while the portal's permission store and mount persist, which is the portal's behaviour, as the reporter suspects. OBS stores whatever path the file dialog returns. The fix is either a Flatpak permission (`--filesystem=` for the media partition, which is user configuration) or a portal change. Neither belongs in OBS's source code.

- OBS saves source file paths as given by Qt's file dialog (e.g. image or media `file` settings). No OBS-side path mangling is involved.
- Related: none.

### [#9321](https://github.com/obsproject/obs-studio/issues/9321) — crash when playing an invalid video file using VLC video source

**Verdict: CANNOT_VERIFY**

On macOS 13, adding a text/XML file renamed to `.mp4` to a VLC source playlist crashes OBS. The crash log is only an external attachment and is not in the dataset, so there is no stack. The VLC source (`plugins/vlc-video`) hands the file to libVLC, and the crash could be inside libVLC or in OBS's callbacks. Without the stack I cannot identify a defect.

- `plugins/vlc-video/vlc-video-source.c`: playlist built from settings and passed to libVLC. No obvious unchecked path without a stack.
- Related: #9345 (same plugin).

### [#9345](https://github.com/obsproject/obs-studio/issues/9345) — VLC video source skips the first and last second from mp3 files in a playlist

**Verdict: CANNOT_VERIFY**

Clipping at the start and end of mp3 tracks in a libVLC media list player. OBS hands timing to libVLC through its audio callbacks. The clipping could come from libVLC's playlist transitions or from OBS's audio buffering and timestamp handling in the VLC plugin, and the report gives no way to tell which. It needs a Windows repro with sample files and VLC builds.

- `plugins/vlc-video/vlc-video-source.c`: audio callback path into `obs_source_output_audio`.
- Related: #9321.

### [#9811](https://github.com/obsproject/obs-studio/issues/9811) — Stinger Transition: Preload Video to RAM not working as expected

**Verdict: DEFER_LARGE**

Each stinger transition creates its own private `ffmpeg_source` with `full_decode` set from the "preload" option. Every transition instance therefore decodes and holds its own full copy of the file in RAM. Reusing the same webm as a show/hide transition on 20+ items multiplies memory use. Sharing decoded frames across instances would need a cross-source cache keyed by file in media-playback or obs-ffmpeg (lifetime, refcounting, thread safety). That is not a small slice. The current behaviour is as designed, just memory-hungry.

- `plugins/obs-transitions/transition-stinger.c:72-89`: per-instance `ffmpeg_source` with `full_decode = preload`.
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:311,458`: `full_decode` per source.
- Related: none.

### [#9934](https://github.com/obsproject/obs-studio/issues/9934) — No scroll bar in profile/scene collection menus with 100+ entries

**Verdict: IMPLEMENT**

The Profile and Scene Collection menus are plain QMenus, with one QAction per collection or profile added in a loop. OBS's proxy style never enables `SH_Menu_Scrollable`, and the themes do not set `menu-scrollable`. With 100+ entries Qt therefore does not scroll the menu and instead falls back to its multi-column overflow layout, which reporters cannot use well. Enabling scrollable menus for these two menus is a tiny, well-contained change.

- `frontend/utility/OBSProxyStyle.cpp:4-17`: `styleHint` override with no `SH_Menu_Scrollable` handling.
- `frontend/widgets/OBSBasic_SceneCollections.cpp:375-408`: one QAction per scene collection in `sceneCollectionMenu`.
- `frontend/widgets/OBSBasic_Profiles.cpp`: same pattern for `profileMenu`.
- `frontend/data/themes/Yami.obt:609-611,746-749`: QMenu rules without `menu-scrollable`.
- Related: #8446, which addresses it by capping the menu at 10 recent entries plus a manager dialog (deferred).

**Slice plan**
- Files: `frontend/utility/OBSProxyStyle.cpp`.
- Change: in `OBSProxyStyle::styleHint`, return 1 for `SH_Menu_Scrollable` when `qobject_cast<const QMenu *>(widget)` and the widget's objectName is `sceneCollectionMenu` or `profileMenu`. This scopes the change to those two menus so other menus keep their current look. If `QStyleSheetStyle` does not delegate this hint to the proxy, fall back to calling `setStyleSheet("QMenu { menu-scrollable: 1; }")` on those two menus in OBSBasic setup. About 10 lines.
- Test plan: Windows MSVC build of the frontend. Create 100+ scene collections (copy JSON files into `%APPDATA%\obs-studio\basic\scenes`) and confirm the menu scrolls. Testable on this box.

### [#9961](https://github.com/obsproject/obs-studio/issues/9961) — [obs_source] Wrong reference count for active_ref/show_refs

**Verdict: DEFER_LARGE**

The reporter has a reproducible case: an invisible group, an audio input moved into it, the group made visible, then a switch to another scene. The audio stays active, and after deleting everything it still appears in Add Existing. The reporter attributes this to unmatched `++show_refs/activate_refs` and `--` for group children (see also #3334). In the code, `obs_source_add_active_child` and `obs_source_remove_active_child` replay the parent's current `show_refs`/`activate_refs` onto the child. If a child is added to or moved into a group while the group's refs differ from when it is later removed, the counts drift. `obs_sceneitem_set_visible` and group-move paths add a further layer. A correct fix needs a careful audit of every group add, move and remove path in libobs. The reporter's own suggestion, per-group tracking of which children were activated, is a core refcount redesign. This is a core-correctness change with high regression risk, not a small slice.

- `libobs/obs-source.c:4732-4771`: replay-based activate and deactivate of children.
- `libobs/obs-scene.c:1104-1106,1556,3035-3041`: active-child add and remove sites, gated by `item->active_refs`.
- Related: #8005.

### [#10031](https://github.com/obsproject/obs-studio/issues/10031) — OBS incorrectly reads the window resolution when it has a border

**Verdict: IMPLEMENT**

This is a real defect in the X11 XComposite window capture. `xcb_get_geometry` returns the window's inner `width`/`height`, which exclude the X border. The pixmap from `xcb_composite_name_window_pixmap` includes the border, so it is (w + 2·bw) × (h + 2·bw). The code builds the GL texture with the inner size (`s->width`, `s->height`) and reports that size as the source size. As the reporter observed, the full pixmap including the border gets squeezed into a smaller texture size, which slightly downscales the image. The `include_border` option is also inverted: it subtracts `2*border` from an inner size that never included the border. The render offset also never skips the border when it should be excluded.

- `plugins/linux-capture/xcomposite-input.c:360-368`: `s->border = include_border ? bw : 0; s->width = geom->width; s->height = geom->height;`
- `plugins/linux-capture/xcomposite-input.c:392`: texture created as `s->width x s->height` from the border-inclusive pixmap.
- `plugins/linux-capture/xcomposite-input.c:526-548`: size subtracts `crop + 2*border`.
- `plugins/linux-capture/xcomposite-input.c:689`: draw subregion offset only by crop, never by border.
- `plugins/linux-capture/xcomposite-input.c:650,913`: cursor offset uses crop only.
- Related: none.

**Slice plan**
- Files: `plugins/linux-capture/xcomposite-input.c`.
- Change: in `xcomp_create_pixmap`, set `s->width = geom->width + 2*geom->border_width` and the same for height (the pixmap size), and `s->border = s->include_border ? 0 : geom->border_width` (the amount to trim). In `xcompcap_video_render`, offset the subregion by `crop_left + border` and `crop_top + border`. Add `s->border` in the two `xcb_xcursor_offset` calls. `get_width`/`get_height` then stay correct as `width - crops - 2*border`. Default behaviour (include_border = false) then shows exactly the inner window at native size, and include_border = true shows the border without scaling. About 15 lines.
- Test plan: this is Linux/X11-only code. It cannot be built or run on this Windows box, so it is UNTESTED. Needs an X11 WM with non-zero borders (dwm, i3) to verify.

### [#10060](https://github.com/obsproject/obs-studio/issues/10060) — image_source: failed to load texture

**Verdict: IMPLEMENT**

When an image file changes on disk, `image_source_tick` calls `image_source_load`. That function first unloads the current image (`image_source_unload` frees it), then decodes the file again. `image_source_preload_image` records the new mtime before decoding. If the file is still being written, the decode fails: the source goes blank, and because `file_timestamp` already holds the new mtime, it is never retried until the file changes again. That is exactly the reported behaviour. The fix is clear: decode into a temporary image and swap it in only on success, and do not commit the timestamp on failure, so the next 1 s poll retries.

- `plugins/image-source/image-source.c:48-57`: timestamp is set before decode.
- `plugins/image-source/image-source.c:79-98`: `image_source_load` unloads first, then loads.
- `plugins/image-source/image-source.c:243-253`: modified-file poll calls `image_source_load`.
- Related: none.

**Slice plan**
- Files: `plugins/image-source/image-source.c`.
- Change: add `image_source_reload_modified(context, time_t t)`. It runs `gs_image_file_ex_init` into a local `gs_image_file_ex_t tmp`. If `!tmp.loaded`, it frees tmp under graphics, leaves the current image and `file_timestamp` untouched (so the next poll retries), and returns. Otherwise it calls `gs_image_file_ex_init_texture(&tmp)` under graphics, frees the old `context->image`, assigns `context->image = tmp`, sets `file_timestamp = t`, and keeps `file_decoded`/`texture_loaded` true. If the file was deleted (`t == -1`), it keeps the existing unload behaviour. The tick and render paths both run on the graphics thread, so the swap is safe. Before committing, verify that `gs_image_file_ex_t` has no internal self-pointers so the struct copy is safe; if it does, use the "do not commit timestamp on failure" half alone. Do NOT change the poll interval the reporter suggested. About 35 lines.
- Test plan: Windows MSVC build of the `image-source` plugin. Run a script that rewrites a PNG 2-3 times per second (write to the target path non-atomically) and confirm the source never goes blank or stays blank. Testable on this box.

### [#10120](https://github.com/obsproject/obs-studio/issues/10120) — Undo/Redo completely broke the scene layout

**Verdict: CANNOT_VERIFY**

The reporter cannot reproduce this in a fresh scene, only in one specific roughly 20-item scene, and only a video is provided. Undo/redo for transforms lives in the frontend undo stack, and no specific defect can be identified from the description. It needs the scene collection JSON and exact steps.

- `frontend/undo-stack-obs.cpp` / transform undo hooks in the preview: generic, no identified defect.
- Related: none.

### [#10227](https://github.com/obsproject/obs-studio/issues/10227) — [Text source] Dragging the slider for "Background opacity" causes massive render lag

**Verdict: DEFER_LARGE**

Root cause is understood but has no small fix. `obs_source_update` defers updates of video sources to the video tick (`libobs/obs-source.c:1112-1113,1410-1411`), so while the slider is dragged the GDI+ text source re-runs `TextSource::Update` → `RenderText()` on the graphics thread every frame. That is a full GDI+ rasterisation plus a texture upload (`gs_texture_set_image` or `gs_texture_create` under the graphics lock), because the background colour and opacity are baked into the bitmap (`obs-text.cpp:587`). Fixing it properly means either drawing the background with a shader or second quad so that opacity changes skip re-rasterisation (a refactor of the text source's render path), or adding generic slider throttling in the properties view (a UX/design decision that affects every source). Neither is a small, safe slice.

- `plugins/obs-text/gdiplus/obs-text.cpp:567-645`: `RenderText` rasterises and uploads.
- `plugins/obs-text/gdiplus/obs-text.cpp:587`: bk opacity baked into the bitmap.
- `plugins/obs-text/gdiplus/obs-text.cpp:725-852`: `Update` always ends in `RenderText()`.
- `libobs/obs-source.c:1103-1117,1410-1411`: deferred update on video tick.
- Related: none.

### [#10322](https://github.com/obsproject/obs-studio/issues/10322) — browser cache problem

**Verdict: OUT_OF_SCOPE**

This covers browser-source caching of iframe subresources, the "refresh cache" button, and piping all console logs into the OBS log. The browser source is the `obs-browser` submodule (separate repository, separate maintainers, CEF behaviour). The cache behaviour is standard CEF/Chromium HTTP caching that the web page controls with cache headers. The console-log request is a feature for obs-browser, not obs-studio core. The report is also vague ("maybe a.js not change").

- `plugins/obs-browser` is a git submodule. Recent commits on master only bump its version (95d5223b6, f1c0a1164).
- Related: none.

### [#10382](https://github.com/obsproject/obs-studio/issues/10382) — Images in slideshow are not ordered if added by folder (random disabled)

**Verdict: IMPLEMENT**

When a folder is added to the Image Slide Show, its entries are appended in raw `os_readdir` order. On Linux `readdir` makes no ordering guarantee. On Windows `FindNextFile` order on NTFS happens to be roughly alphabetical, which is why this only shows up on Linux. Nothing sorts the per-directory files, so in sequential mode the order is effectively arbitrary.

- `plugins/image-source/obs-slideshow-mk2.c:490-526`: directory loop appends via `add_file` in readdir order.
- `plugins/image-source/obs-slideshow-mk2.c:229-235`: `add_file` pushes `{path}` into the `image_file_array_t` DARRAY.
- `plugins/image-source/obs-slideshow-mk2.c:74-84`: `struct image_file_data { char *path; }`.
- Related: none.

**Slice plan**
- Files: `plugins/image-source/obs-slideshow-mk2.c`.
- Change: before the readdir loop, record `size_t first = new_data.files.num`. After `os_closedir`, `qsort(new_data.files.array + first, new_data.files.num - first, sizeof(struct image_file_data), cmp_path)`, where `cmp_path` uses `strcmp` on `path`. Sorting only the per-directory range keeps the user's explicit item order across list entries. Natural ("img2" before "img10") or case-insensitive ordering is optional; plain `strcmp` matches the issue's "alphabetical" request and is deterministic everywhere. About 15 lines.
- Test plan: Windows MSVC build of the `image-source` plugin. On Windows readdir is already mostly sorted, so verify with files created in non-alphabetical order (NTFS still returns them sorted, so also check a FAT32/exFAT USB folder, where directory order is creation order). The Linux path is UNTESTED here.

### [#10406](https://github.com/obsproject/obs-studio/issues/10406) — Window capture on web browsers offsets after fullscreening browser and unfullscreening

**Verdict: CANNOT_VERIFY**

Same symptom family as #8906, here with WGC selected automatically for firefox.exe: after fullscreen and back, the capture is offset at the top-left and cut off. The candidate code is the same: client-box computation from DWM extended frame bounds, with stale-sized frames around the `frame_pool.Recreate` step. No deterministic defect was identified without a Windows repro with Chrome or Firefox fullscreen toggling. Worth a combined repro session with #8906. Once a repro exists, a likely small fix is to recompute or invalidate the client box and texture on the first frame whose `ContentSize` differs from `last_size`.

- `libobs-winrt/winrt-capture.cpp:39-76,132-191`.
- Related: #8906.

### [#10425](https://github.com/obsproject/obs-studio/issues/10425) — One shot GIFs do not play all their frames when using "Media Source" unlooped

**Verdict: CANNOT_VERIFY**

With looping off, a GIF in a Media Source ends before its final frames appear. In the playback loop, `mp_media_next_video` outputs the current frame, `mp_media_prepare_frames` decodes the next one, and `mp_media_eof` immediately stops (active = false, stopping = true) and resets as soon as no next frame is ready. The last frame's display duration is therefore never honoured before the stop callback (the media source by default clears on end). That explains losing the final frame's hold time. The report says about 10% of frames go missing (a whole sub-animation), which may instead involve FFmpeg's GIF demuxer/decoder timing or frame dropping in `mp_media_next_video`. I cannot confirm which without running the sample GIF. Plausible slice once confirmed: delay the EOF stop in non-loop mode until `next_ns` has elapsed for the last frame.

- `shared/media-playback/media-playback/media.c:619-640`: EOF stops immediately when no frame is ready.
- `shared/media-playback/media-playback/media.c:816-829`: order of next_video → prepare_frames → eof check.
- Related: none.
