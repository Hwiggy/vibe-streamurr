# Upstream triage — batch macos-05

- Batch: macos-05 (area hint: macos)
- Items: 12702, 12709, 12742, 12806, 12815, 12892, 12894, 12935, 12940, 13007, 13123, 13131, 13253, 13254, 13262, 13264, 13325, 13435, 13514, 13548
- Date: 2026-10-26
- Base commit: 72e866557 (`git rev-parse --short master`)
- Method: item bodies from `notes/upstream-triage/data/all.json`; code read at master; PR heads at `refs/upstream-pr/N`.
  Local git is 2.33, which has no `merge-tree --write-tree`, so I checked whether each PR applies with
  `git apply --cached --check` against a throwaway index (`GIT_INDEX_FILE`) built from master.
  I used WebFetch twice, on PRs #13007 and #13325, to read the maintainer comments.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 12702 | issue | OUT_OF_SCOPE |
| 12709 | issue | DEFER_LARGE |
| 12742 | issue | OUT_OF_SCOPE |
| 12806 | issue | DEFER_LARGE |
| 12815 | issue | CANNOT_VERIFY |
| 12892 | issue | CANNOT_VERIFY |
| 12894 | PR | ALREADY_ADDRESSED |
| 12935 | issue | CANNOT_VERIFY |
| 12940 | issue | CANNOT_VERIFY |
| 13007 | PR | DEFER_LARGE |
| 13123 | issue | CANNOT_VERIFY |
| 13131 | issue | DEFER_LARGE |
| 13253 | issue | CANNOT_VERIFY |
| 13254 | issue | CANNOT_VERIFY |
| 13262 | issue | CANNOT_VERIFY |
| 13264 | issue | IMPLEMENT |
| 13325 | PR | DEFER_LARGE |
| 13435 | issue | CANNOT_VERIFY |
| 13514 | issue | CANNOT_VERIFY |
| 13548 | issue | CANNOT_VERIFY |

---

### [#12702](https://github.com/obsproject/obs-studio/issues/12702) — macOS: "Failed to create required user directories" on first launch

**Verdict: OUT_OF_SCOPE**

The issue was edited after investigation. It says Logitech software creates `~/Library/Application Support/obs-studio` as root before OBS first runs, so OBS cannot write to its own data directory. The documented workaround is `chown`. The cause is third-party software. OBS already reports the failing path, so OBS has no defect to fix here. The segfault after the error is tracked separately as #12617, which is not in this batch.

Evidence:
- `frontend/OBSApp.cpp:424-432`: `do_mkdir` already shows an error box naming the directory that failed.
- `frontend/OBSApp.cpp:1132-1134`: `AppInit` throws "Failed to create required user directories".
- `frontend/obs-main.cpp:693-696`: the thrown string is logged and shown to the user.

Related: #12617 (crash after this error, not in batch).

### [#12709](https://github.com/obsproject/obs-studio/issues/12709) — Third-party shaders not compatible with new Metal renderer

**Verdict: DEFER_LARGE**

This is a maintainer's meta tracking issue for the Metal shader transpiler (HLSL-style effect to MSL). It names no specific shader construct. The maintainer asks for incompatibilities to be reported to plugin authors first. Improving the transpiler for arbitrary third-party shaders is open-ended work, and there is no small slice.

Evidence:
- `libobs-metal/OBSShader.swift`, `libobs-metal/MetalShader.swift`: the transpiler and shader path live here.
- `libobs-metal/README.md`: the renderer is documented as experimental.

Related: #12935.

### [#12742](https://github.com/obsproject/obs-studio/issues/12742) — [macOS] Window Capture pauses when window is minimized

**Verdict: OUT_OF_SCOPE**

On macOS 26, a minimized window shows only its minimized state through ScreenCaptureKit. The window server stops compositing minimized windows, and OBS only consumes the frames SCK delivers. OBS cannot render content the OS does not produce, so this is an OS limitation. No steps or analysis were given.

