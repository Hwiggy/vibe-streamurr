# Upstream triage — batch linux-02

- Batch: linux-02 (area hint: linux)
- Items: 9326, 9418, 9634, 9727, 9748, 9870, 9915, 10011, 10072, 10136, 10200, 10236, 10330, 10335, 10495, 10512, 10535, 10548, 10588, 10628, 10701, 10752
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; code read on master; PR heads from `refs/upstream-pr/<N>`. Local git is 2.33, which has no `merge-tree --write-tree`, so conflict checks used the legacy `git merge-tree <base> master <pr>` and counted conflict markers. One WebFetch was used, on PR #10136.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 9326 | issue | CANNOT_VERIFY |
| 9418 | issue | CANNOT_VERIFY |
| 9634 | issue | CANNOT_VERIFY |
| 9727 | issue | CANNOT_VERIFY |
| 9748 | issue | IMPLEMENT |
| 9870 | issue | OUT_OF_SCOPE |
| 9915 | issue | CANNOT_VERIFY |
| 10011 | issue | ALREADY_ADDRESSED |
| 10072 | issue | DEFER_LARGE |
| 10136 | PR | IMPLEMENT (cherry-pick) |
| 10200 | issue | IMPLEMENT |
| 10236 | issue | CANNOT_VERIFY |
| 10330 | issue | CANNOT_VERIFY |
| 10335 | PR | IMPLEMENT (partial-pr / re-apply) |
| 10495 | PR | DEFER_LARGE |
| 10512 | issue | IMPLEMENT |
| 10535 | issue | CANNOT_VERIFY |
| 10548 | issue | DEFER_LARGE |
| 10588 | issue | CANNOT_VERIFY |
| 10628 | issue | IMPLEMENT |
| 10701 | issue | IMPLEMENT |
| 10752 | issue | OUT_OF_SCOPE |

---

### [#9326](https://github.com/obsproject/obs-studio/issues/9326) — V4L2: EVGA XR1 is busy on obs start and doesn't show in scene
**Verdict: CANNOT_VERIFY**

The reporter's capture card returns EBUSY when OBS opens it, but VLC can open it. Nothing in the report points to a specific code defect. EBUSY usually means another handle is streaming from the device, such as a second V4L2 source, a PipeWire camera source or another program. That cannot be checked without the hardware and the log, which is not in the dataset.
- `plugins/linux-v4l2/v4l2-input.c` opens the device per source. There is no global or shared open that would explain a self-inflicted busy state.
- The report has no comments and was filed against OBS 29.1.3, three years old.

Related: none.

### [#9418](https://github.com/obsproject/obs-studio/issues/9418) — v4l2: BRIO Ultra HD Webcam camera hangs
**Verdict: CANNOT_VERIFY**

`/dev/videoX` disappears, PipeWire ignores SIGTERM and shutdown hangs. That points to the uvcvideo driver or USB stack stuck in kernel D-state. A user-space ioctl sequence may trigger it, but the report does not say which one, and the bug is specific to this camera. Labelled confirmed upstream, but there is no stack or ioctl trace to act on.
- `plugins/linux-v4l2/v4l2-input.c:198-232` is the plain select/DQBUF loop. Nothing in it is unusual.

Related: 10588 (also camera/PipeWire inconsistency).

### [#9634](https://github.com/obsproject/obs-studio/issues/9634) — XSHM shows blank screen if Display Scale is not x1 (XFCE)
**Verdict: CANNOT_VERIFY**

XFCE scaling uses an xrandr transform, which makes the X screen 2080x1170 while the panel is 1600x900. XSHM correctly reports and requests that root geometry. A blank image from `xcb_shm_get_image` on a transformed framebuffer depends on the driver and X server. It cannot be reproduced or traced to OBS code here.
- `plugins/linux-capture/xshm-input.c` takes its geometry from XRandR/Xinerama screen info. The logged geometry matches the scaled screen, so the selection logic behaves as written.

