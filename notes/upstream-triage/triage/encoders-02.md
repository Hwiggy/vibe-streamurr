# Upstream triage — batch encoders-02

- Batch id: encoders-02 (area hint: encoders)
- Items: 9890, 9946, 9959, 10095, 10134, 10181, 10193, 10213, 10364, 10428, 10463, 10553, 10594, 10648, 10651, 10696, 10744, 10785, 10955
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; no comment threads read (no WebFetch used). Code read on master. PR heads read from `refs/upstream-pr/<N>`. The local git (2.33) does not support `merge-tree --write-tree`, so whether a PR still applies was checked with `git diff master...refs/upstream-pr/N | git apply --check` (a check only; the index and working tree were confirmed unchanged afterwards).

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 9890 | issue | CANNOT_VERIFY |
| 9946 | issue | IMPLEMENT |
| 9959 | issue | IMPLEMENT |
| 10095 | PR | IMPLEMENT (partial-pr / manual port) |
| 10134 | issue | IMPLEMENT |
| 10181 | issue | ALREADY_ADDRESSED |
| 10193 | issue | CANNOT_VERIFY |
| 10213 | issue | DEFER_LARGE |
| 10364 | issue | IMPLEMENT |
| 10428 | issue | OUT_OF_SCOPE |
| 10463 | issue | IMPLEMENT (AOM only) |
| 10553 | issue | OUT_OF_SCOPE (works as designed) |
| 10594 | issue | OUT_OF_SCOPE |
| 10648 | PR | IMPLEMENT (cherry-pick) |
| 10651 | issue | IMPLEMENT |
| 10696 | issue | CANNOT_VERIFY |
| 10744 | issue | IMPLEMENT |
| 10785 | PR | DEFER_LARGE |
| 10955 | issue | IMPLEMENT |

---

### [#9890](https://github.com/obsproject/obs-studio/issues/9890) — Active output (e.g. virtual cam or NDI) combined with NVENC recording causes high frame render times

**Verdict: CANNOT_VERIFY**

The report says that running a raw output (virtual camera or NDI) at the same time as an NVENC texture encoder makes the render time swing wildly. This started in 30.0 and did not happen in 29.1. Both paths do exist in libobs. The GPU encoder path copies frames into shared NV12/P010 textures, and the raw path stages frames to the CPU. But nothing in the code shows a defect that explains the jumps. It is a measurement on one GPU and driver. It needs profiling on NVIDIA hardware to find whether the cost is the staging map, the keyed mutex, or driver scheduling.

Evidence:
- `libobs/obs-video-gpu-encode.c:24-222` — GPU encode thread. It takes keyed-mutex textures from `gpu_encoder_queue`.
- `libobs/obs-video-gpu-encode.c:236-275` — shared NV12/P010 texture allocation (`GS_SHARED_KM_TEX`).
- `libobs/media-io/video-io.c:626-658` — the raw and texture encoder paths are counted separately. Both can be active at once.

Related: none.

---

### [#9946](https://github.com/obsproject/obs-studio/issues/9946) — Deadlock if encounter encoder error

**Verdict: IMPLEMENT**

I confirmed the defect in the code. When a texture encoder fails, the GPU encode thread calls `send_off_encoder_packet(..., success=false)`. That calls `full_stop()`, then `remove_connection()`, then `stop_gpu_encode()`. `stop_gpu_encode()` does `os_event_wait(video->gpu_encode_inactive)`. The same GPU encode thread reset that manual event at the top of its loop iteration and only signals it after the encoder loop, so the thread waits on itself forever. When this was the last GPU encoder, `stop_gpu_encode` would also try to `pthread_join` the GPU encode thread from inside itself. A second problem: `remove_connection` can run twice, once from `full_stop` and once from the output's `end_data_capture_thread` through `obs_encoder_stop`. Each run decrements `gpu_encoder_active` and the texture-encoder refcount, so the counts go wrong.

