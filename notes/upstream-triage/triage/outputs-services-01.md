# Upstream triage: outputs-services-01

- Batch: outputs-services-01 (area hint: outputs-services)
- Items: 4125, 4191, 4227, 4596, 4600, 4861, 4918, 5045, 5046, 5060, 5358, 6061, 6064, 6385, 6461, 6492, 7140, 7233, 7249, 7256
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`, current code read on master, PR heads from `refs/upstream-pr/N`. One WebFetch was used (issue #7140 thread). Local git is 2.33, so `git merge-tree --write-tree` is not available. `git diff master...PR | git apply --check` was used to check applicability instead.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 4125 | issue | IMPLEMENT |
| 4191 | issue | CANNOT_VERIFY |
| 4227 | issue | IMPLEMENT |
| 4596 | issue | CANNOT_VERIFY |
| 4600 | issue | CANNOT_VERIFY |
| 4861 | issue | IMPLEMENT |
| 4918 | issue | CANNOT_VERIFY |
| 5045 | issue | IMPLEMENT |
| 5046 | issue | OUT_OF_SCOPE |
| 5060 | issue | IMPLEMENT |
| 5358 | issue | CANNOT_VERIFY |
| 6061 | issue | CANNOT_VERIFY |
| 6064 | issue | CANNOT_VERIFY |
| 6385 | issue | IMPLEMENT |
| 6461 | PR | DEFER_LARGE |
| 6492 | PR | DEFER_LARGE |
| 7140 | issue | IMPLEMENT |
| 7233 | issue | CANNOT_VERIFY |
| 7249 | issue | CANNOT_VERIFY |
| 7256 | issue | DEFER_LARGE |

---

### [#4125](https://github.com/obsproject/obs-studio/issues/4125) — "Ignore streaming service setting recommendations" checkmark does not seem to work

**Verdict: IMPLEMENT**

The reporter turned on "Ignore streaming service setting recommendations", chose CRF in Advanced output, and still got CBR on Twitch. In current code, `AdvancedOutput::UpdateStreamSettings()` always calls `obs_service_apply_encoder_settings()` when the hidden `AdvOut/ApplyServiceSettings` key is true, which is the default and has no UI. For rtmp-common services, `apply_video_encoder_settings()` always sets `rate_control` to `CBR`. When `IgnoreRecommended` is set, the frontend restores only the user's `bitrate` (and a smaller `keyint_sec`). It never restores `rate_control`, so the checkbox cannot do what its label says.

Evidence:
- `frontend/utility/AdvancedOutput.cpp:203-237`: `applyServiceSettings` defaults to true. When `!enforceBitrate`, only `bitrate` is restored (`:232`) and only `keyint_sec` is clamped (`:235-238`).
- `plugins/rtmp-services/rtmp-common.c:729`: `obs_data_set_string(settings, "rate_control", "CBR");` runs unconditionally.
- `frontend/widgets/OBSBasic.cpp:649`: `ApplyServiceSettings` defaults to true. Grep finds no settings UI that writes it.
- `frontend/data/locale/en-US.ini:1022-1024`: the label and warning say the service's recommended settings are ignored.

Slice plan: in `AdvancedOutput::UpdateStreamSettings()`, copy the user's `rate_control` string before calling `obs_service_apply_encoder_settings`. In the `if (!enforceBitrate)` branch, write it back when it is non-empty. That is about 5 lines in one file. Simple mode is not changed, because it always uses CBR anyway.

Related: none.

---

### [#4191](https://github.com/obsproject/obs-studio/issues/4191) — Preview Stutter that appears in Streams/Recordings

**Verdict: CANNOT_VERIFY**

This is a long-running Windows report (184 comments): the preview starts stuttering after an unpredictable amount of time, whatever the capture method. Nothing in the body points to specific code. It depends on the GPU, driver, compositor and system load, and there is no reliable way to reproduce it. No defect can be found in the code from this report.

Evidence:
- The body has only general symptoms and a log link. No reproducible trigger or stack is given.

Related: none.

---

### [#4227](https://github.com/obsproject/obs-studio/issues/4227) — "Overwrite if file exists" setting not respected for replay buffer

**Verdict: IMPLEMENT**

The cause is clear. `replay_buffer_save()` calls `generate_filename(stream, &stream->path, true)`, which always overwrites, so `find_best_filename()` (the " (2)" / "_2" de-duplication) never runs for replays. The frontend never passes `allow_overwrite` to the replay buffer either, even though it reads `OverwriteIfExists` in both start paths. The recording path uses `allow_overwrite` correctly.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:1170`: `generate_filename(stream, &stream->path, true);` is hard-coded.
- `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:553-598`: `find_best_filename` / `generate_filename(..., overwrite)` already support de-duplication.
- `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:403`: the recording output reads `allow_overwrite`.
- `frontend/utility/AdvancedOutput.cpp:894-911`: `StartReplayBuffer` reads `overwriteIfExists` but never sets it in `settings`.
- `frontend/utility/SimpleOutput.cpp:834,846-853`: the replay-buffer branch of `ConfigureRecording(true)` does not set `allow_overwrite`.

