# Upstream triage — batch encoders-04

- Batch id: encoders-04 (area hint: encoders)
- Items: 12731, 12753, 12765, 12805, 12867, 12907, 12925, 12994, 13127, 13152, 13243, 13275, 13285, 13393, 13462, 13463, 13489, 13506, 13521
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; PR heads at `refs/upstream-pr/<N>`. The local git (2.33) has no `merge-tree --write-tree`, so applicability was checked with `git diff master...refs/upstream-pr/N | git apply --check`. No comment threads were fetched (no WebFetch used).

## Summary

| # | Kind | Verdict |
|---|---|---|
| 12731 | issue | IMPLEMENT (VAAPI tex encoder must reroute when NV12/P010 texture mix not active) |
| 12753 | issue | IMPLEMENT (via partial #12765: correct codec name in error message) |
| 12765 | PR | IMPLEMENT partial-pr (error-message commit only) |
| 12805 | issue | IMPLEMENT (QSV: send VideoSignalInfo on Linux too) |
| 12867 | PR | DEFER_LARGE (GoLive API schema change needs service-side agreement) |
| 12907 | PR | DEFER_LARGE (13k-line D3D12 backend) |
| 12925 | issue | OUT_OF_SCOPE (works as designed; obs-websocket feature request) |
| 12994 | issue | CANNOT_VERIFY (current code does not apply QP in HQVBR; driver behaviour) |
| 13127 | issue | CANNOT_VERIFY (AMD/Linux specific, needs log) |
| 13152 | PR | DEFER_LARGE (new video formats, 35 files) |
| 13243 | PR | IMPLEMENT partial-pr (obs-ffmpeg-mux `save(duration_usec)` only, rebased) |
| 13275 | issue | CANNOT_VERIFY (CPU-SKU specific QSV failure) |
| 13285 | PR | IMPLEMENT cherry-pick-pr (GPU encode thread ref-safety) |
| 13393 | PR | IMPLEMENT cherry-pick-pr (WHIP: allow AV1 B-frames) |
| 13462 | PR | IMPLEMENT cherry-pick-pr (pass FFmpeg options to decoder) |
| 13463 | PR | IMPLEMENT cherry-pick-pr (+small local-file gating tweak) |
| 13489 | issue | CANNOT_VERIFY (AMF SubmitInput failure on Vega 8 at 2560x1600, old OBS 30.2.2) |
| 13506 | issue | CANNOT_VERIFY (SRT listener re-bind failure; no defect identifiable in OBS code) |
| 13521 | PR | CANNOT_VERIFY (removes RIST crash guard; depends on newer librist in obs-deps) |

---

### [#12731](https://github.com/obsproject/obs-studio/issues/12731) — Segfault when recording with GPU texture encoder with color format other that NV12 or P010

**Verdict: IMPLEMENT**

Reasoning: The reporter's GDB analysis matches the code. `gpu_encode_available()` returns false when the mix is not using an NV12/P010 texture, so `add_connection()` routes the encoder to `start_raw_video(... receive_video ...)`, which eventually calls `encoder->info.encode` unconditionally. The VAAPI *texture* encoders only define `encode_texture2`, not `encode`. Every other texture encoder (QSV, NVENC, AMF) checks `obs_encoder_video_tex_active()` in `create` and reroutes to its system-memory fallback; the VAAPI one only checks scaling and surface creation, so with e.g. I444/BGRA output it is created as a texture encoder and then fed raw frames -> NULL call.

Evidence:
- `libobs/obs-encoder.c:219-225` — `gpu_encode_available()` requires `using_p010_tex || using_nv12_tex`.
- `libobs/obs-encoder.c:380-384` — falls back to `start_raw_video(..., receive_video, ...)`.
- `libobs/obs-encoder.c:1483` — `encoder->info.encode(...)` called without NULL check.
- `plugins/obs-ffmpeg/obs-ffmpeg-vaapi.c:547-574` — `vaapi_test_texencode()` / `vaapi_create_tex_internal()` do not check the texture format.
- `plugins/obs-ffmpeg/obs-ffmpeg-vaapi.c:1222-1229` — `h264_vaapi_encoder_tex_info` has `encode_texture2` but no `encode` (same for AV1 1254, HEVC 1287).
- Comparison: `plugins/obs-qsv11/obs-qsv11.c:852-859`, `plugins/obs-nvenc/nvenc.c:960-961`, `plugins/obs-ffmpeg/texture-amf.cpp:1192-1196` all reroute when `obs_encoder_video_tex_active()` is false.

Related: none in batch.

Slice plan:
- `plugins/obs-ffmpeg/obs-ffmpeg-vaapi.c`: at the top of `vaapi_create_tex_internal()`, if `!obs_encoder_video_tex_active(encoder, VIDEO_FORMAT_NV12) && !obs_encoder_video_tex_active(encoder, VIDEO_FORMAT_P010)`, log and `return obs_encoder_create_rerouted(encoder, fallback);` before creating the VAAPI context (~6 lines).
- Optional defensive hardening (not required): none; keep the slice minimal.
- Platform: Linux only (file is built only on Linux). Testing: UNTESTED on this Windows box beyond code review.

---

### [#12753](https://github.com/obsproject/obs-studio/issues/12753) — FFmpeg Opus audio codec supports up to 256 kbps, not 320.

**Verdict: IMPLEMENT** (slice = partial of PR #12765)

Reasoning: The confusing part of the report, "Failed to open AAC codec: Invalid Argument" while using Opus, is a definite defect: the message is hard-coded to "AAC" for every FFmpeg audio encoder. The bitrate-ceiling half of the report could not be confirmed from code here. FFmpeg's libopus wrapper limits bitrate per channel, so a flat 256 kbps cap could be wrong for stereo or surround. Also, the frontend does not read `ffmpeg_opus` properties for its bitrate list: it reuses the `ffmpeg_aac` list as the Opus fallback. A properties-only cap like the one in #12765 would therefore not change what the UI offers. So only the error-message fix is implemented now. A correct bitrate cap needs a frontend change plus a check against the FFmpeg version actually shipped in obs-deps. That is deferred.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-audio-encoders.c:131,134` — hard-coded "Failed to open AAC codec".
- `plugins/obs-ffmpeg/obs-ffmpeg-audio-encoders.c:416` — shared `enc_properties` offers 64-1024 kbps for all lossy FFmpeg audio encoders including Opus (`:486`).
- `frontend/utility/audio-encoders.cpp:137-160` — comment "ffmpeg_aac and ffmpeg_opus have the same properties"; `ffmpeg_opus` is skipped and AAC's list is used as the fallback.
- `frontend/utility/audio-encoders.cpp:269-281` — simple-mode Opus map populated from the AAC fallback list.

Related: #12765.

Slice plan: same as #12765 partial (commit `ab602eaa5`, 2 lines). Platform: cross-platform. Test: MSVC build of `obs-ffmpeg`; runtime check by forcing an invalid Opus bitrate and confirming the log says "Failed to open libopus codec".

---

### [#12765](https://github.com/obsproject/obs-studio/pull/12765) — obs-ffmpeg: Fix Opus encoder bitrate and errors

**Verdict: IMPLEMENT (partial-pr)**

Reasoning: The PR has two real commits plus merge commits. `ab602eaa5` ("Fix hardcoded error message in audio encoders") replaces "AAC" with `enc->type` in the error and log messages. It is correct, tiny, and applies cleanly (`git apply --check` OK). `a4c5ce9f7` adds an `opus_properties()` with a 64-256 range. It is left out for two reasons. First, the frontend never reads Opus properties for its bitrate lists (see #12753 evidence), so the cap would not change the UI. Second, the FFmpeg libopus limit scales with channel count, so a fixed 256 cap could wrongly restrict stereo and surround.

Evidence:
- `git diff master...refs/upstream-pr/12765` — 1 file, +15/-3; applies.
- `plugins/obs-ffmpeg/obs-ffmpeg-audio-encoders.c:131,134` (target lines).
- `plugins/obs-ffmpeg/obs-ffmpeg-audio-encoders.c:183-187` — `enc->type` holds the actual FFmpeg encoder name (`libopus`/`opus`/`aac`/...), so it is valid in the message.

Related: #12753.

Slice plan: `git cherry-pick ab602eaa5` (author TheBitBrine, preserved). Files: `plugins/obs-ffmpeg/obs-ffmpeg-audio-encoders.c`. ~4 changed lines. Test: MSVC build of obs-ffmpeg.

---

### [#12805](https://github.com/obsproject/obs-studio/issues/12805) — HDR video output is broken with QuickSync HEVC encoder

**Verdict: IMPLEMENT** (metadata part)

Reasoning: The reporter says the HDR stream is tagged as SDR on Linux. The QSV plugin computes the correct BT.2020/PQ values (`ColourPrimaries=9`, `TransferCharacteristics=16`, `MatrixCoefficients=9`). But the `mfxExtVideoSignalInfo` extension buffer that carries them to the encoder is only attached under `#if defined(_WIN32)`, and a TODO there asks whether VAAPI needs it too. On Linux the bitstream therefore has no colour description, which matches "metadata is incorrectly SDR". The mastering-display and CLL buffers are already sent on all platforms, so only the VUI colour description is missing. The green image may be a separate issue in the P010 texture path. It cannot be verified here and is out of this slice.

Evidence:
- `plugins/obs-qsv11/obs-qsv11.c:513-548` — colour values computed for 2100 PQ/HLG on all platforms.
- `plugins/obs-qsv11/QSV_Encoder_Internal.cpp:379-391` — `m_ExtVideoSignalInfo` only pushed on `_WIN32` ("TODO: Ask about this one on VAAPI too").
- `plugins/obs-qsv11/QSV_Encoder_Internal.cpp:407-432` — HDR SEI buffers are pushed unconditionally.
- `plugins/obs-qsv11/QSV_Encoder_Internal.h:122` — member declared unconditionally, so removing the guard compiles.

Related: none.

Slice plan: remove the `#if defined(_WIN32)` / `#endif` (and stale TODO) around the VideoSignalInfo block in `plugins/obs-qsv11/QSV_Encoder_Internal.cpp` (~3 lines). Platform: Linux behaviour change. Windows is unaffected, so building is the only test possible here. Linux runtime is UNTESTED (needs an Intel GPU with intel-media-driver, then checking with ffprobe that color_primaries=bt2020 and color_transfer=smpte2084).

---

### [#12867](https://github.com/obsproject/obs-studio/pull/12867) — frontend: Add supported_encoders to GoLiveAPI

**Verdict: DEFER_LARGE**

Reasoning: The code change is tiny (+5 lines, applies). It adds a new field to the JSON body that OBS POSTs to the Enhanced Broadcasting / GoLive config endpoint (Twitch/IVS and compatible servers). That request schema is a contract with a partner service. Adding a list of every installed encoder ID (including plugin encoders) changes what OBS discloses to the service, and the service has to agree to it. The fork's triage rules exclude changes that need service or partner agreement. The motivation, custom multitrack servers, is reasonable, but the decision is not ours to make in a small slice.

Evidence:
- `frontend/utility/GoLiveAPI_PostData.cpp:28-39` — currently only `supported_codecs` (h264/h265/av1) is sent.
- `frontend/utility/models/multitrack-video.hpp:96-100` — `Client` model serialised to the service.
- `git diff master...refs/upstream-pr/12867 --stat` — 2 files, +5/-1; applies.

Related: none.

---

### [#12907](https://github.com/obsproject/obs-studio/pull/12907) — libobs-d3d12: Added D3D12 rendering backend and NVIDIA D3D12 texture encoding

**Verdict: DEFER_LARGE**

Reasoning: This is a whole new graphics backend plus an NVENC D3D12 path: 58 files and about 13,000 added lines. That is an architecture change that needs maintainer design review, as the PR text itself notes about sharing code with D3D11. No small slice exists.

Evidence:
- `git diff master...refs/upstream-pr/12907 --stat` — 58 files, +13057/-40 (new `libobs-d3d12`, `plugins/obs-nvenc/nvenc-d3d12.c` 558 lines).

Related: #13152 (also touches NVENC texture paths).

---

### [#12925](https://github.com/obsproject/obs-studio/issues/12925) — If Output type Advanced cannot set Bitrate via (websocket) commands

**Verdict: OUT_OF_SCOPE**

Reasoning: This works as designed. In Advanced output mode the streaming encoder's settings live in `streamEncoder.json`, which is per-encoder property data and not `basic.ini`. `AdvOut/FFVBitrate` is the video bitrate for the *Custom Output (FFmpeg)* recording type, not the stream encoder. Writing it via `SetProfileParameter` therefore correctly has no effect on the stream. Exposing encoder JSON settings through a websocket request is a feature request for obs-websocket, as the reporter half-suggests, not a bug in OBS.

Evidence:
- `frontend/settings/OBSBasicSettings.cpp:2127` — `FFVBitrate` loaded only for the FFmpeg-output widgets (`advOutFFVBitrate`).
- `frontend/settings/OBSBasicSettings.cpp:1961,3601` — Advanced stream encoder properties read/written from `streamEncoder.json`.
- `frontend/utility/AdvancedOutput.cpp:78,208` — stream encoder settings sourced from `streamEncoder.json`.

Related: none.

---

### [#12994](https://github.com/obsproject/obs-studio/issues/12994) — AMD AMF HQVBR cannot be used in any capacity

**Verdict: CANNOT_VERIFY**

Reasoning: The reporter suspects QP values leak into HQVBR. In current master, `amf_*_update_data()` sets QP_I/P/B and QVBR_QUALITY_LEVEL **only** for CQP and QVBR. For HQVBR it sets TARGET_BITRATE, PEAK_BITRATE (1.5x) and VBV_BUFFER_SIZE (1.5x). Each encoder start builds a fresh AMF component in `amf_avc_init`, so stale QP from an earlier CQP session cannot persist. The reporter also says they are no longer sure. Output reaching 100-200 Mb/s with a 9 Mb/s peak and VBV set points to AMF driver rate-control behaviour, which cannot be checked without AMD hardware.

Evidence:
- `plugins/obs-ffmpeg/texture-amf.cpp:1388-1422` — AVC: QP set only in the CQP/QVBR `else` branch; HQVBR gets peak/VBV = 1.5x bitrate.
- `plugins/obs-ffmpeg/texture-amf.cpp:1871-1902` — same for HEVC; `:2300-2330` for AV1.
- `plugins/obs-ffmpeg/texture-amf.cpp:1558-1606` — `amf_avc_init` applies rate control fresh at init.

Related: #13489 (other AMF issue).

---

### [#13127](https://github.com/obsproject/obs-studio/issues/13127) — Twitch Enhanced Streaming + Recording tab's Use Stream Encoder broken on AMD hardware

**Verdict: CANNOT_VERIFY**

Reasoning: With "Use Stream Encoder", recording reuses the `videoStreaming` encoder created from `AdvOut/Encoder` and `streamEncoder.json`. It does not use one of the multitrack (Enhanced Broadcasting) encoders, so the "use the highest multitrack rendition" expectation is not how the code is designed. The failure on a Linux AMD machine is probably a stale or unavailable `AdvOut/Encoder` value, because the stream encoder UI is hidden in Enhanced Broadcasting mode. Confirming that needs the reporter's log and profile, and a CachyOS + AMD repro. No defect could be pinned to specific lines.

Evidence:
- `frontend/utility/AdvancedOutput.cpp:65-76` — `useStreamEncoder` when `RecEncoder == "none"`.
- `frontend/utility/AdvancedOutput.cpp:798-810` — start recording updates/uses the stream encoder, not multitrack encoders.

Related: none.

---

### [#13152](https://github.com/obsproject/obs-studio/pull/13152) — NVENC & QSV: RGB/YUV444 Texture Encoding

**Verdict: DEFER_LARGE**

Reasoning: The PR adds new core video formats (Y410, GBR10) to libobs, graphics backends, the frontend and two encoder plugins: 35 files, +946/-216. A new libobs video format is an API and design decision, and it is Windows/hardware-specific (needs RTX 50-series or newer Intel parts for parts of the matrix). No small self-contained slice exists.

Evidence:
- `git diff master...refs/upstream-pr/13152 --stat` — 35 files, +946/-216 (libobs formats, libobs-opengl, frontend, obs-nvenc, obs-qsv11).

Related: #12907.

---

### [#13243](https://github.com/obsproject/obs-studio/pull/13243) — obs-ffmpeg: Add procedure parameter to save portion of replay buffer

**Verdict: IMPLEMENT (partial-pr)**

Reasoning: The useful core is an optional `duration_usec` argument on the replay buffer's `save` proc. When it is set, `replay_buffer_save()` starts muxing at the last video keyframe at or before `last_dts - duration`. Saving a shorter clip is a popular idea-board request, and doing it in memory avoids writing the whole buffer to disk and trimming it afterwards. It is backward compatible: a missing calldata value means 0, which saves the whole buffer. The PR does not apply as-is, because master moved hotkey registration to the frontend (`eee6a81dd`), so `replay_buffer_hotkey` no longer exists in the mux. The PR also adds a new public `obs_frontend_replay_buffer_save_duration()` API with a vtable change. That is a public-API design decision and is dropped. Plugins can call the proc handler directly.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:917` — current `save_replay_proc` ignores calldata.
- `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:948` — `proc_handler_add(ph, "void save()", ...)`.
- `git diff master...refs/upstream-pr/13243 | git apply --check` — fails on `obs-ffmpeg-mux.c:914` and `frontend/OBSStudioAPI.cpp:298`.
- Commit `eee6a81dd` "frontend: Register the replay buffer save hotkey in the frontend" explains the conflict.

Related: none.

Slice plan (manual rebase of the mux part, author attribution to the PR author kept via `Co-authored-by`/original author):
- `plugins/obs-ffmpeg/obs-ffmpeg-mux.h`: add `int64_t save_duration_usec;` next to `save_ts`.
- `plugins/obs-ffmpeg/obs-ffmpeg-mux.c`: `save_replay_proc` reads `calldata_get_int(cd, "duration_usec", ...)` and stores it with `save_ts`. Change the proc signature to `"void save(int duration_usec)"`. Reset the value in `replay_buffer_clear`/start. In `replay_buffer_save()`, compute `cutoff_keyframe_index` as in the PR and start the reorder loop there. Also update `docs/sphinx` if the proc is documented.
- ~70 changed lines. Platform: cross-platform. Test: MSVC build of obs-ffmpeg. Runtime: start the replay buffer and call `save` through a small script or the proc handler with `duration_usec`, then check the file duration. The proc path is probably UNTESTED at runtime unless a script is available.

---

### [#13275](https://github.com/obsproject/obs-studio/issues/13275) — The QuickSync encoder fails on certain processors

**Verdict: CANNOT_VERIFY**

Reasoning: QSV HEVC with P010 fails on an Ultra 7 115U but works on a 115H. That is CPU-SKU, driver or media-engine specific: U-series parts can have reduced media capabilities. The body has no error details beyond a log link, and the code path is identical for both CPUs. There is nothing actionable in the code without the hardware.

Evidence:
- `plugins/obs-qsv11/obs-qsv11.c:497-503` — P010 forces HEVC Main10 on all hardware; whether it is supported is decided by the driver.

Related: #12805.

---

### [#13285](https://github.com/obsproject/obs-studio/pull/13285) — libobs: Fix GPU encode thread race conditions

**Verdict: IMPLEMENT (cherry-pick-pr, squashed)**

Reasoning: `video->gpu_encoders` stores raw `obs_encoder_t *` without owning a reference. `obs_encoder_destroy()` does not remove the encoder from that array, so an encoder whose last reference is dropped while active leaves a dangling pointer. The GPU thread then dereferences it in `obs_encoder_get_ref()`. Separately, the thread reads `encoder->paired_encoders` without `init_mutex`, while `obs_encoder_shutdown()` frees that array under `init_mutex`. The PR fixes both:
- it stores weak references in `gpu_encoders`, taken in `start_gpu_encode` and released in `stop_gpu_encode` after `gpu_encode_inactive` is waited on;
- it snapshots and addrefs `paired_encoders` under a `trylock` on `init_mutex`, which avoids the deadlock with `obs_encoder_stop()`.

The contributor reproduced the crash with several outputs stopping at once. The diff is 3 files, +60/-15, and applies cleanly (ignoring merge commits).

Evidence:
- `libobs/obs-video-gpu-encode.c:69-73` — raw pointer `video->gpu_encoders.array[i]` passed to `obs_encoder_get_ref`.
- `libobs/obs-video-gpu-encode.c:86-87,103-116` — unlocked access to `paired_encoders`.
- `libobs/obs-encoder.c:766-785` — `obs_encoder_shutdown` frees `paired_encoders` under `init_mutex`.
- `libobs/obs-encoder.c:462-490` — `obs_encoder_destroy` does not stop GPU encode or erase from `gpu_encoders`.
- `libobs/obs-internal.h:362` (in PR) — `DARRAY(obs_encoder_t *) gpu_encoders`.

Related: none.

Slice plan: squash non-merge commits of `refs/upstream-pr/13285` (author CStreible) onto master. Files: `libobs/obs-internal.h`, `libobs/obs-video-gpu-encode.c`, `libobs/obs.c`. ~75 changed lines. Platform: cross-platform. Test: MSVC build of libobs and the cmocka tests in `test/cmocka`. The race itself needs several simultaneous GPU-encoded outputs to stop at once, which this box can attempt only with NVENC/QSV/AMF hardware. Otherwise mark it UNTESTED. Review note: the trylock path skips the audio-wait check for one frame while `init_mutex` is busy. That only applies before the first packet arrives (`!first_received`), so the effect is limited.

---

### [#13393](https://github.com/obsproject/obs-studio/pull/13393) — obs-webrtc: Allow B-frames for AV1

**Verdict: IMPLEMENT (cherry-pick-pr)**

Reasoning: The WHIP service forces `bf=0` for every codec because browsers handle H.264/HEVC B-frames poorly in WebRTC. AV1 has no frame-reordering problem at the temporal-unit level. Hidden frames are shown later in display order, so it is not affected. The service API does not give the service the codec, so the PR has the frontend add a `codec` key to the video settings before `obs_service_apply_encoder_settings`. No encoder plugin reads a `codec` settings key, so this is harmless. Call sites that do not set it (settings dialog, auto-config) keep the current safe `bf=0` behaviour, because a missing key returns "". It is 3 files, +7/-1, and applies.

Evidence:
- `plugins/obs-webrtc/whip-service.cpp:27-34` — unconditional `obs_data_set_int(video_settings, "bf", 0)`.
- `plugins/obs-webrtc/whip-output.cpp:128-133` — video RTP timing is DTS-delta based (monotonic, so it suits AV1 TUs).
- `frontend/utility/AdvancedOutput.cpp:211-214`, `frontend/utility/SimpleOutput.cpp:338` — the two call sites the PR touches.
- grep for `"codec"` in encoder plugins (`obs-nvenc`, `obs-qsv11`, `obs-x264`, `obs-ffmpeg`, etc.) — no collision.

Related: none.

Slice plan: cherry-pick `a0134d919` (author Bleuzen). Files: `frontend/utility/AdvancedOutput.cpp`, `frontend/utility/SimpleOutput.cpp`, `plugins/obs-webrtc/whip-service.cpp`. ~8 lines. Platform: cross-platform. Test: MSVC build of frontend and obs-webrtc. Live WHIP AV1 playback in a browser is UNTESTED unless a WHIP endpoint is available.

---

### [#13462](https://github.com/obsproject/obs-studio/pull/13462) — shared/media-playback: make the decoder accept custom FFmpeg options

**Verdict: IMPLEMENT (cherry-pick-pr)**

Reasoning: The Media Source "FFmpeg Options" string is parsed only for `avformat_open_input`. `mp_open_codec()` calls `avcodec_open2(c, d->codec, NULL)`, so codec-level options such as `flags=low_delay` are silently ignored. `ffmpeg`/`ffplay` apply the same options dictionary to both demuxer and decoder. The PR parses the same string into a dictionary for `avcodec_open2` and frees it. Unknown keys are simply left in the dictionary by FFmpeg, so passing demuxer options to the decoder is harmless. It is 1 file, +10/-1, and applies.

Evidence:
- `shared/media-playback/media-playback/media.c:679-683` — options parsed for the format context only.
- `shared/media-playback/media-playback/decode.c:92` (pre-PR) — `avcodec_open2(c, d->codec, NULL)`.
- `shared/media-playback/media-playback/decode.c:142` — `d->m` is set, so `d->m->ffmpeg_options` is reachable.

Related: #13463 (same author, same latency goal).

Slice plan: cherry-pick `2635de400` (author RossWang). File: `shared/media-playback/media-playback/decode.c`. Test: MSVC build of obs-ffmpeg (media-playback is linked into it). Optional runtime check: Media Source with `flags=low_delay` and a debug log of the codec flags.

---

### [#13463](https://github.com/obsproject/obs-studio/pull/13463) — obs-ffmpeg-source: Add OBS Source Buffer settings

**Verdict: IMPLEMENT (cherry-pick-pr, plus a one-line tweak)**

Reasoning: Async sources buffer frames in libobs unless they opt out with `obs_source_set_async_unbuffered` / `_decoupled`. Every other live-input source already exposes this choice: dshow, v4l2, decklink, AJA, mac-avcapture. The Media Source does not, so network inputs (UDP, SRT, RTMP) get extra latency. The PR adds a 3-way list (Buffered / Unbuffered / Unbuffered+Decoupled), shown only for non-local inputs, and calls the existing APIs. It is 2 files, +27/-1, applies, and needs no new API. Tweak: apply unbuffered/decoupled only when `!is_local_file`. Otherwise a value set earlier stays in effect if the user later switches the source to a local file, where the property is hidden.

Evidence:
- `plugins/win-dshow/win-dshow.cpp:873-874`, `plugins/linux-v4l2/v4l2-input.c:982`, `plugins/decklink/decklink-source.cpp:14,27` — precedent for exposing buffering.
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c` — no call to `obs_source_set_async_unbuffered` today.

Related: #13462, #13506, #13521.

Slice plan: cherry-pick `1ca50a8ce` (author RossWang) plus a follow-up local commit gating on `!s->is_local_file`. Files: `plugins/obs-ffmpeg/obs-ffmpeg-source.c`, `plugins/obs-ffmpeg/data/locale/en-US.ini`. ~30 lines. Test: MSVC build. Runtime: add a Media Source with a `udp://` input, toggle the option, and check the log (`playback_buffer` line in `dump_source_info`).

---

### [#13489](https://github.com/obsproject/obs-studio/issues/13489) — AMD hardware encoding encountered the error "amf_encode_tex: SubmitInput failed: AMF_FAIL"

**Verdict: CANNOT_VERIFY**

Reasoning: The reporter is on OBS 30.2.2, which is very old. AMF SubmitInput returns AMF_FAIL at 2560x1600 on Radeon Vega 8 integrated graphics and works at 1920x1080. That depends on the driver and the hardware's encode limits. OBS passes the AMF error through and has no resolution-specific logic to fix. A repro needs the hardware and a current OBS and driver.

Evidence:
- `plugins/obs-ffmpeg/texture-amf.cpp:1476-1500` — level selection by luma size; nothing resolution-specific that would fail SubmitInput.

Related: #12994.

---

### [#13506](https://github.com/obsproject/obs-studio/issues/13506) — SRT Media Source (ffmpeg_source) cannot recreate listener socket on reconnect while recording or streaming is active

**Verdict: CANNOT_VERIFY**

Reasoning: The report is detailed: re-binding the listener fails only while an output is active. However, the SRT socket is created and torn down entirely inside FFmpeg's libsrt protocol (`avformat_open_input` / `avformat_close_input` in media-playback), and the Media Source's reconnect logic does not depend on output state. No path in OBS ties output activity to the media source's socket lifetime. Candidate causes include libsrt global startup/cleanup reference counting shared with the SRT output in `obs-ffmpeg-mpegts`, or port/linger behaviour. Either one needs a repro with SRT tooling. No defect can be pointed to.

Evidence:
- `shared/media-playback/media-playback/media.c:670-700` — open path; socket handling delegated to FFmpeg.

Related: #13463, #13521.

---

### [#13521](https://github.com/obsproject/obs-studio/pull/13521) — plugins/obs-ffmpeg: remove restart guard for RIST

**Verdict: CANNOT_VERIFY**

Reasoning: The guard forces `restart_on_activate=false` for `rist://` inputs. It was added deliberately in `5b0c09a9f` (2022) to fix crashes when a RIST Media Source was disabled and re-enabled repeatedly. The PR says that removing it is only safe with a newer librist and that "librist in obs-deps need to be updated accordingly". Whether the librist shipped by the current obs-deps (2026-10-23 release) fixes the crash cannot be checked from this repo. Removing the guard without that guarantee would bring back a known crash. The diff is small and applies, so revisit once obs-deps librist is confirmed fixed.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:389,460-462` — RIST guard.
- `git show 5b0c09a9f` — "disable restart on activate for srt & rist ... fixes crashes ... disabling / enabling ... Media source with a rist URL".
- `cmake/finders/FindLibrist.cmake` — librist comes from deps; version not pinned in this repo.

Related: #13463, #13506.
