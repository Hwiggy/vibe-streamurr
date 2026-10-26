# Upstream triage — batch macos-06

- Batch: macos-06 (area hint: macos)
- Items: 13559, 13571, 13578, 13624, 13675, 13711, 13739, 13755, 13891, 13902, 13905, 13918, 13934, 13936, 13938, 13965, 14022, 14072, 14083
- Date: 2026-10-26
- Base commit: 72e866557 (`git rev-parse --short master`)
- Method: item bodies from `notes/upstream-triage/data/all.json`, code read on master, PR heads from `refs/upstream-pr/N`. No WebFetch used.
- Note: local git is 2.33 and does not support `git merge-tree --write-tree`; PR applicability was judged by merge-base and by whether the touched files changed on master since then.

Summary:

| # | Kind | Verdict |
|---|------|---------|
| 13559 | issue | DEFER_LARGE |
| 13571 | issue | CANNOT_VERIFY |
| 13578 | issue | CANNOT_VERIFY |
| 13624 | issue | CANNOT_VERIFY |
| 13675 | issue | CANNOT_VERIFY |
| 13711 | issue | CANNOT_VERIFY |
| 13739 | issue | CANNOT_VERIFY |
| 13755 | issue | CANNOT_VERIFY |
| 13891 | issue | CANNOT_VERIFY |
| 13902 | issue | DEFER_LARGE |
| 13905 | issue | IMPLEMENT |
| 13918 | issue | IMPLEMENT |
| 13934 | issue | IMPLEMENT |
| 13936 | issue | CANNOT_VERIFY |
| 13938 | issue | CANNOT_VERIFY |
| 13965 | PR | DEFER_LARGE |
| 14022 | PR | DEFER_LARGE |
| 14072 | PR | IMPLEMENT (cherry-pick) |
| 14083 | issue | CANNOT_VERIFY |

---

### [#13559](https://github.com/obsproject/obs-studio/issues/13559) — macOS Virtual Camera reports max 1920x1080 to Chrome/WebRTC

**Verdict: DEFER_LARGE**

The reporter's diagnosis is right. The macOS camera extension advertises exactly one stream format, hard-coded to 1920x1080. It still forwards frames at the real OBS output size, so AVFoundation/ffmpeg get 2560x1440 while Chrome negotiates against the advertised format list. A real fix needs a design decision. Either the system extension (which runs separately from OBS) learns the OBS output resolution before clients enumerate it, or it advertises several formats and scales frames to them. Neither is a small, obvious slice, and none of it can be tested here.

Evidence:
- `plugins/mac-virtualcam/src/camera-extension/OBSCameraDeviceSource.swift:53` — `CMVideoDimensions(width: 1920, height: 1080)` is the only format description.
- `plugins/mac-virtualcam/src/camera-extension/OBSCameraStreamSource.swift:36-38` — `formats` returns the single `_streamFormat`; `activeFormatIndex >= 1` logs as invalid.

Related: none in batch.

### [#13571](https://github.com/obsproject/obs-studio/issues/13571) — Audio mixer: Shift+scroll on mac reverses the direction

**Verdict: CANNOT_VERIFY**

OBS does not handle wheel events on the volume slider itself. `VolumeSlider` has no `wheelEvent` override, and `VolumeMeter::wheelEvent` just forwards the event to its focus proxy. So the behaviour comes from Qt's `QAbstractSlider::wheelEvent`. On macOS, holding Shift makes the OS turn vertical scroll into horizontal scroll, and Qt treats horizontal and vertical deltas differently (sign, `inverted()`). A workaround in `VolumeSlider` is possible, but I cannot confirm the exact sign handling without macOS hardware, and the root cause is Qt/macOS rather than OBS code.

Evidence:
- `frontend/components/VolumeSlider.hpp:7-25` — no wheel override; inherits `AbsoluteSlider`/`QSlider`.
- `frontend/components/VolumeMeter.cpp:881-884` — wheel forwarded unchanged to focus proxy.

Related: none.

### [#13578](https://github.com/obsproject/obs-studio/issues/13578) — Encoder load not distributed on M3 Ultra (two 4K60 VT encodes overload)

**Verdict: CANNOT_VERIFY**

