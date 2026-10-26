# Upstream triage: batch macos-02

- Batch: macos-02 (area hint: macos)
- Items: 9658, 9714, 9815, 9832, 9856, 9896, 9901, 9912, 9929, 9970, 10196, 10277, 10278, 10314, 10381, 10403, 10452, 10596, 10636, 10946
- Date: 2026-10-26
- Base commit: 72e866557 (master)
- Method: I read the item bodies from `notes/upstream-triage/data/all.json` and checked the code at master. I used one WebFetch, for the #10381 comment thread.

Summary:

| # | Verdict |
|---|---------|
| 9658 | CANNOT_VERIFY |
| 9714 | DEFER_LARGE |
| 9815 | DEFER_LARGE |
| 9832 | CANNOT_VERIFY |
| 9856 | CANNOT_VERIFY |
| 9896 | IMPLEMENT |
| 9901 | CANNOT_VERIFY |
| 9912 | CANNOT_VERIFY |
| 9929 | CANNOT_VERIFY |
| 9970 | CANNOT_VERIFY |
| 10196 | CANNOT_VERIFY |
| 10277 | CANNOT_VERIFY |
| 10278 | CANNOT_VERIFY |
| 10314 | CANNOT_VERIFY |
| 10381 | CANNOT_VERIFY |
| 10403 | IMPLEMENT |
| 10452 | CANNOT_VERIFY |
| 10596 | CANNOT_VERIFY |
| 10636 | OUT_OF_SCOPE |
| 10946 | CANNOT_VERIFY |

---

### [#9658](https://github.com/obsproject/obs-studio/issues/9658) — [macOS Screen Capture] Incorrect luminance when capturing Rec. 709 (distorted grays)

**Verdict: CANNOT_VERIFY**

The reporter says grays look wrong when they record macOS Screen Capture with Rec. 709 output and look right with sRGB output. The capture code requests Display P3 and converts it to linear Rec. 709 using the sRGB transfer curve. P3 and sRGB have the same white point and transfer curve, so this conversion leaves neutral grays unchanged. The shift therefore happens after capture: OBS's 709 output path does not re-encode with the BT.709 OETF, and players such as QuickTime apply their own gamma to 709-tagged video. That is a design choice that applies to all of OBS output, not a defect specific to the capture source. I found nothing in the source code that has a clear fix.

- `plugins/mac-capture/mac-sck-video-capture.m:203` requests `kCGColorSpaceDisplayP3`
- `plugins/mac-capture/mac-sck-video-capture.m:369` draws with the `DrawD65P3` technique
- `libobs/data/default.effect:139-145` `PSDrawD65P3` converts sRGB-curve to linear, then P3 to 709 primaries (grays are unchanged)

Related: #10403 (same capture color path)

### [#9714](https://github.com/obsproject/obs-studio/issues/9714) — mac-virtualcam: No easy way to uninstall system extension if app is removed without using Finder

**Verdict: DEFER_LARGE**

The plugin only sends an activation request. No code path calls `deactivationRequestForExtension`. The API call the reporter suggests is small, but the change needs a UX decision about where uninstall lives (menu item, settings button or a CLI flag) and how it interacts with an extension that is still in use. That needs maintainer design input. The missing `static` on `OBSDalDestination` is a cosmetic side note.

- `plugins/mac-virtualcam/src/obs-plugin/plugin-main.mm:125-132` only `activationRequestForExtension`
- `plugins/mac-virtualcam/src/obs-plugin/plugin-main.mm:16` non-static `OBSDalDestination`

Related: #9896, #9912, #10381

### [#9815](https://github.com/obsproject/obs-studio/issues/9815) — VST Effect buffer not being flushed

**Verdict: DEFER_LARGE**

The VST host only sends `effMainsChanged` on load and unload. It never resets a plugin's internal state when the parent media restarts, seeks, or the scene changes. As a result, tail audio from delay-type plugins comes back on replay. A fix means choosing which events count as a discontinuity (media restart, seek, deactivate) and hooking parent-source signals from the filter, then suspending and resuming the effect. That is a behavior design decision, and it could break users who rely on continuous effect state across scene switches.

- `plugins/obs-vst/VSTPlugin.cpp:207` resume (`effMainsChanged`, 1) only on load
- `plugins/obs-vst/VSTPlugin.cpp:279` suspend only on unload

### [#9832](https://github.com/obsproject/obs-studio/issues/9832) — OBS Initializes OpenGL on wrong Graphics card at startup if external monitor is connected

**Verdict: CANNOT_VERIFY**

