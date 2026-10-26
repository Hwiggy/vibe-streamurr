# Triage batch encoders-05

- Batch: encoders-05 (area hint: encoders)
- Items: 13547, 13652, 13670, 13700, 13723, 13747, 13760, 13771, 13772, 13780, 13785, 13803, 13849, 13921, 13983, 14025, 14037, 14074, 14084
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: issue/PR bodies from `notes/upstream-triage/data/all.json`; PR heads from `refs/upstream-pr/<N>`.
  The local git is 2.33, which has no `merge-tree --write-tree`, so applicability was checked with
  `git diff master...refs/upstream-pr/N | git apply --check` (a read-only check). All 10 PRs in this batch apply cleanly to master.
  No WebFetch was used.

## Summary

| # | Kind | Verdict | Slice |
|---|------|---------|-------|
| 13547 | issue | IMPLEMENT | new-change: map the AMF `level=` option for HEVC through the `hevc_levels` table |
| 13652 | PR | IMPLEMENT | cherry-pick |
| 13670 | issue | CANNOT_VERIFY | - |
| 13700 | issue | DEFER_LARGE | - |
| 13723 | issue | ALREADY_ADDRESSED | fixed by 0969e43a8 |
| 13747 | PR | IMPLEMENT | cherry-pick |
| 13760 | issue | CANNOT_VERIFY | - |
| 13771 | PR | IMPLEMENT | cherry-pick (as a squashed single commit) |
| 13772 | issue | CANNOT_VERIFY | - |
| 13780 | PR | IMPLEMENT | cherry-pick |
| 13785 | issue | CANNOT_VERIFY | - |
| 13803 | issue | IMPLEMENT | handled by the #13771 cherry-pick |
| 13849 | issue | IMPLEMENT | handled by the #14074 cherry-pick |
| 13921 | PR | IMPLEMENT | cherry-pick |
| 13983 | PR | IMPLEMENT | cherry-pick |
| 14025 | PR | DEFER_LARGE | - |
| 14037 | PR | IMPLEMENT | cherry-pick |
| 14074 | PR | IMPLEMENT | cherry-pick |
| 14084 | PR | IMPLEMENT | partial-pr (needs a NULL-guard fix) |

---

### [#13547](https://github.com/obsproject/obs-studio/issues/13547) — AMF HEVC encoding locked to Level 5.1; cannot set Level 6.2 / High Tier

**Verdict: IMPLEMENT** (new-change)

