# Upstream triage — batch outputs-services-05

- Items: 11151, 11174, 11292, 11310, 11387, 11398, 11500, 11584, 11595, 11620, 11645, 11655, 11676, 11683, 11692, 11700, 11721, 11726, 11734, 11765
- Date: 2026-10-26
- Base commit: 72e866557 (master)
- Method: item bodies come from notes/upstream-triage/data/all.json. Code was read at master, and PR heads at refs/upstream-pr/N.
  Local git is 2.33, which lacks `merge-tree --write-tree`, so applicability was checked with
  `git diff master...refs/upstream-pr/N | git apply --check -` (read-only).
  WebFetch was used twice (#11595, #11683) to read comment threads.

Summary: IMPLEMENT 2 (#11310, #11398), ALREADY_ADDRESSED 2 (#11620, #11721), DEFER_LARGE 2 (#11676, #11692),
OUT_OF_SCOPE 1 (#11765), CANNOT_VERIFY 13.

---

### [#11151](https://github.com/obsproject/obs-studio/issues/11151) — WebM files glitch/pixelate since 30.2
**Verdict: CANNOT_VERIFY**
The report describes a regression in media playback of VP8/VP9 alpha WebM files between 30.0 and 30.2. The likely cause is the FFmpeg/libvpx decoder or the hardware decode path in the bundled deps rather than OBS source logic. The repro file is only attached on GitHub, so we can't test it locally, and there is no code defect to point at.
- Evidence: media playback goes through deps/media-playback (FFmpeg decode). The change came with the dependency bundle, not with one OBS commit we can identify.
- Related: none.

### [#11174](https://github.com/obsproject/obs-studio/issues/11174) — Recordings not saved after switching profile (Linux)
**Verdict: CANNOT_VERIFY**
This is a Linux-only report, with "Couldn't initialize muxer" appearing sometimes. The log isn't available offline, and the report gives no output path or encoder details. Switching profiles rebuilds the output handler, but nothing in that path shows a defect, and we can't test on Linux from this box.
- Related: none.

### [#11292](https://github.com/obsproject/obs-studio/issues/11292) — OBS freezes on "Stopping recording"
**Verdict: CANNOT_VERIFY**
This is a generic hang after about 30 minutes of recording, with no stack or dump analysis. The cause could be the encoder, the disk or the muxer, and the report doesn't point at any specific code.
- Related: #11726 and #11655 (similar "stuck stopping" symptoms on different setups).

### [#11310](https://github.com/obsproject/obs-studio/pull/11310) — obs-outputs: Add metadata info for enhanced RTMP multivideotracks
**Verdict: IMPLEMENT (cherry-pick-pr)**
This is a small change that follows the Enhanced RTMP v2 spec section "Enhancing onMetaData". When an output has more than one video encoder, the PR adds a `videoTrackIdInfoMap` object to onMetaData. The map is keyed by track id and holds width, height, codec, bitrate and framerate for each extra track. Its track ids are the encoder index, which is the same trackId that flv-mux already writes in multitrack packets. Master has no such metadata, and the PR applies cleanly. The PR also replaces the hand-written `00 00 09` object-end bytes with an `enc_obj_end()` helper. `AMF_EncodeInt24(AMF_OBJECT_END)` emits the same three bytes, so output for single-track streams doesn't change.
- Evidence:
  - plugins/obs-outputs/flv-mux.c:190-248 — `build_flv_meta_data` hardcodes 20 ECMA entries and has no multitrack info.
  - plugins/obs-outputs/flv-mux.c:400,429,454,481 — multitrack packets use `idx` as the trackId (`is_multitrack = idx > 0`), so the map keys match.
  - libobs/obs-output.c:1114-1135 — `obs_output_get_video_encoder2(idx)` and `obs_output_get_video_encoder` (the first non-null encoder) give the "main" encoder, which the PR leaves out of the map.
  - `git apply --check` succeeds. The PR has commit 7f1372c78 plus a merge commit, and only 7f1372c78 needs picking.
- Note: the stack buffer is 4096 bytes and each extra track adds about 120 bytes. MAX_OUTPUT_VIDEO_ENCODERS is small, so it fits.
- Related: none in batch.
- Slice plan: `git cherry-pick 7f1372c78` (author murillo128; the contribution is GPL-2.0-or-later). Files: plugins/obs-outputs/flv-mux.c, librtmp/amf.c, librtmp/amf.h and rtmp-helpers.h, about 62 lines. Test with an MSVC build of obs-outputs. We have no multitrack eRTMP server, so runtime behaviour is UNTESTED. Single-track metadata should be byte-identical; check that by inspection or with a local RTMP dump if one is available.

### [#11387](https://github.com/obsproject/obs-studio/issues/11387) — Application Audio Capture (beta) doesn't work on first startup
**Verdict: CANNOT_VERIFY**
The capture fails on the first launch and works after a restart. That pattern points to timing with the target process or the Windows audio session (process-loopback activation), not to a defect visible in the code. The logs are only online, and we would need a repro.
- Related: none.

### [#11398](https://github.com/obsproject/obs-studio/pull/11398) — decklink: Fix frequent audio dropouts on output
**Verdict: IMPLEMENT (cherry-pick-pr)**
DeckLink output plays video with scheduled playback (`ScheduleVideoFrame` plus `StartScheduledPlayback`), but it writes audio with `WriteAudioSamplesSync`. The DeckLink SDK manual says `WriteAudioSamplesSync` must not be called during scheduled playback. The PR switches audio to `bmdAudioOutputStreamContinuous` with `ScheduleAudioSamples(..., 0, 0, ...)`, which is what the SDK prescribes. It is a 2-line change and applies cleanly.
- Evidence:
  - plugins/decklink/decklink-device-instance.cpp:545-546 — `EnableAudioOutput(..., bmdAudioOutputStreamTimestamped)`.
  - plugins/decklink/decklink-device-instance.cpp:618-621 — video preroll uses `ScheduleVideoFrame` and then `StartScheduledPlayback`.
  - plugins/decklink/decklink-device-instance.cpp:678-682 — `WriteAudio` calls `WriteAudioSamplesSync`.
  - `git apply --check` succeeds. It is a single commit, 4394e9f90.
- Related: upstream #10731 (audio distortion on DeckLink output; not in this batch).
- Slice plan: `git cherry-pick 4394e9f90` (author CyBeRoni). One file, 4 lines. Test with an MSVC build of the decklink plugin. Runtime is UNTESTED because this box has no DeckLink hardware.

### [#11500](https://github.com/obsproject/obs-studio/issues/11500) — Browser docks don't rescale when moving between monitors with different DPI
**Verdict: CANNOT_VERIFY**
Browser docks render through CEF in the obs-browser submodule. Whether DPI changes reach the embedded browser depends on CEF and Qt, and reproducing it needs a setup with monitors at different DPI. There is no defect in obs-studio source to point at. Because dragging the splitter fixes the scaling, the likely cause is a missing resize or notify when the window changes screen. Any fix would go in obs-browser.
- Related: none.

### [#11584](https://github.com/obsproject/obs-studio/issues/11584) — Crash when stopping recording
**Verdict: CANNOT_VERIFY**
The setup includes ReShade/AutoHDR injection, RTSS, a custom FFmpeg output and HDR, and the reporter suspects a plugin or driver. The crash log is only online, and there is no reproducible path.
- Related: none.

### [#11595](https://github.com/obsproject/obs-studio/issues/11595) — OBS fails to connect to local RTMP server after 30.2.3
**Verdict: CANNOT_VERIFY**
The thread (fetched) narrows the problem down. `ffplay -listen` on `localhost` binds to `::1`. OBS 30.2.3 can't connect to it, 30.2.2 can, and binding the server to 127.0.0.1 works with both. The reporter suspects commit 42136433c ("happy-eyeballs: Specify AI_ADDRCONFIG"). On Windows, AI_ADDRCONFIG does not count loopback addresses when deciding whether IPv6 is configured, so on hosts without global IPv6 `localhost` can resolve to IPv4 only. That matches the symptom, but no maintainer has confirmed it and we can't reproduce those IPv6 host conditions here. It is also a corner case: the server listens only on ::1, and using 127.0.0.1 works around it.
- Evidence: shared/happy-eyeballs/happy-eyeballs.c:195 sets `hints.ai_flags = AI_ADDRCONFIG;`, which commit 42136433c added.
- Possible future slice, if the cause is confirmed: skip AI_ADDRCONFIG when the host is a loopback name (about 5 lines in happy-eyeballs.c).
- Related: none.

### [#11620](https://github.com/obsproject/obs-studio/issues/11620) — Crash when connecting to an SRT server fails
**Verdict: ALREADY_ADDRESSED**
In 31.0, a failed `connect_mpegts_url` freed the URLContext but left `stream->h` pointing at it. A later close then dereferenced the stale `priv_data`, which is the invalid `s` that gdb shows in `libsrt_close`. Commit 467967eab (in 32.0.0-beta1) added `has_connected`, so `close_mpegts_url` now runs only after a successful connect. Commit 651544a48 ("Reimplement reconnection logic in mpegts muxer") lists #11620 as fixed.
- Evidence:
  - plugins/obs-ffmpeg/obs-ffmpeg-mpegts.c:349-366 — `has_connected` handling, and close plus free on failure.
  - plugins/obs-ffmpeg/obs-ffmpeg-mpegts.c:585-590 — `close_mpegts_url` runs only when `has_connected` is set.
  - The commit message of 651544a48 says "Fixes bugs #11885, #11721, #11620, #11062, #12133".
- Leftover issue, not a crash: when the socket-state check fails, `libsrt_open` calls `libsrt_close` (obs-ffmpeg-srt.h:831) and the failure path then calls it a second time (mpegts.c:362). The second call fails gracefully at `srt_close`.
- Related: #11721.

### [#11645](https://github.com/obsproject/obs-studio/issues/11645) — Crash calling GetOutputList via WebSocket during profile change
**Verdict: CANNOT_VERIFY**
The crash log is only online, and the crash involves outputs from the third-party Aitum plugin. obs-websocket's `GetOutputList` runs inside `obs_enum_outputs`, which holds `outputs_mutex`, and the libobs getters it calls are null-safe. A raw output whose `video` or encoder was torn down by a plugin could still crash, but we can't show that without the stack.
- Evidence:
  - plugins/obs-websocket/src/utils/Obs_ArrayHelper.cpp:358-388 — the enum callback.
  - libobs/obs.c:1942-1945 — the enum takes the mutex.
  - libobs/obs-encoder.c:1055-1070 and libobs/media-io/video-io.c:596-599 — the width getters have null guards.
- Related: none.

### [#11655](https://github.com/obsproject/obs-studio/issues/11655) — Hang at boot autostart with --startreplaybuffer
**Verdict: CANNOT_VERIFY**
The only evidence is a hang dump on a file-sharing site. This looks like a boot-time race where devices or the GPU aren't ready yet, and the report doesn't point at specific code.
- Related: #11292, #11726.

### [#11676](https://github.com/obsproject/obs-studio/issues/11676) — Can't choose BGR24 vs BGR32 on a DirectShow capture card
**Verdict: DEFER_LARGE**
The root cause is clear. libdshowcapture maps MEDIASUBTYPE_RGB24 to `VideoFormat::XRGB`, and choosing XRGB forces MEDIASUBTYPE_RGB32, so a 24-bit format can never be selected. win-dshow has no RGB24 entry and no BGR3 mapping, even though libobs supports VIDEO_FORMAT_BGR3. The fix has to change both win-dshow and the libdshowcapture git submodule. The submodule is a separate upstream repo, so we would need a fork, a commit there and a submodule bump. It would also need bottom-up DIB handling for 24-bit frames, and only matching hardware could validate it. That is not a small, self-contained slice in this repo.
- Evidence:
  - deps/libdshowcapture/src/source/dshow-formats.cpp:285-288 — RGB24 and RGB32 both map to XRGB.
  - deps/libdshowcapture/src/source/device.cpp:350-355 — XRGB forces RGB32. RGB24 is only reachable as `VideoFormat::RGB24`, and nothing produces that value.
  - plugins/win-dshow/win-dshow.cpp:1392-1399 — the format name list has no RGB24.
  - plugins/win-dshow/win-dshow.cpp:418-423 — `ConvertVideoFormat` has no BGR3 case.
  - libobs/media-io/video-io.h:56 — VIDEO_FORMAT_BGR3 exists.
  - .gitmodules — libdshowcapture is a submodule.
- Related: none.

### [#11683](https://github.com/obsproject/obs-studio/issues/11683) — Rescale Output dropdown entries appear concatenated when canvas > monitor
**Verdict: CANNOT_VERIFY**
The screenshot can't be read offline, and the thread (fetched) has no comments. `ResetDownscales` clears all three combos before refilling them, so the logic has no duplicate or append bug. The symptom is probably a Qt popup layout or rendering problem that needs a repro.
- Evidence: frontend/settings/OBSBasicSettings.cpp:1472-1585 — `clear()` at 1499-1501, then one `addItem` per scale at 1527-1529.
- Related: none.

### [#11692](https://github.com/obsproject/obs-studio/issues/11692) — RTMP output ignores all server messages (e.g. ping) while publishing
**Verdict: DEFER_LARGE**
The report is correct. `process_recv_data` reads each packet and discards it. As a result OBS never answers PingRequests and never applies server Set Chunk Size or Window Ack messages. librtmp already has `RTMP_ClientPacket` and `HandleCtrl`, which would send a pong. The problem is that the receive path runs alongside the send thread, so answering would mean writing to the socket from a second thread. That needs locking on the send path and a decision about which message types to handle. It is a design change in a hot path, not a small slice.
- Evidence:
  - plugins/obs-outputs/rtmp-stream.c:248-270 — the "do processing here" stub.
  - plugins/obs-outputs/librtmp/rtmp.c:1310-1327 — `RTMP_ClientPacket` dispatches to `HandleCtrl`.
  - plugins/obs-outputs/librtmp/rtmp.c:3618 — `HandleCtrl` sends the ping response via `RTMP_SendCtrl`.
- Related: none.

### [#11700](https://github.com/obsproject/obs-studio/issues/11700) — Stats network section stops updating after a quick stream restart
**Verdict: CANNOT_VERIFY**
The stats dialog calls `obs_frontend_get_streaming_output()` again on every tick. `OutputLabels::Update` resets its baselines when the byte or frame counters go backwards. The screenshot isn't available and nothing in this code explains a stuck section. The likely cause is a race where the old output is still stopping while the new one starts, which needs a repro.
- Evidence: frontend/widgets/OBSBasicStats.cpp:269-283, 421 and 491-560.
- Related: none.

### [#11721](https://github.com/obsproject/obs-studio/issues/11721) — OBS ignores SRT rejection codes and stays in "Connecting..."
**Verdict: ALREADY_ADDRESSED**
Master now maps SRT rejection reasons to OBS output errors: a bad secret becomes BAD_PATH, other rejections become CONNECT_FAILED, and timeouts are handled. It also checks the socket state after `srt_connect` before reporting success. Commit 651544a48 rewrote the mpegts start/stop/reconnect pipeline and lists #11721 as fixed.
- Evidence:
  - plugins/obs-ffmpeg/obs-ffmpeg-srt.h:90-135 — `libsrt_neterrno` handles SRT_ECONNREJ with `srt_getrejectreason`.
  - plugins/obs-ffmpeg/obs-ffmpeg-srt.h:824-836 — the "SRT socket not connected after open" check.
  - plugins/obs-ffmpeg/obs-ffmpeg-mpegts.c:465-480 — a user-facing error message for each code.
  - The commit message of 651544a48.
- Related: #11620.

### [#11726](https://github.com/obsproject/obs-studio/issues/11726) — Replay buffer won't save or stop with AMD HEVC
**Verdict: CANNOT_VERIFY**
The problem started after switching from NVENC to the AMD AMF HEVC encoder, which points to the AMF encoder or the driver stalling packet flow. The only evidence is a dump on Google Drive. We have no AMD hardware and can't identify a code defect.
- Related: #11292, #11655.

### [#11734](https://github.com/obsproject/obs-studio/issues/11734) — DeckLink output fails above 1080p60
**Verdict: CANNOT_VERIFY**
The output code takes whatever mode the device enumerates, enables it, and creates BGRA frames (10-bit RGBX for HDR) at that size. OBS code has no resolution cap. The failure is probably a mode or pixel-format support problem, such as 8-bit BGRA at 2160p60 over 12G-SDI or quad-link. The log that would show which call fails is only online, and diagnosis needs DeckLink 8K hardware.
- Evidence: plugins/decklink/decklink-device-instance.cpp:554-558 (`EnableVideoOutput`), 586, and 600-610 (`CreateVideoFrame` with BGRA); plugins/decklink/decklink-device.cpp:80-90 (output mode iteration).
- Related: #11398 (same plugin).

### [#11765](https://github.com/obsproject/obs-studio/issues/11765) — Window capture (WGC) goes black when switching virtual desktops
**Verdict: OUT_OF_SCOPE**
Windows Graphics Capture only receives frames for windows that DWM is compositing, and windows on an inactive virtual desktop aren't composited. This is the same OS limitation that applies to minimized windows. The reporter says 30.2.3 behaves the same way, so this is not an OBS regression. OBS has no virtual-desktop handling, and adding one would mean working around the OS.
- Evidence: a grep of plugins/, libobs/ and shared/ finds no reference to IVirtualDesktopManager or virtual desktops.
- Related: none.
