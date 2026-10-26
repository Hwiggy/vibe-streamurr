# Upstream triage — batch sources-filters-07

- Batch id: sources-filters-07 (area hint: sources-filters; several items are actually frontend)
- Items: 13170, 13173, 13184, 13189, 13235, 13255, 13290, 13305, 13306, 13328, 13348, 13364, 13416, 13472, 13484, 13495, 13498, 13544, 13587, 13617, 13621, 13622
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; PR heads from `refs/upstream-pr/<N>`. The local git is 2.33 (no `merge-tree --write-tree`), so applicability was checked with `git diff master...refs/upstream-pr/N | git apply --check -` (read-only).
- No comment threads were fetched for this batch.

Summary:

| # | Kind | Verdict |
|---|------|---------|
| 13170 | issue | CANNOT_VERIFY |
| 13173 | issue | OUT_OF_SCOPE |
| 13184 | PR | IMPLEMENT (cherry-pick, resolve trivial conflict) |
| 13189 | issue | IMPLEMENT (new-change, Windows, UNTESTED on hardware) |
| 13235 | issue | CANNOT_VERIFY |
| 13255 | PR | IMPLEMENT (new-change; PR logic is inverted) |
| 13290 | PR | IMPLEMENT (partial-pr: FC_INDEX fix only) |
| 13305 | PR | IMPLEMENT (cherry-pick, resolve trivial conflict) |
| 13306 | PR | IMPLEMENT (cherry-pick) |
| 13328 | PR | DEFER_LARGE |
| 13348 | issue | CANNOT_VERIFY |
| 13364 | issue | CANNOT_VERIFY |
| 13416 | issue | CANNOT_VERIFY |
| 13472 | PR | IMPLEMENT (cherry-pick, resolve trivial conflict) |
| 13484 | issue | CANNOT_VERIFY |
| 13495 | issue | CANNOT_VERIFY |
| 13498 | issue | IMPLEMENT (new-change) |
| 13544 | PR | DEFER_LARGE |
| 13587 | issue | CANNOT_VERIFY |
| 13617 | PR | IMPLEMENT (cherry-pick) |
| 13621 | PR | IMPLEMENT (cherry-pick, Linux/Wayland, UNTESTED) |
| 13622 | PR | DEFER_LARGE |

---

### [#13170](https://github.com/obsproject/obs-studio/issues/13170) — Compressor ducking source triggers even when muted

**Verdict: CANNOT_VERIFY**

The reporter (macOS, 32.1.0-rc1) says a muted sidechain source still ducks the compressed source. The current code already handles mute. The capture callback gets a `muted` flag from `source_muted()`, which covers user mute, push-to-mute, push-to-talk and disabled sources. When that flag is set, the compressor pushes zeros into its sidechain buffer. I found no defect. Possible causes: a few frames of buffered sidechain audio left over after muting, or the user muted something other than the source used as the sidechain (for example a monitoring-only mute). Someone needs to reproduce it on macOS.

Evidence:
- `plugins/obs-filters/compressor-filter.c:144-178` — `sidechain_capture` pushes zeros when `muted` (line 166).
- `libobs/obs-source.c:1594-1607` — `source_muted()` includes `user_muted`.
- `libobs/obs-source.c:1696` — callbacks are signalled with `source_muted(source, os_time)`.
- `libobs/obs-source.c:5067-5086` — `obs_source_set_muted` sets `user_muted` right away.

Related: none.

### [#13173](https://github.com/obsproject/obs-studio/issues/13173) — VLC Player resumes after manual pause with pause when not visible on scene where it's not present

**Verdict: OUT_OF_SCOPE**

The reporter later says in the issue that the problem only happens when the third-party "Audio Monitor" filter plugin is on the source, and that they reported it to that plugin's author. That plugin is not part of obs-studio, so the bug belongs to the third-party plugin.

Evidence:
- Issue body ("Anything else"): the problem only occurs with the Audio Monitor plugin filter.
- `plugins/vlc-video/vlc-video-source.c` — the pause/resume-on-visibility logic is in tree, but the report does not show it failing without the plugin.