Slice plan:
1. In `obs-ffmpeg-mux.c` `replay_buffer_defaults`, add `obs_data_set_default_bool(s, "allow_overwrite", true)`. This keeps the old behaviour for third-party users of the `replay_buffer` output.
2. In `replay_buffer_save`, read `allow_overwrite` from `obs_output_get_settings()` and pass it to `generate_filename`. Release the settings afterwards.
3. In the frontend, call `obs_data_set_bool(settings, "allow_overwrite", overwriteIfExists)` in `AdvancedOutput::StartReplayBuffer` and in the replay branch of `SimpleOutput::ConfigureRecording`.

That is about 12 lines in 3 files.

Related: #4861 (also replay buffer filename generation).

---

### [#4596](https://github.com/obsproject/obs-studio/issues/4596) — SRT streams have trouble connecting/reconnecting while Recording is running

**Verdict: CANNOT_VERIFY**

An SRT media source (Larix sender) does not reconnect while OBS is recording, and reconnects as soon as recording stops. This involves the media-playback / FFmpeg / libsrt network input and depends on timing. Nothing in the report points to code shared between the recording output and the media source input. It needs a live SRT sender to reproduce and a protocol-level trace.

Evidence:
- The body has only a log link. The media source's network handling is in `deps/media-playback`, but no specific defect could be found from the report.

Related: #6064 (SRT media source audio).

---

### [#4600](https://github.com/obsproject/obs-studio/issues/4600) — Random short audio dropouts when recording or streaming

**Verdict: CANNOT_VERIFY**

Short audio gaps appear every few minutes, and the rate depends on the hardware. This sounds like audio timestamp smoothing or buffering against WASAPI device clocks. The 101-comment thread is still active, which suggests many different causes. The body gives no code-level root cause, and it depends on hardware and drivers.

Evidence:
- The body describes symptoms and a test-tone method only. Nothing can be pinned down in `libobs/obs-audio.c` / `obs-source.c` without a capture on the affected hardware.

Related: none.

---

### [#4861](https://github.com/obsproject/obs-studio/issues/4861) — Replay buffer filename formatting pattern adds extra whitespace

**Verdict: IMPLEMENT**

`GetFormatString()` always puts a space between the format and the suffix (and between the prefix and the format) unless the suffix already starts with a space or the prefix already ends with one. A suffix such as `_replay` therefore gives `... _replay`. With "no space" enabled, the space becomes `_`, which gives a double underscore `__replay`. Either way the result is not what the user wrote. The fix is small: leave out the separator when the prefix or suffix already begins or ends with a common separator character.

Evidence:
- `frontend/OBSApp.cpp:1641-1646`: the prefix always gets a trailing `" "` unless it already ends with one.
- `frontend/OBSApp.cpp:1663-1667`: the suffix always gets a leading `" "` unless it already starts with one.
- `frontend/utility/AdvancedOutput.cpp:902` and `SimpleOutput.cpp:847`: replay-buffer filenames use `GetFormatString(filenameFormat, rbPrefix, rbSuffix)`.

