# Upstream triage — batch sources-filters-06

- Batch id: sources-filters-06 (area hint: sources-filters)
- Items: 12625, 12656, 12704, 12741, 12743, 12744, 12796, 12819, 12824, 12831, 12836, 12849, 12853, 12881, 12888, 12954, 12984, 12987, 13086, 13093, 13102, 13126
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; PR heads from `refs/upstream-pr/<N>`; code read on master. No comment threads fetched (0 WebFetch used).
- Note on conflict checks: the local git (2.33) has no `merge-tree --write-tree`; the legacy three-way form `git merge-tree $(git merge-base master PR) master PR` was used and scanned for conflict markers.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 12625 | issue | IMPLEMENT (fix derivative footprint in area / bilinear_lowres shaders) |
| 12656 | PR | IMPLEMENT (cherry-pick 2e9a1e53a + small cache-consistency fix) |
| 12704 | issue | CANNOT_VERIFY |
| 12741 | issue | CANNOT_VERIFY |
| 12743 | PR | DEFER_LARGE |
| 12744 | issue | CANNOT_VERIFY |
| 12796 | issue | CANNOT_VERIFY |
| 12819 | issue | CANNOT_VERIFY |
| 12824 | PR | IMPLEMENT (partial-pr: PR + weak-ref / obs_source_remove guard) |
| 12831 | PR | IMPLEMENT (cherry-pick, trivial conflict) |
| 12836 | issue | CANNOT_VERIFY |
| 12849 | issue | IMPLEMENT (always install FFmpeg interrupt callback) |
| 12853 | issue | IMPLEMENT (escape `&` in profile/collection menu actions) |
| 12881 | PR | IMPLEMENT (cherry-pick) |
| 12888 | issue | CANNOT_VERIFY |
| 12954 | issue | CANNOT_VERIFY |
| 12984 | issue | IMPLEMENT (measure exactly the drawn string length) |
| 12987 | issue | CANNOT_VERIFY |
| 13086 | issue | OUT_OF_SCOPE (working as designed) |
| 13093 | PR | IMPLEMENT (partial-pr: PR + fix UTF-16 tail buffer overflow) |
| 13102 | PR | DEFER_LARGE |
| 13126 | PR | DEFER_LARGE |

---

### [#12625](https://github.com/obsproject/obs-studio/issues/12625) — Scale filtering breaks when source is rotated (any but 180deg)

**Verdict: IMPLEMENT**

Reasoning: When a scene item has a scale filter, it is rendered through `render_item_texture`, which picks `bilinear_lowres_effect` when the item is downscaled below 0.5x and `area_effect` when the Area filter is chosen. Both shaders estimate the per-pixel texture footprint using only the *axis-aligned* screen derivatives `float2(ddx(uv.x), ddy(uv.y))`. Under a 90 degree rotation, `uv.x` changes only along screen Y and `uv.y` only along screen X, so both values are about 0. Bilinear_lowres then takes all its taps at the same texel, which gives aliasing. Area gets a zero-size footprint, so `target_dimension = 1/uv_delta` blows up. At other angles the estimate is too small. At 180 degrees the derivatives are only negated, which explains why the reporter says that case works. Bicubic and Lanczos (used at scales of 0.5 or more) take fixed texel offsets and do not depend on rotation. This is a clear shader defect.

Evidence:
- `libobs/obs-scene.c:743-780`: `render_item_texture` chooses `bilinear_lowres_effect` (scale < 0.5) or `area_effect`.
- `libobs/data/area.effect:40` and `:123`: `float2 uv_delta = float2(ddx(uv.x), ddy(uv.y));`
- `libobs/data/bilinear_lowres_scale.effect:39`: `float2 stepxy = float2(ddx(uv.x), ddy(uv.y));`
- `libobs/obs-scene.c:660`: rotation is folded into `draw_transform`, so the shader sees rotated UVs.

