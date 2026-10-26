# Triage batch outputs-services-03

- Batch: outputs-services-03 (area hint: outputs-services)
- Items: 9011, 9037, 9399, 9428, 9635, 9764, 9820, 9887, 9926, 9933, 9972, 10054, 10195, 10198, 10201, 10235, 10302, 10342, 10353, 10392
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; code read at master; PR heads at `refs/upstream-pr/N`. No GitHub comment threads consulted (no WebFetch used).
- Tooling note: local git is 2.33, which has no `merge-tree --write-tree`; applicability was checked with `git diff master...refs/upstream-pr/N | git apply --check`.

Summary:

| # | Kind | Verdict |
|---|------|---------|
| 9011 | issue | CANNOT_VERIFY |
| 9037 | issue | CANNOT_VERIFY |
| 9399 | issue | OUT_OF_SCOPE (works as designed) |
| 9428 | issue | CANNOT_VERIFY |
| 9635 | issue | CANNOT_VERIFY |
| 9764 | issue | CANNOT_VERIFY |
| 9820 | issue | IMPLEMENT |
| 9887 | issue | CANNOT_VERIFY |
| 9926 | issue | CANNOT_VERIFY |
| 9933 | issue | CANNOT_VERIFY |
| 9972 | issue | IMPLEMENT |
| 10054 | issue | CANNOT_VERIFY |
| 10195 | issue | CANNOT_VERIFY |
| 10198 | issue | ALREADY_ADDRESSED |
| 10201 | issue | CANNOT_VERIFY |
| 10235 | issue | CANNOT_VERIFY |
| 10302 | issue | DEFER_LARGE |
| 10342 | issue | IMPLEMENT |
| 10353 | PR | DEFER_LARGE |
| 10392 | PR | IMPLEMENT (cherry-pick with re-format) |

---

### [#9011](https://github.com/obsproject/obs-studio/issues/9011) — Streaming Diablo 4 keep crashing my OBS on 3080ti

- Verdict: **CANNOT_VERIFY**
- Reasoning: OBS 29.1.2 crashes after 1-2 hours only when capturing one specific game on an RTX 3080 Ti. The only data is external log/crash-log URLs, which have no stack in the issue body. This is game/GPU/driver specific; no code defect can be located from the report, and the version is three-plus major releases old.
- Evidence: issue body only (no stack trace); nothing in-tree to correlate.
- Related: none.

### [#9037](https://github.com/obsproject/obs-studio/issues/9037) — Changing Text Source while streaming hangs OBS

- Verdict: **CANNOT_VERIFY**
- Reasoning: after streaming 8 hours to three targets, changing a GDI+ text source font/transform in studio mode hung the UI and the stream showed grey/corrupt video. That combines a UI deadlock with encoder corruption, and the report gives no hang dump or thread stacks. The repro needs long sessions and several third-party pieces (VLC source, USB capture). No specific lock-order or text-source defect can be shown from the code.
- Evidence: `plugins/obs-text/gdiplus/obs-text.cpp` (font update path), which shows no obvious issue without a stack; the report attaches only a plain log.
- Related: none.

### [#9399](https://github.com/obsproject/obs-studio/issues/9399) — Mandatory protocol entry leads to confusing "Invalid path or URL" error

- Verdict: **OUT_OF_SCOPE** (works as designed)
- Reasoning: with a custom server, the protocol is inferred only from the URL scheme. Anything without `rtmps://`, `srt://` or `rist://` is treated as RTMP and passed to librtmp, which requires an `rtmp://` scheme, so start fails with `OBS_OUTPUT_BAD_PATH`. The frontend then shows "Invalid Path or Connection URL", which accurately describes a server address without a scheme. Guessing a scheme (for example, silently prepending `rtmp://`) would be a UX/policy change for maintainers, not a bug fix. A possible future nicety is a settings-time hint when the custom server has no `://`, but this report does not call for it.
- Evidence:
  - `plugins/rtmp-services/rtmp-custom.c:112-125`: `rtmp_custom_get_protocol` defaults to "RTMP" when no known prefix.
  - `frontend/settings/OBSBasicSettings_Stream.cpp:686-720`: `FindProtocol` uses the same prefix sniffing.
  - `plugins/obs-outputs/rtmp-stream.c:1169,1180`: URL parse failure returns `OBS_OUTPUT_BAD_PATH`.
  - `plugins/obs-outputs/librtmp/parseurl.c:27`: `RTMP_ParseURL` requires a scheme.