Related: 9915 (HiDPI).

### [#9727](https://github.com/obsproject/obs-studio/issues/9727) — Extreme graphical glitches on Wayland, disappear when disabling X11 entirely
**Verdict: CANNOT_VERIFY**

Reported on the Flathub build of OBS 29.1.3 with Qt 5.15 on KDE 5.27 and an AMD APU. The glitches show up in Qt widgets (transparent, flickering popups), so this is a Qt, compositor or GPU-driver interaction. OBS has since moved to Qt 6, and the frontend detects the Qt platform at `frontend/OBSApp.cpp:1281-1292` without forcing xcb. There is no OBS-side defect to point at.

Related: 10752.

### [#9748](https://github.com/obsproject/obs-studio/issues/9748) — Integrations get disconnected when renaming profile after connecting
**Verdict: IMPLEMENT**

The root cause is in the code. Auth state lives in memory (`OBSBasic::auth`) and is written to the profile's `basic.ini` only by `Auth::Save()`. Only two places call it: profile activation (`OBSBasic_Profiles.cpp:682`) and shutdown (`OBSBasic.cpp:1747`). `SetupRenameProfile` copies the old profile directory to the new one *before* `ActivateProfile` calls `Auth::Save()`. So a connection made in this session is saved only into the old profile, which is then deleted. Next, `ActivateProfile` swaps to the copied config, which has no `[Auth]` entry, and `Auth::Load()` (`OBSBasic_Profiles.cpp:720`) replaces `main->auth` with nothing. `SetupDuplicateProfile` has the same ordering bug. This matches the report: a connection made at launch survives because it was already on disk.
- `frontend/widgets/OBSBasic_Profiles.cpp:115-138`: `SetupRenameProfile` runs `std::filesystem::copy` and then `ActivateProfile`.
- `frontend/widgets/OBSBasic_Profiles.cpp:92-113`: `SetupDuplicateProfile` has the same pattern.
- `frontend/widgets/OBSBasic_Profiles.cpp:674-720`: `ActivateProfile` calls `Auth::Save()` on the outgoing config, then `Swap`, then `Auth::Load()`.
- `frontend/oauth/Auth.cpp:53-87`: `Auth::Load` and `Auth::Save` read and write `main->Config()`.

**Slice plan**
- In `SetupRenameProfile` and `SetupDuplicateProfile`, call `Auth::Save();` (it saves the config to disk) just before `std::filesystem::copy(...)`. Two lines, plus a comment.
- Files: `frontend/widgets/OBSBasic_Profiles.cpp`. Platform: cross-platform. About 6 lines.
- Test: build the `obs-studio` frontend with MSVC. Manual test on Windows: create a profile, connect Twitch/YouTube in Settings > Stream, rename the profile, and confirm it stays connected. The OAuth login may not be possible in this environment. If it is not done, mark the manual part UNTESTED.

Related: none.

### [#9870](https://github.com/obsproject/obs-studio/issues/9870) — upgrade to NVidia 545.29.02 crashes OBS
**Verdict: OUT_OF_SCOPE**

OBS stopped starting after an NVIDIA driver upgrade (545.29.02) on Wayland. This is a regression in a proprietary driver's EGL/GBM stack, addressed by later driver releases. No OBS code change is implied.

Related: none.

### [#9915](https://github.com/obsproject/obs-studio/issues/9915) — pointer events on canvas do not match on hidpi
**Verdict: CANNOT_VERIFY**

The preview already scales mouse positions by the device pixel ratio. `OBSBasicPreview::GetMouseEventPos` (`frontend/widgets/OBSBasicPreview.cpp:64-75`) uses `main->GetDevicePixelRatio()` and `previewScale`. The report (KDE Wayland Flatpak, OBS 30.0) suggests Qt and the native surface disagreed on scale, which is a Qt-Wayland or fractional-scale protocol interaction. It cannot be reproduced on this machine, and no specific wrong computation is visible.

