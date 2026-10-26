# Upstream triage: batch outputs-services-09

- Batch: outputs-services-09 (area hint: outputs-services)
- Items: 13161, 13162, 13165, 13171, 13186, 13209, 13249, 13270, 13277, 13283, 13286, 13292, 13293, 13317, 13337, 13366, 13367, 13368, 13374, 13408
- Date: 2026-10-26
- Base commit: master @ 72e866557
- Method: item bodies from `notes/upstream-triage/data/all.json`, code read on master, PR heads at `refs/upstream-pr/<N>`. Local git is 2.33, which has no `merge-tree --write-tree`, so applicability was checked with the legacy three-way `git merge-tree <base> master <pr>` and a count of `<<<<<<<` markers. WebFetch was used twice, on issues #13165 and #13366, to read the comment threads.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 13161 | issue | DEFER_LARGE |
| 13162 | issue | CANNOT_VERIFY |
| 13165 | issue | CANNOT_VERIFY |
| 13171 | issue | IMPLEMENT |
| 13186 | PR | DEFER_LARGE |
| 13209 | issue | IMPLEMENT |
| 13249 | issue | CANNOT_VERIFY |
| 13270 | PR | DEFER_LARGE |
| 13277 | PR | OUT_OF_SCOPE |
| 13283 | issue | CANNOT_VERIFY |
| 13286 | issue | CANNOT_VERIFY |
| 13292 | issue | CANNOT_VERIFY |
| 13293 | issue | CANNOT_VERIFY |
| 13317 | issue | CANNOT_VERIFY |
| 13337 | issue | CANNOT_VERIFY |
| 13366 | issue | CANNOT_VERIFY |
| 13367 | issue | CANNOT_VERIFY |
| 13368 | PR | IMPLEMENT |
| 13374 | issue | CANNOT_VERIFY |
| 13408 | PR | IMPLEMENT |

---

### [#13161](https://github.com/obsproject/obs-studio/issues/13161) — Missing NACK response in WHIP Simulcast for medium/low layers (HIGH works fine)

**Verdict: DEFER_LARGE**

The defect is real and can be seen in code. All simulcast layers go out on one libdatachannel video track, through one media-handler chain with a single `RtcpNackResponder`. Each layer has its own SSRC and its own sequence-number space. libdatachannel's NACK storage is keyed only by `uint16_t` sequence number, so packets from different layers overwrite each other. A NACK for a lower layer then finds nothing, or finds the wrong layer's packet. OBS cannot fix this alone, because the media-handler chain is per track. Adding one responder per layer would not help, since each responder would see every NACK and ignore SSRC. The fix needs SSRC-aware NACK storage in libdatachannel, which is a dependency change, or a restructured per-layer track design. Neither is a small slice.

Evidence:
- `plugins/obs-webrtc/whip-output.cpp:72-74`: each layer has `ssrc = base_ssrc + 1 + idx` and its own rid.
- `plugins/obs-webrtc/whip-output.cpp:124-131`: `Data()` reuses one shared `rtp_config` and changes ssrc, sequence number and rid for each packet.
- `plugins/obs-webrtc/whip-output.cpp:239-240`: one `RtcpNackResponder(video_nack_buffer_size)` serves the whole video track.
- `.deps/obs-deps-2026-10-23-x64/include/rtc/rtcpnackresponder.hpp`: `Storage` uses `std::unordered_map<uint16_t, ...>` keyed only by sequence number, with no SSRC.

Related: #13270 (also changes WHIP simulcast data flow).

### [#13162](https://github.com/obsproject/obs-studio/issues/13162) — Crash when start recording

**Verdict: CANNOT_VERIFY**

Fedora, OBS 32.0.4, VAAPI H.264 crashes when recording starts. The only evidence is an external log and a pastebin crash log, and the report gives no stack trace. VAAPI crashes almost always depend on the Mesa or driver version. Nothing in the report points to a defect in `plugins/obs-ffmpeg/obs-ffmpeg-vaapi.c` or in the native VA-API encoder code. A fix would need a repro on matching hardware. This box is Windows-only.

Related: none.

### [#13165](https://github.com/obsproject/obs-studio/issues/13165) — Markers not saved to hybrid mp4 on recording stop/start

**Verdict: CANNOT_VERIFY**

