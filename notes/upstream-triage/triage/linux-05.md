# Upstream triage — batch linux-05

- Batch: linux-05 (area hint: linux)
- Items: 12932, 12937, 12970, 13003, 13096, 13130, 13157, 13159, 13210, 13279, 13295, 13313, 13316, 13350, 13387, 13388, 13420, 13441, 13464, 13480, 13536, 13610
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; PR heads from `refs/upstream-pr/<N>`. The local git is 2.33, which has no `merge-tree --write-tree`, so applicability was checked with `git diff master...refs/upstream-pr/N | git apply --check` (read-only). One WebFetch was used, for #13003.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 12932 | PR | DEFER_LARGE |
| 12937 | PR | IMPLEMENT (cherry-pick-pr) |
| 12970 | issue | CANNOT_VERIFY |
| 13003 | issue | IMPLEMENT (new-change) |
| 13096 | issue | OUT_OF_SCOPE |
| 13130 | issue | CANNOT_VERIFY |
| 13157 | PR | IMPLEMENT (cherry-pick-pr) |
| 13159 | issue | CANNOT_VERIFY |
| 13210 | issue | CANNOT_VERIFY |
| 13279 | PR | IMPLEMENT (cherry-pick-pr) |
| 13295 | PR | IMPLEMENT (cherry-pick-pr) |
| 13313 | issue | CANNOT_VERIFY |
| 13316 | issue | IMPLEMENT (new-change) |
| 13350 | issue | IMPLEMENT (new-change) |
| 13387 | PR | DEFER_LARGE |
| 13388 | issue | IMPLEMENT (new-change) |
| 13420 | issue | CANNOT_VERIFY |
| 13441 | issue | CANNOT_VERIFY |
| 13464 | issue | OUT_OF_SCOPE |
| 13480 | PR | IMPLEMENT (partial-pr) |
| 13536 | PR | IMPLEMENT (cherry-pick-pr) |
| 13610 | PR | IMPLEMENT (cherry-pick-pr) |

---

### [#12932](https://github.com/obsproject/obs-studio/pull/12932) — libobs,linux-v4l2: Add basic NV16 and NV24 support

**Verdict: DEFER_LARGE**

The PR adds two new values to the public `enum video_format` (NV16, NV24) and wires them through libobs core. That means new shaders in `format_conversion.effect`, plus changes to `obs-source.c`, `obs-video.c`, `obs.c`, `video-frame.c`, the frontend, ffmpeg format maps and v4l2. It touches 10 files and adds 322 lines. Extending a public libobs enum is an API/ABI decision for maintainers: every `switch` over `video_format` in other plugins and in third-party plugins sees new values. The motivating hardware is an RK3588 HDMI-rx, and we cannot exercise it. The PR still applies cleanly. It is in scope, but it is not a small slice.

Evidence:
- `git diff master...refs/upstream-pr/12932 --stat`: 10 files, +322 lines.
- PR adds `VIDEO_FORMAT_NV16`/`VIDEO_FORMAT_NV24` after `VIDEO_FORMAT_R10L` in `libobs/media-io/video-io.h` (around line 96).
- 152 new shader lines in `libobs/data/format_conversion.effect`. These need GPU validation.

Related: none in batch.

---

### [#12937](https://github.com/obsproject/obs-studio/pull/12937) — linux-capture: Make X11 display captures handle resolution changes

**Verdict: IMPLEMENT (cherry-pick-pr)**

XSHM display capture only recomputes geometry in `xshm_update`, which runs when settings change. A live resolution change leaves a stale SHM segment and a stale texture. The plugin README still lists "handle resolution changes of screens" as a TODO. The PR subscribes to `ConfigureNotify` on the root window and to RandR screen/CRTC change notifications on the source's private xcb connection. It drains those events in `video_tick`, re-runs `xshm_update_geometry`, and reattaches the SHM segment and texture inside the graphics context. The connection belongs only to this source (`xcb_connect` at `xshm-input.c:233`), so polling its events does not steal events from anyone else. The PR is 2 files, about +85/-6 lines, and applies cleanly.