Related: none.

### [#13184](https://github.com/obsproject/obs-studio/pull/13184) — Fix integer overflow in texture size calculations for large images

**Verdict: IMPLEMENT (cherry-pick-pr)**

The defect is real. The texture byte sizes are computed in `uint32_t`. For example, `height * rowSizeBytes / 8` with `rowSizeBytes = width * bpp` overflows before the divide-by-8. A 16384x16384 RGBA texture gives 16384*16384*32 = 2^33, which wraps. `image-file.c` has the same problem: it multiplies `uint32_t` values and only then adds the result to a `uint64_t`. The PR casts to 64-bit before multiplying. It has 3 commits and changes 4 lines in 3 files. It does not apply cleanly: the D3D11 hunk at line 64 conflicts only because master since added braces (`if (!data[i]) { break; }`). Resolve that by hand. The other hunks apply as written.

Evidence:
- `libobs-d3d11/d3d11-texture2d.cpp:23-24` — `uint32_t texSizeBytes = height * rowSizeBytes / 8;`
- `libobs-d3d11/d3d11-texture2d.cpp:69` — `uint32_t texSize = bbp * w * h / 8;`
- `libobs-opengl/gl-texture2d.c:22-23` — the same pattern.
- `libobs/graphics/image-file.c:231-232` — `*mem_usage += image->cx * image->cy * gs_get_format_bpp(image->format) / 8;` (32-bit multiply).
- Applicability: `git apply --check` fails only on the d3d11 hunk at line 64 (braces context).

Related: upstream #11921 (closed by this PR), #13183 (superseded).

Slice plan:
- Cherry-pick f50eeeb4b, bd3ee0d59 and 9043e4715 (keep authorship). In d3d11-texture2d.cpp, change the `texSize` line inside the braced block by hand.
- Test: build libobs, libobs-d3d11 and libobs-opengl with MSVC. Run D3D11 by loading a large PNG (for example 16384x16384) in an image source. The OpenGL path is UNTESTED on this box.

### [#13189](https://github.com/obsproject/obs-studio/issues/13189) — NV12 video capture preview shows garbled image for resolutions 800x480,800x800 due to unhandled pitch/stride

**Verdict: IMPLEMENT (new-change)**

Root cause found. `DShowInput::OnVideoData` sets every packed and planar linesize from `config.cx` and ignores the buffer stride. For NV12 it sets `linesize[0] = linesize[1] = cx` and `data[1] = data + cx*cy`. When the driver pads rows (in the report, width 800 with a pitch of 832), each row starts 32 bytes later than OBS expects, so the image shears. That matches the screenshots. The callback receives the real buffer `size`, so the stride can be worked out from it: for NV12, `size = stride * cy * 3/2`.

Evidence:
- `plugins/win-dshow/win-dshow.cpp:525-526` — `OnVideoData(..., unsigned char *data, size_t size, ...)`; `size` is available.
- `plugins/win-dshow/win-dshow.cpp:593-597` — the NV12 branch hard-codes `linesize = cx` and `data[1] = data[0] + cx*cy_abs`.
- `plugins/win-dshow/win-dshow.cpp:577-591` — I420 and YV12 make the same assumption (not part of the minimal slice).

Related: none.

Slice plan (~10 lines, `plugins/win-dshow/win-dshow.cpp`):
- In the NV12 branch, compute `size_t stride = cx;` If `cy_abs > 0` and `size >= (size_t)cx * cy_abs * 3 / 2`, set `size_t s = size * 2 / ((size_t)cy_abs * 3)`, and use it when `s > cx` and `s * cy_abs * 3 / 2 == size`.
- Use `stride` for `linesize[0]`, `linesize[1]` and the `data[1]` offset.
- Test: MSVC build of win-dshow. Runtime behavior is UNTESTED because it needs a camera that outputs padded NV12 (width not a multiple of 64). Check for regressions with any NV12 webcam you have.

### [#13235](https://github.com/obsproject/obs-studio/issues/13235) — Possible incorrect downscale filters behavior

**Verdict: CANNOT_VERIFY**

