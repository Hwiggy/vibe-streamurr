# Upstream triage: batch libobs-core-01

- Batch: libobs-core-01 (area hint: libobs-core; the hint was wrong for several items, which turned out to be frontend, plugin, or driver crash reports)
- Items: 5217, 5252, 7323, 8992, 9343, 10323, 10686, 10927, 11034, 11074, 11211, 11549, 11602, 11693, 11829, 11921, 11929, 11940, 12060, 12110, 12125, 12213, 12350
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: read item bodies from `notes/upstream-triage/data/all.json`, inspected current code on master with grep/read, and inspected PR heads at `refs/upstream-pr/<N>`. No GitHub API calls and no WebFetch were used. Local git is 2.33, which lacks `merge-tree --write-tree`, so applicability was checked with the 3-way `git merge-tree <base> master <pr>` and a count of conflict markers.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 5217 | issue | CANNOT_VERIFY |
| 5252 | issue | CANNOT_VERIFY |
| 7323 | issue | CANNOT_VERIFY |
| 8992 | issue | CANNOT_VERIFY |
| 9343 | issue | ALREADY_ADDRESSED |
| 10323 | PR | DEFER_LARGE |
| 10686 | issue | CANNOT_VERIFY |
| 10927 | issue | CANNOT_VERIFY |
| 11034 | issue | CANNOT_VERIFY |
| 11074 | issue | IMPLEMENT |
| 11211 | issue | IMPLEMENT |
| 11549 | issue | CANNOT_VERIFY |
| 11602 | issue | CANNOT_VERIFY |
| 11693 | issue | IMPLEMENT |
| 11829 | issue | CANNOT_VERIFY |
| 11921 | issue | OUT_OF_SCOPE |
| 11929 | issue | CANNOT_VERIFY |
| 11940 | issue | CANNOT_VERIFY |
| 12060 | issue | CANNOT_VERIFY |
| 12110 | issue | CANNOT_VERIFY |
| 12125 | PR | DEFER_LARGE |
| 12213 | issue | IMPLEMENT |
| 12350 | issue | IMPLEMENT |

---

### [#5217](https://github.com/obsproject/obs-studio/issues/5217) — Crash after changing video capture device, async RefreshProperties to stale property view reference
**Verdict: CANNOT_VERIFY**

The report is from 2021 (OBS 27). It reproduces on one machine with many capture devices. The reporter suspected the queued `RefreshProperties` call in `WidgetInfo::ControlChanged`. In current code, both queued refreshes use the function-pointer form of `QMetaObject::invokeMethod` and target `view`, which is the `OBSPropertiesView` QObject. Qt drops a queued call if its receiver is destroyed. `RefreshProperties` now disposes of the old container with `deleteLater()`, so the `WidgetInfo` that issued the call is not freed synchronously. I could not find a stale-reference path in the current code, and the reproduction depends on specific hardware.

Evidence:
- `shared/properties-view/properties-view.cpp:2134-2137`: `obs_property_modified` leads to a queued `invokeMethod(view, &OBSPropertiesView::RefreshProperties, Qt::QueuedConnection)`.
- `shared/properties-view/properties-view.cpp:2028`: the same pattern for button clicks.
- `shared/properties-view/properties-view.cpp:115-123`: `RefreshProperties` clears `children` and calls `widget->deleteLater()`.
- Commit `4abbcf0b6` ("frontend: Update invokeMethod to use functions") changed these calls after the report.

Related: none.

### [#5252](https://github.com/obsproject/obs-studio/issues/5252) — Videos render as grey blobs for first few frames
**Verdict: CANNOT_VERIFY**

Reported on macOS 11 with OBS 27, mostly for the VLC Video Source, using phone-recorded portrait HEVC/H.264 files. The symptom is decoding that starts on a non-keyframe. This depends on the VLC (libvlc) or FFmpeg demuxer and decoder, and the sample file is needed to reproduce it. I found no defect in OBS code that I could point to.

Evidence: decoding happens in `plugins/vlc-video` and `plugins/obs-ffmpeg/obs-ffmpeg-source.c` through third-party libraries. The body names no code path.

Related: none in this batch. The body mentions #5250.