Evidence:
- `plugins/mac-capture/mac-sck-video-capture.m:137-163`: window capture uses `initWithDesktopIndependentWindow:`, so frames come entirely from SCK.

### [#12806](https://github.com/obsproject/obs-studio/issues/12806) — HDR max brightness is clipped to ~350 nits on macOS

**Verdict: DEFER_LARGE**

The macOS Screen Capture source is not HDR-aware. It asks SCK for Display P3 frames (`64RGBAHalf` on macOS 15+, otherwise 8-bit BGRA). It never sets an extended or HDR colour space or an HDR dynamic-range configuration. It reports `GS_CS_SRGB_16F` as its colour space, and the draw technique is `DrawD65P3`. Highlights above SDR white therefore never reach the PQ output, which explains the clipping. Fixing this means adding HDR capture to the SCK source: a new colour-space config, new colour-space reporting and shader handling, plus testing on HDR hardware. That is a feature, not a small fix. The VideoToolbox HDR metadata path already handles the peak level correctly.

Evidence:
- `plugins/mac-capture/mac-sck-video-capture.m:203`: `setColorSpaceName:kCGColorSpaceDisplayP3` (not extended or HDR).
- `plugins/mac-capture/mac-sck-video-capture.m:214-218`: pixel format selection.
- `plugins/mac-capture/mac-sck-video-capture.m:669-689`: never returns an HDR colour space (`GS_CS_709_SCRGB`).
- `plugins/mac-capture/mac-sck-video-capture.m:369`: draws with `DrawD65P3`.
- `plugins/mac-videotoolbox/encoder.c:197-236,362-366`: mastering-display and CLLI metadata use `hdr_nominal_peak_level`, so the encoder side is fine.

### [#12815](https://github.com/obsproject/obs-studio/issues/12815) — Blank OBS window after minimize/restore while recording (macOS)

**Verdict: CANNOT_VERIFY**

On macOS 26.1, restoring the minimized main window while recording shows a blank window until the user tries to quit. Nothing in the report points at OBS code. It is likely a Qt/Cocoa redraw problem specific to this OS and setup. It needs a reproduction on macOS 26 and a sample or spindump.

### [#12892](https://github.com/obsproject/obs-studio/issues/12892) — macOS crashes when closing and config not saved

**Verdict: CANNOT_VERIFY**

The report is from an Intel iMac Pro on macOS 14 running 32.0.3: a crash on quit, and the YouTube account link is not saved. There is no crash log, only a normal log. With no stack, the crash cannot be tied to code. The lost config follows from the crash happening before profile and service settings are saved.

### [#12894](https://github.com/obsproject/obs-studio/pull/12894) — mac-capture: Relocate static vars into coreaudio struct

**Verdict: ALREADY_ADDRESSED**

The PR moved the function-static `factor`/`mach_timebase_info` out of `input_callback` into `struct coreaudio_data`. Master has since removed that code: commit d412d64ef ("plugins: Fix build issues in Xcode 26.4") replaced it with `AudioConvertHostTimeToNanos`. No static state remains. The PR no longer applies (`mac-audio.c:438` hunk fails).

Evidence:
- `plugins/mac-capture/mac-audio.c:441`: `audio.timestamp = AudioConvertHostTimeToNanos(ts_data->mHostTime);`
- `git show d412d64ef -- plugins/mac-capture/mac-audio.c`: removes the static `factor`/`info`.

### [#12935](https://github.com/obsproject/obs-studio/issues/12935) — Metal: preview drops to single-digit fps, OBS eventually crashes

**Verdict: CANNOT_VERIFY**

This is on the experimental Metal renderer on an M4 Pro. Moving the window dropped the preview to 1 fps, and OBS crashed 30-40 minutes later. There is no crash log, and the trigger (window move or display change) suggests a swap-chain or drawable problem. It cannot be located in `libobs-metal` without a stack or reproduction.

Evidence: `libobs-metal/OBSSwapChain.swift`, `libobs-metal/metal-swapchain.swift` (the likely area; not confirmed).

Related: #12709.

