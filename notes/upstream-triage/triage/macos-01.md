# Upstream triage — batch macos-01

- Batch: macos-01 (area hint: macos)
- Items: 4740, 4773, 5105, 5619, 6217, 6320, 7275, 7419, 7549, 7720, 7958, 7968, 8177, 8320, 8697, 8760, 9056, 9144, 9616, 9641
- Date: 2026-10-26
- Base commit: 72e866557 (master)
- Method: I read issue bodies from notes/upstream-triage/data/all.json and checked them against the current code. I did not use WebFetch or the GitHub API, and I made no source edits.
- Summary: 1 IMPLEMENT (#6217), 1 ALREADY_ADDRESSED (#7419), 18 CANNOT_VERIFY. All 20 items are issues, with no PRs. Most are macOS-only runtime, hardware or OS-framework reports that this Windows box cannot reproduce, and their bodies do not point to a code defect.

---

### [#4740](https://github.com/obsproject/obs-studio/issues/4740) — MKV muxing generates audio crackles in macOS 11.3+ QuickTime Player
**Verdict:** CANNOT_VERIFY

The audio crackles only show up when the remuxed MP4 is played in QuickTime, and only on macOS 11.3+. The remux path copies codec parameters as-is and sets no audio priming or edit-list handling. That could be involved, but nothing in the report pins down which part (AAC priming, edit list or timestamps). It needs a sample file and a repro on macOS. Recording directly to hybrid MP4/MOV, now the default container, also avoids remuxing entirely.

Evidence:
- libobs/media-io/media-remux.c:71-115 — creates the output context and copies codecpar. Only HEVC tags and 5-channel layouts get special handling.
- frontend/widgets/OBSBasic.cpp:485 — DEFAULT_CONTAINER is "hybrid_mov", so new users do not go through the MKV-then-remux path.

Related: #7419

### [#4773](https://github.com/obsproject/obs-studio/issues/4773) — Crash on removing VST plugin filter
**Verdict:** CANNOT_VERIFY

This was reported against 27.0 RC6 on macOS 10.15 with one specific third-party VST (TDR Kotelnikov). The crash log link is an external Dropbox file, and the body has no stack. plugins/obs-vst has been reworked many times since then. Nothing in the body points to a specific teardown defect.

Evidence:
- plugins/obs-vst/VSTPlugin.cpp — current VST host. No crash location could be identified from the report.

Related: none

### [#5105](https://github.com/obsproject/obs-studio/issues/5105) — Fullscreen projector not working for Apple TV
**Verdict:** CANNOT_VERIFY

The fullscreen projector shows a grey screen on an AirPlay "separate display", and OBS crashes when that display is removed. This depends on how AirPlay virtual displays behave. The body has no crash stack and the problem can only be reproduced with Apple TV hardware.

Evidence:
- frontend/utility/platform-osx.mm:110-128 — projector window level and flags handling. No AirPlay-specific path to fix.

Related: #8177

### [#5619](https://github.com/obsproject/obs-studio/issues/5619) — macOS: OBS freezes on start if start scene contains unreachable SRT media source
**Verdict:** CANNOT_VERIFY

In current code, network media is opened on the media thread, not during source creation. libavformat is given an interrupt callback and a 30 s stimeout, and a reconnect thread has been added to the FFmpeg source since 27.1.3. A UI-thread hang at startup would need a fresh repro and a thread backtrace. I could not find a blocking open on the main thread.

Evidence:
- shared/media-playback/media-playback/media.c:642-656 — interrupt_callback aborts on kill/stopping.
- shared/media-playback/media-playback/media.c:688-695 — network inputs set stimeout and the interrupt callback.
- shared/media-playback/media-playback/media.c:740,835 — init happens inside mp_media_thread.
- plugins/obs-ffmpeg/obs-ffmpeg-source.c:57-83 — reconnect thread infrastructure.

Related: none

### [#6217](https://github.com/obsproject/obs-studio/issues/6217) — obs-ffmpeg: Assert fail with XDCAM HD files in DEBUG
**Verdict:** IMPLEMENT

Root cause found in code. In debug builds, `mp_media_calc_next_ns` asserts that `delta >= 0`. The lines right after the assert already clamp a negative delta to 0, so the release build tolerates that case on purpose. Files with non-monotonic minimum PTS (interlaced or field-coded XDCAM 422 in MOV/MXF) trip the assert and abort debug builds. Replacing the assert with a debug log keeps debug builds usable and leaves release behaviour unchanged.

Evidence:
- shared/media-playback/media-playback/media.c:498-518 — `#ifdef _DEBUG assert(delta >= 0); #endif` is followed by `if (delta < 0) delta = 0;`.
- shared/media-playback/media-playback/media.c:19 — `#include <assert.h>` (check whether anything else still uses it).

Slice plan:
- In shared/media-playback/media-playback/media.c, `mp_media_calc_next_ns`: replace the `#ifdef _DEBUG assert(...)` block with `if (delta < 0) blog(LOG_DEBUG, "MP: negative frame delta %lld ns, clamping", (long long)delta);` and keep the existing clamp. Remove `#include <assert.h>` only if nothing else uses it. About 5 lines.
- Testing: MSVC build of the media-playback / obs-ffmpeg targets (Debug config) on Windows. The behaviour change is limited to Debug builds. The XDCAM sample from the report is not available, so the runtime repro is UNTESTED.

Related: none

### [#6320](https://github.com/obsproject/obs-studio/issues/6320) — Image slide show transitions problem
**Verdict:** CANNOT_VERIFY

When the slideshow is hidden or not in the active scene but shown in a source projector, the fade starts from the first image every time. Whether a transition finishes depends on video render (`t >= 1` clears transitioning_video) and on whether the transition is active (transitioning_audio is cleared only when it is inactive). The slideshow also has special tick handling for an inactive transition. Tracing the code turned up several plausible paths, but none that matches the reported 1>2, 1>3 sequence for certain. It needs a runtime repro (possible on Windows, since the issue is also labelled platform/windows) before a fix can be made. A good candidate for later investigation.

Evidence:
- libobs/obs-source-transition.c:327-376 — obs_transition_start. If a transition is still active it first calls obs_transition_set(sources[1]).
- libobs/obs-source-transition.c:815-826 — video render completes the transition only when rendered. Audio state is cleared only if the transition is not active.
- plugins/image-source/obs-slideshow-mk2.c:240-254 — do_transition.
- plugins/image-source/obs-slideshow-mk2.c:834-876 — tick path, including the active_transition_source check and the restart_on_activate / pause_on_deactivate handling.

Related: none

### [#7275](https://github.com/obsproject/obs-studio/issues/7275) — [macOS Ventura] ScreenCaptureKit capture drops frames, esp. fullscreen / low-FPS sources
**Verdict:** CANNOT_VERIFY

Frames are dropped by ScreenCaptureKit when fullscreen or low-FPS content is captured on a Ventura beta. Apple's frame delivery is involved and there is no identifiable OBS defect. The issue cannot be tested off macOS.

Evidence:
- plugins/mac-capture/mac-sck-video-capture.m:74-270 — init_screen_stream sets up stream properties and outputs.
- plugins/mac-capture/mac-sck-common.m:29-47 — stream-error handling.

Related: #8320, #8697, #9056, #8760

### [#7419](https://github.com/obsproject/obs-studio/issues/7419) — [macOS ProRes encoders] Failure when remuxing ProRes-encoded .mkv files
**Verdict:** ALREADY_ADDRESSED

The reported failure came from remuxing ProRes into an .mp4 target, and FFmpeg's mp4 muxer rejects ProRes. Auto-remux now chooses a `.mov` target when the video codec is ProRes. In the manual remux dialog the user can edit the output path to .mov. The default suggestion is still .mp4 for .mkv inputs (RemuxQueueModel.cpp:226), which is a minor UX gap but not the reported failure in OBS's own flow.

Evidence:
- frontend/widgets/OBSBasic_Recording.cpp:97-103 — `else if (strcmp(vCodecName, "prores") == 0) output += "mov";`
- frontend/utility/RemuxQueueModel.cpp:226-232 — the manual dialog defaults to .mp4 for non-mov/mp4 inputs.
- frontend/widgets/OBSBasic.cpp:485 — the default recording container is hybrid_mov, which avoids remuxing.

Related: #4740

### [#7549](https://github.com/obsproject/obs-studio/issues/7549) — UHD output to UltraStudio 4K Mini unusable on Intel macOS, fine on M1
**Verdict:** CANNOT_VERIFY

The problem is tied to specific hardware: a Blackmagic Thunderbolt device on an Intel Mac Pro. The same OBS code works on M1 and with a DeckLink card, which points to the driver, bandwidth or GPU readback on that machine. There is no code-level defect to point at.

Evidence:
- plugins/decklink — output path shared across devices. The report itself shows the code works with other hardware.

Related: none

### [#7720](https://github.com/obsproject/obs-studio/issues/7720) — Sparkle fails to update with "Update Error"
**Verdict:** CANNOT_VERIFY

The body has no error detail (the screenshot upload failed) and no repro beyond "update". It is against 28.0.3, and the Sparkle integration and appcast have been updated many times since.

Evidence: none actionable (the body has no error text).

Related: none

### [#7958](https://github.com/obsproject/obs-studio/issues/7958) — Hardware decoding causes media source freeze and crash on exit (Intel Mac)
**Verdict:** CANNOT_VERIFY

The issue needs VideoToolbox hardware decoding of a .webm (VP8/VP9) file on Intel Mac GPUs. It is specific to the GPU and decoder, and the body has no crash stack. The hardware decode init in mp_decode_init is generic FFmpeg hwaccel code, and I found no clear defect.

Evidence:
- shared/media-playback/media-playback/media.c:706-707 — mp_decode_init(..., m->hw).

Related: none

### [#7968](https://github.com/obsproject/obs-studio/issues/7968) — OBS crashes/hangs at launch without second monitor connected
**Verdict:** CANNOT_VERIFY

A third-party plugin (Advanced Scene Switcher) is loaded, the log stops at "ffmpeg_options:", and connecting then disconnecting a monitor works around it. That points to the environment or the plugin. There is no backtrace and no OBS-only repro.

Evidence: no code location identifiable. A third-party plugin is involved.

Related: #8177, #5105

### [#8177](https://github.com/obsproject/obs-studio/issues/8177) — OBS 29 doesn't play nicely with BetterDisplay dummy displays
**Verdict:** CANNOT_VERIFY

A fullscreen projector on a virtual display created by third-party software (BetterDisplay) turns black. Reproducing it needs that tool, and the fault could be in either piece of software. I found no defect in the projector code.

Evidence:
- frontend/utility/platform-osx.mm:110-128 — projector window level handling.

Related: #5105

### [#8320](https://github.com/obsproject/obs-studio/issues/8320) — Screen record freezes on macOS 13.2.1 Ventura
**Verdict:** CANNOT_VERIFY

ScreenCaptureKit capture freezes after a while on M1 Max. This depends on how the OS framework delivers frames over time. When SCK reports an error, OBS already marks capture_failed and offers a Restart button. A silent stall, with no error callback, cannot be fixed without a macOS repro.

Evidence:
- plugins/mac-capture/mac-sck-common.m:29-47 — didStopWithError sets capture_failed.
- plugins/mac-capture/mac-sck-video-capture.m:544-556,592-594 — Restart (reactivate) button.

Related: #7275, #8697, #9056

### [#8697](https://github.com/obsproject/obs-studio/issues/8697) — OBS freezes video after a bit of time
**Verdict:** CANNOT_VERIFY

This is a duplicate of the SCK freeze reports (#8320/#9056). The reporter says a macOS update improved it, which points to the OS framework.

Evidence: same as #8320.

Related: #8320, #9056, #7275

### [#8760](https://github.com/obsproject/obs-studio/issues/8760) — Window capture lag on macOS Ventura ARM
**Verdict:** CANNOT_VERIFY

Moving windows lags while SCK window capture is active. It is a system compositor performance symptom, it is macOS-only, and no OBS code path was identified.

Evidence:
- plugins/mac-capture/mac-sck-video-capture.m:140-162 — window-mode filter setup.

Related: #7275

### [#9056](https://github.com/obsproject/obs-studio/issues/9056) — macOS screen capture freezing after a few hours
**Verdict:** CANNOT_VERIFY

This is the same SCK long-running freeze reported on several Macs, both Intel and Apple Silicon. There is no error callback and no stack, so no code defect can be identified.

Evidence: same as #8320.

Related: #8320, #8697, #7275

### [#9144](https://github.com/obsproject/obs-studio/issues/9144) — Application Capture loses audio when application reopens on macOS
**Verdict:** CANNOT_VERIFY

There is a plausible code-level cause. The application filter is built once from the SCRunningApplication that matches the bundle ID when the stream is created, and nothing in mac-capture watches for the app relaunching. Toggling any setting rebuilds the stream, which matches the reporter's workaround. However, video reportedly keeps working, which means SCK treats audio differently per process. The fix (an NSWorkspace launch observer that calls init_screen_stream again when the bundle ID matches) can only be tested on macOS 13+ with ScreenCaptureKit. The mechanism is not confirmed, so I am not marking it IMPLEMENT.

Evidence:
- plugins/mac-capture/mac-sck-video-capture.m:164-185 — target_application is resolved once from shareable_content.
- plugins/mac-capture/mac-sck-audio-capture.m:85-100 — same pattern for audio-only capture.
- `grep NSWorkspace plugins/mac-capture` returns nothing, so there is no relaunch observer.
- plugins/mac-capture/mac-sck-video-capture.m:423-464 — update() rebuilds the stream, which is why toggling "show cursor" restores audio.

Related: none

### [#9616](https://github.com/obsproject/obs-studio/issues/9616) — OBS crashing when selecting iPhone (Continuity) camera with custom resolution
**Verdict:** CANNOT_VERIFY

There is no crash log, and it needs Continuity Camera hardware. The capture device code (mac-avcapture) has been rewritten since 29.1.3.

Evidence: no stack, so no code location.

Related: none

### [#9641](https://github.com/obsproject/obs-studio/issues/9641) — OBS crashes when quitting with "Reset macOS V-Sync on Exit" enabled
**Verdict:** CANNOT_VERIFY

On exit OBS calls EnableOSXVSync(true), which uses the private QuartzCore symbols CGSSetDebugOptions/CGSDeferredUpdates looked up with dlsym. The crash was reported on macOS 14 beta. The OBS code checks that both symbols resolve before calling them, so the likely cause is a behaviour change in the private API on that OS. Only a macOS 14 repro can confirm it. A possible future slice would be to stop calling these private APIs on macOS 14+ or to remove the option. That needs maintainer-level judgement about whether the option is still meaningful, and it cannot be tested here.

Evidence:
- frontend/utility/platform-osx.mm:137-163 — EnableOSXVSync with the dlsym of private CGS functions and the `valid` check.
- frontend/OBSApp.cpp:2059-2064 — reset call during app teardown, before obs_shutdown.
- frontend/OBSApp.cpp:351-352 — both options default to true.

Related: none