The comment thread was read with WebFetch. derrod checked the reporter's mediainfo output for the first file and found the chapters were written correctly. The reporter later said they could not reproduce the problem. The reported symptom is therefore unconfirmed.

One unrelated defect turned up during the review. `mp4_output_actual_stop` removes the chapter packet callback with `param = NULL`, but it was added with `param = out`. `obs_output_remove_packet_callback` matches on both the callback and the param, so the removal never matches. Each stop/start cycle then adds another `mp4_pkt_callback` entry. This is functionally harmless, because chapters are popped under a mutex and duplicate calls find an empty queue. It does not explain the report. An optional one-line follow-up would pass `out` instead of `NULL`. That is a separate cleanup and is not this issue.

Evidence:
- `plugins/obs-outputs/mp4-output.c:323`: `obs_output_add_packet_callback(out->output, mp4_pkt_callback, (void *)out);`
- `plugins/obs-outputs/mp4-output.c:473`: `obs_output_remove_packet_callback(out->output, mp4_pkt_callback, NULL);` (param mismatch)
- `libobs/obs-output.c:3318-3328`: removal uses `da_erase_item` on the `{cb, param}` pair.
- `plugins/obs-outputs/mp4-output.c:135-171`: chapter write path, guarded by `out->mutex`.

Related: #13374 (Hybrid MP4).

### [#13171](https://github.com/obsproject/obs-studio/issues/13171) — Replay buffer's estimated memory usage incorrect color restore

**Verdict: IMPLEMENT**

The root cause is clear. Both replay-buffer estimate functions set the dynamic property `class = "text-warning"` when the estimate goes over the limit. No branch ever clears it. They only call `setObjectName("")`, which is left over from the old `#warning` objectName styling. After that they call `polish()` without `unpolish()`. Once the label turns yellow, it stays yellow until the dialog is rebuilt.

Evidence:
- `frontend/settings/OBSBasicSettings.cpp:5167-5182` (simple mode): `setObjectName("")`, `setProperty("class", "text-warning")` only in the too-large branch, then `style()->polish(...)`.
- `frontend/settings/OBSBasicSettings.cpp:5267-5289` (advanced mode): same pattern for `advRBEstimate`.
- `frontend/settings/OBSBasicSettings.cpp:306-309`: the same file elsewhere uses `unpolish` and then `polish` to restyle.

Slice plan:
- In both functions, replace `setObjectName("")` with `setProperty("class", "")`. The existing too-large branch still sets `text-warning`.
- Before `polish()`, add `style()->unpolish(widget)` so the property change is applied again.
- About 6 changed lines in one file.
- Test: build the `obs-studio` frontend with MSVC. At runtime, enable the replay buffer, raise the maximum time until the warning appears, then lower it, and confirm the text goes back to the default colour. Do this in both Simple and Advanced modes.

Related: none.

### [#13186](https://github.com/obsproject/obs-studio/pull/13186) — Add replay buffer scene override

**Verdict: DEFER_LARGE**

This is a new feature. It adds a scene dropdown, a dedicated `obs_view_t`, and an extra video encoder for the replay buffer. The diff is about 345 lines across 18 files, including a new dialog and `.ui` forms. The branch contains seven merge-from-master commits and two CI-retry commits. It has 4 conflict hunks against current master. The design needs a maintainer decision: it adds a second encoder's GPU and encode cost, changes the UX in both output modes, and has an open 10-comment review. It is not a small slice.

Evidence:
- `git diff master...refs/upstream-pr/13186 --stat`: 18 files, +345/-6.
- Legacy `git merge-tree`: 4 conflict blocks.
- Touches `frontend/utility/BasicOutputHandler.cpp`, `SimpleOutput.cpp` and `AdvancedOutput.cpp`, and adds `frontend/dialogs/OBSBasicRBConfig.*`.

Related: none.

### [#13209](https://github.com/obsproject/obs-studio/issues/13209) — Screenshots using the "Screenshot Output" hotkey only output SDR, even when recording in HDR

**Verdict: IMPLEMENT**

The root cause is clear. The "Screenshot Output" hotkey calls `OBSBasic::Screenshot` with a null source. `ScreenshotObj::renderScreenshot` picks its colour space with `obs_source_get_color_space(source, ...)`, which returns `GS_CS_SRGB` for a null source. The texrender is then SRGB. `obs_render_main_texture()` sees an SRGB target while the main mix is `GS_CS_709_EXTENDED`, so it uses the `DrawTonemap` technique. The result is an 8-bit SDR PNG. Source and preview screenshots pass a real source and get JXR output.