- Related: none.

### [#9428](https://github.com/obsproject/obs-studio/issues/9428) — OBS refuses to monitor AND output certain mp3 files

- Verdict: **CANNOT_VERIFY**
- Reasoning: MP3s with embedded album art do not get monitored after a source is deactivated and reactivated, while MP3s without art work. Album art is exposed by FFmpeg as a video stream (attached picture), and media-playback opens it as a real video stream (`has_video`), which changes the timing/EOF logic. That is a plausible lead, but no code path specifically disables *monitoring* (as opposed to output) because of it. Skipping attached-picture streams would also remove the album-art display some users rely on, so it is not a safe blind fix. Needs a debugger repro with the attached sample file.
- Evidence:
  - `shared/media-playback/media-playback/media.c:710`: `has_video = mp_decode_init(m, AVMEDIA_TYPE_VIDEO, ...)`; no `AV_DISPOSITION_ATTACHED_PIC` handling anywhere in `shared/media-playback` or `plugins/obs-ffmpeg`.
  - `shared/media-playback/media-playback/media.c:542,621`: video presence alters local-file timing/end logic.
- Related: none.

### [#9635](https://github.com/obsproject/obs-studio/issues/9635) — OBS goes into broken state after trying to stop recording via WebSocket

- Verdict: **CANNOT_VERIFY**
- Reasoning: this takes 8-9 days of continuous RTMP streaming with periodic WebSocket record start/stop to reproduce. The recording gets stuck in "Stopping" and the stream sends 0 bit/s, and only a reboot recovers it, which points to a system/network/driver-level stall rather than an OBS logic error. There is no stack or hang dump. obs-websocket is a separate submodule.
- Evidence: issue body only. Stop flow `frontend/widgets/OBSBasic_Recording.cpp` shows no identifiable defect without more data.
- Related: none.

### [#9764](https://github.com/obsproject/obs-studio/issues/9764) — OBS crashes upon clicking Start Recording (EndeavourOS, AUR git build)

- Verdict: **CANNOT_VERIFY**
- Reasoning: an unofficial AUR git package from Oct 2023 on KDE with no crash backtrace. The crash is most likely packaging- or encoder-specific (VAAPI/FFmpeg on that distro). Nothing actionable in code.
- Evidence: issue body only; no stack.
- Related: none.

### [#9820](https://github.com/obsproject/obs-studio/issues/9820) — Saving the replay buffer with too little disk space stops replay and discards the buffer

- Verdict: **IMPLEMENT**
- Reasoning: the replay buffer lives in memory, so low disk space should not discard it. In current code, a failed save (`replay_buffer_mux_thread` error path) only logs, releases the mux copies and skips the "saved" signal. It does **not** deactivate the output, so the save failure alone no longer kills the buffer. The remaining code path that discards the in-memory buffer because of disk space is `OBSBasic::CheckDiskSpaceRemaining`. That 1 s timer, armed while recording is active, unconditionally calls `StopReplayBuffer()` along with `StopRecording()`, which tears down the buffer (`replay_buffer_clear`). That is exactly the "simplest fix" the reporter asked for. The smallest slice is to stop only the recording there and leave the replay buffer running, so the user can free space and save afterwards.
- Evidence:
  - `frontend/widgets/OBSBasic_Recording.cpp:423-430`: `CheckDiskSpaceRemaining` calls `StopRecording(); StopReplayBuffer();`.
  - `frontend/widgets/OBSBasic_Recording.cpp:174-176`: the disk-full timer starts on recording start.
  - `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:1105-1121`: a replay mux error releases packets but does not stop the output.
  - `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:1180-1191`: `deactivate_replay_buffer` calls `replay_buffer_clear`, which is where the buffer is lost.
  - `frontend/widgets/OBSBasic_ReplayBuffer.cpp:89-92`: starting the replay buffer is still refused on low disk (unchanged, which is reasonable).