Evidence:
- `plugins/linux-capture/xshm-input.c:233` opens a per-source xcb connection, so event polling is safe.
- `plugins/linux-capture/xshm-input.c:87-99` already checks for the RandR extension (`xcb_randr_id`).
- `plugins/linux-capture/README` lists "handle resolution changes of screens" as a TODO.
- `git diff master...refs/upstream-pr/12937 | git apply --check` passes. 4 commits: 4159088c8, fcaecbb44, 5169563a3, ac4834d06.

Slice plan:
- Cherry-pick the 4 commits in order and preserve authorship (AlexTMjugador).
- Files: `plugins/linux-capture/xshm-input.c`, `plugins/linux-capture/README`.
- Testing: Linux/X11 only. Mark it UNTESTED in the commit body. On this Windows box only a read-through is possible, because linux-capture is not built on Windows.

---

### [#12970](https://github.com/obsproject/obs-studio/issues/12970) — OBS 32 Crashes After Stopping Recording with VAAPI or QuickSync H.264 Encoders

**Verdict: CANNOT_VERIFY**

The reporter has a Broadwell HD 5500 (EliteBook 850 G2) on CachyOS. The crash happens on recording stop with both VAAPI and QSV, and no crash log or stack exists. Both encoders failing on the same old iGPU points at the driver (iHD/i965 or the oneVPL runtime) rather than a shared OBS code path. Without a backtrace we cannot locate a defect. It may be related to #13316 (a VAAPI NULL-packet crash), but that one happens at start, not stop.

Evidence:
- No crash log in the body. The reporter says the video file is produced fine, so the crash is in teardown.
- `plugins/obs-ffmpeg/obs-ffmpeg-vaapi.c:473-488`: the flush/destroy path drains packets with `avcodec_receive_packet`. Nothing visibly wrong there.

Related: #13316.

---

### [#13003](https://github.com/obsproject/obs-studio/issues/13003) — [Linux] When exiting the app, the dialog gets put behind the main window

**Verdict: IMPLEMENT (new-change)**

The issue is labelled confirmed upstream. The thread (one WebFetch) shows it reproduces only when OBS was hidden to the tray before choosing Exit, on KDE Wayland. The cause is in the code. `OBSBasic::promptToClose()` calls `SetShowing(true)`, and when the window is hidden that path only queues `show()` via `QTimer::singleShot(0, this, &OBSBasic::show)`. The modal `OBSMessageBox::question` is then created and shown synchronously. Its nested event loop runs the deferred `show()` afterwards, so the main window is mapped after the dialog and Wayland stacks it on top. A contributor in the thread proposed deferring the prompt and confirmed that fixes it. A smaller fix is to make the main window visible synchronously before opening the message box.

Evidence:
- `frontend/widgets/OBSBasic.cpp:1809-1824`: `promptToClose()` calls `SetShowing(true)` and then `OBSMessageBox::question(this, ...)`.
- `frontend/widgets/OBSBasic_MainControls.cpp:585-590`: when the window is not visible, `SetShowing(true)` defers `show()` with `QTimer::singleShot(0, ...)`.
- `frontend/widgets/OBSBasic_SysTray.cpp`: the tray Exit action reaches this path while the window is hidden.

Slice plan:
- In `OBSBasic::promptToClose()`, after `SetShowing(true)`, add `if (!isVisible()) show();` and then `raise(); activateWindow();` before creating the message box. The window is then mapped before the dialog. The queued `show()` later becomes a no-op.
- About 4 lines in `frontend/widgets/OBSBasic.cpp`.
- Testing: the Windows build of the frontend compiles, and hide-to-tray then Exit can be smoke-tested on Windows for regressions. The Wayland stacking behaviour itself is UNTESTED.

---

### [#13096](https://github.com/obsproject/obs-studio/issues/13096) — Can't install from official PPA on Ubuntu 25.10 Questing Quokka

**Verdict: OUT_OF_SCOPE**

This is a distribution/packaging infrastructure request: the Launchpad PPA has no `questing` series. Nothing in the source tree controls which Ubuntu series the PPA publishes. It is also moot for a private fork that does not publish packages.

Evidence:
- No source involvement. PPA series publishing is done on Launchpad, outside this repository.

Related: none.

---

### [#13130](https://github.com/obsproject/obs-studio/issues/13130) — [Linux] Capture card stops working after closing and reopening OBS