Evidence:
- `frontend/widgets/OBSBasic_Hotkeys.cpp:294-302`: the screenshot hotkey invokes `OBSBasic::Screenshot` with `nullptr`.
- `frontend/utility/ScreenshotObj.cpp:68-78`: the null-source path uses the `obs_get_video_info` base size.
- `frontend/utility/ScreenshotObj.cpp:87-96`: `space = obs_source_get_color_space(source, ...)`. This is Windows-only HDR; other platforms always use SRGB.
- `libobs/obs-source.c:3039-3043`: returns `GS_CS_SRGB` for an invalid or null source.
- `libobs/obs.c:403-408`: the main mix uses `render_space = GS_CS_709_EXTENDED` for Rec.2100 PQ and HLG.
- `libobs/obs.c:2183-2197`: tonemaps when the current space is SRGB; uses `DrawMultiply` when it is SCRGB.

Slice plan:
- In `ScreenshotObj::renderScreenshot`, inside the `_WIN32` branch, handle `!source` by reading `obs_get_video_info(&ovi)`.
- If `ovi.colorspace` is `VIDEO_CS_2100_PQ` or `VIDEO_CS_2100_HLG`, use `GS_CS_709_SCRGB`. That is the same JXR path the source branch takes for `GS_CS_709_EXTENDED`.
- About 10 lines in one file.
- Test: build with MSVC. At runtime, set Video to P010 / Rec.2100 PQ and use the "Screenshot Output" hotkey. Confirm a `.jxr` file is written. Checking true HDR content needs an HDR display or source; otherwise it is only partially tested.

Related: none.

### [#13249](https://github.com/obsproject/obs-studio/issues/13249) — Audio artifacts (crackling) after MKV → MP4 remux/conversion in OBS Studio

**Verdict: CANNOT_VERIFY**

The report has no log and no sample file. The artifact is only reported in Final Cut Pro on macOS. The remux is a stream copy through libavformat (`shared/media-playback`, `frontend/utility/RemuxWorker`), so the crackling probably comes from timestamp, edit-list or priming handling between that copy and FCP's decoder. Code alone cannot show a defect. The reporter's workaround re-encodes the audio, so it is not a fair comparison. A sample file is needed.

Related: none.

### [#13270](https://github.com/obsproject/obs-studio/pull/13270) — libobs,obs-webrtc: Skip packet interleaving for WebRTC outputs

**Verdict: DEFER_LARGE**

The PR is small (+15/-3 across 4 files) and applies cleanly (0 conflict blocks). It still needs design decisions that only maintainers should make:

1. It adds a new public libobs flag, `OBS_OUTPUT_NO_INTERLEAVE (1 << 7)`, in `libobs/obs-output.h`. That allocates public API bit space a downstream fork should not claim alone, because a different upstream use of bit 7 would conflict later.
2. Skipping `interleave_packets` also skips its start-up work: keyframe wait, pruning of early audio, and timestamp offsetting. `default_encoded_callback` (`libobs/obs-output.c:2309-2326`) only forwards packets.
3. Audio and video encoder threads would now call `WHIPOutput::Data` concurrently. The PR only locks the new `data_mutex` when simulcast is on.

The latency claim (1.3 s down to about 300 ms) cannot be checked here because no WHIP endpoint is available.

Evidence:
- `libobs/obs-output.h:25-34`: current flags go up to `(1 << 6)`.
- `libobs/obs-output.c:2309-2326`: `default_encoded_callback` does no offsetting or synchronisation.
- `plugins/obs-webrtc/whip-output.cpp:103-135`: `Data()` changes the shared `video_sr_reporter->rtpConfig` without a lock. It is only serialised today by the interleaver.

Related: #13161, #13408.

### [#13277](https://github.com/obsproject/obs-studio/pull/13277) — rtmp-services: Add Twitcast (ツイキャス)

**Verdict: OUT_OF_SCOPE**

This is a service-list addition. `services.json` is curated upstream, and the obsproject.com remote updater keys it by `package.json` version. If this fork bumps the version to 286 with its own content, it will collide with whatever upstream ships as 286. Service additions also rely on a relationship with the service provider and upstream's rtmp-services review process. The PR also conflicts with current master (2 blocks, in package.json and services.json, after the 2026-10 Twitch/IVS ingest update). If upstream accepts it, the fork gets it through the normal upstream sync.