- Slice plan:
  - In `frontend/widgets/OBSBasic_Recording.cpp` `CheckDiskSpaceRemaining`, remove the `StopReplayBuffer();` call so only recording is stopped on low disk. Optionally add a comment that the replay buffer is memory-backed.
  - Optional (still small): when a replay save fails in `replay_buffer_mux_thread`, emit a warning (log already exists). The UI notification is out of the minimal slice.
  - About 3 lines changed.
- Test plan: build the `obs-studio` frontend with MSVC. Manual check: set the recording path to a nearly full volume (or a small VHD), start recording plus the replay buffer, and confirm that recording stops with the low-space message while the replay buffer stays active and can be saved after freeing space. No cmocka coverage for frontend.
- Related: 9926, 10054 (other replay-buffer reports).

### [#9887](https://github.com/obsproject/obs-studio/issues/9887) — Video artifacts with Rescale Output enabled on OBS 30.0 (AMF H264)

- Verdict: **CANNOT_VERIFY**
- Reasoning: this is labelled confirmed upstream, but it only reproduces with the AMD AMF H.264 encoder plus GPU rescale at non-mod-16 sizes (1536x864, 1462x822) in mostly static scenes. That points to encoder rate-control/skip-block behaviour on AMD hardware or the GPU-rescale texture path feeding AMF. Without AMD hardware and the encoder-side details, no specific defect can be pinned in code.
- Evidence: issue body (hardware specific). AMF encoder at `plugins/obs-ffmpeg/texture-amf.cpp`, with no identifiable rescale bug from inspection.
- Related: none.

### [#9926](https://github.com/obsproject/obs-studio/issues/9926) — Replay Buffer suspended

- Verdict: **CANNOT_VERIFY**
- Reasoning: the replay buffer becomes unresponsive (cannot stop or save) after Windows memory compression while minimized to tray, with a 4 GB buffer. Memory compression is transparent to applications, so this is most likely a hang elsewhere (for example in the mux thread join or output stop). There is no hang dump or thread stacks, so no code defect can be identified.
- Evidence: `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:1227-1236` (mux thread join on save), which shows no identifiable deadlock without stacks.
- Related: 10054, 9820.

### [#9933](https://github.com/obsproject/obs-studio/issues/9933) — Replay buffer does not respect maximum time setting (Arch Linux)

- Verdict: **CANNOT_VERIFY**
- Reasoning: the time/size purge in the replay buffer only runs once more than two video keyframes are buffered (`stream->keyframes <= 2` returns early). If the configured encoder emits no keyframes (keyframe interval 0 / "auto" mapping to an effectively infinite GOP on some Linux encoder paths) or doesn't flag them, the buffer grows from start, which matches the symptom. However, the encoder settings are only in the external log, and the purge logic itself is correct for normal GOPs. A fix depends on which encoder misbehaved, so no defect is confirmed in OBS code.
- Evidence:
  - `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:1031-1045`: `replay_buffer_purge` skips purging while `keyframes <= 2`.
  - `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:1224-1225`: keyframes counted only from `packet->keyframe` on video packets.
- Related: none.

### [#9972](https://github.com/obsproject/obs-studio/issues/9972) — Memory leak at reconnecting RTMP

