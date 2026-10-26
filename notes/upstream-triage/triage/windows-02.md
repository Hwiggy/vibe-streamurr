# Upstream triage — batch windows-02

- Batch: windows-02 (area hint: windows)
- Items: 8895, 9168, 9175, 9298, 9348, 9436, 9440, 9526, 9652, 10265, 10423, 10471, 10540, 10566, 10769, 10833, 10848, 11071, 11190, 11247
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; PR heads from `refs/upstream-pr/<N>`; code read on master. No GitHub API / WebFetch used. Local git is 2.33, which lacks `merge-tree --write-tree`, so applicability was checked with the legacy `git merge-tree <base> master <pr>` and grepping for conflict markers.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 8895 | issue | OUT_OF_SCOPE |
| 9168 | issue | IMPLEMENT (shared slice with 10540) |
| 9175 | issue | CANNOT_VERIFY |
| 9298 | issue | IMPLEMENT |
| 9348 | issue | CANNOT_VERIFY |
| 9436 | issue | CANNOT_VERIFY |
| 9440 | PR | CANNOT_VERIFY |
| 9526 | PR | IMPLEMENT (cherry-pick) |
| 9652 | issue | IMPLEMENT |
| 10265 | issue | OUT_OF_SCOPE |
| 10423 | issue | IMPLEMENT |
| 10471 | PR | DEFER_LARGE |
| 10540 | issue | IMPLEMENT (same slice as 9168) |
| 10566 | issue | IMPLEMENT (partial hardening) |
| 10769 | issue | CANNOT_VERIFY |
| 10833 | issue | ALREADY_ADDRESSED |
| 10848 | issue | ALREADY_ADDRESSED |
| 11071 | issue | CANNOT_VERIFY |
| 11190 | issue | CANNOT_VERIFY |
| 11247 | issue | CANNOT_VERIFY |

---

### [#8895](https://github.com/obsproject/obs-studio/issues/8895) — Captions failed to start

**Verdict: OUT_OF_SCOPE**

The reporter fixed it themselves by installing the Windows "English (United States)" language pack with all features. The captions tool uses Microsoft SAPI recognizers. Languages are filtered with `SpFindBestToken`, and when the handler fails to start, the user sees a generic error dialog. The real cause was a missing OS speech component, which is a Windows configuration problem and not an OBS code defect.

Evidence:
- `plugins/frontend-tools/captions.cpp:308-320`: `valid_lang()` already checks for a SAPI recognizer token before listing a language.
- `plugins/frontend-tools/captions-mssapi.cpp:29-31`: `SpFindBestToken` failure throws, which becomes the generic failure dialog at `captions.cpp:276-281`.

Related: none.

---

### [#9168](https://github.com/obsproject/obs-studio/issues/9168) — Graphics-hook.dll crashes OpenGL program (SwapBuffers using DXGI)