Evidence:
- `git diff master...refs/upstream-pr/13277`: adds the service at the end of `plugins/rtmp-services/data/services.json` and bumps `package.json` 285 to 286.
- `plugins/rtmp-services/data/package.json`: `"url": "https://obsproject.com/obs2_update/rtmp-services/v5"` is the remote update channel.
- Recent master commit 7fc60ea38, "rtmp-services: Update Twitch/IVS Ingests", already conflicts with this PR.

Related: none.

### [#13283](https://github.com/obsproject/obs-studio/issues/13283) — OBS Crash when starting stream twice via websocket

**Verdict: CANNOT_VERIFY**

Ubuntu 24.04 with OBS 32.1.0, and no crash stack. The code does have a plausible re-entry window. `OBSBasic::StartStreaming` only checks `outputHandler->StreamingActive()`, which is `obs_output_active`. That stays false while setup is pending (async multitrack `SetupStreaming` with `setupStreamingGuard`) and while the output is still connecting. A second call inside that window runs `SetupOutputs`/`SetupStreaming` again and replaces `setupStreamingGuard`. A crash path has not been confirmed without a stack. A possible defensive slice is to return early when `setupStreamingGuard` is valid and not ready, mirroring `frontend/widgets/OBSBasic_OutputHandler.cpp:33-35`. It was not marked IMPLEMENT because the crash itself is not tied to this code.

Evidence:
- `frontend/widgets/OBSBasic_Streaming.cpp:48-55`: the only guards are `StreamingActive()` and `disableOutputsRef`.
- `frontend/widgets/OBSBasic_Streaming.cpp:127`: `setupStreamingGuard` is reassigned unconditionally.
- `frontend/utility/SimpleOutput.cpp:613-617, 956-959`: `SetupOutputs()` is called when not `Active()`; `StreamingActive` equals `obs_output_active`.
- `libobs/obs-output.c:563-566`: `obs_output_active` is active or reconnecting, and false while connecting.

Related: none.

### [#13286](https://github.com/obsproject/obs-studio/issues/13286) — OBS Settings: Output tab UI bug

**Verdict: CANNOT_VERIFY**

This is a cosmetic Qt layout problem: the "Audio Track" numbers drift out of line when the settings dialog is made very tall. The track checkboxes sit in `QStackedWidget`s with `vsizetype="Preferred"` inside form layouts, which could stretch vertically. The exact widget, simple or advanced, is only shown in screenshots that could not be viewed, and the root cause in the `.ui` file is not certain. It needs a visual repro on this box before a `.ui` change can be justified.

Evidence:
- `frontend/forms/OBSBasicSettings.ui:2803-2828`: `simpleRecTrackWidget` QStackedWidget, Maximum/Preferred size policy.
- `frontend/forms/OBSBasicSettings.ui:3800-3824`: `recTracks` (advanced) has the same structure.

Related: none.

### [#13292](https://github.com/obsproject/obs-studio/issues/13292) — Severe frame pacing issues when recording screen.

**Verdict: CANNOT_VERIFY**

Fedora 43, Wayland, Flatpak, PipeWire screen capture. Frames are duplicated and skipped at 60 Hz. Pacing on PipeWire depends on the compositor's frame delivery against OBS's own render clock, and on the compositor and portal versions. No specific defect is visible in `plugins/linux-pipewire`. The platform is Linux-only and cannot be tested here.

Related: none.

### [#13293](https://github.com/obsproject/obs-studio/issues/13293) — Docks not saving correctly with Custom output Enabled

**Verdict: CANNOT_VERIFY**

The dock layout reverts when the stream service is "Custom". Dock state is saved once in `saveAll()` to `BasicWindow/DockState` and restored in `OBSInit`. Integrations also save and restore a per-service `DockState`, and Twitch restores it late in `LoadSecondaryUIPanes`. No path was found where the Custom service skips saving. A stale per-service state, or an integration (Twitch, YouTube, Restream) restoring an old state after the main one, might explain it, but the report does not say which accounts are connected. Not reproducible from the information given.