This depends on hardware performance (Apple media engines on Ultra/Max chips). It covers the same ground as #13936, which suggests that `kVTCompressionPropertyKey_RealTime=false` together with `ExpectedFrameRate` keeps VideoToolbox from spreading the load or running at real-time priority. The current code does set RealTime to false. Upstream chose that on purpose (it was previously true), so flipping it is a quality/latency trade-off that has to be confirmed on Apple Silicon. That cannot be done on this Windows machine.

Evidence:
- `plugins/mac-videotoolbox/encoder.c:596` — `session_set_prop(s, kVTCompressionPropertyKey_RealTime, kCFBooleanFalse)`.
- `plugins/mac-videotoolbox/encoder.c:537-548` — `ExpectedFrameRate` always set in encoder spec session properties.

Related: #13936.

### [#13624](https://github.com/obsproject/obs-studio/issues/13624) — Browser source (CEF) crash on CrBrowserMain during autorelease pool drain

**Verdict: CANNOT_VERIFY**

Both backtraces have Chromium Embedded Framework as the top frames, crashing on an over-released object while an autorelease pool drains. No OBS or obs-browser frame identifies the over-release, and there is no reliable repro. This could be a CEF bug or an obs-browser ownership bug, and the code cannot tell us which.

Evidence:
- Crash stack in report is entirely CEF/AppKit; `plugins/obs-browser` is a submodule wrapping CEF, and no specific Objective-C release site is implicated.

Related: none.

### [#13675](https://github.com/obsproject/obs-studio/issues/13675) — Logged out of Twitch on every program close (macOS)

**Verdict: CANNOT_VERIFY**

The OAuth refresh token is saved in the profile config (`config_set_string(... "RefreshToken" ...)`) and loaded again at startup. It is not kept in the macOS keychain, so the code shows no macOS-specific persistence path that could fail. The most likely causes are a failed token refresh (server side, or a CEF cookie/mock-keychain change) or the config not being saved on exit. The log would be needed, and the code does not show a defect.

Evidence:
- `frontend/oauth/OAuth.cpp:52` — RefreshToken saved to profile config.
- `frontend/oauth/OAuth.cpp:67-71` — loaded on startup; `IsLoggedIn` based on non-empty token.
- `plugins/obs-browser/browser-app.cpp:169-170` — macOS CEF uses `use-mock-keychain` (affects CEF cookies, not OBS tokens).

Related: #14072 (different Twitch login crash).

### [#13711](https://github.com/obsproject/obs-studio/issues/13711) — Opening Image Source properties / changing image causes render lag on Apple Silicon

**Verdict: CANNOT_VERIFY**

It reproduces only on macOS Apple Silicon, with about 0.5 s of skipped render frames while CPU stays low. The image source decodes images outside the graphics lock and only uploads the texture inside it, so no blocking pattern specific to OBS is visible. The lag on simply opening the properties window points to the macOS graphics/compositor stack (the main thread or the native file dialog contending with the render thread over the Metal/GL context). Finding the cause needs profiling on the hardware.

Evidence:
- `plugins/image-source/image-source.c` — load path uses `gs_image_file4_init` then `obs_enter_graphics` only for texture init (no obvious long hold).

Related: none.

### [#13739](https://github.com/obsproject/obs-studio/issues/13739) — Browser source "Control audio via OBS" raises WindowServer CPU on Intel macOS Tahoe

**Verdict: CANNOT_VERIFY**

This is specific to Intel Macs running macOS 26 and was seen as WindowServer CPU usage. Turning on audio control switches CEF to OBS's audio handler. Why that would load WindowServer is not visible in OBS code. It looks like CEF/OS behaviour and needs profiling on the affected hardware.

Evidence:
- `plugins/obs-browser` (submodule) — audio-control path is CEF's `CefAudioHandler`; no WindowServer-facing code is involved.

Related: none.

### [#13755](https://github.com/obsproject/obs-studio/issues/13755) — Crash in Qt event dispatch after ScreenCaptureKit -3805 disconnect (long session)

**Verdict: CANNOT_VERIFY**

The crash happened about 19 hours after the last log line, in Qt posted-event dispatch, and the OBS callback frame is not symbolicated. The report gives no actionable OBS frame, and the link to the SCK disconnect is only that the two happened close together. It is intermittent and tied to sleep/wake, with no repro.

Evidence:
- `plugins/mac-capture/mac-sck-common.m` — stream-stop error path only logs; no Qt object is touched from it, so the link cannot be established from code.

Related: none.

### [#13891](https://github.com/obsproject/obs-studio/issues/13891) — GPU clock/power ramps while OBS window visible, drops when minimized

