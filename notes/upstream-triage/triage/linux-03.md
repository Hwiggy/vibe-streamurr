# Upstream triage — batch linux-03

- Batch: linux-03 (area hint: linux)
- Items: 10767, 10958, 11022, 11140, 11145, 11156, 11252, 11371, 11564, 11570, 11580, 11633, 11636, 11815, 11819, 12026, 12048, 12081, 12082, 12139, 12142, 12276
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: issue/PR bodies from `notes/upstream-triage/data/all.json` (no comment threads), PR heads from `refs/upstream-pr/<N>`, code read on master. Local git is 2.33, which has no `merge-tree --write-tree`, so applicability was checked with the legacy 3-way form `git merge-tree $(git merge-base master PR) master PR` and counting conflict markers. No WebFetch calls were made.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 10767 | issue | CANNOT_VERIFY |
| 10958 | issue | CANNOT_VERIFY |
| 11022 | issue | DEFER_LARGE |
| 11140 | issue | CANNOT_VERIFY |
| 11145 | issue | CANNOT_VERIFY |
| 11156 | issue | CANNOT_VERIFY |
| 11252 | issue | OUT_OF_SCOPE |
| 11371 | PR | DEFER_LARGE |
| 11564 | PR | IMPLEMENT (cherry-pick) |
| 11570 | issue | OUT_OF_SCOPE |
| 11580 | issue | DEFER_LARGE |
| 11633 | issue | IMPLEMENT (new change) |
| 11636 | issue | OUT_OF_SCOPE |
| 11815 | PR | DEFER_LARGE |
| 11819 | issue | CANNOT_VERIFY |
| 12026 | PR | DEFER_LARGE |
| 12048 | issue | OUT_OF_SCOPE |
| 12081 | issue | IMPLEMENT (through the #12082 port) |
| 12082 | PR | IMPLEMENT (partial-pr / hand port) |
| 12139 | PR | IMPLEMENT (partial-pr: log-message commit only) |
| 12142 | PR | IMPLEMENT (partial-pr: redundant-check commit only) |
| 12276 | issue | CANNOT_VERIFY |

---

### [#10767](https://github.com/obsproject/obs-studio/issues/10767) — Segmentation fault Linux

**Verdict: CANNOT_VERIFY**

Reasoning: On Kali, opening the properties of a webcam (V4L2) source freezes and then segfaults. The third-party obs-backgroundremoval plugin is loaded. The terminal output shows only that the V4L2 device failed to open (ENOENT on a `/dev/v4l/by-id` path). There is no backtrace. A failed open in `v4l2_init` is handled cleanly by `goto fail` / `v4l2_terminate`, and the properties callback returns early when the open fails. Nothing in the report points to a defect in OBS code, and a third-party filter that runs ONNX inference is attached to the source.

Evidence:
- `plugins/linux-v4l2/v4l2-input.c:892-895`: a failed open logs "Unable to open device" and fails cleanly.
- `plugins/linux-v4l2/v4l2-input.c:617-623`: `device_selected` returns early when `v4l2_open` fails.

Related: none.

### [#10958](https://github.com/obsproject/obs-studio/issues/10958) — Xcomposite "resets" on every restart of the captured window

**Verdict: CANNOT_VERIFY**

Reasoning: After Overwatch (Wine/Proton) restarts, the Xcomposite source stays black until the user re-selects the window. The current code already re-acquires a lost window. Every `FIND_WINDOW_INTERVAL` it looks the window up again by id and then by name and class, and it rebuilds the pixmap whenever `gltex` is NULL. A black frame therefore most likely means the restarted game exposes a window whose name or class differs from the stored one at first, or that it binds to a transient launcher or splash window that matches. I could not find a defect in the matching logic without a log that shows the name and class at each stage.

Evidence:
- `plugins/linux-capture/xcomposite-input.c:289-331`: `xcomp_find_window` matches by id, then by name and class.
- `plugins/linux-capture/xcomposite-input.c:621-650`: periodic re-acquisition when the window is lost or `gltex` is NULL.

Related: #12139 (xcomposite black frame on unmap).

### [#11022](https://github.com/obsproject/obs-studio/issues/11022) — OBS crashes with explicit sync on wayland

**Verdict: DEFER_LARGE**

Reasoning: Upstream confirmed this issue. The code matches the reporter's analysis: on Wayland, OBS takes the QWindow's own `wl_surface` (`winId()`) and builds a `wl_egl_window`/EGL surface on it. Qt can still attach SHM buffers to the same surface, which is invalid under explicit sync. A fix needs one of two architectural changes: render into a dedicated `wl_subsurface` owned by libobs, or make Qt treat the window as an OpenGL/Vulkan surface. Either one touches `OBSQTDisplay`, the Wayland EGL backend and resize handling, and is hard to validate without a compositor that supports explicit sync.

Evidence:
- `frontend/widgets/OBSQTDisplay.cpp:50-53`: on Wayland, `gswindow.display = (void *)window->winId()` (Qt's wl_surface).
- `libobs-opengl/gl-wayland-egl.c:97-107`: `wl_egl_window_create(info->window.display, ...)` on that surface.

Related: none.

### [#11140](https://github.com/obsproject/obs-studio/issues/11140) — Start Recording fails after changing settings on Linux QuickSync

**Verdict: CANNOT_VERIFY**

Reasoning: This only reproduces with a Flatpak build on Intel QSV. The log link is external and the comment thread is not available. The QSV Linux path (`common_utils_linux.cpp`) opens VA-API devices for each encoder session, and I cannot tell from the code why the encoder fails to reinitialise after a settings change. The cause could be in libvpl, the driver, or the session lifetime. A log of the failing start would be needed.

Evidence:
- `plugins/obs-qsv11/common_utils_linux.cpp:26-28, 403-445`: static default device paths and VA-API open/close helpers.

Related: none.

### [#11145](https://github.com/obsproject/obs-studio/issues/11145) — A/V desync only when using projector mode

**Verdict: CANNOT_VERIFY**

Reasoning: Audio drifts with a DeckLink Intensity Pro 4K on an Ubuntu Studio low-latency kernel, and only while a fullscreen projector is open. The report is specific to that hardware and timing (projector vsync stalling the render loop is one possibility) and has no clear code path. It needs a repro on matching hardware.

Evidence: no code path identifiable from the report.

Related: none.

### [#11156](https://github.com/obsproject/obs-studio/issues/11156) — Segfault on start/stop of playback, related to pipewire/jack

**Verdict: CANNOT_VERIFY**

Reasoning: The report (which reaches its 6000-character limit in our data) contains startup output only. The crash backtrace is cut off. The reporter suspects pipewire-jack 1.2.2, which would be a third-party library bug. Without the frames, no defect in OBS code can be identified.

Evidence: body truncated before the backtrace; no OBS frames available.

Related: none.

### [#11252](https://github.com/obsproject/obs-studio/issues/11252) — Incorrect frame order with b-frames in h264 (VAAPI)

**Verdict: OUT_OF_SCOPE**

Reasoning: The reporter says the Flathub build of the same OBS version works correctly, while the Arch package and a third-party AUR build do not. The OBS source is the same in all of them, so the difference comes from the packaged FFmpeg or Mesa versions, which makes this a distro or driver problem.

Evidence: same OBS version, different packaging, different result (from the issue body).

Related: none.

### [#11371](https://github.com/obsproject/obs-studio/pull/11371) — linux-pipewire: Support MJPEG and H264 devices

**Verdict: DEFER_LARGE**

Reasoning: This is a new feature: about 405 changed lines, including a new `video-decoder.c/.h` that uses FFmpeg inside the PipeWire camera path. It is labelled "Seeking Testers", and the author says H.264 was never tested. It still merges cleanly (0 conflicts), but it is well beyond a small slice and cannot be exercised on this Windows machine.

Evidence:
- `git diff master...refs/upstream-pr/11371 --stat`: 5 files, +405/-56; new `plugins/linux-pipewire/video-decoder.c`.

Related: upstream #10180, #10994 (not in this batch).

### [#11564](https://github.com/obsproject/obs-studio/pull/11564) — linux-capture: Log error if adjusted size geometry is zero

**Verdict: IMPLEMENT (cherry-pick-pr)**

Reasoning: In `xshm_update_geometry`, crop values that are equal to or larger than the screen size produce `adj_width`/`adj_height` <= 0, and the user then only sees "failed to attach shm". The PR adds a 6-line `LOG_ERROR` that names the adjusted size and points at the crop settings. It merges cleanly and does not change behaviour.

Evidence:
- `plugins/linux-capture/xshm-input.c:140-162`: adj sizes are computed by subtracting the crops, with no lower bound.
- `plugins/linux-capture/xshm-input.c:164-170`: geometry is logged and then returns; there is no check on the adjusted size.
- Legacy merge-tree: 0 conflicts.

Slice: `git cherry-pick 3a1d71e84` (author dfaure-kdab, GPL-2.0-or-later, authorship kept). One file, +6 lines. Test plan: Linux-only source file, so it cannot be built on Windows MSVC (UNTESTED). Review by reading: the format macros match the `int_fast32_t` fields.

### [#11570](https://github.com/obsproject/obs-studio/issues/11570) — Lock screen is captured instead of desktop on KDE + Wayland

**Verdict: OUT_OF_SCOPE**

Reasoning: With PipeWire screencast, the compositor (KWin) decides what goes into the stream. OBS just imports the buffers it receives. If KWin keeps sending lock-screen frames after unlock, that is a KWin/xdg-desktop-portal-kde bug. OBS has no lock-screen-specific logic.

Evidence:
- `plugins/linux-pipewire/pipewire.c:712-760`: `process_video_sync` imports whatever buffer the stream supplies.

Related: none.

### [#11580](https://github.com/obsproject/obs-studio/issues/11580) — PipeWire "out of buffers" and render lag on Wayland

**Verdict: DEFER_LARGE**

Reasoning: "Out of buffers!" is a debug log from a process callback that found no dequeuable buffer, which is harmless by itself. The real symptom is render lag that grows with the number of PipeWire window captures. `process_video_sync` runs on the PipeWire thread and enters the libobs graphics context (`obs_enter_graphics`) for every frame of every stream to import DMA-BUFs. That contends with the render thread, and the contention scales with stream count. Fixing it means moving the import to `video_tick`/`video_render` (keep the latest `pw_buffer` and import it on the graphics thread) and reworking buffer return and explicit-sync release. That is a non-trivial refactor of `pipewire.c`.

Evidence:
- `plugins/linux-pipewire/pipewire.c:669, 725`: debug "Out of buffers!" logs.
- `plugins/linux-pipewire/pipewire.c:712-927`: sync processing does the graphics work inside the PW callback and ends with `obs_leave_graphics()` at :927.
- `plugins/linux-pipewire/pipewire.c:929-942`: `on_process_cb` dispatches straight from the PW thread.

Related: none.

### [#11633](https://github.com/obsproject/obs-studio/issues/11633) — V4L2 Camera Controls are saved but not applied

**Verdict: IMPLEMENT (new-change)**

Reasoning: The defect is confirmed in code. V4L2 camera controls (zoom, focus and so on) are stored in the source settings under the control's name. They are pushed to the device only by the property-modified callback `v4l2_control_changed`, which runs only while the properties dialog is open. `v4l2_init`, which runs at source creation, on settings changes and on udev reconnect, never applies them. After a restart or a replug, the device comes back with its own defaults, while OBS still shows the saved values.

Evidence:
- `plugins/linux-v4l2/v4l2-controls.c:35-68`: `VIDIOC_S_CTRL` is issued only from the property modified callback.
- `plugins/linux-v4l2/v4l2-controls.c:105-148`: `v4l2_update_controls` only builds properties and defaults.
- `plugins/linux-v4l2/v4l2-input.c:886-983`: `v4l2_init` sets input, standard, format and framerate, but no controls.
- `plugins/linux-v4l2/v4l2-input.c:740-749`: the udev reconnect path calls `v4l2_init`, which is the replug scenario in the issue.

Slice plan:
1. In `v4l2-controls.c`, add `void v4l2_apply_controls(int_fast32_t dev, obs_data_t *settings)`. It enumerates controls with `VIDIOC_QUERYCTRL | V4L2_CTRL_FLAG_NEXT_CTRL`, skips controls where `valid_control()` fails, and for INTEGER, BOOLEAN, MENU and INTEGER_MENU types with `obs_data_has_user_value(settings, name)` it calls `VIDIOC_S_CTRL` with the saved value. Do two passes, so that "auto" toggles (for example Focus, Auto at a higher CID than Focus, Absolute) are switched off before the dependent manual values are applied. Log failures at debug level.
2. Declare it in `v4l2-controls.h`.
3. In `v4l2_init` (`v4l2-input.c`), after the device is opened and the input set, call it with `obs_source_get_settings(data->source)` and release the settings afterwards.

About 45 lines across 3 files. Test plan: Linux-only plugin, so it cannot be built or run on this Windows machine (UNTESTED). A manual check on Linux would be: set Zoom, restart OBS or replug the camera, and confirm the value with `v4l2-ctl --get-ctrl`.

Related: upstream #3092 (closed).

### [#11636](https://github.com/obsproject/obs-studio/issues/11636) — Mouse cursor capture position slightly off in GNOME on Wayland

**Verdict: OUT_OF_SCOPE**

Reasoning: The PipeWire cursor metadata (`spa_meta_cursor.position`) is an integer `spa_point`. OBS stores it in `int x, y` and draws it at exactly that position. Any rounding of the sub-pixel cursor position (round rather than floor) therefore happens in Mutter before the metadata reaches OBS. OBS cannot recover the fractional position.

Evidence:
- `plugins/linux-pipewire/pipewire.c:118-124`: cursor x/y/hotspot are `int`.
- `plugins/linux-pipewire/pipewire.c:920-921`: copied straight from `cursor->position`.
- `plugins/linux-pipewire/pipewire.c:1371-1376`: drawn at `x - hotspot_x` with no further rounding.

Related: none.

### [#11815](https://github.com/obsproject/obs-studio/pull/11815) — frontend: Enforce Qt to have a DE-agnostic behavior on Linux

**Verdict: DEFER_LARGE (needs a design decision)**

Reasoning: The PR is small (9+/6-), but it is a policy change, not a bug fix. On every Linux launch it forces `QT_QPA_PLATFORMTHEME=xdgdesktopportal` and `QT_WAYLAND_DECORATION=bradient`, overriding user and distro choices. That changes file-dialog behaviour, which depends on portal availability, and window decorations across all desktop environments. Upstream left it open after 12 comments. It also no longer applies cleanly (1 conflict against the brace-style commit `30b63c684`). Adopting it locally is a UX decision about overriding the platform theme, and should not be bundled into a triage slice.

Evidence:
- `frontend/obs-main.cpp:517-525`: the current code only unsets the `qt5ct` theme.
- Legacy merge-tree: 1 conflict.

Related: none.

### [#11819](https://github.com/obsproject/obs-studio/issues/11819) — [Linux] FreeType2 text sometimes skips letters

**Verdict: CANNOT_VERIFY**

Reasoning: Upstream confirmed this issue. Glyphs are skipped when `src_glyph` is NULL at vertex build time. In `cache_glyphs`, that happens only when the 2048x2048 atlas is "Out of space" (it logs a warning) or when the font face is missing. The rotation script feeds short Cyrillic strings and should not fill the atlas. Reading the code, I could not pin down the exact cause (row packing with a growing `max_h`, a partially written file read mid-update, or a race between `update` and `tick`). The repro scripts are attachments that are not available here. This needs a debugging session on Linux.

Evidence:
- `plugins/text-freetype2/text-functionality.c:274-345`: glyph caching and atlas packing (`dy += max_h` versus `max_h + 1` inconsistency at :308 and :322).
- `plugins/text-freetype2/text-freetype2.c:290-305`: tick-driven reload from file, then `cache_glyphs` and `set_up_vertex_buffer`.

Related: none.

### [#12026](https://github.com/obsproject/obs-studio/pull/12026) — frontend: Simplify gpu enumeration

**Verdict: DEFER_LARGE**

Reasoning: This is a sound cleanup by a Linux maintainer. It replaces the heuristic libpci scan in `system-info-posix.cpp` with libobs' existing `gs_enum_adapters` (EGL render nodes), and it merges cleanly. However, it is about 400 changed lines (+86/-316) of Linux-only code that feeds Enhanced Broadcasting GPU telemetry. The author tested only on AMD and Intel. The new `get_card_info` calls `pci_get_dev` without a matching `pci_free_dev`, which leaks one device per adapter. It has no user-visible benefit and cannot be built or tested here, so it does not fit the small-slice criteria.

Evidence:
- `frontend/utility/system-info-posix.cpp:438-513`: current libpci heuristic.
- `libobs-opengl/gl-egl-common.c:202-235`: `gl_egl_enum_adapters` supplies DRM render-node paths (or "/Software").
- PR head `frontend/utility/system-info-posix.cpp:~270`: `pci_get_dev` with no `pci_free_dev`.

Related: none.

### [#12048](https://github.com/obsproject/obs-studio/issues/12048) — AMD VAAPI AV1 doesn't reach configured bitrate in CBR on VCN5 (RDNA4)

**Verdict: OUT_OF_SCOPE**

Reasoning: H.264 and HEVC through the same OBS FFmpeg-VAAPI encoder reach the configured bitrate. Only AV1 on the then brand-new RDNA4 VCN5, with a Mesa development build, undershoots. OBS passes the same rate-control parameters for every codec, so this is a Mesa/firmware rate-control issue (see the similar upstream #12013).

Evidence: codec-specific symptom on a pre-release driver; same OBS rate-control path for all VAAPI codecs.

Related: upstream #12013.

### [#12081](https://github.com/obsproject/obs-studio/issues/12081) — linux-v4l2: Distorted output when virtual camera has fixed format

**Verdict: IMPLEMENT (fixed by porting #12082)**

Reasoning: Root cause is confirmed. `try_connect` sends `VIDIOC_S_FMT` with OBS's output width and height, but ignores the format the driver returns. v4l2loopback devices with fixed caps (`set-caps`, or a device a reader already has open) adjust the size, while OBS keeps writing frames sized for its own output dimensions. The result is sheared, interleaved output.

Evidence:
- `plugins/linux-v4l2/v4l2-output.c:152-155`: `frame_size = width*height*2` uses OBS dimensions.
- `plugins/linux-v4l2/v4l2-output.c:186-192`: the `S_FMT` result is not read back.
- `plugins/linux-v4l2/v4l2-output.c:200-204`: video conversion is set to OBS dimensions.
- `plugins/linux-v4l2/v4l2-output.c:311-320`: `virtual_video` writes `frame_size` bytes.

Slice: see #12082.

Related: #12082.

### [#12082](https://github.com/obsproject/obs-studio/pull/12082) — linux-v4l2: Use VIDIOC_S_FMT return values in vcam

**Verdict: IMPLEMENT (partial-pr: hand port)**

Reasoning: The PR's idea is correct and small: after `VIDIOC_S_FMT`, check that the returned `pixelformat` is YUYV, then derive `frame_size` and the `video_scale_info` width and height from the returned `fmt.pix`, so libobs scales into the device's fixed size. It conflicts with master (1 conflict), because `try_connect` was restructured by `403f075a4` ("Fix vcam reset failure") and `12c6febae`. The change has to be applied by hand onto the current ordering (`S_PARM`, then `S_FMT`, then the STREAMON workaround), not cherry-picked.

Evidence:
- `plugins/linux-v4l2/v4l2-output.c:144-226`: current `try_connect`.
- Legacy merge-tree: 1 conflict.
- `git log -- plugins/linux-v4l2/v4l2-output.c`: `403f075a4`, `5533a277e`, `b540c47b8`, `12c6febae`.

Slice plan: in `try_connect`, after the `VIDIOC_S_FMT` ioctl succeeds:
- `goto fail_close_device` if `format.fmt.pix.pixelformat != V4L2_PIX_FMT_YUYV`, with a warning log.
- Set `vcam->frame_size = format.fmt.pix.sizeimage` (fall back to `bytesperline*height` when it is 0).
- Set `vsi.width = format.fmt.pix.width` and `vsi.height = format.fmt.pix.height`.
- Log when the device size differs from the OBS output size.

Remove the early `width*height*2` assignment, or keep it only as the requested `sizeimage`. About 15-20 lines in 1 file. Credit stephematician in the commit message, since the change is adapted from the PR. Test plan: Linux-only (v4l2loopback), so it cannot be built here (UNTESTED). The PR's manual repro is `v4l2loopback-ctl set-caps /dev/videoN "YUYV:640x360"` followed by `ffplay`.

Related: #12081, #12142 (same file).

### [#12139](https://github.com/obsproject/obs-studio/pull/12139) — xcomposite-input: Add a backup texture to store previous contents of a window

**Verdict: IMPLEMENT (partial-pr: only commit `fbd1ce15c`, the descriptive BadMatch log)**

Reasoning: The PR has two commits.

- **Main commit `fbdbfb0b6` (backup texture): not adopted.** It does not do what it claims. `backup_gltex` is created with `gs_texture_create_from_pixmap` on the same pixmap as `gltex`, so it is not a copy. It is a second texture-from-pixmap binding that becomes invalid once `xcomp_cleanup_pixmap` frees the pixmap. It is also a UX behaviour change (freezing the last frame instead of going black) that would need maintainer agreement.
- **Second commit (adopted).** It distinguishes `XCB_MATCH` (window unmapped/unviewable) from other `xcb_composite_name_window_pixmap` failures in the log. That is a small, safe diagnostics improvement.

While porting, also `free(err)` on both error paths of `xcomp_create_pixmap`. `xcb_request_check` and `xcb_get_geometry_reply` return heap-allocated errors that are currently leaked, and in the error branch `geom` is NULL.

Evidence:
- `plugins/linux-capture/xcomposite-input.c:353-360`: geometry error path returns without freeing `err`.
- `plugins/linux-capture/xcomposite-input.c:379-385`: the name-pixmap failure logs a generic message and leaks `err`.
- `plugins/linux-capture/xcomposite-input.c:333-344`: cleanup frees the pixmap, which a "backup" binding would depend on.
- Legacy merge-tree of the full PR: 0 conflicts. Commit 2 alone depends on commit 1's reshuffle of the `name_cookie` lines, so hand-port it (about 8 lines).

Slice plan: in `xcomp_create_pixmap`, log "window is not viewable (unmapped/minimized/other workspace)" when `err->error_code == XCB_MATCH`, otherwise keep the generic message, and `free(err)` on both error returns. Credit Armagidon for the message idea. Test plan: Linux-only, so it cannot be built here (UNTESTED).

Related: #10958, upstream #4160.

### [#12142](https://github.com/obsproject/obs-studio/pull/12142) — linux-v4l2: Consolidate non-linux virtual camera procedure

**Verdict: IMPLEMENT (partial-pr: cherry-pick only `7f34ab214`)**

Reasoning: The PR has two commits.

- **Commit 1, `7f34ab214` "Remove redundant test on device name" (adopted).** This is a pure cleanup. On non-Linux, `virtualcam_start` re-checks that the dirent name starts with "video", but `scanfilter` already does exactly that for every platform.
- **Commit 2, `23cf35d4a` (not adopted).** It makes `loopback_module_available()` always return true on non-Linux (FreeBSD). The virtual camera button would then always be registered even when no output device exists, which is a behaviour trade-off for a platform we cannot test. The PR's own testing section was still "TODO".

Evidence:
- `plugins/linux-v4l2/v4l2-output.c:228-231`: `scanfilter` matches the `video` prefix.
- `plugins/linux-v4l2/v4l2-output.c:270-274`: the redundant `#if !defined(__linux__)` strstr check.
- `plugins/linux-v4l2/v4l2-output.c:106-129`: the non-Linux `loopback_module_available` probe, kept as is.
- Legacy merge-tree: 0 conflicts.

Slice: `git cherry-pick 7f34ab214` (stephematician, -5 lines). Test plan: non-Linux (BSD) code path, so it cannot be built here (UNTESTED). The change only removes a duplicate condition.

Related: #12082 (same file, apply #12082's port and this in either order).

### [#12276](https://github.com/obsproject/obs-studio/issues/12276) — Mouse 4 and Mouse 5 hotkeys not working on Linux

**Verdict: CANNOT_VERIFY**

Reasoning: The Qt-side mapping (ExtraButton1/2 to MOUSE4/5) and the XInput2 raw-event mapping (detail 8/9 to index 7/8) are both correct, and MOUSE3 works through the same path, so the mapping itself is not the bug. I found three suspects, but none of them is proven to cause this symptom:

- **No XI version negotiation.** The code never calls `xcb_input_xi_query_version` (it should request 2.2). The server therefore treats OBS as an XI 2.0 client, and in XI 2.0 raw events are not delivered while another client holds a grab. Browsers and window managers commonly grab back/forward buttons, which fits "only works sometimes / only for a fraction of a second".
- **Press and release in one batch.** A release event does not clear `pressed[]`, so a press and release in the same poll batch leaves `button_pressed` set.
- **Wrong mask constant.** The GE check masks with `~80` (decimal) instead of `~0x80`.

The reporter's desktop (X11 or XWayland) is unknown, and I could not tie the symptom to a single defect, so I am not implementing a fix. A candidate experiment for later is adding `xi_query_version(2,2)` in `registerMouseEvents`.

Evidence:
- `libobs/obs-nix-x11.c:823-840`: `registerMouseEvents` selects raw events on root with no XIQueryVersion.
- `libobs/obs-nix-x11.c:877-1012`: `mouse_button_pressed`: `~80` mask at :887, and the release does not reset `pressed[]` at :900-906.
- `frontend/OBSApp.cpp:203-208`, `frontend/settings/OBSHotkeyEdit.cpp:108-113`: ExtraButton mapping is correct.

Related: upstream #8517, #4843.