Related: 9634.

### [#10011](https://github.com/obsproject/obs-studio/issues/10011) — OBS does not cleanly exit when sent SIGTERM (Linux)
**Verdict: ALREADY_ADDRESSED**

Current master installs POSIX signal handlers for SIGINT, SIGTERM, SIGABRT and SIGQUIT, using the socketpair + QSocketNotifier pattern. On SIGTERM (non-Apple) it calls `main->saveAll()` and then `quit()`, which takes the normal clean-shutdown path, so the crash handler should not flag an unclean exit. The handlers were added by `14572498d` ("frontend: Adjust application shutdown logic", 2025-09-25), after this issue was filed.
- `frontend/obs-main.cpp:896-897`: `setupSignalHandler(...SIGINT / SIGTERM)`.
- `frontend/OBSApp.cpp:973-993`: the socket notifiers are connected.
- `frontend/OBSApp.cpp:1936-1956`: `processSigTerm` calls `saveAll()` and then `quit()`.

Related: upstream #9877 (Windows counterpart, not in this batch).

### [#10072](https://github.com/obsproject/obs-studio/issues/10072) — fails to reestablish audio after losing & regaining sound device permission
**Verdict: DEFER_LARGE**

The PulseAudio plugin never recovers from a lost connection. The context state callback is an explicit no-op with a `@todo` to reconnect (`plugins/linux-pulseaudio/pulse-wrapper.c:33-45`). `pulse_start_recording` (`plugins/linux-pulseaudio/pulse-input.c:317-385`) sets only a read callback, with no stream state callback, so a FAILED or TERMINATED stream is never restarted. A fix needs reconnect logic for both the shared context and every stream, run off the PA mainloop thread. It also needs a PipeWire VT-switch environment to verify. That is a design task, not a small slice.

Related: 10495 (same plugin), 10548.

### [#10136](https://github.com/obsproject/obs-studio/pull/10136) — obs-ffmpeg: Add ROI support for VAAPI
**Verdict: IMPLEMENT (cherry-pick-pr)**