This affects a 2019 Intel MBP with dual GPUs and a DisplayLink dock. GPU selection is done by macOS and CGL, and the DisplayLink driver is involved. The crash needs this hardware to reproduce. No defect can be identified from the code.

- `libobs-opengl/gl-cocoa.m` (CGL context and pixel format setup, not hardware-testable here)

Related: #10277 (also DisplayLink)

### [#9856](https://github.com/obsproject/obs-studio/issues/9856) — Wrong Desktop Space is Recorded With Mac OS Screen Capture

**Verdict: CANNOT_VERIFY**

Display capture records the Space where OBS is shown full screen, and only some of the time. Which content ScreenCaptureKit composites per Space is decided by macOS. OBS only passes a display filter, and nothing in that path selects a Space.

- `plugins/mac-capture/mac-sck-video-capture.m:195-225` stream configuration, no Space handling

### [#9896](https://github.com/obsproject/obs-studio/issues/9896) — Launch param "--startvirtualcam" not working with OBS 30.0.0 on Mac 14.1.1

**Verdict: IMPLEMENT**

The root cause is a race in the code. The output's create function sends an asynchronous system-extension activation request whose delegate callbacks run on the main dispatch queue. Only those callbacks set `delegate.installed = YES`. With `--startvirtualcam`, the frontend queues `StartVirtualCam` on the UI (main) thread during startup. `virtualcam_output_start` then runs before sysextd has replied, sees `installed == NO` with no error, and shows the "not installed" error. Starting the camera manually later works because by then the callback has fired. This matches the report exactly.

- `plugins/mac-virtualcam/src/obs-plugin/plugin-main.mm:262-264` request sent at output create
- `plugins/mac-virtualcam/src/obs-plugin/plugin-main.mm:125-132` request delegate queue is `dispatch_get_main_queue()`
- `plugins/mac-virtualcam/src/obs-plugin/plugin-main.mm:100-118` `installed` set only from async delegate callbacks
- `plugins/mac-virtualcam/src/obs-plugin/plugin-main.mm:301-316` start fails immediately when not yet installed
- `frontend/widgets/OBSBasic_SceneCollections.cpp:1497-1500` `opt_start_virtualcam` queues `StartVirtualCam` at startup

**Slice plan (new-change, about 30 lines, one file):**
1. Add a `dispatch_semaphore_t finished` and a `BOOL pending` flag to `SystemExtensionActivationDelegate`.
2. Submit the activation request on a private serial queue (`dispatch_queue_create`) instead of the main queue, so the callbacks do not need the main thread, which `start` occupies.
3. Signal the semaphore in `didFinishWithResult`, `didFailWithError` and `requestNeedsUserApproval`, and clear `pending` there.
4. In `virtualcam_output_start`, if `!installed && pending`, wait on the semaphore with a bounded timeout (about 5 s) before running the existing checks.

The properties are atomic by default, so reading them across threads is safe. Platform: macOS only. Test: none possible on this Windows box, so mark it UNTESTED in the commit and run clang-format on the `.mm` file.

Related: #9912, #10381, #9714

### [#9901](https://github.com/obsproject/obs-studio/issues/9901) — USB Capture Card Garbled Audio (Mac)

**Verdict: CANNOT_VERIFY**

Crackly audio from a CamLink or DeckLink fed by an ATEM. This depends on the device, sample format and clock, and needs the hardware. The report has no code-level detail.

- `plugins/mac-avcapture/OBSAVCapture.m` (audio sample handling, cannot test without device)

### [#9912](https://github.com/obsproject/obs-studio/issues/9912) — [BUG-Mac] Failed to start "Virtual Camera" sometime on macOS 14.1

**Verdict: CANNOT_VERIFY**

"Could not find virtual camera" is the CameraUnavailable error. It appears when the CMIO device list has no device with the OBS camera UUID even though the extension is activated. Since then, master compares UUIDs with CFUUID (commit 552a88a89), which removes one possible cause: a string mismatch. The remaining cases are intermittent extension-process or registration problems inside macOS, and no reproduction is available.

- `plugins/mac-virtualcam/src/obs-plugin/plugin-main.mm:385-416` device lookup and `Error.SystemExtension.CameraUnavailable`
- commit 552a88a89 "mac-virtualcam: Compare camera UUIDs using CFUUID"

Related: #10381, #9896

### [#9929](https://github.com/obsproject/obs-studio/issues/9929) — [BUG-Mac] Crash when exiting/quit. Cannot interact with menus after

**Verdict: CANNOT_VERIFY**