### [#12940](https://github.com/obsproject/obs-studio/issues/12940) — Glitching when recording with macOS Accessibility Zoom

**Verdict: CANNOT_VERIFY**

With full-screen Accessibility Zoom on, some elements (VST plugin windows, items under the cursor) disappear from the SCK display capture. OBS captures the whole display through a plain `SCContentFilter` with no window exclusions, unless "hide OBS" is set. Whatever SCK omits comes from the OS compositor. There is no log, and it is not reproducible here. It is likely SCK or Accessibility Zoom behaviour rather than OBS code.

Evidence: `plugins/mac-capture/mac-sck-video-capture.m:113-133`: the display filter excludes nothing unless `hide_obs` is set.

### [#13007](https://github.com/obsproject/obs-studio/pull/13007) — mac-capture: Add toggle to hide privacy indicators

**Verdict: DEFER_LARGE**

The PR is small (+55/-14 in 3 files) and applies cleanly to master. However, maintainers on the PR thread raised design and robustness objections:
- Fenrirthviti is against the "hacky workaround" and says the project has asked Apple for a proper solution.
- jcm93 calls the `CGWindowListCopyWindowInfo` lookup of the "StatusIndicator"/"Window Server" window fragile.
- PatTheMav would rather have a generic multi-select window-exclusion list than another checkbox.

There is also a functional gap. The indicator window is looked up once in `init_screen_stream`, before capture starts. The indicator often appears only after capture begins, so it may not be in `shareable_content.windows`, which is fetched with `excludingDesktopWindows:YES`. Without a design decision (and an Apple API), this is not a clean slice.

Evidence:
- `plugins/mac-capture/mac-sck-video-capture.m:113-133`: the current display filter, which the PR rewrites.
- `plugins/mac-capture/mac-sck-common.m:75`: shareable content excludes desktop windows.
- `git apply --cached --check` against master: applies.

### [#13123](https://github.com/obsproject/obs-studio/issues/13123) — EXC_BAD_ACCESS in libqcocoa on settings/menu interaction (macOS 15.6.1)

**Verdict: CANNOT_VERIFY**

The crash happens in Qt's Cocoa platform plugin (`objc_release` inside `QMenu::exec`). It reproduces across 31.1.2, 32.0.4 and 32.1.0, even in safe mode with a fresh profile. That points to Qt or the user's environment (input methods, system extensions) rather than OBS code. Most users do not see it, and no OBS frame in the stack can be fixed.

### [#13131](https://github.com/obsproject/obs-studio/issues/13131) — macOS Screen Capture freezes with error -3821

**Verdict: DEFER_LARGE**

Error -3821 is SCK's `SCStreamErrorSystemStoppedStream`, meaning the OS stopped the stream. OBS deliberately does not recover on its own. `didStopWithError` logs the error, sets `capture_failed`, and enables a manual "Restart capture" button. The user asks for automatic recovery. That is a behaviour and design change: retry policy, backoff, avoiding restart loops, and threading for re-init from the SCK delegate queue. It cannot be tested on this box. The OS-side cause is not something OBS controls.

Evidence:
- `plugins/mac-capture/mac-sck-common.m:29-49`: the delegate logs the error and sets `capture_failed`; there is no retry.
- `plugins/mac-capture/mac-sck-video-capture.m:543-559`: `reactivate_capture`, the manual button.

Related: #13254.

### [#13253](https://github.com/obsproject/obs-studio/issues/13253) — Media Source not showing in Audio Mixer (32.1.0)

**Verdict: CANNOT_VERIFY**

The report blames commit 8bd451184 ("frontend: Ignore sources with disabled audio in mixer"), which filters on `obs_source_audio_active()`. That flag defaults to true when a source is created. Only a few plugins ever clear it: mac-avcapture, obs-browser, win-capture and win-dshow. The media source (obs-ffmpeg) never calls `obs_source_set_audio_active`. The suggested root cause therefore does not match the code. The new mixer also hides inactive or unpreviewed sources unless "show inactive" is on, which may explain what the user saw. There is no log.

