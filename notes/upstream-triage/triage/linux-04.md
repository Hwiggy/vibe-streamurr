# Upstream triage — batch linux-04

- Batch: linux-04 (area hint: linux)
- Items: 12279, 12293, 12302, 12406, 12423, 12424, 12426, 12428, 12448, 12481, 12506, 12508, 12509, 12521, 12522, 12587, 12752, 12835, 12864, 12883, 12908, 12929
- Date: 2026-10-26
- Base commit: 72e866557 (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; PR heads from `refs/upstream-pr/<N>`; code read on master. No GitHub API / WebFetch used.
- Note on conflict checks: local git is 2.33 which lacks `merge-tree --write-tree`; conflicts were checked with the legacy 3-way form `git merge-tree $(git merge-base master PR) master PR` and counting `+<<<<<<<` markers.

Summary

| # | Kind | Verdict |
|---|------|---------|
| 12279 | issue | CANNOT_VERIFY |
| 12293 | PR | ALREADY_ADDRESSED (superseded by #12302, which we take) |
| 12302 | PR | IMPLEMENT (cherry-pick) |
| 12406 | issue | CANNOT_VERIFY |
| 12423 | issue | CANNOT_VERIFY |
| 12424 | PR | CANNOT_VERIFY |
| 12426 | issue | CANNOT_VERIFY |
| 12428 | issue | CANNOT_VERIFY |
| 12448 | PR | CANNOT_VERIFY |
| 12481 | PR | DEFER_LARGE |
| 12506 | issue | ALREADY_ADDRESSED |
| 12508 | issue | CANNOT_VERIFY |
| 12509 | PR | IMPLEMENT (cherry-pick) |
| 12521 | issue | CANNOT_VERIFY |
| 12522 | PR | DEFER_LARGE |
| 12587 | issue | OUT_OF_SCOPE |
| 12752 | PR | DEFER_LARGE |
| 12835 | issue | CANNOT_VERIFY |
| 12864 | PR | IMPLEMENT (cherry-pick) |
| 12883 | issue | OUT_OF_SCOPE |
| 12908 | issue | OUT_OF_SCOPE |
| 12929 | issue | IMPLEMENT (via #12302) |

---

### [#12279](https://github.com/obsproject/obs-studio/issues/12279) — [Linux] Safe start dialog after previously shutting down system while OBS was minimized to tray

**Verdict: CANNOT_VERIFY**

Reporter (CachyOS/KDE Wayland, 31.0.3) gets the unclean-shutdown dialog after rebooting while OBS sits in the tray. Current code already has a POSIX SIGTERM path that saves and quits, plus a Qt session-manager `commitDataRequest` hook. Whether the session ends via SIGTERM, session manager, or a SIGKILL after a timeout depends on the desktop. Nothing in the code points to a tray-specific defect, and without a log of the shutdown sequence the root cause cannot be identified.

Evidence:
- `frontend/obs-main.cpp:896-897`: SIGINT/SIGTERM handlers installed.
- `frontend/OBSApp.cpp:1936-1956`: `processSigTerm()` calls `saveAll()` then `quit()`, whether or not the window is visible.
- `frontend/OBSApp.cpp:994`, `2024-2033`: `commitData` saves on session end.
- `frontend/widgets/OBSBasic.cpp:1575-1595`: closeEvent visibility/ignore logic (tray path).

Related: none.

### [#12293](https://github.com/obsproject/obs-studio/pull/12293) — libobs: Fix error when used with wayland multi-seat

**Verdict: ALREADY_ADDRESSED (superseded by #12302)**

This is a one-line fix: call `wl_seat_get_keyboard(seat)` instead of `plat->seat`. The bug it targets is real (see #12302). #12302 includes the same fix and also stops a different seat from releasing the active keyboard. We take #12302 and do not cherry-pick #12293 separately, so we don't get two overlapping changes to the same lines. The author's own description says it is untested and that keyboard removal stays broken.

Evidence:
- `libobs/obs-nix-wayland.c:179`: `wl_seat_get_keyboard(plat->seat)` uses the last bound seat, not the seat in the callback.
- `libobs/obs-nix-wayland.c:210-211`: `plat->seat` is overwritten each time a seat global is bound.
- `git diff master...refs/upstream-pr/12293`: 1 line changed, applies cleanly.

Related: #12302, #12929.

### [#12302](https://github.com/obsproject/obs-studio/pull/12302) — libobs: Ensure wayland seat and keyboard are synced

**Verdict: IMPLEMENT (cherry-pick-pr)**

Root cause confirmed on master. `platform_registry_handler` binds every `wl_seat` global into the single `plat->seat`, so the last seat bound wins. `platform_seat_capabilities` ignores its `seat` argument. When seat A reports the keyboard capability, it calls `wl_seat_get_keyboard(plat->seat)`, which may be seat B. Seat B has no keyboard, so this is a protocol error and libwayland kills the client (upstream #12237 / #12929). The PR binds each seat locally and records `plat->seat` only when that seat provides the keyboard. It also releases the keyboard only when *that* seat loses the capability. `plat->seat` is not used anywhere else, so the change is self-contained. 6+/3-, clean merge.

Evidence:
- `libobs/obs-nix-wayland.c:171-184`: capabilities callback ignores `seat` (`UNUSED_PARAMETER(seat)`).
- `libobs/obs-nix-wayland.c:204-212`: every seat is bound into `plat->seat`.
- `grep plat->seat libobs/obs-nix-wayland.c`: used only at lines 179, 210 and 211.
- Legacy merge-tree: 0 conflict markers.

Slice plan:
- `git cherry-pick -x 0f1c93763` (refs/upstream-pr/12302), keeping the author.
- Files: `libobs/obs-nix-wayland.c` (~9 lines).
- Test: this Windows box cannot build or run the Wayland backend (`obs-nix-wayland.c` is Linux-only), so mark it **UNTESTED** in the commit body. Optionally check that the MSVC libobs build is unaffected (the file is not compiled there).

Related: #12293 (superseded), #12929 (issue fixed by this).

### [#12406](https://github.com/obsproject/obs-studio/issues/12406) — Unclean shutdown on Ubuntu when YouTube Live Control Panel dock is docked

**Verdict: CANNOT_VERIFY**

Crash on exit when the YouTube Live Control Panel browser dock is docked (Ubuntu PPA 31.1.1). The crash stack is in an external gist we cannot see. The dock is a CEF browser dock from the obs-browser submodule plus the YouTube integration in frontend. Without the stack we can't tell whether the shutdown-order problem is in frontend dock teardown or in CEF/obs-browser. The browser submodule has moved since then (2.27.4 at HEAD).

Evidence:
- `git log -2 master`: obs-browser bumped to 2.27.3/2.27.4 (95d5223b6, f1c0a1164), so the crash may have shifted since 31.1.1.
- No stack trace available offline.

Related: none.

### [#12423](https://github.com/obsproject/obs-studio/issues/12423) — Screen Capture (Pipewire) remains frozen after waking the computer from sleep

**Verdict: CANNOT_VERIFY**

Reported on 30.2.3 (Pop!_OS 22.04). After resume, the stream stays paused. OBS only logs PipeWire stream state changes; it does not drive the state, which the compositor/portal controls. Whether the compositor ever resumes the stream, or OBS should re-negotiate, would need a log from a recent version. No code defect could be identified.

Evidence:
- `plugins/linux-pipewire/pipewire.c:1065-1076`: `on_state_changed_cb` only logs the state. There is no reconnect-on-paused logic, but any such logic would be a design decision, not a bug fix.

Related: none.

### [#12424](https://github.com/obsproject/obs-studio/pull/12424) — linux-pipewire: Fix render technique in captures again

**Verdict: CANNOT_VERIFY**

This is the third attempt at the PipeWire colour/sRGB render path. Earlier attempts are already in history: f614064eb "Fix render technique in captures", and 4dfd0b31e "Fix 10- and 16-bit captures", which was reverted in 24597a7b8 with a FIXME. The PR adds `OBS_SOURCE_SRGB`, forces a `DrawSrgbDecompress` technique, and changes the dmabuf import format. The result depends on GPU, driver and compositor (8-bit vs 10-bit, HW cursor). Upstream labels it "Seeking Testers", it has a merge conflict on master, and we cannot test any of this on this Windows box. Given the earlier regression and revert, we should not take it blind.

Evidence:
- `plugins/linux-pipewire/pipewire.c:1341-1342`: FIXME left by the revert.
- `git show 24597a7b8`: revert of the previous similar change.
- Legacy merge-tree: 1 conflict block.

Related: #12426 (possible symptom), #12448 (touches the same dmabuf line).

### [#12426](https://github.com/obsproject/obs-studio/issues/12426) — The Chromakey filter for the PipeWire Screen Capture source does not work

**Verdict: CANNOT_VERIFY**

The only detail is a video. A likely explanation is the PipeWire source's colour-space/sRGB handling (the source does not declare `OBS_SOURCE_SRGB`, so filters see wrong gamma). That is the area #12424 tries to fix, but we cannot confirm it from the report.

Evidence:
- `plugins/linux-pipewire/screencast-portal.c:739`: `output_flags = OBS_SOURCE_VIDEO | OBS_SOURCE_DO_NOT_DUPLICATE` (no SRGB flag).
- `plugins/linux-pipewire/pipewire.c:1341-1342`: colorimetry FIXME.

Related: #12424.

### [#12428](https://github.com/obsproject/obs-studio/issues/12428) — [Linux] Heavy Audio crackling when recording, happens every "x" amount of minutes

**Verdict: CANNOT_VERIFY**

Intermittent crackling on Fedora with PipeWire. No reliable repro, and the evidence is only YouTube timestamps. This could be timestamp drift/resampling in the PulseAudio/PipeWire capture or a PipeWire/hardware issue, and nothing in the report narrows it to a code path.

Evidence: body only; no specific code path can be identified.

Related: #12835.

### [#12448](https://github.com/obsproject/obs-studio/pull/12448) — linux-pipewire: Replace swap r/b with opaque draw

**Verdict: CANNOT_VERIFY**

This is a refactor/enhancement, not a bug fix. It drops the OpenGL texture swizzle (and the glad dependency) in favour of an RGBA format with an opaque draw technique, and changes the dmabuf import format. It applies cleanly (49+/42-, 5 files). However, it changes rendering output on Linux GPUs. Upstream marks it "Seeking Testers", and it overlaps the same render code as #12424, which also has a revert history. Its value is cleanup, so it does not justify an untestable GPU-path change in our fork.

Evidence:
- `plugins/linux-pipewire/pipewire.c:289-296`: `swap_texture_red_blue` uses `glTexParameteri` swizzle.
- `plugins/linux-pipewire/pipewire.c:859-860, 916-917`: call sites.
- `plugins/linux-pipewire/CMakeLists.txt:41`: links `OBS::glad`.
- Legacy merge-tree: 0 conflicts.

Related: #12424.

### [#12481](https://github.com/obsproject/obs-studio/pull/12481) — obs-qsv11: Dynamic bitrate control support update

**Verdict: DEFER_LARGE**

Master already supports runtime updates through `obs_qsv_update` → `UpdateParams` → `MFXVideoENCODE::Reset`. This PR reworks the reset to flush the async pipeline (135+/53- across 4 files) to fix a problem specific to Intel Arc A770 with Enhanced Broadcasting. It has 5 conflict blocks with master, partly from the "Update C++ files with braces" reformat (30b63c684). Validating it needs Intel hardware.

Evidence:
- `plugins/obs-qsv11/obs-qsv11.c:735`, `789`: `obs_qsv_update` exists.
- `plugins/obs-qsv11/QSV_Encoder_Internal.cpp:468-482`: `UpdateParams` → `Reset`.
- Legacy merge-tree: 5 conflict blocks.

Related: none in this batch (upstream #12097 Enhanced Broadcasting).

### [#12506](https://github.com/obsproject/obs-studio/issues/12506) — Linux: Stopping Virtual Camera Requires v4l2loopback Restart to Restart Virtual Camera

**Verdict: ALREADY_ADDRESSED**

The regression started in 31.1.0 with the caps-reset logic from upstream PR #11906. Commit 403f075a4 "linux-v4l2: Fix vcam reset failure" (2025-08-16, two days after this issue; first in 32.2.0-beta1) reverts most of that logic. It now probes with STREAMON once and caches the result in a static `use_caps_workaround`, then sends STREAMOFF on stop when needed.

Evidence:
- `git show 403f075a4`: "Reverts much of PR #11906 ...", touches `plugins/linux-v4l2/v4l2-output.c`.
- `plugins/linux-v4l2/v4l2-output.c:195-213`: STREAMON detection/workaround.
- `plugins/linux-v4l2/v4l2-output.c:293-297`: STREAMOFF + close on stop.

Related: none.

### [#12508](https://github.com/obsproject/obs-studio/issues/12508) — V4L2 input does not close while recording

**Verdict: CANNOT_VERIFY**

Changing V4L2 resolution/framerate while recording freezes the device until recording stops. On master, `v4l2_update` → `v4l2_terminate` joins the thread, destroys the decoder, unmaps the buffers and calls `v4l2_close` regardless of output state. `obs_source_output_video` copies frames into libobs' cache, so OBS should not be holding the mmap buffers. We could not find any recording-dependent path in the plugin. The reporter suspects a kernel/libv4l2 effect, and it needs a repro with debug logs.

Evidence:
- `plugins/linux-v4l2/v4l2-input.c:832-849`: `v4l2_terminate` tears down unconditionally.
- `plugins/linux-v4l2/v4l2-input.c:1037-1064`: `v4l2_update` restart path.

Related: #12864 (same plugin, different issue).

### [#12509](https://github.com/obsproject/obs-studio/pull/12509) — linux-pipewire: Support enumerated camera sizes

**Verdict: IMPLEMENT (cherry-pick-pr)**

On master, `camera_format_list` parses `SPA_FORMAT_VIDEO_size` with `SPA_POD_Rectangle`. If a PipeWire node advertises its sizes as an `SPA_CHOICE_Enum` pod, the parse fails and the whole format is skipped (`continue`), so those cameras show no modes. (The PR's "uninitialized" concern from the `SPA_POD_OPT_` era no longer applies, but the missing modes are still a defect.) The PR adds a small helper, `get_values_from_pod`, that handles None/Enum choices. It uses the helper for both sizes and framerates and removes duplicated switch blocks: 74+/88-, single file, 0 conflicts.

Caveat to record in the commit: `framerate_list()` still parses `this_resolution` with `SPA_POD_Rectangle` (`camera-portal.c:679-681`). For enum-size nodes the per-resolution framerate list may therefore stay empty, which is no worse than today. A second behaviour change: Range/Step framerates used to skip the format with a warning, and now list it without FPS.

Evidence:
- `plugins/linux-pipewire/camera-portal.c:368-370`: format skipped when size isn't a plain Rectangle.
- `plugins/linux-pipewire/camera-portal.c:679-681`: same in `framerate_list`.
- `git diff master...refs/upstream-pr/12509 --stat`: 1 file, 162 lines.
- `cmake/linux/compilerconfig.cmake:29`: `-Wno-shadow`, so the PR's shadowed loop variable `i` builds cleanly.

Slice plan:
- `git cherry-pick -x 3bd9c39dc 4f27c72cd` (simplify framerate extraction, then support enumerated sizes), keeping the author.
- Files: `plugins/linux-pipewire/camera-portal.c`.
- Test: Linux-only plugin, so it cannot be built or run on this Windows box. Mark **UNTESTED** and note the `framerate_list` caveat.

Related: none.

### [#12521](https://github.com/obsproject/obs-studio/issues/12521) — [Linux] Multiple USB sources black screen on startup

**Verdict: CANNOT_VERIFY**

Flatpak on Debian 13 with three USB cameras on one controller. At random, some cameras are black at startup until a property is touched, which restarts the device. This looks like USB bandwidth/ordering or a device-init race. Changing a property re-runs `v4l2_init`. No defect is identifiable without logs of the failing init, and we have no hardware to reproduce it.

Evidence:
- `plugins/linux-v4l2/v4l2-input.c:874-970`: `v4l2_init` (open/format/mmap/thread), with no retry on silent no-frame.

Related: #12508.

### [#12522](https://github.com/obsproject/obs-studio/pull/12522) — obs-ffmpeg: AMD Support on Linux with AMF

**Verdict: DEFER_LARGE**

This is a new feature: AMF encoders on Linux, with Vulkan device sharing, Flatpak changes and a libobs hang fix. It is 1564+/459- across 13 files, upstream labels it `needs/design`, and it has about 25 conflict blocks against master. It needs AMD hardware and the AMF runtime. Far beyond a small slice.

Evidence:
- `git diff master...refs/upstream-pr/12522 --stat`: 13 files, ~2000 lines.
- Legacy merge-tree: 25 conflict blocks.

Related: none.

### [#12587](https://github.com/obsproject/obs-studio/issues/12587) — "Display" Capture Mode Fails to Handle Monitor Scaling [Linux / Cinnamon Desktop]

**Verdict: OUT_OF_SCOPE**

The 4096x2304 size is exactly 2560x1440 x 1.6 (render at 2x, then scale by 1/1.25). That is how Cinnamon's X11 fractional scaling works: it enlarges the X framebuffer and downsamples with an xrandr transform. XSHM capture reads the real X root/CRTC geometry, so OBS reports what the X server exposes. Fitting it into the canvas is a configuration matter (canvas size / "Fit to screen" transform), not an OBS defect. The report is also on old 30.2.3 (Mint 21.3).

Evidence:
- `plugins/linux-capture/xhelpers.c:98-150`: geometry is taken from RandR monitors/CRTCs.

Related: none.

### [#12752](https://github.com/obsproject/obs-studio/pull/12752) — Add a VST3 host filter to obs-studio

**Verdict: DEFER_LARGE**

A new plugin, obs-vst3: about 4656 added lines across 29 files, plus a new third-party dependency (Steinberg VST3 SDK, now MIT dual-licensed, so license-compatible), CI and build-aux changes, and a separate scanner executable. It applies cleanly, but it is a large new feature with a new dependency. That breaks the "no new dependency / small slice" rule and needs per-platform testing (Windows only here).

Evidence:
- `git diff master...refs/upstream-pr/12752 --stat`: 29 files, +4656.
- Commits include "cmake: Add VST3 SDK find module" and "CI: Update build setup scripts for VST3".

Related: none.

### [#12835](https://github.com/obsproject/obs-studio/issues/12835) — Mic stutter/cutting for over 3 years of recording videos on linux/pipewire

**Verdict: CANNOT_VERIFY**

Intermittent mic cut-outs with USB audio interfaces on PipeWire (Flatpak 32.0.2), which the reporter could not reproduce on demand. The reporter also filed it with PipeWire (gitlab pipewire#4985). No log captures the event, so no code path can be identified.

Evidence: body only.

Related: #12428.

### [#12864](https://github.com/obsproject/obs-studio/pull/12864) — linux-v4l2: Fix H.264 decoding artifacts at high resolution

**Verdict: IMPLEMENT (cherry-pick-pr)**

Confirmed defect on master. When `avcodec_receive_frame` returns `EAGAIN`, `v4l2_decode_frame` returns `0` (success) without filling `out`. `v4l2_thread` then still calls `obs_source_output_video(&out)`, but `out.data[]` still points at the previous `AVFrame` planes, which `avcodec_receive_frame` has already unreferenced. The result is stale or garbage frames. The PR returns the error code and makes the thread skip output on `EAGAIN` (re-queue the buffer). It also enables decoder threading (`thread_count = 0`, `FF_THREAD_FRAME`), in line with win-dshow's decoder, which already uses `thread_count = 0`. The change is 10+/8- across 2 files and merges cleanly. Note: frame threading can add a few frames of decode latency for MJPEG/H.264 webcams. Record this in the commit as a known trade-off.

Evidence:
- `plugins/linux-v4l2/v4l2-decoder.c:94-98`: EAGAIN → `return 0` with no frame.
- `plugins/linux-v4l2/v4l2-input.c:259-266`: output happens unconditionally after decode success.
- `plugins/win-dshow/ffmpeg-decode.c:80`: `thread_count = 0` precedent.
- Legacy merge-tree: 0 conflicts.

Slice plan:
- `git cherry-pick -x 42975191a`, keeping the author.
- Files: `plugins/linux-v4l2/v4l2-decoder.c`, `plugins/linux-v4l2/v4l2-input.c`.
- Test: linux-v4l2 does not build on Windows, so mark **UNTESTED** (no V4L2 hardware, no Linux build).

Related: #12508 (same plugin, unrelated).

### [#12883](https://github.com/obsproject/obs-studio/issues/12883) — OBS Flatpak causing issues with some USB devices if they are replugged via hardware KVM

**Verdict: OUT_OF_SCOPE**

Mouse/keyboard replugged through a KVM aren't recognised by the system while OBS (Flatpak) runs, and the problem appears only after hours or days. OBS never opens HID/evdev devices. Hotkeys use the Wayland `wl_keyboard` or X11 xcb, and the only udev use is the V4L2 video device monitor. Device enumeration failure at OS level points to the kernel, udev or Flatpak sandbox (portal), not OBS code.

Evidence:
- `libobs/obs-nix-wayland.c:171-184`: keyboard via the Wayland seat only.
- `plugins/linux-v4l2/v4l2-input.c:858-869`: udev usage limited to video device add/remove signals.

Related: none.

### [#12908](https://github.com/obsproject/obs-studio/issues/12908) — OBS v4l2-input errno: Device or resource busy

**Verdict: OUT_OF_SCOPE**

This is a support/environment problem. It started after a system update, and the reporter then switched to the distro-repackaged Ubuntu build (32.0.2.1-3build1), which upstream does not support. They also report unrelated crashes (Window Capture, missing docks). EBUSY on open/format means another process, or a stale OBS instance, holds the device. Nothing points to a code defect.

Evidence:
- `plugins/linux-v4l2/v4l2-input.c:880-884`: open failure path just logs errno.

Related: #12508, #12521.

### [#12929](https://github.com/obsproject/obs-studio/issues/12929) — wayland/crash in multi seat environments: wl_seat.get_keyboard called when no keyboard capability has existed

**Verdict: IMPLEMENT (via #12302)**

This reposts upstream #12237. The crash is a libwayland protocol error from `wl_seat_get_keyboard` on a seat without the keyboard capability. Confirmed in code: the capability callback ignores which seat fired it and uses the last bound seat (see #12302). Cherry-picking #12302 fixes it.

Evidence:
- `libobs/obs-nix-wayland.c:171-184`, `204-212`.

Slice plan: same as #12302 (cherry-pick 0f1c93763). Reference #12929 and #12237 in the commit body. **UNTESTED** (Linux/Wayland only).

Related: #12302, #12293.