Evidence:
- `libobs/obs-video-gpu-encode.c:56` — `os_event_reset(video->gpu_encode_inactive)` at the start of each iteration.
- `libobs/obs-video-gpu-encode.c:190` — `send_off_encoder_packet(encoder, success, received, &pkt)` is called inside the loop, on the GPU encode thread.
- `libobs/obs-video-gpu-encode.c:216` — the event is only signalled after the loop.
- `libobs/obs-encoder.c:1373-1397` — `full_stop()` calls `remove_connection(encoder, false)` synchronously, and `send_off_encoder_packet` calls `full_stop` when `!success`.
- `libobs/obs-encoder.c:413-419` — `remove_connection` calls `stop_gpu_encode()` for texture encoders.
- `libobs/obs.c:3218-3241` — `stop_gpu_encode()` waits on `gpu_encode_inactive` and may call `stop_gpu_encoding_thread()`, which joins the GPU thread (`libobs/obs-video-gpu-encode.c:278-286`).

Related: none in this batch.

Slice plan:
- `libobs/obs-video-gpu-encode.c`: when `success == false`, do not call `send_off_encoder_packet` inline. Log the error, set a per-encoder atomic "failing" flag so later frames skip that encoder (no repeated queuing), take a ref (`obs_encoder_get_ref`), and hand `full_stop` to a different thread with `obs_queue_task(OBS_TASK_DESTROY, ..., false)`. The task calls `full_stop()` and releases the ref.
- `libobs/obs-encoder.c`: expose a small internal `obs_encoder_full_stop_task` (or make `full_stop` reachable from `obs-internal.h`). Make `remove_connection` return early when the encoder is no longer active, so the deferred `full_stop` and `end_data_capture_thread` cannot both decrement the GPU counters. Clear the "failing" flag in `add_connection`.
- Estimated size: about 40 lines in 3 files (`obs-video-gpu-encode.c`, `obs-encoder.c`, `obs-internal.h`).
- Testing: build `libobs` with MSVC. Reproducing at runtime needs a texture encoder that fails. Option: temporarily force `success = false` in a local debug build, start a recording, and confirm the encoder error dialog appears without a hang. Otherwise mark it UNTESTED.

---

### [#9959](https://github.com/obsproject/obs-studio/issues/9959) — x264 does not respect "Ignore streaming service setting recommendations" for buffer size, if a custom buffer size is used

**Verdict: IMPLEMENT**

I confirmed the defect. In Advanced output, `UpdateStreamSettings()` saves the user's `bitrate` and `keyint_sec`, then calls `obs_service_apply_encoder_settings()`. The rtmp-services plugin clamps both `bitrate` **and** `buffer_size` to the service maximum. When the user ignores the recommendations, the frontend restores only `bitrate`. `buffer_size` stays at the clamped value (6000 for Twitch), and x264 uses it when `use_bufsize` is enabled.

Evidence:
- `plugins/rtmp-services/rtmp-common.c:750-753` — `obs_data_set_int(settings, "buffer_size", max_bitrate)` alongside the bitrate clamp.
- `frontend/utility/AdvancedOutput.cpp:211-232` — saves and restores only `bitrate`, not `buffer_size`.
- `plugins/obs-x264/obs-x264.c:364-417` — `buffer_size` becomes `i_vbv_buffer_size` when `use_bufsize` is set.

Related: none.

Slice plan:
- `frontend/utility/AdvancedOutput.cpp` `UpdateStreamSettings()`: read `int buffer_size = obs_data_get_int(settings, "buffer_size")` before applying the service settings. In the `!enforceBitrate` branch, restore it with `obs_data_set_int(settings, "buffer_size", buffer_size)` next to the bitrate restore. About 3 lines.
- Simple mode does not expose `buffer_size`, so it needs no change.
- Testing: MSVC build of the frontend. Run it with Twitch, ignore recommendations, x264 with a custom buffer of 12000, and check that the `buffer size:` x264 log line shows 12000. That is a manual runtime check. Otherwise mark it UNTESTED.

---

### [#10095](https://github.com/obsproject/obs-studio/pull/10095) — obs-ffmpeg: Allow overwrite file control for replay buffer

**Verdict: IMPLEMENT (partial-pr: manual port of the single commit)**

