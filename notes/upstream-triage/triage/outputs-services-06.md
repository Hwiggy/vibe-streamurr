# Triage batch outputs-services-06

- Batch: outputs-services-06 (area hint: outputs-services)
- Items: 11776, 11781, 11793, 11859, 11876, 11885, 11907, 11908, 11930, 11944, 11965, 11967, 11968, 11984, 12009, 12012, 12033, 12043, 12069, 12080
- Date: 2026-10-26
- Base commit: 72e866557 (`git rev-parse --short master`)
- Method: item bodies came from `notes/upstream-triage/data/all.json`. PR heads were inspected locally (`refs/upstream-pr/N`). The local git is 2.33, which has no `merge-tree --write-tree`, so applicability was checked with `git diff master...refs/upstream-pr/N | git apply --check`. Two WebFetches were used, for #11908 and #11944.

Summary:

| # | Kind | Verdict |
|---|------|---------|
| 11776 | issue | CANNOT_VERIFY |
| 11781 | PR | DEFER_LARGE |
| 11793 | issue | CANNOT_VERIFY |
| 11859 | issue | CANNOT_VERIFY |
| 11876 | issue | CANNOT_VERIFY |
| 11885 | issue | ALREADY_ADDRESSED |
| 11907 | issue | DEFER_LARGE |
| 11908 | issue | IMPLEMENT (cherry-pick PR #13546) |
| 11930 | issue | CANNOT_VERIFY |
| 11944 | issue | CANNOT_VERIFY |
| 11965 | issue | CANNOT_VERIFY |
| 11967 | issue | CANNOT_VERIFY |
| 11968 | issue | CANNOT_VERIFY |
| 11984 | issue | CANNOT_VERIFY |
| 12009 | issue | CANNOT_VERIFY |
| 12012 | issue | CANNOT_VERIFY |
| 12033 | PR | IMPLEMENT (cherry-pick) |
| 12043 | issue | CANNOT_VERIFY |
| 12069 | issue | CANNOT_VERIFY |
| 12080 | issue | CANNOT_VERIFY |

---

### [#11776](https://github.com/obsproject/obs-studio/issues/11776) — Hot Key Instant Replay stopped working during live streaming

**Verdict: CANNOT_VERIFY**

On macOS 15, the Save Replay hotkey works once and then stops at random until OBS restarts. The report has no steps that isolate the cause, and we cannot read the log here. Nothing in the replay-buffer save path explains a hotkey that dies only on one platform. It could be macOS hotkey or input-monitoring permissions, or the replay output getting stuck (see #12080). There is no defect we can point to in the code.

- Evidence: the hotkey save path goes through the frontend replay buffer handling in `frontend/utility/AdvancedOutput.cpp` / `SimpleOutput.cpp`. No platform-specific defect is visible.
- Related: #12080

### [#11781](https://github.com/obsproject/obs-studio/pull/11781) — Restream.io: Manage Broadcast feature

**Verdict: DEFER_LARGE**

This is a new partner-integration feature: a Restream event picker dialog, an OAuth API expansion, and a broadcast flow. It touches 13 files with 853 insertions and 141 deletions, adds a new `.ui` form and dialog, and refactors `OBSBasic_YouTube.cpp`. It no longer applies to master. `git apply --check` fails on `frontend/cmake/ui-widgets.cmake`, `frontend/oauth/RestreamAuth.cpp` and `frontend/widgets/OBSBasic.hpp`. It also needs a working Restream API client ID, which our fork cannot test. Upstream has not merged it after more than 18 months.

- Evidence: `git diff master...refs/upstream-pr/11781 --stat` (13 files, +853/-141); `git apply --check` conflicts listed above.

### [#11793](https://github.com/obsproject/obs-studio/issues/11793) — Twitch docks disappear after restarting OBS

**Verdict: CANNOT_VERIFY**

Twitch browser docks lose their layout when OBS is started as administrator from a desktop shortcut. A third-party dock plugin was installed during the investigation. Running elevated changes the user and profile context, and the browser dock state is restored by the Twitch auth and dock code only after the auth loads. We have no reproduction and cannot point to a specific defect.

- Evidence: Twitch docks are created in `frontend/oauth/TwitchAuth.cpp` after login. Dock state is restored from the profile/global config in `frontend/widgets/OBSBasic.cpp`.
- Related: #12043 (same reporter, Twitch auth problems)

### [#11859](https://github.com/obsproject/obs-studio/issues/11859) — Record audio and stream audio interrupts when changing scenes

**Verdict: CANNOT_VERIFY**

On macOS, audio drops briefly on scene changes. The report gives no source setup (for example, whether the audio source is scene-specific with a deactivate-when-not-showing capture) and no repro steps beyond "change scenes". We cannot point to a defect in the libobs audio mixing path from this information.

- Evidence: audio mixing is in `libobs/obs-audio.c`. Scene transitions are in `libobs/obs-source-transition.c`. No specific defect identified.

### [#11876](https://github.com/obsproject/obs-studio/issues/11876) — YouTube Live Control Panel no longer connects to OBS Studio

**Verdict: CANNOT_VERIFY**

The YouTube Live Control Panel dock is a browser dock that loads YouTube's own web app (`studio.youtube.com/live/channel/%1/console?kc=OBS`). How it behaves after a stream is selected depends mostly on Google's side and its JS bridge. Nothing in the client-side dock code shows a regression.

- Evidence: `frontend/docks/YouTubeAppDock.cpp:21,27` (web-app URLs), `:279` `Update()`, `:228` `DispatchYTEvent`.

### [#11885](https://github.com/obsproject/obs-studio/issues/11885) — OBS quit unexpectedly when SRT server rejects connection or passphrase is wrong

**Verdict: ALREADY_ADDRESSED**

Commit 651544a48 ("obs-ffmpeg: Reimplement reconnection logic in mpegts muxer", 2025-06-09) names this issue in its message ("Fixes bugs #11885, ..."). It moves start and stop onto threads guarded by a mutex. Commit 8d9bd4417 had already added an explicit socket-state check after `srt_connect`. Later fixes 467967eab (invalid URL crash) and ef93ef695 (null-check URL query params) harden the same path.

- Evidence: `git log -1 651544a48` (message references #11885); `plugins/obs-ffmpeg/obs-ffmpeg-srt.h:826-836` (socket state check; returns a connect-failed error instead of continuing); `plugins/obs-ffmpeg/obs-ffmpeg-mpegts.c:343-370` (open/fail cleanup path).

### [#11907](https://github.com/obsproject/obs-studio/issues/11907) — Overload messages disappear when using "Rescale Output" option

**Verdict: DEFER_LARGE** (root cause identified, but the fix needs a design decision)

Root cause (confirmed in code): when GPU rescale is enabled, `obs_encoder` moves the encoder onto a separate `encoder_only_mix`, which has its own `video_t`. The frontend reads skipped and total frame counters only from the main mix (`obs_get_video()`). Frames skipped by the rescaled encoder are counted on a different `video_t` root, so the status bar and the Stats dock show 0/0.

No small slice exists, for two reasons:
- Encoder-only mixes are created and destroyed as encoders start and stop. Summing across mixes therefore makes the counters non-monotonic, which breaks the start-offset arithmetic in the status bar and Stats.
- A proper fix needs either a new libobs aggregate API (for example, a per-view or global skipped-frame total kept across mix lifetimes), or the frontend tracking each output's encoder `video_t` separately.

Both options need maintainer design input and libobs API changes.

- Evidence: `libobs/obs-encoder.c:248-310` (a GPU-scaled encoder gets a new mix via `obs_create_video_mix`, `encoder_only_mix = true`, `obs_encoder_set_video(encoder, current->video)`); `libobs/media-io/video-io.c:616-624` (counters are per `video_t` root); `frontend/widgets/OBSBasicStatusBar.cpp:58-59,474-475` and `frontend/widgets/OBSBasicStats.cpp:262-264,366-367` (read only `obs_get_video()`); `frontend/wizards/AutoConfigTestPage.cpp:649` (same pattern).
- Related: #11908 (same reporter, rescale UI)

### [#11908](https://github.com/obsproject/obs-studio/issues/11908) — Rescale Output resolution is not gray out in disabled state

**Verdict: IMPLEMENT** (cherry-pick PR #13546)

A maintainer confirmed in the thread (WebFetch) that only the Streaming tab is affected, not Recording. Root cause: `LoadAdvOutputStreamingSettings()` sets `advOutRescale` enabled only when the filter is not Disabled (line 1879). `UpdateMultitrackVideo()` runs later and calls `ui->advOutRescale->setDisabled(disable_video)`. When multitrack video is off, `disable_video` is false, so that call re-enables the resolution box regardless of the filter. The Recording box is never touched by this function, which is why it stays correct.

Upstream PR #13546 ("frontend: Fix rescale dropdown enable desync") makes the one-line fix, and it applies cleanly to master.

- Evidence: `frontend/settings/OBSBasicSettings.cpp:1879` (correct initial enable); `:5897-5900` (`UpdateMultitrackVideo` re-enables `advOutRescale` unconditionally); `:817-823` (filter-change lambda that normally keeps it in sync); `frontend/forms/OBSBasicSettings.ui:3453-3456` (disabled by default).
- Related: PR #13546 (`refs/upstream-pr/13546`, commit 3e8374f80), #11907

**Slice plan:**
- Approach: cherry-pick 3e8374f80 from `refs/upstream-pr/13546`, keeping its authorship.
- Change: in `UpdateMultitrackVideo()`'s `update_advanced_output_settings` lambda, replace `ui->advOutRescale->setDisabled(disable_video);` with `ui->advOutRescale->setDisabled(disable_video || ui->advOutRescaleFilter->currentIndex() == 0);` (index 0 is `OBS_SCALE_DISABLE`, added first at line 811).
- Files: `frontend/settings/OBSBasicSettings.cpp` (2 lines).
- Test plan: build the `obs-studio` frontend with MSVC on Windows x64. Then: Settings > Output > Advanced > Streaming, set Rescale Output to Disabled, OK, reopen Settings, and confirm the resolution combo is greyed. Also toggle the filter to Bilinear and back to confirm it enables and disables. If no GUI run is possible, mark it UNTESTED (compile only).

### [#11930](https://github.com/obsproject/obs-studio/issues/11930) — Crash when youtube chat placeholder added as browser source

**Verdict: CANNOT_VERIFY**

The reporter added `https://obsproject.com/placeholders/youtube-chat` (the chat dock placeholder) as a browser source, and OBS now crashes on startup. That URL is an ordinary web page, so a crash would be in CEF or obs-browser (a submodule), not in the frontend code that uses the URL. The crash log is linked as a Google Doc with no stack in the body, so there is nothing to act on.

- Evidence: `frontend/oauth/YoutubeAuth.cpp:25` (`YOUTUBE_CHAT_PLACEHOLDER_URL`), used only for the chat dock widget at `:134,:177`.

### [#11944](https://github.com/obsproject/obs-studio/issues/11944) — OBS crashes when using colons in srt-URL

**Verdict: CANNOT_VERIFY**

This happens only on Linux (an Ubuntu 24.04 PPA install). The maintainer could not reproduce it on Windows. The thread (WebFetch) shows the only backtrace is a SIGSEGV inside `libsrt-gnutls.so.1.5` (`srt::CUDTUnited::generateSocketID`). The maintainer pointed out that OBS builds libsrt against mbedtls, while the distro package pulls in the gnutls variant. The crash is in a system library under one distribution's packaging, and both the media source (FFmpeg) and the VLC source hit it. No OBS defect has been identified.

- Evidence: our own SRT code (`plugins/obs-ffmpeg/obs-ffmpeg-srt.h:657-845`) is only used by the mpegts output, not by the media source (`plugins/obs-ffmpeg/obs-ffmpeg-source.c` uses libavformat's libsrt protocol).
- Related: #11885

### [#11965](https://github.com/obsproject/obs-studio/issues/11965) — Unable to access Settings>Output>Advanced (keeps bouncing to Replay Buffer tab)

**Verdict: CANNOT_VERIFY**

No code in the settings dialog changes the `advOutTabs` QTabWidget's current tab. A grep for `advOutTabs` across `frontend/settings` finds no `setCurrentIndex` or `setCurrentWidget`. A tab that cycles on its own points to stuck input (a key or wheel event) or a third-party tool, not OBS logic. The report has no repro steps.

- Evidence: `frontend/forms/OBSBasicSettings.ui:3185` (`advOutTabs` defined); no programmatic tab switching in `frontend/settings/*.cpp`.

### [#11967](https://github.com/obsproject/obs-studio/issues/11967) — Black screen when capturing fullscreen gameplay of emulators

**Verdict: CANNOT_VERIFY**

Exclusive-fullscreen emulators (Snes9x, Project64) show black or frozen frames on a specific setup with an RTX 3090 and two identical monitors. This depends on the GPU, driver and present mode (exclusive fullscreen versus DXGI flip). The game-capture hook cannot be checked without the hardware.

- Evidence: capture hooks are in `plugins/win-capture/graphics-hook/` (D3D9/OpenGL paths these emulators use). No code defect identified.

### [#11968](https://github.com/obsproject/obs-studio/issues/11968) — crash when closing obs after a stream

**Verdict: CANNOT_VERIFY**

The report is empty: the expected and current behavior fields are ".", there are no steps and no crash log. Nothing can be acted on.

### [#11984](https://github.com/obsproject/obs-studio/issues/11984) — VLC source cuts off the last part of output only (not in monitoring)

**Verdict: CANNOT_VERIFY**

On Slackware, audio monitoring of a VLC source keeps playing for a few seconds after the source stops, and the delay grows with play time. This looks like monitoring buffer drift in the PulseAudio monitoring backend on that system. The report is speculative and gives no root cause. We cannot reproduce it here (Linux-only path) or name a defect.

- Evidence: Linux monitoring is in `libobs/audio-monitoring/pulse/pulseaudio-output.c`; the VLC source is in `plugins/vlc-video/vlc-video-source.c`.

### [#12009](https://github.com/obsproject/obs-studio/issues/12009) — Undeletable Folders - Adding Illegal Characters

**Verdict: CANNOT_VERIFY**

`/` in the filename format is meant to work: it creates subfolders. `generate_filename` passes the directory part to `os_mkdirs`, which recursively calls `CreateDirectory` for each segment. On Windows the settings field already strips `<>:"|?*`. The reporter does not give the exact format string. The undeletable folder is most likely a segment with a trailing space or dot (for example `"name //x"`), which Win32 tools cannot delete. Without the format string we cannot tell which segment rule failed. A hardening slice is possible (strip trailing spaces and dots from each path segment), but the defect is not pinned down.

- Evidence: `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:574-600` (`generate_filename` -> `os_mkdirs`); `libobs/util/platform.c:614-648` (`recursive_mkdir`, no per-segment sanitizing); `libobs/util/platform-windows.c:713-728` (`os_mkdir` -> `CreateDirectory`); `frontend/settings/OBSBasicSettings.cpp:4228-4243` (Windows sanitizer allows `/`).

### [#12012](https://github.com/obsproject/obs-studio/issues/12012) — FLIR USB Camera only shows one pixel stretched to the whole frame

**Verdict: CANNOT_VERIFY**

A device-specific problem with a FLIR Boson thermal camera (I420/NV12/Y16 UVC). It would need the hardware to diagnose the DirectShow format negotiation in `plugins/win-dshow` / libdshowcapture.

### [#12033](https://github.com/obsproject/obs-studio/pull/12033) — rtmp-services: Fix bugs blocking WHIP services

**Verdict: IMPLEMENT** (cherry-pick)

The defect is confirmed in code. `rtmp_common_get_connect_info()` returns NULL for `OBS_SERVICE_CONNECT_INFO_BEARER_TOKEN`. The WHIP output assigns that result straight into a `std::string` (`bearer_token = obs_service_get_connect_info(...)`). Constructing a `std::string` from a null `const char*` is undefined behavior and crashes, so any WHIP-protocol entry in `services.json` would crash on stream start. The PR returns the stream key as the bearer token for WHIP services. It also relaxes the schema so WHIP services need not set the deprecated `recommended.output` field. The change is two commits (+9/-3), and `git apply --check` passes on master.

- Evidence: `plugins/rtmp-services/rtmp-common.c:1140-1141` (`BEARER_TOKEN` -> `return NULL`); `plugins/obs-webrtc/whip-output.cpp:270` (assigns into `std::string bearer_token`, declared at `whip-output.h:54`); `plugins/rtmp-services/data/schema/service-schema-v5.json:236` (WHIP in the output-required pattern).
- Related: upstream #12032 (Streamplace service addition, not in this batch)

**Slice plan:**
- Approach: cherry-pick e3df0511f and 701eb6a3c from `refs/upstream-pr/12033`, keeping authorship.
- Files: `plugins/rtmp-services/rtmp-common.c` (`BEARER_TOKEN` case returns `rtmp_common_key()` when protocol is WHIP), `plugins/rtmp-services/data/schema/service-schema-v5.json` (drop WHIP from the output-required pattern).
- Optional defensive extra (not in PR): in `whip-output.cpp:270`, guard against NULL before assigning (`const char *t = ...; bearer_token = t ? t : "";`). That protects third-party services too.
- Test plan: build the `rtmp-services` and `obs-webrtc` targets with MSVC on Windows x64. If the service JSON validation script is available, run it against `services.json` to check the schema still validates. A real WHIP stream needs a WHIP endpoint (none is in `services.json` yet), so mark the runtime behavior UNTESTED.

### [#12043](https://github.com/obsproject/obs-studio/issues/12043) — Forced to delete OBS cache and flush DNS every time I open a profile logged into Twitch

**Verdict: CANNOT_VERIFY**

"Failed to Authenticate with Twitch" goes away only after deleting `obs_profile_cookies` and flushing DNS. That points to the reporter's network or DNS environment (the DNS flush matters), not a code defect. Nothing reproduces it or shows a fault in `TwitchAuth`.

- Evidence: `frontend/oauth/TwitchAuth.cpp` (token refresh / auth flow). The need for a DNS flush points outside OBS.
- Related: #11793 (same reporter)

### [#12069](https://github.com/obsproject/obs-studio/issues/12069) — Unable to record while replay buffer is running

**Verdict: CANNOT_VERIFY**

With the replay buffer running, stopping a recording is slow and leaves a broken file. Recording and the replay buffer can share the recording encoder (`AdvancedOutput.cpp` / `SimpleOutput.cpp`). Without the log (not available offline) we cannot tell which muxer or encoder path fails. Recording and replay buffer together is a common configuration, so this is probably setup-specific.

- Evidence: shared encoder setup in `frontend/utility/AdvancedOutput.cpp` (recording and replay buffer outputs share `videoRecording`). No specific defect identified.
- Related: #12080

### [#12080](https://github.com/obsproject/obs-studio/issues/12080) — Replay Buffer doesn't work consistently

**Verdict: CANNOT_VERIFY**

After sleep or hibernate on Windows 11, Save Replay often does nothing, and the replay buffer then sticks at "Stopping...". This suggests the encoder or output stalls after a power transition, which depends on the hardware encoder and driver. The report cross-references older issue #8753. There is no stack or log detail that leads to a code defect.

- Evidence: replay save and stop go through `frontend/utility/AdvancedOutput.cpp` / `SimpleOutput.cpp` and `plugins/obs-ffmpeg/obs-ffmpeg-mux.c` (replay buffer). No defect identified.
- Related: #11776, #12069