### [#7323](https://github.com/obsproject/obs-studio/issues/7323) — swscale-6.dll crash on OBS28
**Verdict: CANNOT_VERIFY**

This is a single crash inside FFmpeg's `swscale-6.dll` after about an hour of streaming on OBS 28.0.1. There is no reproduction, the stack is only in a linked log, and the FFmpeg version has changed since. Nothing in the report is actionable.

Evidence: none actionable. The crash is inside a third-party dependency.

Related: none.

### [#8992](https://github.com/obsproject/obs-studio/issues/8992) — Indefinite hang/Crash clicking Decklink too fast
**Verdict: CANNOT_VERIFY**

Clicking "Preview Output" quickly twice while the main DeckLink output is running causes a hang. The toggle logic runs synchronously on the UI thread and looks consistent: `preview_output_running` is set from the result of `obs_output_start`, and a failed start calls `preview_output_stop`. A hang there would most likely be inside the DeckLink driver or SDK, for example when two outputs use the same device. I could not identify a defect without DeckLink hardware.

Evidence:
- `plugins/decklink-output-ui/decklink-ui-main.cpp:190-219`: `preview_output_stop`.
- `plugins/decklink-output-ui/decklink-ui-main.cpp:221-287`: `preview_output_start`.
- `plugins/decklink-output-ui/decklink-ui-main.cpp:289-296`: `preview_output_toggle`.
- `plugins/decklink-output-ui/DecklinkOutputUI.cpp:123-127`: the button handler.

Related: none.

### [#9343](https://github.com/obsproject/obs-studio/issues/9343) — libobs is underlinked
**Verdict: ALREADY_ADDRESSED**

The report concerns the 29.1.3 PPA package, built with the legacy CMake system, where `libobs.so` used libm symbols without a `NEEDED libm`. The current build framework checks whether math functions link without libm (`HAVE_MATH_IN_STD_LIB`). If they do not, it adds `m` to libobs's link libraries on both Linux and FreeBSD. That logic arrived in commit `0af0de26e` (CMake build framework 3.0, first tagged 30.2.0), which postdates the report.

Caveat: the probe program only calls `sqrt(f)` and discards the result. If a compiler inlines that as a builtin, the probe could pass without libm. That would be a separate, Linux-only fix that I cannot test on this Windows machine.

Evidence:
- `libobs/cmake/os-linux.cmake:35-38`: the libm probe.
- `libobs/cmake/os-linux.cmake:55`: `$<$<NOT:$<BOOL:${HAVE_MATH_IN_STD_LIB}>>:m>`.
- `libobs/cmake/os-freebsd.cmake:11,50`: the same probe and link for FreeBSD.
- `git tag --contains 0af0de26e` returns 30.2.0 and later.

Related: none.

### [#10323](https://github.com/obsproject/obs-studio/pull/10323) — libobs/graphics: Add float2x2 and float3x3 support
**Verdict: DEFER_LARGE**

The PR adds `GS_SHADER_PARAM_MATRIX2X2` and `GS_SHADER_PARAM_MATRIX3X3` (24 lines, merges cleanly). It only teaches the parsers and the GL uniform upload for 3x3, so it is incomplete across the graphics backends:
- D3D11 `gs_shader::BuildConstantBuffer` has no case for the new types. They get size 0, so every constant after a matrix parameter is placed at the wrong offset. D3D11 also pads a float3x3 to 3 registers (48 bytes).
- The GL `gs_shader_set_val` size table returns `expected_size = 0` for unknown types. It then returns early, so values are never set.
- GL has no `glUniformMatrix2fv` path for 2x2.
- The Metal backend's `size`, `mtlSize` and `mtlAlignment` return 0 for the new types.

Completing it means deciding the packing and layout convention for each backend (D3D11 cbuffer rules, std140-like GL, Metal simd alignment) and testing on GL and Metal, which this Windows machine cannot do. The PR's motivation is better error messages in the third-party obs-shaderfilter plugin. Not a small safe slice.

Evidence:
- `libobs-d3d11/d3d11-shader.cpp:152-185`: the size switch handles only MATRIX4X4.
- `libobs-opengl/gl-shader.c:700-740`: the size table defaults to 0.
- `libobs-metal/libobs+Extensions.swift:95-165`: size, alignment and mtlSize default to 0.
- `libobs/graphics/graphics.h:309-322`: the `gs_shader_param_type` enum, part of the public API.
- `git diff master...refs/upstream-pr/10323 --stat`: 5 files, +24.