- Verdict: **IMPLEMENT**
- Reasoning: the defect is confirmed in code. In `send_thread`, a packet is dequeued by `get_next_packet`. If `send_headers` fails, the loop `break`s without releasing that packet, while every other early exit in the loop releases it (for example, the `can_shutdown_stream` branch). That leaks one encoder packet reference (and its data) per failed header send, exactly as the reporter's patch shows. The one-line release is correct because the packet has not been handed off anywhere else.
- Evidence:
  - `plugins/obs-outputs/rtmp-stream.c:650`: `get_next_packet(stream, &packet)` takes ownership.
  - `plugins/obs-outputs/rtmp-stream.c:653-657`: other break path releases the packet.
  - `plugins/obs-outputs/rtmp-stream.c:660-664`: `send_headers` failure path breaks **without** `obs_encoder_packet_release(&packet)`.
- Slice plan: add `obs_encoder_packet_release(&packet);` before the `break` in the `!send_headers(stream)` branch of `send_thread` (`plugins/obs-outputs/rtmp-stream.c`). One line. Credit the reporter's diff in the commit message.
- Test plan: build the `obs-outputs` plugin with MSVC. A full repro needs a local RTMP server killed mid-handshake with stream delay enabled; if that is not done, mark it UNTESTED (logic-only, verified by inspection).
- Related: none.

### [#10054](https://github.com/obsproject/obs-studio/issues/10054) — Replay Buffer fails to stop on exit, causing OBS to hang

- Verdict: **CANNOT_VERIFY**
- Reasoning: an intermittent (about 25%) hang when exiting from the system tray with the replay buffer running. No hang dump or stacks are given, and the reporter suspects it relates to #9926. The stop path waits for the output to finish; without stacks it cannot be said which wait deadlocks.
- Evidence: `frontend/widgets/OBSBasic_ReplayBuffer.cpp:119-130` (`StopReplayBuffer`) and `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:1180-1191` (`deactivate_replay_buffer`), with no identifiable defect by inspection.
- Related: 9926.

### [#10195](https://github.com/obsproject/obs-studio/issues/10195) — Display Capture captures second screen only for both display options

- Verdict: **CANNOT_VERIFY**
- Reasoning: this started after a GPU driver update and Windows feature updates together with the OBS update. Both monitor entries showing the same (portrait) display is typical of DXGI duplication/driver enumeration on hybrid or recently updated drivers. There is no reproducible code-level cause.
- Evidence: issue body only (Windows/driver specific).
- Related: none.

### [#10198](https://github.com/obsproject/obs-studio/issues/10198) — Replay buffer button highlighted blue while buffer is not running

- Verdict: **ALREADY_ADDRESSED**
- Reasoning: in 30.x the controls button was a checkable `QPushButton`, so a click toggled its checked (blue) state even when `StartReplayBuffer` returned early. For example, `ReplayBufferActive()` is still true while the previous stop is draining, which is exactly the quick off/on "flush" the reporter does. Commit 76e181886 ("frontend: Highlight control dock buttons using style class") made the buttons non-checkable. The highlight is now applied only from the `ReplayBufStarted` signal and removed on `ReplayBufStopped`, so the visual state can no longer diverge from the real output state. A click during stopping is still a no-op, but it is no longer misleading.
- Evidence:
  - `frontend/widgets/OBSBasicControls.cpp:226-245`: `state-active` class set/cleared only from started/stopped signals.
  - `frontend/widgets/OBSBasicControls.cpp:30-32`: plain `clicked` forwarding, no check state.
  - `frontend/widgets/OBSBasic_ReplayBuffer.cpp:68-75`: `StartReplayBuffer` returns early if still active.
  - Commit `76e181886`.
- Related: none.

### [#10201](https://github.com/obsproject/obs-studio/issues/10201) — OBS window width grows past screen when pressing Start Streaming