**Verdict: CANNOT_VERIFY**

The report has no device model in the body and only a log URL. The failure is "/dev/video errors" after a restart, which typically points to the driver or device firmware not resetting (the device is busy or left in a bad state). v4l2 teardown closes the device. Without the device and the actual errno we cannot identify an OBS defect. The fd leak fixed by #13295 happens only in a properties callback, and that callback closes a temporary fd. It would not survive process exit, so it cannot explain a failure after a restart.

Evidence:
- `plugins/linux-v4l2/v4l2-input.c`: `v4l2_terminate` closes `data->dev` on teardown. Process exit releases all fds anyway.

Related: #13295 (tangential).

---

### [#13157](https://github.com/obsproject/obs-studio/pull/13157) — linux-pipewire: Defer screencast portal init until source is shown

**Verdict: IMPLEMENT (cherry-pick-pr)**

Today every screencast-portal source calls `init_screencast_capture()` in its `create` callback. On startup each portal source therefore opens a portal session or picker at once, even sources in scenes that are never shown. On KDE that means a flood of identical picker dialogs. The PR moves the call into the `show` callback, guarded by `!obs_pw_stream && !session_handle && !cancellable`, so it runs only once. The teardown paths are NULL-safe when init never happened: `obs_pipewire_destroy(NULL)` returns early (`pipewire.c:1180`), and `g_cancellable_cancel(NULL)` and `g_clear_object(NULL)` are no-ops. The Reload button still calls `init_screencast_capture` directly. The PR is 1 file, +3/-6 lines, and applies cleanly.

Evidence:
- `plugins/linux-pipewire/screencast-portal.c:522,536,551`: `init_screencast_capture(capture)` is called in all three `*_create` functions.
- `plugins/linux-pipewire/screencast-portal.c:630-636`: `screencast_portal_capture_show` only shows an existing stream.
- `plugins/linux-pipewire/screencast-portal.c:558-577`: destroy tolerates a NULL session, stream or cancellable.
- `plugins/linux-pipewire/pipewire.c:1178-1181`: `obs_pipewire_destroy` checks for NULL.

Slice plan:
- Cherry-pick 4ed995488 and preserve authorship (dollthing).
- File: `plugins/linux-pipewire/screencast-portal.c`.
- Known pre-existing leak, not introduced here: `reload_session_cb` re-runs init, which allocates a new `GCancellable` without freeing the old one. Note it in the commit body only.
- Testing: Linux/Wayland only. UNTESTED on this box.

---

### [#13159](https://github.com/obsproject/obs-studio/issues/13159) — [Linux] OBS crashes when exit

**Verdict: CANNOT_VERIFY**

The core dump shows the main thread jumping to a NULL function pointer inside `KStatusNotifierItem::~KStatusNotifierItem`, called from `KDEPlasmaPlatformTheme6.so`, while `QSystemTrayIcon` is being destroyed. That frame is in KDE Frameworks or the Plasma platform theme, not OBS code. OBS only owns the tray icon as an ordinary Qt object (`frontend/widgets/OBSBasic_SysTray.cpp`). We cannot fix or reproduce it from code.

There is a separate real defect in the same log: `'loop->recurse > 0' failed ... pw_thread_loop_wait()`. `teardown_pipewire()` calls `pw_thread_loop_wait()` without holding the thread-loop lock (`plugins/linux-pipewire/pipewire.c:181-183`). PipeWire rejects that with an assertion message and returns, so the call is a no-op. It is harmless, but it is a bug and could be removed as a 1-line follow-up. It does not cause this segfault.

Evidence:
- The issue's stack shows frame #0 at `0x0` and frame #1 in `libKF6StatusNotifierItem.so.6` (`~KStatusNotifierItem`).
- `plugins/linux-pipewire/pipewire.c:181-183`: `pw_thread_loop_wait` is called unlocked before `pw_thread_loop_stop`. This is the source of the assertion line in the log.

Related: #13610 (a different Wayland shutdown crash, in hotkeys).

---

### [#13210](https://github.com/obsproject/obs-studio/issues/13210) — Switching KDE workspaces while OBS is recording causes dropped frames, minimising OBS first works

**Verdict: CANNOT_VERIFY**