Related: none.

### [#10686](https://github.com/obsproject/obs-studio/issues/10686) — OBS Crash with High DPI Scaling Override
**Verdict: CANNOT_VERIFY**

The crash happens when moving an undocked dock while the user has forced the Windows compatibility setting "High DPI scaling override: System (Enhanced)" on a 4K display. That setting bitmap-scales a Qt 6 application that is already per-monitor DPI aware, so it is an unusual configuration. The crash log is only a link and has no stack in the body. I found no defect in the dock code to point to.

Evidence: none actionable.

Related: none.

### [#10927](https://github.com/obsproject/obs-studio/issues/10927) — OBS crashing when closing
**Verdict: CANNOT_VERIFY**

A crash on exit in 30.1.2 with no reproduction details and no stack in the body (only a log link). Nothing can be tied to code.

Evidence: none.

Related: none.

### [#11034](https://github.com/obsproject/obs-studio/issues/11034) — OBS crashing - logic bug?
**Verdict: CANNOT_VERIFY**

Random crashes while streaming, sometimes around a Twitch alert (a browser source). There is no reproduction and no crash stack, only a normal log URL. Plugins and scripts were involved.

Evidence: none.

Related: #11829 (also browser sources, also no stack).

### [#11074](https://github.com/obsproject/obs-studio/issues/11074) — Memory leak when --disable-missing-files-check is used
**Verdict: IMPLEMENT**

Confirmed in current code. `OBSBasic::LoadData` always creates `files` with `obs_missing_files_create()` and fills it through `addMissingFiles`. It only passes the list to `ShowMissingFilesDialog` (which takes ownership: either the dialog frees it, or it is destroyed on the zero-count path) when the check is not disabled. With `--disable-missing-files-check` (or the `disable_missing_files_check` marker file), nothing frees `files`, so one object leaks on every scene collection load.

Evidence:
- `frontend/widgets/OBSBasic_SceneCollections.cpp:1347-1355`: create and fill.
- `frontend/widgets/OBSBasic_SceneCollections.cpp:1504-1506`: the conditional `ShowMissingFilesDialog(files)`, with no else branch.
- `frontend/widgets/OBSBasic_SceneCollections.cpp:1670-1691`: `ShowMissingFilesDialog` owns and frees the list.
- `frontend/dialogs/OBSMissingFiles.cpp:74`: the dialog destroys the list.
- `frontend/OBSApp.cpp:1413`: `IsMissingFilesCheckDisabled`.

Related: upstream PR #11075 implements the same fix differently (skips creating the list and guards `AddMissingFiles` against NULL). It targets the old `UI/window-basic-main.cpp` layout and does not apply to the current `frontend/` tree.

Slice plan (new-change, frontend, cross-platform, about 4 lines):
- In `frontend/widgets/OBSBasic_SceneCollections.cpp` around line 1504, add `else { obs_missing_files_destroy(files); }` after the `if (!App()->IsMissingFilesCheckDisabled())` block.
- Commit message: credit the reporter and mention #11075 as prior art.
- Test: build `obs-studio` (frontend) with MSVC in `build_x64`. A runtime check is possible: launch with `--disable-missing-files-check` and a collection that references a missing file, then confirm no "Number of memory leaks" increment at exit in the log.

### [#11211](https://github.com/obsproject/obs-studio/issues/11211) — Potential crash when using unicode characters in filename
**Verdict: IMPLEMENT**

Confirmed. `os_generate_formatted_filename` truncates the result with `dstr_mid(&sf, &sf, 0, 255)` when it is over 255 bytes. That counts bytes, not code points, so it can cut a multi-byte UTF-8 sequence in half. The truncation also runs after the extension is appended, so it can cut off the file extension. The invalid UTF-8 later breaks nlohmann::json in the frontend, which throws `type_error.316` and aborts.

Evidence:
- `libobs/util/platform.c:781-789`: extension appended, then 255-byte truncation.
- `libobs/util/platform.h:167`: exported API.