The report is that bicubic and Lanczos output downscales (1440p to 1080p) distort text, while bilinear and area look fine. It cites an old forum thread and calls it a regression. This is a judgement about image quality. Bicubic and Lanczos sharpen and can ring on thin text at non-integer ratios, and that is expected from those kernels. The report names no specific code change, and I cannot tell from the shaders alone whether this is a defect or how the kernels are meant to behave. A maintainer would need to compare it against a reference scaler.

Evidence:
- `libobs/data/bicubic_scale.effect`, `libobs/data/lanczos_scale.effect` — kernel implementations; no regressing commit identified.
- Issue body: no log evidence of a wrong filter being chosen.

Related: none.

### [#13255](https://github.com/obsproject/obs-studio/pull/13255) — frontend: Show seek controls for media sources with seekable enabled

**Verdict: IMPLEMENT (new-change; do not cherry-pick)**

The request is valid. obs-ffmpeg already treats `seekable` network inputs like local files for seeking (`.is_local_file = s->is_local_file || s->seekable`). The context bar still hides MediaControls for any non-local ffmpeg source. However, the PR's logic is inverted, and its author did not test it. `is_source_seekable` returns `true` for every non-ffmpeg source and for local files, and the call site keeps `if (!is_source_seekable(...))`. As a result it would hide media controls for local files and for VLC/other media sources, and show them only for non-seekable network streams. Make the smallest correct change instead: in the existing helper, a network source counts as "network" only when `seekable` is not set.