Evidence:
- `frontend/widgets/OBSBasic.cpp:1118-1127` (restore) and `frontend/widgets/OBSBasic.cpp:1745-1756` (save once).
- `frontend/oauth/TwitchAuth.cpp:168, 291, 415`, `frontend/oauth/YoutubeAuth.cpp:81, 152`, `frontend/oauth/RestreamAuth.cpp:113, 214`: per-service DockState.

Related: #13368 (Twitch dock state restore).

### [#13317](https://github.com/obsproject/obs-studio/issues/13317) — OBS crash when using a media source to play back a file OBS recorded

**Verdict: CANNOT_VERIFY**

The crash is inside `avcodec-61.dll` with 0xc0000409 (stack buffer overrun / fast-fail) while a media source plays back a recording. It is intermittent on a channel that has been streaming for weeks. The crash is in FFmpeg's decoder, and there is no OBS-side stack or crash log. The thread has 19 comments, but they were not fetched because the WebFetch budget was spent elsewhere. Not actionable from code alone.

Related: none.

### [#13337](https://github.com/obsproject/obs-studio/issues/13337) — Can't capture DLSS FG frames

**Verdict: CANNOT_VERIFY**

DLSS Frame Generation frames are not captured, while FSR FG frames are. DLSS FG presents its generated frames through NVIDIA's driver and Reflex/Streamline paths, which the game-capture Present hooks may not see. This depends on the GPU, driver and closed vendor middleware, and needs NVIDIA RTX hardware. No OBS defect can be identified from code.

Related: none.

### [#13366](https://github.com/obsproject/obs-studio/issues/13366) — Rescale output can be set to bad values and then prevents outputs from stopping

**Verdict: CANNOT_VERIFY**

The comment thread was read with WebFetch. jcm93 noted that 1920x1079 is valid for some encoders (VideoToolbox, AOM) and that x264 fails cleanly. The hang seems specific to an encoder, possibly NVENC with fallback from GPU to raw encoding. One commenter suggested the cause was `gs_enter_context` without a matching `gs_leave_context` in `libobs/obs.c`. Current master shows that claim is wrong: every early return leaves the context. The settings page accepts any `WxH` for rescale and the frontend passes it straight to `obs_encoder_set_scaled_size`. Rejecting odd sizes is a policy choice the maintainers disputed. The real hang has not been found.

Evidence:
- `libobs/obs.c:644-656`: every early return after `gs_enter_context` calls `gs_leave_context`, so the suggested root cause is wrong.
- `frontend/utility/AdvancedOutput.cpp:370-377`: rescale string parsed with sscanf and passed to `obs_encoder_set_scaled_size` without validation.
- `frontend/settings/OBSBasicSettings.cpp:1517-1520`: downscale presets round to even. Typed values are not rounded.

Related: none.

### [#13367](https://github.com/obsproject/obs-studio/issues/13367) — Crash if service restrictions change resolution and the user rejects changes

**Verdict: CANNOT_VERIFY**

Filed by a maintainer, who guesses that the Video page widgets are "not valid" when the page was never visited. In current code the Video page is not lazy-loaded. `outputResolution->lineEdit()` (null when the combo is not editable) is guarded by `isEditable()` everywhere in the revert path. `UpdateResFPSLimits` turns `outputResolution` non-editable for a restricted service. On revert, `LoadSettings(true)` runs `LoadStream1Settings`, which then queues `UpdateResFPSLimits`, followed by `LoadVideoSettings`. The faulting access is not visible without the crash stack, which is only linked.

Evidence:
- `frontend/settings/OBSBasicSettings.cpp:3838-3863`: QueryChanges "No" calls `LoadSettings(true)`.
- `frontend/settings/OBSBasicSettings_Stream.cpp:1334-1366`: `outputResolution` cleared, `setEditable(false)`, or `RecreateOutputResolutionWidget()`.
- `frontend/settings/OBSBasicSettings.cpp:1488-1493, 1545-1555, 1659-1661, 4176-4179`: lineEdit accesses guarded by editability.
- `frontend/settings/OBSBasicSettings_Stream.cpp:244`: UpdateResFPSLimits queued after stream settings reload.

Related: none.

### [#13368](https://github.com/obsproject/obs-studio/pull/13368) — frontend: Hide Twitch docks on minimized start

**Verdict: IMPLEMENT (cherry-pick-pr, with trivial conflict resolution)**

