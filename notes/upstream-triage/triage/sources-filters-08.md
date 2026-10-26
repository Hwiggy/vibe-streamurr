# Upstream triage: sources-filters-08

- Batch: sources-filters-08 (area hint: sources-filters)
- Items: 13659, 13668, 13681, 13722, 13761, 13809, 13866, 13877, 13929, 13947, 13952, 14041, 14049, 14067, 14078, 14088
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: issue/PR bodies came from `notes/upstream-triage/data/all.json`, PR heads from `refs/upstream-pr/<N>`, and the claims were checked against code on master. Local git is 2.33, which has no `merge-tree --write-tree`, so applicability was checked with `git diff master...refs/upstream-pr/N | git apply --check` (read-only). One WebFetch was used, on #14067.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 13659 | issue | CANNOT_VERIFY |
| 13668 | PR | DEFER_LARGE |
| 13681 | issue | CANNOT_VERIFY |
| 13722 | issue | OUT_OF_SCOPE (works as designed) |
| 13761 | PR | IMPLEMENT (cherry-pick) |
| 13809 | issue | IMPLEMENT (new change, Linux, UNTESTED) |
| 13866 | issue | CANNOT_VERIFY |
| 13877 | PR | IMPLEMENT (cherry-pick) |
| 13929 | issue | IMPLEMENT (new change in libdshowcapture submodule) |
| 13947 | issue | IMPLEMENT (through PR #13952) |
| 13952 | PR | IMPLEMENT (cherry-pick) |
| 14041 | PR | IMPLEMENT (cherry-pick, low priority) |
| 14049 | PR | IMPLEMENT (cherry-pick) |
| 14067 | issue | CANNOT_VERIFY |
| 14078 | PR | IMPLEMENT (cherry-pick) |
| 14088 | issue | CANNOT_VERIFY |

---

### [#13659](https://github.com/obsproject/obs-studio/issues/13659) — Text (FreeType 2) renders blank with some TTF fonts although font preview works
**Verdict: CANNOT_VERIFY**

The report says one font family (JasonHandwriting 1-9) renders as an empty box in Text (FreeType 2), while other CJK fonts work. The plugin opens the face with `FT_New_Face`, selects the Unicode charmap and looks up each glyph with `FT_Get_Char_Index`. If the font has no Unicode cmap, or uses an unusual face index or glyph format, the lookup returns 0 and nothing is drawn. Which of these applies cannot be found without the font files, and the log shows no error. Nothing generic in the code is clearly wrong.
- `plugins/text-freetype2/text-freetype2.c:331`: `FT_New_Face(path, index)`
- `plugins/text-freetype2/text-freetype2.c:462-463`: `FT_Set_Pixel_Sizes` and `FT_Select_Charmap(FT_ENCODING_UNICODE)`, with no check on the return value
- `plugins/text-freetype2/text-functionality.c:117,166,290`: glyph lookups with `FT_Get_Char_Index`

Related: none.

### [#13668](https://github.com/obsproject/obs-studio/pull/13668) — frontend: Add thumbnail size options to source select
**Verdict: DEFER_LARGE**

This is a UI feature: a new SegmentButton widget plus a thumbnail-size and list-view toggle in the Add Source dialog. It has 5 commits, touches 21 files (+787/-140) and adds SVG assets and `.ui` changes. It no longer applies: `git apply --check` fails on `OBSBasicSourceSelect.ui`, `OBSBasicTransform.ui` and `PluginManagerWindow.ui`. It is a UX redesign that maintainers still need to decide on, so it is not a small slice.
- `git diff master...refs/upstream-pr/13668 --stat`: 21 files, 787 insertions
- Conflicts in `frontend/forms/OBSBasicSourceSelect.ui:230`, `frontend/forms/OBSBasicTransform.ui:888` and `frontend/forms/PluginManagerWindow.ui:60`

Related: #13952 and #13947 (same dialog).

### [#13681](https://github.com/obsproject/obs-studio/issues/13681) — A closed custom browser dock reappears the next time OBS is launched
**Verdict: CANNOT_VERIFY**

Reported on macOS 26. Custom browser docks are re-created at startup with `firstCreate=false`, and the window's `restoreState()` restores their visibility because each dock's objectName is its title plus a suffix. `SaveExtraBrowserDocks` and `saveState` both run in the save-once block. I could not find a path where a closed dock is saved as visible. `BrowserDock::closeEvent` only closes the CEF browser. The fault may be macOS- or Qt-specific, for example how a closed floating dock is recorded in the saved state, and that needs a repro on macOS.
- `frontend/widgets/OBSBasic_Browser.cpp:105-160`: `AddExtraBrowserDock`; only the first creation calls `setVisible(true)`
- `frontend/widgets/OBSBasic.cpp:1107` (load docks), then `restoreState` around line 1120
- `frontend/widgets/OBSBasic.cpp:1748-1757`: DockState and SaveExtraBrowserDocks are saved together
- `frontend/docks/BrowserDock.cpp:6-22`: closeEvent

Related: none.

### [#13722](https://github.com/obsproject/obs-studio/issues/13722) — Source inside masked group cannot be resized without affecting mask
**Verdict: OUT_OF_SCOPE (works as designed)**

A group's bounds are recalculated from its children (`resize_group`), so resizing or moving a child changes the group's base size. The Image Mask/Blend filter stretches the mask to the target's base width and height. A mask that follows the group's changing size is therefore the designed behavior. The usual workaround is a nested scene, which has a fixed canvas size. Changing how groups size themselves would be a core design change, not a bug fix.
- `libobs/obs-scene.c:3484`: `resize_group` recalculates group bounds from the items
- `plugins/obs-filters/mask-filter.c:285-297`: mask scale computed from `obs_source_get_base_width/height(target)`

Related: none.

### [#13761](https://github.com/obsproject/obs-studio/pull/13761) — libobs: Fix color space query through non-video filters
**Verdict: IMPLEMENT (cherry-pick-pr)**

The defect is real. Audio filters sit in the same `filters` chain and `filter_target` links as video filters. `obs_source_get_color_space()` only skips non-video sources that are not filters. When an enabled audio-only filter is the target, the function reaches the `video_get_color_space ? ... : GS_CS_SRGB` fallback and returns SRGB. A video filter above it, such as HDR tonemap, then thinks its input is SDR and does nothing. The PR adds 6 lines that pass the query on to `filter_target` for filters without `OBS_SOURCE_VIDEO`. It applies cleanly.
- `libobs/obs-source.c:3039-3071`: the function; the early skip at 3045 only covers non-filters, and the SRGB fallback is at 3068-3070
- `plugins/obs-filters/hdr-tonemap-filter.c:152,203`: queries `obs_filter_get_target`
- `libobs/obs-source.c:3142,3178,3256`: audio and video filters share the `filter_target` chain

Slice: cherry-pick 79eb759a6 (1 file, +6). Test: build libobs with MSVC. Runtime check: add an audio filter (for example Gain) and then HDR Tone Mapping to an HDR source, and confirm tonemapping applies. That needs an HDR source on this machine; if none is available, mark the runtime check UNTESTED.

Related: none.

### [#13809](https://github.com/obsproject/obs-studio/issues/13809) — Crash (NULL deref) in screencast-portal.c start() when a delayed portal SelectSources response arrives after the session is gone
**Verdict: IMPLEMENT (new-change, Linux)**

Confirmed in code. `start()` passes `capture->session_handle` to `g_variant_new("(osa{sv})", ...)` without checking it, and a NULL `o` crashes GLib. A stale response can still arrive because `reload_session_cb` clears `session_handle` and calls `init_screencast_capture()`, which replaces `capture->cancellable` without cancelling the old one. The old cancellable is leaked, and the old `portal_signal_subscribe` subscriptions are only removed when their cancellable fires (portal.c `on_cancelled_cb`), so they stay active. A late SelectSources response then calls `start()` with no session handle, or with a handle from a newer session.
- `plugins/linux-pipewire/screencast-portal.c:287-307`: `start()` has no NULL check (303)
- `plugins/linux-pipewire/screencast-portal.c:312-327`: the select-source response handler calls `start()`
- `plugins/linux-pipewire/screencast-portal.c:476-495`: `reload_session_cb` clears session_handle but does not cancel or clear the cancellable
- `plugins/linux-pipewire/screencast-portal.c:458`: `init_screencast_capture` overwrites `capture->cancellable`
- `plugins/linux-pipewire/portal.c:141-153,174-189`: subscriptions are torn down only when cancelled or answered

Slice (about 15 lines, in `screencast-portal.c`):
1. In `reload_session_cb`, before `init_screencast_capture()`, add `g_cancellable_cancel(capture->cancellable); g_clear_object(&capture->cancellable);`.
2. In `start()` and `select_source()`, return early with a LOG_WARNING if `capture->session_handle` is NULL.

Test plan: Linux only, so it is UNTESTED on this Windows box. The MSVC build does not compile linux-pipewire.

Related: none.

### [#13866](https://github.com/obsproject/obs-studio/issues/13866) — Transition button gets grayed out going through slideshow
**Verdict: CANNOT_VERIFY**

In studio mode the reporter uses arrow keys to step a slideshow, and keyboard focus moves through the transition dock widgets until the buttons are disabled. The arrow keys are not default slideshow hotkeys and behave as Qt focus navigation here. The report covers versions from 29.0.2 on, without a current-version repro, and I could not identify a code path that disables the Transition button from it. Needs a repro on a current build.
- `plugins/image-source/obs-slideshow-mk2.c`: next/prev are hotkeys or media controls only and have no frontend focus interaction

Related: none.

### [#13877](https://github.com/obsproject/obs-studio/pull/13877) — image-source: Add linear alpha option to slideshow
**Verdict: IMPLEMENT (cherry-pick-pr)**

The PR adds a small opt-in option. Each slide is rendered by a private `image_source`, which already supports `linear_alpha` (default false). The PR exposes the same setting on both slideshow sources and passes it to the child sources. It reuses the existing `LinearAlpha` locale string from the same module, so no new strings are added. In mk2, `ss->data = new_data` is assigned before slides are loaded lazily, so the new value takes effect. The legacy slideshow handles the cache with `reuse_old`. The default is false, so saved scene collections are unaffected. It applies cleanly.
- `plugins/image-source/image-source.c:56,105,129,316`: existing `linear_alpha` handling and property
- `plugins/image-source/data/locale/en-US.ini:4`: `LinearAlpha`
- `plugins/image-source/obs-slideshow-mk2.c:411-412,297-305,368`: new_data, then lazy `create_source_from_file`

Slice: cherry-pick 1d3c44a17 (2 files, +27/-9). Test: build the image-source plugin with MSVC and run a slideshow of semi-transparent PNGs with the option on and off.

Related: #14078 (same plugin).

### [#13929](https://github.com/obsproject/obs-studio/issues/13929) — Video Capture Device: XRGB picks RGB24 over native RGB32 when the device lists RGB24 first
**Verdict: IMPLEMENT (new-change, in the libdshowcapture submodule)**

Confirmed in code. `GetMediaTypeVFormat` maps both RGB24 and RGB32 to `VideoFormat::XRGB`. `ClosestVideoMTCallback` gives both the same score and keeps the first one it sees (`bestVal > totalVal`). The device then uses RGB24, while `SetupVideoCapture` expects `MEDIASUBTYPE_RGB32` for XRGB, so ConnectPins fails. The reporter's proposed fix adds a +1 penalty to RGB24 when the format is XRGB, so RGB32 wins a tie and RGB24-only devices behave as before. It is minimal and correct.
- `deps/libdshowcapture/src/source/dshow-formats.cpp:285-288`: both subtypes map to XRGB
- `deps/libdshowcapture/src/source/dshow-enum.cpp:234-238`: tie-break keeps the first match
- `deps/libdshowcapture/src/source/device.cpp:351`: XRGB expects RGB32

Slice: change about 7 lines in `deps/libdshowcapture/src/source/dshow-enum.cpp` (submodule at 8878638). The caveat is that this commit lives in the submodule repo, obsproject/libdshowcapture. The fork must either commit inside the submodule and bump the gitlink, which needs a fork of the submodule to be reachable, or carry the change as a patch. Decide on that before implementing. Test: MSVC build of win-dshow. Runtime is UNTESTED because it needs a device that lists RGB24 before RGB32 (Datapath VisionHD4).

Related: none.

### [#13947](https://github.com/obsproject/obs-studio/issues/13947) — source dialog is not alphabetical sorted
**Verdict: IMPLEMENT (through PR #13952)**

This is a confirmed regression. The old existing-source list was a QListWidget with sorting enabled. The new dialog builds `matchingSources` with `std::copy_if` in enumeration order and never sorts it. PR #13952 is the fix.
- `frontend/dialogs/OBSBasicSourceSelect.cpp:402-433`: no sort after filtering

Slice: same as #13952.

Related: #13952 (fix) and #13668.

### [#13952](https://github.com/obsproject/obs-studio/pull/13952) — frontend: Sort add source list alphabetically
**Verdict: IMPLEMENT (cherry-pick-pr)**

The PR adds a case-insensitive `std::sort` by source name after filtering. It skips the Recent tab, which keeps creation order and is reversed at line 467. It is 18 lines in one file, written by a maintainer (Warchamp7), and applies cleanly. `<algorithm>` functions are already used in this file through `std::copy_if`. The comparator returns false when a weak ref has expired, but the filter has already dropped dead sources.
- `frontend/dialogs/OBSBasicSourceSelect.cpp:402-433` (insertion point), `:36` (`kRecentTypeId`), `:467` (reverse order for Recent)

Slice: cherry-pick 023a5863f. Test: MSVC frontend build; open Add Source, pick a category with mixed-case names and confirm the order.

Related: fixes #13947.

### [#14041](https://github.com/obsproject/obs-studio/pull/14041) — libobs-opengl: emit float(lod) for textureLod lod argument
**Verdict: IMPLEMENT (cherry-pick-pr, low priority)**

The generated `obs_load_2d/3d` helpers pass an `int lod` to `textureLod`, whose lod parameter is a float. Desktop GLSL 330 accepts this through implicit conversion, so behavior on supported platforms does not change. Writing `float(lod)` explicitly is more correct GLSL and more portable. The change is 2 lines and applies cleanly. OBS does not target GLES, so this is only a cleanup.
- `libobs-opengl/gl-shaderparser.c:730`: `#version 330`
- `libobs-opengl/gl-shaderparser.c:737,745`: `textureLod(s, p, lod)` with `int lod`

Slice: cherry-pick c4267ee91. Test: MSVC build of libobs-opengl. Runtime test with OBS on the OpenGL renderer, if it can be launched; otherwise UNTESTED.

Related: none.

### [#14049](https://github.com/obsproject/obs-studio/pull/14049) — frontend: Fix screen reader narration for filters
**Verdict: IMPLEMENT (cherry-pick-pr)**

The filter list items have empty text because a VisibilityItemWidget draws them, so screen readers read them as blank (upstream #11400). The PR sets `Qt::AccessibleTextRole` and `AccessibleDescriptionRole` on the item and gives the checkbox an accessible name and description. All the locale keys it uses already exist. It is +21/-3 in 2 files and applies cleanly. Minor gap: the accessible text is not updated when a filter is renamed. That is acceptable, and a follow-up could handle it.
- `frontend/components/VisibilityItemWidget.cpp:73-78`: `SetupVisibilityItem`; callers at `frontend/dialogs/OBSBasicFilters.cpp:299,356,1030`
- `frontend/data/locale/en-US.ini:15,55,665,666`: Disable, Enable, Basic.Main.Sources.Visibility and VisibilityDescription

Slice: cherry-pick 7ca4122f4. Test: MSVC frontend build; check the filters list with Windows Narrator.

Related: upstream #11400 (not in this batch).

### [#14067](https://github.com/obsproject/obs-studio/issues/14067) — Duplicate source not working
**Verdict: CANNOT_VERIFY**

The repro is only in a GIF. Upstream has labeled it confirmed. Per the thread (fetched once), the maintainer says it affects items in a scene nested inside a group, while plain group contents and multiple nested scenes behave. The duplicate and paste path is `setupExistingSource` and `sourcePaste`, but nothing in the report shows which transform step goes wrong for a scene nested in a group. I could not identify a root cause from code alone.
- `frontend/dialogs/OBSBasicSourceSelect.cpp:150-170,315-324`: duplicate and paste path

Related: none.

### [#14078](https://github.com/obsproject/obs-studio/pull/14078) — libobs: Restore image memory usage tracking
**Verdict: IMPLEMENT (cherry-pick-pr)**

Confirmed regression from c3046ec17 ("Break image file API"). `gs_image_file_ex_init` passes `NULL` for `mem_usage`, so `image->mem_usage` stays 0. The image source reports 0 bytes, and the legacy slideshow's 400 MB `MAX_MEM_USAGE` limit never triggers. Passing `&image->mem_usage` is safe because `gs_image_file_ex_init_internal` runs `memset` on the struct before it adds to the counter. This is a one-line change that applies cleanly.
- `libobs/graphics/image-file.c:242-246`: passes NULL
- `libobs/graphics/image-file.c:213,231-233`: memset, then accumulation
- `plugins/image-source/image-source.c:324`: returns `s->image.mem_usage`
- `plugins/image-source/obs-slideshow.c:231,374,386`: memory limit enforcement

Slice: cherry-pick 7ece95884. Test: MSVC build of libobs and image-source; load a large image and check with a debugger or log that `image_source_get_memory_usage` is not 0.

Related: #13877 (same plugin area).

### [#14088](https://github.com/obsproject/obs-studio/issues/14088) — OBS Studio 33.0.0 crashes on startup with existing scene collection — libcef.dll
**Verdict: CANNOT_VERIFY**

A crash in libcef.dll with exception 0x80000003, which is a breakpoint/CHECK inside CEF, on a pre-release Windows build (26300). The crash still happens with all browser sources removed, so the trigger is unclear. CEF and obs-browser come in as a submodule and a dependency. There is no actionable stack, and the issue depends on the reporter's scene collection.
- `plugins/obs-browser` (submodule); CEF comes from the CI deps bump (72e866557)

Related: none.