Related: PR #12964 (strftime ANSI-to-UTF-8 on Windows in the same function). That is a different defect; it can be done independently and is not in this batch. #11940 also concerns user-supplied filename formats.

Slice plan (new-change, libobs, cross-platform, about 15-25 lines plus a test):
- In `os_generate_formatted_filename`, apply the 255-byte limit to the base name before appending the extension, so the extension is kept. Then step back from the cut point while the byte there is a UTF-8 continuation byte (`(c & 0xC0) == 0x80`), so the cut lands on a code point boundary.
- Optional: add a cmocka test `test/cmocka/test_formatted_filename.c` (or extend `test_os_path.c`) that passes a format of `"a"` plus 100 copies of U+200B, checks that the result is valid UTF-8, is at most 255 bytes, and ends in `.mkv`. `obs_get_video_info` safely returns false when libobs is not initialized.
- Test: MSVC build of `libobs` and the cmocka target. The cmocka test runs on Windows.

### [#11549](https://github.com/obsproject/obs-studio/issues/11549) — VRAM (Dedicated GPU Memory) Leak
**Verdict: CANNOT_VERIFY**

Dedicated GPU memory grows with a browser source on testufo.com at 240 pps, on 31.0.0-rc1. The browser source is the obs-browser submodule (CEF). The growth may be CEF's shared-texture handling or the driver, and it depends on the GPU. No OBS code path is identified, and I cannot verify it here.

Evidence: the browser source lives in `plugins/obs-browser` (a submodule; CEF is third-party).

Related: #11829, #12110 (CEF/browser).

### [#11602](https://github.com/obsproject/obs-studio/issues/11602) — OBS freezes and crashes Valorant after 31.0.0 update
**Verdict: CANNOT_VERIFY**

The game-capture hook into Valorant (protected by Riot Vanguard anti-cheat) freezes the game after 31.0.0. It is game- and anti-cheat-specific, with no stack and no clear regression commit. It cannot be reproduced or tied to code here.

Evidence: hooking lives in `plugins/win-capture/graphics-hook`. Nothing specific is identified.

Related: none.

### [#11693](https://github.com/obsproject/obs-studio/issues/11693) — Run auto config test several times, sometimes OBS will crash.
**Verdict: IMPLEMENT**

Root cause confirmed in libobs. `obs_reset_video()` is allowed whenever no video output is active, but the audio thread keeps running and `audio_callback` locks `obs->video.mixes_mutex` on every tick. `obs_reset_video` calls `obs_free_video()`, which runs `pthread_mutex_destroy(&obs->video.mixes_mutex)` and `pthread_mutex_init_value(...)`, and then `obs_init_video()` calls `pthread_mutex_init` again. During that window the audio thread can lock or unlock a destroyed mutex. With w32-pthreads a destroyed mutex becomes NULL, which matches the reporter's debugger finding ("mx was nullptr" in `audio_callback`). The Auto-Configuration wizard calls `ResetVideo()` (`frontend/wizards/AutoConfig.cpp:385`), so running the bandwidth test repeatedly hits this race.

Evidence:
- `libobs/obs-audio.c:576,606`: `audio_callback` locks and unlocks `obs->video.mixes_mutex`.
- `libobs/obs.c:826-843`: `obs_free_video` destroys and re-inits `mixes_mutex`.
- `libobs/obs.c:704`: `obs_init_video` re-initializes it.
- `libobs/obs.c:1526-1546`: `obs_reset_video` gates only on `obs_video_active()`.
- `libobs/obs.c:1236`: `obs_init` only calls init_value.
- `libobs/obs.c:1441-1442`: `obs_shutdown` frees audio before video, so the audio thread is already gone at shutdown.

Related: #12213 (another hazard caused by `obs_reset_video` freeing video state). Similar destroy/re-init patterns exist for `task_mutex` and `encoder_group_mutex` (`libobs/obs.c:850-854`). They are out of this slice's scope; note them as follow-up.

