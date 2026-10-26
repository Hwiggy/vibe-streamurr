# Upstream triage — batch outputs-services-08

- Batch: outputs-services-08 (area hint: outputs-services)
- Items: 12726, 12745, 12748, 12763, 12774, 12776, 12790, 12843, 12847, 12848, 12863, 12876, 12911, 12912, 12952, 12958, 12985, 13021, 13082, 13144
- Date: 2026-10-26
- Base commit: 72e866557 (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; PR heads from `refs/upstream-pr/<N>`; code read at master. No comment threads consulted (no WebFetch used).
- Note on conflict checks: local git is 2.33 (no `merge-tree --write-tree`), so the legacy three-way `git merge-tree <base> master <pr>` was used and `+<<<<<<<` markers counted.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 12726 | issue | CANNOT_VERIFY |
| 12745 | issue | CANNOT_VERIFY |
| 12748 | issue | CANNOT_VERIFY |
| 12763 | issue | CANNOT_VERIFY |
| 12774 | issue | CANNOT_VERIFY |
| 12776 | issue | CANNOT_VERIFY |
| 12790 | issue | DEFER_LARGE |
| 12843 | issue | IMPLEMENT |
| 12847 | issue | IMPLEMENT |
| 12848 | PR | IMPLEMENT (cherry-pick) |
| 12863 | PR | DEFER_LARGE |
| 12876 | PR | DEFER_LARGE |
| 12911 | PR | DEFER_LARGE |
| 12912 | issue | CANNOT_VERIFY |
| 12952 | issue | IMPLEMENT |
| 12958 | issue | CANNOT_VERIFY |
| 12985 | PR | IMPLEMENT (partial) |
| 13021 | PR | DEFER_LARGE |
| 13082 | PR | IMPLEMENT (cherry-pick) |
| 13144 | issue | IMPLEMENT |

---

### [#12726](https://github.com/obsproject/obs-studio/issues/12726) — Changing video settings requires restarting OBS, otherwise recording is never saved

**Verdict: CANNOT_VERIFY**

Linux Mint report: after changing Advanced recording encoder settings and applying, the reporter says obs-ffmpeg-mux is spawned "without arguments" and no file is produced until OBS restarts. The reporter is unsure which settings trigger it, and the only evidence is an external log URL. Nothing in the body identifies a code path; the mux command line is built fresh on every start from the output settings, so a stale-settings bug cannot be located without a reproducer.

- Evidence: `plugins/obs-ffmpeg/obs-ffmpeg-mux.c` builds the command line per start (no cached arguments to point at).
- Related: none.

### [#12745](https://github.com/obsproject/obs-studio/issues/12745) — Recording an SRT stream, OBS crashes when exiting directly

**Verdict: CANNOT_VERIFY**

Crash on exit while recording (custom FFmpeg output to an SRT URL). The faulting frame is `signal_handler_disconnect` called from obs-websocket's `EventHandler` destructor, so a signal handler is used after it was freed during shutdown. That code is in the obs-websocket submodule (a separate upstream repo), and the ordering between output teardown and the plugin unloading cannot be pinned down without a debugger. No clear defect in obs-studio core code.

- Evidence: `libobs/callback/signal.c` (`signal_handler_disconnect`), crash stack in the body points at obs-websocket `EventHandler::~EventHandler`.
- Related: none.

### [#12748](https://github.com/obsproject/obs-studio/issues/12748) — Windows 11, replay error during replay recording

**Verdict: CANNOT_VERIFY**

Replay buffer with NVENC HEVC fails after about 30 minutes on a mixed AMD/NVIDIA dual-GPU system, with a game and NVIDIA Broadcast running. This is hardware/driver-specific; the body has no actionable stack and the reporter suspects unrelated NVENC option warnings.

- Evidence: n/a (hardware/driver dependent; encoder in `plugins/obs-nvenc/`).
- Related: none.

### [#12763](https://github.com/obsproject/obs-studio/issues/12763) — OBS freeze when using Twitch activity feed

**Verdict: CANNOT_VERIFY**

OBS sometimes freezes at startup when the Twitch Activity Feed browser dock is enabled. That dock is a CEF page served by Twitch, inside the obs-browser submodule. There is no hang stack, so we cannot tell whether this is a CEF deadlock, a Twitch page problem or a frontend problem.

- Evidence: browser docks are created through obs-browser (`plugins/obs-browser`, submodule); no frame in the report points at frontend code.
- Related: none.

### [#12774](https://github.com/obsproject/obs-studio/issues/12774) — Audio from VLC Video Source not being output

**Verdict: CANNOT_VERIFY**

VLC source audio can be heard in monitoring but not in the stream since 32.x. This often comes down to configuration (monitor-only mode, or the source's audio tracks not assigned to the stream track). Nothing in the body points to a defect in `plugins/vlc-video`, and confirming it would need the log or a repro.

- Evidence: `plugins/vlc-video/vlc-video-source.c` audio path is unchanged in nature (it pushes audio through `obs_source_output_audio`); no specific regression identified.
- Related: none.

### [#12776](https://github.com/obsproject/obs-studio/issues/12776) — Using Media Source, hardware decoding of SRT video feed fails

**Verdict: CANNOT_VERIFY**

macOS only: SRT ingest through a Media Source with hardware decoding (VideoToolbox through FFmpeg hwaccel) drops whole seconds of video since 31.1. This depends on the platform, hardware decoder and FFmpeg version and can't be checked on this Windows machine. No specific code defect is identifiable.

- Evidence: hw decode selection in `deps/media-playback/media-playback/decode.c` (hwaccel path); behaviour depends on FFmpeg/VideoToolbox.
- Related: none.

### [#12790](https://github.com/obsproject/obs-studio/issues/12790) — WHIP output fails to connect when server only provides TURN relay via Link header

**Verdict: DEFER_LARGE**

The WHIP output does parse `Link: rel="ice-server"` headers into `rtc::IceServer` (`ParseLinkHeader`), but only after the answer has arrived, and it then calls `gatherLocalCandidates(iceServers)`. Candidates gathered then (including relay candidates) never reach the server, because OBS has no trickle-ICE PATCH support. The server in the report only offers TURN over TCP (`?transport=tcp`), which also depends on what the bundled libdatachannel/libjuice ICE backend supports. Fixing this properly needs either trickle ICE (#12876 / #13021) or ICE servers supplied before the offer (#12863 / #13021, OPTIONS pre-fetch), and both are competing, unsettled designs. Not a small slice.

- Evidence: `plugins/obs-webrtc/whip-output.cpp:342-395` (Link header parsing after answer), `plugins/obs-webrtc/whip-output.cpp:584-586` (post-answer `gatherLocalCandidates`), `plugins/obs-webrtc/whip-output.cpp:284-285` (`disableAutoGathering`).
- Related: #12848, #12863, #12876, #13021.

### [#12843](https://github.com/obsproject/obs-studio/issues/12843) — Settings window crashes (segfault) the app when there are no outputs

**Verdict: IMPLEMENT**

Confirmed in code. In `OBSBasicSettings_Stream.cpp`, `const char *output;` is declared **uninitialized** and filled only by the `return_first_id` callback of `obs_enum_output_types_with_protocol`. That function returns early if the protocol isn't registered, or never calls back if no output matches. `output` is then passed to `obs_get_output_supported_{video,audio}_codecs()` → `find_output(id)`, which calls `strcmp(..., id)` without checking for NULL. With no outputs (e.g. a minimal Linux build), this reads a garbage or NULL pointer and crashes. Downstream code already treats NULL codec lists as "all supported" (`service_supports_codec` returns true for NULL, `strlist_split(NULL)` is safe), so guarding is enough.

- Evidence: `libobs/obs-output.c:122-130` (`find_output` with no NULL check), `libobs/obs-output.c:3271-3274` (early return leaves out-param untouched), `frontend/settings/OBSBasicSettings_Stream.cpp:1463-1469`, `:1497-1503`, `:1667-1681` (uninitialized `const char *output`), `frontend/settings/OBSBasicSettings_Stream.cpp:1407-1411` (NULL codecs → true), `libobs/util/dstr.c:263-271` (strlist_split handles NULL).
- Related: none.

**Slice plan (new-change, cross-platform, ~10 lines):**
1. `libobs/obs-output.c` `find_output`: `if (!id) return NULL;` (the reporter's patch).
2. `frontend/settings/OBSBasicSettings_Stream.cpp`: initialize all four `const char *output = nullptr;` declarations so the libobs guard is reached deterministically instead of with garbage.
- Test plan: MSVC build of `libobs` + `obs-studio` frontend. The crash scenario (no service outputs registered) can't easily be reproduced on a full Windows build; a cmocka-style check calling `obs_get_output_supported_video_codecs(NULL)` is possible only with an initialized libobs, so runtime behaviour is UNTESTED beyond the build.

### [#12847](https://github.com/obsproject/obs-studio/issues/12847) — "Read from file" freezes OBS video if file is over the network and unavailable

**Verdict: IMPLEMENT**

Confirmed in code. The GDI+ text source polls the file's modification time with `os_stat()` once a second from `video_tick`, which runs on the graphics thread, and calls `LoadFileText()` (`os_quick_read_utf8_file`) from the same tick. On an unreachable UNC path, Windows SMB timeouts block for about 20 seconds, which freezes the whole video pipeline (missed frames). The FreeType2 text source (Linux/macOS) does the same. The fix is to move the stat and read off the graphics thread.

- Evidence: `plugins/obs-text/gdiplus/obs-text.cpp:302-309` (`get_modified_timestamp` → `os_stat`), `plugins/obs-text/gdiplus/obs-text.cpp:858-883` (`Tick` stats and reads file on video thread), `plugins/obs-text/gdiplus/obs-text.cpp:676-678` (`LoadFileText` blocking read), `plugins/text-freetype2/text-freetype2.c:296` and `plugins/text-freetype2/text-functionality.c:347-353` (same pattern).
- Related: none.

**Slice plan (new-change, windows, ~90 lines, gdiplus text only as first slice):**
1. In `TextSource`, add a small worker thread (std::thread + std::atomic stop flag + condition_variable/os_event) started when `read_from_file` is enabled and stopped on update/destroy. Each second it runs `os_stat` and, when mtime changes, `os_quick_read_utf8_file`, then stores the new text under a mutex and sets an atomic `pending_text` flag.
2. `Tick()` only checks `pending_text`. When set, it swaps the string in and runs `TransformText(); RenderText();` (these stay on the graphics thread as today).
3. Leave text-freetype2 for a follow-up slice (same approach).
- Test plan: MSVC build of `obs-text`; manual run with "Read from file" pointed at a non-existent UNC path (`\\10.255.255.1\x\y.txt`), checking that stats show no missed-frame block, and that the local-file update still works. If manual run isn't possible, mark UNTESTED.

### [#12848](https://github.com/obsproject/obs-studio/pull/12848) — obs-webrtc: Enable ice-tcp

**Verdict: IMPLEMENT (cherry-pick-pr)**

A 4-line PR by the obs-webrtc maintainer (Sean-Der). It sets `cfg.enableIceTcp = true` in the WHIP `rtc::Configuration`, guarded by `RTC_VERSION > 0.23`. The PR depended on an obs-deps libdatachannel bump. The local deps (`obs-deps-2026-10-23`) already ship libdatachannel 0.24, and `rtc::Configuration` there has the `enableIceTcp` field, so the guard is satisfied and the change compiles and takes effect. It applies cleanly (0 conflict markers). This gives networks that block UDP a TCP fallback, which partly addresses #12790.

- Evidence: `plugins/obs-webrtc/whip-output.cpp:284-288` (insertion point next to `disableAutoGathering`), `.deps/obs-deps-2026-10-23-x64/include/rtc/version.h` (`RTC_VERSION_MINOR 24`), `.deps/obs-deps-2026-10-23-x64/include/rtc/configuration.hpp:75` (`bool enableIceTcp = false;`). PR head `refs/upstream-pr/12848` = commit fdf8e7f3f.
- Related: #12790, #12876, #13021.

**Slice plan:** `git cherry-pick fdf8e7f3f` (author preserved; GPL-2.0-or-later contribution). Files: `plugins/obs-webrtc/whip-output.cpp` (+4).
- Test plan: MSVC build of `obs-webrtc` on Windows x64. Runtime ICE-TCP negotiation needs a WHIP server that offers TCP candidates, so it is UNTESTED unless one is available.

### [#12863](https://github.com/obsproject/obs-studio/pull/12863) — obs-webrtc: Add static stun server

**Verdict: DEFER_LARGE**

Adds a STUN server text field and checkbox to Stream settings for WHIP, a new service getter in `obs-service.h`, and plumbing through rtmp-services. It is about 360 changed lines, including a 263-line `.ui` rewrite, and conflicts with master (8 conflict markers). It adds new settings UI (a UX decision), and its author later opened #12876 after maintainer discussion, which suggests this approach was set aside in favour of trickle ICE.

- Evidence: `git diff master...refs/upstream-pr/12863 --stat` (12 files, +235/-125), legacy merge-tree shows 8 conflict hunks; current ICE config path `plugins/obs-webrtc/whip-output.cpp:342-395`.
- Related: #12790, #12876, #13021.

### [#12876](https://github.com/obsproject/obs-studio/pull/12876) — obs-webrtc: Add Trickle ICE

**Verdict: DEFER_LARGE**

The PR is about 100 lines and applies cleanly, but it's not ready to cherry-pick:
- it has a literal `// TODO: send http patch`;
- the curl handle and header list leak on the success path (cleanup only runs on errors);
- the ufrag/pwd regexes capture the trailing `\r`;
- any server that rejects PATCH (non-204) makes it stop the whole output with `OBS_OUTPUT_INVALID_STREAM`, which would break servers that work today.

It also competes with #13021's different design (OPTIONS pre-fetch plus trickle). Choosing between them is a maintainer design decision, and hardening this one would effectively be a rewrite.

- Evidence: `git diff master...refs/upstream-pr/12876` (new `SendTrickledCandidates`, error path calls `obs_output_signal_stop`), current post-answer gathering at `plugins/obs-webrtc/whip-output.cpp:584-586`.
- Related: #12790, #12863, #13021, #12848.

### [#12911](https://github.com/obsproject/obs-studio/pull/12911) — frontend: Auto-discovery of registered services

**Verdict: DEFER_LARGE**

Refactors `LoadServices`: it removes the `ListOpt` enum and adds a `ServiceItemData` metatype so that third-party service types with a registered output protocol show up automatically in the Stream service dropdown. The PR applies cleanly, but it is a 4-commit, ~223-line refactor of core settings-dialog logic that was still in review. Its benefit is mainly for third-party plugins (no in-tree service needs it), so it isn't a small fix and is better left until upstream settles it.

- Evidence: `git diff master...refs/upstream-pr/12911 --stat` (2 files, +180/-43); current hardcoded handling in `frontend/settings/OBSBasicSettings_Stream.cpp` (`LoadServices`, `ListOpt` usage).
- Related: none.

### [#12912](https://github.com/obsproject/obs-studio/issues/12912) — Cross-fading audio breaks if "Rescale Output" is used

**Verdict: CANNOT_VERIFY**

A detailed repro: in Advanced output mode with an effective encoder rescale, transition audio cuts hard instead of cross-fading in the recording. When the rescale is a no-op ("scaling disabled"), the bug goes away. This suggests the scaled-encoder video mix path affects how transition audio is timed, but I couldn't trace a concrete defect from the rescale code to the transition audio mixer (`obs_transition_audio_render`) by reading code alone. It needs a debugging session with the repro.

- Evidence: transition audio in `libobs/obs-source-transition.c` (`obs_transition_audio_render`); scaled encoder path in `libobs/obs-encoder.c` / `libobs/obs-video.c`. No direct coupling identified.
- Related: none.

### [#12952](https://github.com/obsproject/obs-studio/issues/12952) — Crash when recording to a URL

**Verdict: IMPLEMENT**

The "Insufficient disk space" popup has a clear root cause. `StartRecording` correctly skips `LowDiskSpace()` when `IsFFmpegOutputToURL()`. But once recording starts, `RecordingStart` always starts `diskFullTimer`, and every second `CheckDiskSpaceRemaining` calls `LowDiskSpace()` **without** the URL check. `LowDiskSpace` uses `AdvOut/FFFilePath` (the local-file path, unused in URL mode, possibly empty or stale). `os_get_free_disk_space` returns 0 on failure, so the check reports low space, and OBS stops recording and replay and shows the message. The crash after the popup (stopping an FFmpeg URL output from a timer callback) isn't proven from code, but removing the false trigger avoids that path.

- Evidence: `frontend/widgets/OBSBasic_Recording.cpp:127` (start skips check for URL), `frontend/widgets/OBSBasic_Recording.cpp:174-176` (timer always started), `frontend/widgets/OBSBasic_Recording.cpp:405-421` (`LowDiskSpace` uses current output path), `frontend/widgets/OBSBasic_Recording.cpp:423-430` (`CheckDiskSpaceRemaining` lacks URL check), `frontend/widgets/OBSBasic_OutputHandler.cpp:97-115` (path = `FFFilePath`), `frontend/widgets/OBSBasic_OutputHandler.cpp:124-136` (`IsFFmpegOutputToURL`), `libobs/util/platform-windows.c:1346-1358` (returns 0 on failure).
- Related: none.

**Slice plan (new-change, cross-platform, ~4 lines):** at the top of `OBSBasic::LowDiskSpace()` add `if (IsFFmpegOutputToURL()) return false;`, which covers the start check, the periodic timer, and the replay-buffer check. The existing `!IsFFmpegOutputToURL() &&` at line 127 can stay or be dropped.
- Test plan: MSVC build of the frontend; manual run with Advanced → Recording → Custom Output (FFmpeg) → Output to URL (e.g. `udp://127.0.0.1:9999` with mpegts) and an empty/invalid FFFilePath, then confirm recording continues past 1 s with no disk-space popup. The Icecast crash itself is UNTESTED.

### [#12958](https://github.com/obsproject/obs-studio/issues/12958) — Re-connection of RTSP stream not happening

**Verdict: CANNOT_VERIFY**

The Media Source already has reconnect logic for network streams (`reconnect_delay_sec`, reconnect thread). The report (camera loses power overnight, stream never recovers until properties are re-applied) suggests the demuxer stalls without raising an error or EOF, so reconnect never triggers. That depends on FFmpeg RTSP timeout behaviour and the camera, and the log is on a private NAS. No specific defect can be identified.

- Evidence: `plugins/obs-ffmpeg/obs-ffmpeg-source.c:57-83`, `:255`, `:270`, `:335-375` (reconnect thread triggered on stop/error callbacks only).
- Related: none.

### [#12985](https://github.com/obsproject/obs-studio/pull/12985) — rtmp-services,frontend: Add data-driven VOD track support

**Verdict: IMPLEMENT (partial-pr)**

Small, in-scope idea: an optional `supports_vod_track` boolean in services.json (schema v5) that rtmp-common copies into service settings, so the frontend reads it instead of a hardcoded `{"Twitch"}` list. The PR conflicts with master (4 hunks, mainly from the braces reformat in `BasicOutputHandler.hpp`, `SimpleOutput.cpp`, `AdvancedOutput.cpp`, `OBSBasicSettings_Stream.cpp`). It also has two problems for this fork:
- (a) It **removes** the hardcoded Twitch fallback. services.json is auto-updated from the upstream `RTMP_SERVICES_URL`, and upstream's file won't carry the new key, so Twitch VOD track would silently disappear after an update.
- (b) It strips the trailing newline from `package.json`.

So take the data-driven part and keep the Twitch fallback.

- Evidence: `frontend/utility/BasicOutputHandler.hpp:138` (hardcoded `ServiceSupportsVodTrack`), `frontend/utility/SimpleOutput.cpp:682-696`, `frontend/utility/AdvancedOutput.cpp:586-604`, `plugins/rtmp-services/rtmp-common.c:137-180` (update calls `copy_info_to_settings`), `plugins/rtmp-services/rtmp-common.c:574-605` (`copy_info_to_settings`), `plugins/rtmp-services/CMakeLists.txt:6,46` + `rtmp-services-main.c:22` (remote services.json updates).
- Related: none.

**Slice plan (partial-pr, cross-platform, ~35 lines):**
1. `plugins/rtmp-services/rtmp-common.c` `copy_info_to_settings`: copy `supports_vod_track` if it is a JSON boolean (from the PR).
2. `plugins/rtmp-services/data/schema/service-schema-v5.json`: add the optional boolean property (from the PR). Don't touch `package.json`/`services.json`, so the version and remote update stay consistent.
3. `frontend/utility/BasicOutputHandler.hpp`: `ServiceSupportsVodTrack(const char *service, obs_data_t *settings)` returns the settings value when present, **else** falls back to the existing `{"Twitch"}` list.
4. Update callers in `SimpleOutput.cpp`, `AdvancedOutput.cpp`, and `OBSBasicSettings_Stream.cpp::UpdateVodTrackSetting` (from the PR, merged onto the brace-style code).
- Test plan: MSVC build of `rtmp-services` and the frontend; manual check that selecting Twitch still shows the VOD track checkbox, and that adding `"supports_vod_track": true` to another service in a local services.json shows it. The schema can be validated with the existing `build-aux`/CI JSON schema check if present.

### [#13021](https://github.com/obsproject/obs-studio/pull/13021) — obs-webrtc: Add trickle ICE support for WHIP

**Verdict: DEFER_LARGE**

The description sounds like a focused feature (OPTIONS pre-fetch of ICE servers plus trickle PATCH), but the PR branch has grown to about 26.7k added lines across 37 files. It includes B-frame/encoder-policy enforcement, an obs-x264 change, RTP clock changes, a new `test/whip` suite with Python/Node helpers, and a 700-line README. That is far beyond a small slice and mixes unrelated behaviour changes. If the trickle ICE + OPTIONS part were extracted on its own it could be reconsidered together with #12876.

- Evidence: `git log --oneline master..refs/upstream-pr/13021` (10+ commits incl. "whip: enforce encoder requirements", "whip: stabilize RTP clocks"), `git diff master...refs/upstream-pr/13021 --stat` (37 files, +26656/-67).
- Related: #12790, #12863, #12876, #12848.

### [#13082](https://github.com/obsproject/obs-studio/pull/13082) — Add groupconnect sockopt to SRT connection

**Verdict: IMPLEMENT (cherry-pick-pr)**

A 15-line, opt-in change to OBS's in-tree SRT URL protocol. It parses a `groupconnect=` URL query parameter and sets `SRTO_GROUPCONNECT` on the socket, guarded by `SRT_VERSION_VALUE >= 0x010500`. The default is -1 (not set), so existing URLs behave identically. It follows the existing pattern for other SRT options in the same file. The local deps ship SRT 1.5 and declare `SRTO_GROUPCONNECT`. If the bundled SRT library was built without bonding, setting the option fails only for users who explicitly pass `groupconnect=1`. Applies cleanly (0 conflict markers).

- Evidence: `plugins/obs-ffmpeg/obs-ffmpeg-srt.h` (`SRTContext`, `libsrt_set_options_pre`, `libsrt_set_defaults`, `libsrt_open` option parsing), `.deps/obs-deps-2026-10-23-x64/include/srt/version.h:24-25` (1.5), `.deps/obs-deps-2026-10-23-x64/include/srt/srt.h:237` (`SRTO_GROUPCONNECT`, bonding). PR commits 90881d8bb, 5634a726f.
- Related: none.

**Slice plan:** `git cherry-pick 90881d8bb 5634a726f` (or squash, keeping authorship). Files: `plugins/obs-ffmpeg/obs-ffmpeg-srt.h` (+15).
- Test plan: MSVC build of `obs-ffmpeg`; a smoke test streaming to an `srt://...?mode=listener` URL without `groupconnect` to confirm no regression. Bonded-group behaviour is UNTESTED: it needs a bonding-enabled SRT build and a group-capable caller.

### [#13144](https://github.com/obsproject/obs-studio/issues/13144) — Segfault (null pointer) when RTMP output receives error with missing description

**Verdict: IMPLEMENT**

Confirmed. On a `_error` reply to `connect`, librtmp reads `description` using `AMFProp_GetString`. When the property is absent, `AMF_GetProp` returns `AMFProp_Invalid`, and `AMFProp_GetString` then sets `*str = AV_empty` = `{NULL, 0}`. `PublisherAuth()` immediately calls `strstr(description->av_val, ...)` and dereferences NULL. The debug log line before it also passes a NULL `%s`. A malicious or misbehaving server can crash OBS.

- Evidence: `plugins/obs-outputs/librtmp/rtmp.c:3283-3293` (description extracted then passed to `PublisherAuth`), `plugins/obs-outputs/librtmp/rtmp.c:2672-2690` (`strstr(description->av_val, ...)` with no check), `plugins/obs-outputs/librtmp/amf.c:33` (`AV_empty = {0,0}`), `plugins/obs-outputs/librtmp/amf.c:338-344` (`AMFProp_GetString` falls back to `AV_empty`).
- Related: none.

**Slice plan (new-change, cross-platform, ~5 lines):** at the top of `PublisherAuth()` add `if (!description || !description->av_val || !description->av_len) return 0;`, meaning no auth retry, so the caller falls through to the normal connect-failure path. Optionally guard the `RTMP_Log(... description.av_val)` debug line at 3291 with `description.av_len ? description.av_val : ""`.
- Test plan: MSVC build of `obs-outputs`. Runtime repro needs an RTMP server that sends the reporter's crafted `_error` packet (hex in the issue); a tiny Python socket server could replay it after the handshake. If not done, mark UNTESTED.
