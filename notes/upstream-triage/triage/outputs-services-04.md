# Upstream triage — batch outputs-services-04

- Batch: outputs-services-04 (area hint: outputs-services)
- Items: 10457, 10544, 10595, 10652, 10653, 10731, 10746, 10750, 10900, 10907, 10923, 10932, 10937, 10944, 11013, 11062, 11083, 11086, 11123, 11133
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json` (no comment threads); PR heads from `refs/upstream-pr/<N>`; current code read on master. Local git is 2.33, which has no `merge-tree --write-tree`, so applicability was checked with `git apply --check` (plain and `-3`) on a diff saved to the scratchpad. The working tree was not modified.
- Note: upstream moved `UI/` to `frontend/` (and `UI/frontend-plugins/frontend-tools` to `plugins/frontend-tools`), so older PRs that touch `UI/` do not apply as-is.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 10457 | issue | CANNOT_VERIFY |
| 10544 | PR | DEFER_LARGE |
| 10595 | issue | IMPLEMENT (new-change) |
| 10652 | PR | DEFER_LARGE |
| 10653 | PR | IMPLEMENT (cherry-pick-pr, trivial context fixup) |
| 10731 | issue | CANNOT_VERIFY |
| 10746 | issue | CANNOT_VERIFY |
| 10750 | issue | ALREADY_ADDRESSED |
| 10900 | issue | IMPLEMENT (new-change, supersedes #10937) |
| 10907 | issue | DEFER_LARGE |
| 10923 | issue | IMPLEMENT (new-change) |
| 10932 | issue | CANNOT_VERIFY |
| 10937 | PR | IMPLEMENT (same slice as #10900; PR's condition is inverted the wrong way) |
| 10944 | issue | CANNOT_VERIFY |
| 11013 | PR | IMPLEMENT (cherry-pick-pr) |
| 11062 | issue | CANNOT_VERIFY |
| 11083 | issue | CANNOT_VERIFY |
| 11086 | issue | CANNOT_VERIFY |
| 11123 | PR | DEFER_LARGE |
| 11133 | issue | DEFER_LARGE |

---

### [#10457](https://github.com/obsproject/obs-studio/issues/10457) — Instant-replay.lua media source not playing properly when using Rescale Output

**Verdict:** CANNOT_VERIFY

**Reasoning:** The reporter (AV1, Windows 11) saves a replay buffer with recording "Rescale Output" turned on. The resulting file plays fine in other players but plays slowly in an OBS media source, and the speed setting has no effect. That points to a timestamp or timebase mismatch between the rescaled encoder output and how media-playback reads the file. The rescale goes through a separate GPU-scaled video mix (`libobs/obs-video.c` scale path, `obs_encoder_set_gpu_scale_type` in `libobs/obs-encoder.c:966`), and the replay muxes through `replay_buffer_save` (`plugins/obs-ffmpeg/obs-ffmpeg-mux.c:1125`). Nothing in either path shows an obvious timebase defect without the file and a repro. It may also depend on the encoder or driver (AV1 hardware encoder).

**Evidence:**
- `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:1125` — replay_buffer_save reorders packets and offsets timestamps; there is no rescale-specific branch.
- `libobs/obs-video.c:219-262` — choice of scale effect for scaled mixes; no timing logic.

**Related:** none

---

### [#10544](https://github.com/obsproject/obs-studio/pull/10544) — obs-webrtc: Add multitrack audio support

**Verdict:** DEFER_LARGE

**Reasoning:** This is a feature PR (about 93+/44-) that changes the WHIP output to send several audio tracks and adds UI plumbing. It no longer applies. Its `UI/` files are now in `frontend/`, and `git apply -3` gives conflicts in `plugins/obs-webrtc/whip-output.cpp` and `whip-output.h`. Current master still creates a single audio track from encoder 0 (`whip-output.cpp:140-162`). Porting it means reworking it against the reworked WHIP output (simulcast and multi-track AV flags at `whip-output.cpp:735`) and the new frontend layout. It also needs a decision on WHIP SDP/track semantics, and the motivation is only "requested in Discord". This is not a small slice.

**Evidence:**
- `plugins/obs-webrtc/whip-output.cpp:140-162` — only `obs_output_get_audio_encoder(output, 0)` gets a track.
- `plugins/obs-webrtc/whip-output.cpp:735` — base flags already include `OBS_OUTPUT_MULTI_TRACK_AV`, so the code has diverged since the PR.
- The `git apply --check` failures are listed above.

**Related:** none

---

### [#10595](https://github.com/obsproject/obs-studio/issues/10595) — Replay Buffer Options Are "Locked" When 'Rate Control' Is Set To Lossless

**Verdict:** IMPLEMENT

**Reasoning:** In Advanced output mode, the settings dialog greys out the whole replay buffer group whenever the recording encoder's `rate_control` is `"lossless"` (`frontend/settings/OBSBasicSettings.cpp:5228`, `5288-5290`). The backend has no such restriction. `AdvancedOutput` creates the replay buffer for any non-FFmpeg recording type (`frontend/utility/AdvancedOutput.cpp:81-90`), and the replay buffer works with lossless rate control, as the reporter confirms. The only case that really cannot have a replay buffer is the custom FFmpeg output (`advOutRecType == 1`), which never creates `replayBuffer`. With lossless there is no bitrate (`varRateControl` is false), so the dialog already falls back to the "max memory (MB)" limit, which is the right control for unbounded-bitrate encoders. The lock is therefore stricter than the code needs, and it forces users to switch rate control back and forth to edit the settings.

**Evidence:**
- `frontend/settings/OBSBasicSettings.cpp:5228` — `bool lossless = strcmp(rateControl, "lossless") == 0 || ui->advOutRecType->currentIndex() == 1;`
- `frontend/settings/OBSBasicSettings.cpp:5288-5290` — the replay buffer frame and checkbox are disabled when `lossless`.
- `frontend/settings/OBSBasicSettings.cpp:5262-5286` — a non-bitrate rate control already shows the MB limit (`advRBMegsMax`).
- `frontend/utility/AdvancedOutput.cpp:81-90` — the replay buffer is created whenever the output is not FFmpeg, whatever the rate control.

**Slice plan:**
- In `OBSBasicSettings::AdvReplayBufferChanged` (`frontend/settings/OBSBasicSettings.cpp`), base the lock only on the FFmpeg custom output: rename `lossless` to something like `rbUnsupported = ui->advOutRecType->currentIndex() == 1`, and drop the `rate_control == "lossless"` test (the `rateControl` lookup stays because it is used for the estimate).
- Simple mode's "Lossless" quality is left alone. It switches to the FFmpeg output (`frontend/utility/SimpleOutput.cpp:144`), which really does not support a replay buffer.
- About 3 to 5 changed lines, 1 file.

**Test plan:** Build `obs-studio` (frontend) with MSVC. Manual: Advanced output, recording encoder NVENC/QSV with rate control Lossless, then confirm the replay buffer group is editable, the MB limit shows, and the buffer starts and saves. Switch Type to "Custom Output (FFmpeg)" and confirm it is still disabled. Needs a GPU encoder that offers lossless; if none is available, the runtime check is UNTESTED.

---

### [#10652](https://github.com/obsproject/obs-studio/pull/10652) — libobs, plugins: Remove unnecessary output implementation calls

**Verdict:** DEFER_LARGE

**Reasoning:** This is a refactor and API deprecation, not a bug fix. It moves `obs_output_can_begin_data_capture()` / `obs_output_initialize_encoders()` into `obs_output_start()`, deprecates the public functions, and removes `obs_output_signal_delay()`. It touches 13 files across libobs and every output plugin, and changes when start-time checks run. The PR's own new code carries the comment "this block of logic is likely flawed. please investigate!". On current master it conflicts (`git apply --check` fails on `mp4-output.c`, `rtmp-stream.c`, `whip-output.cpp`). There are now 19 call sites in plugins, including outputs added since the PR. A behaviour-sensitive libobs change to the output lifecycle with no user-visible benefit should not be carried in a private fork.

**Evidence:**
- `libobs/obs.h:2226,2229` — both functions are still exported and not deprecated.
- 19 plugin call sites (`grep -rn obs_output_can_begin_data_capture\|obs_output_initialize_encoders plugins`).
- The PR's diff to `libobs/obs-output.c` adds the "likely flawed" comment block in `obs_output_start`.

**Related:** 10653 (same author, output lifecycle area)

---

### [#10653](https://github.com/obsproject/obs-studio/pull/10653) — libobs: Fix missing started signal upon second start of delayed output

**Verdict:** IMPLEMENT

**Reasoning:** I confirmed the root cause in current code. In `obs_output_signal_stop()`, the non-reconnect branch clears `delay_active` before it calls `obs_output_end_data_capture()` (`libobs/obs-output.c:3032-3033`). `obs_output_end_data_capture_internal()` resets `delay_capturing` only inside `if (delay_active(output))` (`libobs/obs-output.c:2891-2899`). Because `delay_active` has already been cleared, `delay_capturing` stays true. On the next start, `begin_delayed_capture()` returns early at `if (delay_capturing(output)) return false;` (`libobs/obs-output.c:2659-2660`), so `signal_start` never fires. `end_data_capture_internal` already clears `delay_active` itself (line 2895), so removing the early clear is safe. The PR's 2-line removal is still correct. It fails to apply only because master added a `reconnecting` reset line next to it, so a trivial context fixup is needed. The same early-clear pattern exists in `output_reconnect()` when retries run out (`libobs/obs-output.c:2966-2967`). I note it here but leave it out of the cherry-pick to keep the slice the PR's own change.

**Evidence:**
- `libobs/obs-output.c:3031-3036` — the else-branch clears `delay_active` and then calls `obs_output_end_data_capture`.
- `libobs/obs-output.c:2891-2899` — `delay_capturing` is reset only when `delay_active` is still set.
- `libobs/obs-output.c:2657-2672` — `begin_delayed_capture` returns before `signal_start` when `delay_capturing` is stale.
- `libobs/obs-output.c:2966-2967` — the same pattern on the reconnect-exhausted path (follow-up candidate, not in this slice).

**Slice plan:** Cherry-pick `01764c4e7` (author preserved), resolving the context conflict by hand: delete the two lines `if (delay_active(output)) os_atomic_set_bool(&output->delay_active, false);` in the else-branch of `obs_output_signal_stop` and keep the `reconnecting` reset. 2 lines removed.

**Test plan:** MSVC build of `libobs`. Runtime check: enable stream delay, stream to a local RTMP server (for example nginx-rtmp or MediaMTX, if one is available), stop gracefully, start again, and confirm the `started` signal and frontend "Streaming started" state through the obs-websocket `StreamStateChanged` events or the log. If no local server is available, mark it UNTESTED (runtime).

**Related:** 10652

---

### [#10731](https://github.com/obsproject/obs-studio/issues/10731) — Glitching/distorted audio on DeckLink Quad 2 output

**Verdict:** CANNOT_VERIFY

**Reasoning:** Intermittent audio dropouts on a Blackmagic DeckLink Quad 2 SDI output during video playout. This depends on the hardware and driver (Desktop Video), on the output's video/audio clocking, and on the source media. Without the hardware and a repro there is no defect to point to in `plugins/decklink`.

**Evidence:** `plugins/decklink/` output path (hardware-specific; not reproducible here).

**Related:** none

---

### [#10746](https://github.com/obsproject/obs-studio/issues/10746) — Anything with Subtract blending mode appears black in rescaled output

**Verdict:** CANNOT_VERIFY

**Reasoning:** The Subtract blend mode uses `GS_BLEND_OP_REVERSE_SUBTRACT` with ONE/ONE factors for both colour and alpha (`libobs/obs-scene.c:86-93`). Over an opaque background the result alpha is therefore 0 (1 - 1), while the colour stays correct. That likely explains why only "rescaled" outputs differ, since the preview ignores alpha. However, I could not find any alpha-dependent step in the current output scaling. `render_output_texture` disables blending (`libobs/obs-video.c:308`), and the bicubic, lanczos, area and bilinear-lowres shaders do not divide by alpha. The suspected root cause (alpha 0 from Subtract) is real, but the step that turns it into black is not identifiable from the code, and it may be driver- or encoder-scaler-specific. A possible fix would be for the Subtract blend to keep destination alpha (src alpha factor ZERO / dst ONE with ADD), but that is a visual-behaviour change I cannot justify without a repro.

**Evidence:**
- `libobs/obs-scene.c:86-93` — the Subtract blend applies reverse-subtract to alpha as well.
- `libobs/obs-video.c:282-310` — the scaled render uses `Draw` with blending disabled.
- `libobs/data/bicubic_scale.effect:84-160` — no alpha division.

**Related:** none

---

### [#10750](https://github.com/obsproject/obs-studio/issues/10750) — Recording does not check whether the target path exists already

**Verdict:** ALREADY_ADDRESSED

**Reasoning:** OBS does check whether the target exists. Unless "Overwrite if file exists" is set, `GetRecordingFilename` calls `FindBestFilename`, which appends ` (2)`, ` (3)` and so on when `os_file_exists` is true (`frontend/OBSApp.cpp:1577-1600`, `1719-1722`). The ffmpeg-mux replay and split-file path does the same (`plugins/obs-ffmpeg/obs-ffmpeg-mux.c:560-600`). The report is a narrower cross-process race: two OBS instances start recording in the same second, both check before either file exists, and both write the same path. Closing that race would need exclusive-create (`O_EXCL`) semantics inside the muxer subprocess and the native MP4 output. That is a niche multi-instance edge case, and per-profile filename formats work around it.

**Evidence:**
- `frontend/OBSApp.cpp:1577-1600` — `FindBestFilename`.
- `frontend/OBSApp.cpp:1719-1722` — called when `!overwrite`.
- `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:574-600` — `generate_filename` / `find_best_filename`.

**Related:** none

---

### [#10900](https://github.com/obsproject/obs-studio/issues/10900) — Output timer bug

**Verdict:** IMPLEMENT

**Reasoning:** I confirmed the defect in `plugins/frontend-tools/output-timer.cpp`. `RecordTimerStop()` / `StreamTimerStop()` start with `if (!isVisible() && recordingTimer->isActive() == false) return;` (lines 133 and 155). When the single-shot timer has already fired, so `isActive()` is false, and the dialog is closed, the stop handler returns before it resets the button text to "Start", unchecks the button, stops the 1 s display timer and clears the time label. The dialog therefore stays in the "Stop" state. The next button click then hits the `streamingAlreadyActive`/active branches inconsistently. The same happens when the recording timer was paused (it is stopped while paused). Resetting hidden widgets is harmless, so the correct fix is to remove the early return entirely.

PR #10937 instead inverts the condition to `isActive() == true`, which is wrong. If the user stops recording manually while the dialog is hidden and the timer is still running, the handler would return early and leave `recordingTimer` running. It would then fire later and call `obs_frontend_recording_stop()` on a different, later recording.

**Evidence:**
- `plugins/frontend-tools/output-timer.cpp:129-149` — `StreamTimerStop` early return.
- `plugins/frontend-tools/output-timer.cpp:151-171` — `RecordTimerStop` early return.
- `plugins/frontend-tools/output-timer.cpp:220-230` — `PauseRecordingTimer` stops the timer, which also triggers the bug.
- `plugins/frontend-tools/output-timer.cpp:296-305` — the stop handlers run on `*_STOPPING` frontend events whether or not the dialog is visible.

**Slice plan:** Remove the two `if (!isVisible() && xTimer->isActive() == false) { return; }` blocks in `StreamTimerStop` and `RecordTimerStop`. About 6 lines removed, 1 file. Credit #10937 (diagnosis) in the commit message.

**Test plan:** MSVC build of `frontend-tools`. Manual: set the record timer to 5 s, press Start, close the dialog, wait for it to expire, reopen it, and confirm the button reads "Start" and the time reads 00:00:00. Then start a recording by hand and confirm the timer does not stop it. Also stop a recording by hand mid-timer with the dialog hidden and confirm the timer is cancelled.

**Related:** 10937

---

### [#10907](https://github.com/obsproject/obs-studio/issues/10907) — Media source input removal causing audio cut off and monitoring desync on stream / recordings

**Verdict:** DEFER_LARGE

**Reasoning:** This is a consequence of libobs audio buffering. Monitoring plays a source's audio as soon as it arrives, but the output mix renders it later, after the global audio buffering delay. If a script removes the input on the "media ended" event, the source leaves the audio tree before its buffered tail is mixed, so the last 0.5 to 1 s, or all of a short clip, never reaches the stream or recording. Fixing this means keeping removed sources in the mix until their pending audio drains (deferred-removal semantics in the audio render tree). That is an architectural change, not a small slice. Workaround: delay the removal by the buffering amount.

**Evidence:**
- `libobs/obs-audio.c` — audio is mixed from sources that are active in the render tree at mix time, with buffering ticks; there is no drain-on-removal.
- `libobs/obs-source.c` — monitoring is fed directly from source audio output, ahead of mixing.

**Related:** 10944 (same monitor-vs-output timing gap)

---

### [#10923](https://github.com/obsproject/obs-studio/issues/10923) — Changes to "recording filename formatting" does not apply to already-running replay buffers

**Verdict:** IMPLEMENT

**Reasoning:** The replay buffer builds its filename at save time, from the output's settings (`generate_filename` reads `obs_output_get_settings()` `"format"`, `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:574-600`). The frontend pushes `"format"` into those settings only when the buffer starts (`frontend/utility/AdvancedOutput.cpp:889-914`; `frontend/utility/SimpleOutput.cpp:846-853`). Both modes build it from the same keys: `Output/FilenameFormatting` plus `SimpleOutput/RecRBPrefix` and `RecRBSuffix`. If `OBSBasic::ReplayBufferSave` re-applies the current format string just before calling the `save` proc, the requested behaviour follows naturally with a very small change. The buffered data does not depend on the filename, so nothing else is affected. Directory and extension stay as snapshotted at start, to keep the slice minimal and avoid changing the container mid-run.

**Evidence:**
- `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:574-582` — the filename comes from output settings when the save happens.
- `frontend/utility/AdvancedOutput.cpp:893-907` — the format is set only in `StartReplayBuffer`.
- `frontend/utility/SimpleOutput.cpp:834-853` — the same keys in simple mode.
- `frontend/widgets/OBSBasic_ReplayBuffer.cpp:154-168` — `ReplayBufferSave` calls the `save` proc directly.
- `frontend/OBSApp.hpp:294` — `GetFormatString` is available to the frontend.
- `libobs/obs-output.c:623-632` — `obs_output_update` merges settings, and the replay buffer has no `update` callback (`obs-ffmpeg-mux.c:1250-1261`), so this only refreshes the stored data.

**Slice plan:** In `OBSBasic::ReplayBufferSave()` (`frontend/widgets/OBSBasic_ReplayBuffer.cpp`), before `proc_handler_call(ph, "save", ...)`, read `Output/FilenameFormatting`, `SimpleOutput/RecRBPrefix` and `SimpleOutput/RecRBSuffix` from `activeConfiguration`/`Config()`, build `GetFormatString(...)`, put it in a temporary `obs_data` under `"format"`, and call `obs_output_update(outputHandler->replayBuffer, data)`. About 10 lines, 1 file. Caveat for the commit message: the settings object is written on the UI thread. Its only reader is the save path, and that runs after the proc call, but if a previous save is still in flight there is a theoretical race.

**Test plan:** MSVC build of the frontend. Manual: start the replay buffer, change the filename format or prefix in Settings, save the replay, and confirm the new name in the log or status bar. Also check that obs-websocket `SetProfileParameter` changes are picked up.

**Related:** none

---

### [#10932](https://github.com/obsproject/obs-studio/issues/10932) — OBS Improperly Shutting Down - Constant Unclean Shutdown Error Messages

**Verdict:** CANNOT_VERIFY

**Reasoning:** OBS hangs or exits uncleanly after about 15 minutes of uptime, including in Safe Mode, with no crash log and no stack trace. Nothing in the report identifies a code path, and the cause is probably environmental (drivers, overlays). There is nothing actionable without a dump.

**Evidence:** none actionable (no stack or crash log).

**Related:** none

---

### [#10937](https://github.com/obsproject/obs-studio/pull/10937) — UI: Output timer bug

**Verdict:** IMPLEMENT (through the #10900 slice; the PR's own diff is not used)

**Reasoning:** The PR targets the real defect described under #10900 (the early return in `StreamTimerStop` / `RecordTimerStop`). However, it flips the condition to `isActive() == true`, which brings in a new bug. With the dialog hidden and the timer still running, a manual stop would leave the QTimer running, and it would later stop a different recording. The file has also moved (`UI/frontend-plugins/frontend-tools/` to `plugins/frontend-tools/`) and was reformatted with braces, so it does not apply. Implement the corrected fix (remove the early return entirely) as one commit that covers both #10900 and #10937, and credit the PR author for the diagnosis.

**Evidence:**
- PR diff: `- if (!isVisible() && streamingTimer->isActive() == false)` becomes `+ ... == true`.
- `plugins/frontend-tools/output-timer.cpp:133,155` — current location of the lines.

**Slice plan:** Same as #10900 (one commit).

**Related:** 10900

---

### [#10944](https://github.com/obsproject/obs-studio/issues/10944) — VLC Video Source output delayed by nearly 3 seconds

**Verdict:** CANNOT_VERIFY

**Reasoning:** The VLC source's recorded or streamed audio lags its monitored audio by about 3 s. Monitoring and output both consume the same timestamped audio from the source, so a 3 s gap would mean libvlc timestamps that are far ahead of OBS's clock, with output buffering compensating (audio buffering can grow up to its maximum). The reporter's log is on Google Drive and not reviewed. With no log showing audio-buffering growth, I cannot point to a defect in `plugins/vlc-video`. It may relate to the libvlc version or the file.

**Evidence:** `plugins/vlc-video/vlc-video-source.c` audio callback passes libvlc pts through; no obvious defect.

**Related:** 10907

---

### [#11013](https://github.com/obsproject/obs-studio/pull/11013) — obs-outputs: Preserve signedness of FLV timestamp

**Verdict:** IMPLEMENT

**Reasoning:** The FLV specification defines Timestamp (UI24) plus TimestampExtended (UI8) as one SI32. `flv-mux.c` masks the extended byte with `0x7F`, which drops the sign bit. A negative `time_ms` (possible because it is computed as `dts - dts_offset`) is therefore encoded as a large positive value, and times at or above 2^31 ms lose their top bit. The PR changes 4 masks to `0xFF`. The change is local, follows the spec, and applies to master cleanly with `-3`; plain apply misses only one hunk because of a line offset. Low risk.

**Evidence:**
- `plugins/obs-outputs/flv-mux.c:133` — `s_wtimestamp`: `(i32 >> 24) & 0x7F`.
- `plugins/obs-outputs/flv-mux.c:329,361,422` — the same mask in `flv_video`, `flv_audio`, `flv_packet_audio_ex`.

**Slice plan:** Cherry-pick `0bc6ff38c` (author preserved). 4 lines in `plugins/obs-outputs/flv-mux.c`.

**Test plan:** MSVC build of `obs-outputs`. Runtime: record an FLV or stream to a local RTMP server and inspect it with `ffprobe -show_packets` to confirm timestamps are unchanged for normal positive values. The negative-timestamp path is hard to trigger, so mark it UNTESTED.

**Related:** 11123 (same plugin)

---

### [#11062](https://github.com/obsproject/obs-studio/issues/11062) — SRT stream freezes in OBS after reconnect

**Verdict:** CANNOT_VERIFY

**Reasoning:** A media source in SRT listener mode shows stale cached frames after the sender reconnects and then freezes, until audio-lag detection resets it minutes later. This involves the FFmpeg/libsrt demuxer's behaviour on reconnect and media-playback's reconnect/restart logic (`shared/media-playback`). Without a repro (sender and network-drop setup) I cannot isolate a specific defect: stale packet queue, timestamp discontinuity handling, or libsrt state. It is plausibly a real bug, but not provable from the code alone.

**Evidence:** `shared/media-playback/media-playback/media.c` (reconnect/restart and timestamp handling); no specific line identified.

**Related:** none

---

### [#11083](https://github.com/obsproject/obs-studio/issues/11083) — Audio crackle (xrun) in stream and recording

**Verdict:** CANNOT_VERIFY

**Reasoning:** Ubuntu 24.04 with PipeWire loopback virtual sinks: one sink crackles only in OBS's PulseAudio capture and stops when using JACK. This is specific to the audio-server configuration (the pipewire-pulse latency and quantum for that loopback), and there is no identifiable defect in `plugins/linux-pulseaudio`. Another possible route is the native PipeWire audio capture added in later versions.

**Evidence:** `plugins/linux-pulseaudio/pulse-input.c` — stream buffer attributes are generic; no sink-specific bug identifiable.

**Related:** none

---

### [#11086](https://github.com/obsproject/obs-studio/issues/11086) — In Windows 11, using OBS with Intel graphics for streaming only utilizes 3D performance

**Verdict:** CANNOT_VERIFY

**Reasoning:** The report is unclear. It says recording on an Intel UHD 770 above 1 Mbps fails and Task Manager shows only "3D" usage. QSV encode load often shows under different engine counters, and the issue may be a driver, an encoder selection, or a multi-GPU adapter-selection problem. There is not enough information or code evidence to locate a defect in `plugins/obs-qsv11`.

**Evidence:** none specific; hardware and driver dependent.

**Related:** none

---

### [#11123](https://github.com/obsproject/obs-studio/pull/11123) — obs-outputs: Add eRTMP Reconnect

**Verdict:** DEFER_LARGE

**Reasoning:** This implements the Enhanced RTMP v2 "Reconnect Request": it parses `onStatus` in `process_recv_data`, stores a `tcUrl`, and forces a reconnect on the next keyframe. To avoid losing packets it also changes the RTMP send loop from `get_next_packet` to a peek/free pair. It applies cleanly (about 115 lines), but it is a protocol feature that is not exercised by any ingest in `rtmp-services`. It changes packet-ownership semantics in the hot send loop, and testing needs a modified FFmpeg server. Review also turns up questionable code: `dstr_init(&stream->reconnect_path)` in `rtmp_stream_stop` leaks instead of freeing; `strcmp` / `strncmp` run on AMF `AVal`s that are not NUL-terminated; and the parsed `tcUrl` is stored but its use for reconnection needs scrutiny. This is a feature for upstream to settle; it is not a small, safe slice.

**Evidence:**
- PR diff to `plugins/obs-outputs/rtmp-stream.c` — `peek_next_packet` / `free_next_packet`, the `onStatus` parsing, and `dstr_init` in stop.
- Current `plugins/obs-outputs/rtmp-stream.c` `send_thread` uses `get_next_packet` (pop) semantics.

**Related:** 11013

---

### [#11133](https://github.com/obsproject/obs-studio/issues/11133) — Months and weekdays are not localized in filename formatting

**Verdict:** DEFER_LARGE

**Reasoning:** `os_generate_formatted_filename` passes `%a/%A/%b/%B` through to `strftime` (`libobs/util/platform.c:698-736`). OBS never calls `setlocale(LC_TIME, "")`; the frontend sets only `LC_NUMERIC` on Unix (`frontend/OBSApp.cpp:968`). The C runtime therefore stays in the "C" locale and English names come out, so the root cause is clear. A correct fix is not small:
- Setting LC_TIME process-wide affects every other strftime user.
- On Windows, `strftime` returns text in the ANSI code page, not UTF-8, which would garble the UTF-8 paths OBS uses. That needs `wcsftime` / `_wcsftime_l` plus conversion, or `GetDateFormatEx`.
- There is a design choice to make: the OS locale or the OBS UI language.

It needs per-platform code and a locale-policy decision.

**Evidence:**
- `libobs/util/platform.c:707-736` — spec table and `strftime` calls.
- `frontend/OBSApp.cpp:966-971` — only `LC_NUMERIC` is set.

**Related:** none