The PR is still relevant. On master, the replay buffer always calls `generate_filename(stream, &stream->path, true)` and ignores the "Overwrite if file exists" setting. Neither frontend passes `allow_overwrite` to the replay buffer output. The PR has one commit, b7aa9cb01, and 6 lines of change. It makes `generate_filename` read `allow_overwrite` from the output settings, and sets that key in Simple and Advanced `StartReplayBuffer` / `ConfigureRecording`. The frontend hunks apply cleanly. The `obs-ffmpeg-mux.c` hunk fails only because of context drift: the clang-format reflow and moved line numbers (`replay_buffer_save` is now at line 1170).

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:574` — `generate_filename(..., bool overwrite)`.
- `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:1170` — replay buffer save hard-codes `true`.
- `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:403,738` — `allow_overwrite` is only read at start, for split files.
- `frontend/utility/AdvancedOutput.cpp:864-900` — `StartReplayBuffer` reads `overwriteIfExists` but never puts it into the replay buffer settings.
- `frontend/utility/SimpleOutput.cpp:834` — reads `overwriteIfExists`. The replay buffer settings block does not set it.
- `git diff master...refs/upstream-pr/10095 | git apply --check` → `obs-ffmpeg-mux.c` hunk fails on context only.

Related: upstream #4227 (the original issue), and the earlier reverted attempt #4327 / f295bd9, which the PR says it avoids.

Slice plan:
- Port b7aa9cb01 by hand. Keep authorship (Penwy) in the commit trailer, and note "ported, conflict resolved". Change `generate_filename` to read `allow_overwrite` from settings. Update its two callers. Drop the now-unused `stream->allow_overwrite` assignment, or leave it. Add `obs_data_set_bool(settings, "allow_overwrite", overwriteIfExists)` to both frontends' replay buffer settings.
- About 8 lines in 3 files.
- Testing: MSVC build of `obs-ffmpeg` and the frontend. At runtime, save the replay buffer twice in the same second with overwrite off and check that a " (2)"-style name is generated (`find_best_filename`). Otherwise mark it UNTESTED.

---

### [#10134](https://github.com/obsproject/obs-studio/issues/10134) — FFMPEG warnings flooding OBS log

**Verdict: IMPLEMENT**

The obs-ffmpeg module installs a global `av_log` callback that forwards every FFmpeg message to `blog()`. It never suppresses repeated messages. FFmpeg's default callback does this with `AV_LOG_SKIP_REPEATED`, but that only applies inside `av_log_default_callback`. A Media Source with a broken HLS input can therefore write the same `inflate return value: -3` warning without limit. The reporter's log reached 286 GB. Log flooding that fills the disk is in scope, and the fix fits in one callback.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-logging.c:54-101` — `ffmpeg_log_callback` formats each line and calls `blog(obs_level, "[ffmpeg] %s", str)` with no repeat check.
- `plugins/obs-ffmpeg/obs-ffmpeg-logging.c:105-114` — installed process-wide with `av_log_set_callback`.
- No repeat suppression exists in `libobs/util/base.c` or the frontend log handler (grep for "repeat").

Related: none.

