# Upstream triage — batch outputs-services-10

- Batch id: outputs-services-10 (area hint: outputs-services)
- Items: 13417, 13431, 13433, 13443, 13469, 13482, 13504, 13553, 13556, 13558, 13567, 13618, 13642, 13645, 13653, 13655, 13705, 13746, 13786, 13807
- Date: 2026-10-26
- Base commit: `72e866557` (`git rev-parse --short master`)
- Method: item bodies from `notes/upstream-triage/data/all.json` (no comment threads); PR heads inspected locally via `refs/upstream-pr/N`. Local git is 2.33, which lacks `merge-tree --write-tree`, so conflicts were checked with legacy `git merge-tree $(git merge-base master PR) master PR` and a count of `+<<<<<<<` markers.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 13417 | PR | DEFER_LARGE (15 conflict hunks against master) |
| 13431 | issue | CANNOT_VERIFY (AJA hardware) |
| 13433 | PR | DEFER_LARGE (1356-line UX feature) |
| 13443 | issue | IMPLEMENT (through the first 2 commits of PR 13482) |
| 13469 | issue | CANNOT_VERIFY (SRT artifacts, needs/more-info) |
| 13482 | PR | IMPLEMENT partial-pr (first 2 commits only) |
| 13504 | PR | DEFER_LARGE (draft, 568 lines, not wired up) |
| 13553 | issue | CANNOT_VERIFY (browser freeze while being captured) |
| 13556 | issue | IMPLEMENT new-change (clamp dialog to screen) |
| 13558 | PR | DEFER_LARGE (disk replay buffer, conflicts) |
| 13567 | issue | DEFER_LARGE (chapters in replay buffer) |
| 13618 | PR | IMPLEMENT cherry-pick |
| 13642 | issue | OUT_OF_SCOPE (crash inside Intel iHD VAAPI driver) |
| 13645 | PR | IMPLEMENT cherry-pick |
| 13653 | PR | OUT_OF_SCOPE (service-list addition) |
| 13655 | PR | OUT_OF_SCOPE (service-list addition) |
| 13705 | issue | CANNOT_VERIFY (DeckLink HDR hardware) |
| 13746 | issue | IMPLEMENT new-change (QThread self-deleteLater race) |
| 13786 | issue | CANNOT_VERIFY (asymmetry not found in code; colon is legal on Linux) |
| 13807 | issue | CANNOT_VERIFY (CEF crash, no actionable stack) |

---

### [#13417](https://github.com/obsproject/obs-studio/pull/13417) — frontend: Cleanup output active variables
**Verdict: DEFER_LARGE**

This is a cleanup PR. It removes the `streamingActive`/`recordingActive`/... bools in `BasicOutputHandler` and uses `obs_output_active()` in their place. Master still has those members, but the PR is based on 2026-05-07, and master has since reformatted these files (brace-style pass, the copy/paste and safe-mode API changes). Legacy merge-tree shows about 15 conflict hunks across `OBSStudioAPI.cpp`, `BasicOutputHandler.cpp`, `SimpleOutput.cpp` and `OBSBasic_Recording.cpp`. The PR fixes nothing users can see, and redoing it by hand touches threading-sensitive state (`Active()` is checked from several paths). Not worth a manual rebase as a small slice.
- `frontend/utility/BasicOutputHandler.hpp:25-33` still has the active bools; `:96-99` `Active()` uses them.
- `git log master..refs/upstream-pr/13417`: one commit b639ccdd4, 11 files, +36/-74; merge-tree shows 15 conflict markers.

### [#13431](https://github.com/obsproject/obs-studio/issues/13431) — AJA output: no audio when started programmatically
**Verdict: CANNOT_VERIFY**

