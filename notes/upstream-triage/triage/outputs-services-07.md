# Upstream triage — batch outputs-services-07

- Batch: outputs-services-07 (area hint: outputs-services)
- Items: 12171, 12173, 12196, 12207, 12224, 12271, 12275, 12305, 12331, 12395, 12407, 12442, 12464, 12475, 12505, 12569, 12680, 12686, 12724, 12725
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`, PR heads from `refs/upstream-pr/<N>`, code read on master. No GitHub API / WebFetch used for this batch.
- Tooling note: local git is 2.33, which has no `merge-tree --write-tree`. Whether a PR still applies was checked with `git diff $(merge-base) refs/upstream-pr/N | git apply --check` (read-only). For PRs whose files moved (`frontend/plugins/*` became `plugins/*` in 1829492e6), the paths were rewritten and checked again.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 12171 | issue | CANNOT_VERIFY |
| 12173 | issue | OUT_OF_SCOPE |
| 12196 | PR | DEFER_LARGE |
| 12207 | PR | IMPLEMENT (cherry-pick-pr) |
| 12224 | issue | CANNOT_VERIFY |
| 12271 | issue | CANNOT_VERIFY |
| 12275 | issue | CANNOT_VERIFY |
| 12305 | issue | OUT_OF_SCOPE |
| 12331 | PR | IMPLEMENT (cherry-pick-pr) |
| 12395 | PR | IMPLEMENT (partial-pr) |
| 12407 | issue | CANNOT_VERIFY |
| 12442 | PR | DEFER_LARGE |
| 12464 | issue | CANNOT_VERIFY |
| 12475 | issue | IMPLEMENT (new-change) |
| 12505 | PR | DEFER_LARGE |
| 12569 | issue | DEFER_LARGE |
| 12680 | issue | DEFER_LARGE |
| 12686 | issue | CANNOT_VERIFY |
| 12724 | issue | CANNOT_VERIFY |
| 12725 | issue | CANNOT_VERIFY |

---

### [#12171](https://github.com/obsproject/obs-studio/issues/12171) — Program view displaying wrong resolution with Studio Mode and Advanced output with different rec/stream resolutions
**Verdict: CANNOT_VERIFY**

The reporter uses a 1440p canvas, a stream encoder rescaled to 1080p and an unscaled recording. In Studio Mode, the Program view shows 1080p content when the scene is changed without going through Preview (for example over WebSocket, or at startup). The Program display draws the main canvas mix's `render_texture`, which has the base resolution and uses a base-size ortho. Encoder rescaling makes separate mixes, and the main canvas mix is created from the canvas `ovi`. I could not find a code path that would put the 1080p mix's texture into the Program view. The report is from 31.0.3, before the canvas rework in 31.1. It needs a repro on current code.
- `frontend/widgets/OBSBasic_StudioMode.cpp:299-327` — RenderProgram sets ortho/viewport from `ovi.base_*` and calls `obs_render_main_texture_src_color_only()`
- `libobs/obs.c:2180-2233` — draws `canvas->mix->render_texture` for the main canvas
- `libobs/obs-canvas.c:165,309` — the canvas mix is created from the canvas's own ovi

Related: none.

### [#12173](https://github.com/obsproject/obs-studio/issues/12173) — UB with union using
**Verdict: OUT_OF_SCOPE**

The issue says that `util_add128` / `util_div128_32` write `i32[]` and then read `low`/`high` through the anonymous union, which is undefined behaviour in C++. The header is plain C, and C explicitly allows type punning through a union (C11 6.5.2.3, footnote 95). MSVC, GCC and Clang all document it as supported in C++ too. No file in the tree includes this header: `git grep uint128` finds only the header and its CMake listing. The real build has no defect. The report quotes the C++ standard against a C header. If we ever wanted to address it, a rewrite that uses only `low`/`high` with 32-bit masks would be about 30 lines, but it does nothing for this project.
- `libobs/util/util_uint128.h:19-28` — union { uint32_t i32[4]; struct { uint64_t low, high; }; }
- `libobs/util/util_uint128.h:30-51,88-100` — writes and reads mixed members
- `libobs/CMakeLists.txt:137,362` — header is only installed/listed; no in-tree includer

Related: none.

### [#12196](https://github.com/obsproject/obs-studio/pull/12196) — frontend-tools: Rewrite output timer
**Verdict: DEFER_LARGE**

This is a full rewrite plus a small dialog redesign: 9 files, +827/−626. The frontend plugins moved from `frontend/plugins/` to `plugins/` (1829492e6), so the PR no longer applies. Even after rewriting the paths it conflicts in `plugins/frontend-tools/frontend-tools.c` and `output-timer.cpp`. It is a tech-debt rewrite with no bug fix, and it includes UI changes. That is too large and too risky for a minimal slice.
- `git diff master...refs/upstream-pr/12196 --stat` — 9 files, 827+/626−
- `plugins/frontend-tools/output-timer.cpp` — current location (moved by 1829492e6)
- path-rewritten `git apply --check` — fails in frontend-tools.c and output-timer.cpp

Related: none.

### [#12207](https://github.com/obsproject/obs-studio/pull/12207) — librtmp: Fix reset socket descriptor to -1 after closing RTMP connection
**Verdict: IMPLEMENT (cherry-pick-pr)**

The defect is confirmed on master. When `send()` fails, `WriteN` calls `RTMPSockBuf_Close(&r->m_sb)` and then `RTMP_Close(r)`. `RTMPSockBuf_Close` calls `closesocket()` but does not reset `sb_socket`. So `RTMP_IsConnected()`, which only tests `sb_socket != INVALID_SOCKET`, still returns true. `RTMP_Close` then calls `SendFCUnpublish`/`SendDeleteStream` on the closed descriptor. That send fails, goes back into `WriteN`, and calls `closesocket()` on the same descriptor again. This is a double close, and on POSIX the fd number may already belong to something else. It also recurses back into `RTMP_Close`. The PR resets `sb_socket = INVALID_SOCKET` inside `RTMPSockBuf_Close` and moves the `m_clientID` free out of the connected branch, so it is always freed. The patch is 12+/5− in one file and applies cleanly to master. The PR was motivated by Android, but the double close also applies to OBS on all platforms.
- `plugins/obs-outputs/librtmp/rtmp.c:1597-1619` — WriteN error path: close socket, then RTMP_Close
- `plugins/obs-outputs/librtmp/rtmp.c:497-500` — `RTMP_IsConnected` tests only `sb_socket`
- `plugins/obs-outputs/librtmp/rtmp.c:4323-4355` — RTMP_Close sends FCUnpublish/DeleteStream while it thinks it is connected, then closes again
- `plugins/obs-outputs/librtmp/rtmp.c:4537-4549` — `RTMPSockBuf_Close` does not invalidate `sb_socket`
- `git apply --check` of the PR diff against master: clean

Slice plan:
- `git cherry-pick 6962f59c1` (author lilinxiong; GPL-2.0-or-later / librtmp LGPL-2.1 file, contribution compatible). Single file, `plugins/obs-outputs/librtmp/rtmp.c`.
- Test: build the `obs-outputs` target with MSVC. Manual test: stream to a local RTMP listener (e.g. `ffmpeg -listen 1 -i rtmp://127.0.0.1/live/x -f null -`), kill the listener mid-stream, and confirm that OBS reports a disconnect/reconnect without a crash and that the log has only one send error. If no RTMP listener is available, mark the runtime behaviour UNTESTED.

Related: none.

### [#12224](https://github.com/obsproject/obs-studio/issues/12224) — Remuxed MP4 files stutter in Adobe Premiere Pro at 2x/4x
**Verdict: CANNOT_VERIFY**

Remuxed MP4s play fine in DaVinci Resolve and only stutter in Premiere at high playback speed. OBS's remux is a libavformat stream copy, so the bitstream is the same as the MKV's. The difference is in how one NLE treats the MP4 container (sample tables, edit lists, how sparse the keyframes are). No defect in OBS code can be identified from the report, and checking it would need Premiere. It may be a third-party application quirk.
- `frontend/utility/RemuxQueueModel.cpp`, `frontend/utility/RemuxWorker.cpp` — remux goes through `media-remux` (FFmpeg stream copy)

Related: none.

### [#12271](https://github.com/obsproject/obs-studio/issues/12271) — YouTube Live Control Panel no longer displays when switching profiles multiple times
**Verdict: CANNOT_VERIFY**

The Live Control Panel is a Google web app (`studio.youtube.com/live/.../console?kc=OBS`) hosted in a CEF dock (`YouTubeAppDock`), and it is rebuilt when profiles switch. After several switches it stops rendering, but chat keeps working. I could not tell from the code whether the cause is stale cookie state, the dock lifecycle, or the web app itself. The reporter also links #11876 (the panel fails to connect at all). It needs a repro with a YouTube-connected profile.
- `frontend/docks/YouTubeAppDock.cpp:21-27,111` — panel URL and dock object
- `frontend/oauth/YoutubeAuth.cpp:40-70,109-157` — cookie deletion, UI load/unload when profiles switch

Related: upstream #11876 (not in this batch).

### [#12275](https://github.com/obsproject/obs-studio/issues/12275) — Stream goes live despite Bandwidth Test Mode being checked
**Verdict: CANNOT_VERIFY**

Bandwidth test mode adds `?bandwidthtest=true` to the Twitch key in `OAuthStreamKey::OnStreamConfig` when `bwtest` is set. The settings save `bwtest` only when Twitch OAuth is connected. Multitrack (Enhanced Broadcasting) keeps the user key's query params explicitly. Every path I found adds the flag. The reporter says the same setup used to work and broke on one day with no OBS update, which points to a change on Twitch's side. Without the attached logs, no OBS defect can be identified.
- `frontend/oauth/OAuth.cpp:203-223` — adds `?bandwidthtest=true` to the key
- `frontend/settings/OBSBasicSettings_Stream.cpp:303-317` — `bwtest` persisted only for Twitch OAuth
- `frontend/utility/MultitrackVideoOutput.cpp:98-110` — copies the key's query items to the multitrack service key

Related: none.

### [#12305](https://github.com/obsproject/obs-studio/issues/12305) — Twitch chat dock freezes when the FFZ emote menu is opened
**Verdict: OUT_OF_SCOPE**

OBS only injects FrankerFaceZ's own script from FFZ's CDN into the Twitch chat page. The freeze happens inside FFZ's emote menu, and it does not happen with BTTV or with no add-on. That points to the third-party script, or to how it interacts with the bundled CEF version. OBS's code has nothing to fix. It should go to FFZ, or to obs-browser/CEF if it turns out to be a Chromium-version issue.
- `frontend/oauth/TwitchAuth.cpp:193-196` — injects the `cdn.frankerfacez.com/script/script.min.js` tag
- `frontend/oauth/TwitchAuth.cpp:41` — FFZ settings popup whitelisted

Related: none.

### [#12331](https://github.com/obsproject/obs-studio/pull/12331) — frontend: Inform YouTube that captions are embedded
**Verdict: IMPLEMENT (cherry-pick-pr)**

`InsertBroadcast` never sets `contentDetails.closedCaptionsType`. As a result, broadcasts created from OBS's Manage Broadcast dialog have captions locked off in YouTube Studio, even though OBS can embed CEA-608/708 captions. The PR adds an "Enable OBS Captions" checkbox, saves it to the profile config, and sends `closedCaptionsType: closedCaptionsEmbedded` when it is checked. That is 5 files, +44/−22, and it applies cleanly to master. The feature is not already present: `git grep closedCaptions` on master finds nothing.

One small inconsistency: the `.ui` file defaults the checkbox to checked, but `LoadSettings` uses `config_get_bool` with no default, so the box loads unchecked until the user saves it once. This is harmless.
- `frontend/utility/YoutubeApiWrappers.cpp:~188-217` — contentDetails has no closedCaptionsType
- `frontend/utility/YoutubeApiWrappers.hpp:~33` — BroadcastDescription fields
- `frontend/dialogs/OBSYoutubeActions.cpp:~622-675` — UiToBroadcast/SaveSettings/LoadSettings
- `git apply --check`: clean

Slice plan:
- `git cherry-pick ffdc69234` (author Matt Gajownik / WizardCM; GPL-2.0-or-later). Files: `frontend/data/locale/en-US.ini`, `frontend/dialogs/OBSYoutubeActions.cpp`, `frontend/forms/OBSYoutubeActions.ui`, `frontend/utility/YoutubeApiWrappers.cpp/.hpp`.
- Test: MSVC build of the `obs-studio` frontend, and check that the dialog shows the checkbox. The actual YouTube API call needs YouTube OAuth API keys, which are build secrets this fork does not have. Mark the YouTube behaviour UNTESTED.

Related: none.

### [#12395](https://github.com/obsproject/obs-studio/pull/12395) — frontend: Improve UX around recording paths
**Verdict: IMPLEMENT (partial-pr)**

The PR contains three changes:
1. A prompt that creates a missing recording folder. This is a UX decision. Its error string is hard-coded and untranslated ("Failed to create directory '%1'"), and a modal prompt would block hotkey-started recordings. Skip it.
2. Screenshots no longer say "saved" when saving failed. This is a real bug on master.
3. An error is shown when "Show Recordings" fails to open the path. This is small and sound.

The PR conflicts with master in `OBSBasic_Recording.cpp` and `OBSBasic_ReplayBuffer.cpp`. `ScreenshotObj` has also been rewritten since: `muxFile`/`onFinished` replaced `MuxAndFinish`/the destructor. So the PR cannot be cherry-picked, but the intent of parts 2 and 3 can be re-implemented in a few lines.

Defect evidence for part 2: `saveToFile` calls `GetOutputFilename`. For a bad path, that shows the BadPath warning and returns "". `muxFile` then calls `image.save("")` and ignores the result. `onFinished` always emits `imageSaved(path)`, so the status bar says "Screenshot saved to ''".
- `frontend/utility/ScreenshotObj.cpp:200-228` — path from `GetOutputFilename`
- `frontend/OBSApp.cpp:1692-1705` — returns "" when the directory can't be opened
- `frontend/utility/ScreenshotObj.cpp:333-347` — `image.save` / `SaveJxr` results ignored
- `frontend/utility/ScreenshotObj.cpp:350-365` — `imageSaved` emitted unconditionally
- `frontend/widgets/OBSBasic_Screenshots.cpp:34-35` — status bar "ScreenshotSavedTo"
- `frontend/widgets/OBSBasic_Recording.cpp:30-40` — `openUrl` result ignored

Slice plan (new code carrying the intent of PR 12395 by Warchamp7, with credit in the commit body):
- `ScreenshotObj.hpp`: add `bool saveSucceeded = false;`.
- `ScreenshotObj.cpp::muxFile`: skip if `path.empty()`. Set `saveSucceeded = image.save(...)`, or on Windows, `SUCCEEDED(SaveJxr(...))`. Log success or failure.
- `onFinished`: emit `imageSaved(path)` only if `saveSucceeded`. Otherwise show a status bar message `Basic.StatusBar.ScreenshotError` (new en-US string).
- `OBSBasic_Recording.cpp::on_actionShow_Recordings_triggered`: if `openUrl` returns false, call `OutputPathInvalidMessage()` or show the BadPath warning.
- About 25 lines in 4 files.
- Test: MSVC frontend build. Manual test on Windows: set the recording path to a folder that does not exist, take a screenshot, and check that the status bar no longer claims it was saved. Also check that Show Recordings shows an error.

Related: upstream #10974 (earlier attempt, not in batch).

### [#12407](https://github.com/obsproject/obs-studio/issues/12407) — After restoring OBS from the tray, OBS shows black in its own Display Capture
**Verdict: CANNOT_VERIFY**

The setting "Hide OBS windows from capture" uses `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)`, and `OBSApp::notify` applies it to each top-level window. Restoring from the tray just shows the same HWND again; the code does not change the affinity. The window then showing as black in a capture, rather than being excluded, is DWM / capture-API behaviour: black is what WDA_MONITOR does, and what excluded windows look like with some capture paths. I could not identify an OBS code defect. It is Windows-compositor specific and needs a repro.
- `frontend/widgets/OBSBasic.cpp:2018-2043` — SetDisplayAffinity
- `frontend/OBSApp.cpp:1538-1553` — applied in notify for Window/Dialog/Tool types

Related: none.

### [#12442](https://github.com/obsproject/obs-studio/pull/12442) — decklink-output-ui: Update Decklink output to use canvases
**Verdict: DEFER_LARGE**

This replaces about 300 lines of custom texrender/stagesurface/video_output code with `obs_canvas` (+56/−305). It is a refactor of working code and fixes no bug. The removed code includes the premultiplied-alpha (keyer) path and the scaling to the DeckLink mode size, which need DeckLink hardware to check. The file moved to `plugins/decklink-output-ui/`, and even after rewriting the path the patch fails at hunk `:89`. The PR has 6 review comments, which suggests open design questions. There is no small slice and no way to test it here.
- `plugins/decklink-output-ui/decklink-ui-main.cpp:30-31,106,183-186,354-408` — current texrender/premultiplied path
- path-rewritten `git apply --check` — fails at decklink-ui-main.cpp:89

Related: #12680 (DeckLink).

### [#12464](https://github.com/obsproject/obs-studio/issues/12464) — "Couldn't initialize muxer" after Resize Output (Source Size)
**Verdict: CANNOT_VERIFY**

The report is from 31.0.4 on Linux with a PipeWire window capture. A likely cause was odd output dimensions from window sizes. Since 31.1.0, `ResizeOutputSizeOfSource` rounds the width up to a multiple of 4 and the height up to a multiple of 2 (08f2374b4). That may already fix it. However, the reporter says restarting OBS after the resize makes recording work. Startup does no rounding (`ResetVideo` only clamps to at least 32), so dimensions alone do not explain the bug. Something stale after the runtime `ResetVideo`/`ResetOutputs` is more likely. With no log content, it cannot be pinned down. It needs a repro on current master.
- `frontend/widgets/OBSBasic_OutputHandler.cpp:59-95` — rounding, then ResetVideo, ResetOutputs
- `frontend/widgets/OBSBasic.cpp:~1458-1480` — no even-rounding at startup
- commit 08f2374b4 "frontend: Round up Resize Output (Source Size)" (first in 31.1.0)

Related: none.

### [#12475](https://github.com/obsproject/obs-studio/issues/12475) — Accessibility: Shift+Tab records "Shift" in the hotkeys dialog
**Verdict: IMPLEMENT (new-change)**

The defect is confirmed. `OBSHotkeyEdit::keyPressEvent` records a combination for a modifier-only press: `Key_Shift` gives `key = OBS_KEY_NONE` plus the Shift modifier, and `HandleNewKey` stores it right away. Qt handles Tab/Backtab in `QWidget::event` before `keyPressEvent`, so the following Tab moves focus correctly. But the Shift press that came just before has already overwritten the binding with "Shift". Plain Tab works only because it has no modifier press before it.
- `frontend/settings/OBSHotkeyEdit.cpp:30-60` — modifier-only press goes to HandleNewKey
- `frontend/settings/OBSHotkeyEdit.cpp:144-156` — HandleNewKey commits immediately (sets `changed`, emits KeyChanged)
- `frontend/settings/OBSHotkeyEdit.hpp:60-80` — no focus handling overrides

Slice plan (about 25 lines in `frontend/settings/OBSHotkeyEdit.hpp/.cpp`):
- In `keyPressEvent`, when the key is a lone `Key_Shift` (no other modifiers), save the key and the `changed` state from before the press: `preShiftKey`, `preShiftChanged`, `pendingShift = true`. Any other key press or mouse press clears `pendingShift`.
- Override `focusOutEvent(QFocusEvent *e)`. If `e->reason() == Qt::BacktabFocusReason && pendingShift`, restore `key = preShiftKey`, `changed = preShiftChanged`, emit `KeyChanged(key)` and call `RenderKey()`. Then clear `pendingShift` and call the base class.
- Shift-only bindings set on purpose keep working, because they are only reverted when focus leaves with Backtab.
- Test: MSVC frontend build. Manual test on Windows: Settings → Hotkeys, tab into a field, press Shift+Tab, and check that the field keeps its old value and focus moves back. Also check that holding Shift then pressing a letter still records Shift+letter. A screen-reader run is optional.

Related: none.

### [#12505](https://github.com/obsproject/obs-studio/pull/12505) — Hybrid Replay Buffer
**Verdict: DEFER_LARGE**

This is a new feature: a replay buffer built on the Hybrid MP4/MOV muxer, plus a new "save and clear" hotkey. It adds about 420 lines to `mp4-output.c` and changes the frontend output handlers. The obs-outputs part applies, but `frontend/utility/AdvancedOutput.cpp` and `SimpleOutput.cpp` conflict. The PR has 16 comments, so it is still under review, and the description lists known overlap limits. It is a large feature, not a minimal slice. Master has no hybrid replay buffer.
- `plugins/obs-outputs/obs-outputs.c:18,66` — only `mp4_output_info` registered; no replay variant
- `plugins/obs-outputs/mp4-output.c:608-623` — only the mp4/mov output infos
- `git apply --check`: conflicts in AdvancedOutput.cpp, SimpleOutput.cpp

Related: none.

### [#12569](https://github.com/obsproject/obs-studio/issues/12569) — YouTube: stream to a channel you manage from another account
**Verdict: DEFER_LARGE**

This is a feature request for a channel picker in the YouTube integration, so a user with delegated (granular) channel permissions can stream to the managed channel. Today the integration uses the authenticated account's own channel. Building this means changes to the YouTube API wrapper (which channel/broadcast calls are made on behalf of), a new account/channel picker UI, and checking what YouTube's API allows for delegated access. It cannot be done or tested without YouTube API credentials. There is no small slice.
- `frontend/utility/YoutubeApiWrappers.cpp:170,276` — channel and broadcast queries use `mine=true` (the authenticated account)
- `frontend/dialogs/OBSYoutubeActions.cpp` — no channel selector

Related: #12331, #12271 (YouTube integration).

### [#12680](https://github.com/obsproject/obs-studio/issues/12680) — DeckLink SDK needs updating
**Verdict: DEFER_LARGE**

The vendored DeckLink SDK headers are still 12.0 on all three platforms, which confirms what the issue says. The reporter's actual problem is A/V drift on DeckLink output with 29.97p sent to a 59.94i output. No one has shown that the SDK version causes it. Updating means replacing three vendored SDK trees and possibly porting to API changes, then testing on DeckLink hardware this machine does not have. The Blackmagic SDK header license (LICENSE.decklink-sdk) allows redistribution, so the blockers are size and testing, not licensing.
- `plugins/decklink/win/decklink-sdk/DeckLinkAPIVersion.h:34` — "12.0"
- `plugins/decklink/linux/decklink-sdk/DeckLinkAPIVersion.h:34`, `plugins/decklink/mac/decklink-sdk/DeckLinkAPIVersion.h:34` — "12.0"

Related: #12442.

### [#12686](https://github.com/obsproject/obs-studio/issues/12686) — libcef crash takes out OBS
**Verdict: CANNOT_VERIFY**

OBS crashes inside libcef when a scene with StreamElements browser sources is shown. The same page also crashes the reporter's desktop Chrome tab, and the log has thousands of JS errors from the SE vendor script. The crash is in Chromium/CEF and is triggered by third-party page content. obs-browser runs in a separate submodule and CEF process model, and the attached crash logs are not available locally. No code in this repository can be identified as faulty.
- `plugins/obs-browser` (submodule) — CEF integration lives outside this tree's main code

Related: none.

### [#12724](https://github.com/obsproject/obs-studio/issues/12724) — Media Source with SRT stream has lagging audio when the input is slightly slower than real time
**Verdict: CANNOT_VERIFY**

There is a good repro recipe (srt-live-server plus a slightly-slower-than-realtime ffmpeg sender), but the root cause is not in the report. Candidates in the ffmpeg media source / media-playback are the handling of audio timestamps for live sources, and libobs audio buffering/resync when the source is reactivated on scene switch. Pinning it down needs the live repro (an SRT server in Docker), which is not available in this environment. It is in scope, but there is no identified defect.
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c` — media source, network buffering options
- `shared/media-playback/media-playback/media.c` — audio/video timing for live inputs

Related: none.

### [#12725](https://github.com/obsproject/obs-studio/issues/12725) — Recording can't be stopped while Replay Buffer is running
**Verdict: CANNOT_VERIFY**

This only happens with the QuickSync H.264 encoder on Linux (Flatpak), and not with software encoding. Recording and Replay Buffer share one encoder in Simple mode. Stopping gets stuck in "Stopping", which suggests the hardware encoder does not drain or release correctly when one of two outputs stops, so the shared-encoder stop never completes. That is specific to the encoder and driver (QSV/libvpl on Linux). The code cannot be identified without a repro and a log.
- `frontend/utility/SimpleOutput.cpp` — shared encoder between recording and replay buffer
- `plugins/obs-qsv11` — QSV encoder (Linux path via libvpl)

Related: none.