Evidence:
- `libobs/obs-source.c:222`: `source->audio_active = true` at creation.
- `libobs/obs-source.c:5746-5762`: setter and getter.
- `frontend/widgets/AudioMixer.cpp:493-496`: the mixer filters on `audio_active`.
- `frontend/widgets/AudioMixer.cpp:510-539`: visibility depends on preview, active and "show inactive".
- `grep obs_source_set_audio_active plugins`: no match in obs-ffmpeg.

### [#13254](https://github.com/obsproject/obs-studio/issues/13254) — Screen Capture of Tencent Meeting freezes until properties opened

**Verdict: CANNOT_VERIFY**

This is app-specific: SCK delivers no new frames for Tencent Meeting until the properties dialog opens. Opening the dialog rebuilds the shareable-content list. There is no log. The body reads as speculative, and the cause is likely SCK's handling of that app's windows. It cannot be reproduced here.

Evidence: `plugins/mac-capture/mac-sck-video-capture.m:471-541`: `content_settings_changed` calls `screen_capture_build_content_list`.

Related: #13131, #13264.

### [#13262](https://github.com/obsproject/obs-studio/issues/13262) — Lag spikes when revealing the menu bar with OBS fullscreen

**Verdict: CANNOT_VERIFY**

With the OBS main window in native fullscreen on macOS 26, revealing the menu bar causes render lag and dropped frames. This is a compositor or display-link interaction with no code pointer. It needs profiling on macOS 26.

### [#13264](https://github.com/obsproject/obs-studio/issues/13264) — Application Capture not restored when OBS starts before the app

**Verdict: IMPLEMENT**

I found the root cause in the code. In application mode, `init_screen_stream` looks up the `SCRunningApplication` that matches `sc->application_id` in `sc->shareable_content`. If the app is not running, the result is `nil`, and `[[NSArray alloc] initWithObjects:nil, nil]` gives an empty include list. The stream then starts with a filter that captures nothing. Nothing ever rebuilds it:
- `sck_video_capture_update` returns early when settings are unchanged.
- The shareable-content list is fetched only in `create` and when the properties dialog changes.

This is why toggling "show cursor" (a settings change, combined with the content refresh triggered by the properties dialog) brings the capture back, as the reporter saw.

Evidence:
- `plugins/mac-capture/mac-sck-video-capture.m:173-184`: the target-application lookup; `nil` gives an empty include list.
- `plugins/mac-capture/mac-sck-video-capture.m:292-293,314`: content is fetched once at create, then `init_screen_stream`.
- `plugins/mac-capture/mac-sck-video-capture.m:443-448`: update returns early when nothing changed.
- `plugins/mac-capture/mac-sck-video-capture.m:543-559`: `reactivate_capture`, the existing destroy and re-init pattern to reuse.
- `plugins/mac-capture/mac-sck-common.m:55-77`: `screen_capture_build_content_list` (async; uses a semaphore).

Slice plan (new change, about 50-70 lines, macOS only):
1. `mac-sck-common.h`: add `id launch_observer;` to `struct screen_capture`.
2. `mac-sck-video-capture.m`, `init_screen_stream`, application case: when `target_application == nil`, log a warning that the application is not running and capture will start when it launches.
3. `mac-sck-video-capture.m`, `sck_video_capture_create`: register a block observer on `[[NSWorkspace sharedWorkspace] notificationCenter]` for `NSWorkspaceDidLaunchApplicationNotification`, on the main queue. In the block, when `sc->capture_type == ScreenCaptureApplicationStream` and the launched app's `bundleIdentifier` equals `sc->application_id`:
   - call `screen_capture_build_content_list(sc, false)`;
   - then `obs_enter_graphics(); destroy_screen_stream(sc); init_screen_stream(sc); obs_leave_graphics();`, the same sequence as `reactivate_capture`.
4. `sck_video_capture_destroy`: remove the observer before tearing the stream down.
5. Optionally limit the re-init to the case where the previous init found no target app, so streams that are already working are left alone.

