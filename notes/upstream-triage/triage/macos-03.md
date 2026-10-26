# Upstream triage — batch macos-03

- Batch: macos-03 (area hint: macos)
- Items: 11005, 11026, 11087, 11202, 11222, 11240, 11281, 11312, 11332, 11435, 11522, 11561, 11563, 11571, 11750, 11782, 11830, 11873, 11884, 11915
- Date: 2026-10-26
- Base commit: 72e866557 (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`, PR heads from `refs/upstream-pr/N`, code read at master. No GitHub API / WebFetch used.
- Note: local git is 2.33, which lacks `merge-tree --write-tree`; PR applicability was checked by comparing the PR's context lines against master by hand (both PRs in this batch are 1-2 line changes whose context is unchanged on master).

Summary:

| # | Kind | Verdict |
|---|------|---------|
| 11005 | issue | IMPLEMENT (label fix) |
| 11026 | issue | CANNOT_VERIFY |
| 11087 | PR | IMPLEMENT (cherry-pick) |
| 11202 | issue | DEFER_LARGE |
| 11222 | issue | ALREADY_ADDRESSED |
| 11240 | issue | IMPLEMENT |
| 11281 | issue | CANNOT_VERIFY |
| 11312 | issue | CANNOT_VERIFY |
| 11332 | issue | CANNOT_VERIFY |
| 11435 | issue | CANNOT_VERIFY |
| 11522 | issue | CANNOT_VERIFY |
| 11561 | issue | CANNOT_VERIFY |
| 11563 | issue | CANNOT_VERIFY |
| 11571 | issue | CANNOT_VERIFY |
| 11750 | issue | OUT_OF_SCOPE |
| 11782 | PR | IMPLEMENT (partial-pr) |
| 11830 | issue | OUT_OF_SCOPE (works as designed) |
| 11873 | issue | IMPLEMENT |
| 11884 | issue | CANNOT_VERIFY |
| 11915 | issue | IMPLEMENT |

---

### [#11005](https://github.com/obsproject/obs-studio/issues/11005) — Inconsistent screen detected resolution on MacOS

**Verdict: IMPLEMENT** (small label fix)

Reasoning: The reporter sees three numbers: 2560x1600 (native panel, from System Settings), 1440x900 (macOS Screen Capture display list) and 2880x1800 (auto-config wizard). 2880x1800 is the real backing-store size, and the wizard multiplies by `devicePixelRatio`. The SCK capture itself also captures in pixels (`CGDisplayModeGetPixelWidth`). Only the display picker label uses `NSScreen.frame`, which is in points, so it shows half of what will actually be captured. The 2560x1600 native-panel number comes from the OS's scaled "looks like" mode, so OBS can't make that one match. The defect is the label: it doesn't match the size OBS really captures.

Evidence:
- `plugins/mac-capture/mac-sck-common.m:106-107`: label width and height come from `display_screen.frame.size` (points).
- `plugins/mac-capture/mac-sck-video-capture.m:98-99`: the capture size is `CGDisplayModeGetPixelWidth/Height` (pixels).
- `frontend/wizards/AutoConfigVideoPage.cpp:61-62`: the wizard scales by `devicePixelRatio` (pixels).

Slice plan: in `mac-sck-common.m` (display list build), multiply the width/height by `display_screen.backingScaleFactor` before formatting the label. Leave the origin (`@ x,y`) in points, because that is the global coordinate space. About 4 changed lines. The stored setting is the display UUID, so saved scenes are unaffected.
Test plan: macOS-only Objective-C. It can't be built or run on this Windows box, so it is UNTESTED.

Related: none.

---

### [#11026](https://github.com/obsproject/obs-studio/issues/11026) — Code signing validation error when installing virtual camera on macOS

**Verdict: CANNOT_VERIFY**

Reasoning: The error comes from `OSSystemExtensionManager` during camera extension activation, and OBS only relays it. The install came through the Homebrew cask, a third-party distribution channel that repackages the official DMG. A code-signing validation failure points to the bundle's signature or location on that machine, not to OBS logic. The code already handles the "wrong location" error separately and surfaces every other error verbatim. Without the system extension log there is nothing to fix in code.

Evidence:
- `plugins/mac-virtualcam/src/obs-plugin/plugin-main.mm:79-99`: `didFailWithError` maps `OSSystemExtensionErrorUnsupportedParentBundleLocation` to a localized message and logs other codes verbatim.
- `plugins/mac-virtualcam/src/obs-plugin/plugin-main.mm:300-314`: the installation error is shown to the user.

Related: #11571, #11750.

Side observation (not this issue): `plugin-main.mm:330` passes the raw key `"Error.DAL.NotInstalled"` to `obs_output_set_last_error` without `obs_module_text()`, so the legacy DAL path would show the untranslated key. That is a one-line fix worth folding into any virtualcam touch-up.

---

### [#11087](https://github.com/obsproject/obs-studio/pull/11087) — mac-capture: Log source name on coreaudio initialization

**Verdict: IMPLEMENT** (cherry-pick-pr)

Reasoning: This is a one-line logging tweak that adds the source name to the CoreAudio "Device initialized" log line. Upstream already did the same for WASAPI. It helps support people map devices to sources from a log. The PR's context line is unchanged on master (`mac-audio.c:686`), so it applies cleanly at a shifted offset. `ca->source` is set by create before init.

Evidence:
- `plugins/mac-capture/mac-audio.c:686`: the current log line has no source name.
- PR diff: replaces that line with a version that appends `(source: %s)` from `obs_source_get_name(ca->source)`.

Slice plan: `git cherry-pick refs/upstream-pr/11087` (commit eb55964fb, author Penwy, GPL-2.0-or-later). 2 lines.
Test plan: macOS-only C file (built only on macOS). It can't be compiled here, so it is UNTESTED. The change is trivially type-correct (`const char *` for `%s`).

Related: none.

---

### [#11202](https://github.com/obsproject/obs-studio/issues/11202) — OBS 30.2.X font is much harder to read with high pixel density on a Macbook

**Verdict: DEFER_LARGE** (design decision)

Reasoning: Since 30.2 the Yami theme deliberately puts the bundled 'Open Sans' first in the font stack, ahead of the system font. The reporter wants the system font back, possibly as an option. That is a theme and UX choice upstream made on purpose. Adding a font-family preference (settings UI, plumbing it into the theme variables) needs a design decision, so it isn't a bug fix. Two workarounds already exist: the font size scale setting (`obsFontScale`), and a user-installed theme variant (.ovt) can override `font-family`.

Evidence:
- `frontend/data/themes/Yami.obt:596`: `font-family: 'Open Sans', '.AppleSystemUIFont', Helvetica, Arial, 'MS Shell Dlg', sans-serif;`
- `frontend/obs-main.cpp:537-539`: Open Sans is registered as an application font.
- `frontend/data/themes/Yami.obt:123,135`: font size is already scalable via `--obsFontScale` (larger on macOS).

Related: #11915.

---

### [#11222](https://github.com/obsproject/obs-studio/issues/11222) — Issue with Multi-Channel Audio Input on macOS with Aggregate Device

**Verdict: ALREADY_ADDRESSED**

Reasoning: The CoreAudio input source already reads the device's full input channel count and channel names, and its properties show a per-output-channel mapping list where any device input channel can be chosen. The number of *output* channels follows the OBS speaker layout (stereo by default), which is why the reporter "sees only stereo". The supported way to pick specific channels of a multi-channel aggregate device is the existing channel map, using several sources if needed. Carrying arbitrary N channels independently through the mixer would be a core audio architecture change.

Evidence:
- `plugins/mac-capture/mac-audio.c:289-294`: `available_channels` comes from the device stream format, and channel names are fetched.
- `plugins/mac-capture/mac-audio.c:296-323`: downmix and channel-map application.
- `plugins/mac-capture/mac-audio.c:883-940`: properties list every input channel for each output channel.

Related: none.

---

### [#11240](https://github.com/obsproject/obs-studio/issues/11240) — macos Audio Capture Device crash steps 100%.

**Verdict: IMPLEMENT**

Reasoning: The reporter's analysis is correct and the root cause is clear in the code:
1. In `WidgetInfo::ControlChanged`, `view->visUpdateCb(obj, settings)` is `obs_source_update` for the Properties dialog.
2. For an audio-only source (no `OBS_SOURCE_VIDEO`), `obs_source_update` calls the source's `update` synchronously on the UI thread.
3. macOS Audio Capture's update calls `init_audio_screen_stream`. After the stream was stopped from the menu bar, `capture_failed` is set, so that function calls `obs_source_update_properties`.
4. That emits `update_properties`, and `OBSBasicProperties::UpdateProperties` handles it with `QMetaObject::invokeMethod(...)` and no connection type. Because the emit happens on the UI thread, AutoConnection runs `ReloadProperties` *directly*.
5. `ReloadProperties` replaces `properties` (freeing the old `obs_properties_t`) and `RefreshProperties` runs `children.clear()`, which destroys the `WidgetInfo` that is still running `ControlChanged`.
6. Back in `ControlChanged`, the following `view->SignalChanged()` and `obs_property_modified(property, ...)` use freed memory, and OBS crashes.

The fix is to make the reload always queued, which is what every other reload path in the view already does.

Evidence:
- `shared/properties-view/properties-view.cpp:2124-2135`: visUpdateCb, then use of `property` and `this`.
- `libobs/obs-source.c:1112-1116`: synchronous update for non-video sources.
- `plugins/mac-capture/mac-sck-audio-capture.m:58-63, 286-297`: update leads to init, which calls `obs_source_update_properties` when `capture_failed`.
- `plugins/mac-capture/mac-sck-common.m:47-48`: the stream-stopped delegate sets `capture_failed`.
- `frontend/dialogs/OBSBasicProperties.cpp:290-293`: invokeMethod with the default (Auto) connection.
- `frontend/dialogs/OBSBasicFilters.cpp:277-280`: same pattern for the filters dialog.
- `shared/properties-view/properties-view.cpp:94-120`: Reload frees the properties and clears `children` (`std::vector<std::unique_ptr<WidgetInfo>>`, `properties-view.hpp:100`).
- `shared/properties-view/properties-view.cpp:212,227,239`: other reload paths already use `Qt::QueuedConnection`.

Slice plan: add `Qt::QueuedConnection` to the `invokeMethod` calls in `OBSBasicProperties::UpdateProperties` and `OBSBasicFilters::UpdateProperties`. 2 lines in 2 files, and it is cross-platform.
Test plan: build the `obs-studio` frontend target with MSVC on Windows (compile check). Behaviorally, open the Properties of any source and change settings to confirm properties still refresh. The specific crash repro needs macOS, so the crash fix itself is UNTESTED.

Related: none.

---

### [#11281](https://github.com/obsproject/obs-studio/issues/11281) — [macOS]: Twitch frame judder when OBS is hidden

**Verdict: CANNOT_VERIFY**

Reasoning: The reporter suspects App Nap, but OBS already disables App Nap through `LSAppNapIsDisabled` in its Info.plist, and libobs has a `beginActivityWithOptions` helper. Render lag while the app is hidden is probably macOS GPU or compositor scheduling for hidden apps. That can't be pinned to a code defect without profiling on the reporter's hardware (M1 Ultra).

Evidence:
- `frontend/cmake/macos/Info.plist.in:9-10`: `LSAppNapIsDisabled` = true.
- `libobs/util/platform-cocoa.m:223-238`: `os_request_high_performance` uses `NSActivityUserInitiated`.

Related: none.

---

### [#11312](https://github.com/obsproject/obs-studio/issues/11312) — [macOS]: When OBS is running, Caps Lock switches to last app, despite no hotkeys set in OBS

**Verdict: CANNOT_VERIFY**

Reasoning: The OBS hotkey event tap is created with `kCGEventTapOptionListenOnly` and returns events unchanged. A listen-only tap can't inject, modify, or swallow events, so OBS can't cause an app switch by this path. The Caps Lock to "switch to last app" behaviour is a macOS feature (Caps Lock input-source switching, or a third-party remapper) that may interact with any active event tap. There's no defect in the OBS code, and it isn't reproducible here.

Evidence:
- `libobs/obs-cocoa.m:588-591`: `CGEventTapCreate(kCGHIDEventTap, kCGHeadInsertEventTap, kCGEventTapOptionListenOnly, ...)`.
- `libobs/obs-cocoa.m:510-543`: the callback only records key state and `return event;`.

Related: none.

---

### [#11332](https://github.com/obsproject/obs-studio/issues/11332) — No media when streaming with RTMP + Apple VT HEVC Hardware Encoder

**Verdict: CANNOT_VERIFY**

Reasoning: HEVC over RTMP uses Enhanced RTMP (FourCC `hvc1`), which only some receivers support, and the receiver here is a custom server. The rtmp-stream code path is codec-generic, and HEVC packets go through `obs_parse_hevc_packet`. The only rtmp-vs-rtmps difference in rtmp-stream is the socket-loop selection, not the codec handling. Nothing in the code shows the cause. It needs the receiver side and a packet capture.

Evidence:
- `plugins/obs-outputs/rtmp-stream.c:814-816, 1868-1870`: HEVC header/packet handling.
- `plugins/obs-outputs/rtmp-stream.c:1486`: `rtmps://` only affects the socket loop.

Related: none.

---

### [#11435](https://github.com/obsproject/obs-studio/issues/11435) — macOS screen capture freezes randomly

**Verdict: CANNOT_VERIFY**

Reasoning: ScreenCaptureKit sometimes stops delivering frames without reporting an error. OBS's "Restart Capture" button is enabled only when the SCK delegate reports `didStopWithError` (which sets `capture_failed`). That explains the reporter's observation that the button is greyed out. Detecting a silent stall would need a frame watchdog, which is new behaviour rather than a fix. The root cause is in the OS framework and isn't reproducible here.

Evidence:
- `plugins/mac-capture/mac-sck-common.m:25-49`: only the error delegate sets `capture_failed` and refreshes properties.

Related: #11563.

---

### [#11522](https://github.com/obsproject/obs-studio/issues/11522) — The video is distorted when streaming to Twitch WHIP with VideoToolbox H264 Software Encoder

**Verdict: CANNOT_VERIFY**

Reasoning: The reporter says B-frames are unchecked, so this isn't the same as the B-frame override bug fixed by #11782. It may involve the VT *software* encoder's output (for example slice or parameter-set layout) combined with the WebRTC packetizer, but there's no code-level evidence. RTMP and recording work. It needs a WHIP repro on macOS.

Evidence:
- `plugins/obs-webrtc/whip-service.cpp:27-34`: WHIP forces `bf=0` and `repeat_headers`.
- `plugins/mac-videotoolbox/encoder.c:749`: the VT B-frame key is the bool `bframes`.

Related: #11782.

---

### [#11561](https://github.com/obsproject/obs-studio/issues/11561) — MacOS Screen Capture/Audio Capture no longer works for Facetime after upgrading & downgrading

**Verdict: CANNOT_VERIFY**

Reasoning: The reporter says it works with Discord but not FaceTime, and it changed while the OBS version stayed the same. That points to macOS (FaceTime audio routing or privacy handling in ScreenCaptureKit audio), not an OBS regression. There's nothing actionable in the code.

Evidence:
- `plugins/mac-capture/mac-sck-audio-capture.m:58-...`: plain SCK application/display audio capture with no per-app special-casing.

Related: none.

---

### [#11563](https://github.com/obsproject/obs-studio/issues/11563) — Desktop switch is glitching on MacOS

**Verdict: CANNOT_VERIFY**

Reasoning: The report is a video-only description of glitches when switching Spaces while capturing an Opera window with SCK window capture. There's no log, and the behaviour comes from how ScreenCaptureKit delivers frames for windows on other Spaces. No defect can be identified in the code.

Evidence:
- `plugins/mac-capture/mac-sck-common.m:260-295`: window frame resize handling (the only OBS-side logic involved).

Related: #11435.

---

### [#11571](https://github.com/obsproject/obs-studio/issues/11571) — Failed to enable camera extension for virtual camera

**Verdict: CANNOT_VERIFY**

Reasoning: The failure happens in macOS System Settings ("Failed to enable" when toggling the extension under Login Items & Extensions). That is outside OBS's process. OBS already shows a macOS 15-specific instruction pointing to the right settings pane.

Evidence:
- `plugins/mac-virtualcam/src/obs-plugin/plugin-main.mm:308-313`: macOS 15-specific "not installed" message.
- `plugins/mac-virtualcam/src/obs-plugin/plugin-main.mm:117-121`: `requestNeedsUserApproval` is only logged.

Related: #11026, #11750.

---

### [#11750](https://github.com/obsproject/obs-studio/issues/11750) — Cannot uninstall the OBS virtual camera on MacOS Sonoma

**Verdict: OUT_OF_SCOPE**

Reasoning: Removing a camera system extension is managed by macOS. Deleting the containing app from /Applications in Finder triggers the OS's extension removal. Manual removal (`systemextensionsctl`) is an OS/admin task. OBS has no uninstaller and no deactivation request, and it can't act after the app has been deleted. Which camera other apps choose by default is up to those apps and macOS. This is a support question about OS behaviour.

Evidence:
- `plugins/mac-virtualcam/src/obs-plugin/plugin-main.mm:127-132`: only an activation request is submitted. There's no deactivation path anywhere (a grep for `deactivationRequest` finds nothing).

Related: #11026, #11571.

---

### [#11782](https://github.com/obsproject/obs-studio/pull/11782) — obs-webrtc: Add "bframes" key override for mac VT encoder

**Verdict: IMPLEMENT** (partial-pr: same fix, correct type)

Reasoning: WHIP forces B-frames off by setting `"bf"` = 0, but the VideoToolbox encoder reads a *bool* setting `"bframes"` (default true). With VT, WHIP streams therefore still contain B-frames, which WebRTC peers don't handle. QSV already works around the same key mismatch. The PR sets `"bframes"` with `obs_data_set_int(..., 0)`. That works only by accident: `obs_data_setdata` changes the item type to NUMBER, and `obs_data_get_bool` then returns false because of the type mismatch. It also leaves the stored setting with the wrong type. Use `obs_data_set_bool(video_settings, "bframes", false)` instead. The PR's context is unchanged on master.

Evidence:
- `plugins/obs-webrtc/whip-service.cpp:27-34`: only `"bf"` is overridden.
- `plugins/mac-videotoolbox/encoder.c:749, 1294, 1388`: `bframes` is a bool property with default true.
- `plugins/obs-qsv11/obs-qsv11.c:459-464`: QSV maps `"bf"` onto `"bframes"`.
- `libobs/obs-data.c:1662-1665, 1708-1713`: `item_valid` type check, so get_bool on a NUMBER item returns false.

Slice plan: in `WHIPService::ApplyEncoderSettings`, add `obs_data_set_bool(video_settings, "bframes", false);` with a comment, crediting PR #11782 (author per `git log refs/upstream-pr/11782`) in the commit body. 2 lines.
Test plan: build the `obs-webrtc` plugin on Windows (MSVC). The behavioural effect only matters for the macOS VT encoder, so it is UNTESTED. Optionally check on Windows that WHIP with QSV still starts.

Related: #11522 (different symptom; B-frames were off there).

---

### [#11830](https://github.com/obsproject/obs-studio/issues/11830) — Opposite CRF Behavior with Apple VT HEVC Encoder on macOS

**Verdict: OUT_OF_SCOPE** (works as designed)

Reasoning: In "CRF" mode the VT encoder doesn't take a CRF number. It uses the `quality` slider (0-100, labelled "Quality"), divides it by 100, and passes it to VideoToolbox's `kVTCompressionPropertyKey_Quality`, where higher means better quality and larger files. The reporter's results (a higher value gives more bitrate) are the documented semantics of that property. The only confusing part is the rate-control label "CRF", and renaming it is a UX decision. There's no defect.

Evidence:
- `plugins/mac-videotoolbox/encoder.c:744`: `enc->quality = quality / 100`.
- `plugins/mac-videotoolbox/encoder.c:302-305`: CRF sets the float compression property (Quality).
- `plugins/mac-videotoolbox/encoder.c:1262, 1380`: "Quality" slider 0-100, default 60.

Related: none.

---

### [#11873](https://github.com/obsproject/obs-studio/issues/11873) — Configured macOS Audio Capture Sync Offset Not Recognized on Restart

**Verdict: IMPLEMENT**

Reasoning: In `source_output_audio_data`, when the sync offset changes, the guard `if (source->last_sync_offset) push_back = false;` forces the timestamp-honouring "place" path only if the *previous* offset was non-zero. A change from 0 to X while audio is already flowing contiguously keeps `push_back = true`. `source_output_audio_push_back` appends samples without looking at `in.timestamp`, so the new offset is silently ignored until the next discontinuity.

On load, `obs_load_source` creates the source first and only then calls `obs_source_set_sync_offset`. macOS Audio Capture starts its SCK stream in create, so audio arriving before the offset is set produces exactly this 0 to X transition. Changing the offset afterwards (X to Y, non-zero to non-zero) takes the place path. That matches the reporter's workaround exactly, and it also explains why typing a value into the spinbox normally "works" (intermediate values make later changes non-zero to non-zero).

The guard dates from 2016 (41fa9c1bd, "Don't include sync offsets in TS smoothing"). Removing it only forces one `place` per offset change, which is always correct. On the first packet `push_back` is already false, so behaviour there is unchanged.

Evidence:
- `libobs/obs-source.c:1675-1690`: offset applied to `in.timestamp`, the guard, then push_back vs place.
- `libobs/obs-source.c:1576-1592`: push_back ignores the timestamp.
- `libobs/obs.c:2293, 2313-2314`: create, then set sync offset.
- `plugins/mac-capture/mac-sck-audio-capture.m:197`: create starts the stream immediately.

Slice plan: in `libobs/obs-source.c`, change the block to `if (source->last_sync_offset != sync_offset) { push_back = false; source->last_sync_offset = sync_offset; }`. 2 changed lines, cross-platform core.
Test plan: build `libobs` with MSVC. The cmocka tests don't cover audio timing. Manual check on Windows: set an Audio Input Capture sync offset of 0, start a recording, change the offset to 500 ms with one paste (no intermediate values), and confirm the offset applies (clap test). The mac-specific restart repro is UNTESTED.

Related: none.

---

### [#11884](https://github.com/obsproject/obs-studio/issues/11884) — OBS Studio quit unexpectedly

**Verdict: CANNOT_VERIFY**

Reasoning: The report is a crash on quit while a YouTube account is connected (browser-based OAuth/CEF docks), with only a screenshot of the macOS crash dialog and no symbolicated crash report. The shutdown order of the YouTube integration and CEF is complex, and with no stack there's no defect to identify.

Evidence:
- `frontend/oauth/` and the YouTube integration under `frontend/`: shutdown path involved, but no stack to match.

Related: none.

---

### [#11915](https://github.com/obsproject/obs-studio/issues/11915) — Populating font family aliases took 320 ms. Replace uses of missing font family "MS Shell Dlg"

**Verdict: IMPLEMENT**

Reasoning: The only font stack used on macOS that names 'MS Shell Dlg' is the global `QWidget` rule in Yami.obt. (`OBSUpdate.ui` and `updater.rc` are Windows-updater-only.) On macOS that family doesn't exist, so Qt populates font aliases at startup (costing about 320 ms) and logs the warning. Removing it from the stack is harmless on Windows too, because 'Arial' comes earlier in the list and is always present there, so 'MS Shell Dlg' is never reached. Every other theme inherits this rule.

Evidence:
- `frontend/data/themes/Yami.obt:596`: `font-family: 'Open Sans', '.AppleSystemUIFont', Helvetica, Arial, 'MS Shell Dlg', sans-serif;`
- A grep for "MS Shell Dlg" finds only `Yami.obt`, `frontend/forms/OBSUpdate.ui` (updater dialog) and `frontend/updater/updater.rc`.

Slice plan: drop `'MS Shell Dlg', ` from `Yami.obt:596`. 1 line.
Test plan: on Windows, launch the built OBS, check that the UI font is unchanged, and check the log for font warnings. The macOS warning removal is UNTESTED.

Related: #11202.