Slice plan (new-change, libobs, cross-platform, about 10-15 lines):
- Initialize `obs->video.mixes_mutex` once in `obs_init()`: replace `pthread_mutex_init_value` at `obs.c:1236` with `pthread_mutex_init(...)`, and fail init if it fails.
- Remove the `pthread_mutex_init` of `mixes_mutex` from `obs_init_video()` (line 704).
- Remove the `pthread_mutex_destroy`/`init_value` pair from `obs_free_video()` (lines 842-843).
- Add `pthread_mutex_destroy(&obs->video.mixes_mutex)` in `obs_shutdown()` after `obs_free_video()`.
- Test: MSVC build of `libobs` plus a full app build. An optional stress test is to run the auto-config wizard repeatedly. The race itself is timing dependent; if it cannot be reproduced, the commit says the fix is verified only by build and review.

### [#11829](https://github.com/obsproject/obs-studio/issues/11829) — OBS 31.0.1 - libcef causes OBS to become non-responsive and crash
**Verdict: CANNOT_VERIFY**

After a long session with several browser sources, the UI freezes inside libcef while recording continues. The crash is in CEF (third-party Chromium, through the obs-browser submodule) with no actionable OBS frame or reproduction.

Evidence: none actionable in this repository.

Related: #11549, #12110, #11034.

### [#11921](https://github.com/obsproject/obs-studio/issues/11921) — Crash, because of "nvwgf2umx.dll" ?
**Verdict: OUT_OF_SCOPE**

The crash is inside `nvwgf2umx.dll`, NVIDIA's D3D11 user-mode driver, during Display Capture of a 4K screen. The reporter describes recent memory instability on a new build, BIOS and EXPO changes, and a custom "MicroWin" Windows image. A crash inside a GPU driver on a system with reported RAM instability is an OS/driver problem. The report identifies no OBS logic defect.

Evidence: none in OBS code. The faulting module is the NVIDIA driver.

Related: none.

### [#11929](https://github.com/obsproject/obs-studio/issues/11929) — Crash when external display is unplugged
**Verdict: CANNOT_VERIFY**

On macOS 15, unplugging the display that shows a fullscreen projector crashes OBS. Current code already handles `QGuiApplication::screenRemoved` and closes the projector when its screen goes away. The crash log is an attachment I cannot read, so I cannot see whether the remaining crash is in the Qt, Metal/OpenGL swapchain, or display-link teardown. Reproducing needs macOS hardware.

Evidence:
- `frontend/widgets/OBSProjector.cpp:81`: connects `screenRemoved`.
- `frontend/widgets/OBSProjector.cpp:490-499`: `ScreenRemoved` calls `EscapeTriggered()` for the projector's screen.

Related: none.

### [#11940](https://github.com/obsproject/obs-studio/issues/11940) — Error and crash when trying to create a folder with trailing spaces
**Verdict: CANNOT_VERIFY**

A filename format like `%CCYY-%MM-%DD /%hh-%mm-%ss` on Windows gives an error on the first recording and a crash on the second. The first error is explainable: `ensure_directory_exists` calls `os_mkdirs` with a path component that ends in a space. Win32 path normalization strips trailing spaces and dots from the created directory, but not from intermediate components when the file is opened, so the output path does not exist. The crash on the second attempt is the real bug, and its stack is not available (the attached crash log does not match the log). I cannot identify the crashing code path.

A possible mitigation (not chosen as a slice, because it does not fix the unknown crash): trim trailing spaces and dots from directory components in `GetOutputFilename` on Windows.

Evidence:
- `frontend/OBSApp.cpp:1610-1621`: `ensure_directory_exists`.
- `frontend/OBSApp.cpp:1623-1633`: `remove_reserved_file_characters` does not handle trailing spaces.
- `frontend/OBSApp.cpp:1692`: `GetOutputFilename`.

Related: #11211 (filename-format robustness).

### [#12060](https://github.com/obsproject/obs-studio/issues/12060) — obs keep crash while open
**Verdict: CANNOT_VERIFY**

A crash on startup after the user installed many tools, Bitdefender, and an NVIDIA (Broadcast/Maxine) audio filter. Only an attached crash file is referenced, with no stack in the body. The likely causes are environmental (antivirus injection, or the NVIDIA AFX SDK runtime), but this cannot be confirmed.

Evidence: none.

Related: none.

### [#12110](https://github.com/obsproject/obs-studio/issues/12110) — OBS crash
**Verdict: CANNOT_VERIFY**

