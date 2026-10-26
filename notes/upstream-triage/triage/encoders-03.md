# Upstream triage — batch encoders-03

- Batch: encoders-03 (area hint: encoders)
- Items: 11078, 11264, 11334, 11341, 11388, 11462, 11490, 11524, 11551, 11752, 11881, 11945, 11993, 12013, 12114, 12235, 12427, 12520, 12713
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; PR heads from `refs/upstream-pr/<N>`. The local git is 2.33, which has no `merge-tree --write-tree`, so "applies" was checked with `git diff master...refs/upstream-pr/N | git apply --check`. That check is read-only.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 11078 | issue | IMPLEMENT (same root cause as 11551) |
| 11264 | issue | IMPLEMENT |
| 11334 | PR | DEFER_LARGE |
| 11341 | issue | CANNOT_VERIFY |
| 11388 | issue | CANNOT_VERIFY |
| 11462 | PR | DEFER_LARGE |
| 11490 | PR | OUT_OF_SCOPE (licensing) |
| 11524 | issue | CANNOT_VERIFY |
| 11551 | issue | IMPLEMENT |
| 11752 | PR | DEFER_LARGE |
| 11881 | PR | IMPLEMENT (partial-pr) |
| 11945 | issue | CANNOT_VERIFY |
| 11993 | PR | DEFER_LARGE |
| 12013 | issue | CANNOT_VERIFY |
| 12114 | PR | IMPLEMENT (cherry-pick) |
| 12235 | issue | IMPLEMENT |
| 12427 | issue | CANNOT_VERIFY |
| 12520 | issue | IMPLEMENT |
| 12713 | issue | CANNOT_VERIFY |

---

### [#11078](https://github.com/obsproject/obs-studio/issues/11078) — "Skipped frames due to encoding lag" total frame counter does not increment when recording output scaling is enabled