**Verdict: CANNOT_VERIFY**

This is a power-management observation on M3 Pro with a 6K-backing external display, and it happens even with the preview disabled. The likely cause is window compositing of Qt widgets or the volume meters at high backing scale. That needs Instruments/powermetrics on the hardware, and no specific code defect can be found.

Evidence:
- No preview rendering is involved per report; candidates (Qt repaint timers such as `VolumeMeter` updates in `frontend/components/VolumeMeter.cpp`) cannot be confirmed without profiling.

Related: none.

### [#13902](https://github.com/obsproject/obs-studio/issues/13902) — Hang starting Audio Input Capture when device isn't ready (no timeout on AudioOutputUnitStart)

**Verdict: DEFER_LARGE**

The reporter's sample is believable. `coreaudio_start` calls `AudioOutputUnitStart` synchronously, and the first init runs from source creation, on the main thread while a scene collection loads. The call blocks in the CoreAudio HAL, so a timeout cannot simply be wrapped around it. The fix is to move device start onto the existing reconnect thread or another async worker, so that `obs_source_create` never blocks on the HAL. That changes the source's init/lifecycle model (state handling, the reconnect thread, destroy ordering), and the trigger is a device/driver bug that cannot be tested here.

Evidence:
- `plugins/mac-capture/mac-audio.c:602-609` — `coreaudio_start` → `AudioOutputUnitStart(ca->unit)` synchronous.
- `plugins/mac-capture/mac-audio.c:694-702` — `coreaudio_try_init` runs init inline at create; the retry thread (`:459`) is used only after failure.

Related: none.

### [#13905](https://github.com/obsproject/obs-studio/issues/13905) — GetInputPropertiesListPropertyItems on screen_capture display_uuid crashes (strlen(NULL))

**Verdict: IMPLEMENT**

The defect is confirmed in code. `build_display_list` adds a placeholder list item whose string value is NULL, and so does `build_application_list` (value `0`). obs-websocket's `GetListPropertyItems` assigns `obs_property_list_item_string()` straight into `nlohmann::json`. Building a json string from a NULL `const char*` calls `strlen(NULL)` and crashes. Two small changes fix it, and each is useful on its own. (a) obs-websocket should write JSON `null` when the name or string value is NULL, which protects against any plugin that does this. (b) mac-capture should use `""` for the placeholders. `obs_data_get_string` already returns `""` for a NULL default, so the source sees the same value as before.

Evidence:
- `plugins/mac-capture/mac-sck-common.m:88` — `obs_property_list_add_string(display_list, " ", NULL);`
- `plugins/mac-capture/mac-sck-common.m:186` — `obs_property_list_add_string(application_list, " ", 0);`
- `plugins/obs-websocket/src/utils/Obs_ArrayHelper.cpp:270,277` — unguarded `itemData["itemName"]`/`["itemValue"] = <const char*>`.
- `plugins/mac-capture/mac-sck-video-capture.m:399-400` — defaults are NULL strings, read back via `obs_data_get_string` (returns "").

Slice plan:
1. `plugins/obs-websocket/src/utils/Obs_ArrayHelper.cpp`: in `GetListPropertyItems`, read name/string into locals; assign `nullptr` (JSON null) when NULL, else the string. (~8 lines)
2. `plugins/mac-capture/mac-sck-common.m:88,186`: pass `""` instead of `NULL`/`0`. (2 lines)
- Testing: the obs-websocket change can be compiled with MSVC on this machine (Windows build of obs-websocket). The mac-capture change is macOS-only and UNTESTED.

Related: none in batch.

### [#13918](https://github.com/obsproject/obs-studio/issues/13918) — GetStats leaks ~200 autoreleased objects per call (no autorelease pool)

**Verdict: IMPLEMENT**

The defect is confirmed. `os_get_free_space` in `platform-cocoa.m` creates autoreleased NSURL/NSArray/NSDictionary objects with no `@autoreleasepool`. When obs-websocket calls it through `os_get_free_disk_space` from its own non-Cocoa thread (GetStats), those objects are never drained. Other helpers in the same file already wrap their bodies in `@autoreleasepool`. The fix is to wrap this function body the same way.

Evidence:
- `libobs/util/platform-cocoa.m:361-384` — `os_get_free_space` body without pool.
- `libobs/util/platform-cocoa.m:225,235` — existing `@autoreleasepool` usage in neighbouring helpers.
- `libobs/util/platform-cocoa.m:386-391` — `os_get_free_disk_space` → `os_get_free_space`.