The report is a crash on quit plus menus that stop responding. The crash report is a Dropbox `.ips` file that is not available here, and no stack is quoted. With no actionable stack, I cannot locate a defect.

Related: #9970

### [#9970](https://github.com/obsproject/obs-studio/issues/9970) — [MacOS] UI not working properly

**Verdict: CANNOT_VERIFY**

Popups and dialogs don't open and the app hangs on close (Sonoma). The symptoms are the same as #9929. There is no stack or sample, and environment-specific causes (third-party window or menu-bar utilities, Qt and macOS interaction) cannot be ruled out from the code.

Related: #9929

### [#10196](https://github.com/obsproject/obs-studio/issues/10196) — Chroma Key for Mac OS window capture broken

**Verdict: CANNOT_VERIFY**

This only happens with a Flash Player window in Window Capture mode. Display and application capture work, as do other windows. That points to how ScreenCaptureKit delivers that specific window's surface (alpha or partial updates), not to the chroma-key filter. It cannot be reproduced without that app.

- `plugins/mac-capture/mac-sck-video-capture.m:200-204` clear background color, window stream config

Related: #10403

### [#10277](https://github.com/obsproject/obs-studio/issues/10277) — "macOS Screen Capture" Freeze & Beachball when switching Display

**Verdict: CANNOT_VERIFY**

OBS freezes when the user switches to a display while DisplayLink-driven monitors are attached. This is specific to the third-party DisplayLink driver, and I found no defect in the display-switch code that does not depend on that driver.

Related: #9832

### [#10278](https://github.com/obsproject/obs-studio/issues/10278) — obs preview and streaming exists color difference on macos because force use SRGB color space

**Verdict: CANNOT_VERIFY**

OBS tags the main window and projector windows as sRGB. The reporter wants this removed because Qt 6 fixed QTBUG-47660. Tagging the window sRGB makes macOS color-manage OBS's sRGB-intended render to the display profile, which is arguably the correct preview of an sRGB stream. Removing the tag would show untagged values in display space instead. Whether the preview is "wrong" depends on the display profile and the viewer, and the reporter gave no measurements. Changing it is a policy decision that needs testing on calibrated Mac hardware.

- `frontend/utility/platform-osx.mm:107-111` `disableColorSpaceConversion` sets `NSColorSpace.sRGBColorSpace`
- `frontend/widgets/OBSBasic.cpp:1153-1155` called for the main window
- `libobs-opengl/gl-cocoa.m:226-228` same for projector views

### [#10314](https://github.com/obsproject/obs-studio/issues/10314) — Python 3.11.8 doesn't load with OBS 30.0.2 on macOS

**Verdict: CANNOT_VERIFY**

OBS loads `<path>/Python.framework/Versions/X.Y/lib/libpythonX.Y.dylib` and supports Python up to 3.12. The failure appeared after a Homebrew upgrade, and the reporter worked around it with a pyenv framework build. That points to the Homebrew layout or path the user selected, not to the loader. This is user configuration, and the log is not available to confirm.

- `shared/obs-scripting/obs-scripting-python-import.c:36-42` macOS file pattern and version cap
- `shared/obs-scripting/obs-scripting-python.c:1610` framework path construction

### [#10381](https://github.com/obsproject/obs-studio/issues/10381) — Virtual Camera does not start on macOS in OBS 30.1.0 after updating OBS

**Verdict: CANNOT_VERIFY**

The thread, read with one WebFetch, shows the "Could not find virtual camera" error after an OBS update. The workarounds are logging out, rebooting, reinstalling, or toggling the extension in Login Items & Extensions. Maintainers suspected the macOS system-extension update process. No root cause or fix was confirmed. The plugin already always replaces the extension on version mismatch, so the remaining failure is in macOS extension handling and registration.

- `plugins/mac-virtualcam/src/obs-plugin/plugin-main.mm:66-75` always returns Replace on version mismatch
- `plugins/mac-virtualcam/src/obs-plugin/plugin-main.mm:414-416` CameraUnavailable path

Related: #9912, #9896

### [#10403](https://github.com/obsproject/obs-studio/issues/10403) — [macOS] macOS Screen Capture + Color Correction Effect Filter causes unintended color changes

**Verdict: IMPLEMENT**

The root cause is in the code. macOS Screen Capture prefers `GS_CS_SRGB_16F` and converts Display P3 to linear Rec. 709. Saturated P3 colors outside the Rec. 709 gamut become negative components. The color correction filter lists `GS_CS_SRGB_16F` as acceptable, so it receives those negative values, and its shader runs `pow(rgb, gamma)` unconditionally, even with the default gamma 0, which maps to exponent 1.0. On GPUs, `pow` with a negative base is undefined and returns NaN, so those regions render black. This matches the report: only saturated regions darken, only with this capture source, and not with the legacy captures, which are 8-bit sRGB.