**Verdict: IMPLEMENT** (fixed together with #11551)

The stats dock and the status bar read the skipped/total frame counters only from the main mix's `video_t` (`obs_get_video()`). When an encoder has GPU rescaling turned on, libobs moves it to a separate encoder-only video mix (`maybe_set_up_gpu_rescale` calls `obs_encoder_set_video(encoder, mix->video)`). The counters on that mix's `video_t` increment, but the main mix has no consumers, so its counters stay at 0 and the UI shows "0 / 0".

Evidence:
- `libobs/obs-encoder.c:234-330`: `maybe_set_up_gpu_rescale` creates or reuses an `encoder_only_mix` and points the encoder at it.
- `libobs/media-io/video-io.c:180,205,208`: `skipped_frames`/`total_frames` increment per `video_t` only when frames are consumed. `:616-623` are the getters.
- `frontend/widgets/OBSBasicStats.cpp:263-264,366-367` reads only `obs_get_video()`.
- `frontend/widgets/OBSBasicStatusBar.cpp:58-59,474-475` does the same for the status-bar dropped/skipped warning.

Related: #11551 (same bug, reporter already found the root cause).

Slice plan: see #11551.

### [#11264](https://github.com/obsproject/obs-studio/issues/11264) — Enhanced Broadcasting staying enabled after going back a step in the Auto Configuration Wizard

**Verdict: IMPLEMENT**

`AutoConfigStreamPage::validatePage` sets `wiz->multitrackVideo.testSuccessful = true` (and `targetBitrate`) when the multitrack test is checked. It never resets those fields when the page is validated again with the box unchecked. It also keeps appending to `wiz->serviceConfigServers` on each pass. On the final page, `multitrackVideo.testSuccessful` decides both the "Multitrack Video: Yes" label and `EnableMultitrackVideo`, so the stale `true` from the first run is kept.

Evidence:
- `frontend/wizards/AutoConfigStreamPage.cpp:179-238`: the flag is only ever set to true, and `serviceConfigServers.push_back` is never cleared.
- `frontend/wizards/AutoConfig.hpp:67-71`: the `multitrackVideo` struct defaults to false/nullopt.
- `frontend/wizards/AutoConfigTestPage.cpp:1063-1064`: the results page shows Yes/No from `testSuccessful`.
- `frontend/wizards/AutoConfig.cpp:344`: saves `EnableMultitrackVideo = multitrackVideo.testSuccessful`.

Slice plan:
- `frontend/wizards/AutoConfigStreamPage.cpp`: before the `if (wiz->service == AutoConfig::Service::Twitch)` block, reset `wiz->testMultitrackVideo = false;`, `wiz->multitrackVideo = decltype(wiz->multitrackVideo){};` and `wiz->serviceConfigServers.clear();`. About 5 lines.
- Test: MSVC build of the frontend. A manual check needs a Twitch key and the wizard back/forward flow. The UI flow is UNTESTED unless run by hand.

### [#11334](https://github.com/obsproject/obs-studio/pull/11334) — plugins: Move AMF encoders from obs-ffmpeg as a separate plugin

**Verdict: DEFER_LARGE**

This is a pure code move: AMF goes from `obs-ffmpeg` into a new `obs-amf` module, with a new CMake target, rc file and locale. It has no functional change. It no longer applies (`plugins/CMakeLists.txt` and `plugins/obs-ffmpeg/data/locale/en-US.ini` reject). It changes Windows packaging and module layout, and the author says the Windows artifacts were never tested. In a private fork, moving a whole encoder into a new module would cause ongoing merge friction with upstream and gives users nothing.

Evidence:
- `git diff master...refs/upstream-pr/11334 --stat`: 13 files, +105/-37, plus renames of `texture-amf.cpp`, `texture-amf-opts.hpp` and `obs-amf-test`.
- `git apply --check` fails on `plugins/CMakeLists.txt:36` and `plugins/obs-ffmpeg/data/locale/en-US.ini:66`.
- AMF still lives at `plugins/obs-ffmpeg/texture-amf.cpp`.

Related: #11752 (also touches `texture-amf.cpp`).

### [#11341](https://github.com/obsproject/obs-studio/issues/11341) — Recording 7680x2160 with hevc_nvenc at 48 fps crashes when stopping recording

**Verdict: CANNOT_VERIFY**

The setup is a custom FFmpeg output using FFmpeg's `hevc_nvenc` at 8K-wide and 1 Gbps, with the NVENC chip at 99-100%. There is no crash log and no stack trace. The reporter says it worked on older NVIDIA drivers. The crash cannot be traced to a specific code path in `obs-ffmpeg-output.c` without a dump, and it depends on the driver and hardware.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-output.c`: the custom FFmpeg output path. No identifiable defect without a stack.
- The issue body has "Crash Log URL: No response".

### [#11388](https://github.com/obsproject/obs-studio/issues/11388) — OBS after v30.0 encoding errors

**Verdict: CANNOT_VERIFY**

The recordings show glitches when scrubbing, using the AMD H.264 encoder after 30.0. The only evidence is videos and two logs. Seeking problems are usually about keyframe interval or the container, and here they are tied to the AMD driver. The AMF H.264 path sets GOP/IDR the same way as the other codecs. Nothing in the code can be shown to be defective, and reproducing it needs AMD hardware.

Evidence:
- `plugins/obs-ffmpeg/texture-amf.cpp:1558-1610` (`amf_avc_init`): generic GOP/B-frame/HRD setup, nothing version-specific to point at.

### [#11462](https://github.com/obsproject/obs-studio/pull/11462) — obs-outputs: Enable eRTMP Flac and Opus support

**Verdict: DEFER_LARGE** (small diff, but it needs a product/compatibility decision)

The diff is small (+24/-2) and applies cleanly. However, it adds `flac;opus` to `rtmp_output_info.encoded_audio_codecs`. Most services in `services.json` do not declare "supported audio codecs", and in that case `rtmp_common_get_supported_audio_codecs` returns NULL, meaning no restriction. So Opus and FLAC would show up for almost every RTMP service, even though practically no ingest accepts them. The PR itself says "the eRTMP backend may not accept both codecs". The `onMetaData` `audiocodecid` is still hard-coded to AAC. Shipping this needs service gating, for example only allowing it for custom servers or services that opt in. That is a design decision, not a bug fix.

Evidence:
- `plugins/obs-outputs/rtmp-stream.c:1995`: `.encoded_audio_codecs = "aac"`.
- `plugins/obs-outputs/flv-mux.h:24-41`: only AAC in `audio_id_t`.
- `plugins/obs-outputs/flv-mux.c:75-88` (`s_wa4cc`) and `:217` (`audiocodecid` set to AAC).
- `plugins/rtmp-services/rtmp-common.c:1044-1083`: NULL (unrestricted) when the service JSON has no codec list.
- `git apply --check`: applies.

### [#11490](https://github.com/obsproject/obs-studio/pull/11490) — obs-libfdk: Load libfdk-aac from shared library dynamically

**Verdict: OUT_OF_SCOPE** (licensing)

The PR turns `ENABLE_LIBFDK` ON by default and drops the link-time dependency. It replaces that with a 199-line header that re-declares the FDK-AAC API (enums and function signatures taken from FDK's `aacenc_lib.h`), loads the library with `dlopen`/`LoadLibrary`, and is meant to ship the plugin in the default package. FDK-AAC's license is not GPL-compatible, which is exactly why upstream keeps this plugin opt-in and off by default (`plugins/obs-libfdk/CMakeLists.txt:3`). The user's instructions require license-compliant changes. Shipping a GPL plugin built to drive a GPL-incompatible codec by default, with re-transcribed vendor headers, is a licensing and policy call this fork should not make. It also no longer applies (the CMakeLists rejects).

Evidence:
- `plugins/obs-libfdk/CMakeLists.txt:3`: `option(ENABLE_LIBFDK "Enable FDK AAC support" OFF)`.
- `git show refs/upstream-pr/11490:plugins/obs-libfdk/libfdk-aac-wrapper.h`: re-declared FDK enums and types.
- `git apply --check` fails on `plugins/obs-libfdk/CMakeLists.txt:1`.

### [#11524](https://github.com/obsproject/obs-studio/issues/11524) — OBS crashing in ffmpeg mode

**Verdict: CANNOT_VERIFY**

The report is a crash while recording WebM with the custom FFmpeg output, after an arbitrary amount of time. The only data is log and crash-log URLs, which were not fetched (the API budget is reserved). The body has no stack, codec settings or repro details. No defect can be identified in `obs-ffmpeg-output.c` from the description alone.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-output.c` (custom FFmpeg output): no specific path to point at.

### [#11551](https://github.com/obsproject/obs-studio/issues/11551) — [bug] encode frames is always 0/0 in stats dialog

**Verdict: IMPLEMENT**

This has the same root cause as #11078, and the reporter identified it correctly: the stats read `obs_get_video()`, while a rescaled encoder counts frames on the encoder-only mix's `video_t` created in `maybe_set_up_gpu_rescale`.

Evidence:
- `frontend/widgets/OBSBasicStats.cpp:263-264,366-367`.
- `frontend/widgets/OBSBasicStatusBar.cpp:58-59,474-475`.
- `libobs/obs-encoder.c:234-330`.
- `libobs/media-io/video-io.c:616-623`.
- `shared/bpm/bpm.c:35-45` already does the right thing per encoder via `obs_encoder_video(pkt->encoder)`, which shows the counters do live on the encoder's mix.

Related: #11078.

Slice plan (new-change, about 60 lines):
1. `libobs/obs.c` and `libobs/obs.h`: add `EXPORT uint32_t obs_get_video_skipped_frames(void)` and `obs_get_video_total_frames(void)`. Each one locks `obs->video.mixes_mutex` and sums `video_output_get_{skipped,total}_frames(mix->video)` over `obs->video.mixes`. Mixes with no consumers contribute 0, so the main mix plus any encoder-only mixes give the right aggregate. This matches the existing "doubling is fine" note at `video-io.c:625-629`.
2. `frontend/widgets/OBSBasicStats.cpp` (InitializeValues and Update) and `frontend/widgets/OBSBasicStatusBar.cpp` (Activate and UpdateDroppedFrames): use the new helpers. The existing "counter went backwards, rebase" logic at `OBSBasicStats.cpp:369-372` already handles a mix being reset.
3. `docs/sphinx/reference-core.rst`: document the two functions next to `obs_get_lagged_frames`.

Test: MSVC build of libobs and the frontend on Windows. Manual check: Advanced output, rescale the recording to 1280x720 on a 1080p canvas, record, and the Stats "Skipped frames" total should increase. Mark UNTESTED if not run by hand.

### [#11752](https://github.com/obsproject/obs-studio/pull/11752) — Make AMF encoder utilize all VCNs

**Verdict: DEFER_LARGE**

This is a performance rework of `texture-amf.cpp` (+394/-62): a shared D3D device across AMF sessions and spreading sessions across VCN instances. It no longer applies (`texture-amf.cpp:115` rejects). It is aimed at multi-stream setups using a third-party plugin, and it can only be validated on AMD multi-VCN hardware. It is too large and too hardware-dependent for a small slice.

Evidence:
- `git diff master...refs/upstream-pr/11752 --stat`: 1 file, 456 lines changed.
- `git apply --check` fails on `plugins/obs-ffmpeg/texture-amf.cpp:115`.

Related: #11334.

### [#11881](https://github.com/obsproject/obs-studio/pull/11881) — obs-ffmpeg: Fix bug with last frame showing on video restart

**Verdict: IMPLEMENT** (partial-pr)

Root cause, confirmed in code: with "Restart playback when source becomes active" on and "Show nothing when playback ends" off, `ffmpeg_source_deactivate` stops playback but only clears the frame when `is_clear_on_media_end` is set. `ffmpeg_source_activate` then calls `obs_source_media_restart()`, which only queues a `MEDIA_ACTION_RESTART` processed later in the video tick. During the first frames after reactivation, the source still holds the stale last frame, which is the flash the reporter sees.

The PR applies cleanly, but it also adds an unconditional `media_playback_seek(s->media, 0)` in the non-preload branch of `ffmpeg_source_start` and an extra clear in `preload_frame`. Neither is needed for this bug and both carry regression risk (an extra seek on every start; it clears the frame on every preload). The PR is labelled "Seeking Testers".

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c` `ffmpeg_source_deactivate` (around :663-675): the clear is gated on `is_clear_on_media_end`.
- Same file, `ffmpeg_source_activate` (around :654-660): calls the restart.
- `libobs/obs-source.c:5814-5830`: `obs_source_media_restart` only queues the action.
- `git apply --check`: applies.

Slice plan (partial cherry-pick, keeping authorship via `Co-authored-by`/attribution):
- `ffmpeg_source_deactivate`: inside the `restart_on_activate && s->media` branch, call `obs_source_output_video(s->source, NULL)` unconditionally. Content is going to restart anyway, so the last frame is never wanted.
- Optionally, take the PR's `obs_source_output_video(NULL)` before `obs_source_media_restart` in `ffmpeg_source_activate`.
- Leave out the seek and preload changes.
- About 5 lines.

Test: MSVC build of obs-ffmpeg. Manual check: a media source with a distinct last frame and restart-on-activate on; hide it after it ends, show it again, and there should be no last-frame flash. UNTESTED unless run by hand.

Related: upstream issues #2906 and #4667 (referenced by the PR, not in this batch).

### [#11945](https://github.com/obsproject/obs-studio/issues/11945) — RGB range incorrect / too dark on new HW AMF encoder on 9070XT

**Verdict: CANNOT_VERIFY**

The AMF code maps OBS's range to AMF identically for every GPU: `full_range` drives the converter color profile, `FULL_RANGE_COLOR` for AVC, and `NOMINAL_RANGE` for HEVC/AV1. MediaInfo reports "Limited" correctly, so the signalling is right. The darker output appears only on an RDNA4 9070XT and not on other AMD or NVIDIA cards, which points at the driver or the AMF runtime. No defect is visible in OBS code.

Evidence:
- `plugins/obs-ffmpeg/texture-amf.cpp:1088-1117`: range and profile selection.
- `:1703` (AVC `FULL_RANGE_COLOR`), `:2098` (HEVC `NOMINAL_RANGE`), `:2529` (AV1 `NOMINAL_RANGE`).

### [#11993](https://github.com/obsproject/obs-studio/pull/11993) — win-mediafoundation: Add Media Foundation encoders on WoA

**Verdict: DEFER_LARGE**

This is a new plugin with about 4.8k lines across 21 files (MFT H.264/HEVC/AV1 encoders for Qualcomm Windows-on-ARM). It conflicts on `plugins/CMakeLists.txt:103`. It is a whole new feature module that can only be tested on WoA hardware, which this x64 machine is not.

Evidence:
- `git diff master...refs/upstream-pr/11993 --stat`: 21 files, +4826.
- `git apply --check` fails on `plugins/CMakeLists.txt:103`.

### [#12013](https://github.com/obsproject/obs-studio/issues/12013) — AMD HW AV1 exceeds configured bitrate in CBR

**Verdict: CANNOT_VERIFY**

OBS configures AV1 CBR the same way as AVC and HEVC: peak bitrate = bitrate, VBV = bitrate, filler data, `ENFORCE_HRD`. The reporter says HEVC behaves correctly with identical settings, and the problem goes away with 0 B-frames. That points at the AMF AV1 B-frame rate control in the driver, not at OBS parameter setup. The status-bar bitrate is also a short-window measurement that B-frame bursts can inflate.

Evidence:
- `plugins/obs-ffmpeg/texture-amf.cpp:2308-2320` (AV1 rate control) vs `:1882-1894` (HEVC) and `:1399-1411` (AVC): same logic.
- `:2409-2410`: AV1 B-frame pattern. `:2435`: `ENFORCE_HRD`.

### [#12114](https://github.com/obsproject/obs-studio/pull/12114) — obs-qsv11: Cast width*height to fix sign-compare warning

**Verdict: IMPLEMENT** (cherry-pick-pr)

`nWidth` and `nHeight` are `mfxU16`, so their product is promoted to `int` and compared against `constexpr uint32_t pixelcount_4k`. That trips `-Wsign-compare`, which the project enables globally and which fails with `-Werror`. The one-line cast is correct and applies cleanly. A slightly better form is `uint32_t(pParams->nWidth) * pParams->nHeight`, which avoids the theoretical int overflow before the cast; that tweak can be noted in the commit.

Evidence:
- `plugins/obs-qsv11/QSV_Encoder.h:96-97`: `mfxU16 nWidth/nHeight`.
- `plugins/obs-qsv11/QSV_Encoder_Internal.cpp:358-360`: the comparison.
- `cmake/common/compiler_common.cmake:47`: `-Wsign-compare`.
- `git apply --check`: applies.

Slice plan: `git cherry-pick 56b1c7c30` (1 line, author preserved). Test: MSVC build of the `obs-qsv11` target on Windows. MSVC's C4018 is the equivalent warning; the GCC/Clang `-Wsign-compare` path is UNTESTED on this machine.

### [#12235](https://github.com/obsproject/obs-studio/issues/12235) — Changing bitrate during stream with dynamic bitrate enabled goes back to original bitrate

**Verdict: IMPLEMENT**

Root cause, confirmed in code: DBR records `dbr_orig_bitrate` and the interpolation table (whose top point holds each encoder's bitrate) once, when the stream starts. Later recovery steps (`dbr_inc_bitrate`) climb back up to that original value and push it to the encoder via `dbr_set_bitrate`, overwriting the new bitrate the user set in Settings mid-stream.

Evidence:
- `plugins/obs-outputs/rtmp-stream.c:1421-1434`: the bitrate is captured at start into `dbr_point->bitrates[i]` and `dbr_orig_bitrate`.
- `:1738-1749`: `dbr_inc_bitrate` caps at `dbr_orig_bitrate`.
- `:1684-1736`: `dbr_set_bitrate` writes interpolated bitrates into the encoder settings.
- `:723-730`: the bitrate is also reset to the original on disconnect.
- `frontend/utility/AdvancedOutput.cpp:260,328` and `frontend/utility/SimpleOutput.cpp:375`: the frontend applies a new bitrate to the live encoder with `obs_encoder_update`.

Slice plan (new-change, about 40 lines, single-track only):
- In `struct rtmp_stream`, track the last bitrate DBR itself wrote (`long dbr_last_set_bitrate`, set in `dbr_set_bitrate`).
- At the top of `dbr_set_bitrate`, or in the `dbr_inc_timeout` check in `check_to_drop_frames`, when not multitrack: read encoder 0's current `bitrate` setting. If it differs from `dbr_last_set_bitrate`, the user changed it, so rebase under `dbr_mutex`:
  - `dbr_orig_bitrate = new`
  - `dbr_interpolation_table.array[last].bitrates[0] = new`
  - `dbr_inc_bitrate = new / 10`
  - `dbr_cur_bitrate = min(dbr_cur_bitrate, new)`
- Multitrack (server-provided ladder) stays unchanged.

Test: MSVC build of obs-outputs. A behavioural test needs a live RTMP endpoint plus upload throttling, so it is UNTESTED.

### [#12427](https://github.com/obsproject/obs-studio/issues/12427) — Changing nvenc encoder settings while encoding works only for h264

**Verdict: CANNOT_VERIFY**

The NVENC reconfigure path is codec-agnostic. One `nvenc_update` is registered for H.264, HEVC and AV1 (texture and software variants alike), and every variant advertises `OBS_ENCODER_CAP_DYN_BITRATE`. The update is gated only by `can_change_bitrate`, which is the driver's `NV_ENC_CAPS_SUPPORT_DYN_BITRATE_CHANGE` cap for that codec (false for CQP/lossless). libobs defers active updates generically. So when HEVC/AV1 do not react, it is either the driver reporting no dynamic-bitrate support for those codecs on that GPU, or something in the user's setup (for example multitrack). Neither can be shown from code.

The secondary request (VBR/CQVBR) is already handled: `nvenc_update` updates `maxBitRate` for VBR and `targetQuality` for CQVBR.

Evidence:
- `plugins/obs-nvenc/nvenc.c:92-126`: `nvenc_update`.
- `:354,368`: `can_change_bitrate`.
- `:1400-1520`: all six encoder infos use `.update = nvenc_update` and `CAP_DYN_BITRATE`.
- `libobs/obs-encoder.c:585-611`: deferred reconfigure.

Related: #12235 (live bitrate changes).

### [#12520](https://github.com/obsproject/obs-studio/issues/12520) — NVenc b-ref-mode always reports 0 in logfile

**Verdict: IMPLEMENT** (small, cosmetic logging fix)

The settings log is written in `init_encoder_base` from `enc->props.bframe_ref_mode`, which is the UI property. For H.264, that property is deliberately not exposed in the UI, so it is always 0 there. Custom options such as `useBFramesAsRef=…` are applied afterwards by `apply_user_args` (around nvenc.c:521, 640 and the AV1 equivalent), straight into `h264Config`/`hevcConfig`/`av1Config.useBFramesAsRef`. The log line therefore shows the value before the override. The "user opts:" line does show the raw string, but the `b-ref-mode` line is misleading.

Evidence:
- `plugins/obs-nvenc/nvenc.c:410`: logs `props.bframe_ref_mode`.
- `:453,557,666`: config set from props.
- `:521,640`: `apply_user_args` runs after the log.
- `plugins/obs-nvenc/nvenc-opts-parser.c:131,150,167`: `APPLY_INT_OPT(useBFramesAsRef, …)`.
- `plugins/obs-nvenc/nvenc-properties.c:214-216`: the property is hidden for H.264.

Slice plan (new-change, about 10 lines): in `init_encoder_h264`, `_hevc` and `_av1`, right after `apply_user_args` succeeds, if the codec config's `useBFramesAsRef != enc->props.bframe_ref_mode`, `info("b-ref-mode overridden by user opts: %d", (int)cfg->useBFramesAsRef)`. A cleaner alternative is to move the whole settings-log block after `apply_user_args`, but that is a bigger diff. Test: MSVC build of obs-nvenc. A runtime check needs an NVIDIA GPU, so it is UNTESTED unless one is available.

### [#12713](https://github.com/obsproject/obs-studio/issues/12713) — QSV encoder with MPEGTS muxer produces noncompliant h264 stream

**Verdict: CANNOT_VERIFY** (upstream labelled issue/confirmed, but no defect can be pinned down in code)

The SRT/RIST mpegts output passes encoder packets straight to FFmpeg's mpegts muxer, which requires Annex-B input with in-band SPS/PPS on the first keyframe. QSV's `parse_packet` copies the MSDK bitstream as-is and only rewrites NAL ref priority bits. `repeat_headers` (which turns on `RepeatPPS`) is never requested by the mpegts output. The report says it only happens with recent Intel media drivers and Windows 10/11. It is unclear whether the root cause is the newer runtime not emitting SPS in the first IDR, or whether OBS should prepend extradata on keyframes or request repeat_headers for mpegts. Settling that needs Intel hardware to inspect the bitstream. A plausible fix direction (setting `repeat_headers` from the mpegts output, as `obs-ffmpeg-mux.c:371-376` already does for HLS) is noted for a future session with QSV hardware.

Evidence:
- `plugins/obs-qsv11/obs-qsv11.c:996-1070`: `parse_packet`.
- `:460,638`: `repeat_headers` → `bRepeatHeaders`.
- `plugins/obs-qsv11/QSV_Encoder_Internal.cpp:298-301`: `RepeatPPS`.
- `plugins/obs-ffmpeg/obs-ffmpeg-mpegts.c:1240-1262`: raw packet passthrough. `:1318-1335`: header write from extradata.
- `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:366-377`: the HLS-only `repeat_headers` precedent.