**Verdict: IMPLEMENT** (same slice as #10540)

When the NVIDIA "Vulkan/OpenGL present method = layered on DXGI" option is active, `SwapBuffers` presents through a driver-internal DXGI swap chain on the same thread. graphics-hook hooks both GL and DXGI. The reporter's hook log shows that after the GL capture is freed, the DXGI path grabs the driver's internal swap chain ("Found D3D11 11.0 device on swap chain"). The program then crashes inside graphics-hook when the capture restarts.

Upstream already solved this exact conflict for Vulkan in dfb9bb74f ("graphics-hook: Avoid conflict between Vulkan and DXGI Present"). That fix uses a thread-local `vk_presenting` counter, and `should_passthrough()` makes the DXGI Present hooks call straight through while the counter is set. OpenGL has no equivalent guard. `swap_recurse` is thread-local and already counts nesting inside the GL swap hooks, but it is `static` and `should_passthrough()` never consults it.

Evidence:
- `plugins/win-capture/graphics-hook/graphics-hook.h:248-259`: `should_passthrough()` checks only `vk_presenting`.
- `plugins/win-capture/graphics-hook/vulkan-capture.c:1210-1216`: the Vulkan present increments and decrements `vk_presenting` around the real present.
- `plugins/win-capture/graphics-hook/gl-capture.c:80`: `__declspec(thread) static int swap_recurse;`
- `plugins/win-capture/graphics-hook/gl-capture.c:736-783`: `gl_swap_begin`/`gl_swap_end` wrap `RealSwapBuffers`, `RealWglSwapBuffers` and `RealWglSwapLayerBuffers`.
- `plugins/win-capture/graphics-hook/dxgi-capture.cpp:192,254`: the DXGI Present and Present1 hooks already honour `should_passthrough()`.

Slice plan:
- `gl-capture.c`: make the counter visible to the DXGI hooks. Either drop `static` from `swap_recurse` and rename it `gl_presenting`, or add a separate `__declspec(thread) int gl_presenting` that is incremented and decremented around the three `Real*SwapBuffers` calls.
- `graphics-hook.h`: declare `extern __declspec(thread) int gl_presenting;` and return `vk_presenting > 0 || gl_presenting > 0` (the Vulkan term only under `COMPILE_VULKAN_HOOK`).
- About 15 lines.
- Test: build `graphics-hook` (32 and 64-bit) with MSVC. Runtime is UNTESTED unless someone can run an OpenGL app with the NVIDIA layered-DXGI present mode and toggle the capture source.

Related: #10540, #11190 (also DXGI lifetime, but a different mechanism).

---

### [#9175](https://github.com/obsproject/obs-studio/issues/9175) — Virtual camera only shows one initial frame in RPCS3

**Verdict: CANNOT_VERIFY**

The virtual camera works in other consumers, including PCSX2 according to the reporter. Only RPCS3's Qt camera handler gets stuck on the first frame. The OBS DirectShow filter streams frames from the shared video queue with no consumer-specific path, and nothing in the code explains a consumer that stops pulling after one frame. Diagnosing this needs an RPCS3/Qt Multimedia repro.

Evidence:
- `plugins/win-dshow/virtualcam-module/virtualcam-filter.cpp:30-100`: the filter setup and frame thread are generic. Nothing is specific to the consumer.

Related: none.

---

### [#9298](https://github.com/obsproject/obs-studio/issues/9298) — Moving group child with center alignment offsets the other child

**Verdict: IMPLEMENT** (issue has the `issue/confirmed` label)

Root cause: `resize_group()` and `update_item_transform()` use different arithmetic for the alignment offset.
- `resize_group()` computes the group's new anchor position for center alignment in exact floating point: `(maxv-minv)*0.5 + minv`.
- `update_item_transform()` builds the draw transform from a truncated integer size (`cx = (uint32_t)(cx*scale.x)`, where the scene's `cx` is `ceilf(width)`). `add_alignment()` then halves it with integer division (`cx / 2`).

For an odd integer width W, the float center is W/2 while the transform uses floor(W/2). Every group resize therefore moves all children by +0.5 px right and/or down. This matches the reporter's "slowly drifts to the bottom-right, only for centred alignments". Right and bottom alignment can drift in the same way when the width has a fractional part. Left and top alignment use `minv` directly, so they are exact.

Evidence:
- `libobs/obs-scene.c:325-336`: `add_alignment()` uses `(float)(cx / 2)` (integer division).
- `libobs/obs-scene.c:650-655`: `cx = (uint32_t)((float)cx * scale.x)`, which truncates before `add_alignment`.
- `libobs/obs-scene.c:3462-3464`: `scene->cx = (uint32_t)ceilf(scale->x)`.
- `libobs/obs-scene.c:3484-3521`: `resize_group()` computes the center as `(maxv.x - minv.x) * 0.5f + minv.x`.

Slice plan (new change in `libobs/obs-scene.c`, about 25 lines):
1. In `resize_group()`, before changing anything, transform the old local point `minv` through the old `group->draw_transform` to get the world-space target.
2. Keep the existing provisional `pos` computation and call `update_item_transform(group, false)`.
3. Transform local (0,0) through the new `draw_transform`. Add the difference (target − actual) to the absolute position (via `pos_to_absolute` and `pos_from_absolute` when the group uses relative coordinates). Update the transform again.

This pins the children's world position exactly, whatever the rounding, alignment, rotation or scale. Rendering of non-group items is unchanged.

Test: build libobs. Manual test in the built OBS on this Windows box: make a group, set alignment to Center, move one child repeatedly, and check that the other child stays put.

Related: none.

---

### [#9348](https://github.com/obsproject/obs-studio/issues/9348) — Artifacts/flickering with WGC display capture on Acrylic/Aero windows

**Verdict: CANNOT_VERIFY**

OBS copies the full Windows.Graphics.Capture frame with no dirty-region handling, so any flicker comes from the frames the OS compositor delivers. DXGI duplication does not show it. Nothing in OBS's frame handling explains the artifacts, and investigating needs the reporter's GPU and compositor setup.

Evidence:
- `libobs-winrt/winrt-capture.cpp:165-175`: full `CopyResource`/`CopySubresourceRegion` of each frame.
- `libobs-winrt/winrt-capture.cpp:320,386`: only the border option is configured.

Related: none.

---

### [#9436](https://github.com/obsproject/obs-studio/issues/9436) — Fullscreen mode does not hide Windows taskbar

**Verdict: CANNOT_VERIFY**

Both the main window and the projector use the standard `QWidget::showFullScreen()`. The projector first sets its geometry to the target `QScreen::geometry()`. The reporter's screenshot shows a gap on the right as well as the visible taskbar, which points to a DPI or geometry mismatch on their particular monitor setup. The code shows no defect, and a repro on that setup is needed.

Evidence:
- `frontend/widgets/OBSBasic_MainControls.cpp:520`: `showFullScreen()`.
- `frontend/widgets/OBSProjector.cpp:125-131`: `setGeometry(screens()[monitor]->geometry()); showFullScreen();`.

Related: none.

---

### [#9440](https://github.com/obsproject/obs-studio/pull/9440) — libobs-d3d11: Disable HAGS workaround for NVIDIA driver >= 536.99

**Verdict: CANNOT_VERIFY**

The PR is still in scope and applies cleanly (+19/−1, one file). However:
1. The author's own description calls the driver fix "supposedly" in place, and its test section says "TBD". Whether NVIDIA 536.99 or later is safe with realtime GPU priority under HAGS depends on the driver and can't be checked from code.
2. The version check copies the component-wise `>=` pattern of `FastClearSupported`. That pattern wrongly rejects newer drivers with a higher third field and a lower fourth field (for example 31.0.16.0100), so it would need a proper 64-bit compare.

Without a reliable claim that the driver is fixed, turning the workaround off risks bringing back the original HAGS crash (9de6b18d5).

Evidence:
- `libobs-d3d11/d3d11-subsystem.cpp:435-446`: `set_priority()` uses HIGH instead of REALTIME when HAGS is on.
- `libobs-d3d11/d3d11-subsystem.cpp:646-657`: HAGS detection and the call site.
- `libobs-d3d11/d3d11-subsystem.cpp:588-600`: `FastClearSupported` has the same flawed field-wise compare.
- `git diff master...refs/upstream-pr/9440`: adds `HAGSPriorityFixed()`.

Related: none.

---

### [#9526](https://github.com/obsproject/obs-studio/pull/9526) — libobs-d3d11: Log GPU PCIe lanes and version

**Verdict: IMPLEMENT** (cherry-pick-pr)

This adds one log line per adapter, giving the current and maximum PCIe link width and generation. It gets the adapter's hardware PnP key with `D3DKMTQueryAdapterInfo(KMTQAITYPE_PHYSICALADAPTERPNPKEY)`, matches it to a SetupAPI display device, and reads `DEVPKEY_PciDevice_*`. It only logs, is self-contained (+130 lines across 2 files), and merges without conflicts against master. The only new link dependency is the Windows system library `setupapi`. `<optional>` and `<algorithm>` are already included on master.

The contribution is GPL-2.0-or-later, the same licence as this fork, and cherry-picking keeps the author. One follow-up worth adding: check `SetupDiGetClassDevs` for `INVALID_HANDLE_VALUE` before enumerating.

Evidence:
- `git log master..refs/upstream-pr/9526`: single commit dd3aa1454.
- `libobs-d3d11/d3d11-subsystem.cpp:18-31`: the needed std headers and `<d3dkmthk.h>` are already present.
- `libobs-d3d11/d3d11-subsystem.cpp:527`: same pattern as the existing `GetAdapterHagsStatus` logging, which the new line sits next to.

Slice plan: `git cherry-pick dd3aa1454`, plus a small follow-up commit adding the invalid-handle guard. Files: `libobs-d3d11/CMakeLists.txt`, `libobs-d3d11/d3d11-subsystem.cpp`. Test: MSVC build of libobs-d3d11, run OBS on this box and check that the log contains the "PCIe Speed:" line.

Related: none.

---

### [#9652](https://github.com/obsproject/obs-studio/issues/9652) — Excessive log file usage (14 GB in a single file)

**Verdict: IMPLEMENT**

A broken MJPEG capture device makes every frame fail to decode. For each frame (about 30 per second), win-dshow logs `"<source>: Error decoding video"` with no rate limit. Its FFmpeg log callback also forwards FFmpeg's "Found EOI before any SOF" warning and "No JPEG data found in image" fatal message every frame. The callback already has a precedent for this kind of spam: it prints "unable to decode APP fields" only once.

Evidence:
- `plugins/win-dshow/win-dshow.cpp:108-135`: `ffmpeg_log()` contains the existing once-only suppression for the APP-fields message.
- `plugins/win-dshow/win-dshow.cpp:501-505`: unconditional `blog(LOG_WARNING, "%s: Error decoding video")` on every failure.
- `plugins/win-dshow/win-dshow.cpp:632`: the same pattern for audio.

Slice plan (`plugins/win-dshow/win-dshow.cpp`, about 30 lines):
- Add a `video_decode_errors` counter to `DShowInput`. Log the first failure, then one summary per N (for example 300) consecutive failures with the count. Reset the counter and log a "recovered" message on the next successful decode. Do the same for audio.
- In `ffmpeg_log`, extend the existing once-only suppression to the two MJPEG messages. Better still, generalise it to suppress a message identical to the previous one.

Log-file size capping and rotation in the frontend is a separate, larger change and is not part of this slice.

Test: MSVC build of win-dshow. The runtime path needs a device that produces corrupt MJPEG and is UNTESTED otherwise. The logic can be reviewed by reading the code.

Related: none.

---

### [#10265](https://github.com/obsproject/obs-studio/issues/10265) — Bitmap converted font gets weird when using actual size

**Verdict: OUT_OF_SCOPE**

Text (GDI+) renders through GDI+, which officially supports only TrueType and OpenType outline fonts, not raster or bitmap fonts. The reporter is using a custom bitmap font made in Schism Tracker, and the platform renderer does not support that font type. Better bitmap-font support would be a feature better served by a plugin or a different text renderer.

Evidence:
- `plugins/obs-text/gdiplus/obs-text.cpp:311-336`: `UpdateFont()` builds a `LOGFONT`, creates an HFONT, then wraps it in GDI+ `new Font(hdc, hfont)`, so there is no raster-font rendering path.

Related: none.

---

### [#10423](https://github.com/obsproject/obs-studio/issues/10423) — Use-after-free in `WidgetInfo::PathChanged`

**Verdict: IMPLEMENT**

The reporter's analysis holds on current master (the code moved to `shared/properties-view`). `PathChanged()` opens a modal file dialog, which runs a nested event loop. If the source calls `obs_source_update_properties()` while the dialog is open, `ReloadProperties()` swaps out `properties`, which frees the old `obs_property_t`. `RefreshProperties()` then calls `children.clear()`, which destroys every `WidgetInfo` synchronously through `unique_ptr`, including the one whose `PathChanged` is on the stack. After the dialog returns, the code dereferences `edit`, `view` and `setting`, which all belong to freed objects. `ColorChangedInternal()` and `FontChanged()` open modal dialogs in the same way and share the hazard.

Evidence:
- `shared/properties-view/properties-view.hpp:100`: `std::vector<std::unique_ptr<WidgetInfo>> children;`
- `shared/properties-view/properties-view.cpp:94-110`: `ReloadProperties()` replaces `properties`.
- `shared/properties-view/properties-view.cpp:115-123`: `RefreshProperties()` runs `children.clear(); widget->deleteLater();`.
- `shared/properties-view/properties-view.cpp:1790-1831`: `PathChanged()` uses `edit`/`view`/`setting` after the modal `OpenFile`/`SaveFile`/`SelectDirectory`.
- `shared/properties-view/properties-view.cpp:2037-2081`: `ControlChanged()` touches `this` after `PathChanged` returns true.

Slice plan (`shared/properties-view/properties-view.cpp`, about 15 lines):
- In `PathChanged`, `ColorChangedInternal` and `FontChanged`, take `QPointer<WidgetInfo> guard(this);` before opening the dialog. Right after it returns, `if (!guard) return false;`. `WidgetInfo` is a `QObject`, so `QPointer` is cleared when the `unique_ptr` deletes it.
- Returning false makes `ControlChanged` return before it touches `this`.
- Copy `setting` into a `std::string` up front, in case later code needs it.

Test: MSVC build of the frontend. Manual check: open properties for a source that refreshes its properties on a timer (or use a debug source), click Browse, wait, then pick a file. It must not crash.

Related: none.

---

### [#10471](https://github.com/obsproject/obs-studio/pull/10471) — win-mediafoundation: Media Foundation capture device and Intel NPU AI features

**Verdict: DEFER_LARGE**

This draft PR adds about 4,600 lines in 23 new files. It needs the new `wil` headers dependency (obs-deps PR 242) and the Windows 11 SDK, and it creates a second "Video Capture Device 2" source. The authors themselves ask maintainers for design guidance on merging it with the DShow source. It is far beyond a small slice and needs both a design decision and a new dependency.

Evidence:
- `git diff master...refs/upstream-pr/10471 --stat`: 23 files, +4582.

Related: none.

---

### [#10540](https://github.com/obsproject/obs-studio/issues/10540) — Games using DXGI present mode crash when scenes are switched

**Verdict: IMPLEMENT** (same slice as #9168)

The trigger is the same: NVIDIA "Prefer layered on DXGI swapchain" with OpenGL games (Cassette Beasts, Dune: Spice Wars). Switching scenes deactivates and then reactivates game capture, the same disable/enable cycle as #9168. The root cause and fix are identical: DXGI Present hooks fire inside the GL `SwapBuffers` hook, and no GL passthrough guard exists like the Vulkan one.

Evidence: see #9168. Key lines are `plugins/win-capture/graphics-hook/graphics-hook.h:252-259` and `plugins/win-capture/graphics-hook/gl-capture.c:80,736-783`.

Slice plan: the #9168 slice covers it; there is no separate change. Runtime is UNTESTED without an NVIDIA GPU set to layered present mode.

Related: #9168.

---

### [#10566](https://github.com/obsproject/obs-studio/issues/10566) — obs-virtualcam-module is unloaded prematurely

**Verdict: IMPLEMENT** (partial hardening)

The issue claims `locks` changes only in `LockServer`. That is out of date: since 5efb3ea42 (in 28.0), `VCamFilter`'s constructor and destructor also increment and decrement `locks`, so a live filter blocks `DllCanUnloadNow`. That probably explains part of the Firefox crash-stats volume, which comes from older OBS versions.

The module still breaks the COM `DllCanUnloadNow` contract for other objects it serves:
- **`VCamFactory` instances** handed out by `DllGetClassObject` are not counted. A client holding the class factory (without `LockServer`) can see the DLL unload, then call `Release()` into unmapped code.
- **Pins, enumerators and `SourceMiscFlags`** live in libdshowcapture. Each has its own refcount and holds no reference to the filter or the module, so an `IPin` kept after the filter is released is also not counted.

The first is a small fix inside this repo's module. The second needs a change in the `deps/libdshowcapture/src` submodule (upstream libdshowcapture) and is left out of this slice.

Evidence:
- `plugins/win-dshow/virtualcam-module/virtualcam-module.cpp:11`: `volatile long locks`.
- `plugins/win-dshow/virtualcam-module/virtualcam-module.cpp:15-62`: `VCamFactory` has its own `refs` and does not touch `locks`.
- `plugins/win-dshow/virtualcam-module/virtualcam-module.cpp:241-244`: `DllCanUnloadNow` checks only `locks`.
- `plugins/win-dshow/virtualcam-module/virtualcam-filter.cpp:98-99,114`: the filter's constructor and destructor already count `locks` (5efb3ea42).
- `deps/libdshowcapture/src/source/output-filter.cpp:38,81-93,611-645`: `OutputPin` and `SourceMiscFlags` refcounts are independent of the module.
- `.gitmodules`: libdshowcapture is a submodule.

Slice plan: in `virtualcam-module.cpp`, `os_atomic_inc_long(&locks)` in the `VCamFactory` constructor and `os_atomic_dec_long(&locks)` in a new destructor (about 8 lines). The commit message should note that pin and enumerator lifetime is not covered because it lives in the submodule. Test: MSVC build of obs-virtualcam-module. Runtime is UNTESTED; the Firefox crash pattern can't be reproduced here.

Related: none.

---

### [#10769](https://github.com/obsproject/obs-studio/issues/10769) — Display capture: device not connected/unavailable after every restart

**Verdict: CANNOT_VERIFY**

Display capture stores the monitor by its device interface path (`EnumDisplayDevicesA(..., EDD_GET_DEVICE_INTERFACE_NAME)`) and falls back to `szDevice`. Both are stable across reboots unless the OS gives the monitor a different instance or path, for example because of driver re-enumeration or a monitor that wakes late. The saved ID is kept, not overwritten, when it is not found. Whether the path changes on this 3-monitor system depends on hardware and drivers, and the data needed (the monitor IDs before and after a reboot) is not available.

Evidence:
- `plugins/win-capture/duplicator-monitor-capture.c:190-226`: matching by `DeviceID`, with `szDevice` as fallback.
- `plugins/win-capture/duplicator-monitor-capture.c:282-302`: `find_monitor` keeps the requested ID.
- `plugins/win-capture/duplicator-monitor-capture.c:740-755`: how the property list is filled.

Related: none.

---

### [#10833](https://github.com/obsproject/obs-studio/issues/10833) — [Safe Mode] Unclean shutdown detected after a Windows shutdown

**Verdict: ALREADY_ADDRESSED**

On 30.1.x, Windows ended the session and terminated OBS before the crash sentinel was removed, so the next start reported an unclean shutdown. Master now handles this through a Windows native event filter and three later commits:
- `WM_ENDSESSION` closes the main window with no prompts.
- `WM_QUERYENDSESSION` saves on critical shutdown.
- 14572498d removes the crash sentinel as soon as the main window closes, raises OBS's shutdown priority, and adds further shutdown safeguards. 34a0a6a53 and 9f4320ec7 refine this further.

Evidence:
- `frontend/utility/NativeEventFilter_Windows.cpp:28-60`: `WM_QUERYENDSESSION` and `WM_ENDSESSION` handling.
- `frontend/OBSApp.cpp:1353-1354`: `mainWindowClosed` is connected to `CrashHandler::applicationShutdownHandler`, which removes the sentinel.
- `frontend/utility/CrashHandler.cpp:354-390`: sentinel removal.
- Commits 14572498d (2025-12-01), 34a0a6a53 (2025-12-04), 9f4320ec7 (2026-06-08).

Related: #10848.

---

### [#10848](https://github.com/obsproject/obs-studio/issues/10848) — [Windows 11] OBS crashes during regular Windows shutdown

**Verdict: ALREADY_ADDRESSED**

Same shutdown path as #10833. Commit 14572498d says it raises the application's shutdown priority "so that when OBS interrupts the session ending, CEF is not closed at the same time. This fixes a crash." It also adds the `WM_ENDSESSION` close path. The reporter was streaming to YouTube, which uses the browser/CEF dock, and that matches the crash the commit describes. The crash log URL can't be reached from here to confirm the stack, but the current code covers the described scenario.

Evidence:
- `frontend/utility/NativeEventFilter_Windows.cpp:39-57`.
- `git show 14572498d`: commit message quoted above.

Related: #10833.

---

### [#11071](https://github.com/obsproject/obs-studio/issues/11071) — "Failed to initialize video" after updating to v30.2.2

**Verdict: CANNOT_VERIFY**

This is a general renderer initialization failure on Windows 10. The log is on pastebin and was not fetched, and the body contains no adapter or feature-level details. The reporter suspects PR 11002, an OpenGL-on-Windows fix, but gives no evidence. There isn't enough information to find a code defect. It is most likely tied to a specific GPU or driver.

Evidence:
- `libobs-d3d11/d3d11-subsystem.cpp:640-700`: `InitDevice` failure paths, which depend on the hardware.

Related: none.

---

### [#11190](https://github.com/obsproject/obs-studio/issues/11190) — [DXGI] OBS seems to incorrectly release references to DXGI objects

**Verdict: CANNOT_VERIFY**

This is a regression of #9863. The likely trigger is 395ab0fbf (Dec 2023, 30.1), which replaced the `IDXGISwapChain::Release` hook with an `ID3DDestructionNotifier` callback. Capture resources are now freed only once the swap chain is actually destroyed. If D3D defers that destruction (pending context work, which DXGI's own error text points to with "ClearState() and Flush() may need to be called"), OBS's copy resources stay alive. The app's next flip-model `CreateSwapChainForHwnd` on the same HWND then fails.

graphics-hook holds no direct `AddRef` on the swap chain. The remaining reference is indirect and depends on the D3D runtime's deferred destruction, so neither a revert nor a ClearState/Flush in `d3d11_free` can be proven correct without the reporter's engine to test against.

Evidence:
- `plugins/win-capture/graphics-hook/dxgi-capture.cpp:38-66`: `SwapChainDestructed` plus `RegisterDestructionCallback`.
- `plugins/win-capture/graphics-hook/d3d11-capture.cpp:40-55`: `d3d11_free` releases textures without flushing the context.
- `git show 395ab0fbf` ("Use ID3DDestructionNotifier") and dad861b03 (the original Release hook).

Related: #9168, #10540 (other DXGI hook interactions).

---

### [#11247](https://github.com/obsproject/obs-studio/issues/11247) — NVIDIA Noise Removal degrades audio on RTX 4090 (AFX SDK 1.3)

**Verdict: CANNOT_VERIFY**

OBS changes intensity at runtime with `NvAFX_SetFloat(NVAFX_PARAM_INTENSITY_RATIO)` under the effect mutex. A model change goes through full destroy and reinitialization. The "tube" sound appears even without changing settings when the Ada SDK is used, which points at the NVIDIA SDK or model for that architecture. The reporter's claim that only a restart works after moving the slider would need NVIDIA's guidance on whether the runtime SetFloat is supported. No OBS defect is identifiable.

Evidence:
- `plugins/nv-filters/nvidia-audiofx-filter.c:470-484`: runtime intensity update.
- `plugins/nv-filters/nvidia-audiofx-filter.c:297-301`: intensity set at initialization.
- `plugins/nv-filters/nvidia-audiofx-filter.c:500-520`: reinitialization on effect change.

Related: none.
