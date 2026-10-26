# Triage batch: outputs-services-02

- Batch id: outputs-services-02 (area hint: outputs-services; the hint was wrong for several items, see below)
- Items: 7386, 7512, 7548, 7676, 7716, 7754, 7775, 7879, 7895, 7922, 8057, 8100, 8333, 8614, 8818, 8869, 8872, 8918, 8929, 8949
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`, code read on master. PR head checked via `refs/upstream-pr/N`. The local git is 2.33 and has no `merge-tree --write-tree`, so the conflict check used the legacy `git merge-tree <base> master <pr>` and counted the conflict markers.
- WebFetch used 2 of 3: the issue #8949 thread, and the #8100 log URL, which returned 404.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 7386 | issue | CANNOT_VERIFY |
| 7512 | issue | CANNOT_VERIFY |
| 7548 | issue | CANNOT_VERIFY |
| 7676 | issue | CANNOT_VERIFY |
| 7716 | issue | CANNOT_VERIFY |
| 7754 | issue | IMPLEMENT |
| 7775 | issue | CANNOT_VERIFY |
| 7879 | issue | CANNOT_VERIFY |
| 7895 | issue | IMPLEMENT |
| 7922 | issue | OUT_OF_SCOPE |
| 8057 | issue | CANNOT_VERIFY |
| 8100 | issue | CANNOT_VERIFY |
| 8333 | issue | CANNOT_VERIFY |
| 8614 | issue | CANNOT_VERIFY |
| 8818 | issue | DEFER_LARGE |
| 8869 | issue | CANNOT_VERIFY |
| 8872 | issue | DEFER_LARGE |
| 8918 | PR | DEFER_LARGE |
| 8929 | issue | CANNOT_VERIFY |
| 8949 | issue | CANNOT_VERIFY |

---

### [#7386](https://github.com/obsproject/obs-studio/issues/7386) — Large memory leak with RTMP source and dest YouTube
- **Verdict:** CANNOT_VERIFY
- **Reasoning:** The report is from Linux, on a 2022 master build plus an unmerged PR. The input is an RTMP stream played through the media source (ffmpeg) and the outputs are YouTube and split recording. The only evidence is an external heaptrack file. The report does not name an allocation site, and the media source, outputs and muxer have all been reworked heavily since then. Nothing here can be tied to a specific defect in the current code.
- **Evidence:** the body names no function or allocation site. The current replay and recording mux path is in `plugins/obs-ffmpeg/obs-ffmpeg-mux.c`.
- **Related:** none

### [#7512](https://github.com/obsproject/obs-studio/issues/7512) — Video Capture Device FPS list cannot match a 70 Hz output / custom integer FPS
- **Verdict:** CANNOT_VERIFY
- **Reasoning:** The DShow FPS list is a fixed table, and it has no 70 entry (`win-dshow.cpp:1303-1325`). `UpdateFPS` only lists entries from that table that the device advertises (`win-dshow.cpp:1652-1689`). "Match Output FPS" calls `GetOBSFPS()` and then `ClosestFrameRateSelector` against the device caps, so it ends up showing "autoselect: 60" (`win-dshow.cpp:1799-1826`). That means the device's DirectShow caps did not advertise exactly 70 Hz for that resolution and format. If they had, `frameRateSupported` would be true and no autoselect value would be set. The root cause is therefore the capture device's advertised modes, which cannot be checked without the hardware. Adding 70/72/75 rows to the table would not help a device that does not advertise them.
- **Evidence:** `plugins/win-dshow/win-dshow.cpp:1303-1325` (fixed FPS table), `:1652-1689` (`UpdateFPS`), `:1799-1832` (match and autoselect logic).
- **Related:** none

### [#7548](https://github.com/obsproject/obs-studio/issues/7548) — OBS 28 breaks keyer in Decklink Output (macOS)
- **Verdict:** CANNOT_VERIFY
- **Reasoning:** The keyer setup looks correct: it enables internal or external keying at level 255 (`decklink-device-instance.cpp:572-581`). The output asks for a BGRA conversion (`decklink-output.cpp:35-42`), and 8-bit output uses `bmdFormat8BitBGRA`. The regression is reported on macOS with Blackmagic hardware, and the cause could be how the OBS 28 render pipeline (HDR/colour) handles alpha before conversion. That needs the hardware to reproduce, and no defect is visible in the plugin code.
- **Evidence:** `plugins/decklink/decklink-device-instance.cpp:572-581`, `:595-599`; `plugins/decklink/decklink-output.cpp:35-42`.
- **Related:** none

### [#7676](https://github.com/obsproject/obs-studio/issues/7676) — Game process does not exit while OBS runs (OpenTK game)
- **Verdict:** CANNOT_VERIFY
- **Reasoning:** This is a single-title interaction between the game-capture hook (graphics-hook injection) and one C#/OpenTK OpenGL game. There is no hook log or stack, and the cause is likely in hook/driver timing inside the target process. No code-level defect can be identified from the report.
- **Evidence:** the hook lives in `plugins/win-capture/graphics-hook/` (gl-capture). The report gives no stack.
- **Related:** #7716, #8929 (other "OBS affects the game" reports)

### [#7716](https://github.com/obsproject/obs-studio/issues/7716) — Fullscreen projector makes the game feel like 60 Hz (since 28)
- **Verdict:** CANNOT_VERIFY
- **Reasoning:** This is about GPU, DWM and multi-monitor presentation on the user's own system. It depends on monitor refresh rates and DWM composition. Nothing in the projector code can be shown to cause it without a repro on the same hardware.
- **Evidence:** projector code in `frontend/widgets/OBSProjector.cpp`. The report gives nothing actionable.
- **Related:** #8929

### [#7754](https://github.com/obsproject/obs-studio/issues/7754) — Resize Output (source size) can set resolutions that later prevent OBS from starting
- **Verdict:** IMPLEMENT
- **Reasoning:** `ResizeOutputSizeOfSource` writes the source size straight into BaseCX/BaseCY/OutputCX/OutputCY. It rounds the size but never checks an upper bound (`OBSBasic_OutputHandler.cpp:78-90`). The context menu only disables the action for sizes under 32 (`OBSBasic_SceneItems.cpp:712-714`). `ResetVideo` only repairs sizes under 32 (`OBSBasic.cpp:1469-1481`). libobs rejects any dimension above `OBS_SIZE_MAX` (32768) with `OBS_VIDEO_INVALID_PARAM` (`libobs/obs.c:1518-1536`), and at startup that return code throws "Failed to initialize video: Invalid parameters" (`OBSBasic.cpp:894-895`). That is exactly the log in the report. A large text source can exceed 32768 px, so the bad value is saved and OBS will not start again. The lower-bound half was fixed upstream in ece8df2ac (32x32 minimum); the upper bound is still missing.
- **Evidence:**
  - `frontend/widgets/OBSBasic_OutputHandler.cpp:59-95`: no upper-bound check before `config_set_uint`.
  - `frontend/widgets/OBSBasic_SceneItems.cpp:704-714`: only `< 32` disables the action.
  - `frontend/widgets/OBSBasic.cpp:1469-1481`: `ResetVideo` only sanitizes `< 32`.
  - `frontend/widgets/OBSBasic.cpp:887-895`: an invalid parameter is fatal at startup.
  - `libobs/obs.c:1518-1536`: `OBS_SIZE_MAX (32 * 1024)` check.
- **Related:** none
- **Slice plan:**
  1. In `OBSBasic_SceneItems.cpp`, also disable the action when `width > 32768 || height > 32768`. Mirror the libobs limit with a local constant.
  2. In `ResizeOutputSizeOfSource`, return early when the rounded size is above the limit. This is defensive, for when the source size changed after the menu opened.
  3. In `ResetVideo`, extend the existing sanitizing: if base is `> 32768` in either dimension, fall back to 1920x1080 as the `< 32` branch does; if output is `> 32768`, fall back to base. This lets already-broken profiles start again.
  - Files: `frontend/widgets/OBSBasic_SceneItems.cpp`, `frontend/widgets/OBSBasic_OutputHandler.cpp`, `frontend/widgets/OBSBasic.cpp`. About 15 lines. Cross-platform.
  - Test: MSVC build of the `obs-studio` frontend target. Manual check: create a text source wider than 32768 px and confirm the action is disabled. Edit a profile `basic.ini` to BaseCX=40000 and confirm OBS starts with 1920x1080.

### [#7775](https://github.com/obsproject/obs-studio/issues/7775) — VLC Video Source squeezes 16:9 Twitch HLS streams
- **Verdict:** CANNOT_VERIFY
- **Reasoning:** `calculate_display_size` walks every video track, applies SAR, and keeps the dimensions of the last video track it sees (`vlc-video-source.c:372-422`). It does not use the track that is actually playing. With HLS or adaptive inputs, that can pick dimensions that differ from the decoded buffer. SAR from the stream could also produce a slightly narrower display width, which would match the slim side bars reported. Both are plausible, but the example m3u8 URL has expired and there is no log of the track metadata, so neither path can be confirmed as the cause.
- **Evidence:** `plugins/vlc-video/vlc-video-source.c:372-422` (track loop and SAR adjust), `:425-446` (frame realloc by computed size).
- **Related:** none

### [#7879](https://github.com/obsproject/obs-studio/issues/7879) — Studio Mode: media source audio intermittently desyncs from mixer and output
- **Verdict:** CANNOT_VERIFY
- **Reasoning:** The reporter says the bug is random and has never reproduced off-stream. It involves nested scenes, browser sources and a Stream Deck. No deterministic steps, no defect location.
- **Evidence:** the body has no reproducible trigger.
- **Related:** none

### [#7895](https://github.com/obsproject/obs-studio/issues/7895) — Recording red-dot taskbar overlay disappears after minimizing to tray
- **Verdict:** IMPLEMENT
- **Reasoning:** The overlay is set only on output state changes (`OBSBasic.hpp:706, 728, 747, 756`; `OBSBasic_Recording.cpp:305, 340`) through `TaskbarOverlaySetStatus`, which calls `ITaskbarList4::SetOverlayIcon` on the main HWND (`platform-windows.cpp:391-433`). Minimizing to tray hides the main window (`OBSBasic_MainControls.cpp:575`), and Windows destroys the taskbar button. When the window is shown again (`:589`), Windows creates a new button with no overlay, and OBS never reapplies it. `nativeEvent` (`OBSBasic.cpp:1617-1636`) does not handle the registered `TaskbarButtonCreated` message, which is the documented point to re-set overlays. Separately, `TaskbarOverlaySetStatus` calls `Release()` on an uninitialized pointer when `CoCreateInstance` fails (`platform-windows.cpp:396-399`).
- **Evidence:**
  - `frontend/utility/platform-windows.cpp:385-433`: overlay set once, no reapply. The failure path Releases an invalid pointer.
  - `frontend/widgets/OBSBasic_MainControls.cpp:557-605`: hide and show for tray.
  - `frontend/widgets/OBSBasic.cpp:1617-1636`: `nativeEvent` has no `TaskbarButtonCreated` handling.
  - `frontend/widgets/OBSBasic.hpp:695-760`: overlay state logic (active, paused, inactive).
- **Related:** none
- **Slice plan:**
  1. In `OBSBasic::nativeEvent` (`_WIN32`), cache `static const UINT taskbarCreatedMsg = RegisterWindowMessageW(L"TaskbarButtonCreated");`. When `msg.message == taskbarCreatedMsg`, reapply the overlay: `outputHandler && outputHandler->Active()` gives Active, or Paused when `os_atomic_load_bool(&recording_paused)`; otherwise Inactive.
  2. In `TaskbarOverlaySetStatus`, drop the `Release()` on the `CoCreateInstance` failure path, because the pointer is invalid there. Optionally refresh `hwnd` from `winId()` in case the HWND was recreated.
  - Files: `frontend/widgets/OBSBasic.cpp`, `frontend/utility/platform-windows.cpp`. About 25 lines. Windows only.
  - Test: MSVC build. Manual: enable tray minimize, start recording, minimize to tray, restore, and confirm the red dot is back. Repeat with recording paused (paused icon).

### [#7922](https://github.com/obsproject/obs-studio/issues/7922) — Application Audio Capture captures all device outputs of the app
- **Verdict:** OUT_OF_SCOPE
- **Reasoning:** Application audio capture uses the Windows process-loopback activation (`AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK` on `VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK`, `win-wasapi.cpp:695-711`). That OS API captures the process tree's audio across all endpoints and has no parameter to pick an endpoint. Per-device filtering would require a different OS API, so OBS cannot fix this. The workaround of routing the game to a dedicated device plus Audio Output Capture is the supported approach.
- **Evidence:** `plugins/win-wasapi/win-wasapi.cpp:695-711`, `:858`.
- **Related:** none

### [#8057](https://github.com/obsproject/obs-studio/issues/8057) — Virtual Camera delivers only one frame to Qt5 DirectShow clients
- **Verdict:** CANNOT_VERIFY
- **Reasoning:** This is client-specific: Qt5's DirectShow capture graph. Other DirectShow clients work. No defect could be found in the virtual camera's DirectShow filter (`plugins/win-dshow/virtualcam-module/`) without running the Qt5 sample to see which graph call (clock, `IAMStreamConfig`, allocator negotiation) it relies on.
- **Evidence:** the virtualcam DirectShow filter is in `plugins/win-dshow/virtualcam-module/`. The report gives no graph trace.
- **Related:** none

### [#8100](https://github.com/obsproject/obs-studio/issues/8100) — Replay Buffer saves more than the maximum replay time (macOS)
- **Verdict:** CANNOT_VERIFY
- **Reasoning:** The replay buffer only trims at keyframe boundaries, and only when it holds more than 2 keyframes (`obs-ffmpeg-mux.c:1031-1046`). If the encoder emits keyframes rarely or only once, the buffer grows without bound and a save contains everything. On macOS, VideoToolbox maps `keyint_sec = 0` to `MaxKeyFrameInterval = 0` (unlimited) (`mac-videotoolbox/encoder.c:530-546`), which would trigger exactly this. That is a strong hypothesis, but the log URL now returns 404, so the user's keyframe setting cannot be confirmed. If it holds, a later slice could treat VT `keyint 0` as "auto = 2s", or warn in the replay buffer when keyframes are sparse.
- **Evidence:** `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:985-1046` (purge logic needs >2 keyframes), `plugins/mac-videotoolbox/encoder.c:530-546`, `:1274` (keyint range 0-20).
- **Related:** #8333

### [#8333](https://github.com/obsproject/obs-studio/issues/8333) — Replay Buffer: missing initial keyframe
- **Verdict:** CANNOT_VERIFY
- **Reasoning:** libobs already drops video packets until the first keyframe for each output (`obs-output.c:2237-2240`). Purging always leaves a video keyframe at the front of the deque (`obs-ffmpeg-mux.c:1014-1029`). No code path was found that saves a replay starting on a non-keyframe. The report involves fast stop/start cycles driven by a third-party plugin (Advanced Scene Switcher), NVENC with B-frames, and MKV. It needs a repro to locate any defect.
- **Evidence:** `libobs/obs-output.c:2237-2240`, `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:985-1029`, `:1126-1150` (`replay_buffer_save` reorder).
- **Related:** #8100

### [#8614](https://github.com/obsproject/obs-studio/issues/8614) — Twitch docks visible when starting with `--minimize-to-tray`
- **Verdict:** CANNOT_VERIFY
- **Reasoning:** With start-minimized, the main window is never shown (`OBSBasic.cpp:1041-1052`). The Twitch auth UI later creates the docks, forces them to float, and on first load explicitly sets the chat and info docks visible, or restores the saved dock state (`TwitchAuth.cpp:281-294`, `:389-421`). There is no check for whether the main window is hidden. That is a plausible cause, since a floating dock is a separate top-level window. However, the exact Qt behaviour (floating docks of a never-shown main window) and the dock-state restore path depend on an authenticated Twitch session that cannot be reproduced here, so the defect cannot be confirmed. Note: the secondary pane `restoreState` is already guarded by `main->isVisible() || !main->isMaximized()` (`TwitchAuth.cpp:418`), which looks inverted or ineffective for the hidden case.
- **Evidence:** `frontend/widgets/OBSBasic.cpp:1041-1052`, `frontend/widgets/OBSBasic_SysTray.cpp:126-135`, `frontend/oauth/TwitchAuth.cpp:281-294`, `:389-421`; the same pattern is in `frontend/oauth/RestreamAuth.cpp:201-216`.
- **Related:** none

### [#8818](https://github.com/obsproject/obs-studio/issues/8818) — Start-stream hotkey bypasses the confirmation dialog
- **Verdict:** DEFER_LARGE
- **Reasoning:** Confirmed in code: the hotkey pair calls `basic.StartStreaming` directly (`OBSBasic_Hotkeys.cpp:131-150`). The `WarnBeforeStartingStream` confirmation lives only in `StreamActionTriggered`, the button path, and is shown only when `isVisible()` (`OBSBasic_Streaming.cpp:439-469`). The code change is small. It is deferred because whether a hotkey should pop a modal is a UX decision: hotkeys are usually pressed while another fullscreen app has focus, and the existing `isVisible()` guard shows the dialog was deliberately limited to visible-window interactions. The stop-stream hotkey bypasses `WarnBeforeStoppingStream` the same way. A maintainer or design decision is needed on whether to show a dialog, add a separate "also confirm for hotkeys" option, or leave it as is.
- **Evidence:** `frontend/widgets/OBSBasic_Hotkeys.cpp:131-150`, `frontend/widgets/OBSBasic_Streaming.cpp:439-469`, `frontend/data/locale/en-US.ini:937-938`.
- **Related:** none

### [#8869](https://github.com/obsproject/obs-studio/issues/8869) — Browser source (Google Meet) audio stops after OBS is minimized
- **Verdict:** CANNOT_VERIFY
- **Reasoning:** The browser source is the `obs-browser` submodule (CEF). The symptom, Meet audio stopping about 2 minutes after the OBS window is minimized, points to the web app or Chromium behaviour for a page it considers hidden or idle in a guest session, not to OBS audio routing. There is no log evidence of a source or audio pipeline fault, and repro needs a live Meet session.
- **Evidence:** the browser source lives in the `plugins/obs-browser` submodule. The report gives nothing actionable.
- **Related:** none

### [#8872](https://github.com/obsproject/obs-studio/issues/8872) — QSV HEVC always records NV12 regardless of colour format (no 4:4:4)
- **Verdict:** DEFER_LARGE
- **Reasoning:** This is by design today. The QSV encoder only accepts NV12 (`valid_format`) or NV12/P010 (HEVC/AV1) and silently falls back to NV12 for anything else, including I444 (`obs-qsv11.c:918-975`). Supporting HEVC 4:4:4 (AYUV/Y410 surfaces, RExt profiles, texture and system-memory upload paths, capability checks per GPU) is a feature addition to the QSV encoder, not a small fix. A tiny follow-up worth considering is logging a warning when the requested format is replaced by NV12.
- **Evidence:** `plugins/obs-qsv11/obs-qsv11.c:918-926`, `:955-975`, `:757-758`.
- **Related:** none

### [#8918](https://github.com/obsproject/obs-studio/pull/8918) — frontend: Add output wrapper class
- **Verdict:** DEFER_LARGE
- **Reasoning:** This is a refactor PR that adds `OutputObj` (441 + 102 new lines) and moves the virtual camera onto it. In total it is 15 files, +609/-299. The merge base is 7272af137 (2026-04-02). A legacy `git merge-tree` against current master shows 15 conflict hunks, so it no longer applies cleanly. It is large, conflicting, and only a step toward a future output UI, with no user-visible fix. Not worth carrying in a fork.
- **Evidence:** `git diff master...refs/upstream-pr/8918 --stat` (15 files, 609+/299-). `git merge-tree $(git merge-base master refs/upstream-pr/8918) master refs/upstream-pr/8918` reports 15 conflict markers. Affected areas: `frontend/utility/BasicOutputHandler.cpp`, `frontend/widgets/OBSBasic_VirtualCam.cpp`.
- **Related:** none

### [#8929](https://github.com/obsproject/obs-studio/issues/8929) — OBS causes frametime stuttering just by being open
- **Verdict:** CANNOT_VERIFY
- **Reasoning:** This happens with no sources and the preview disabled, measured with a browser frame-pacing test. It is system-, GPU- and driver-dependent (the render thread presenting at the canvas rate, DWM and multi-plane overlay interaction). No code defect can be identified.
- **Evidence:** the report contains only external measurements.
- **Related:** #7716, #7676

### [#8949](https://github.com/obsproject/obs-studio/issues/8949) — Crash opening Settings when service.json references a non-existent service
- **Verdict:** CANNOT_VERIFY
- **Reasoning:** Labeled confirmed upstream. The thread (one WebFetch) has no stack trace. A maintainer called #9068 a workaround, "probably still needs looking into a proper solution". The current code paths handle an unknown `rtmp_common` service defensively. The UI inserts the unknown name into the combo box (`OBSBasicSettings_Stream.cpp:133-140`). `service_selected` inserts disabled placeholder entries when `find_service` fails (`rtmp-common.c:653-663`). `rtmp_common_get_protocol` defaults to "RTMP" (`rtmp-common.c:1112-1117`). The recommendation, codec and output lookups all null-check `find_service` (`rtmp-common.c:791-799`, `:967-969`, `:1014-1016`, `:1056-1058`). Without a stack, a crash site on current master cannot be pinned down, and statically it looks already mitigated. It needs a runtime repro with the reporter's `service.json` (service "Mixer.com - FTL").
- **Evidence:** `frontend/settings/OBSBasicSettings_Stream.cpp:95-255`, `:383-407`, `:726-751`; `plugins/rtmp-services/rtmp-common.c:310-330`, `:643-670`, `:785-799`, `:1112-1117`.
- **Related:** upstream #9068 (workaround PR, not open locally)