On macOS 12 (x86-64), OBS 31.0.3 crashes with `EXC_BREAKPOINT` in the Chromium Embedded Framework on the main thread, while saving settings after the auto-config wizard's bandwidth test with YouTube and a manual key. The top frames are all CEF, so this is a CEF CHECK/assert, probably from browser-dock or OAuth teardown. It needs macOS to reproduce. No OBS frame is shown in the body, so I cannot tie it to a defect.

Evidence: CEF is used through `plugins/obs-browser` (submodule) and the frontend browser docks and auth code. No specific line identified.

Related: #11829, #11549 (CEF), #11693 (also auto-config wizard, different root cause).

### [#12125](https://github.com/obsproject/obs-studio/pull/12125) — libobs: Add UYVA pixel format support
**Verdict: DEFER_LARGE**

The PR (3 commits, 10 files, +73) adds a new public `VIDEO_FORMAT_UYVA` enum value (packed 4:2:2 plus a separate alpha plane, as used by NDI), along with source-side GPU conversion. It merges cleanly. I am not taking it, for three reasons:
1. It extends the public libobs API/ABI (the `enum video_format` in `video-io.h`). For a fork that never goes upstream this is risky: if upstream later adds a different format after `VIDEO_FORMAT_R10L`, the enum values diverge, and plugins built against upstream headers would misread formats.
2. The only consumer is the out-of-tree DistroAV plugin, and nothing in this repository produces UYVA frames.
3. The PR also lets the frontend select UYVA as an output format (`GetVideoFormatFromName`) and treats it as a single packed plane in `set_gpu_converted_data`. There is no output-side conversion technique and no handling of the alpha plane for UYVA output. Selecting it as the output format would produce broken output, so that part would need to be removed or designed properly.

This needs a maintainer API decision.

Evidence:
- `libobs/media-io/video-io.h:34-97`: `enum video_format` ends at `VIDEO_FORMAT_R10L`; this is public API.
- PR diff: `frontend/widgets/OBSBasic.cpp` adds `"UYVA"` to `GetVideoFormatFromName`.
- PR diff: `libobs/obs-video.c` puts UYVA in the single-plane copy case of `set_gpu_converted_data`.
- `git merge-tree` shows 0 conflict markers.

Related: upstream PR #10345 (closed predecessor, not in this batch).

### [#12213](https://github.com/obsproject/obs-studio/issues/12213) — crash report about using freed video_t
**Verdict: IMPLEMENT**

Confirmed from code, and the reporter's analysis is correct.
1. When a stream fails to connect, the output's video encoder has already been initialized (`encoder->initialized = true`, `context.data` alive, `encoder->media` = the current `video_t`). Data capture never began, so `obs_encoder_stop`/`remove_connection` never runs. Those are the only paths that call `obs_encoder_shutdown` and clear `initialized`. `obs_output_end_data_capture_internal` returns early when `!active || !data_active`.
2. A later video reset (`obs_reset_video`, triggered by changing the output resolution) frees every `video_t` while the encoder keeps a dangling `encoder->media`.
3. On the next start, `AdvancedOutput::SetupStreaming` calls `UpdateStreamSettings()` (which calls `obs_encoder_update`, then `info.update`, then x264 `obs_encoder_get_width`, then `video_output_get_width(encoder->media)`) before `SetupOutputs()`. This is a use-after-free.
4. Even reordering the frontend would not fix it: `obs_encoder_set_video` refuses to replace the video while `encoder->initialized` is true.

The smallest correct fix belongs in libobs. A video reset is only allowed when no video is active, which means no encoder is active. At that point, every encoder that is initialized but not active holds a pointer into video state that is about to be freed, so it must be shut down.