Test plan: UNTESTED. The code is macOS-only Objective-C (ScreenCaptureKit, NSWorkspace) and cannot be built or run on this Windows x64 box. Run clang-format on the touched files. On macOS, do the manual check from case D: select the app, quit the app, quit OBS, start OBS, start the app, then confirm frames appear.

Related: #13254.

### [#13325](https://github.com/obsproject/obs-studio/pull/13325) — frontend: Avoid hiding floating docks when OBS is not active on macOS

**Verdict: DEFER_LARGE**

The PR is tiny and applies cleanly. It moves the `OBSDock` constructors out of line and sets `Qt::WA_MacAlwaysShowToolWindow`, which is a no-op off macOS. But it is a global behaviour change, and a maintainer disputes it. On the PR thread, PatTheMav says docks are tied to the main window by design. He calls the flag a "cop-out" that would invert expectations for some users. A global switch would need a setting, users want this per dock, and he prefers turning docks into independent windows (as was done for the stats window). That is a UX and design decision, so it is not a clean slice.

Evidence:
- `frontend/docks/OBSDock.hpp:13-14`: inline constructors with no attributes set.
- `git diff master...refs/upstream-pr/13325`: +12/-2 in `OBSDock.cpp/.hpp`; `git apply --check` passes.

Note for this fork: if the owner wants this behaviour anyway, the PR is a trivial cherry-pick, `806b59227`.

### [#13435](https://github.com/obsproject/obs-studio/issues/13435) — Cursor icon laggy with "show cursor" on (macOS 26)

**Verdict: CANNOT_VERIFY**

The cursor is drawn by SCK itself (`setShowsCursor:`). OBS does not composite a cursor in this source. Lag in the cursor image is in SCK's output. It was tried on both renderers with no change. Nothing in OBS code can be identified.

Evidence: `plugins/mac-capture/mac-sck-video-capture.m:202`: `setShowsCursor:!sc->hide_cursor`.

### [#13514](https://github.com/obsproject/obs-studio/issues/13514) — Capture card mapping forgotten after reboot (identical devices)

**Verdict: CANNOT_VERIFY**

The video capture source saves and matches devices by `AVCaptureDevice.uniqueID` (plus `device_name` for display). If three identical Elgato 4K X devices get shuffled after a reboot, their `uniqueID`s are not stable across boots. That is decided by the driver or OS (for UVC devices, usually derived from USB location). OBS already keys on the most stable identifier AVFoundation provides. This needs per-boot logs of each device's uniqueID to confirm, and the hardware is not available here.

Evidence:
- `plugins/mac-avcapture/OBSAVCapture.m:219-224`: settings store `device` = `uniqueID`.
- `plugins/mac-avcapture/OBSAVCapture.m:1152-1163`: reconnect matches on `uniqueID`.
- `plugins/mac-avcapture/plugin-properties.m:251-261`: the device list is keyed on `uniqueID`.

### [#13548](https://github.com/obsproject/obs-studio/issues/13548) — Replay-buffer hotkey from Stream Deck pedal not working when OBS is in background (macOS)

**Verdict: CANNOT_VERIFY**

The keyboard works as a global hotkey, but key events sent by the Stream Deck pedal only work while OBS is focused. One hypothesis fits the code. The global hotkey listener is a listen-only `CGEventTap` at `kCGHIDEventTap`. Synthetic key events that other apps post at the session level (`kCGSessionEventTap`) would not pass through a HID-level tap, yet still reach the focused app through Qt. A candidate one-line change is to create the tap at `kCGSessionEventTap`. I have not confirmed how Stream Deck posts its events, and the change affects every macOS hotkey user, so it is recorded as a hypothesis only. A practical workaround is Stream Deck's OBS integration over obs-websocket.

Evidence:
- `libobs/obs-cocoa.m:588-591`: `CGEventTapCreate(kCGHIDEventTap, kCGHeadInsertEventTap, kCGEventTapOptionListenOnly, ...)`.
- `libobs/obs-cocoa.m:520-543`: `KeyboardEventProc` tracks key state.