Slice plan:
1. Wrap the `if (path)` body of `os_get_free_space` in `@autoreleasepool { ... }` (returns inside a pool block are valid under MRC/ARC). About 20 lines, mostly reindentation.
- Testing: macOS-only Objective-C; UNTESTED on this Windows machine.

Related: #13934 (same reporter; their build carries this patch).

### [#13934](https://github.com/obsproject/obs-studio/issues/13934) — macOS OpenGL: crash/hang in updateSwapchainFramebuffer (deferred block uses destroyed swapchain)

**Verdict: IMPLEMENT**

The defect is confirmed in code. `gl_update` runs on the graphics thread and dispatches a block to the main queue. It retains both NSOpenGLContexts, but it captures `.swapchain = device->cur_swap` as a raw pointer. When the block runs, `updateSwapchainFramebuffer` dereferences `currentSwapchain->wi->texture` and destroys the prior texture. If `gs_swapchain_destroy` runs first (it calls `gl_platform_cleanup_swapchain` and then `gl_windowinfo_destroy`, which `bfree`s the wi), the block touches freed memory. The block also binds `frameBufferObjectId`, which may already have been deleted by cleanup, and the reported GL_INVALID_OPERATION matches that. The fix is small and needs no new dependency: reference-count `gl_windowinfo`, and have the block hold a reference to the wi instead of the swapchain. Under the context locks, the block skips the update when cleanup has already cleared the wi's fbo/texture.

Evidence:
- `libobs-opengl/gl-cocoa.m:35-42` — `OBSFrameBufferUpdateData` holds raw `gs_swapchain_t *swapchain`.
- `libobs-opengl/gl-cocoa.m:322-349` — `gl_update` captures `device->cur_swap` and dispatches async.
- `libobs-opengl/gl-cocoa.m:307-313` — block writes `currentSwapchain->wi->texture` and destroys prior texture.
- `libobs-opengl/gl-cocoa.m:179-209` — cleanup clears `wi->fbo/texture/context` *after* unlocking the contexts.
- `libobs-opengl/gl-cocoa.m:236-243` — `gl_windowinfo_destroy` frees wi immediately.
- `libobs-opengl/gl-subsystem.c:1500-1502` — destroy order: cleanup then windowinfo_destroy.

Slice plan (libobs-opengl/gl-cocoa.m only, ~50 lines):
1. Add `volatile long refs` to `struct gl_windowinfo`; set it to 1 in `gl_windowinfo_create`. Add a static `gl_windowinfo_release()` that frees on reaching zero (`os_atomic_dec_long`). `gl_windowinfo_destroy` sets `view = nil` and releases.
2. Replace `swapchain` in `OBSFrameBufferUpdateData` with `struct gl_windowinfo *wi`. `gl_update` increments the ref before `dispatch_async`, and the block releases it after `updateSwapchainFramebuffer`.
3. In `updateSwapchainFramebuffer`, after taking both CGL locks, return early (through cleanup) if `wi->texture == NULL || wi->fbo == 0`. Bind `wi->fbo` instead of the snapshotted id.
4. In `gl_platform_cleanup_swapchain`, clear `wi->fbo/texture/context` while still holding the platform context lock, so the block's check is ordered against it.
- Testing: macOS OpenGL only; UNTESTED on this Windows machine. The reporter's repro (toggle studio mode quickly through obs-websocket) is the validation to run on a Mac.

Related: #13918; upstream #11929 (same crash site, not in batch).

### [#13936](https://github.com/obsproject/obs-studio/issues/13936) — Apple VT on Apple Silicon: RealTime=false + ExpectedFrameRate causes encoder overload

**Verdict: CANNOT_VERIFY**

The proposed change is tiny: set `RealTime` to true and stop setting `ExpectedFrameRate`. But it reverses a deliberate upstream decision to match FFmpeg/HandBrake defaults, made after earlier reports of quality and frame drops. Whether it helps depends on the chip (Max/Ultra multi-engine), and it may hurt single-engine Macs or CRF quality. A change to performance behaviour cannot be justified without testing on Apple hardware, and that is not possible here. If it is ever implemented, it should be an opt-in advanced option, not a new default.

Evidence:
- `plugins/mac-videotoolbox/encoder.c:596-601` — RealTime hard-coded false.
- `plugins/mac-videotoolbox/encoder.c:537-565` — ExpectedFrameRate in session properties.