Frames drop when OBS stays visible on a workspace that is switched away from, and not when it is minimised. This points at preview presentation blocking the graphics thread while the compositor withholds frame callbacks for an off-screen surface. OBS already sets `eglSwapInterval(0)` before every swap (`libobs-opengl/gl-wayland-egl.c:335`, `gl-x11-egl.c:528`), which should prevent blocking. If the driver/compositor (NVIDIA egl-wayland, KWin) still blocks, that is outside OBS. The issue does not say whether the session is X11 or Wayland, or which GPU. It is possibly related to the long-standing #6076. Without a profile we cannot locate a defect.

Evidence:
- `libobs-opengl/gl-wayland-egl.c:331-341`: present already requests swap interval 0.
- `libobs-opengl/gl-x11-egl.c:528-532`: the same on X11.

Related: #13313, upstream #6076.

---

### [#13279](https://github.com/obsproject/obs-studio/pull/13279) — Fix V4L2 nonui apply

**Verdict: IMPLEMENT (cherry-pick-pr)**

V4L2 camera controls are written to the device only from the property `modified` callback (`v4l2_control_changed`, which issues `VIDIOC_S_CTRL`). That callback fires only when the Properties UI is open. Settings changed via obs-websocket `SetInputSettings`, scripts or plugins, and saved values on startup, are never pushed to the device. That is a real defect. The PR adds `v4l2_apply_controls()`. It enumerates controls, reads the user-set values from settings, compares them with `VIDIOC_G_CTRL`, and writes with `VIDIOC_S_CTRL` only when they differ. `v4l2_update()` calls it. The PR is 3 files, +91 lines, and applies cleanly. The branch has merge commits, so cherry-pick only the two real commits.

Evidence:
- `plugins/linux-v4l2/v4l2-controls.c:35-68`: `v4l2_control_changed` is the only `VIDIOC_S_CTRL` caller (line 62).
- `plugins/linux-v4l2/v4l2-controls.c:79,119,124`: it is registered only as a property modified callback.
- `plugins/linux-v4l2/v4l2-input.c:1037-1080`: `v4l2_update` never applies controls.

Slice plan:
- Cherry-pick dfb2e9b2b and ddee7c333 (skip the merge commits) and preserve authorship (GrantAbell).
- Files: `plugins/linux-v4l2/v4l2-controls.c`, `v4l2-controls.h`, `v4l2-input.c`.
- Testing: Linux-only plugin. UNTESTED here.

---

### [#13295](https://github.com/obsproject/obs-studio/pull/13295) — linux-v4l2: Fix missing fd close

**Verdict: IMPLEMENT (cherry-pick-pr)**

In `format_selected()`, the device is opened with `v4l2_open`. If `v4l2_get_input_caps()` fails, the function returns `false` without `v4l2_close(dev)`, which leaks an fd each time. The PR adds the close. It is 1 file, +3/-1 lines, and applies cleanly.

Evidence:
- `plugins/linux-v4l2/v4l2-input.c:665-673`: `v4l2_open`, then an early `return false` on caps failure with no close. The normal path closes at line 694.

Slice plan:
- Cherry-pick 516862e45 and preserve authorship (stephematician).
- Testing: Linux-only. UNTESTED, but trivially correct by inspection.

Related: #13130 (tangential).

---

### [#13313](https://github.com/obsproject/obs-studio/issues/13313) — Wayland/EGL: eglSwapInterval(0) called every frame causes flickering on NVIDIA; adapter selection silently ignored

**Verdict: CANNOT_VERIFY**

Bug 1's premise conflicts with EGL semantics. The EGL spec applies the swap interval to the draw surface bound to the current context. OBS uses one context with several swapchains (main preview, projectors, multiview), and switches surfaces in `device_load_swapchain`. Setting interval 0 right before each swap is how each surface gets interval 0. Moving the call to `init_swapchain`, where no surface is current, would not achieve that. Interval 0 is intentional: it keeps the graphics thread from blocking on compositor pacing. Repeated identical calls might trouble NVIDIA's egl-wayland, but that is driver-specific and unproven. Bug 2 is real: `adapter` is ignored on both EGL backends. But adapter selection on Linux would mean creating the EGL display on a chosen device (an EGL_EXT_platform_device / explicit-device design). That is a feature-sized change, not a bug fix. No defect can be confirmed and the flicker is NVIDIA-specific.