- `plugins/mac-capture/mac-sck-video-capture.m:669-688` returns `GS_CS_SRGB_16F` when acceptable
- `libobs/data/default.effect:139-145` P3 to 709 conversion (out-of-gamut gives negatives)
- `plugins/obs-filters/color-correction-filter.c:575-587` accepts `GS_CS_SRGB_16F` source space
- `plugins/obs-filters/color-correction-filter.c:115-117` gamma 0 maps to exponent 1.0, so `pow` still runs
- `plugins/obs-filters/data/color_correction_filter.effect:53` `currentPixel.rgb = pow(currentPixel.rgb, float3(gamma, gamma, gamma));`
- Existing pattern: `libobs/data/color.effect:56,67` uses `pow(abs(x), ...)` to avoid negative bases

**Slice plan (new-change, about 3 lines, one file):** In `PSColorFilterRGBA`, replace the gamma line with a sign-preserving power: `currentPixel.rgb = sign(currentPixel.rgb) * pow(abs(currentPixel.rgb), float3(gamma, gamma, gamma));`. This keeps the in-gamut result the same and stops NaNs for extended-range input. The same issue can affect any 16F source with negative components on any platform. Test on Windows: build `obs-filters`, add a Color Correction filter to an SDR source and confirm it renders the same at default and non-default gamma (the shader compiles under D3D11). The macOS-specific path is UNTESTED.

Related: #9658, #10196

### [#10452](https://github.com/obsproject/obs-studio/issues/10452) — Virtual Camera does not display on macOS with I420 Color Format and Full Color Range

**Verdict: CANNOT_VERIFY**

With I420 and full range, the plugin maps the output to `kCVPixelFormatType_420YpCbCr8PlanarFullRange` ('f420') and sends that format into the CMIO stream. NV12 ('420f'), the format the reporter says works, is the one consumers widely support. The likely cause is that consuming apps do not accept 'f420' (the code comment already notes that some CoreVideo formats are not fully usable), but I cannot confirm on macOS that 'f420' is rejected rather than broken in the copy path. Candidate slice if confirmed: have `convert_video_format_to_mac` return 0 for I420 so it uses the existing CPU-to-NV12 fallback (about 4 lines).

- `plugins/mac-virtualcam/src/obs-plugin/plugin-main.mm:226-246` format mapping
- `plugins/mac-virtualcam/src/obs-plugin/plugin-main.mm:345-353` existing NV12 fallback
- `plugins/mac-virtualcam/src/obs-plugin/plugin-main.mm:482-525` plane copy

### [#10596](https://github.com/obsproject/obs-studio/issues/10596) — [macOS] OBS crash on startup when system volume is running low on free space

**Verdict: CANNOT_VERIFY**

ScreenCaptureKit stops delivering frames, and OBS crashes at startup (even in safe mode) when free disk space is low. The reporter links a similar ScreenCaptureKit failure in another project. There is no crash stack in the body, and the trigger is random. This looks like an OS-level ScreenCaptureKit failure, and no defect can be identified in OBS code without a stack.

### [#10636](https://github.com/obsproject/obs-studio/issues/10636) — macOS Screen Capture performance degradation in macOS Sonoma

**Verdict: OUT_OF_SCOPE**

The issue says itself that it is a public tracker for an Apple-side regression (FB13691162) in ScreenCaptureKit on Sonoma. The fix belongs to Apple, and OBS has nothing to change locally.

### [#10946](https://github.com/obsproject/obs-studio/issues/10946) — Mac mystery crash: variety of routes

**Verdict: CANNOT_VERIFY**

Crashes on macOS when profiles are listed or switched through obs-websocket. One plausible hazard: `obs_frontend_get_profiles` iterates `OBSBasic`'s profile cache from the websocket thread without synchronization, while the UI thread may rebuild it during a profile switch. `obs_frontend_set_current_profile` triggers QActions directly. However, the reporter also sees crashes on the first call with no switching and gives no crash stack. The reports do not support declaring that race the root cause.

- `frontend/OBSStudioAPI.cpp:171-178` unsynchronized iteration of the profile cache
- `frontend/OBSStudioAPI.cpp:193-209` set_current_profile triggers menu actions
- `plugins/obs-websocket/src/requesthandler/RequestHandler_Config.cpp:223-227,252-260` GetProfileList on the websocket thread, set queued as `OBS_TASK_UI`