Slice plan: in the three lines, replace the axis-aligned derivative with a rotation-invariant footprint, `float2(length(float2(ddx(uv.x), ddy(uv.x))), length(float2(ddx(uv.y), ddy(uv.y))))`. The area.effect OpenGL `abs()` flip handling then becomes redundant but harmless. That is about 6 lines in 2 effect files. Bilinear_lowres's sign-symmetric taps are unaffected.

Related: none.

---

### [#12656](https://github.com/obsproject/obs-studio/pull/12656) — image-source: Add shuffled playback mode for slide show

**Verdict: IMPLEMENT** (cherry-pick-pr, plus a small fix)

Reasoning: The PR adds a "Shuffled" playback mode to Image Slide Show. It runs a Fisher-Yates shuffle over the file list on restart and whenever the deck wraps. It is small (47+/9-, 2 files), stays inside the plugin, and the legacy merge-tree shows no conflicts. The feature suits the plugin's scope (RFC 17 and a third-party plugin both exist for it). Only the real commit `2e9a1e53a` needs taking; the other three commits are merges from master.

One defect in the PR: `shuffle_files` swaps `files[i].path` and `files[r].path`, but it fixes up the cached `source_data.slide_idx` only when *both* slots have a cached source (`if (rsd && isd)`). It also never fixes them up when the list is larger than `SLIDE_BUFFER_COUNT*4+1`. `get_new_source` / `find_existing_source` look up cached sources by `slide_idx` alone, so a stale cache entry can show the wrong image for an index. That breaks the "every slide exactly once" promise for a few slides near the wrap.

Evidence:
- `plugins/image-source/obs-slideshow-mk2.c:74-82`: `image_file_data` holds only `path`, so swapping paths is enough; `source_data` caches `slide_idx` and `path`.
- `plugins/image-source/obs-slideshow-mk2.c:316-372`: `find_existing_source` matches on `slide_idx` only.
- `plugins/image-source/obs-slideshow-mk2.c:190-210`: the existing Random mode is independent picks (re-rolls only an immediate repeat), which is the problem being solved.
- `git diff master...refs/upstream-pr/12656 --stat`: 2 files, 47+/9-.

Slice plan: cherry-pick `2e9a1e53a` (author preserved). Follow-up fix: in `get_new_source`, accept a cached `psd` only when `psd->path == ssd->files.array[slide_idx].path`. Pointer equality is valid because the shuffle swaps the same pointers. Alternatively, update `rsd` and `isd` independently. About 4 lines.

Related: none.

---

### [#12704](https://github.com/obsproject/obs-studio/issues/12704) — Cropping adjusting incorrectly when switching scene collections on different base canvas sizes

**Verdict: CANNOT_VERIFY**

Reasoning: Crop on ordinary inputs (images, video) is stored in source pixels and is never rescaled by libobs. The only code that rescales crop is `update_nested_scene_crop`, and it runs only for nested-scene items (`item->is_scene`) when the nested scene's size changes, for example after the canvas resolution changes. The reporter says the problem is intermittent ("not every source") and affects images and videos, which that path does not touch. Item *scale* is canvas-relative (`item_canvas_scale`), which can look like a crop change but is by design. A deterministic repro and the scene JSON would be needed before touching code.

Evidence:
- `libobs/obs-scene.c:586-599`: `update_nested_scene_crop` scales crop by the size ratio.
- `libobs/obs-scene.c:623-625`: called only for `item->is_scene`.
- `libobs/obs-scene.c:409-421`: `item_canvas_scale` rescales non-scene items relative to canvas height.

Related: 13086.

---

### [#12741](https://github.com/obsproject/obs-studio/issues/12741) — When I create, rename, or duplicate a collection of scenes, OBS crashes

**Verdict: CANNOT_VERIFY**

Reasoning: The report is from Arch Linux (32.0.1, a distribution package rather than the official Flatpak) with no crash log or stack trace; the reporter says the log shows nothing. The thread has 13 comments that are not available locally. Nothing in the body points to a code path in `frontend/widgets/OBSBasic_SceneCollections.cpp`.

Evidence:
- `frontend/widgets/OBSBasic_SceneCollections.cpp:338-415`: the collection switching and menu code, with no obvious fault without a stack.