Slice plan: add a small static helper `is_separator(char c)` that returns true for `' '`, `'_'`, `'-'` and `'.'`. Use it instead of the `== ' '` / `!= ' '` checks for both the prefix and the suffix in `GetFormatString`. That is about 8 lines in 1 file. Existing users whose suffixes start with a letter see no change.

Related: #4227.

---

### [#4918](https://github.com/obsproject/obs-studio/issues/4918) — OBS crashes with a fault in obs-outputs.dll!rtmp_stream_congestion

**Verdict: CANNOT_VERIFY**

This is an intermittent crash in `rtmp_stream_congestion` after a stream is started over obs-websocket on OBS 27.0.1. The function only reads fields of `stream`, so a crash there means a stale or freed output data pointer. That points to a race between the status-bar poll and an output being recreated or destroyed. The crash log is not available locally, the version is very old, and output lifetime handling has been heavily refactored since then (refcounted outputs, `obs_output_valid`). No current defect can be found.

Evidence:
- `plugins/obs-outputs/rtmp-stream.c:1966-1974`: only simple field reads.
- `libobs/obs-output.c:3179-3185`: `obs_output_get_congestion` checks `obs_output_valid` first.
- `frontend/widgets/OBSBasicStatusBar.cpp:345`: the poll site.

Related: none.

---

### [#5045](https://github.com/obsproject/obs-studio/issues/5045) — VLC Video Source - Audio Track Selection Bug

**Verdict: IMPLEMENT**

There is a likely root cause. `add_file()` reuses the existing `libvlc_media_t` for the same path (`get_media(&c->files, path)`) and then *appends* `:audio-track=N` / `:sub-track=N` options to it. libVLC 3's `libvlc_media_add_option` adds options with `VLC_INPUT_OPTION_UNIQUE`, which skips any option string that is already in the item's list. Switching back to a track that was used before is therefore a no-op, and the most recently added different value stays in effect. This matches the reported pattern exactly: 1→2 works, 2→3 works, 3→1 fails, 1→2 fails, 2→4 works.

Evidence:
- `plugins/vlc-video/vlc-video-source.c:523-528`: the media object is reused from the current or new files.
- `plugins/vlc-video/vlc-video-source.c:537-547`: options are appended to the reused media every time.
- `plugins/vlc-video/vlc-video-source.c:618-622`: track and subtitle settings are read in update.

Slice plan: store the last applied `track_index`, `subtitle_index` and `subtitle_enable` in `struct vlc_source`. In `vlcs_update`, compute `options_changed`. Pass a `bool reuse` flag to `add_file`, and when the options changed, skip the `get_media(&c->files, ...)` reuse so a fresh `libvlc_media_t` (with a clean option list) is created. That is about 20 lines in 1 file.

Test plan: build the vlc-video plugin with MSVC. Runtime is UNTESTED unless VLC is installed on the box.

Related: #5046.

---

### [#5046](https://github.com/obsproject/obs-studio/issues/5046) — VLC Video Source - Timeline update issue (with a recording .ts file)

**Verdict: OUT_OF_SCOPE**

The request is for the VLC source to follow a file that is still being written (a growing MPEG-TS) and update its duration live. OBS only asks libVLC for the media length and position. Whether libVLC sees a growing file and keeps reading near EOF is libVLC's own demux/EOF behaviour (third party), not OBS code. The reporter also notes it works once playback reaches the end. Treating growing files as live would be a new feature better handled by the media source or by libVLC options.

Evidence:
- `plugins/vlc-video/vlc-video-source.c`: duration and time are delegated to the libvlc media player. OBS has no file-growth logic.

Related: #5045.

---

### [#5060](https://github.com/obsproject/obs-studio/issues/5060) — Low Bandwidth Indicator not working with YouTube HLS Streaming

**Verdict: IMPLEMENT**