Evidence:
- `frontend/widgets/OBSBasic_ContextToolbar.cpp:94-104` — `is_network_media_source` returns `!is_local_file`.
- `frontend/widgets/OBSBasic_ContextToolbar.cpp:147-152` — MediaControls are created only when the source is not a network source.
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:209,308,469` — the `seekable` property exists and enables seeking.
- PR diff: the helper now returns `true` for non-ffmpeg sources and the call site still negates it, so the logic is inverted.

Related: none.

Slice plan (~3 lines, `frontend/widgets/OBSBasic_ContextToolbar.cpp`):
- In `is_network_media_source`, also read `seekable` and `return !is_local_file && !seekable;`. Credit the idea to the PR in the commit text.
- Test: MSVC build of the frontend. Manual check: a media source pointing at an HTTP mp4 with "Seekable" on shows the media controls, and with it off they stay hidden.

### [#13290](https://github.com/obsproject/obs-studio/pull/13290) — text-freetype2: Fix font index retrieval and increase texture buffer size; add support for Cyrillic characters in glyph caching

**Verdict: IMPLEMENT (partial-pr: commit 4d3794eb5 only)**

The PR has three parts.
1. `FcPatternGetInteger(match, FC_INDEX, 1, &fc_index)` asks for the *second* value of FC_INDEX. It should ask for value index 0. A wrong face index for TTC/OTC collections is a clear one-line defect.
2. It grows the glyph atlas from 2048² to 4096². That quadruples per-source memory (A8 texture plus CPU buffer: 4 MiB to 16 MiB for every text source). The real problem is that the atlas has no fallback on overflow, so this is a trade-off for maintainers to decide.
3. It pre-caches Cyrillic. That fixes one script for one locale; other scripts would still have the same problem.

Only part 1 is clearly correct and small. The diff applies cleanly.

Evidence:
- `plugins/text-freetype2/find-font-unix.c:62` — `FcPatternGetInteger(match, FC_INDEX, 1, &fc_index);`
- `plugins/text-freetype2/text-freetype2.c:36` — `texbuf_w = 2048, texbuf_h = 2048`; line 405 allocates `texbuf_w*texbuf_h`.
- `plugins/text-freetype2/text-functionality.c:306-320` — "Out of space" break when the atlas is full.

Related: upstream #11819.

Slice plan:
- Cherry-pick 4d3794eb5 ("text-freetype2: Fix FC_INDEX retrieval") only. Leave out db0fc1e87 (atlas size) and 4d92dcfd0 (Cyrillic pre-cache) and record why in the commit.
- Test: `find-font-unix.c` is built only on Linux/BSD, so the change is UNTESTED here. Confirm that the Windows build is unaffected.

### [#13305](https://github.com/obsproject/obs-studio/pull/13305) — frontend: Update interaction dialog to use weak source

**Verdict: IMPLEMENT (cherry-pick-pr)**

`OBSBasicInteraction` holds a strong `OBSSource`, so the dialog keeps the source alive until the dialog itself is destroyed. The PR switches to `OBSWeakSourceAutoRelease` and gets a strong reference at each use. It also adds null guards to the draw callback and input handlers. It is self-contained (~50 lines, 2 files) and was split out of the larger #6139. The only conflict is the brace style at `DrawPreview` (`if (!window->source) {` in master).

Evidence:
- `frontend/dialogs/OBSBasicInteraction.hpp:36` — `OBSSource source;` (strong ref held by the UI).
- `frontend/dialogs/OBSBasicInteraction.cpp:40-46, 127-149, 250-394` — every place that uses `source`; the PR covers all of them.
- `libobs/obs.hpp:61, 181-189` — `OBSWeakSourceAutoRelease`, `OBSGetStrongRef`/`OBSGetWeakRef` exist.

Related: #13306 (same weak-ref cleanup theme).

Slice plan:
- Cherry-pick ae4c84576 and fix the `DrawPreview` hunk to keep the braces.
- Test: MSVC frontend build. Manual check: open Interact on a browser source, click and type, then delete the source while the dialog is open (the dialog should close and nothing should crash).

### [#13306](https://github.com/obsproject/obs-studio/pull/13306) — frontend: Use auto release weak source for media controls

**Verdict: IMPLEMENT (cherry-pick-pr)**

This is a one-line consistency change in the header. `OBSWeakSource` is already RAII (`OBSRef` releases on destruction), so behavior does not change. Assigning `OBSGetWeakRef()` (an `OBSWeakSource` rvalue) to an `OBSWeakSourceAutoRelease` binds to the base move-assignment and takes ownership correctly. `weakSource = nullptr` releases correctly too. It applies cleanly.

Evidence:
- `frontend/components/MediaControls.hpp:15` — `OBSWeakSource weakSource = nullptr;`
- `frontend/components/MediaControls.cpp:311, 322` — assignment sites.
- `libobs/obs.hpp:67-102, 104-115` — `OBSRefAutoRelease` move-assign / `OBSRef` derives from it.

Related: #13305.

Slice plan: cherry-pick c55fa6e6d. Test: MSVC frontend build. Manual check: play, pause and seek with the media controls on a media source.

### [#13328](https://github.com/obsproject/obs-studio/pull/13328) — frontend: Decouple Scenes dock and logic from OBSBasic

**Verdict: DEFER_LARGE**

This is an architectural refactor: a new `CanvasMediator` and a `SceneList` widget, with about 2600 lines added and 1300 removed across 26 files. It conflicts with master (`frontend/OBSApp.cpp`, `OBSApp.hpp`, among others). It sets new patterns for the frontend, which is a maintainer design decision, so no small slice exists.

Evidence:
- `git diff master...refs/upstream-pr/13328 --stat` — 26 files, +2615/-1280.
- `git apply --check` fails on `frontend/OBSApp.cpp:1995`, `frontend/OBSApp.hpp:234`.

Related: #13622 (same author, overlapping SceneTree work).

### [#13348](https://github.com/obsproject/obs-studio/issues/13348) — OBS crashes on startup (possibly browser source related)

**Verdict: CANNOT_VERIFY**

The crash happens on Windows 11 when the user's existing scene and profile folders are restored and a browser source or dock is used. It affects several versions (30.1 to 32.1.1). The crash log is only available as an external link, and the body has no stack trace. It looks tied to that user's config and CEF environment, and nothing in the body points to a code path.

Evidence:
- Issue body: crash appears only with the user's original config folders; no stack in body.
- `plugins/obs-browser/` — no defect identifiable without the stack.

Related: none.

### [#13364](https://github.com/obsproject/obs-studio/issues/13364) — OBS crash when trying to project a source

**Verdict: CANNOT_VERIFY**

On Arch Linux, the reporter opens a projector on a video capture (V4L2) source and OBS crashes. Both log fields point to the same normal log URL, and the body has no stack trace. The crash is probably specific to that Linux graphics or driver setup, and there is nothing actionable in the code.

Evidence:
- Issue body: crash log URL equals the normal log URL; no stack in body.
- `frontend/widgets/OBSProjector.cpp` — no identifiable defect for this path.

Related: none.

### [#13416](https://github.com/obsproject/obs-studio/issues/13416) — Media File playing in background when OBS not in Studio Mode

**Verdict: CANNOT_VERIFY**

A media source in an inactive scene reportedly starts playing and finishes, which fires a third-party Advanced Scene Switcher macro. obs-ffmpeg starts playback while inactive only when "Restart playback when source becomes active" is off. That is the designed behavior, and the default is on. The report does not include the source settings, and the trigger comes from a third-party plugin. I cannot point to a defect. If the setting was off, this is configuration rather than a bug.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:122` — `restart_on_activate` defaults to true.
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:344-348, 488-493` — starts playback when not active only if `!restart_on_activate`.

Related: none.

### [#13472](https://github.com/obsproject/obs-studio/pull/13472) — frontend: Duplicate browser cookies when profile is duplicated

**Verdict: IMPLEMENT (cherry-pick-pr)**

Defect confirmed. `DuplicateCurrentCookieProfile()` is defined but never called anywhere (the regression the PR attributes to upstream #11055). `SetupDuplicateProfile` copies the profile directory, including `basic.ini` with `[Panels] CookieId`, so both profiles share one cookie store, and logging out in one logs out the other. The PR calls the function after `ActivateProfile(newProfile)`. That copies the cookie folder and writes a new CookieId into the now-active (new) profile config. It also removes the now-pointless `ConfigFile&` parameter. 4 lines. It conflicts only on context in the `extern` block of `OBSBasic_Profiles.cpp`.

Caveat for the commit message: duplication calls `ActivateProfile` without `reset`, so the cookie manager in the current session keeps pointing at the old ID until restart. The PR's own test plan restarts OBS, which matches.

Evidence:
- `frontend/widgets/OBSBasic_Browser.cpp:232-268` — `DuplicateCurrentCookieProfile(ConfigFile &config)` defined.
- `grep DuplicateCurrentCookieProfile frontend/` finds only the definition and the `extern` declaration (`OBSBasic_Profiles.cpp:43`), with no call site.
- `frontend/widgets/OBSBasic_Profiles.cpp:93-111` — `SetupDuplicateProfile` copies the directory and activates without regenerating CookieId.
- `frontend/widgets/OBSBasic_Profiles.cpp:668-688` — `DestroyPanelCookieManager` is called only when `reset`.

Related: #13498.

Slice plan: cherry-pick 14e99f4f8, resolving the `extern` block. Test: MSVC frontend build (needs browser enabled). The OAuth check (Twitch login, duplicate, restart, compare the CookieId values and folders) is manual and may be UNTESTED if no service account is available.

### [#13484](https://github.com/obsproject/obs-studio/issues/13484) — Sometimes incorrect rendering of source colorspace. (Compositing/transform issue?)

**Verdict: CANNOT_VERIFY**

On NixOS with the third-party obs-vkcapture source, Preview and unselected Multiview tiles show wrong colors when the scene item uses bilinear, bicubic or Lanczos scale filtering, while Program looks right. This involves the Linux GPU path and a third-party source's texture format. The code differences between the preview and program render paths for scale-filtered items cannot be judged without a repro on that stack.

Evidence:
- `libobs/obs-scene.c` — scale-filter render path (`render_item_texture` / item texrender) shared by preview and program; no clear defect found from the report.
- Issue body: depends on the third-party obs-vkcapture.

Related: none.

### [#13495](https://github.com/obsproject/obs-studio/issues/13495) — Hang when renaming scene collection (no reproducer but stack trace present)

**Verdict: CANNOT_VERIFY**

The main-thread stack shows Rename leading to `ActivateSceneCollection`, then `Load`, `ClearSceneData` and `obs_wait_for_destroy_queue`. The hang is a wait on another thread that was not captured, possibly a capture-card source stuck in destroy. The reporter cannot reproduce it. The root cause is not identifiable. #13617 avoids the reload on rename, so this path is no longer hit from Rename, but that does not fix the underlying wait.

Evidence:
- `frontend/widgets/OBSBasic_SceneCollections.cpp:229-235` — rename calls `ActivateSceneCollection`, which fully reloads.
- `libobs/obs.c` `obs_wait_for_destroy_queue` — blocks until the destruction task queue is empty.

Related: #13617.

### [#13498](https://github.com/obsproject/obs-studio/issues/13498) — obs-browser: Use top level obs_profile_cookies going forward

**Verdict: IMPLEMENT (new-change)**

This is a maintainer tracking issue. New CEF needs `cache_path` to be a direct child of `root_cache_path`, so the frontend's `obs_profile_cookies/<id>` must become `obs_profile_cookies_<id>`. The precondition the issue names (a migration path in obs-browser) is now in master: obs-browser migrates the old directories at load and rewrites the old prefix at runtime, with a TODO that points back to this issue. The remaining work is to change the three frontend string literals. On CEF > 6533 (official builds pin CEF 7871) the shim then no longer matches, and the paths resolve to the same directories, so behavior does not change. Caveat: builds that use CEF <= 6533 would switch to new top-level directories without migration. Note this in the commit.

Evidence:
- `frontend/widgets/OBSBasic_Browser.cpp:205, 240, 246` — `"obs_profile_cookies/"` literals.
- `plugins/obs-browser/panel/browser-panel.cpp:578-617` — `getUpdatedCookiePath` shim and the TODO referencing #13498.
- `plugins/obs-browser/obs-browser-plugin.cpp:830-856` — migration of `obs_profile_cookies/<id>` to `obs_profile_cookies_<id>`.
- `CMakePresets.json:54-55` — CEF version 7871.

Related: #13472 (touches the same function; land #13472 first).

Slice plan (~6 lines, `frontend/widgets/OBSBasic_Browser.cpp`): add `static constexpr const char *cookiePrefix = "obs_profile_cookies_";` and use it in `InitPanelCookieManager` and `DuplicateCurrentCookieProfile`. Test: MSVC frontend build with browser. Check that the cookie directory used at runtime is still `obs_profile_cookies_<id>` (the same as before, through the shim).

### [#13544](https://github.com/obsproject/obs-studio/pull/13544) — frontend: Improve source context menus

**Verdict: DEFER_LARGE**

This is a UX redesign of the scene-item context menus: the menus stay open, use radio-style items and new theme SVG assets, and selecting a transition no longer opens its properties automatically. It changes 24 files (+449/-158), including theme files for every theme. It applies cleanly, but it is a UX change that needs maintainer design sign-off, and it is above the size guideline. It does not fix a defect.

Evidence:
- `git diff master...refs/upstream-pr/13544 --stat` — 24 files, theme `.ovt` and SVG additions, `OBSBasic_SceneItems.cpp` +233 lines changed.
- `frontend/widgets/OBSBasic_SceneItems.cpp` / `OBSBasic_Transitions.cpp` — current menus close on selection (standard Qt behavior), which is not a bug.

Related: none.

### [#13587](https://github.com/obsproject/obs-studio/issues/13587) — Selecting a source, switching away and back, then pressing Delete removes every source except the selected one

**Verdict: CANNOT_VERIFY**

On 32.2.0-beta2: select a source, switch scenes, switch back, press Delete, and every *other* item gets removed. Deletion uses libobs's per-item `selected` flags (`remove_items` enumerates selected items), not the Qt selection. That points to the UI selection and libobs selection getting out of sync after a scene switch, inverting the selection. I could not find the faulty sync code by reading SourceTree/OBSBasic_Scenes, and nothing after beta2 clearly fixes it. It needs a repro on current master. It is potentially data-losing, though undo exists (`BackupScene` before removal).

Evidence:
- `frontend/widgets/OBSBasic_SceneItems.cpp:854-904` — `on_actionRemoveSource_triggered` enumerates selected items through libobs, then confirms the count and removes.
- Recent SourceTree commits (`2a4dfeb55`, `04d896765`) do not address selection sync.

Related: none.

### [#13617](https://github.com/obsproject/obs-studio/pull/13617) — frontend: Don't reload scene collection after rename

**Verdict: IMPLEMENT (cherry-pick-pr)**

Beyond the UX change of not reloading on rename, the PR fixes a real defect. Rename and duplicate call `obs_data_create_from_json_file(newCollection.getFileName())` and `obs_data_save_json_safe(..., newCollection.getFileName(), ...)`. `getFileName()` is the bare file name, not the full path, so the code reads and writes relative to the process working directory instead of the scene-collections directory. As a result the rename and the new UUIDs on duplicate are never written to the real file. The PR switches to `getFilePathString()` and adds error rollback. Rename then updates the config keys and refreshes the UI without `ActivateSceneCollection`, which also avoids the #13495 hang path. 3 commits, about 50 lines, and it applies cleanly.

Evidence:
- `frontend/widgets/OBSBasic_SceneCollections.cpp:175, 197` (duplicate) and `226, 229` (rename) — `getFileName()` used as a path.
- `frontend/models/SceneCollection.cpp:28, 43` — `getFileName()` versus `getFilePathString()`.
- `frontend/widgets/OBSBasic_SceneCollections.cpp:232-233` — rename currently calls `ActivateSceneCollection`, which fully reloads.

Related: #13495.

Slice plan: cherry-pick ba9d0c690, 66de1b666 and 60ba92541 in order. Test: MSVC frontend build. Manual checks: rename a collection while a media source plays (it should not restart), then open the new `.json` and check `"name"`. Duplicate a collection and check that the source UUIDs differ in the new file. Check that no stray `.json` appears in the working directory.

### [#13621](https://github.com/obsproject/obs-studio/pull/13621) — frontend: Fix exit from tray context menu

**Verdict: IMPLEMENT (cherry-pick-pr)**

When OBS starts with `--minimize-to-tray` on Wayland, the main window is never shown and has no `QPlatformWindow`. In that state `QWidget::close()` does nothing, so the tray menu's Exit (connected to `OBSBasic::close`) fails. The PR adds 17 lines (mostly a comment) to `OBSBasic::close()`: when `windowHandle()` exists but `handle()` is null, it sends a `QCloseEvent` directly. This is small and self-contained, applies cleanly, and fixes a supported platform.

Evidence:
- `frontend/widgets/OBSBasic_SysTray.cpp:48, 84` — tray Exit action calls `OBSBasic::close`.
- `frontend/widgets/OBSBasic.cpp:1560-1567` — `close()` defers to `OBSMainWindow::close()` only.

Related: upstream #13494 (the issue this PR fixes).

Slice plan: cherry-pick b1d6fda1e. Test: MSVC build and check that normal close and tray Exit still work on Windows. The Wayland behavior is UNTESTED (Linux only).

### [#13622](https://github.com/obsproject/obs-studio/pull/13622) — frontend: Clean up and adjustments to SceneTree

**Verdict: DEFER_LARGE**

This is a multi-commit refactor of `SceneTree`. The local ref has 5 commits: grid calculation split, empty eventFilter removal, selection guard, styling refresh and codestyle. The PR description lists more commits than the local ref contains (blockSignals, the scenesReordered removal and the grid reorder rewrite), which are the parts that would fix the described grid-reorder scene-switch bug. It conflicts with master's brace and Qt<6.10 cleanups in `SceneTree.cpp`/`.hpp`. It overlaps with #13328's Scenes-dock redesign by the same author. No small coherent slice stands on its own: the trivial commits are cosmetic, and the bug fix is not in the local ref.

Evidence:
- `git apply --check` fails at `frontend/components/SceneTree.cpp:230` and `SceneTree.hpp:7`.
- `git log master -- frontend/components/SceneTree.cpp` — `0c2f09a1e` (Remove Qt<6.10 code) and `30b63c684` (braces) changed the same lines.

Related: #13328.