Slice plan:
- In `ffmpeg_log_callback`, keep a static `last_line[1024]` plus `repeat_count`, guarded by `log_contexts_mutex`, or a separate mutex. If the finished line equals `last_line`, increment the count and return without logging. When a different line arrives and the count is above 0, first log `"[ffmpeg] Last message repeated %d times"` (the same idea as FFmpeg's), then log the new line. Optionally also flush the count every N repeats (for example 10000) so a long flood stays visible.
- About 25 lines in one file.
- Testing: MSVC build of `obs-ffmpeg`. A unit test is not practical, because the callback is static inside a module. Runtime check: a Media Source pointed at a corrupt stream. Otherwise mark it UNTESTED.

---

### [#10181](https://github.com/obsproject/obs-studio/issues/10181) — NVENC settings show "CQ Level" option while setting CQP

**Verdict: ALREADY_ADDRESSED**

Since the native `obs-nvenc` plugin replaced the old one (911a49070), the `cqp` property is labelled with the `CQP` string ("Constant QP") on every platform, including Linux. The `CQLevel` string is no longer used by obs-nvenc. The old FFmpeg-NVENC path that still uses `NVENC.CQLevel` is only built with `ENABLE_FFMPEG_NVENC`, which defaults to OFF. The AMF encoder also reuses `NVENC.CQLevel`, but that is not what this issue is about.

Evidence:
- `plugins/obs-nvenc/nvenc-properties.c:137` — `obs_properties_add_int(props, "cqp", obs_module_text("CQP"), ...)`.
- `plugins/obs-nvenc/data/locale/en-US.ini:5` — `CQP="Constant QP"`.
- `plugins/obs-ffmpeg/CMakeLists.txt:7` — `ENABLE_FFMPEG_NVENC` is OFF by default. The `NVENC.CQLevel` label is only in `obs-ffmpeg-nvenc.c:482`.

Related: upstream #10133 (mentioned in the report).

---

### [#10193](https://github.com/obsproject/obs-studio/issues/10193) — AMD HW AV1 cannot use P010 colour format with QVBR, HQVBR, HQCBR rate control, OBS does not provide any useful errors why recording fails

**Verdict: CANNOT_VERIFY**

The failure is `AMFComponent::Init` returning `AMF_INVALID_ARG`. The AMD runtime rejects some 10-bit and rate-control combinations, and the AMF SDK does not report which ones through any capability OBS queries. The code passes the selected rate control and `COLOR_BIT_DEPTH_10` directly, so OBS cannot tell which combination is unsupported without hardware data. The "no useful error" part is real. The texture path falls back to `av1_fallback_amf`, and the fallback's `amf_error` catch only logs; it does not call `obs_encoder_set_last_error`. But a generic message would still not tell users which mode to use. Testing would need an RDNA3 GPU.

Evidence:
- `plugins/obs-ffmpeg/texture-amf.cpp:2510-2539` — sets `COLOR_BIT_DEPTH` and the rate control, then `Init`. On failure it throws `amf_error`.
- `plugins/obs-ffmpeg/texture-amf.cpp:2549-2551,2580-2583` — catch handlers only `blog`. There is no `obs_encoder_set_last_error` for `amf_error`.
- `plugins/obs-ffmpeg/texture-amf.cpp:2265-2281` — QVBR/HQVBR/HQCBR are passed straight to AMF.

Related: #10696, #10594 (other AMD AMF driver reports).

---

### [#10213](https://github.com/obsproject/obs-studio/issues/10213) — AV1 Video Decode with Media Source does not use HW Decode on AMD Windows

**Verdict: DEFER_LARGE**

The root cause is in the code. `mp_decode_init` picks the decoder with `avcodec_find_decoder(id)`. For AV1 that returns the first registered AV1 decoder, which is usually `libdav1d`, and libdav1d has no hardware configs. `has_hw_type()` only looks at that one codec's `avcodec_get_hw_config`, so it never finds a hardware path. Hardware AV1 needs FFmpeg's native `av1` decoder. But the native `av1` decoder **has no software fallback**: if the device cannot decode AV1, `get_format` fails and no frames are produced. Examples are a GTX 10/20-series GPU, where CUDA device creation still succeeds, or older AMD/Intel GPUs. `decode_packet` has no hardware-to-software reopen path, so simply switching decoders would break AV1 playback on many systems that "Use hardware decoding" works on today. A correct fix needs a runtime fallback: reopen with libdav1d after the first hardware failure. That changes the media-playback state machine, so it is not a small slice.

Evidence:
- `shared/media-playback/media-playback/decode.c:164-165` — `d->codec = avcodec_find_decoder(id)`.
- `shared/media-playback/media-playback/decode.c:28-66` — the hardware probe only checks `d->codec`'s own hardware configs.
- `shared/media-playback/media-playback/decode.c:267-320` — `decode_packet` has no fallback to software decoding when hardware decoding fails.

Related: #10785 (the PR that attempts this fix).

---

### [#10364](https://github.com/obsproject/obs-studio/issues/10364) — NVENC HEVC Fails to adjust recording configuration correctly when primary gpu is integrated graphics.

**Verdict: IMPLEMENT**

The report is against 30.1, where the old `jim-nvenc` adjusted settings on one path but not the other. That code is gone. The rewritten `obs-nvenc` uses one `init_encoder` for both the texture and CUDA/system-memory paths. But it **dropped** the old runtime clamp of B-frames to the device's `NV_ENC_CAPS_NUM_MAX_BFRAMES`. So any saved `bf` above the device maximum makes encoder init fail: for example `bf=2` on a Pascal GPU, which has no HEVC B-frames, taken from an older profile or from caps of a different GPU. That is the "Unsupported Device" failure in the report. The properties UI limits `bf` using caps from the probe subprocess, but stored settings and API users bypass that. Restoring the clamp is a small, clear fix.

Evidence:
- `plugins/obs-nvenc/nvenc.c:294-302` — `enc->props.bf` goes straight into `frameIntervalP`, with no clamp against device caps. The only adjustment is forcing 4 B-frames for UHQ.
- `plugins/obs-nvenc/nvenc.c:776-818` — `init_encoder` checks 10-bit, 4:4:4 and HDR capabilities but not B-frames.
- `git show 106c7aa61^:plugins/obs-ffmpeg/jim-nvenc.c` lines 1027 and 1048-1054 — the old code had `bf_max = nv_get_cap(enc, NV_ENC_CAPS_NUM_MAX_BFRAMES)` and clamped with a warning.
- `plugins/obs-nvenc/nvenc-properties.c:47,209-210` — the UI default and limit come from the global `caps->bframes`, not from the device in use.

Related: none.

Slice plan:
- In `plugins/obs-nvenc/nvenc.c`, in the config path just before `config->frameIntervalP = ...` (after the UHQ adjustment), add: `int bf_max = nv_get_cap(enc, NV_ENC_CAPS_NUM_MAX_BFRAMES); if (enc->props.bf > bf_max) { warn("Max B-frames setting (%lld) is more than encoder supports (%d), setting to %d", ...); enc->props.bf = bf_max; }`. The UHQ "force 4" should also respect `bf_max`: clamp after the UHQ step. About 8 lines.
- Testing: MSVC build of `obs-nvenc`. A runtime check needs an NVIDIA GPU that lacks HEVC B-frames (Pascal). Otherwise mark it UNTESTED.

---

### [#10428](https://github.com/obsproject/obs-studio/issues/10428) — Intel Arc - encoder error while streaming

**Verdict: OUT_OF_SCOPE**

The reporter sees random QSV encoder errors on Intel Arc and has already filed this with Intel (IGCIT #282) as a driver problem. There is no stack, no code path, and no reproduction. It is a GPU-driver bug outside OBS.

Evidence:
- The report links `IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues/282` as the root issue.
- `plugins/obs-qsv11/` — the QSV encoder surfaces driver errors as generic encode failures. Nothing in OBS can be changed without driver information.

Related: #9946 (an encoder error that could also hang; a separate issue).

---

### [#10463](https://github.com/obsproject/obs-studio/issues/10463) — AOM AV1 and SVT-AV1 Encoders Force 4:2:0 Chroma Subsampling (I420)

**Verdict: IMPLEMENT (AOM AV1 only)**

I confirmed it. `av1_video_info()` maps every non-10-bit format to `VIDEO_FORMAT_I420` for both AV1 encoders, so an I444 output is always downsampled. libaom supports 4:4:4 (`yuv444p`), and FFmpeg's libaomenc selects the AV1 High profile automatically for that pixel format, so AOM can pass I444 through. SVT-AV1 only supports 4:2:0 (Main profile; FFmpeg's libsvtav1 offers only `yuv420p` and `yuv420p10le`), so it must keep converting. That half of the issue is a limitation of the encoder library, not an OBS bug.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-av1.c:52-64` — `av1_video_info` uses `default: info->format = VIDEO_FORMAT_I420`.
- `plugins/obs-ffmpeg/obs-ffmpeg-av1.c:79-85` — the same function decides the encoder context's pixel format in `av1_update`.
- `plugins/obs-ffmpeg/obs-ffmpeg-av1.c:320-346` — both encoder infos share `.get_video_info = av1_video_info`.
- `plugins/obs-ffmpeg/obs-ffmpeg-formats.h:14` — `VIDEO_FORMAT_I444` already maps to an FFmpeg pixel format.

Related: none.

Slice plan:
- In `av1_video_info`, use the `data` argument (`struct av1_encoder *enc`, already passed by both callers). If `enc->type == AV1_ENCODER_TYPE_AOM && info->format == VIDEO_FORMAT_I444`, keep I444. Otherwise keep the current behaviour. About 8 lines in one file.
- Testing: MSVC build of `obs-ffmpeg`. Runtime: set Color Format I444, record with AOM AV1, and check that `ffprobe` reports `yuv444p` / profile High. Possible on this machine if the bundled FFmpeg has libaom (it does in the obs-deps builds). Otherwise mark it UNTESTED.

---

### [#10553](https://github.com/obsproject/obs-studio/issues/10553) — HDR metadata is incorrect for display above 1000 nits

**Verdict: OUT_OF_SCOPE (works as designed)**

The reporter records with **Rec. 2100 HLG**. For HLG, all OBS encoders hard-code 1000 nits as the mastering and content light level. HLG is scene-referred, and the 1000-nit reference display is the convention (BT.2100 / BT.2408). The "HDR Nominal Peak Level" setting is only used for PQ, which is why changing it had no effect. The mastering primaries are hard-coded to Display-P3 values on purpose ("Currently these are hardcoded across all encoders"). This describes the mastering display and is separate from the container's colour primaries (BT.2020), which is what YouTube's note is about. OBS has no reliable way to read the monitor's peak luminance for the encoded mix. MaxFALL equal to the peak value is a simplification, but it would need a maintainer to decide on a new policy. It is not a defect.

Evidence:
- `plugins/obs-nvenc/nvenc.c:819-842` — `hdr_nominal_peak_level = pq ? obs_get_video_hdr_nominal_peak_level() : (hlg ? 1000 : 0)`, and the primaries are hard-coded with the comment "Currently these are hardcoded across all encoders".

Related: none.

---

### [#10594](https://github.com/obsproject/obs-studio/issues/10594) — [texture-amf-av1] amf_encode_tex: SubmitInput timed out: AMF_INPUT_FULL

**Verdict: OUT_OF_SCOPE**

After 2–3 hours of recording, the AMD driver reports a driver timeout (TDR): the screen goes black and the game recovers. `AMF_INPUT_FULL` is the result of the GPU reset, not its cause. OBS only reports that the encoder timed out. A driver TDR on a 7900 GRE with a minimal driver install is a GPU and driver fault, outside OBS.

Evidence:
- `plugins/obs-ffmpeg/texture-amf.cpp` `amf_encode_tex` / SubmitInput loop — it retries while `AMF_INPUT_FULL` and logs a timeout. That is correct behaviour when the GPU has stopped responding.

Related: #10193, #10696.

---

### [#10648](https://github.com/obsproject/obs-studio/pull/10648) — libobs: Add missing encoder API functions

**Verdict: IMPLEMENT (cherry-pick-pr)**

The documentation lists `obs_encoder_get_signal_handler` and `obs_encoder_get_proc_handler`, but neither exists in libobs. Encoders already create `context.signals` and `context.procs` through `obs_context_data_init`. The PR adds the two getters, 22 lines, and applies cleanly to master. Its formatting predates the 120-column clang-format, so it should be re-run through clang-format after the cherry-pick. This is a pure API addition and does not affect existing callers.

Evidence:
- `docs/sphinx/reference-encoders.rst:504,511` — the two functions are documented.
- `grep obs_encoder_get_signal_handler libobs` returns no implementation or declaration.
- `git diff master...refs/upstream-pr/10648 | git apply --check` applies cleanly (`libobs/obs-encoder.c`, `libobs/obs.h`).

Related: none.

Slice plan:
- `git cherry-pick eb369b3ba` (authored by Error-String-Expected-Got-Nil). Then run clang-format on the touched lines, either as a follow-up commit or by amending in a local branch with authorship kept.
- Testing: MSVC build of `libobs` (exports). Optional: a cmocka test in `test/cmocka` that creates an encoder and checks the handlers are non-NULL. That needs a full `obs_startup`, so it may not be practical; then mark the runtime behaviour UNTESTED.

---

### [#10651](https://github.com/obsproject/obs-studio/issues/10651) — OBS does not de-initialize encoders on RTMP stream start fail

**Verdict: IMPLEMENT**

I confirmed it. `rtmp_stream_start()` and the WHIP start path call `obs_output_initialize_encoders()` synchronously, which creates the NVENC session, and then connect on a thread. If the connection fails, the output calls `obs_output_signal_stop()`, which goes to `obs_output_end_data_capture_internal()`. Because data capture never began, that function returns early through `if (!active(output) || !data_active(output))` and only signals stop. The encoders stay initialized (`context.data` alive) until the next successful start or shutdown, so an NVENC session slot remains taken.

Evidence:
- `plugins/obs-outputs/rtmp-stream.c:1539-1550` — the encoders are initialized before the connect thread starts.
- `plugins/obs-webrtc/whip-output.cpp:78-81` — the same pattern for WHIP.
- `libobs/obs-output.c:2875-2889` — the early return for inactive outputs never shuts down encoders.
- `libobs/obs-encoder.c:766-785` — `obs_encoder_shutdown()` frees the encoder instance. It is safe to call on an inactive encoder, because the next `initialize` re-creates it (`obs-encoder.c:680-686` calls shutdown first anyway).

Related: none.

Slice plan:
- `libobs/obs-output.c`: add `static void shutdown_unused_encoders(obs_output_t *output)`. It loops over `output->video_encoders[]` and `output->audio_encoders[]`, and calls `obs_encoder_shutdown(enc)` for each encoder that is non-NULL and not active (`!encoder_active(enc)`). Call it in the `!active || !data_active` early-return branch of `obs_output_end_data_capture_internal` when the output is encoded (`flag_encoded`) and is not reconnecting or delay-active. Shared encoders that another output is using are active and are skipped.
- About 25 lines in one file.
- Testing: MSVC build of `libobs`. At runtime, start a stream with an invalid key using NVENC, then check the log and `nvidia-smi` (if an NVIDIA GPU is present) to confirm the encoder was destroyed. Otherwise mark it UNTESTED.

---

### [#10696](https://github.com/obsproject/obs-studio/issues/10696) — AMD HW H.264 (AVC) HQCBR and HQVBR ignores bitrate settings

**Verdict: CANNOT_VERIFY**

The AVC rate-control code matches HEVC and AV1. For HQCBR and HQVBR, `amf_avc_update_data` sets `TARGET_BITRATE`, `PEAK_BITRATE` and `VBV_BUFFER_SIZE` the same way the HEVC function does, and the reporter says HEVC and AV1 behave correctly. One difference is specific to AVC: `PREENCODE_ENABLE` is set to true, while the HEVC path does not set it and AV1 has it commented out. It might interact with the HQ modes inside the AMD driver, but I cannot confirm that from code without AMD hardware. The behaviour described (about 20–140 Mbps against 6 Mbps) looks like the driver ignoring the target, not OBS sending a wrong value.

Evidence:
- `plugins/obs-ffmpeg/texture-amf.cpp:1388-1418` — AVC rate-control setup (the same pattern as HEVC at `1871-1899`).
- `plugins/obs-ffmpeg/texture-amf.cpp:1597-1608` — VBAQ disabled for HQ modes; `ENFORCE_HRD` true.
- `plugins/obs-ffmpeg/texture-amf.cpp:1698` — `set_avc_property(enc, PREENCODE_ENABLE, true)`, which applies to AVC only.

Related: #10193, #10594.

---

### [#10744](https://github.com/obsproject/obs-studio/issues/10744) — Stats card not showing the encoded framecount

**Verdict: IMPLEMENT**

I confirmed it. The Stats dock and the status bar read encoded and skipped frame counts from `obs_get_video()` only, which is the main mix. When "Rescale Output" uses GPU scaling, `maybe_set_up_gpu_rescale()` creates a separate video mix with its own `video_t`. The GPU encode thread then increments `total_frames` / `skipped_frames` on that mix's video. The main video's counters stay at 0, so the display shows "0 / 0".

Evidence:
- `frontend/widgets/OBSBasicStats.cpp:260-266,365-381` — uses `video_output_get_total_frames(obs_get_video())`.
- `frontend/widgets/OBSBasicStatusBar.cpp:58-59,474-475` — the same.
- `libobs/obs-encoder.c` `maybe_set_up_gpu_rescale` — calls `obs_create_video_mix(&ovi)` and swaps `encoder->media`.
- `libobs/obs-video-gpu-encode.c:66,208` — the counters are incremented on `video->video` of the encoder's mix.
- `libobs/media-io/video-io.c:616-658` — the counters are per root `video_t`.

Related: none.

Slice plan:
- `frontend/widgets/OBSBasicStats.cpp`: add a static helper `video_t *GetEncodingVideo()`. It returns `obs_encoder_video(obs_output_get_video_encoder(out))` for the active streaming output first, then recording, then replay buffer, and falls back to `obs_get_video()`. Use it in `InitializeValues()` and `Update()`. Remember which `video_t` the baseline (`first_encoded` / `first_skipped`) was taken from, and take a new baseline when it changes.
- Optional, same pattern: `OBSBasicStatusBar.cpp`.
- About 30 lines in 1–2 files.
- Testing: MSVC build of the frontend. Run it with Advanced output and Rescale Output set, start a recording, and check that the Stats dock counts frames. Otherwise mark it UNTESTED.

---

### [#10785](https://github.com/obsproject/obs-studio/pull/10785) — obs-ffmpeg: Fix hardware decode failed with av1 video

**Verdict: DEFER_LARGE**

The PR finds the right root cause for #10213: `avcodec_find_decoder` returns libdav1d. To fix it, the PR walks every decoder for the codec id with `av_codec_iterate` and switches `d->codec` to the first one that has a matching hardware config. Problems:
1. The file has moved from `deps/media-playback` to `shared/media-playback`, so the patch does not apply.
2. Native `av1` has no software path. When device creation succeeds but the GPU cannot decode AV1 (for example CUDA on a GTX 10/20, or older iGPUs), decoding fails, and `decode_packet` has no fallback to libdav1d. AV1 media sources would go black on those systems, where they work today.
3. The search is generic, so with hardware decoding on it can also replace `libvpx`/`libvpx-vp9`, which were chosen on purpose for VP8/VP9 **alpha** (`decode.c:154-162`), with the native VP9 hardware decoder. Alpha would be lost.

A safe version needs a runtime hardware-to-software fallback and an alpha exception. That is a design change to media-playback, not a cherry-pick.

Evidence:
- `git diff master...refs/upstream-pr/10785 --stat` touches `deps/media-playback/media-playback/decode.c`, which no longer exists. The current file is `shared/media-playback/media-playback/decode.c`.
- `shared/media-playback/media-playback/decode.c:154-165` — the alpha libvpx override and then `avcodec_find_decoder`.
- `shared/media-playback/media-playback/decode.c:267-320` — no fallback to software decoding.

Related: #10213.

---

### [#10955](https://github.com/obsproject/obs-studio/issues/10955) — after the encoder has been initialized warnings when using stream encoder for recording

**Verdict: IMPLEMENT**

I confirmed it. `OBSBasic::StartStreaming` calls `outputHandler->StartStreaming(service)`. That reaches `obs_output_start`, and `rtmp_stream_start` initializes the encoders synchronously. Right after that, `StartStreaming` calls `StartRecording()` / `StartReplayBuffer()` when they are set to start with the stream. `streamingActive` only becomes true later, in the `OBSStartStreaming` signal handler after the connection. So `Active()` is still false, and `AdvancedOutput::StartRecording` runs `SetupOutputs()` again. That calls `obs_encoder_set_video` / `set_scaled_size` / `set_gpu_scale_type` on the already-initialized stream encoder and produces the three warnings. When `useStreamEncoder` is set, it also calls `UpdateStreamSettings()` again, because `obs_output_active(StreamingOutput())` is still false.

Evidence:
- `frontend/widgets/OBSBasic_Streaming.cpp:99-118` — `StartRecording()` and `StartReplayBuffer()` are called right after `outputHandler->StartStreaming()` returns.
- `frontend/utility/BasicOutputHandler.cpp:51-56` — `streamingActive = true` is only set in the start signal.
- `frontend/utility/BasicOutputHandler.hpp:96-100` — `Active()` relies on these flags.
- `frontend/utility/AdvancedOutput.cpp:796-810,876-888` — `StartRecording` and `StartReplayBuffer` call `UpdateStreamSettings()` and `SetupOutputs()` under these conditions.
- `frontend/utility/AdvancedOutput.cpp:555-575` — `SetupOutputs` calls `obs_encoder_set_video` on `videoStreaming`.
- `libobs/obs-encoder.c:1194-1207,935-949` — the warnings come from here.

Related: none.

Slice plan:
- `frontend/utility/BasicOutputHandler.hpp`: add `bool streamingStarting = false;`.
- `frontend/utility/AdvancedOutput.cpp` `StartStreaming`: set `streamingStarting = true` when `obs_output_start` succeeds.
- `frontend/utility/BasicOutputHandler.cpp`: clear it in `OBSStartStreaming` and `OBSStopStreaming`.
- In `AdvancedOutput::StartRecording` and `StartReplayBuffer`, change `if (!Active())` to `if (!Active() && !streamingStarting)`, and the `UpdateStreamSettings()` guard to `!obs_output_active(StreamingOutput()) && !streamingStarting`. `SetupStreaming` has already run `SetupOutputs` (including `SetupRecording`) in this start sequence, so nothing is lost.
- Apply the same to `SimpleOutput` (`SimpleOutput.cpp:615,795`) if the same pattern shows up there.
- About 15–20 lines in 3–4 files.
- Testing: MSVC build of the frontend. At runtime, stream to a local RTMP server (or an invalid server, which still exercises the start path), with "record when streaming" on and the stream encoder used for recording. Check that the three warnings no longer appear in the log. Otherwise mark it UNTESTED.