**Reasoning:** The user passed raw AMF enum names (`AMF_VIDEO_ENCODER_HEVC_PROFILE_LEVEL_62`) as options. The OBS parser does not accept that syntax: it takes `key=value` pairs. Even so, the documented route has a real bug. `amf_apply_opt` handles `level=6.2` by deleting the dot and calling `stoi`, which gives `62`. It then writes that value to `PROFILE_LEVEL` for both AVC and HEVC. For AVC this is correct, because `AMF_H264_LEVEL__6_2 = 62`. For HEVC the AMF enum is `general_level_idc` = 30 × level, so 5.1 is 153 and 6.2 is 186. HEVC therefore receives an invalid level (62). The automatic level from `amf_set_codec_level` (5.1 for the user's resolution/fps) stays in place, or the level ends up bogus. Tier already works through `profile_tier=high`. The fix is to translate the level string through the existing `hevc_levels` table, which has `level_str` and `amf_level` fields. AV1 (`av1_levels`) can be handled the same way, because it currently only warns.

**Evidence:**
- `plugins/obs-ffmpeg/texture-amf-opts.hpp:83-98`: the `level` option strips the '.', calls `stoi`, and passes the raw number to `set_hevc_opt(PROFILE_LEVEL, level)`.
- `plugins/obs-ffmpeg/texture-amf-opts.hpp:271-277`: `profile_tier` main/high already exists for HEVC.
- `plugins/obs-ffmpeg/texture-amf.cpp:111-118`: the `hevc_levels` table maps "6.2" to `AMF_LEVEL_6_2`.
- `.deps/obs-deps-2026-10-23-x64/include/AMF/components/VideoEncoderHEVC.h:62,70,74`: `AMF_LEVEL_1 = 30`, `AMF_LEVEL_5_1 = 153`, `AMF_LEVEL_6_2 = 186`.
- `.deps/.../AMF/components/VideoEncoderVCE.h:85,89`: the H.264 levels are 51 and 62, so the AVC path is correct.
- `plugins/obs-ffmpeg/texture-amf.cpp:1220`: `texture-amf-opts.hpp` is included after the level tables, so the tables are visible from it.
- `plugins/obs-ffmpeg/texture-amf.cpp:2016-2020`: the final level is read back and warns "level string not found", which is consistent with an invalid 62.

**Slice plan:** In `texture-amf-opts.hpp`, for `hevc` (and optionally `av1`), look up `opt->value` in `hevc_levels`/`av1_levels` by `level_str`. Also accept the "6.2" form and "6.2" written without a trailing ".0" for AV1. Set the matching `amf_level`, or `warn()` on no match. Keep the AVC path unchanged. About 20 lines in one file.
**Test plan:** Build obs-ffmpeg with MSVC on this box. A runtime check needs an AMD GPU: set `level=6.2 profile_tier=high` and confirm the log's "level:" line shows 6.2. If no AMD GPU is available, mark it UNTESTED at runtime.

Related: none.

---

### [#13652](https://github.com/obsproject/obs-studio/pull/13652) — obs-nvenc: Handle invalid GPU indices

**Verdict: IMPLEMENT** (cherry-pick-pr)

**Reasoning:** The `device` property allows the range `-1..num_encoder_devices()` inclusive, which is one past the last valid index. A stale index left behind after a GPU is removed reaches CUDA init and fails with an unhelpful message. The PR does two things. With one device, it ignores the bad index, because the property is hidden. With several devices, it fails early with a descriptive error that gives the valid range. It is small (3 files, +31/-4), it is by a maintainer (derrod), and it applies cleanly. `num_encoder_devices()` already exists on master.

**Evidence:**
- `plugins/obs-nvenc/nvenc-properties.c:205-206`: the property range ends at `num_encoder_devices()` (inclusive), so it allows an index equal to the device count.
- `plugins/obs-nvenc/nvenc-helpers.c:247`: `num_encoder_devices()` exists.
- `plugins/obs-nvenc/nvenc.c:936-950`: current `nvenc_create_base` only checks `gpu != -1` to reroute and never validates the range.
- `plugins/obs-nvenc/data/locale/en-US.ini:61`: the old `BadGPUIndex` string. Other locales keep their old one-argument `%1` text. That is harmless because `%2` is simply not present there.

**Slice plan:** `git cherry-pick 53ff74e1c`.
**Test plan:** MSVC build of obs-nvenc. To exercise it, edit `streamEncoder.json`/`recordEncoder.json` to set `"device": 5`. With a single NVIDIA GPU, check the warning and that encoding proceeds. The multi-GPU path cannot be tested on this box: UNTESTED.

Related: none.

---

### [#13670](https://github.com/obsproject/obs-studio/issues/13670) — AMD encoder overload cannot be recovered

**Verdict: CANNOT_VERIFY**

**Reasoning:** The user reports that the AMF encoder stays in a lagging state after external GPU load (4K playback) stops, on an RX 9070 XT with a specific driver, while Task Manager shows *lower* encoder utilisation. Nothing in `texture-amf.cpp` keeps throttle state that would hold the encoder after an overload. The submit/query loop is per-frame, so this looks like driver or VCN scheduler behaviour that needs AMD hardware to reproduce. No defect can be identified in the code.

**Evidence:**
- `plugins/obs-ffmpeg/texture-amf.cpp` (submit/query loop): no persistent overload state on the OBS side. The DTS/packet handling at `:635-637` is stateless per packet.

Related: #13772 (another AMD AMF rate-control report).

---

### [#13700](https://github.com/obsproject/obs-studio/issues/13700) — HDR live streaming does not support AV1 encoding

**Verdict: DEFER_LARGE**

**Reasoning:** This is a deliberate guard. In `connect_thread`, the RTMP output refuses HDR for any codec other than H.264 or HEVC and returns `OBS_OUTPUT_HDR_DISABLED`. Upstream added it because YouTube, the main eRTMP HDR consumer, rejects 10-bit AV1 (#8522/#10029). Exempting custom servers needs two things: (a) a way for the output to know the service is "custom" (rtmp-stream has no service-type knowledge today), and (b) validation that OBS's AV1 eRTMP HDR metadata is correct for any consumer. That is a policy and design decision rather than a bug fix. Deleting the guard outright would bring back the YouTube failure that upstream chose to prevent.

**Evidence:**
- `plugins/obs-outputs/rtmp-stream.c:1511-1523`: the "HDR streaming disabled for AV1" loop.
- `libobs/obs-defs.h:46`: `OBS_OUTPUT_HDR_DISABLED`. `frontend/data/locale/en-US.ini:441`: the user-facing message.
- History: `14db1489e` enabled HEVC HDR over eRTMP, and its message notes that it is "currently only supported by YouTube".

Related: none in batch.

---

### [#13723](https://github.com/obsproject/obs-studio/issues/13723) — AMD AMF H.264 applies a one-frame DTS offset when B-frames are disabled

**Verdict: ALREADY_ADDRESSED**

**Reasoning:** The reporter (OBS 32.2.1) points out that `dts_offset = b_frames + 1` ran even when the B-frame pattern was 0. Master now requires `b_frames > 0` before applying the offset. That change is commit `0969e43a8` "obs-ffmpeg: Fix B-frame offset calculation in AMF" (2026-08-06), which is contained in 33.0.0-beta1.

**Evidence:**
- `plugins/obs-ffmpeg/texture-amf.cpp:1718-1727`: `get_avc_property(B_PIC_PATTERN) && get_avc_property(MAX_CONSECUTIVE_BPICTURES) && b_frames > 0` gives the offset; otherwise the offset is 0.
- `plugins/obs-ffmpeg/texture-amf.cpp:635-637`: the offset applies only when it is non-zero.
- `git describe --contains 0969e43a8` gives `33.0.0-beta1~70`.

Related: none.

---

### [#13747](https://github.com/obsproject/obs-studio/pull/13747) — obs-qsv11: Fix CQP values in encoder log

**Verdict: IMPLEMENT** (cherry-pick-pr)

**Reasoning:** For encoder version 2, `update_params` takes QP from the single `cqp` setting (×4 for AV1). It still logs the legacy `qpi/qpb/qpp` settings, which keep their default of 23, so the log is misleading. The PR logs `qpi/qpb/qpp` for version 1 and `cqp` for version 2. It is a logging-only change in one file (+13/-6) and applies cleanly.

**Evidence:**
- `plugins/obs-qsv11/obs-qsv11.c:451-455`: reads `qpi`, `cqp`, and `__ver`.
- `plugins/obs-qsv11/obs-qsv11.c:617-627`: version 1 uses qpi/qpp/qpb; otherwise `actual_cqp` (×4 for AV1) is applied to all three.
- `plugins/obs-qsv11/obs-qsv11.c:657-662`: the log always prints qpi/qpb/qpp.
- `plugins/obs-qsv11/obs-qsv11.c:173-174`: both defaults are 23.

**Slice plan:** `git cherry-pick ef17ef881`. Optional nit: the log prints the user value, not the ×4 AV1 value. Leave that as the PR has it.
**Test plan:** MSVC build of obs-qsv11. A runtime log check needs Intel QSV hardware; otherwise it is UNTESTED.

Related: none.

---

### [#13760](https://github.com/obsproject/obs-studio/issues/13760) — Silent encoder failure: UI timer kept running after recording stopped writing

**Verdict: CANNOT_VERIFY**

**Reasoning:** The issue is labelled needs/more-info. The log is on Google Drive rather than the OBS log service, and the encoder in use is unknown. There is a plausible link to the texture-encoder failure deadlock fixed by #13983. In that bug, `full_stop()` on the gpu-encode thread deadlocks, the output never finishes stopping, and the UI is never notified. That matches "file stopped growing while the timer ran". This is only a hypothesis without the log. #13983 is being implemented regardless.

**Evidence:**
- `libobs/obs-encoder.c:1372-1391` (`full_stop`) leads to `remove_connection` (`:417-419`), then to `stop_gpu_encode` (`libobs/obs.c:3218-3242`), which calls `os_event_wait(gpu_encode_inactive)` from the gpu encode thread itself. This is the deadlock described in #13983.

Related: #13983.

---

### [#13771](https://github.com/obsproject/obs-studio/pull/13771) — obs-qsv11: Close MFX session and unload loader

**Verdict: IMPLEMENT** (cherry-pick-pr, squashed)

**Reasoning:** The leak is confirmed in code. On Windows, `Initialize()` creates an `mfxLoader` and a session but ignores the `data` out-parameter. `ReleaseSessionData` is an empty stub, and `ClearData()` calls only `MFXVideoENCODE_Close`. `MFXClose(m_session)` and `MFXUnload(loader)` are never called on the real encode path; they are called only in the probe path in the constructor. Every encoder start/stop therefore leaks a VPL session and loader. On Linux the session is not closed either. The PR stores the loader, closes the session before the shared D3D11 device is released, and unloads the loader on both the failure and the release paths. It is +47/-7 across 3 files and applies cleanly. The PR's 3 commits include 2 merge-from-master commits, so it should be applied as one squashed commit built from `git diff master...refs/upstream-pr/13771`, keeping the author (lazyboson) as author.

Caveats: the PR body contains an unfilled template placeholder ("[describe what you saw...]"). `Reset()` calls `ClearData()` and then `Open()`, and `Open` calls `Initialize` again, so closing the session in `ClearData` is safe for reset. If `Open()` fails after `Initialize` succeeds, a small leak remains. That case is out of scope here.

**Evidence:**
- `plugins/obs-qsv11/common_utils_windows.cpp:22`: `UNUSED_PARAMETER(data)`. `:58,103`: `MFXLoad()` with no matching unload. `:129`: `void ReleaseSessionData(void *) {}`.
- `plugins/obs-qsv11/QSV_Encoder_Internal.cpp:883-933`: `ClearData` has no `MFXClose`. `:116-117`: the only `MFXClose`/`MFXUnload` is in the capability probe.
- `plugins/obs-qsv11/QSV_Encoder_Internal.cpp:131-141`: `Open` calls `Initialize` and allocates a new session each time. `:935-943`: `Reset` calls `ClearData` and then `Open`.
- `plugins/obs-qsv11/common_utils_linux.cpp:279,368-375`: the loader is never unloaded on Linux.

**Slice plan:** Apply the PR diff as one commit, with Author set to the PR author and the message "obs-qsv11: Close MFX session and unload loader".
**Test plan:** MSVC build of obs-qsv11. A runtime check needs an Intel iGPU/Arc: start and stop a recording 20 times and watch private bytes. The Linux part is UNTESTED (it does not build on this box).

Related: #13803.

---

### [#13772](https://github.com/obsproject/obs-studio/issues/13772) — AMD H.264 CBR overshoots (1500 kbps target goes to 11000–16000) while HQCBR is fine

**Verdict: CANNOT_VERIFY**

**Reasoning:** For AVC CBR, OBS sets the target, peak, and VBV to the bitrate and enables filler data. Nothing in that path explains a 7–10× overshoot, and plain CBR and HQCBR take the same branch apart from filler data. The linked log is a crash-log URL with no repro detail ("1. start stream"). This is likely driver- or setting-specific (for example custom options or dynamic bitrate). Note that #13780 adds filler data for HQCBR; it does not change plain AVC CBR, which already has filler.

**Evidence:**
- `plugins/obs-ffmpeg/texture-amf.cpp:1396-1405`: in `amf_avc_update_data`, CBR sets TARGET/PEAK/VBV equal to the bitrate and enables `FILLER_DATA_ENABLE`.

Related: #13780, #13670.

---

### [#13780](https://github.com/obsproject/obs-studio/pull/13780) — obs-ffmpeg: Fix AMD AV1 CBR filler data bug

**Verdict: IMPLEMENT** (cherry-pick-pr)

**Reasoning:** The bug is confirmed. `amf_av1_update_data` compares `rc`, which holds an AV1 enum from `get_av1_rate_control`, against H.264 enum constants. The H.264 enum has CBR=1 and PCVBR=2; the AV1 enum has LCVBR=1, PCVBR=2, CBR=3, HQCBR=6. As a result, AV1 CBR never enables filler data, and AV1 *latency-constrained VBR* (value 1) wrongly takes the filler-data branch and skips its own VBV setup. The PR switches to the AV1 constants and also enables filler data for HQCBR on AVC, HEVC, and AV1. It is one file (+7/-4), applies cleanly, and the author tested it on an RX 9060 XT.

**Evidence:**
- `plugins/obs-ffmpeg/texture-amf.cpp:2311,2314`: uses `AMF_VIDEO_ENCODER_RATE_CONTROL_METHOD_CBR` and `..._PEAK_CONSTRAINED_VBR` (the H.264 enum) in the AV1 path.
- `plugins/obs-ffmpeg/texture-amf.cpp:2265-2283`: `get_av1_rate_control` returns the AV1 enum.
- `.deps/obs-deps-2026-10-23-x64/include/AMF/components/VideoEncoderAV1.h:90-97`: AV1 enum values (CBR=3, HQCBR=6).
- `.deps/.../AMF/components/VideoEncoderVCE.h:98-107`: H.264 enum values (CBR=1, PCVBR=2).

**Slice plan:** `git cherry-pick 1a3a7294a`.
**Test plan:** MSVC build of obs-ffmpeg. A runtime check needs an AMD RDNA3+ GPU: record with AV1 CBR and confirm small filler packets with ffprobe. Otherwise it is UNTESTED.

Related: #13772 (fixes upstream #12013, which is not in this batch).

---

### [#13785](https://github.com/obsproject/obs-studio/issues/13785) — WebM-VP9 custom output no longer opens with BGRA format

**Verdict: CANNOT_VERIFY**

**Reasoning:** The report says `avcodec_open2` returns EINVAL for libvpx-vp9 with BGRA/sRGB/full range in 32.2.1, while it worked in 32.1.2. Between those tags, `plugins/obs-ffmpeg` received only formatting, translation, DLL-directory, and AMF changes. The pix-fmt selection code (BGRA → best alpha format, e.g. yuva420p) is unchanged. The likely cause is the obs-deps FFmpeg/libvpx update (CI: deps 2026-06-25 / 2026-07-15; libavcodec is now 62.x). Newer FFmpeg may reject one of the context colour fields (range, colorspace, or chroma location) for this encoder. That cannot be confirmed without running FFmpeg 8 with the given settings, and no code defect could be pinned down by reading.

**Evidence:**
- `plugins/obs-ffmpeg/obs-ffmpeg-output.c:184-206`: pix-fmt negotiation using `has_alpha` for BGRA.
- `plugins/obs-ffmpeg/obs-ffmpeg-output.c:975-992`: sRGB maps to `AVCOL_SPC_BT709` with `AVCOL_TRC_IEC61966_2_1` and full range (JPEG).
- `git log 32.1.2..32.2.1 -- plugins/obs-ffmpeg`: no functional change to the output path. Deps were bumped in `3bba730f7` and `507de8136`.
- `.deps/obs-deps-2026-10-23-x64/include/libavcodec/version_major.h:28`: `LIBAVCODEC_VERSION_MAJOR 62`.

**Follow-up if picked up later:** Reproduce with a local build and look for the FFmpeg log line before "Failed to open video codec". It names the rejected field.

Related: none.

---

### [#13803](https://github.com/obsproject/obs-studio/issues/13803) — Memory leak after stopping recording with the QSV encoder on Windows

**Verdict: IMPLEMENT** (fixed by cherry-picking #13771)

**Reasoning:** The symptom is RAM that grows with each QSV record start/stop cycle. That matches the confirmed root cause in #13771: each `Open()` creates a new VPL loader and session through `Initialize()`, and `ClearData()` never calls `MFXClose` or `MFXUnload`. No separate change is needed.

**Evidence:**
- See #13771: `plugins/obs-qsv11/common_utils_windows.cpp:22,58,103,129`; `plugins/obs-qsv11/QSV_Encoder_Internal.cpp:131-141,883-933`.

**Slice plan:** Same commit as #13771. Reference this issue in its commit message.
**Test plan:** As for #13771; it needs Intel hardware, otherwise it is UNTESTED.

Related: #13771.

---

### [#13849](https://github.com/obsproject/obs-studio/issues/13849) — SVT-AV1 CBR parameters not applied (wrong FFmpeg AVOption name)

**Verdict: IMPLEMENT** (fixed by cherry-picking #14074)

**Reasoning:** The bug is confirmed. `av1_update` builds an SVT parameter dictionary and passes it with `av_opt_set_dict_val(..., "svtav1_opts", ...)`. FFmpeg's libsvtav1 private option is named `svtav1-params`, so the call fails with "Option not found". The return value is ignored, so the `rc`, `pred-struct`, `tbr`, and `bias-pct` values are silently dropped and the CBR path never configures SVT as CBR.

**Evidence:**
- `plugins/obs-ffmpeg/obs-ffmpeg-av1.c:86-88`: VBR sets `rc=1`. `:105-109`: CQP sets `rc=0`. `:117-124`: CBR sets rc=2, pred-struct, bias-pct, and tbr.
- `plugins/obs-ffmpeg/obs-ffmpeg-av1.c:127-129`: `av_opt_set_dict_val(..., "svtav1_opts", ...)` with the result ignored.

**Slice plan:** The cherry-pick of #14074.

Related: #14074.

---

### [#13921](https://github.com/obsproject/obs-studio/pull/13921) — obs-nvenc: Use NV_MAX_SEQ_HDR_LEN for sequence parameter buffer

**Verdict: IMPLEMENT** (cherry-pick-pr)

**Reasoning:** The NVENC programming guide says the SPS/PPS buffer must be `NV_MAX_SEQ_HDR_LEN` bytes (512 in the shipped header). OBS uses `uint8_t buf[256]`. `inBufferSize = sizeof(buf)` is passed, so this is not a memory-safety bug. However, a large header (for example HEVC with VUI and HDR, or AV1 with OBUs) could be truncated, or `nvEncGetSequenceParams` could fail and leave `size = 0`, which gives an empty header. This is a one-line change and applies cleanly.

**Evidence:**
- `plugins/obs-nvenc/nvenc.c:1116-1127`: `uint8_t buf[256]`, and the return of `nvEncGetSequenceParams` is unchecked.
- `.deps/obs-deps-2026-10-23-x64/include/ffnvcodec/nvEncodeAPI.h:131`: `#define NV_MAX_SEQ_HDR_LEN (512)`.

**Slice plan:** `git cherry-pick ec7301ef8`.
**Test plan:** MSVC build of obs-nvenc. A runtime NVENC recording is possible only if this box has an NVIDIA GPU; otherwise it is UNTESTED.

Related: none.

---

### [#13983](https://github.com/obsproject/obs-studio/pull/13983) — libobs: Fix deadlock when a texture encoder fails

**Verdict: IMPLEMENT** (cherry-pick-pr)

**Reasoning:** The deadlock is confirmed in code. In the gpu encode thread, a failed `encode_texture` call leads through `send_off_encoder_packet` and `full_stop` to `remove_connection`, then to `stop_gpu_encode`. `stop_gpu_encode` does `os_event_wait(video->gpu_encode_inactive)`, an event that only this same thread signals at the end of its iteration. It may also call `stop_gpu_encoding_thread`, which would join itself. The thread therefore hangs forever. The PR has two parts. First, for texture encoders, `full_stop` flags `gpu_encode_failed` instead of disconnecting; the gpu thread skips flagged encoders, and outputs stop them through the normal `obs_encoder_stop`. Second, `full_stop` skips outputs that are not active, which prevents an idle replay buffer from being left in a half-stopped state. The flag is reset in `obs_encoder_shutdown`. The PR is +20 lines in 3 files, applies cleanly, and is described as stress-tested in 6 setups.

**Evidence:**
- `libobs/obs-encoder.c:1372-1391` (`full_stop`) and `:1394-1399` (`send_off_encoder_packet` calls `full_stop` on failure).
- `libobs/obs-encoder.c:413-420`: `remove_connection` calls `stop_gpu_encode` for texture encoders.
- `libobs/obs.c:3218-3242`: `stop_gpu_encode` waits on `gpu_encode_inactive` and may call `stop_gpu_encoding_thread`.
- `libobs/obs-video-gpu-encode.c:56` (reset) and `:216` (signal): the event is managed only by the gpu encode thread. `:203` is the call to `send_off_encoder_packet` inside that thread.

**Slice plan:** `git cherry-pick cc5101baf da84406f2`.
**Test plan:** MSVC build of libobs and the cmocka tests in `test/cmocka`, as a regression check only. Reproducing a texture-encoder failure needs a GPU encoder that fails partway through a recording, so the runtime fix is UNTESTED.

Related: #13760 (possible symptom).

---

### [#14025](https://github.com/obsproject/obs-studio/pull/14025) — Encoder IDR Requests & WebRTC PLI support

**Verdict: DEFER_LARGE**

**Reasoning:** This is a new libobs encoder API (an IDR-request capability and function, plus encoder-group propagation), implemented in five encoder plugins (NVENC, QSV, AMF, x264, VideoToolbox) and in the WHIP output's PLI handling. It is 9 commits and about 292 insertions / 56 deletions across 21 files. It is in scope and coherent, and it applies cleanly. However, it is a public API addition that upstream maintainers still have to design-review. It is far beyond a small slice, and most of the encoder paths cannot be tested on one machine.

**Evidence:**
- `git diff master...refs/upstream-pr/14025 --stat`: 21 files, +292/-56, including `libobs/obs-encoder.h`, `docs/sphinx/reference-encoders.rst`, and `plugins/obs-webrtc/whip-output.cpp`.

Related: none.

---

### [#14037](https://github.com/obsproject/obs-studio/pull/14037) — plugin manager: Fix environment var encoding

**Verdict: IMPLEMENT** (cherry-pick-pr)

**Reasoning:** `getEnvironmentVariable` uses `getenv()`. On Windows that returns ANSI-codepage text, but the result is used as a UTF-8 module path, so non-ASCII `OBS_PLUGINS_PATH` and `OBS_LEGACY_PLUGINS_*` paths break. The current code also wraps `getenv`'s static storage in a `std::unique_ptr<char>`. It is released before destruction so it is not freed, but it is a misuse waiting to happen. The PR replaces this with `qEnvironmentVariable` on Windows, which reads the UTF-16 environment, and `qgetenv` elsewhere, both returning a UTF-8 `std::string`. It is one header (+6/-10). The frontend already links Qt, and the PR applies cleanly.

**Evidence:**
- `frontend/plugin-manager/PluginModuleLoader.hpp:35-47`: the `getenv` and `unique_ptr<char>` pattern.
- `frontend/plugin-manager/PluginModuleLoader_Windows.cpp:112,145-146`: used for the plugin search paths on Windows.

**Slice plan:** `git cherry-pick 6097e555b`.
**Test plan:** Build the frontend with MSVC. Set `OBS_PLUGINS_PATH` to a folder with a Japanese name containing a plugin, start OBS, and confirm the plugin loads. This can be tested on this box.

Related: none.

---

### [#14074](https://github.com/obsproject/obs-studio/pull/14074) — obs-ffmpeg: Fix SVT-AV1 parameters not being applied

**Verdict: IMPLEMENT** (cherry-pick-pr)

**Reasoning:** This fixes #13849. It renames the option to `svtav1-params` and logs a warning when `av_opt_set_dict_val` fails. It also drops `tbr`, which SVT reads in kbps while OBS passes bps, so it would clamp to 100 Mbps once the name is fixed. It drops `bias-pct` too, which SVT-AV1 2.x removed and which would log an error. The bitrate still reaches SVT through `context->bit_rate`, which `ffmpeg_video_encoder_update` sets. One behaviour change to note in the commit: after the rename, the `rc=1` (VBR) and `rc=0` (CQP) values that were silently ignored also start taking effect. That is the intended behaviour. The change is one file (+3/-3) and applies cleanly.

**Evidence:**
- `plugins/obs-ffmpeg/obs-ffmpeg-av1.c:117-129`: current code.
- `plugins/obs-ffmpeg/obs-ffmpeg-av1.c:131`: `ffmpeg_video_encoder_update(&enc->ffve, bitrate, ...)` sets `bit_rate`.

**Slice plan:** `git cherry-pick 3ed1b195c`. Reference #13849 in the commit message.
**Test plan:** MSVC build of obs-ffmpeg. Record with SVT-AV1 CBR 6000 on this box (software encoder, no special hardware). Check that the log has no "Failed to set SVT-AV1 parameters" line, and check the bitrate with ffprobe.

Related: #13849.

---

### [#14084](https://github.com/obsproject/obs-studio/pull/14084) — obs-ffmpeg: SRT URL without hostname or 0.0.0.0 is always listener mode

**Verdict: IMPLEMENT** (partial-pr, with a fix)

**Reasoning:** Treating `srt://:port` and `srt://0.0.0.0:port` (with no `mode=`) as listener matches the srt-live-transmit URL conventions. Caller mode to an empty host or 0.0.0.0 is meaningless anyway. It is a 16-line change in one file and applies cleanly. **However, the PR as written dereferences NULL.** In `libsrt_setup`, `p = strchr(uri, '?')` is NULL for exactly the URLs the PR targets, `srt://:9000` and `srt://0.0.0.0:9000`. The new code calls `av_find_info_tag(buf, sizeof(buf), "mode", p)` unconditionally, and FFmpeg's implementation reads `*info` immediately. The URI is the raw service URL (`fetch_service_info`), so nothing appends a query string. The condition must become `(!p || !av_find_info_tag(..., p))`. That makes this partial-pr: take the logic and fix the guard.

**Evidence:**
- `plugins/obs-ffmpeg/obs-ffmpeg-srt.h:454-476`: `av_url_split`, then `p = strchr(uri,'?')`, which may be NULL. Existing code only uses `p` inside `if (p)`.
- `plugins/obs-ffmpeg/obs-ffmpeg-srt.h:745-756`: `mode=` is parsed in `libsrt_open` before `libsrt_setup` (`:808`). An explicit mode is honoured, so the new default applies only when no mode is given.
- `plugins/obs-ffmpeg/obs-ffmpeg-mpegts.c:847,861`: the URL comes directly from the service, and other code guards `p` before calling `av_find_info_tag`.

**Slice plan:** Apply the PR diff (both commits squashed, keeping the author) and change the condition to `(!p || !av_find_info_tag(buf, sizeof(buf), "mode", p)) && (hostname[0] == '\0' || strcmp(hostname, "0.0.0.0") == 0)`. Fix the trailing whitespace in the comment. Document the NULL-guard fix in the commit body.
**Test plan:** MSVC build of obs-ffmpeg. Stream to `srt://:9000` with `srt-live-transmit srt://127.0.0.1:9000 file://con` or ffplay as the caller, and confirm OBS listens and connects. Also confirm that `srt://0.0.0.0:9000?mode=listener` and a normal caller URL still work. This can be done on this box if an SRT client is installed.

Related: none.