Evidence:
- `libobs-opengl/gl-wayland-egl.c:316-329`: `device_load_swapchain` switches the current surface per swapchain.
- `libobs-opengl/gl-wayland-egl.c:331-341`: swap interval 0, then swap buffers.
- `libobs-opengl/gl-wayland-egl.c:248` and `libobs-opengl/gl-x11-egl.c:363`: `UNUSED_PARAMETER(adapter)`.
- `libobs-opengl/gl-egl-common.c:202-235`: adapters are enumerated, but only for listing.

Related: #13210.

---

### [#13316](https://github.com/obsproject/obs-studio/issues/13316) — VAAPI crashes at recording on Ubuntu

**Verdict: IMPLEMENT (new-change)**

The backtrace locates the defect exactly. In `vaapi_encode_internal`, on the first packet, `obs_extract_avc_headers` moves SPS, PPS and SEI into `enc->header`/`enc->sei`, and only the remaining NALs go into `new_packet`. If the driver emits a first packet that contains only parameter sets or SEI (newer Mesa or FFmpeg can do this), `new_packet` is empty. Then `enc->buffer.array` is NULL and `size` is 0, and `obs_avc_keyframe(NULL, 0)` is called. In `ff_avc_find_startcode_internal`, `end -= 3` on a NULL `end` wraps to `0xfff...fd`, so the scan loop dereferences `p = NULL`. That is exactly frame #0 of the report (`p=0x0, end=0xfffffffffffffffd`). The same hazard exists for HEVC and AV1. The fix is to skip emitting empty packets (and guard the keyframe helpers against `size == 0`).

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-vaapi.c:651-700`: on the first packet the headers are extracted, `da_copy_array(enc->buffer, new_packet, size)` can copy 0 bytes, then `obs_avc_keyframe(packet->data, packet->size)` runs at line 696.
- `libobs/obs-avc.c:273-313`: `obs_extract_avc_headers` routes SPS/PPS/SEI out of `new_packet`.
- `libobs/obs-avc.c:25-30` and `libobs/obs-nal.c:23-27`: `end = data + size`, then `end -= 3` underflows when `data == NULL`.

Slice plan:
- `plugins/obs-ffmpeg/obs-ffmpeg-vaapi.c`: after building `enc->buffer`, if `enc->buffer.num == 0`, do not set `*received_packet` (unref and return true). The headers are already captured. About 5 lines.
- Defence in depth in `libobs/obs-avc.c` (`obs_avc_keyframe`) and `libobs/obs-hevc.c` (`obs_hevc_keyframe`): `if (!data || !size) return false;`. About 4 lines.
- Testing: the libobs part builds on Windows (MSVC). A cmocka test calling `obs_avc_keyframe(NULL, 0)` would need linking against libobs. The current `test/cmocka` targets link libobs, so a small `test_avc.c` is feasible. The VAAPI runtime path is Linux-only and UNTESTED.

Related: #12970.

---

### [#13350](https://github.com/obsproject/obs-studio/issues/13350) — Black square behind mouse cursor with Rec. 2100 colour spaces

**Verdict: IMPLEMENT (new-change)**

The root cause is in the code. With a Rec. 2100 (PQ/HLG) colour space the canvas space is `GS_CS_709_EXTENDED`. For an sRGB source, `source_render()` then picks `convert_tech = "Draw"` and renders the source's `video_render` into a `color_space_texrender` with `gs_enable_blending(false)`. The PipeWire source (`obs_pipewire_stream_video_render`) and the X11 cursor helper (`xcb_xcursor_render`) push the blend state and set a blend *function*, but they never enable blending. They assume blending is already on, which it is in SDR. In HDR the cursor sprite is therefore written without blending, and its transparent pixels (premultiplied 0,0,0,0) overwrite the frame as a black square. win-capture sources already toggle blending explicitly around the cursor.

Evidence:
- `libobs/obs-source.c:2776-2786`: an sRGB source on a 709_EXTENDED canvas gives `convert_tech = "Draw"`.
- `libobs/obs-source.c:2838-2846`: `gs_enable_blending(false)` around `source->info.video_render(...)`.
- `plugins/linux-pipewire/pipewire.c:1358-1383`: `gs_blend_state_push(); gs_blend_function(GS_BLEND_ONE, GS_BLEND_INVSRCALPHA);` with no `gs_enable_blending(true)` before the cursor draw.
- `plugins/linux-capture/xcursor-xcb.c:105-115`: the same pattern for XSHM/XComposite cursors.
- `libobs/graphics/graphics.c:1255-1282`: blend push/pop saves and restores `enabled`, so enabling inside the push is safe.
- `plugins/win-capture/duplicator-monitor-capture.c:650,714` and `game-capture.c:1911-1928`: Windows sources explicitly toggle blending.

Slice plan:
- `plugins/linux-pipewire/pipewire.c`: inside the cursor block (after the main sprite, before `gs_draw_sprite` of the cursor), call `gs_enable_blending(true);`. The existing `gs_blend_state_pop()` restores the state. 1 line.
- `plugins/linux-capture/xcursor-xcb.c`: add `gs_enable_blending(true);` after `gs_blend_state_push();`. 1 line.
- Testing: Linux-only plugins. UNTESTED on this box.

Related: upstream #12091 (same symptom).

---

### [#13387](https://github.com/obsproject/obs-studio/pull/13387) — libobs: Fix Wayland push to talk (sort of)

**Verdict: DEFER_LARGE**

The underlying defect is real. On Wayland, `obs_nix_wayland_hotkeys_platform_is_pressed()` always returns `false`. The hotkey thread's `query_hotkeys()` then treats every key as released and resets push-to-talk bindings that were pressed via injected (focused) events. The PR's fix changes the cross-platform contract of `obs_hotkeys_platform_is_pressed` to a tri-state enum. It edits the Windows, macOS, X11 and Wayland back-ends and rewrites `inject_hotkey` semantics (press/release handling, modifiers-only bindings). It is 8 files and about 120 changed lines, still a draft, and it changes core hotkey behaviour on every platform. This needs maintainer design review and multi-platform testing, not a quick cherry-pick.

Evidence:
- `libobs/obs-nix-wayland.c` (`obs_nix_wayland_hotkeys_platform_is_pressed`): returns `false` unconditionally.
- `libobs/obs-hotkey.c` (`handle_binding`, around line 1053): `!pressed && !is_pressed(key)` resets the binding.
- PR diff: changes the signature in `libobs/obs-internal.h`, plus `obs-cocoa.m`, `obs-windows.c`, `obs-nix*.c` and `obs-hotkey.c`. Draft status.

Related: upstream #10701, #13169; #13610 (same file).

---

### [#13388](https://github.com/obsproject/obs-studio/issues/13388) — v4l2 input sets incorrect framerate

**Verdict: IMPLEMENT (new-change)**

The root cause is a 32-bit truncation in `v4l2_framerate_list()`: `int pack = v4l2_pack_tuple(num, denom);`. `v4l2_pack_tuple` returns `int64_t` via `PACK64(a, b) = (a << 32) | b`. For 1/30 the packed value is `0x1_0000001E`. Truncated to `int` it becomes `30`. `v4l2_unpack_tuple` then sees no high bits, takes the legacy 16-bit path, and decodes num=0, denom=30, so the requested rate is infinite. The driver then picks its maximum (60 fps), exactly as reported. The reporter's own experiment (hand-editing the JSON to 4294967326) confirms it. The resolution list passes the 64-bit value directly and is unaffected.

Evidence:
- `plugins/linux-v4l2/v4l2-input.c:590`: `int pack = v4l2_pack_tuple(frmival.discrete.numerator, frmival.discrete.denominator);`
- `plugins/linux-v4l2/v4l2-helpers.h:31`: `PACK64` is 64-bit. `v4l2-helpers.h:145-169`: pack returns `int64_t`, and unpack has the legacy 32-bit branch.
- `plugins/linux-v4l2/v4l2-input.c:543-544`: the resolution list passes the `int64_t` directly, which is correct.
- `git log -S PACK64`: 728cd5658 "Expand packed values to 4 bytes" introduced the 64-bit packing but missed this local.

Slice plan:
- Change `int pack` to `int64_t pack` at `plugins/linux-v4l2/v4l2-input.c:590`. 1 line.
- Testing: Linux-only. UNTESTED, but verified by arithmetic.

---

### [#13420](https://github.com/obsproject/obs-studio/issues/13420) — OBS unresponsive to mouse after docking or resizing panels on KDE Wayland

**Verdict: CANNOT_VERIFY**

After a dock drag or resize, mouse input stays grabbed by the dock machinery, while the keyboard and window decorations still work. That pattern matches a Qt Wayland pointer-grab issue in QDockWidget/QMainWindow separator handling (Qt 6.8.2 Flatpak runtime). The reporter notes that forcing XWayland fixes it. OBS uses stock `QDockWidget` and has no custom grab code in this path. There is nothing in OBS code to change.

Evidence:
- The workaround (disabling Wayland in Flatseal) points to the Qt Wayland QPA. OBS docks are plain `QDockWidget`s (`frontend/widgets/OBSBasic_Docks.cpp`).

Related: none.

---

### [#13441](https://github.com/obsproject/obs-studio/issues/13441) — Segfault on startup

**Verdict: CANNOT_VERIFY**

dmesg shows a NULL-ish Display dereference inside `libX11.so` (`segfault at d8`, a field read at offset 0xd8 of a NULL `Display*`) right after `[pipewire] No capture sources available`, on XFCE/X11 with NVIDIA. The command line `export LC_ALL=C | obs` and the locale warnings suggest an unusual environment. We have no backtrace naming the OBS caller and no log file, so we cannot tell which module passed a NULL display.

Evidence:
- The issue body shows the last log line before the crash and the dmesg line in libX11. No symbols.

Related: none.

---

### [#13464](https://github.com/obsproject/obs-studio/issues/13464) — OBS Blocks KDEPlasma Shutdown/Logout When Replay Buffer Active

**Verdict: OUT_OF_SCOPE (works as designed)**

OBS deliberately cancels a session-end request when outputs are active and "Confirm on exit" is enabled. This was added upstream in 260b5ae13 ("UI: Cancel session end request on commitDataRequest() signal"). `Active()` intentionally includes the replay buffer, because logging out discards the buffered replay. Users who want logout to proceed can turn off the existing ConfirmOnExit setting. Changing this is a product-behaviour decision, not a bug.

Evidence:
- `frontend/OBSApp.cpp:994,2024-2033`: `commitData` calls `manager.cancel()` when `shouldPromptForClose()`.
- `frontend/widgets/OBSBasic.cpp:1799-1806`: `shouldPromptForClose` requires ConfirmOnExit and `outputHandler->Active()`.
- `frontend/utility/BasicOutputHandler.hpp:96-100`: `Active()` includes `replayBufferActive`.

Related: #13003 (same exit-confirmation path).

---

### [#13480](https://github.com/obsproject/obs-studio/pull/13480) — linux-alsa: stop reopen thread before destroying abort_event

**Verdict: IMPLEMENT (partial-pr / adapted)**

`alsa_destroy()` sets `shutdown`, closes the handle, then `os_event_destroy(abort_event)` and `bfree(data)`, and never joins the reopen thread. If the device was missing, `_alsa_reopen` loops on `os_event_timedwait(abort_event, ...)`, which becomes a use-after-free on a destroyed event and on freed data. That is exactly the crash reported (`__pthread_mutex_cond_lock` from `os_event_timedwait`). The earlier fix 0820d804b added the `shutdown` flag, but that only makes `_alsa_open` return false. The thread keeps looping and is never signalled or joined.

The PR's single added call `_alsa_stop_reopen(data)` no longer applies, because of the context lines 0820d804b added. There is also a latent race. `_alsa_stop_reopen` signals only if `data->reopen` is already true, and the thread sets that flag itself after starting. If destroy runs in between, nothing is signalled. The thread's `_alsa_open` keeps failing because of `shutdown`, so `pthread_join` would hang forever. The adapted fix signals unconditionally during destroy.

Evidence:
- `plugins/linux-alsa/alsa-input.c:155-166`: destroy has no reopen-thread join.
- `plugins/linux-alsa/alsa-input.c:534-545`: `_alsa_stop_reopen` signals only `if (reopen)`.
- `plugins/linux-alsa/alsa-input.c:590-610`: `_alsa_reopen` loops on `os_event_timedwait`, and `_alsa_open` returns false while shutdown is set (line 362).
- `git apply --check` fails at `alsa-input.c:154` (context drift from 0820d804b).

Slice plan:
- In `alsa_destroy`, after `os_atomic_set_bool(&data->shutdown, true);`, add `os_event_signal(data->abort_event); _alsa_stop_reopen(data);`. Signalling first avoids the `reopen` flag race. The manual-reset event is reset inside `_alsa_stop_reopen` after the join. About 3 lines in `plugins/linux-alsa/alsa-input.c`.
- Credit the PR author (quine00) with a Co-authored-by trailer.
- Testing: Linux-only. UNTESTED here.

---

### [#13536](https://github.com/obsproject/obs-studio/pull/13536) — obs-scripting: Replace PySys_SetArgv with recent Python method

**Verdict: IMPLEMENT (cherry-pick-pr)**

`PySys_SetArgv` is deprecated and slated for removal in Python 3.15. Master calls it under a deprecation-warning pragma. The PR keeps the old path for Python < 3.8 and uses `PyConfig_InitPythonConfig`, `PyConfig_SetArgv` and `Py_InitializeFromConfig` for 3.8+. It also imports those symbols for the RUNTIME_LINK builds (Windows/macOS). It is 3 files, +96/-22 lines, and applies cleanly. The author tested only Linux. This Windows box can test exactly the RUNTIME_LINK path the PR asks testers for.

Caveats to record in the commit: under RUNTIME_LINK the `PyConfig` struct size varies by Python version, and the PR allocates 1024 bytes as a safe upper bound. `Py_SetPythonHome` (also deprecated) is still used just before; `PyConfig` honours it through the legacy path config in 3.8–3.14.

Evidence:
- `shared/obs-scripting/obs-scripting-python.c:1613-1648`: `Py_SetPythonHome`, `Py_Initialize`, then `PySys_SetArgv` under `PRAGMA_WARN_DEPRECATION`.
- `shared/obs-scripting/obs-scripting-python-import.c:137-148`: runtime imports include `PySys_SetArgv`.

Slice plan:
- Cherry-pick f60eb8efa and preserve authorship (tytan652).
- Testing: build `obs-scripting` with MSVC and a Windows Python 3.12/3.13 install, launch OBS, load a sample Python script (for example one that prints `sys.argv`), and confirm the Scripts dialog shows Python loaded. Linux and macOS are UNTESTED.

Related: upstream #13014.

---

### [#13610](https://github.com/obsproject/obs-studio/pull/13610) — libobs: Fix Wayland segfault on shutdown

**Verdict: IMPLEMENT (cherry-pick-pr)**

`obs_nix_wayland_hotkeys_platform_free()` frees `plat`, its xkb keymap and its xkb state. It never releases the `wl_keyboard` whose listener user-data is `plat`. Qt's Wayland event dispatch can still deliver `keymap` events after free. Those reach `rebuild_keymap_data` → `load_keymap_data` on freed memory, which is the reported stack. The PR calls `wl_keyboard_release(plat->keyboard)` first. The seat listener (`plat->seat`, user-data `plat`) and the registry also stay alive. Destroying them too (`wl_seat_release` for v≥5 or `wl_seat_destroy`, plus `wl_registry_destroy`) would close the same class of bug, and is an optional 4-line extension. It is 1 file, +2 lines, and applies cleanly.

Evidence:
- `libobs/obs-nix-wayland.c:252-259`: free never releases the keyboard, seat or registry.
- `libobs/obs-nix-wayland.c:171-184`: the keyboard is created with `wl_keyboard_add_listener(..., plat)`, and release already exists elsewhere (line 182).
- `libobs/obs-nix-wayland.c:204-211,244-247`: the seat and registry are bound with `plat` as listener data and never destroyed.

Slice plan:
- Cherry-pick 9ddf057e9 and preserve authorship (joepadmiraal). Optionally add a follow-up commit that destroys the seat (`wl_seat_release` when `wl_seat_get_version >= 5`, otherwise `wl_seat_destroy`).
- Testing: Linux/Wayland-only code. UNTESTED here.

Related: #13159, #13387.