The PR is one commit (`326482451`), touching only `plugins/obs-ffmpeg/obs-ffmpeg-vaapi.c` (+44/-6), and merges cleanly into master (0 conflict markers; merge-base is Nov 2024). It uses existing libobs ROI APIs (`OBS_ENCODER_CAP_ROI` at `libobs/obs-encoder.h:39`, and `obs_encoder_has_roi`/`obs_encoder_enum_roi` at `libobs/obs.h:2349-2353`). It maps them to FFmpeg `AV_FRAME_DATA_REGIONS_OF_INTEREST` with `qoffset = -priority`. That sign convention matches x264 (`plugins/obs-x264/obs-x264.c:736`) and NVENC (`plugins/obs-nvenc/nvenc.c:1209-1211`). Side data is attached to a frame allocated per encode call (`obs-ffmpeg-vaapi.c:720`, plus the tex path's `surface.frame`), so it cannot pile up across frames. Maintainer derrod said "looks fine" but could not test. The only other request was a rebase, which has since been done. The author notes AV1 ROI needs a newer FFmpeg; older FFmpeg ignores the side data, so it is harmless.
- `plugins/obs-ffmpeg/obs-ffmpeg-vaapi.c:631`: `vaapi_encode_internal` is where the PR inserts `add_roi`.
- `plugins/obs-ffmpeg/obs-ffmpeg-vaapi.c:1219-1300`: the `.caps` lines the PR extends.

**Slice plan**
- `git cherry-pick 326482451` (keeps nowrep's authorship; GPL-2.0-or-later contribution). Optional: drop the cap from the AV1 entries if we want to be conservative.
- Files: `plugins/obs-ffmpeg/obs-ffmpeg-vaapi.c`. About 50 lines. Platform: linux.
- Test: VAAPI is Linux-only and not compiled on Windows, so the change is UNTESTED here. Run clang-format only.

Related: none.

### [#10200](https://github.com/obsproject/obs-studio/issues/10200) — FTBFS on NixOS due to sign-compare warning in QSV_Encoder_Internal.cpp
**Verdict: IMPLEMENT**

The line is still on master. `pParams->nWidth` and `nHeight` are `mfxU16` (`plugins/obs-qsv11/QSV_Encoder.h:96-97`). Their product is promoted to signed `int` and then compared with `constexpr uint32_t pixelcount_4k` (`plugins/obs-qsv11/QSV_Encoder_Internal.cpp:358-360`). That triggers `-Wsign-compare`, which `cmake/common/compiler_common.cmake:47` enables and `-Werror` (`cmake/linux/compilerconfig.cmake:58`) can turn into a build error. obs-qsv11 builds on Linux x86_64 (`plugins/CMakeLists.txt:93-97`). The int product can also overflow for extreme sizes, which is theoretical undefined behaviour.

**Slice plan**
- Change the condition to `((uint32_t)pParams->nWidth * pParams->nHeight) >= pixelcount_4k`. One line.
- Files: `plugins/obs-qsv11/QSV_Encoder_Internal.cpp`. Platform: cross-platform (the warning matters on Linux GCC).
- Test: MSVC build of the `obs-qsv11` target on Windows. The GCC `-Werror` reproduction is UNTESTED here.

Related: none.

### [#10236](https://github.com/obsproject/obs-studio/issues/10236) — linux crash report
**Verdict: CANNOT_VERIFY**

The report is a screenshot and a log URL with no crash log or backtrace. The steps (switching tabs, clicking the tray icon, pressing Super) are vague. Nothing actionable.

Related: none.

### [#10330](https://github.com/obsproject/obs-studio/issues/10330) — OBS, Orca screen reader and x11: program opens then crashes
**Verdict: CANNOT_VERIFY**

Accessibility crash under X11 with Orca (Flatpak). Labelled confirmed, but there is no backtrace in the dataset. Qt's AT-SPI bridge and OBS's custom accessible widgets are both candidates, and isolating it needs Orca, X11 and a debugger. Not something to code blind.

Related: none.

### [#10335](https://github.com/obsproject/obs-studio/pull/10335) — linux-v4l2: Give camera up to 2 seconds to start
**Verdict: IMPLEMENT (partial-pr: re-apply by hand)**

The bug is real. The select timeout is `timeout_frames` frame periods from the very first iteration (`plugins/linux-v4l2/v4l2-input.c:174-186, 203-205`). With "Autoreset on Timeout" on (`:224-229`), a camera slower than about 5 frames to deliver its first buffer is reset over and over and may never start. The PR uses a 2 s timeout until the first frame is dequeued, and again after each reset. The single commit `631bb2927` (+12/-5) does not apply cleanly (2 conflict hunks) only because of the later 120-column clang-format change (`a1fbf1015`). Re-applying the same logic is trivial.

Improvement over the PR: it puts 2,000,000 µs in `tv_usec` with `tv_sec = 0`. Linux normalises that, but setting `tv_sec`/`tv_usec` properly from the usec value is cleaner, and the existing `timeout_usec` can already exceed 1 s at low frame rates.

**Slice plan**
- In `v4l2_thread`, add `const uint64_t init_timeout_usec = 2000000; bool initialized = false;`. Pick the timeout as `initialized ? timeout_usec : init_timeout_usec` and split it into `tv_sec = t / 1000000; tv_usec = t % 1000000`. Set `initialized = false` before `v4l2_reset_capture` and `initialized = true` after a successful DQBUF.
- Files: `plugins/linux-v4l2/v4l2-input.c`. About 15 lines. Credit David Chappell (david672orford) via a `Co-authored-by` trailer, with a link to the PR.
- Test: Linux-only plugin, so UNTESTED here. clang-format only.

Related: 9326, 9418.

### [#10495](https://github.com/obsproject/obs-studio/pull/10495) — linux-pulseaudio: Implement audio output
**Verdict: DEFER_LARGE**

This adds a new `pulse_output` output type and a virtual-cable feature that loads and unloads PulseAudio modules: 8 files, +559/-110, plus new `pulse-output.c` and `pulse-utils.c`. There is no UI, and the feature is reachable only from scripts. The PR conflicts with master (3 conflict hunks). It is a new feature that needs maintainer product decisions about exposing audio outputs, not a small slice.

Related: 10072.

### [#10512](https://github.com/obsproject/obs-studio/issues/10512) — Segmentation fault when adding ReaStream.so as a VST filter
**Verdict: IMPLEMENT**

The defect is clear. The Linux `VSTPlugin::loadEffect` does `plugin = mainEntryPoint(hostCallback_static); plugin->user = this;` without a null check (`plugins/obs-vst/linux/VSTPlugin-linux.cpp:52-55`). A VST2 entry point may return NULL when it refuses the host, which ReaStream likely does outside REAPER. The crash frame in the backtrace is inside `VSTPlugin::loadEffect` itself, not inside the plugin, which matches this null dereference. The Windows (`plugins/obs-vst/win/VSTPlugin-win.cpp:66-72`) and macOS (`plugins/obs-vst/mac/VSTPlugin-osx.mm:62-68`) loaders both check for NULL. The caller already handles a NULL return (`plugins/obs-vst/VSTPlugin.cpp:148-152`). The fix stops the crash; it does not make ReaStream work.

**Slice plan**
- After the entry point returns: `if (!plugin) { blog(LOG_WARNING, "VST Plug-in's main() returns null."); unloadLibrary(); return nullptr; }`. Also call `unloadLibrary()` on the "couldn't get main()" path, so the dlopen handle is not leaked.
- Files: `plugins/obs-vst/linux/VSTPlugin-linux.cpp`. About 10 lines. Platform: linux.
- Test: Linux-only source, so UNTESTED here.

Related: none.

### [#10535](https://github.com/obsproject/obs-studio/issues/10535) — Stuttering when using PipeWire Window Capture
**Verdict: CANNOT_VERIFY**

Intermittent visual stutter with PipeWire window capture on GNOME 46 and a Radeon 7900, with no dropped frames in stats. This depends on the compositor, GPU and timing (frame pacing between mutter's screencast and OBS). No code defect can be identified without the hardware.

Related: 10588.

### [#10548](https://github.com/obsproject/obs-studio/issues/10548) — [Linux] Big latency when monitoring auxiliary audio device
**Verdict: DEFER_LARGE**

Root cause in code: PulseAudio monitoring has no clock-drift compensation. `do_stream_write` only *grows* the PA target length when OBS's internal deque backs up (`libobs/audio-monitoring/pulse/pulseaudio-output.c:189-196`). The length never shrinks back toward the initial 25 ms (`:436`), and `on_audio_playback` (`:230-267`) always appends. With a source clock slightly faster than the sink, latency ratchets up permanently, as reported, and long-standing upstream #3525 describes the same thing. A proper fix needs a drift policy (drop or resample excess, or reset `tlength`) and real-device testing. That is a design decision with audible trade-offs, not a small slice.

Related: upstream #3525 (not in batch), 10072.

### [#10588](https://github.com/obsproject/obs-studio/issues/10588) — Pipewire web cameras inconsistent behaviour
**Verdict: CANNOT_VERIFY**

The camera is detected only after several restarts, and frame rates have to be toggled before it works. The report is vague ("be unlucky like me") and depends on the PipeWire camera portal and the device. There is no specific defect to point at.

Related: 9418, 10535.

### [#10628](https://github.com/obsproject/obs-studio/issues/10628) — Failed to redo multiple properties changed within 500 ms
**Verdict: IMPLEMENT**

Root cause in code. Undo coalescing state (`update_timer`, `recently_updated`, `old_settings_cache`) is per `WidgetInfo`, meaning per control (`shared/properties-view/properties-view.hpp:30-32`), but every control's timer reports the shared `view->settings` as the "new" state when it fires (`shared/properties-view/properties-view.cpp:2101-2120`). In the report, Left changes and Top changes within 500 ms. Left's timer then fires with old = {0,0} and new = {left 1, top 2}, which already includes Top's change. Top's timer fires with old = {1,0} and new = {1,2}. Undoing twice and redoing once restores {1,2} instead of {1,0}, exactly as the reporter's log shows. The consumer is `FilterChangeUndoRedo` (`frontend/dialogs/OBSBasicFilters.cpp:181-216`), and source properties use the same view.

**Slice plan**
- Move the timer lambda body into a method, `WidgetInfo::FlushPendingUpdate()`: stop the timer, call `view->callback(obj, old_settings_cache, view->settings)` if allowed, and clear `recently_updated`.
- At the top of `WidgetInfo::ControlChanged()`, before the old-settings snapshot, loop over `view->children`. Call `FlushPendingUpdate()` on any *other* child with an active timer, so its undo entry records only its own change.
- Files: `shared/properties-view/properties-view.cpp` and `.hpp`. About 30 lines. Platform: cross-platform.
- Test: MSVC build of the frontend on Windows, then a manual run of the reporter's Crop/Pad steps if the app can be launched; otherwise mark the manual part UNTESTED.

Related: none.

### [#10701](https://github.com/obsproject/obs-studio/issues/10701) — Push-to-talk not working correctly
**Verdict: IMPLEMENT**

Root cause in code, on Wayland (the reporter uses Sway). The Qt event filter injects only presses that matter. `inject_hotkey` (`libobs/obs-hotkey.c:1076-1093`) only *presses* bindings. Releases come from the 25 ms hotkey thread, through `query_hotkeys` and `handle_binding` (`libobs/obs-hotkey.c:1035-1066, 1135-1175`), which releases any binding whose key `is_pressed()` reports as up. On Wayland, `obs_nix_wayland_hotkeys_platform_is_pressed` always returns false (`libobs/obs-nix-wayland.c:261-269`). So every injected press is released about 25 ms later, and push-to-talk acts as a pulse lasting only the configured delay, as reported. The Wayland platform already has a `wl_keyboard` listener on Qt's display, whose `key` handler is an intentional no-op (`libobs/obs-nix-wayland.c:118-130`). It receives exactly the focused key state needed.

**Slice plan**
- Add `bool pressed_keys[OBS_KEY_LAST_VALUE]` (updated with atomic or volatile access) to `struct obs_hotkeys_platform`.
- In `platform_keyboard_key`, map `key + 8` (evdev to xkb keycode) through `plat->key_to_sym[0][...]` and then `obs_nix_wayland_key_from_virtual_key`, and set or clear the entry for pressed or released.
- In `platform_keyboard_leave`, clear all entries.
- Make `is_pressed` return the entry. Modifier keys are covered the same way.
- Files: `libobs/obs-nix-wayland.c`. About 40 lines. Platform: linux.
- Behaviour stays focus-only, matching Wayland's security model. Global hotkeys still need the portal, which is out of scope.
- Test: Linux and Wayland only, so UNTESTED here.

Related: none.

### [#10752](https://github.com/obsproject/obs-studio/issues/10752) — Freeze when trying to open settings on Fedora 40 (Wayland)
**Verdict: OUT_OF_SCOPE**

The whole computer freezes and needs a hard reset when Settings is opened in the Flatpak. A user-space Qt dialog cannot hard-lock a machine; that requires a GPU-driver or kernel fault. No OBS-side defect can be identified, and the fix belongs to the driver or distro stack.

Related: 9727.