Auto-start and the dialog button both call the same `output_start()`, so the start paths do not differ in OBS code. The one difference at auto-start is that `on_multi_view_toggle()` runs right after `output_start()`. It ends up in `toggle_multi_view(..., false)`, which only touches video routing in its disable branch. For the websocket case, StartOutput restarts the plugin-owned `aja_output` object directly and bypasses `main_output_running`. Neither path has an audio-init difference I can tie to the report. The reporter suspects NTV2 audio-system initialisation, and that needs KONA 4 hardware to confirm.
- `plugins/aja-output-ui/aja-ui-main.cpp:66-84` `output_start()` is shared by both paths.
- `plugins/aja-output-ui/AJAOutputUI.cpp:121-125` the button saves settings, then calls `output_toggle()`.
- `plugins/aja-output-ui/aja-ui-main.cpp:394-410` the FINISHED_LOADING auto-start, then `on_multi_view_toggle`.
- `plugins/aja-output-ui/aja-ui-main.cpp:240-275` `toggle_multi_view`: audio routing only when enabled.

### [#13433](https://github.com/obsproject/obs-studio/pull/13433) — frontend: Implement HealthCheck service
**Verdict: DEFER_LARGE**

This is a new UI subsystem: a service, items, actions, a dialog, status-bar widgets, an Idian widget refactor and a missing-files migration. It is 33 files and +1356/-24. The author is still asking for UX feedback. It applies cleanly (0 conflict markers), but it is a UX redesign that maintainers have not finished deciding on, so it is not a small slice.
- `git diff master...refs/upstream-pr/13433 --stat`: 33 files, 1356 insertions.