Evidence:
- `libobs/obs-output.c:2875-2887`: early return without encoder shutdown.
- `libobs/obs-encoder.c:441-448`: shutdown and `initialized = false` happen only in `remove_connection`.
- `libobs/obs-encoder.c:683,702`: the `initialized` flag is set during init.
- `libobs/obs-encoder.c:585-601`: `obs_encoder_update` calls `info.update` when `context.data` is set and the encoder is not active.
- `libobs/obs-encoder.c:1055-1069`: `obs_encoder_get_width` dereferences `encoder->media`.
- `libobs/obs-encoder.c:1202-1208`: `obs_encoder_set_video` refuses after initialization.
- `frontend/utility/AdvancedOutput.cpp:626-633`: `UpdateStreamSettings()` runs before `SetupOutputs()`.
- `frontend/utility/AdvancedOutput.cpp:555-559`: `SetupOutputs` calls `obs_encoder_set_video`.
- `libobs/obs.c:1526-1546`: `obs_reset_video`.

Related: #11693 (the other `obs_reset_video` hazard).

Slice plan (new-change, libobs, cross-platform, about 25-35 lines):
- Add an internal helper in `libobs/obs-encoder.c`, for example `void obs_encoders_shutdown_inactive(void)`, declared in `libobs/obs-internal.h` next to `obs_encoder_shutdown`. Under `obs->data.encoders_mutex`, it walks `obs->data.first_encoder`. For each `OBS_ENCODER_VIDEO` encoder that is `initialized` and not `encoder_active`, it calls `obs_encoder_shutdown(encoder)` and sets `encoder->initialized = false`.
- Lock ordering: to avoid taking `init_mutex` while holding `encoders_mutex`, collect strong refs (`obs_encoder_get_ref`) into a DARRAY under the lock, then shut down and release outside it.
- Call the helper from `obs_reset_video()` right after the `obs_video_active()` check and before `stop_video()`.
- Leave `encoder->media` alone. With `context.data == NULL`, `obs_encoder_update` only merges settings, and the frontend's `SetupOutputs` then succeeds with `obs_encoder_set_video`.
- Test: MSVC build of `libobs` and the app. Manual reproduction on Windows follows the report: set IP family to IPv6-only to force a connect failure, start streaming, change the output resolution, then start again. The crash is easiest to see in a Debug build.

### [#12350](https://github.com/obsproject/obs-studio/issues/12350) — Removing secondary GPU Causes a soft-lock
**Verdict: IMPLEMENT**

Confirmed in obs-nvenc. The "GPU" (`device`) property is only added when `num_encoder_devices() > 1`. A saved `device=1` from a two-GPU setup is kept after the second GPU is removed, and the user can no longer see or reset it.

On the encoder side:
- `nvenc_create_base` treats any explicit `device != -1` as "different GPU" and falls back to the non-texture encoder.
- `cuda_init` then calls `cuDeviceGet(&device, gpu)` with an out-of-range index and fails, so encoding fails with no way to fix it in the UI.

Separately, the property's maximum is `num_encoder_devices()` instead of `num - 1`, which allows selecting a device that does not exist.

Evidence:
- `plugins/obs-nvenc/nvenc-properties.c:205-207`: the property is hidden with fewer than two devices, and its max is off by one.
- `plugins/obs-nvenc/nvenc-properties.c:46`: the default is -1.
- `plugins/obs-nvenc/nvenc.c:936-947`: the `gpu_set && gpu != -1` branch reroutes to the non-texture encoder.
- `plugins/obs-nvenc/nvenc-cuda.c:21-36`: `cuDeviceGet` uses the raw index after `cuDeviceGetCount`.
- `plugins/obs-nvenc/nvenc-helpers.c:247`: `num_encoder_devices`.

Related: none.

Slice plan (new-change, obs-nvenc, Windows and Linux, about 10-15 lines):
- In `nvenc_create_base`: if `gpu_set && gpu >= num_encoder_devices()`, log a warning ("configured GPU %d not present, using default") and treat it as unset (`gpu = -1`, `gpu_set = false`), so the texture path is used.
- In `nvenc-cuda.c` `cuda_init`: after `cuDeviceGetCount`, if `gpu >= count`, warn and use `gpu = 0`.
- In `nvenc-properties.c:206`: change the max to `num_encoder_devices() - 1`.
- Test: MSVC build of the `obs-nvenc` target. The runtime behaviour needs two NVIDIA GPUs and then removing one, which this machine cannot do, so the runtime behaviour is UNTESTED. A partial check is possible on a one-NVIDIA-GPU box by hand-editing the encoder JSON to `"device": 1` and confirming that encoding starts with the warning logged.