The defect is identifiable. With "Minimize to system tray when started", Twitch's late `LoadSecondaryUIPanes` makes its docks floating and calls `restoreState(dockState)` while the main window is hidden. The floating docks then show on their own. The PR records which extra docks are meant to be visible while start-up is hidden, keeps them hidden, and restores them in `OBSBasic::showEvent`. The change is +83/-2 in 4 frontend files with no new dependencies.

The 2 conflict blocks are purely stylistic. Master has since added braces around `if (main->isVisible() || !main->isMaximized())` in TwitchAuth.cpp and around `if (extraBrowser) return;` in OBSBasic_Docks.cpp. Resolve by keeping master's braces and inserting the PR's condition and the `DeferExtraDockVisibility(dock);` call.

Evidence:
- `frontend/oauth/TwitchAuth.cpp:392-420`: docks are set floating and moved, then `restoreState` runs when `isVisible() || !isMaximized()`.
- `frontend/widgets/OBSBasic.cpp:1149-1155` (master equivalent of the PR hunk): `hideWindowOnStart` computed in `OBSInit`.
- `frontend/widgets/OBSBasic_Docks.cpp:143-178`: `AddDockWidget` extra-browser early return and extra-dock bookkeeping.
- Legacy merge-tree: 2 conflict blocks, both brace style.

Slice plan:
- Cherry-pick ebe4dbebf, skipping the PR's merge commit 14166dd7c, and resolve the two brace-style conflicts by hand.
- Preserve the original authorship.
- Test: MSVC build of `obs-studio` (frontend). Runtime check needs a Twitch-integrated build (TWITCH_CLIENTID/HASH), which this fork does not have, so the Twitch behaviour is UNTESTED. The generic part can be smoke-tested: start with `--minimize-to-tray`, add custom browser docks, and check that floating docks stay hidden until the window is shown.

Related: #13293.

### [#13374](https://github.com/obsproject/obs-studio/issues/13374) — Hyprid MP4 - Data Corruption with Multitrack PCM24 and Frame Skip at End of Recording when Time Split

**Verdict: CANNOT_VERIFY**

This report bundles several separate claims: corruption after power loss, a one-frame drop at time-based splits, and multitrack PCM24 recovery differences. Recovery after power loss is best-effort by design. Split timing in `mp4-output.c` cuts at a keyframe on the primary track (`should_split`), so a split can land a frame either side of the nominal time. None of the claims comes with a sample file or steps that pin down a code defect. Each would need its own repro.

Evidence:
- `plugins/obs-outputs/mp4-output.c:334-350` (`should_split`): split only on primary-track keyframes, never inside a GOP.
- `plugins/obs-outputs/mp4-output.c:418-455` (`change_file`): finalise and reopen at the split packet.

Related: #13165.

### [#13408](https://github.com/obsproject/obs-studio/pull/13408) — obs-webrtc: Add 512Kb limit for WHIP Responses

**Verdict: IMPLEMENT (cherry-pick-pr)**

This is a small hardening fix from the WHIP output maintainer. `curl_writefunction` currently appends an HTTP response of any size into a `std::string`, which is then handed to libdatachannel's SDP parser. The PR caps it at 512 KiB and returns `CURL_WRITEFUNC_ERROR`. It adds 5 lines in one header and applies cleanly (0 conflict blocks). `CURL_WRITEFUNC_ERROR` needs libcurl 7.87 or newer. The Windows deps (2026-10-23) define it, and the Linux CI targets Ubuntu 26.04, so that is fine.

Evidence:
- `plugins/obs-webrtc/whip-utils.h:42-50`: unbounded `read_buffer->append`.
- `.deps/obs-deps-2026-10-23-x64/include/curl/curl.h:274`: `#define CURL_WRITEFUNC_ERROR 0xFFFFFFFF`.
- `.github/workflows/build-project.yaml:7`: Linux CI uses ubuntu-26.04 (curl 8.x).
- `git diff master...refs/upstream-pr/13408`: +5 lines; legacy merge-tree shows no conflicts.

Slice plan:
- Cherry-pick 45a450e28, preserving Sean DuBois's authorship.
- Test: MSVC build of the `obs-webrtc` target. A runtime check against an oversized WHIP response needs a WHIP server; if none is available, note it as UNTESTED. The normal path is unchanged for responses under 512 KiB.

Related: #13270, #13161.
