# Triage batch linux-01

- Batch: linux-01 (area hint: linux)
- Items: 3929, 4219, 5377, 5383, 5422, 5439, 5445, 5820, 6207, 6283, 6546, 6669, 7134, 7314, 7483, 7517, 8008, 8171, 8529, 8699, 9244, 9324
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; PR heads from `refs/upstream-pr/<N>`; code inspected on master. No GitHub API or WebFetch calls were made for this batch.
- Applicability check: the local git is 2.33, which has no `merge-tree --write-tree`, so each PR was checked with `git diff master...refs/upstream-pr/N | git apply --check` (read-only). **None of the 10 PRs in this batch apply cleanly.** Many still target the pre-rename `UI/` tree, which is now `frontend/`.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 3929 | issue | IMPLEMENT (via #8008 slice) |
| 4219 | PR | DEFER_LARGE |
| 5377 | PR | DEFER_LARGE |
| 5383 | PR | DEFER_LARGE |
| 5422 | issue | IMPLEMENT |
| 5439 | issue | CANNOT_VERIFY |
| 5445 | issue | DEFER_LARGE |
| 5820 | issue | CANNOT_VERIFY |
| 6207 | PR | DEFER_LARGE |
| 6283 | issue | DEFER_LARGE |
| 6546 | PR | DEFER_LARGE |
| 6669 | PR | DEFER_LARGE |
| 7134 | issue | CANNOT_VERIFY |
| 7314 | issue | CANNOT_VERIFY |
| 7483 | issue | CANNOT_VERIFY |
| 7517 | PR | IMPLEMENT (minimal single-seat fix, not the PR itself) |
| 8008 | PR | IMPLEMENT (partial-pr / port) |
| 8171 | PR | DEFER_LARGE |
| 8529 | PR | DEFER_LARGE |
| 8699 | issue | CANNOT_VERIFY |
| 9244 | issue | IMPLEMENT |
| 9324 | issue | CANNOT_VERIFY |

---

### [#3929](https://github.com/obsproject/obs-studio/issues/3929) — v4l2 Virtual camera - Loopback device conflicts (Including droidcam)

**Verdict: IMPLEMENT** (fixed by porting PR #8008)

Reasoning: When another program (droidcam) has already loaded `v4l2loopback` with its own card, OBS does not load the module again because it is already loaded. It then takes the first output-capable `/dev/video*` that accepts `S_FMT`/`S_PARM`. It never creates or prefers its own "OBS Virtual Camera" card. If the foreign card is busy or not usable, starting the virtual camera fails with no user-visible error. PR #8008 changes the selection: prefer a card labelled "OBS Virtual Camera", add one with `v4l2loopback-ctl add` when it is missing, and only then fall back to any card. That is the root cause behind this report.

Evidence:
- `plugins/linux-v4l2/v4l2-output.c:239-242`: the module load is skipped whenever any `v4l2loopback` is loaded, including one loaded by droidcam.
- `plugins/linux-v4l2/v4l2-output.c:256-274`: the first device where `try_connect` succeeds wins. The card label is never checked.
- `plugins/linux-v4l2/v4l2-output.c:163-167`: only the output capability is checked, not `capability.card`.

Related: #8008 (fix), #8171 (builds on #8008), #5377/#5383 (alternative PipeWire vcam).

Slice: see #8008.

---

### [#4219](https://github.com/obsproject/obs-studio/pull/4219) — Add network interface binding for RTMP on Linux

**Verdict: DEFER_LARGE**

Reasoning: This is a draft "Seeking Testers" PR: 3 commits, 13 files, +225/-8. It touches librtmp (`SO_BINDTODEVICE`), rtmp-stream, and a new settings UI combobox with cascading logic between the interface and IP fields. It targets the old `UI/` tree (`UI/window-basic-settings.cpp`, `UI/forms/OBSBasicSettings.ui`), which no longer exists, so the UI half has to be rewritten against `frontend/settings/`. It also adds a Linux-only settings control, which is a UX decision. The slice is not small or self-contained.

Evidence:
- `git diff master...refs/upstream-pr/4219 | git apply --check`: fails. `UI/data/locale/en-US.ini`, `UI/forms/OBSBasicSettings.ui` and others do not exist.
- The PR changes `plugins/obs-outputs/librtmp/rtmp.c`, `plugins/obs-outputs/net-if.c` and `rtmp-stream.c`, plus about 90 lines of settings UI.

Related: none in batch.

---

### [#5377](https://github.com/obsproject/obs-studio/pull/5377) — PipeWire Virtual Camera

**Verdict: DEFER_LARGE**

Reasoning: This is a draft PR (+1013/-16, 11 files) that adds a new PipeWire output, a framework for sharing PipeWire code, and 2 "DNM" commits that replace the v4l2 vcam. It conflicts with the current `plugins/linux-pipewire/CMakeLists.txt`, `pipewire.c` and `linux-v4l2.c`. It is a new architectural feature that depends on the PipeWire refactor (#6669) and on the vcam enablement refactor (#5383). No small slice exists.

Evidence:
- `git apply --check`: fails on `plugins/linux-pipewire/CMakeLists.txt:28`, `pipewire.c:1132` and `plugins/linux-v4l2/linux-v4l2.c:32`.
- Current vcam on Linux is v4l2-only: `plugins/linux-v4l2/v4l2-output.c:316-325`.

Related: #5383, #6669, #3929.

---

### [#5383](https://github.com/obsproject/obs-studio/pull/5383) — Refactor virtual camera enablement and allow two virtual camera implementation to be simultaneously activated on Linux

**Verdict: DEFER_LARGE**

Reasoning: This is a draft PR. It depends on #7169 and only makes sense with #5377 (a second vcam implementation). It refactors vcam enablement across the UI and the Windows, macOS and Linux plugins (9 files, +111/-59), and every UI path targets the removed `UI/` tree. It is cross-platform and depends on unmerged work.

Evidence:
- `git apply --check`: `UI/api-interface.cpp`, `UI/window-basic-main-outputs.cpp` and others do not exist.
- The PR touches `plugins/win-dshow/dshow-plugin.cpp` and `plugins/mac-virtualcam/.../plugin-main.mm`, so it is not a Linux-only slice.

Related: #5377.

---

### [#5422](https://github.com/obsproject/obs-studio/issues/5422) — error attempting to open more then 16 video devices

**Verdict: IMPLEMENT**

Reasoning: The title is the libv4l2 error that appears when its fixed table of device slots (16) runs out, so this is a file-descriptor leak through `v4l2_open`. In `format_selected()` the device is opened, then `v4l2_get_input_caps()` is called. If that call fails, the function returns `false` without `v4l2_close(dev)`. The reporter's trigger is a v4l2-m2m codec device. Such a device lists as `VIDEO_CAPTURE` (multiplanar m2m devices can report it) but has no enumerable inputs, so `VIDIOC_ENUMINPUT` fails. Each time the device is selected or the properties refresh, one libv4l2 slot leaks until all 16 are used up. After that every v4l2 source fails, which matches "after that, v4l2 no longer works".

Evidence:
- `plugins/linux-v4l2/v4l2-input.c:667-674`: `int dev = v4l2_open(...)`, then `if (v4l2_get_input_caps(dev, input, &caps) < 0) return false;` returns without `v4l2_close(dev)`.
- `plugins/linux-v4l2/v4l2-input.c:695`: the only `v4l2_close(dev)` in that function is on the success path.
- The other callbacks close correctly on every path: `device_selected` at 619-633, `input_selected` at 648-654, `resolution_selected` at 714-721.

Related: none.

Slice:
- In `format_selected()`, close the fd before the early return: `if (v4l2_get_input_caps(dev, input, &caps) < 0) { v4l2_close(dev); return false; }`.
- About 3 lines in `plugins/linux-v4l2/v4l2-input.c`.
- Test: Linux-only code that does not build on the Windows MSVC config, so it is UNTESTED. Check by review only.

---

### [#5439](https://github.com/obsproject/obs-studio/issues/5439) — DeckLink Quad HDMI Recorder issue in Manjaro linux (device and mode are red)

**Verdict: CANNOT_VERIFY**

Reasoning: The device and mode lists are empty. That means the DeckLink API iterator found no devices, which points to the Desktop Video driver or library install. The reporter had to patch the AUR driver to build it, and ran with or without sudo. OBS only enumerates what `libDeckLinkAPI.so` reports. This needs the specific hardware and driver combination, and nothing in the body points to an OBS code defect.

Evidence:
- `plugins/decklink/linux/platform.cpp`: loads the DeckLink API dynamically. Without a working driver no devices appear.
- The body notes a patched third-party driver package (decklink-12.1-2, applied to kernel 5.10).

Related: none.

---

### [#5445](https://github.com/obsproject/obs-studio/issues/5445) — Space bar activates previously clicked UI element (widget) due to FocusPolicy

**Verdict: DEFER_LARGE** (needs a UX and accessibility decision)

Reasoning: The behavior is real and comes from Qt's defaults. `QPushButton` keeps `Qt::StrongFocus`, so after a click the focused button handles Space and "clicks" again. The main controls never override the focus policy. There are two possible fixes. One is setting `Qt::NoFocus` or `TabFocus` on the controls-dock buttons, which breaks keyboard navigation and accessibility. The other is letting hotkeys take priority over focused widgets, which changes how hotkeys route events app-wide. Either is a design decision that upstream maintainers would have to make, not a mechanical fix.

Evidence:
- `frontend/forms/OBSBasicControls.ui`: no `focusPolicy` property on the stream, record or vcam buttons, so the default `StrongFocus` applies.
- `frontend/components/*`: `setFocusPolicy` overrides exist only for specific widgets (e.g. `VolumeMeter.cpp:292`, `SourceTreeItem.cpp:400`), not for the controls.
- `frontend/OBSApp.cpp:262-276`: Qt key events are translated into OBS hotkeys only after Qt delivers them, so a focused button consumes Space first.

Related: none.

---

### [#5820](https://github.com/obsproject/obs-studio/issues/5820) — VirtualBox window not fully recorded

**Verdict: CANNOT_VERIFY**

Reasoning: The PipeWire window capture uses frames and crop metadata that the xdg-desktop-portal and compositor provide. A partial window is usually a compositor or portal crop or buffer-size issue for that app, and XComposite still works for the reporter. There is no log and no compositor info. Fixing it would need a reproduction with VirtualBox on a specific compositor.

Evidence:
- `plugins/linux-pipewire/pipewire.c`: crop and region come from the stream's `SPA_META_VideoCrop` and the negotiated size supplied by the compositor.
- `plugins/linux-capture/` XComposite capture is still available as the workaround the reporter used.

Related: none.

---

### [#6207](https://github.com/obsproject/obs-studio/pull/6207) — linux-pipewire: Add PipeWire audio captures

**Verdict: DEFER_LARGE**

Reasoning: This is a draft with +2480 lines in 7 files. The PR text says it is a draft because the PipeWire/portal side has no agreed implementation yet, and points users to the out-of-tree plugin (dimtpap/obs-pipewire-audio-capture). It conflicts with the current `linux-pipewire` CMake and locale files. It is far too large for a slice, and the plugin already serves users.

Evidence:
- `git apply --check`: fails on `plugins/linux-pipewire/CMakeLists.txt:31` and `data/locale/en-US.ini:10`.
- Linux audio capture today is PulseAudio-based: `plugins/linux-pulseaudio/pulse-input.c`.

Related: #6669 (shared PipeWire wrappers).

---

### [#6283](https://github.com/obsproject/obs-studio/issues/6283) — Projector window - no titlebar (Wayland, Gnome)

**Verdict: DEFER_LARGE**

Reasoning: GNOME/Mutter does not draw server-side decorations, so Qt must draw client-side ones. The windowed projector is itself the native `OBSQTDisplay` toplevel (`Qt::Window`, `WA_NativeWindow`, `WA_PaintOnScreen`), and libobs renders into its `wl_surface` with EGL. Qt never paints that surface, so the CSD titlebar is never drawn or is overwritten. A real fix means rebuilding the projector as a normal Qt window that hosts the display as a child native widget, or adding a custom decoration. That is a restructure of projector window handling, not a small patch.

Evidence:
- `frontend/widgets/OBSProjector.cpp:20-21`: `OBSProjector` derives from `OBSQTDisplay(widget, Qt::Window)`, so the display is the toplevel.
- `frontend/widgets/OBSQTDisplay.cpp:65-72`: `WA_PaintOnScreen` and `WA_NativeWindow` are set, so EGL renders directly into the toplevel surface.
- `frontend/widgets/OBSProjector.cpp:39-42`: there is already a Linux-specific workaround (`WA_PaintOnScreen` false) for resize, which shows this area is fragile.
- Side note, not the reported bug: `OBSProjector.cpp:33` `setWindowFlags(Qt::WindowStaysOnTopHint)` replaces all flags, which drops `Qt::Window`. It only matters if a parent is passed.

Related: #7134, #7483 (other Wayland display-surface issues).

---

### [#6546](https://github.com/obsproject/obs-studio/pull/6546) — DRM / GBM renderer for Linux

**Verdict: DEFER_LARGE**

Reasoning: This is a draft (+672/-28, 19 files) that depends on #6475. By the author's own description the new renderer cannot be reached without patching code. It adds a libdrm/gbm dependency (`FindLibdrm.cmake`) and touches libobs-opengl platform creation on every platform, including `gl-cocoa.m`. It conflicts heavily, and it is groundwork for a future feature, not a fix.

Evidence:
- `git apply --check`: `UI/qt-wrappers.cpp` and `cmake/Modules/FindLibdrm.cmake` are missing, and the patch fails on `libobs-opengl/CMakeLists.txt:49` and `gl-cocoa.m:78`.
- `libobs/obs-nix-platform.h`: the current `obs_nix_platform_type` has X11_EGL and WAYLAND only, with no DRM.

Related: none.

---

### [#6669](https://github.com/obsproject/obs-studio/pull/6669) — Draft: Pipewire unified wrappers

**Verdict: DEFER_LARGE**

Reasoning: This is a 20-commit refactor of `plugins/linux-pipewire` (+987/-399 in 7 files), with a title marked "Draft". It conflicts with current `linux-pipewire.c`, `pipewire.c` and `pipewire.h`. It is a basis for #5377 and #6207, not a fix by itself. A refactor this size needs maintainer review and runtime testing on Linux, which this box cannot do.

Evidence:
- `git apply --check`: fails on `plugins/linux-pipewire/linux-pipewire.c:43`, `pipewire.c:21` and `pipewire.h:22`.

Related: #5377, #6207.

---

### [#7134](https://github.com/obsproject/obs-studio/issues/7134) — Hiding OBS window (tray hide) when preview is active causes preview window to be transparent when shown again

**Verdict: CANNOT_VERIFY**

Reasoning: This is Wayland-only. On hide, `SetShowing(false)` disables the preview display, and `OBSQTDisplay` drops its `obs_display` when the window becomes invisible (non-Windows/macOS). It recreates the display on visible/expose, and a `SurfaceEventFilter` destroys the display when the surface goes away. The lifecycle is already handled in principle. A transparent preview after re-show points to an ordering problem between Qt's `wl_surface` recreation and `CreateDisplay()` (e.g. `isExposed()` false at that moment). That cannot be pinned to a line without a Wayland repro. The report is also from 27.2.4, and this code has changed since (e.g. `b65ee8945`, which uses `winId` for the Wayland surface in Qt 6.9+).

Evidence:
- `frontend/widgets/OBSQTDisplay.cpp:74-88`: on invisible, `display = nullptr` (non-Windows/macOS). On visible, `CreateDisplay()` runs.
- `frontend/widgets/OBSQTDisplay.cpp:123-133`: `CreateDisplay()` returns early when `!windowHandle()->isExposed()`.
- `frontend/utility/SurfaceEventFilter.hpp`: `DestroyDisplay()` runs on `SurfaceAboutToBeDestroyed`.
- `frontend/widgets/OBSBasic_MainControls.cpp:557-600`: `SetShowing` toggles `EnablePreviewDisplay`.

Related: #7483, #6283.

---

### [#7314](https://github.com/obsproject/obs-studio/issues/7314) — OBS causes uvcvideo to blank cameras after exiting and loads the wrong default properties

**Verdict: CANNOT_VERIFY**

Reasoning: For part 2 (defaults at max), OBS uses the driver-reported `qctrl.default_value` for integer controls. If "Pan Speed", "Tilt Speed" and "Zoom, Continuous" come up at max, the uvcvideo or camera firmware is reporting that value. When properties are built, the modified callbacks write the defaults to the device with `VIDIOC_S_CTRL`. For relative or speed controls that write starts the camera moving. A plausible hardening would be to skip `V4L2_CTRL_FLAG_WRITE_ONLY` controls, which are usually relative ones. It cannot be confirmed without the hardware, and it could hide controls users want. Part 1 (cameras blank after exit) is camera firmware or init timing specific to the NexiGo N970P.

Evidence:
- `plugins/linux-v4l2/v4l2-controls.c:115-119`: integer slider default comes from `qctrl->default_value`.
- `plugins/linux-v4l2/v4l2-controls.c:35-67`: `v4l2_control_changed` writes the value with `VIDIOC_S_CTRL` whenever the property is modified.
- `plugins/linux-v4l2/v4l2-controls.c:98-102`: `INVALID_CONTROL_FLAGS` excludes DISABLED, READ_ONLY and VOLATILE, but not WRITE_ONLY.

Related: #5422 (same plugin).

---

### [#7483](https://github.com/obsproject/obs-studio/issues/7483) — Multi monitor: Visual issues when moving window between screens or unmaximizing OBS's window with activated preview

**Verdict: CANNOT_VERIFY**

Reasoning: The report covers KDE Plasma Wayland with mixed 100%/200% scaling, where brief ghost windows appear during moves or unmaximize. On `screenChanged`, OBS recreates and resizes the display. The ghosting is a transient compositor or EGL buffer-scale artifact. There is no identifiable defect line, and it needs a multi-monitor Wayland repro.

Evidence:
- `frontend/widgets/OBSQTDisplay.cpp:90-98`: the `screenChanged` handler calls `CreateDisplay()` and `obs_display_resize`.

Related: #7134, #6283.

---

### [#7517](https://github.com/obsproject/obs-studio/pull/7517) — Draft: libobs: Bind to all wayland seat globals

**Verdict: IMPLEMENT** (`new-change`: the minimal first-seat-only fix, which is the #7514 approach the PR mentions, not the draft PR itself)

Reasoning: The draft PR (+216/-64) has an open TODO. Because there would be one keysym table per seat, it cannot implement `obs_nix_wayland_key_to_str`, so it should not be cherry-picked. The defect it describes is real in master, though. The registry handler binds every `wl_seat` global into the single `plat->seat` field and adds a listener each time, so with 2+ seats the earlier `wl_seat` proxy is leaked and overwritten. The capabilities callback also ignores its `seat` argument and calls `wl_seat_get_keyboard(plat->seat)`, which may be a different seat than the one reporting the capability. The smallest correct fix is to bind only the first seat and use the callback's `seat` argument.

Evidence:
- `libobs/obs-nix-wayland.c:203-211`: binds and overwrites `plat->seat` on every `wl_seat` global, with no "already bound" check.
- `libobs/obs-nix-wayland.c:171-184`: `platform_seat_capabilities` ignores `seat` (`UNUSED_PARAMETER(seat)`) and uses `plat->seat`.
- `libobs/obs-nix-wayland.c:214-220`: `global_remove` does nothing.
- `git apply --check` of PR 7517: fails on `libobs/obs-nix-wayland.c:33`.

Related: #9244 (same file).

Slice:
- In `platform_registry_handler`, return early when `plat->seat` is already set (log at debug that the extra seat is ignored).
- In `platform_seat_capabilities`, use the `seat` parameter for `wl_seat_get_keyboard`.
- About 6 lines in `libobs/obs-nix-wayland.c`. Credit #7517/#7514 as the source of the idea in the commit body.
- Test: Wayland-only code that does not build on Windows MSVC, so it is UNTESTED.

---

### [#8008](https://github.com/obsproject/obs-studio/pull/8008) — linux-v4l2: Create & use an OBS specific loopback card

**Verdict: IMPLEMENT** (`partial-pr`: hand-port, because it does not apply cleanly)

Reasoning: This is one commit in one file (+77/-24) that fixes the selection problem behind #3929. First it looks for a card whose `capability.card` matches "OBS Virtual Camera". If there is none and `v4l2loopback-ctl` is available, it adds one (`pkexec v4l2loopback-ctl add -x 1 -n 'OBS Virtual Camera'`). Only after that does it fall back to any loopback card. It no longer applies because master has since changed `try_connect` (static `use_caps_workaround`, STREAMON handling at 195-213, BSD `#if defined(__linux__)` paths at 37-133, 238-251). So it must be hand-ported. Two corrections are needed while porting:
- The PR's failure path sets `vcam->device = 0`. It must stay `-1`, as master does at line 222, because 0 is a valid fd and `virtualcam_destroy` would close stdin.
- The `v4l2loopback-ctl` probe and add must sit inside the `__linux__` block, because the BSD path has no `run_command`.

Evidence:
- `plugins/linux-v4l2/v4l2-output.c:103-107`: the module is loaded with `card_label='OBS Virtual Camera'`, but the label is never used for selection.
- `plugins/linux-v4l2/v4l2-output.c:145-224`: `try_connect` takes only the device path and does no label check.
- `plugins/linux-v4l2/v4l2-output.c:231-284`: `virtualcam_start` picks the first usable card.
- `git apply --check`: fails on `plugins/linux-v4l2/v4l2-output.c:98`.

Related: #3929 (fixes), #8171 (depends on this).

Slice:
- Add `#define OBS_V4L2_CARD_LABEL "OBS Virtual Camera"` and use it in `loopback_module_load`.
- Add a `try_connect(..., const char *name)` label filter using `strncmp` on `capability.card`, run before `G_FMT`.
- Split the scan into `loopback_card_open(data, name)`.
- In `virtualcam_start`: try the label, then try `v4l2loopback-ctl add` (Linux only, once), then fall back to `NULL` (any card).
- Move `obs_output_begin_data_capture` and the "Virtual camera started" log into `virtualcam_start`.
- Keep `vcam->device = -1` on failure.
- About 90 lines in `plugins/linux-v4l2/v4l2-output.c`. Preserve PR author (aramg) attribution via a Co-authored-by / "Based on" line. The license is GPL-2.0-or-later, the same as the fork.
- Test: Linux-only, so it is UNTESTED on this Windows box. Review only.

---

### [#8171](https://github.com/obsproject/obs-studio/pull/8171) — Linux: virtual audio support via ALSA Loopback card

**Verdict: DEFER_LARGE**

Reasoning: This PR includes #8008 and then moves the vcam into a new `plugins/linux-virtualcam` module with a new ALSA output (+678/-147, 9 files). Adding a new module, an `snd_aloop` dependency and audio vcam semantics is a feature with UX implications, such as where the device name shows up and audio-only mode. It conflicts with `plugins/CMakeLists.txt` and `linux-v4l2`. It is too large for a slice, and #8008 has to land first.

Evidence:
- `git apply --check`: fails on `plugins/CMakeLists.txt:56`, `plugins/linux-v4l2/CMakeLists.txt:15` and `linux-v4l2.c:15`.

Related: #8008, #3929.

---

### [#8529](https://github.com/obsproject/obs-studio/pull/8529) — Add initial support for the OpenH264 H.264 software codec

**Verdict: DEFER_LARGE**

Reasoning: The encoder part of this work is already in master (`plugins/obs-ffmpeg/obs-ffmpeg-openh264.c`, built at `plugins/obs-ffmpeg/CMakeLists.txt:33`). The rest of the PR is one frontend commit (10 files, +105/-40) that changes encoder policy:
- It lists "Software (OpenH264)" first in Simple mode.
- It makes `get_simple_output_encoder` default to `ffmpeg_openh264` instead of `obs_x264`.
- It makes the auto-config and settings fallbacks choose OpenH264 when x264 is missing.

Changing which encoder is the default fallback is a product decision for upstream maintainers, aimed at distros that ship without x264. The patch also conflicts with the current `OBSBasicSettings.cpp`, `OBSBasicSettings_Stream.cpp` and `OBSBasic.cpp`. A narrower "only offer OpenH264 when x264 is unavailable" variant would itself need design choices. Defer.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-openh264.c:40-43`: the encoder is already registered ("OpenH264").
- `git apply --check`: fails on `frontend/settings/OBSBasicSettings.cpp:3343`, `OBSBasicSettings_Stream.cpp:1471` and `frontend/widgets/OBSBasic.cpp:796`.
- In the PR diff, `frontend/utility/SimpleOutput.cpp` changes the final `return "obs_x264";` to `return "ffmpeg_openh264";`, which changes the default for every unknown encoder string.

Related: none in batch.

---

### [#8699](https://github.com/obsproject/obs-studio/issues/8699) — Desktop audio input fails if screen resolution changes

**Verdict: CANNOT_VERIFY**

Reasoning: The likely mechanism is that an `xrandr` mode change re-plugs HDMI/DP. That removes the HDMI audio sink and adds it back. The PulseAudio input never recovers in that case:
- For a non-default device, the stream is created with `PA_STREAM_DONT_MOVE`, so the server kills it when the sink disappears.
- The plugin installs no stream state callback and no context subscription, so it never notices the FAILED or TERMINATED stream and never reconnects.
- Re-selecting the device in properties would restart it, but "cannot be recovered until OBS is restarted" suggests the user did not try that.

The gap in the code is real. Whether it is this user's failure depends on their device selection and sink topology (no log content available). Also, Ubuntu 22.04 runs PipeWire-pulse or PulseAudio, and the behavior differs between them. A fix (state callback plus a reconnect on sink or source add) would be about 80-150 lines and cannot be tested here. Recorded for a future pass.

Evidence:
- `plugins/linux-pulseaudio/pulse-input.c:365-367`: `PA_STREAM_DONT_MOVE` is set for non-default devices.
- `grep set_state_callback plugins/linux-pulseaudio/`: only the context state callback exists (`pulse-wrapper.c:71`), with no stream state or event callback.
- `plugins/linux-pulseaudio/pulse-input.c:228-251`: the default device is resolved once at start from server info and never re-resolved.

Related: none.

---

### [#9244](https://github.com/obsproject/obs-studio/issues/9244) — Non-numlocked numpad keys cannot be assigned as hotkeys under Wayland

**Verdict: IMPLEMENT** (labelled "Good first issue" upstream)

Reasoning: On Wayland, the hotkey edit converts `QKeyEvent::nativeVirtualKey()` (an xkb keysym) with `obs_key_from_virtual_key`, which ends in `obs_nix_wayland_key_from_virtual_key`. That switch handles `XKB_KEY_KP_0..9` and the KP operators, but not the keypad navigation keysyms produced with NumLock off: `KP_Home`, `KP_End`, `KP_Left`, `KP_Right`, `KP_Up`, `KP_Down`, `KP_Prior`/`KP_Page_Up`, `KP_Next`/`KP_Page_Down`, `KP_Insert`, `KP_Delete`, `KP_Begin`. Those return `OBS_KEY_NONE`, so the field stays blank, exactly as reported. Mapping them to the matching non-keypad OBS keys (`OBS_KEY_HOME`, `OBS_KEY_END`, …) matches Windows, where NumLock-off keypad keys send `VK_HOME`/`VK_END`.

Mapping both `KP_End` and `End` to `OBS_KEY_END` is safe:
- `load_keymap_data` keeps only the first keycode per OBS key, at lines 60-65.
- `obs_to_key` is only used for display names, at line 364.
- `KP_End` has no UTF-8 form, so the name falls back to `obs_key_to_name`, i.e. "End".

Evidence:
- `libobs/obs-nix-wayland.c:998-1033`: KP digit and operator cases exist, but there are no KP navigation cases.
- `libobs/obs-nix-wayland.c:540,574,712,740,762`: the plain `Delete`, `End`, `Home`, `Insert` and `Left` cases exist, so the new cases can return the same OBS keys.
- `frontend/settings/OBSHotkeyEdit.cpp:54`: `obs_key_from_virtual_key(event->nativeVirtualKey())`.
- `libobs/obs-hotkeys.h:9-21`: `OBS_KEY_INSERT`, `DELETE`, `HOME`, `END`, `LEFT` and `PAGEUP` all exist.

Related: #7517 (same file).

Slice:
- In `obs_nix_wayland_key_from_virtual_key`, add cases for `XKB_KEY_KP_Home`, `KP_End`, `KP_Left`, `KP_Right`, `KP_Up`, `KP_Down`, `KP_Prior` (same value as `KP_Page_Up`), `KP_Next` (same as `KP_Page_Down`), `KP_Insert` and `KP_Delete`. Each returns the corresponding `OBS_KEY_*`.
- Optionally map `KP_Begin` to `OBS_KEY_CLEAR`, if that key exists.
- About 20 lines in `libobs/obs-nix-wayland.c`.
- Test: Wayland-only file, not compiled on Windows, so it is UNTESTED. Review only.

---

### [#9324](https://github.com/obsproject/obs-studio/issues/9324) — QSV encoder MFX_ERR_DEVICE_FAILED on Linux

**Verdict: CANNOT_VERIFY**

Reasoning: The report (2023, libmfx-gen1.2) predates a large rework of the Linux QSV path. Session init now goes through VPL `MFXLoad` with a DRM render node and per-session `linux_data`, which `ReleaseSessionData` tears down (`vaTerminate` and `close`). A failure on the second init after a settings change would need Intel hardware to reproduce.

There are small leaks in error paths that could be tidied, but none of them proves the reported failure:
- `MFXLoad()`'s `loader` is never `MFXUnload`ed.
- `vaGetDisplayDRM` failing leaks the fd.
- `MFXCreateSession` failing does not `vaTerminate`.

Evidence:
- `plugins/obs-qsv11/common_utils_linux.cpp:279`: `mfxLoader loader = MFXLoad();`, with no matching `MFXUnload`.
- `plugins/obs-qsv11/common_utils_linux.cpp:312-321`: the fd is opened, and the `!vaDisplay` branch returns without `close(fd)`.
- `plugins/obs-qsv11/common_utils_linux.cpp:366-375`: `ReleaseSessionData` terminates VA and closes the fd.

Related: none in batch.