### [#13443](https://github.com/obsproject/obs-studio/issues/13443) — Fix casts of Auth class in specialized constructors
**Verdict: IMPLEMENT** (through PR #13482, first two commits)

The defect is in the code as described. `OBSYoutubeActions` takes a generic `Auth*` and `dynamic_cast`s it internally. Sibling call sites use `reinterpret_cast<OAuthStreamKey *>` and `reinterpret_cast<YoutubeApiWrappers *>`, which is unsafe if the auth is a different subclass. The first two commits of #13482 fix exactly these sites.
- `frontend/dialogs/OBSYoutubeActions.cpp:20-23` the constructor takes `Auth *` and does `dynamic_cast` internally.
- `frontend/settings/OBSBasicSettings_Stream.cpp:811` `reinterpret_cast<OAuthStreamKey *>`.
- `frontend/wizards/AutoConfigStreamPage.cpp:268,295,409` `reinterpret_cast` to `OAuthStreamKey`/`YoutubeApiWrappers`.
- `frontend/widgets/OBSBasic_YouTube.cpp:59` the cast happens inside the worker thread.
- Not covered and left as is: `frontend/docks/YouTubeAppDock.cpp:392` and `frontend/utility/YoutubeApiWrappers.cpp:44` (these are lookups, not constructor parameters).

Slice: see #13482.

### [#13469](https://github.com/obsproject/obs-studio/issues/13469) — SRT streaming produces artifacts
**Verdict: CANNOT_VERIFY**

The item is labelled needs/more-info. The linked log is a crash URL, not a session log. Network and packet-loss artifacts over SRT depend on latency and buffer settings and on the receiver. The reporter's workaround (OBS -> RTMP -> ffmpeg -> SRT) points to timing or packetisation rather than the encoder, but nothing in the report or the code identifies a defect, and reproducing it needs their network and server.
- `plugins/obs-ffmpeg/obs-ffmpeg-mpegts.c` (the SRT/mpegts output). No concrete defect identified.

### [#13482](https://github.com/obsproject/obs-studio/pull/13482) — frontend: replace Auth with YoutubeApiWrappers for YouTube callers
**Verdict: IMPLEMENT (partial-pr)**

The PR has 3 commits. Commits 1e76a0467 and e129cb402 (~30 lines, 7 files) are the actual fix for #13443:
- the constructor takes `YoutubeApiWrappers &`;
- callers do a checked `dynamic_cast`;
- `reinterpret_cast` becomes `dynamic_cast` in Settings and the AutoConfig wizard;
- `YoutubeStreamCheck` receives the pointer from the main thread.

The third commit b4127de1d is an unrelated 500+ line refactor that splits out `YoutubeApiClient`. Skip it. The PR merges with 0 conflict markers.
- `git show --stat 1e76a0467`: 7 files, +28/-30.
- One behaviour change to note: `SetupBroadcast` now uses `dynamic_cast` success in place of `IsYouTubeService(auth->service())`. That is equivalent for real YouTube auth (`frontend/widgets/OBSBasic_YouTube.cpp` SetupBroadcast).

**Slice plan**
- approach: partial-pr. Cherry-pick 1e76a0467 and e129cb402 with authorship preserved (Kunal Dubey). Do not take b4127de1d.
- files: `frontend/dialogs/OBSYoutubeActions.{cpp,hpp}`, `frontend/settings/OBSBasicSettings_Stream.cpp`, `frontend/widgets/OBSBasic.hpp`, `frontend/widgets/OBSBasic_Streaming.cpp`, `frontend/widgets/OBSBasic_YouTube.cpp`, `frontend/wizards/AutoConfigStreamPage.cpp`.
- Coordinate with the #13746 slice: both touch `OBSBasic_Streaming.cpp:256-263` and `OBSBasic_YouTube.cpp:57-98`. Apply #13482 first, then #13746.
- test: MSVC build of the `obs-studio` frontend target with YOUTUBE_ENABLED (needs the YouTube API key defines; if they are not set, the YouTube code is not compiled and the change is UNTESTED). Runtime behaviour is UNTESTED because there is no YouTube account on this box.

### [#13504](https://github.com/obsproject/obs-studio/pull/13504) — frontend: new clipboard service and serializer introduction
**Verdict: DEFER_LARGE**

This is a draft. It adds 568 lines of new `OBSClipboardService`/`Serializer` files and does not yet wire them into the copy/paste actions. It is the first step of an architecture change (store serialized data in place of source pointers) for #13421. Taking it alone delivers nothing, and the full change is large.
- `git diff master...refs/upstream-pr/13504 --stat`: 6 files, +568, all new files plus cmake.

### [#13553](https://github.com/obsproject/obs-studio/issues/13553) — Chrome/Brave video freezes while captured by Window/Display Capture
**Verdict: CANNOT_VERIFY**

The freeze happens inside the browser's renderer while OBS only reads its window or display. The reporter says themselves that it may be a browser bug. It happens with no recording, and WGC/DXGI duplication is OS API. I cannot point at an OBS defect. It needs a repro and probably GPU/driver-specific investigation.
- `plugins/win-capture/window-capture.c`, `plugins/win-capture/duplicator-monitor-capture.c`: read-only capture through OS APIs. No suspect code.

### [#13556](https://github.com/obsproject/obs-studio/issues/13556) — YouTube Manage Broadcast dialog exceeds screen height
**Verdict: IMPLEMENT (new-change)**

The form hard-codes an initial geometry of 821x738, and the constructor never clamps it to the screen's available area. The only resize, on macOS, makes it larger. On a display whose logical height is about 720 (for example 1080p at 150% scaling) or with a taskbar, the bottom button row falls off-screen. The form already wraps both tabs' content in `QScrollArea`s with a 0 minimum height, so the dialog can shrink safely.
- `frontend/forms/OBSYoutubeActions.ui:5-11` geometry with height 738.
- `frontend/forms/OBSYoutubeActions.ui:29-30` the root layout uses `SetMinimumSize`.
- `frontend/forms/OBSYoutubeActions.ui:64-86,512-525` QScrollArea wrappers.
- `frontend/dialogs/OBSYoutubeActions.cpp:243-246` the only resize, macOS-only, makes the dialog larger.

**Slice plan**
- At the end of the `OBSYoutubeActions` constructor (after the `__APPLE__` resize), take `QScreen *scr = parentWidget() ? parentWidget()->screen() : screen()`. Read `scr->availableGeometry()` and resize to at most about 90% of the available width and height. When showing, centre the dialog on the parent, or `move` it so it stays inside `availableGeometry`. About 10-15 lines in `frontend/dialogs/OBSYoutubeActions.cpp` (add the `<QScreen>` include).
- test: MSVC build of the frontend. Runtime is UNTESTED: the dialog needs a connected YouTube account. A manual check of a forced small-screen case is possible only with YouTube credentials.

### [#13558](https://github.com/obsproject/obs-studio/pull/13558) — Add optional disk-based storage for Replay Buffer
**Verdict: DEFER_LARGE**

This is a new feature that rewrites replay-buffer packet storage in `obs-ffmpeg-mux.c` as an on-disk ring (+178 lines in core muxer logic). It also adds a settings dropdown and raises the limit to 8 TB. It conflicts with master (1 conflict marker). This is a design-level change to a core output that needs maintainer review on I/O, crash-safety and temp-file handling, so it is not a small slice.
- `git diff master...refs/upstream-pr/13558 --stat`: 5 files, +189/-44.
- `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:1125` `replay_buffer_save` uses the in-memory `stream->packets` deque.

### [#13567](https://github.com/obsproject/obs-studio/issues/13567) — Chapter markers are not saved in Replay Buffer file
**Verdict: DEFER_LARGE**

The report is accurate, but the missing piece is a whole feature. Chapter markers exist only in the native Hybrid MP4 muxer (`mp4-output.c`/`mp4-mux.c`) through the `add_chapter` proc. The frontend sends chapters only to the recording output. The replay buffer is the ffmpeg-mux based `replay_buffer` output, whatever the recording format. It has no chapter concept, and its saves go through the external ffmpeg-mux process. Support would need chapter timestamps tracked relative to the buffer window, an `add_chapter` proc on the replay output, and extensions to the ffmpeg-mux IPC/metadata. Hybrid MP4 behaviour is correct as designed.
- `frontend/OBSStudioAPI.cpp:281-292` `add_chapter` is called on the recording output only.
- `plugins/obs-outputs/mp4-output.c:165` and `plugins/obs-outputs/mp4-mux.c:2946` chapters exist only in the native mp4 muxer.
- `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:917-948` the replay buffer procs are only `save`/`get_last_replay`. There is no chapter support.

### [#13618](https://github.com/obsproject/obs-studio/pull/13618) — obs-outputs: Surface RTMP publish error to user
**Verdict: IMPLEMENT (cherry-pick-pr)**

The PR is small (+15/-2, 4 files) and coherent, and it merges with 0 conflicts. The defects are confirmed in master:
1. `NetStream.Publish.Failed` is not in librtmp's list of failure codes.
2. The onStatus `description` is only logged.
3. `try_connect` returns `OBS_OUTPUT_INVALID_STREAM` without calling `set_output_error`, and the frontend's INVALID_STREAM case does not set `use_last_error`.

There is no stale-state risk: `RTMP_Init` memsets the struct on every connect, so `last_error_description` resets.
- `plugins/obs-outputs/librtmp/rtmp.c:3100-3103` known publish codes (no Failed).
- `plugins/obs-outputs/librtmp/rtmp.c:3352-3365` the failure branch only logs.
- `plugins/obs-outputs/librtmp/rtmp.c:457-463` `RTMP_Init` memset.
- `plugins/obs-outputs/rtmp-stream.c:503-588` `set_output_error`. `:1222` `RTMP_ConnectStream` failure returns without setting an error.
- `frontend/widgets/OBSBasic_Streaming.cpp:317-319` the INVALID_STREAM case without `use_last_error`.

**Slice plan**
- Cherry-pick 58fc54c03 and d0df18030 (author: Nathan Duchesne), unchanged.
- Side effect: other outputs that return INVALID_STREAM with a last_error set will now show it as well. That is the desired behaviour.
- test: MSVC build of `obs-outputs` and the frontend. A runtime check needs an RTMP server that rejects with an onStatus description. A local nginx-rtmp/MediaMTX with `on_publish` deny could be used, but that is probably not available here, so the change is likely UNTESTED at runtime.

### [#13642](https://github.com/obsproject/obs-studio/issues/13642) — Crash when recording completes (KDE Linux, flatpak)
**Verdict: OUT_OF_SCOPE**

The aborting thread's stack is entirely inside `iHD_drv_video.so` (Intel media VAAPI driver), which calls libc abort. That is a driver assertion during encoder teardown, not an OBS frame. There is no OBS symbolised frame to act on. The fix belongs in the Intel media driver or the flatpak runtime's driver extension. The user can work around it with x264 or a different driver.
- The stack frames in the issue body are #0-#6 libc / iHD_drv_video.so (thread "audio-io: audio").

### [#13645](https://github.com/obsproject/obs-studio/pull/13645) — Fix inserted SEI NAL order in AVC outputs
**Verdict: IMPLEMENT (cherry-pick-pr)**

There is a clear, spec-backed defect, and master's own TODOs mark it. For AVC, caption SEIs and BPM SEIs are appended after the VCL NALs, but H.264 7.4.1.2.3 requires SEIs to come before the primary coded picture. The PR adds `obs_avc_find_first_vcl_nal()` and inserts the SEI before the first VCL NAL, falling back to appending. It is +57/-8, merges with 0 conflicts, and was authored by an OBS core developer.
- `libobs/obs-output.c:1629-1633` `/* TODO: SEI should come after AUD/SPS/PPS, but before any VCL */` then `da_push_back_array`.
- `shared/bpm/bpm.c:417-421` the same TODO.
- `libobs/obs-avc.h:30-34` the `OBS_NAL_SLICE*` constants the helper uses exist.

**Slice plan**
- Cherry-pick b67e7df54, b1d821fda and bdfb4b116 (author: dsaedtler), unchanged. This adds one exported libobs symbol, `obs_avc_find_first_vcl_nal`.
- test: MSVC build of `libobs` and the plugins that link `shared/bpm`. Runtime check: record Hybrid MP4 with `bpm=1` in the muxer settings, or enable captions, then inspect NAL order with `ffprobe -show_frames`/a bitstream dump. That is feasible on this box if a build runs. Otherwise the change is UNTESTED.

### [#13653](https://github.com/obsproject/obs-studio/pull/13653) — rtmp-services: Add Upstream.so
**Verdict: OUT_OF_SCOPE**

This is a service-list addition. Whether a service is included is decided by the OBS Project's service policy (adoption and documentation) at maintainer discretion. The list is also remotely updated from `obsproject.com/obs2_update/rtmp-services/v5`, versioned by `package.json`. A local fork bumping `version` would diverge from or shadow upstream updates. The PR also conflicts with master's services.json/package.json (2 markers). There is no code defect, and the fork should not make partner decisions.
- `plugins/rtmp-services/data/package.json:3-4` remote update URL and version 295.
- `plugins/rtmp-services/rtmp-services-main.c:22,110` the remote update mechanism.

### [#13655](https://github.com/obsproject/obs-studio/pull/13655) — rtmp-services: Add Streamplace
**Verdict: OUT_OF_SCOPE**

The same reasoning as #13653 applies. It is a service-list addition that needs upstream policy acceptance, and an earlier application (#12642) was not merged. It conflicts with master (2 markers). The motivation (forcing `bframes=0`) is a service-recommendation detail and not a defect in OBS. Users can set B-frames to 0 manually, or use the Custom service.
- `plugins/rtmp-services/data/package.json:3-4`; `plugins/rtmp-services/data/services.json`.

### [#13705](https://github.com/obsproject/obs-studio/issues/13705) — DeckLink Mini Recorder 4K HDR looks "deep fried"
**Verdict: CANNOT_VERIFY**

The report is HDR input from a Switch 2 through DeckLink with mode Auto. The washed-out or oversaturated output could come from the device reporting the wrong EOTF or colour space, from the Switch's HDR signalling, or from the source's colour-space handling. It reproduces on Linux too, so it is not a Windows driver issue, but checking it needs DeckLink hardware plus an HDR source. The report has no source property values (colour space, range) to tie it to a code path.
- `plugins/decklink/` HDR handling depends on the device format callbacks. It cannot be exercised without the hardware.

### [#13746](https://github.com/obsproject/obs-studio/issues/13746) — Crash after starting an existing scheduled YouTube broadcast (YouTubeStreamCheckThread)
**Verdict: IMPLEMENT (new-change)**

The root cause can be found in the code. `YoutubeStreamCheck()` runs on the `youtubeStreamCheckThread` QThread and calls `youtubeStreamCheckThread->deleteLater()` from inside the thread function before returning. The QThread object lives on the main thread, so the main event loop can process the DeferredDelete while `run()` is still unwinding. Qt then destroys a running QThread, which triggers qFatal "QThread: Destroyed while thread 'YouTubeStreamCheckThread' is still running" and an abort. On Windows that shows up as Qt6Core.dll exception c0000409 (fast-fail). This matches the reported final log line exactly. It is intermittent, and it fires 2-4 s after start, when the stream status becomes "active" and the loop breaks. The function also reads the `QPointer` member from the worker thread, which is itself racy.
- `frontend/widgets/OBSBasic_YouTube.cpp:63` and `:97` `youtubeStreamCheckThread->deleteLater()` are called from the worker thread.
- `frontend/widgets/OBSBasic_Streaming.cpp:259-263` the thread is created and started; nothing is connected to `finished`.
- `shared/qt/wrappers/qt-wrappers.cpp:206-219` `QuickThread::run()` just calls func, so run() is still on the stack after deleteLater is posted.
- `frontend/widgets/OBSBasic.cpp:1791` the close guard relies on the QPointer being nulled. That still works with the fix.

**Slice plan**
- In `OBSBasic::StreamingStart` (`OBSBasic_Streaming.cpp:260`), after `CreateQThread`, add `connect(youtubeStreamCheckThread, &QThread::finished, youtubeStreamCheckThread, &QObject::deleteLater);`.
- In `OBSBasic::YoutubeStreamCheck` (`OBSBasic_YouTube.cpp`), remove both `youtubeStreamCheckThread->deleteLater();` calls.
- About 4 lines. If #13482 is taken, apply this on top of it (same functions).
- test: MSVC build of the frontend. Runtime is UNTESTED: it needs a YouTube account and the race is timing-dependent. The reasoning rests on Qt semantics (deleting a running QThread is fatal; `finished` is emitted after `run()` returns).

### [#13786](https://github.com/obsproject/obs-studio/issues/13786) — Recording filenames not sanitised, replay buffers are
**Verdict: CANNOT_VERIFY**

Recordings and replay buffer saves both build names with the same `os_generate_formatted_filename()`, through `GetOutputFilename` and the ffmpeg-mux `generate_filename` respectively. Neither sanitises characters. The only filtering is in the settings line-edit, which strips `:` on macOS and `<>:"|?*` on Windows, and deliberately does nothing on Linux (`// TODO`). The reporter is on Btrfs, where `:` is legal. So the claimed asymmetry is not visible in the code. Stripping colons on Linux would be a policy change, not a bug fix. It needs a repro showing where the replay name lost its colon (possibly a different prefix/suffix setting).
- `libobs/util/platform.c:698-790` `os_generate_formatted_filename` does no character sanitising.
- `frontend/OBSApp.cpp:1571-1575,1692-1723` the recording path uses it.
- `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:574-600` the replay/ffmpeg-mux path uses it too.
- `frontend/settings/OBSBasicSettings.cpp:4228-4243` per-OS filtering only in the settings UI; Linux is a TODO.

### [#13807](https://github.com/obsproject/obs-studio/issues/13807) — Crash when closing/removing YouTube Live Control Panel dock
**Verdict: CANNOT_VERIFY**

The crash is in `obs-browser.dll` on the CEF `CrBrowserMain` thread when the dock is removed. A separate startup crash went through `YoutubeAuth::LoadUI` with `youtubeLiveControlPanel` in the saved DockState. Third-party dock plugins (Aitum Vertical) are installed. The crash report is not available locally (no comment thread or stack symbols), and nothing in `YoutubeAuth::LoadUI` or `YouTubeAppDock` is clearly wrong from reading it. It needs the symbolised stack and a repro without third-party plugins.
- `frontend/oauth/YoutubeAuth.cpp:109-149` `LoadUI` creates the chat dock and `NewYouTubeAppDock`.
- `frontend/docks/YouTubeAppDock.cpp:111` sets the object name `youtubeLiveControlPanel` (used in DockState).