The status-bar congestion square uses `obs_output_get_congestion()`. The HLS output (`ffmpeg_hls_muxer`) has no `get_congestion` callback, so the value is always 0 and the indicator stays green. The HLS muxer already tracks buffer backlog and frame dropping (`check_to_drop_frames`, `min_priority`), so a congestion value can be computed cheaply.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-hls-mux.c:314-331`: the output info has `get_dropped_frames` but no `get_congestion`.
- `plugins/obs-ffmpeg/obs-ffmpeg-hls-mux.c:224-238`: `check_to_drop_frames` computes `buffer_duration_usec` against `drop_threshold_sec`.
- `frontend/widgets/OBSBasicStatusBar.cpp:345`: the indicator is driven by `obs_output_get_congestion`.
- `plugins/obs-outputs/rtmp-stream.c:1966-1974`: the RTMP equivalent (`min_priority > 0 ? 1.0f : congestion`).

Slice plan:
1. Add `float congestion;` to `struct ffmpeg_muxer` in `obs-ffmpeg-mux.h`, next to the HLS-only fields.
2. In `check_to_drop_frames`, set `stream->congestion` to the clamped `buffer_duration_usec / (drop_threshold_sec * 1e6)` for the non-pframes call.
3. Add `static float hls_stream_congestion(void *data)` that returns `min_priority > 0 ? 1.0f : congestion`, register it as `.get_congestion`, and reset the value in start.

That is about 20 lines in 2 files.

Related: none.

---

### [#5358](https://github.com/obsproject/obs-studio/issues/5358) — After recording for a period of time, you cannot record again.

**Verdict: CANNOT_VERIFY**

After stopping a recording with a hotkey, the stats still show it as active and a new recording cannot start. The report is minimal (OBS 27.1.1, steps are "use hotkey for a while"), the log is not available offline, and the recording stop path has been rewritten since then. Without logs this looks like a muxer that never finished stopping, and there are many possible causes. No defect can be found.

Evidence:
- The body has no repro beyond hotkey use.

Related: #7249 (an output that does not stop).

---

### [#6061](https://github.com/obsproject/obs-studio/issues/6061) — Deinterlacing "Bottom Frame First" footage in Double Framerate yields incorrect output

**Verdict: CANNOT_VERIFY**

The bottom-field-first 2x modes reportedly reorder fields as 1,6,3,8... The shader flips `field` based on `frame2` and `field_order` in matching patterns for every 2x mode, and nothing is obviously asymmetric between TFF and BFF. A delay of "6 frames" suggests a problem with the source's frame timestamps or field-order metadata (capture device) rather than the shader math. Confirming it needs interlaced BFF test material and a capture source.

Evidence:
- `libobs/data/deinterlace_base.effect:142,154,182,193`: `field` and `frame2` selection.
- `libobs/obs-source-deinterlace.c:393-398`: `field_order` = `deinterlace_top_first`, and `frame2` comes from timestamps.
- `libobs/obs-source-deinterlace.c:466-471`: the field order setter.

Related: none.

---

### [#6064](https://github.com/obsproject/obs-studio/issues/6064) — Digital audio artifacts from SRT input in Media Source

**Verdict: CANNOT_VERIFY**

Audio artifacts appear on an SRT input to the media source (from a Haivision gateway). They started after 27.0.1, and the same stream played through the VLC source is clean. This depends on the stream and the sender, and has no repro material. It could be audio resampling or timestamp handling in `deps/media-playback`, but nothing specific can be identified.

Evidence:
- The body has symptoms only. It needs the SRT stream to reproduce.

Related: #4596.

---

### [#6385](https://github.com/obsproject/obs-studio/issues/6385) — Starting stream from system tray does not confirm even when the option is enabled

**Verdict: IMPLEMENT**

The cause is clear. `StreamActionTriggered()` and `RecordActionTriggered()` show the confirmation dialogs only when `confirm && isVisible()`. The tray actions are connected to those same slots. When OBS is minimized to the tray, the main window is hidden, so `isVisible()` is false and the confirmation is skipped without notice. The only other callers are the main-window control buttons, which are visible by definition, so removing the `isVisible()` guard only changes behaviour for the tray.

Evidence:
- `frontend/widgets/OBSBasic_SysTray.cpp:80-81`: the tray actions connect to `StreamActionTriggered` / `RecordActionTriggered`.
- `frontend/widgets/OBSBasic.cpp:183,191`: the only other callers (control dock buttons).
- `frontend/widgets/OBSBasic_Streaming.cpp:409` (stop confirmation), `:452` (bwtest), `:459` (start confirmation): `&& isVisible()`.
- `frontend/widgets/OBSBasic_Recording.cpp:262`: stop-record confirmation `confirm && isVisible()`.

Slice plan: remove `&& isVisible()` from the start, stop, bwtest and stop-record confirmation conditions. When the window is hidden, pass `nullptr` as the parent so the box appears centred on screen and not attached to a hidden window. A small helper `QWidget *parent = isVisible() ? this : nullptr;` is enough. That is about 10 lines in 2 files.

Test plan: build the frontend with MSVC, enable the tray, minimize to the tray, start streaming from the tray, and check that the prompt appears.

Related: none.

---

### [#6461](https://github.com/obsproject/obs-studio/pull/6461) — rtmp-services: Enable YouTube dual ingestion

**Verdict: DEFER_LARGE**

This is a draft PR that adds a "Both Primary and Backup" server entry with a `backup_urls` array to `services.json`. It depends on upstream PR #6445 (redundant/backup streams in the output path), which was never merged. Master has no `backup_urls` support anywhere, so the entry would be inert or wrong without that whole feature. The real work is the backup-stream architecture in #6445, which is large. Changes to services.json are also maintained by upstream and partners.

Evidence:
- `git diff master...refs/upstream-pr/6461 --stat`: 14 lines added to `plugins/rtmp-services/data/services.json` only.
- `grep -rn backup_urls plugins libobs frontend` → no matches on master.

Related: #6445 (unmerged dependency, not in this batch).

---

### [#6492](https://github.com/obsproject/obs-studio/pull/6492) — decklink: Support different frame rate on decklink output

**Verdict: DEFER_LARGE**

This draft PR stacks on #1865 (DeckLink frame scheduling). Master already uses a scheduled-output path (`ScheduleVideoFrame`) that was implemented differently. The PR does not apply: `UI/window-basic-main.cpp` no longer exists (the frontend moved to `frontend/`), and `decklink-device-instance.cpp/.hpp` conflict. It changes about 320 / 93 lines in 11 files and needs hardware to validate. Rebasing it onto the current scheduler is a rewrite, not a cherry-pick.

Evidence:
- `git diff master...refs/upstream-pr/6492 | git apply --check` → fails on `UI/window-basic-main.cpp` (missing) and the decklink-device-instance files.
- `plugins/decklink/decklink-device-instance.cpp:619,671-692`: master already has frame scheduling.

Related: #7256 (DeckLink output UI).

---

### [#7140](https://github.com/obsproject/obs-studio/issues/7140) — Twitch panels option disappears when you duplicate a profile

**Verdict: IMPLEMENT**

The issue was re-confirmed on 32.1.2 (May 2026; the WebFetch of the thread shows the `issue/confirmed` label was re-applied). A commenter suspected that a duplicated profile keeps the same browser-panel cookie ID. The code confirms it. Since the profile rewrite (commit `607d37b42`), `SetupDuplicateProfile()` copies the whole profile directory, including `basic.ini` `[Panels] CookieId`. It never calls `DuplicateCurrentCookieProfile()` any more; that function is now dead code. Both profiles then share one CEF cookie store. Disconnecting Twitch in one profile deletes the cookies (`DeleteCookies()`) the other still relies on, so its Twitch docks lose their login and disappear.

Evidence:
- `frontend/widgets/OBSBasic_Profiles.cpp:93-113`: `SetupDuplicateProfile` copies the directory and calls `ActivateProfile(newProfile)` with no cookie handling.
- `frontend/widgets/OBSBasic_Profiles.cpp:43`: `extern void DuplicateCurrentCookieProfile(ConfigFile &)`. It is declared but has no call sites (grep).
- `frontend/widgets/OBSBasic_Browser.cpp:232-276`: `DuplicateCurrentCookieProfile` implementation.
- `frontend/widgets/OBSBasic_Browser.cpp:190-229`: the cookie manager is created lazily from `Panels/CookieId`; `DeleteCookies()` clears the shared store.
- `git show 607d37b42`: removes the `DuplicateCurrentCookieProfile(config)` call.

Slice plan: in `SetupDuplicateProfile`, after the filesystem copy:
1. Call `DestroyPanelCookieManager()`, which flushes the store.
2. Copy `obs_profile_cookies/<oldId>` to `obs_profile_cookies/<newId>`, reusing the copy loop from `DuplicateCurrentCookieProfile`. Refactor that function to take the destination config and the new ID, so the *new* profile gets the fresh ID and the original keeps its own.
3. Set `Panels/CookieId` in the new profile's `basic.ini`.
4. Activate with `reset=true`, so auth and docks are rebuilt against the new cookie store, as a normal profile switch does.

That is about 30 lines in 2 files.

Test plan: compile with MSVC. Runtime is UNTESTED, because it needs a Twitch login and a browser-enabled build.

Related: none.

---

### [#7233](https://github.com/obsproject/obs-studio/issues/7233) — Remuxed MP4 files used in Vegas Pro 19 causes VP19 to glitch out

**Verdict: CANNOT_VERIFY**

Vegas Pro 19 misbehaves with MKV files remuxed to MP4 by OBS 27.2.x. This is a compatibility problem with a third-party NLE, and no specific stream or atom defect is identified. Remuxing has also changed a lot since then (the native MP4 muxer, `write_encoder_info`, hybrid MP4). It needs the file and Vegas to confirm. It may be a Vegas problem.

Evidence:
- The body has symptoms only. The remux code is in `frontend/utility/RemuxQueueModel.cpp` / `RemuxWorker`, and nothing specific can be checked against the report.

Related: none.

---

### [#7249](https://github.com/obsproject/obs-studio/issues/7249) — Recording + replay buffer, paused recording, OBS cannot exit normally

**Verdict: CANNOT_VERIFY**

Upstream confirmed this and labelled it "Seeking Other Contributors". With the recording paused and the replay buffer active, exiting OBS hangs and the file is not finalized. The likely mechanism: `obs_output_stop()` waits (via `obs_output_actual_stop` with a stop timestamp) for the muxer to see a packet past `stop_ts`, and a paused output never receives one while the encoders are shared with the replay buffer. The exact defect in the pause/stop interaction in `libobs/obs-output.c` could not be found in a reasonable read. It needs a debugger repro, and a fix in that code is risky.

Evidence:
- `libobs/obs-output.c:530-549`: `obs_output_stop` → `obs_output_actual_stop(output, false, os_gettime_ns())` (a stop timestamp, not forced).
- `plugins/obs-ffmpeg/obs-ffmpeg-mux.c`: the muxer stops only when a packet's `sys_dts_usec >= stop_ts`, the same pattern as in `replay_buffer_data` at `:1207-1212`.

Related: #5358.

---

### [#7256](https://github.com/obsproject/obs-studio/issues/7256) — Decklink Output not saved in profile

**Verdict: DEFER_LARGE**

Confirmed by code: the DeckLink output UI saves its settings to a module-global file (`obs_module_get_config_path(..., "decklinkOutputProps.json")`), not per profile. With `--multi` instances, whichever instance closes last wins. Making it per-profile means a new storage location (the profile directory), migrating the global file, and handling `OBS_FRONTEND_EVENT_PROFILE_CHANGED` to stop, reload and restart running outputs. That needs product and design decisions (global vs per profile, migration). The upstream label "Seeking Other Contributors" shows the request is accepted, but there is no small slice.

Evidence:
- `plugins/decklink-output-ui/DecklinkOutputUI.cpp:51-59,87-95`: saves to the module config path.
- `plugins/decklink-output-ui/decklink-ui-main.cpp:46-49,163-166`: loads from the module config path.

Related: #6492.