Related: #13578.

### [#13938](https://github.com/obsproject/obs-studio/issues/13938) — Crash when starting recording from the menu bar while OBS is focused (macOS 27)

**Verdict: CANNOT_VERIFY**

The report is for macOS 27, a beta/unreleased OS at the time of filing. It has no crash report, and the screen recording failed to upload. "Window bar" probably means the macOS menu bar or system recording UI, which is not OBS code. Without a stack nothing can be traced.

Evidence:
- No crash log in report; log URL only. No code path identifiable.

Related: none.

### [#13965](https://github.com/obsproject/obs-studio/pull/13965) — decklink: Update to sdk 16

**Verdict: DEFER_LARGE**

This PR replaces the vendor SDK with Blackmagic DeckLink SDK 16. It touches 154 files (+9020/-5871) across the win/mac/linux SDK headers and IDLs, and rewrites frame conversion (`ConvertNewFrame`, a new `DeckLinkVideoBufferAccess` RAII). It was branched from an older merge-base (50530ce90). It is far beyond a small slice, needs DeckLink hardware to validate, and the SDK headers carry Blackmagic's own license terms, which need a separate review.

Evidence:
- `git diff master...refs/upstream-pr/13965 --stat` — 154 files changed.
- `plugins/decklink/{win,mac,linux}/decklink-sdk/` — vendored SDK being replaced.

Related: none.

### [#14022](https://github.com/obsproject/obs-studio/pull/14022) — frontend: Update macOS app icon for Liquid Glass

**Verdict: DEFER_LARGE**

This is a branding/design change. It replaces the PNG `AppIcon.appiconset` with an Icon Composer `.icon` bundle and changes the icon design (the stripe is removed, new variants added). It needs maintainer/brand sign-off and an Xcode 26 toolchain (actool with `.icon` support) to build. It is not a bug fix and cannot be built or checked on Windows. It is mostly binary/asset churn (17 files).

Evidence:
- `git diff master...refs/upstream-pr/14022 --stat` — deletes `frontend/cmake/macos/Assets.xcassets/AppIcon.appiconset/*`, adds `frontend/cmake/macos/AppIcon.icon/*`.

Related: none.

### [#14072](https://github.com/obsproject/obs-studio/pull/14072) — frontend: Queue navigation in auth window to fix crash

**Verdict: IMPLEMENT (cherry-pick-pr)**

This is a tiny, coherent fix from a maintainer (WizardCM). The `titleChanged`/`urlChanged` signals from `QCefWidget` arrive in the middle of a CEF callback, and the handlers (`OAuthLogin::urlChanged` can close the dialog or delete things) run re-entrantly inside CEF's queue. Making the connections `Qt::QueuedConnection` defers them to Qt's event loop. The PR's merge-base is current master (72e866557), so it applies cleanly. It has 2 commits (the second is a fixup that also covers `OBSWhatsNew`), and these should be squashed on cherry-pick.

Evidence:
- `frontend/dialogs/OAuthLogin.cpp:40-41` — direct connections to `setWindowTitle`/`urlChanged`.
- `frontend/dialogs/OBSWhatsNew.cpp:38` — direct connection to `setWindowTitle`.
- `git merge-base master refs/upstream-pr/14072` = 72e86655 (master HEAD).

Slice plan:
- `git cherry-pick 5892c4a7c 4f875488c` (squash the fixup), keeping authorship. 3 lines changed in 2 files.
- Testing: the frontend compiles with MSVC on this machine; the Twitch login crash is macOS-specific, so the runtime behaviour is UNTESTED here.

Related: #13675 (different Twitch symptom, not fixed by this).

### [#14083](https://github.com/obsproject/obs-studio/issues/14083) — Controller inputs not read in browser source after OBS loses focus (macOS)

**Verdict: CANNOT_VERIFY**

The Windows equivalent (#11694) was fixed by disabling `EnableWindowsGamingInputDataFetcher`. obs-browser already applies that only on Windows. On macOS, Chromium reads gamepads through the GameController framework, which by default only delivers events while the app is frontmost. No known CEF switch changes this, so there is no OBS-side code defect to point to. It may need a Chromium/CEF change.

Evidence:
- `plugins/obs-browser/browser-app.cpp:142-149` — Windows-only removal of the gaming-input feature flag; nothing equivalent for macOS.

Related: none.
