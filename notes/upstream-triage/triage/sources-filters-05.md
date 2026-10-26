# Upstream triage — batch sources-filters-05

- Batch: sources-filters-05 (area hint: sources-filters)
- Items: 11757, 11762, 11786, 11803, 11844, 11845, 11850, 11857, 11862, 11914, 11919, 12010, 12039, 12053, 12100, 12263, 12266, 12286, 12308, 12383, 12511, 12514
- Date: 2026-10-26
- Base commit: 72e866557 (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; PR heads from `refs/upstream-pr/<N>`; current code read on master. No GitHub API or WebFetch calls were made for this batch.
- Tooling note: the local git is 2.33, which does not support `git merge-tree --write-tree`. To check whether PRs apply, I used the legacy form `git merge-tree $(git merge-base master PR) master PR` and counted the `+<<<<<<<` conflict markers.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 11757 | issue | OUT_OF_SCOPE (by design) |
| 11762 | issue | CANNOT_VERIFY |
| 11786 | issue | IMPLEMENT (menu enable state only) |
| 11803 | PR | IMPLEMENT (cherry-pick) |
| 11844 | issue | IMPLEMENT |
| 11845 | issue | CANNOT_VERIFY |
| 11850 | PR | ALREADY_ADDRESSED (Color Correction "Color Multiply") |
| 11857 | issue | CANNOT_VERIFY |
| 11862 | PR | DEFER_LARGE |
| 11914 | issue | CANNOT_VERIFY |
| 11919 | PR | IMPLEMENT (cherry-pick) |
| 12010 | issue | CANNOT_VERIFY |
| 12039 | PR | DEFER_LARGE |
| 12053 | issue | IMPLEMENT |
| 12100 | issue | OUT_OF_SCOPE |
| 12263 | issue | CANNOT_VERIFY |
| 12266 | issue | DEFER_LARGE |
| 12286 | issue | CANNOT_VERIFY |
| 12308 | PR | ALREADY_ADDRESSED |
| 12383 | PR | DEFER_LARGE |
| 12511 | issue | CANNOT_VERIFY |
| 12514 | issue | CANNOT_VERIFY |

---

### [#11757](https://github.com/obsproject/obs-studio/issues/11757) — Studio mode: media source is not rendering at beginning
**Verdict: OUT_OF_SCOPE (works as designed)**

In Studio Mode, a video dropped into the preview shows nothing, while a dropped image does show. This is the expected result of the media source's default "Restart playback when source becomes active" setting. A source that only appears in the Studio Mode preview is shown but not active, so playback never starts. A static image needs no playback, so it appears. Showing the first frame of an inactive media source in the preview would be a UX design change, not a bug fix.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:122`: `restart_on_activate` defaults to true.
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:497-498`: `ffmpeg_source_update` only calls `ffmpeg_source_start` when `!restart_on_activate || active`.
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:654-660`: playback is (re)started from `activate`, which only fires on program output.
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:246-254`: the preloaded frame is only pushed when looping or clear-on-end is set, and only shown on start (`:326-328`).

Workaround: untick "Restart playback when source becomes active".

Related: none.

### [#11762](https://github.com/obsproject/obs-studio/issues/11762) — Intermittent Transition Lockup Causes Unresponsive Transition Controls
**Verdict: CANNOT_VERIFY**

The report is a long, generic description: roughly every 10 minutes the transition gets stuck, and Companion/Stream Deck is involved. It has no reproducible steps tied to code. The transition state machine in the frontend (`TransitionToScene` / `TransitionFullyStopped` / override swapping) is race-sensitive, but the report contains nothing that points to a specific defect. It possibly shares a root cause with #11914 (override swapping).

Evidence:
- `frontend/widgets/OBSBasic_Transitions.cpp:338-344`: in studio mode, new transitions are blocked while `0 < t < 1`. A transition that never reaches t=1 would lock the controls, but nothing shows why that would happen here.
- `frontend/widgets/OBSBasic_Transitions.cpp:274-293`: override swap and restore.

Related: #11914.

### [#11786](https://github.com/obsproject/obs-studio/issues/11786) — Reset Base Resolution option sometimes not available in 31.0.1
**Verdict: IMPLEMENT (narrow slice: menu enable state)**

The reporter's wider complaint is about two profiles with different aspect ratios sharing one scene collection after the OBS 31 relative-coordinate migration. That is by design. The issue title, however, describes a real inconsistency in the code, and it is the part I can fix. Whether "Scene Collection > Reset Base Resolution" is enabled depends on which code path ran last:
- `ResetVideo()` enables it when the collection is in absolute mode, or when its saved migration resolution is non-zero and differs from the current base resolution.
- Loading a scene collection calls `updateRemigrationMenuItem()`, which enables it **only** in absolute mode.

So after startup or a scene collection switch, a relative-mode collection with a different migration resolution has the item disabled. It only becomes enabled after a profile switch or a video reset. That matches "sometimes not available".

Evidence:
- `frontend/widgets/OBSBasic.cpp:1502-1516`: `canMigrate = usingAbsoluteCoordinates || (!migrationResolution.isZero() && migrationResolution != videoResolution)`.
- `frontend/widgets/OBSBasic_SceneCollections.cpp:95-109`: `updateRemigrationMenuItem` calls `menuItem->setEnabled(isAbsoluteCoordinateMode)`.
- `frontend/widgets/OBSBasic_SceneCollections.cpp:1345`: called after load, with `ResetVideo()` only called when a migration-time reset occurred (`:1349-1351`).
- `frontend/widgets/OBSBasic_SceneCollections.cpp:695-725`: the action handler already rejects zero or matching resolutions with message boxes, so enabling the item more often is safe.

Slice plan:
- Change `updateRemigrationMenuItem` to take the migration resolution (or the `SceneCollection`). Compute `enabled` with the same rule as `OBSBasic.cpp:1511-1512`, using `obs_get_video_info` for the base resolution.
- Update the two call sites (`:1040` in `CreateDefaultScene`, which passes Relative with a zero resolution and so stays disabled, and `:1345`). Keep setting the label and the private-data flag as now.
- About 15–20 lines in `frontend/widgets/OBSBasic_SceneCollections.cpp` (plus its header if one declares the function).
- Test plan: MSVC build of the `obs-studio` frontend. Manually load a relative-mode collection whose `migration_resolution` differs from the current canvas, and check that the menu item is enabled on startup. Without a manual GUI run it is UNTESTED.

Related: none.

### [#11803](https://github.com/obsproject/obs-studio/pull/11803) — libobs/media-io: Avoid allocating frame memory if size is zero
**Verdict: IMPLEMENT (cherry-pick-pr)**

`bmalloc(0)` deliberately calls `bcrash` since OBS 31. `video_frame_init` can compute `size == 0` when the width or height is 0, or when the format is unknown (all linesizes and heights stay 0). It then crashes. The PR, by a maintainer, adds a 4-line early return. It is not in master and applies cleanly (0 conflicts). After the early return the frame stays zeroed, because of the `memset` at the top.

Evidence:
- `libobs/util/bmem.c:101-105`: `bmalloc` crashes on size 0.
- `libobs/media-io/video-frame.c:205-222`: size is accumulated, skipping planes with zero linesize or height, then `bmalloc(size)` is called with no guard.
- `git diff master...refs/upstream-pr/11803`: +4 lines.

Slice plan: `git cherry-pick 430c4e327` (author preserved). 1 file, +4.

Test plan: MSVC build of libobs. A cmocka unit test calling `video_frame_init(&f, VIDEO_FORMAT_NONE, 0, 0)` could check that it does not crash, if the cmocka harness covers media-io. Otherwise build-only.

Related: upstream #11729 (crash report).

### [#11844](https://github.com/obsproject/obs-studio/issues/11844) — Changing language changes the currently selected transition
**Verdict: IMPLEMENT**

Confirmed in code. The built-in non-configurable transitions (Cut, Fade, and others) are recreated at every load, and each is **named with its localized display name**. The scene collection saves the current transition **by name** only. After a language change, the saved name (for example "Cut") no longer matches the localized name, so `FindTransition` fails and loading falls back to Fade.

Evidence:
- `frontend/widgets/OBSBasic_Transitions.cpp:60-66`: default transitions are created with `obs_source_get_display_name(id)` as their name.
- `frontend/widgets/OBSBasic_SceneCollections.cpp:909`: `current_transition` is saved as `obs_source_get_name(transition)`.
- `frontend/widgets/OBSBasic_SceneCollections.cpp:1360-1366`: if `FindTransition(transitionName)` fails, `fadeTransition` is used.
- `frontend/widgets/OBSBasic_Transitions.cpp:228-243`: name-only lookup.

Slice plan:
- In `SaveData` (around `:909`), also save `current_transition_id` = `obs_source_get_unversioned_id(transition)`.
- In `LoadData` (around `:1360`), if the lookup by name fails and `current_transition_id` is set, search `transitions` for a source with that unversioned id for which `obs_is_source_configurable(id)` is false. Default transitions are unique per id, so the match is unambiguous. Fall back to Fade only after that.
- About 20 lines in `frontend/widgets/OBSBasic_SceneCollections.cpp`. Existing collections without the new key behave as before.
- Out of slice: per-scene override transitions and quick transitions are also stored by name, so they have the same localization fragility. Note this in the commit.
- Test plan: MSVC build of the frontend. Manual test: select Cut, switch the UI language, restart, and check that Cut is still selected. Without a manual GUI run it is UNTESTED.

Related: none.

### [#11845](https://github.com/obsproject/obs-studio/issues/11845) — PiP Window Capture Disappears When Dragged to Screen Edge in Chromium Browsers
**Verdict: CANNOT_VERIFY**

The problem only affects Chromium's PiP window, not Firefox. The reporter says it comes and goes after a clean OS install without any changes. That points to Chromium's own window-occlusion or composition behaviour, or to the Windows/driver state, rather than to win-capture code. I found no code path in Window Capture that depends on the window position relative to the screen edge, and the report has no repro that can be reproduced reliably.

Evidence:
- `plugins/win-capture/window-capture.c`: BitBlt and WGC capture the window as a whole. Neither applies a screen-edge clip.

Related: none.

### [#11850](https://github.com/obsproject/obs-studio/pull/11850) — obs-filters: Add white balance filter
**Verdict: ALREADY_ADDRESSED (functionally covered by the Color Correction filter)**

The PR adds a new filter with R/G/B sliders that build a diagonal colour matrix, meaning per-channel gain (`white-balance-filter.c` lines 34-52 in the PR). The existing Color Correction filter already has "Color Multiply", which writes per-channel gains into exactly those diagonal matrix entries. A second filter that duplicates this adds maintenance cost and clutters the filter list. The only difference is the gain range (the PR allows up to 2.0, while Color Multiply is capped at 1.0 per channel). That is not enough to justify a new filter. The PR applies cleanly (178 lines), but I recommend not adding it.

Evidence:
- `plugins/obs-filters/color-correction-filter.c:31,361-378`: `color_multiply` writes `color_matrix.x.x/y.y/z.z`, which is per-channel R/G/B gain.
- `git show refs/upstream-pr/11850:plugins/obs-filters/white-balance-filter.c`: a diagonal matrix built from three sliders.

Related: none.

### [#11857](https://github.com/obsproject/obs-studio/issues/11857) — Cannot seek through playback with MediaSource in scene
**Verdict: CANNOT_VERIFY**

The reporter suggests that `seek_to()` flushes the decoder (`frame_ready=false`) and that `mp_media_eof()` then treats the media as finished. In the current loop, though, a seek `continue`s, and the next iteration calls `mp_media_prepare_frames()`. That decodes until `frame_ready` is true or the demuxer really hits EOF, and only then is `mp_media_eof()` checked. So the proposed causal chain does not hold on master as written. The real cause probably depends on the file: for example, audio-only files where `streams[0]` (used for the seek time base) is not the audio stream, or attached cover art. I could not confirm a defect without a sample file.

Evidence:
- `shared/media-playback/media-playback/media.c:520-549`: `seek_to` uses `m->fmt->streams[0]` for the time base and flushes the decoders.
- `shared/media-playback/media-playback/media.c:806-827`: after a seek the loop `continue`s, and `prepare_frames` runs before `mp_media_eof`.
- `shared/media-playback/media-playback/media.c:264-292`: `prepare_frames` loops until it is ready or at EOF.
- `shared/media-playback/media-playback/decode.c:413-421`: flush resets `d->eof` and `frame_ready`.

Related: none.

### [#11862](https://github.com/obsproject/obs-studio/pull/11862) — frontend: Add OBSSourceView widget
**Verdict: DEFER_LARGE**

This is a frontend refactor: a new widget, and the Filters and Properties windows ported to it. It is 3 commits, 11 files, +510/−296, and has 5 conflict regions against master. It fixes no bug, and it is part of the maintainer's UI overhaul series, so a small self-contained slice does not exist.

Evidence: `git diff master...refs/upstream-pr/11862 --stat` (11 files, 510+/296−); legacy merge-tree shows 5 conflicts.

Related: #12039, #12383 (same UI series).

### [#11914](https://github.com/obsproject/obs-studio/issues/11914) — Transition Override Prevents Transition (locks Program Scene)
**Verdict: CANNOT_VERIFY**

The scenario is plausible from the code. Outside Studio Mode, rapid switching between a scene with a timed default transition and one with a Cut override causes `OverrideTransition()` to swap the output transition while the Fade is still active. `TransitionFullyStopped()` later swaps it back. `obs_transition_start` has special handling for transitions that are already active. I could not pin down which interleaving leaves the output stuck, and I would need to reproduce it under a debugger before changing the swap logic. Studio Mode toggling clears the stuck state because it resets the output transition. That fits a stale swap, but it is not proof.

Evidence:
- `frontend/widgets/OBSBasic_Transitions.cpp:372-380`: override swap when `!overridingTransition`.
- `frontend/widgets/OBSBasic_Transitions.cpp:274-293`: `OverrideTransition` / `TransitionFullyStopped`.
- `libobs/obs-source-transition.c:338-370`: start logic for an active transition.

Related: #11762.

### [#11919](https://github.com/obsproject/obs-studio/pull/11919) — frontend: Fix scaling scene items without a size
**Verdict: IMPLEMENT (cherry-pick-pr)**

In `OBSBasicPreview::StretchItem`, when there is no bounding box, the code subtracts the crop from the source size and then divides the target size by `baseSize`. Master already returns early when the source has width or height 0 (`:1617-1622`). But when the crop is greater than or equal to the source size, `baseSize` becomes ≤ 0, and the division produces an infinite or negative scale. That is the "infinitely large source" in upstream #11917. The PR guards the clamp-and-scale block with `baseSize.x > 0 && baseSize.y > 0`. It is 1 file, +7/−5, and applies cleanly.

Evidence:
- `frontend/widgets/OBSBasicPreview.cpp:1645-1658`: crop subtraction, then `vec2_div(&size, &size, &baseSize)` with no positivity check.
- `frontend/widgets/OBSBasicPreview.cpp:1617-1622`: the existing zero-source-size guard does not cover zero size after crop.

Slice plan: `git cherry-pick f8dc3c0f1` (author: exeldro).

Test plan: MSVC build of the frontend. A manual repro (crop an item fully, then drag a stretch handle) needs the GUI. Otherwise build-only, UNTESTED at runtime.

Related: upstream #11917.

### [#12010](https://github.com/obsproject/obs-studio/issues/12010) — Crashed Thread: 0 CrBrowserMain
**Verdict: CANNOT_VERIFY**

This is a macOS crash in Chromium's main thread inside CEF (obs-browser), with no repro steps. The fix would sit in CEF or in the obs-browser submodule, and this Windows box cannot reproduce or debug macOS CEF crashes. The stack is not actionable against code in this repo.

Evidence: `plugins/obs-browser` is a git submodule. The crash is in `CrBrowserMain`, which is CEF code, not OBS code.

Related: none.

### [#12039](https://github.com/obsproject/obs-studio/pull/12039) — frontend: Adjust source context bar
**Verdict: DEFER_LARGE**

A theme and UX redesign of the context toolbar, following a design mockup. It touches 24 files, +1604/−1034, and has 2 conflict regions. This is a maintainer design decision and far beyond a small slice.

Evidence: `git diff master...refs/upstream-pr/12039 --stat`.

Related: #11862, #12383.

### [#12053](https://github.com/obsproject/obs-studio/issues/12053) — Text source outline rendering issue for some fonts
**Verdict: IMPLEMENT**

Root cause in the Windows GDI+ text source: when outline is on, the text is turned into a `GraphicsPath`, which is stroked and then filled. A default `GraphicsPath` uses `FillModeAlternate` (even-odd). Fonts such as Comfortaa have overlapping contours, for example where the crossbar of `f` overlaps the stem. Under even-odd, the overlapping area counts as "outside", so it is not filled and the stroke colour, drawn first, shows through. TrueType outlines are designed for the non-zero winding rule. Constructing the path with `FillModeWinding` fixes the fill without adding a "paint order" option. The draw order (stroke, then fill) is already "fill over stroke".

Evidence:
- `plugins/obs-text/gdiplus/obs-text.cpp:609-617`: `GraphicsPath path;` (default even-odd), then `path.AddString(...)`, then `RenderOutlineText`.
- `plugins/obs-text/gdiplus/obs-text.cpp:551-565`: `DrawPath` (stroke) followed by `FillPath`.

Slice plan: change `GraphicsPath path;` to `GraphicsPath path(FillModeWinding);` in `plugins/obs-text/gdiplus/obs-text.cpp`. This is about one line, Windows-only.

Test plan: MSVC build of the `obs-text` target. Runtime check with the Comfortaa font, outline 20, letter `f`. This needs the GUI, so it is UNTESTED unless run manually. FreeType2 text (Linux and macOS) has a different outline path and is not covered by this change.

Related: none.

### [#12100](https://github.com/obsproject/obs-studio/issues/12100) — gs_clear crash when calling gs_texrender_begin + obs_source_video_render in Qt + libobs integration
**Verdict: OUT_OF_SCOPE**

This is a support question about embedding libobs in a third-party Qt application. The reporter calls graphics functions from their own worker thread, apparently without `obs_enter_graphics()` or a valid render context. That is misuse of the API in external code, not a defect in OBS Studio.

Evidence: libobs graphics calls require the graphics context to be entered (`obs_enter_graphics`), as the frontend does in `frontend/dialogs/OBSBasicSourceSelect.cpp:195-197`.

Related: none.

### [#12263](https://github.com/obsproject/obs-studio/issues/12263) — Avermedia GC573 only 2.0 instead of 5.1/7.1
**Verdict: CANNOT_VERIFY**

The Video Capture Device source already maps 1–8 channels to speaker layouts up to 7.1. The channel count comes from the audio format that the DirectShow device or driver exposes. If the AVerMedia driver only offers a stereo DirectShow audio pin, OBS cannot get more channels. This depends on the hardware and driver and cannot be tested here.

Evidence:
- `plugins/win-dshow/win-dshow.cpp:459-480`: `convert_speaker_layout` supports 5.1 and 7.1.
- `plugins/win-dshow/win-dshow.cpp:669`: the layout is taken from `config.channels` reported by the device.

Related: none.

### [#12266](https://github.com/obsproject/obs-studio/issues/12266) — Large unloaded image obstructs transition animation
**Verdict: DEFER_LARGE**

With "Unload image when not showing", the image is decoded synchronously in the `show` callback. `obs_transition_start()` stamps `transition_start_time` before the stall, so a 200 ms fade has already "elapsed" by the time the image is ready. The reporter wants the transition to wait for the load. That needs either asynchronous image loading with a "ready" signal, or changing transition timing semantics in libobs, for example starting the clock at the first rendered frame. Either is a cross-cutting design change affecting all transitions and sources.

Evidence:
- `plugins/image-source/image-source.c:132-138`: `image_source_show` calls `image_source_load` synchronously.
- `libobs/obs-source-transition.c:366-368`: the transition start time is taken at `obs_transition_start`.

Related: none.

### [#12286](https://github.com/obsproject/obs-studio/issues/12286) — Toggling image inside a group affects PGM in Studio Mode
**Verdict: CANNOT_VERIFY**

With scene duplication enabled, which is the Studio Mode default, `obs_scene_duplicate` always deep-copies group items. `dup_child` calls `obs_source_duplicate`, and for a group that goes to `obs_scene_duplicate`, which copies each sub-item's visibility. So toggling a sub-item in the preview should not reach the program copy. I could not find the defect in code. It may depend on the reporter's settings (for example, duplication off, or the same scene in preview and program), and a repro is needed.

Evidence:
- `libobs/obs-scene.c:1958-1965`: `item->is_group` leads to `dup_child`.
- `libobs/obs-scene.c:1813-1832`: `dup_child` calls `obs_source_duplicate`.
- `libobs/obs-source.c:675-689`: for a group, `obs_source_duplicate` calls `obs_scene_duplicate`.

Related: none.

### [#12308](https://github.com/obsproject/obs-studio/pull/12308) — frontend: Copy show/hide transitions when pasting source as duplicate
**Verdict: ALREADY_ADDRESSED**

Master now copies show/hide transitions, their settings and their durations into `SourceCopyInfo` at copy time. `setupExistingSource` then applies them to the new scene item for both reference and duplicate paste. The PR's `AddExisting` / `FindSceneItem` approach targets code that no longer exists, and it has 4 conflict regions.

Evidence:
- `frontend/widgets/OBSBasic_Clipboard.cpp:96-110`: transition ids, settings and durations are captured on copy.
- `frontend/dialogs/OBSBasicSourceSelect.cpp:119-138`: transitions are created and applied to the new scene item.
- `frontend/dialogs/OBSBasicSourceSelect.cpp:182-192`: copy info, transitions included, is passed through for the duplicate path.

Related: upstream #11192.

### [#12383](https://github.com/obsproject/obs-studio/pull/12383) — frontend: Improve scene item cropping UI (draft)
**Verdict: DEFER_LARGE**

A draft UX feature: an Alt-held crop overlay and moving the source within its crop. It touches 6 files, +340/−91, including a new libobs API (`obs.h`, `obs-scene.c`), and has 10 conflict regions. It is a design-level change and still a draft.

Evidence: `git diff master...refs/upstream-pr/12383 --stat`.

Related: #11862, #12039.

### [#12511](https://github.com/obsproject/obs-studio/issues/12511) — NVIDIA SDK Video Filter crashes
**Verdict: CANNOT_VERIFY**

After about 2 hours the CUDA error -1700 ("illegal memory access") appears in the NVIDIA Video Effects SDK resource mapping. It started after NVIDIA Broadcast was installed. This points to the driver, the SDK runtime, or the GPU, and depends on specific hardware that this box cannot reproduce.

Evidence: `plugins/nv-filters`: the error is logged from the SDK's CUDA resource mapping call. The failure is inside the vendor runtime.

Related: none.

### [#12514](https://github.com/obsproject/obs-studio/issues/12514) — Browser Docks fighting for focus, causing crash/hang on launch
**Verdict: CANNOT_VERIFY**

OBS flickers and hangs on startup, and it persists across reinstalls and an OS reset on one machine. The long thread (16 comments) is not available locally. There is no stack and no code path identified, so it is system-specific and needs a repro or debugger trace. Browser docks are handled by the obs-browser submodule and CEF.

Evidence: browser dock creation lives in `frontend/docks/BrowserDock.*` and the `plugins/obs-browser` submodule. Nothing in the report points to a specific defect.

Related: none.