Related: none.

---

### [#12743](https://github.com/obsproject/obs-studio/pull/12743) — Separation of the transitions dock from the main window

**Verdict: DEFER_LARGE**

Reasoning: This is a 6-commit frontend refactor (16 files, 529+/371-). It moves the transitions dock out of `OBSBasic`, replaces fade/cut pointers with UUIDs, and reorganises the frontend-API transition events. It is labelled "Seeking Testers" and the author has not tested it. It is far beyond a small slice and risks regressions in the frontend API.

Evidence:
- `git diff master...refs/upstream-pr/12743 --stat`: 16 files changed, 529 insertions, 371 deletions.
- `frontend/widgets/OBSBasic_Transitions.cpp`: the code it rewrites.

Related: none.

---

### [#12744](https://github.com/obsproject/obs-studio/issues/12744) — OBS Studio 32.0.1 - video from rtsp source freezes; program hangs

**Verdict: CANNOT_VERIFY**

Reasoning: On macOS, three RTSP Media Sources freeze after about 90 minutes and the app hangs. There is no stack or sample. The setup depends on specific Sony PTZ cameras and on network conditions. It may be related to blocking FFmpeg reads (see #12849), but this reporter does not mention "Rewindable", so the network path already has the interrupt callback and `stimeout`. A hang dump would be needed to tie it to code.

Evidence:
- `shared/media-playback/media-playback/media.c:689-693`: network sources do get `stimeout` and `interrupt_callback`.

Related: 12849.

---

### [#12796](https://github.com/obsproject/obs-studio/issues/12796) — Browser sources are freezing intermittently

**Verdict: CANNOT_VERIFY**

Reasoning: Browser sources and docks freeze intermittently. Upstream has confirmed it (label `issue/confirmed`), but there is no root cause. The code is in the `plugins/obs-browser` submodule (CEF), not in this tree, and the report says the logs show nothing. It cannot be tied to a code defect from here.

Evidence:
- `.gitmodules`: `plugins/obs-browser` is a submodule.

Related: 12888, 12987.

---

### [#12819](https://github.com/obsproject/obs-studio/issues/12819) — Using Media Keys for Hotkeys

**Verdict: CANNOT_VERIFY**

Reasoning: On Zorin OS (X11), pressing Play/Pause in the hotkey field does nothing. libobs already maps `OBS_KEY_VK_MEDIA_PLAY_PAUSE` to and from `XF86XK_AudioPlay` on X11 and Wayland. `OBSHotkeyEdit` resolves keys through `obs_key_from_virtual_key(event->nativeVirtualKey())`. The most likely cause is the desktop environment (gnome-settings-daemon media-keys) grabbing the key globally, so the Qt widget never receives a key event. That is outside OBS and could not be confirmed on this Windows machine.

Evidence:
- `libobs/obs-nix-x11.c:674-675`: maps `OBS_KEY_VK_MEDIA_PLAY_PAUSE` to `XF86XK_AudioPlay`.
- `libobs/obs-nix-x11.c:1237-1260`: `obs_nix_x11_key_from_virtual_key` looks up the keysym in the keyboard map.
- `frontend/settings/OBSHotkeyEdit.cpp:54`: capture uses `nativeVirtualKey()`.

Related: none.

---

### [#12824](https://github.com/obsproject/obs-studio/pull/12824) — libobs: Fix canvas private duplicated scenes

**Verdict: IMPLEMENT** (partial-pr: take the PR and add a safety fix)

Reasoning: The root cause is real. `obs_scene_duplicate(..., OBS_SCENE_DUP_PRIVATE_REFS/COPY)`, used by Studio Mode, goes through `create_private_id`. That calls `obs_source_create_private` with a NULL canvas, so `obs_source_create_internal` logs "Attempted to add Scene without specifying a canvas!" and the private scene gets no `source->canvas`. Width and height then fall back to the main video, which is wrong for scenes on other canvases. The PR passes the canvas through and sets `source->canvas` (as a weak reference) for private canvas-requiring sources.

The PR as written introduces two problems:
1. A weak-reference leak. `obs_source_destroy` releases `source->canvas` only through `obs_canvas_remove_source` inside `if (!source->context.private)`, so a private scene's weak canvas reference is never released.
2. A double-release risk. `obs_source_remove` calls `obs_canvas_remove_source` whenever `source->canvas` is set. For a scene on a canvas with `SCENE_REF` (the main canvas, `PROGRAM` includes `SCENE_REF`), that calls `obs_source_release(source)` even though the canvas never took a reference on the private scene.

Evidence:
- `libobs/obs-scene.c:1788-1792` and `:1941-1944`: `create_private_id` ignores the canvas.
- `libobs/obs-source.c:516-520`: the warning and the fallback to the main canvas.
- `libobs/obs-source.c:281-289`: `obs_source_init_finalize` sets the canvas only for public sources.
- `libobs/obs-source.c:785-793`: destroy removes from the canvas only for non-private sources.
- `libobs/obs-source.c:968-980`: `obs_source_remove` calls `obs_canvas_remove_source` when `source->canvas` is set.
- `libobs/obs-canvas.c:356-374`: `obs_canvas_remove_source` releases the scene for `SCENE_REF` canvases.
- `libobs/obs.h:2642-2646`: `PROGRAM = ACTIVATE | MIX_AUDIO | SCENE_REF`.
- `frontend/widgets/OBSBasic_StudioMode.cpp:206-207` and `frontend/widgets/OBSBasic_Transitions.cpp:325-326`: the callers.
- The legacy merge-tree shows no conflicts (3 files, 14+/4-).

Slice plan: cherry-pick `0ba77b73a` (author preserved), then add:
- In `obs_source_destroy`, an `else if (source->canvas) { obs_weak_canvas_release(source->canvas); source->canvas = NULL; }` branch for private sources.
- In `obs_source_remove`, a guard `if (source->canvas && !source->context.private)`.

That is about 25 lines.

Related: 13102, 13126 (canvas work by the same authors).

---

### [#12831](https://github.com/obsproject/obs-studio/pull/12831) — frontend: Add MediaControls to source properties

**Verdict: IMPLEMENT** (cherry-pick-pr, resolving one trivial conflict)

Reasoning: The PR is a single commit (93+/2-, 4 files) by an upstream UI maintainer. It embeds the existing `MediaControls` widget in the Properties dialog for sources with `OBS_SOURCE_CONTROLLABLE_MEDIA`, and hides it for network media sources. Its stated dependency (#8041) is already satisfied on master: `frontend/components/MediaControls.*`, `idian::Utils`, and the `OBSPropertiesView::PropertiesRefreshed` signal all exist. The only conflict is a brace-style hunk around `if (cx > 400 && cy > 400) {` in the constructor.

Evidence:
- `frontend/components/MediaControls.cpp` and `.hpp`: present on master.
- `shared/properties-view/properties-view.hpp:143` and `properties-view.cpp:165`: the `PropertiesRefreshed` signal.
- `shared/qt/idian/include/Idian/Utils.hpp`: present.
- The merge-tree conflict is limited to `frontend/dialogs/OBSBasicProperties.cpp` (constructor resize block); the `.ui`, `.hpp` and `Yami.obt` changes merge cleanly.

Slice plan: cherry-pick `bb20f3766`. Resolve the conflict by keeping master's braced `if (cx > 400 && cy > 400) { resize(cx, cy); }` and inserting the PR's `controlsFrame->hide()` and `addClass` lines before it.

Related: none.

---

### [#12836](https://github.com/obsproject/obs-studio/issues/12836) — Banding when using "Use 10 bit" checkbox in Blackmagic Device Source

**Verdict: CANNOT_VERIFY**

Reasoning: With 10-bit allowed, the DeckLink source switches to `bmdFormat10BitYUV` (v210) or `bmdFormat10BitRGBXLE` (R10L) and passes these through to OBS as `VIDEO_FORMAT_V210` / `VIDEO_FORMAT_R10L`. The banding could come from the colour range or space on that path, from the 8-bit output pipeline, or from the device or driver. It needs Blackmagic hardware on macOS to reproduce, and the report has no log.

Evidence:
- `plugins/decklink/decklink-device-instance.cpp:66-69`: maps the 10-bit pixel formats.
- `plugins/decklink/decklink-device-instance.cpp:454-466` and `:745-762`: 10-bit format selection.

Related: none.

---

### [#12849](https://github.com/obsproject/obs-studio/issues/12849) — Check rewindable in media source settings makes OBS freeze without release

**Verdict: IMPLEMENT**

Reasoning: The root cause is clear. When "Seekable/Rewindable" is ticked on a non-local (URL) Media Source, the source passes `.is_local_file = s->is_local_file || s->seekable` to media-playback. `init_avformat` installs the FFmpeg `interrupt_callback`, and sets `stimeout`, only when `!m->is_local_file`. A rewindable RTSP stream therefore opens with no interrupt callback, so a blocking `avformat_open_input` or `av_read_frame` on the network cannot be aborted on stop or kill. Closing the properties window or the source then hangs on joining the media thread. The interrupt callback only checks `m->kill || m->stopping` and is safe for local files too.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:308`: `.is_local_file = s->is_local_file || s->seekable`.
- `shared/media-playback/media-playback/media.c:689-693`: callback and `stimeout` only for non-local sources.
- `shared/media-playback/media-playback/media.c:642-657`: `interrupt_callback` checks kill and stopping.

Slice plan: in `init_avformat`, install `m->fmt->interrupt_callback` unconditionally and keep `stimeout` network-only. About 4 lines. If the callback should apply only when there is an actual network URL, an alternative is a separate `is_network` field on `mp_media_info`, set from `!s->is_local_file`, which would be about 10 lines over 3 files.

Related: 12744.

---

### [#12853](https://github.com/obsproject/obs-studio/issues/12853) — Ampersand in Profile or Scene Collection title doesn't show in drop-down menu list

**Verdict: IMPLEMENT**

Reasoning: The root cause is clear. The Profile and Scene Collection menus create `QAction(qName, this)` with the raw name. Qt treats `&` in action text as a mnemonic marker: it hides the `&` and underlines the next character, which is the "short underscore" the reporter sees. The switching logic reads the `profile_name` / `collection_name` property, not `text()`, so escaping only the display text is safe.

Evidence:
- `frontend/widgets/OBSBasic_SceneCollections.cpp:401`: `new QAction(qCollectionName, this)`.
- `frontend/widgets/OBSBasic_Profiles.cpp:316`: `new QAction(qProfileName, this)`.
- `frontend/widgets/OBSBasic_SceneCollections.cpp:348` and `frontend/widgets/OBSBasic_Profiles.cpp:263`: selection uses `property(...)`, not `text()`.

Slice plan: construct the actions with `QString(qName).replace("&", "&&")` in both files. About 4 lines.

Related: none.

---

### [#12881](https://github.com/obsproject/obs-studio/pull/12881) — frontend: Condense duplicated grid logic in SceneTree

**Verdict: IMPLEMENT** (cherry-pick-pr)

Reasoning: This is a pure refactor (24+/34-). It moves the scrollbar-policy and grid-width computation, repeated in `resizeEvent`, `dropEvent` and `RepositionGrid`, into `ComputeGridWidth`. I checked the behaviour: each caller previously computed exactly `contentsRect().width() - scrollWid - 1` after the same policy toggle, so the result is identical. The legacy merge-tree shows no conflicts.

Evidence:
- `frontend/components/SceneTree.cpp` on master: the three duplicated blocks the diff removes.
- `git diff master...refs/upstream-pr/12881 --stat`: 2 files, 24+/34-.

Slice plan: cherry-pick `0f7916125` (author preserved).

Related: none.

---

### [#12888](https://github.com/obsproject/obs-studio/issues/12888) — Choppy videos in browser sources with hardware acceleration enabled

**Verdict: CANNOT_VERIFY**

Reasoning: The setup is Flatpak on Fedora 43 with an AMD RX 7900 XTX. Video playback in a browser source is choppy only with browser hardware acceleration enabled, while CSS animation is smooth. This points to CEF GPU video decode or shared textures on Linux/AMD, in the obs-browser submodule or the driver. It cannot be reproduced or tied to code here.

Evidence:
- `.gitmodules`: `plugins/obs-browser` is a submodule.

Related: 12796.

---

### [#12954](https://github.com/obsproject/obs-studio/issues/12954) — OBS breaks after adding sources and opening source projector

**Verdict: CANNOT_VERIFY**

Reasoning: The repro is vague (studio mode, projector, minimise, restore) and the window ends up stuck and unresponsive. There is no crash or hang dump; the reporter says uploading the log hung. It happens in Safe Mode too, but no code path can be identified without a stack.

Evidence:
- None conclusive. The projector code is in `frontend/widgets/OBSProjector.cpp`.

Related: none.

---

### [#12984](https://github.com/obsproject/obs-studio/issues/12984) — Century font includes added padding at the end of the string when "Custom Text Extents" is disabled

**Verdict: IMPLEMENT** (needs manual verification with the Century font)

Reasoning: The GDI+ text source measures `text.size() + 1` characters, which includes the terminating NUL, but draws only `text.size()` characters. For most fonts the NUL maps to a zero-advance glyph, so the extra character adds nothing. For fonts whose NUL/.notdef glyph has an advance width, and Century is a likely case, the measured box gains extra width on the right that is never drawn. That matches "a gap on the right side only". The mismatch between the measured and drawn lengths is a defect in itself.

Evidence:
- `plugins/obs-text/gdiplus/obs-text.cpp:464` and `:470`: `MeasureString(text.c_str(), (int)text.size() + 1, ...)`.
- `plugins/obs-text/gdiplus/obs-text.cpp:613` and `:619`: `AddString` / `DrawString` use `(int)text.size()`.

Slice plan: change both `MeasureString` calls to `(int)text.size()`. `RemoveNewlinePadding` already compensates for trailing newline measurement. About 2 lines. On Windows, test with Century, Arial and Segoe UI, with and without outline and vertical text, and check that ordinary fonts do not shift visibly.

Related: none.

---

### [#12987](https://github.com/obsproject/obs-studio/issues/12987) — Browser window stops rendering content

**Verdict: CANNOT_VERIFY**

Reasoning: The frozen "browser" is the user's own web browser (Brave or LibreWolf), not an OBS browser source. It freezes while OBS runs minimised to tray with an NVENC HEVC replay buffer, and recovers when the OBS window is restored. It happens about weekly, with no log evidence. This points to a GPU/driver scheduling interaction between OBS (hidden window, NVENC) and the other application. There is nothing in OBS code to identify.

Evidence:
- None conclusive. The tray and minimise handling is in `frontend/widgets/OBSBasic_SysTray.cpp`.

Related: 12796.

---

### [#13086](https://github.com/obsproject/obs-studio/issues/13086) — OBS resizes sources after update

**Verdict: OUT_OF_SCOPE** (working as designed)

Reasoning: Since the move to relative scene-item coordinates, item position and scale are stored relative to the canvas, and `item_canvas_scale` rescales items by `canvas_height / scale_ref.y`. Changing the base (canvas) resolution therefore keeps the layout proportionally the same, which is the intended upstream design. The "AbsoluteCoordinates" private setting exists for the legacy behaviour. Manual numeric scaling is already available in the Edit Transform dialog. Reverting this is a product decision upstream has already made, so it is not a defect to fix.

Evidence:
- `libobs/obs-scene.c:409-421`: `item_canvas_scale` (relative scaling).
- `libobs/obs-scene.c:638-644`: absolute versus relative branch.
- `libobs/obs-scene.c:177` and `:1290`: the `AbsoluteCoordinates` private-data switch.

Related: 12704.

---

### [#13093](https://github.com/obsproject/obs-studio/pull/13093) — text-freetype2: Track text length explicitly to permit embedded null bytes

**Verdict: IMPLEMENT** (partial-pr: take the PR and fix a buffer overflow it makes reachable)

Reasoning: The bug is real. "Read from file" truncates at the first embedded NUL because `load_text_from_file` and `read_from_end` convert with `strlen(tmp_read)`. The PR follows the explicit-length approach discussed upstream in #11045: a `text_len` field, `os_utf8_to_wcs_ptr(tmp_read, filesize, ...)`, and `wcslen` replaced throughout. It merges cleanly (3 files, 42+/35-).

The defect is in the UTF-16 (BOM) path of `read_from_end`. The buffer is `bzalloc(filesize - cur_pos)` bytes and the PR sets `text_len = (filesize - cur_pos)/sizeof(wchar_t)`. The new `remove_cr` then writes `source[text_len] = L'\0'`, one element past the end whenever there is no CR. Master already relies on a terminator that is not there on this path; the PR makes the out-of-bounds write certain. Embedded NULs will render as the font's glyph for U+0000, usually empty or .notdef, which is acceptable.

Evidence:
- `plugins/text-freetype2/text-functionality.c:406-418`: UTF-8 path uses `strlen` (the bug).
- `plugins/text-freetype2/text-functionality.c:474-489`: UTF-16 tail buffer `bzalloc(filesize - cur_pos)` with no room for a terminator.
- `plugins/text-freetype2/text-functionality.c:359-368`: `remove_cr` writes a terminator.

Slice plan: cherry-pick `dd0e64a59` (author preserved). Then change the UTF-16 allocations in `read_from_end` and `load_text_from_file` to `bzalloc(size + sizeof(wchar_t))` so the terminator always fits. About 80 lines total. On Windows, wchar_t is 2 bytes, so the UTF-16 path can be tested there; on Linux and macOS (4-byte wchar_t) that path is already broken upstream and stays UNTESTED.

Related: none (#7595 and #11045 are upstream items not in this batch).

---

### [#13102](https://github.com/obsproject/obs-studio/pull/13102) — libobs: Save and restore resolution of canvases

**Verdict: DEFER_LARGE**

Reasoning: The diff is small (11 lines), but it changes behaviour: `obs_load_canvas` would now always pass an `ovi`, so `obs_canvas_create_internal` creates and registers a video mix (GPU render cost) for every saved canvas, even when the plugin that owns it is not loaded. Older saves without `base_width` and `base_height` would create a mix with 0x0 dimensions. The PR has 11 comments, and maintainer derrod opened #13126 "borne out of discussion" here to add explicit enable/disable instead. This needs the upstream design to settle first.

Evidence:
- `libobs/obs-canvas.c:162-174`: a non-NULL `ovi` creates a mix and pushes it to `obs->video.mixes`.
- `libobs/obs-canvas.c:252-260`: the current load passes `NULL` (no mix).

Related: 13126, 12824.

---

### [#13126](https://github.com/obsproject/obs-studio/pull/13126) — libobs: Allow disabling canvases, and skip ticking on unused sources

**Verdict: DEFER_LARGE**

Reasoning: This is a maintainer's design PR that adds a new public libobs API (`obs_canvas_enable`, `obs_canvas_disable`, `obs_canvas_is_enabled`). It also changes `tick_sources()` so public sources not in any mix are not ticked. That is a global behaviour change: sources shown only in source projectors, docks or Properties previews are rendered through displays rather than mixes and could stop updating. It conflicts with master's `obs_canvas_video_active` (added by `822851a2e`), and nothing in the frontend uses the new API yet. It is an architectural change that needs upstream sign-off, not a small slice.

Evidence:
- The legacy merge-tree shows conflicts in `libobs/obs-canvas.c` (around `obs_canvas_video_active`).
- `git log master -- libobs/obs-canvas.c`: `822851a2e` touched the same region.
- `git diff master...refs/upstream-pr/13126 --stat`: 4 files, new exported API in `libobs/obs.h`.

Related: 13102.