- Verdict: **CANNOT_VERIFY**
- Reasoning: on a 1080-wide portrait monitor, starting a stream widens the main window. This is likely the status bar's streaming widgets plus the dock minimum widths summing past 1080 px, but it depends on the user's dock layout, theme and font scaling. No specific widget or minimum-size bug can be identified from the report alone.
- Evidence: issue body only (no layout file). The status bar is in `frontend/widgets/OBSBasicStatusBar.cpp`, with no single culprit identifiable.
- Related: none.

### [#10235](https://github.com/obsproject/obs-studio/issues/10235) — Windowed Projector padded when streamed via Discord

- Verdict: **CANNOT_VERIFY**
- Reasoning: Discord's window capture of an OBS windowed projector includes padding in 30.x but not in older versions. The capture is performed by Discord, a third-party app, and depends on how it sizes the captured HWND/DWM surface. Nothing in the report identifies an OBS projector geometry bug (the projector renders correctly on screen, per the reporter's first image).
- Evidence: issue body only. Projector code is in `frontend/widgets/OBSProjector.cpp`, with nothing identifiable.
- Related: none.

### [#10302](https://github.com/obsproject/obs-studio/issues/10302) — Unstable SRT media source latency requiring manual reset

- Verdict: **DEFER_LARGE**
- Reasoning: the media source (FFmpeg-based) has no live-latency catch-up. Once the demux/decoder buffer accumulates (network jitter at connect time, `buffering_mb` default 2 MB), playback stays that far behind until the source is restarted, which matches "hide/unhide fixes it". Fixing this properly needs a latency-control feature in media-playback (drop or speed up to a target latency for non-local inputs, possibly a new property). That is a design change, not a small bug fix.
- Evidence:
  - `plugins/obs-ffmpeg/obs-ffmpeg-source.c:125,179,302`: network buffering setting fed to media-playback.
  - `shared/media-playback/media-playback/media.c`: no target-latency or catch-up logic for non-local streams.
- Related: none.

### [#10342](https://github.com/obsproject/obs-studio/issues/10342) — Audio monitoring device doesn't persist when the default system output changes (PulseAudio)

- Verdict: **IMPLEMENT**
- Reasoning: the PulseAudio monitoring stream connects to an explicit sink name but without `PA_STREAM_DONT_MOVE`. When the desktop (GNOME) switches the default sink, it moves all movable sink-inputs to the new default, including OBS's monitoring stream, even though the user selected a specific device. When the user picks a specific device (id != "default"), the stream should be marked non-movable. When "default" is selected, it should stay movable so it follows the system default (the "default" id is resolved to a concrete sink name, so the flag must be keyed on the original id, not `monitor->device`). Trade-off: with `DONT_MOVE`, unplugging the chosen device kills the stream instead of moving it. That matches the user's explicit choice, and re-selecting the device restarts monitoring.
- Evidence:
  - `libobs/audio-monitoring/pulse/pulseaudio-output.c:374-377`: "default" resolved to the concrete default sink id, otherwise the explicit id is kept.
  - `libobs/audio-monitoring/pulse/pulseaudio-output.c:438-440`: flags are `INTERPOLATE_TIMING | AUTO_TIMING_UPDATE | START_CORKED`, with no `PA_STREAM_DONT_MOVE`.
  - `libobs/audio-monitoring/pulse/pulseaudio-wrapper.c:364`: `pa_stream_connect_playback(s, device, attr, flags, ...)`.
- Slice plan: in `audio_monitor_init` record whether `id` was "default" (a local bool or a new `bool follows_default` field in `struct audio_monitor`). When building `flags`, OR in `PA_STREAM_DONT_MOVE` if not following the default. About 5-8 lines in `libobs/audio-monitoring/pulse/pulseaudio-output.c`.
- Test plan: Linux-only code that is not compiled on this Windows x64 box, so it is **UNTESTED**. Mark it UNTESTED in the commit message. A manual repro on Linux would follow the issue's steps 0-10.
- Related: none.

### [#10353](https://github.com/obsproject/obs-studio/pull/10353) — obs-webrtc: Add WHEP Source

- Verdict: **DEFER_LARGE**
- Reasoning: this is a new feature, about 1,070 lines added and 400 removed across 10 files. It refactors the WHIP output into shared WebRTC utilities and adds a full WHEP source. It no longer applies: `CMakeLists.txt`, `whip-output.cpp/.h` and `whip-utils.h` conflict, and `cmake/legacy.cmake` no longer exists in master. It is in scope for OBS, but it is far beyond a small slice and would need a substantial rebase plus a maintainer design review (UI and refactor split).
- Evidence:
  - `git diff master...refs/upstream-pr/10353 --stat`: 10 files, +1071/-402.
  - `git apply --check` fails on `plugins/obs-webrtc/CMakeLists.txt`, `whip-output.cpp`, `whip-output.h` and `whip-utils.h`; `plugins/obs-webrtc/cmake/legacy.cmake` is missing.
- Related: none.

### [#10392](https://github.com/obsproject/obs-studio/pull/10392) — decklink: Output BGRA only when supported

- Verdict: **IMPLEMENT** (cherry-pick-pr, with manual conflict resolution)
- Reasoning: master still unconditionally configures DeckLink output for 8-bit BGRA (non-HDR), both in the OBS video conversion (`to.format = VIDEO_FORMAT_BGRA`, full range) and in the DeckLink frame format (`bmdFormat8BitBGRA`, `rowSize = width * 4`). Display modes whose hardware does not accept BGRA therefore get a corrupted image (upstream issue #10380). The PR queries `DoesSupportVideoMode(..., bmdFormat8BitBGRA, ...)` and falls back to `bmdFormat8BitYUV`/UYVY (partial range, 2 bytes per pixel), disabling the keyer when BGRA is unsupported. The frame copy path already uses the source `linesize`, so UYVY works with the existing copy code. The patch no longer applies textually only because of the later clang-format column change (80 to 120) and the braces reformat. The logic is unchanged in master, so re-applying by hand is mechanical. 2 files, about 64 changed lines. Contributions are GPL-2.0-or-later, and authorship is preserved.
- Evidence:
  - `plugins/decklink/decklink-output.cpp:35`: `to.format = VIDEO_FORMAT_BGRA;` unconditionally.
  - `plugins/decklink/decklink-device-instance.cpp:586-587`: `rowSize = GetWidth() * 4`.
  - `plugins/decklink/decklink-device-instance.cpp:600`: `pixelFormat = enable_hdr ? bmdFormat10BitRGBXLE : bmdFormat8BitBGRA`.
  - `plugins/decklink/decklink-device-instance.cpp:572-581`: keyer enabled regardless of format support.
  - `plugins/decklink/decklink-device-instance.cpp:666`: copy uses `frame->linesize[0]`, which is format-agnostic.
  - `git apply --check` conflicts in both files, from reformat commits `a1fbf1015` (clang-format 120 cols) and `30b63c684` (braces).
- Slice plan: cherry-pick `ebd5aa941` from `refs/upstream-pr/10392`, then resolve the conflicts by re-applying the hunks to the reformatted code. In `decklink-device-instance.cpp`, add `PixelFormatByteSize` and the `DoesSupportVideoMode` query, gate the keyer, and move the blob allocation after the pixel format choice. In `decklink-output.cpp`, add the BGRA support query and choose BGRA or UYVY plus the range. Drop the unrelated `UNUSED_PARAMETER` cleanup hunk if it conflicts. Run clang-format (120 columns). Keep the original author.
- Test plan: build the `decklink` plugin with MSVC (the DeckLink SDK headers are vendored in-tree). Runtime behaviour needs Blackmagic hardware that is not available, so mark it **UNTESTED** (build-only) in the commit message.
- Related: upstream issue #10380 (not in this batch).
