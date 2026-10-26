# Upstream triage — batch linux-06

- Batch: linux-06 (area hint: linux)
- Items: 13661, 13680, 13698, 13773, 13783, 13808, 13836, 13873, 13896, 13963, 14012, 14019, 14036, 14054, 14064, 14073, 14080
- Date: 2026-10-26
- Base commit: `72e866557` (`git rev-parse --short master`)
- Method: item bodies from `notes/upstream-triage/data/all.json`; PR heads from `refs/upstream-pr/<N>`; code read on master. No GitHub API / WebFetch used for this batch.
- Applicability note: local git is 2.33, which has no `git merge-tree --write-tree`. Instead, `git diff master...refs/upstream-pr/N | git apply --check` was run for every PR; all nine PR diffs apply cleanly to master.

## Summary

| # | Kind | Verdict | One-liner |
|---|------|---------|-----------|
| 13661 | PR | DEFER_LARGE | ~1000-line Wayland global hotkeys via non-standard `xx-hotkey-v1` protocol |
| 13680 | PR | DEFER_LARGE | Draft ~665-line GlobalShortcuts portal hotkeys |
| 13698 | PR | IMPLEMENT (cherry-pick) | Use-after-free in camera-portal log line |
| 13773 | issue | IMPLEMENT (new-change) | VAAPI: stale `vaapi_device` path -> retry with autodetect |
| 13783 | issue | CANNOT_VERIFY | PipeWire camera link drops on framerate change |
| 13808 | PR | IMPLEMENT (cherry-pick, squashed) | v4l2 framerate packed into `int` and truncated |
| 13836 | issue | CANNOT_VERIFY | Multiple PipeWire screencasts lag on Hyprland/NVIDIA |
| 13873 | issue | OUT_OF_SCOPE | Firefox getUserMedia does not list v4l2loopback device |
| 13896 | issue | IMPLEMENT (via #13808) | v4l2 stream restarts on every control change (same root cause) |
| 13963 | PR | IMPLEMENT (cherry-pick) | Windows `/DEPENDENTLOADFLAG` for exe/helpers |
| 14012 | PR | CANNOT_VERIFY | Shutdown hardening; speculative, and adds a stale frontend callback |
| 14019 | issue | IMPLEMENT (via #14073) | Black box around cursor with HDR (PipeWire) |
| 14036 | issue | IMPLEMENT (via #13808) | Duplicate of the v4l2 framerate truncation |
| 14054 | issue | IMPLEMENT (new-change) | V4L2 fds leak into `obs-ffmpeg-mux` (no `O_CLOEXEC`) |
| 14064 | PR | IMPLEMENT (cherry-pick) | PipeWire: target nodes by serial instead of reusable ID |
| 14073 | PR | IMPLEMENT (cherry-pick) | PipeWire: enable blending for cursor render |
| 14080 | PR | IMPLEMENT (cherry-pick) | Wayland: map NumLock-off keypad keysyms |

---

### [#13661](https://github.com/obsproject/obs-studio/pull/13661) — libobs: Add global hotkey support on Wayland

**Verdict: DEFER_LARGE**

The PR implements the `xx-hotkey-v1` Wayland protocol (previously `vicinae-hotkey`) so OBS can bind global shortcuts. It is about 1021 added lines: it vendors a 361-line protocol XML and adds about 650 lines to `libobs/obs-nix-wayland.c`. Only Hyprland ships the protocol today, and the niri PR is still open. It is not a wayland-protocols staging protocol. Whether OBS should adopt a compositor-specific protocol, or the GlobalShortcuts portal (#13680), or both, is a maintainer design decision, not a small slice. The diff applies to master, but its size and the open protocol-choice question rule out a minimal change.

Evidence:
- `git diff master...refs/upstream-pr/13661 --stat`: 4 files, +1021/-10 (`libobs/obs-nix-wayland.c` +652, new `libobs/wayland-protocols/xx-hotkey-v1.xml` 361, `libobs/cmake/os-linux.cmake`, `libobs/obs.c`).
- Current Wayland hotkeys only read focused-keyboard events: `libobs/obs-nix-wayland.c:118` (`platform_keyboard_key`) and `:132`/`:143` (enter/leave). There is no global-binding path.

Related: #13680 (competing portal approach), #10538 (the upstream global-hotkeys-on-Wayland issue).

### [#13680](https://github.com/obsproject/obs-studio/pull/13680) — libobs: implement global hotkeys on Wayland using xdg-desktop-portal

**Verdict: DEFER_LARGE**

This is a draft PR (13+ commits, including merge commits) that adds `libobs/obs-hotkey-portal.c` (607 lines) and wires it into `obs-hotkey.c`. It uses the GlobalShortcuts portal. That portal moves binding control to the desktop's settings, which does not fit OBS's per-hotkey binding UI, so it needs a UX/design decision about how OBS hotkey settings relate to system-managed bindings. The author marks it as a draft and says it may not work well yet. It is too large to be a small slice.

Evidence:
- `git diff master...refs/upstream-pr/13680 --stat`: 4 files, +665 (new `libobs/obs-hotkey-portal.c`/`.h`, `libobs/obs-hotkey.c` +10, `libobs/CMakeLists.txt`).
- `draft: true` in the item data.

Related: #13661, #10538, #10701, #13169.

### [#13698](https://github.com/obsproject/obs-studio/pull/13698) — linux-pipewire: Fix use-after-free in log message

**Verdict: IMPLEMENT (cherry-pick-pr)**

The defect is confirmed in code. `connection->devices` is created with `bfree` as the key destroy function, and `on_registry_global_remove_cb` calls `g_hash_table_iter_remove(&iter)` before it logs `device_id`, which is the key that was just freed. The PR swaps the two lines. ASan output in the PR body confirms the bug.

Evidence:
- `plugins/linux-pipewire/camera-portal.c:1141`: `g_hash_table_new_full(g_str_hash, g_str_equal, bfree, (GDestroyNotify)camera_device_free)`, so keys are freed on remove.
- `plugins/linux-pipewire/camera-portal.c:1032-1033`: remove, then `blog(... "Removed device %s", device_id)`.
- PR diff is a single swapped line; it applies cleanly.

Slice: cherry-pick `8a15575c9` (author Barnabás Pőcze). 1 file, 2 lines.
Test plan: Linux-only plugin (`linux-pipewire` is not built on Windows). UNTESTED on this box beyond review. The fix is obviously correct by inspection.

### [#13773](https://github.com/obsproject/obs-studio/issues/13773) — FFmpeg VAAPI encoder fails to start when profile contains a stale vaapi_device path

**Verdict: IMPLEMENT (new-change)**

The defect is confirmed. `vaapi_update` reads `vaapi_device` from settings and passes it unchecked to `vaapi_init_codec`. That function calls `av_hwdevice_ctx_create(..., path, ...)` and fails outright if the node does not exist. There is no fallback, even though FFmpeg autodetects a render node when it is given `NULL`. A profile copied from another machine (here, a shared home directory across two machines) therefore cannot start encoding.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-vaapi.c:242`: device read from settings.
- `plugins/obs-ffmpeg/obs-ffmpeg-vaapi.c:147-150`: `av_hwdevice_ctx_create(&enc->vadevice_ref, AV_HWDEVICE_TYPE_VAAPI, path, NULL, 0)`, then a warning and `return false`.
- `plugins/obs-ffmpeg/obs-ffmpeg-vaapi.c:369`: `return vaapi_init_codec(enc, device);`.
- `plugins/obs-ffmpeg/obs-ffmpeg-vaapi.c:836-853`: per-codec default device helpers exist (`vaapi_default_device`). They are defined after `vaapi_update`, so using them needs a forward declaration. Retrying with `NULL` (FFmpeg autodetect) avoids that.

Slice: in `vaapi_init_codec`, if `av_hwdevice_ctx_create` fails and `path` is non-empty, log a warning (`"VAAPI device '%s' unusable, falling back to auto-detection"`) and retry once with `path = NULL`. Alternatively, check `os_file_exists(device)` in `vaapi_update` first and substitute `vaapi_default_device(enc->codec)` (needs a forward declaration). Prefer the retry-with-NULL approach because it handles any open failure. About 10 lines, 1 file.
Test plan: VAAPI is Linux-only (`obs-ffmpeg-vaapi.c` is compiled only on Linux). UNTESTED on this Windows box.

### [#13783](https://github.com/obsproject/obs-studio/issues/13783) — Pipewire: video capture pipe disconnects when video format/framerate is changed

**Verdict: CANNOT_VERIFY**

A framerate change in the camera-portal source does not reconnect the stream. It sets the framerate and signals a renegotiation (`pw_loop_signal_event(... reneg)`), which updates the stream params in place. A format change calls `stream_camera()`, which destroys the stream and recreates it. In the reported failure, the link stays down while both nodes still exist. That suggests the session manager (WirePlumber) did not relink after the param update, but nothing in OBS code shows a definite defect. Confirming it needs a repro with a specific camera, the Flatpak build, and WirePlumber logs. No identifiable root cause in OBS.

Evidence:
- `plugins/linux-pipewire/camera-portal.c:764-781`: `framerate_selected` -> `obs_pipewire_stream_set_framerate`.
- `plugins/linux-pipewire/pipewire.c:1431-1450`: stores the fraction and signals `reneg`. No reconnect.
- `plugins/linux-pipewire/camera-portal.c:820-845`: a format change calls `stream_camera()` (full reconnect, `:255` destroys the old stream).

Related: none in batch.

### [#13808](https://github.com/obsproject/obs-studio/pull/13808) — linux-v4l: fix framerate value truncation in props

**Verdict: IMPLEMENT (cherry-pick-pr, squashed net diff)**

The defect is confirmed. In `v4l2_framerate_list()`, the discrete-interval branch stores `v4l2_pack_tuple()`, which returns `int64_t` (`PACK64(a,b) = a<<32 | b`), into an `int`. That drops the numerator: 1/60 becomes `60`. `v4l2_unpack_tuple()` treats any value with a zero upper 32 bits as the legacy 16/16 packing, so `60` decodes as numerator 0 and denominator 60. `VIDIOC_S_PARM` then gets an invalid interval, and the driver falls back to its fastest rate. It also makes `v4l2_settings_changed()` compare the 64-bit value from `v4l2_set_framerate` against the truncated setting, so every property change (zoom, focus, ...) restarts the device (#13896). The PR changes `int` to `int64_t`.

Evidence:
- `plugins/linux-v4l2/v4l2-input.c:590`: `int pack = v4l2_pack_tuple(...)`.
- `plugins/linux-v4l2/v4l2-helpers.h:31` (`PACK64`), `:145-147` (`int64_t v4l2_pack_tuple`), `:159-169` (legacy-unpack branch when the upper 32 bits are 0).
- `plugins/linux-v4l2/v4l2-helpers.c:243-256`: `v4l2_set_framerate` unpacks the setting and writes back a full 64-bit pack, so `data->framerate` differs from the setting.
- `plugins/linux-v4l2/v4l2-input.c:1011-1020`: `framerate` comparison in `v4l2_settings_changed`. With a truncated setting it is always true.
- The stepwise/continuous branch (`:596+`) already uses `const int64_t *` from `v4l2_framerates`, so it is unaffected.

Slice: apply the net 1-line diff of the PR (`int` -> `int64_t` at `v4l2-input.c:590`) as one commit with author `acscd <acd2048@proton.me>` (original commits `8c42c37af`, `f54246580`, `31b891f8d`; the branch has many merge commits, so squash). Note in the commit: scene collections saved with the truncated value (for example `"framerate": 60`) are still decoded as 0/60 until the user re-selects the framerate. An optional follow-up could treat legacy values whose upper 16 bits are 0 as `1/value`, but that is left out to keep the slice minimal.
Test plan: Linux-only (`linux-v4l2`). UNTESTED here. The arithmetic was verified by reading the code.

Related: #13896, #14036, #13388 (upstream).

### [#13836](https://github.com/obsproject/obs-studio/issues/13836) — Multiple PipeWire screen capture sources cause severe render/compositor lag, even when disabled

**Verdict: CANNOT_VERIFY**

OBS already pauses a hidden PipeWire stream (`pw_stream_set_active(false)` in hide). Even so, each source keeps its own portal ScreenCast session open, and the compositor (xdg-desktop-portal-hyprland) may keep producing frames for every session. The cost described is mostly on the compositor side and is specific to Hyprland plus NVIDIA. Disabling a source in OBS does not necessarily trigger `hide`, because show/hide follows scene visibility. Fully closing portal sessions for disabled sources would be a behaviour/design change, because it would re-prompt the user or need restore-token handling. No concrete OBS defect can be pinned down without profiling on that stack.

Evidence:
- `plugins/linux-pipewire/screencast-portal.c:630-643`: show/hide -> `obs_pipewire_stream_show/hide`.
- `plugins/linux-pipewire/pipewire.c:1256-1272`: hide only calls `pw_stream_set_active(..., false)`, and the portal session stays open.

Related: #11580 (upstream, referenced by reporter).

### [#13873](https://github.com/obsproject/obs-studio/issues/13873) — getUserMedia does not list OBS Virtual Camera

**Verdict: OUT_OF_SCOPE**

The virtual camera device exists (`v4l2-ctl` lists it). The problem is that Firefox's camera enumeration does not show it. Recent Firefox on Fedora enumerates cameras through the PipeWire camera portal / libcamera rather than raw V4L2. Whether a v4l2loopback node appears there depends on the browser, PipeWire's v4l2 SPA plugin, and `exclusive_caps=1` semantics: the device only advertises capture caps while a producer is streaming. OBS loads the module with `exclusive_caps=1` as v4l2loopback recommends for browser compatibility. Nothing in OBS code is wrong, and the report gives no indication that OBS is not streaming. This is a browser/PipeWire integration question.

Evidence:
- `plugins/linux-v4l2/v4l2-output.c:106`: `modprobe v4l2loopback exclusive_caps=1 card_label='OBS Virtual Camera'`.
- `plugins/linux-v4l2/v4l2-output.c:158`: OBS opens the loopback node as a writer. Device enumeration by consumers is not OBS's responsibility.

### [#13896](https://github.com/obsproject/obs-studio/issues/13896) — linux-v4l2: Adjusting camera controls (Zoom, Focus, etc.) triggers stream restarts on USB3 4k webcam

**Verdict: IMPLEMENT (cherry-pick-pr #13808)**

The reporter's diagnosis matches the code. `v4l2_settings_changed()` compares `data->framerate`, the full 64-bit pack written back by `v4l2_set_framerate`, for example 4294967356, against the truncated setting (60), so `needs_restart` is always true. Any control-slider change therefore calls `v4l2_terminate`/`v4l2_init`. The root cause is the `int` truncation at `v4l2-input.c:590`, and #13808 fixes it. Once the list stores the full pack, the two values match and controls no longer restart the stream.

Evidence:
- `plugins/linux-v4l2/v4l2-input.c:1011-1020`, `:1042-1045` (restart on change).
- `plugins/linux-v4l2/v4l2-input.c:590` (truncation), `plugins/linux-v4l2/v4l2-helpers.c:253-254` (64-bit write-back).

Slice: same commit as #13808. Reference #13896 in the commit body.
Test plan: Linux-only. UNTESTED.

Related: #13808, #14036.

### [#13963](https://github.com/obsproject/obs-studio/pull/13963) — frontend, plugins: Set load time DLL search path with linker flags

**Verdict: IMPLEMENT (cherry-pick-pr)**

The PR is a small Windows-only hardening change by a maintainer (RytoEX), following earlier commits `77eabcc06` and `e29a640dd` that already set the runtime DLL directory defaults in the frontend. It adds `/DEPENDENTLOADFLAG:0x1000` (`LOAD_LIBRARY_SEARCH_DEFAULT_DIRS`) to `obs64` and `obs-ffmpeg-mux`, and `0x800` (`LOAD_LIBRARY_SEARCH_SYSTEM32`) to the standalone helper probes (amf/nvenc/qsv tests, get-graphics-offsets, inject-helper). It is 13 lines across 7 CMake files and applies cleanly. The author asks for testers because third-party plugins could be affected. Load-time flags only govern the static imports of these executables, and plugins are loaded later through LoadLibrary, so the risk is low. This box is Windows, so it can be tested here.

Evidence:
- `git diff master...refs/upstream-pr/13963 --stat`: 7 files, +13/-1, CMake only.
- `git log -1 77eabcc06`: "frontend: Set better default DLL directory settings on Windows" (DLL planting mitigation). This PR extends it to load time.

Slice: cherry-pick `2a92d081d` (author Ryan Foster).
Test plan: Windows x64 MSVC build of `obs-studio`, `obs-ffmpeg-mux`, `obs-amf-test`, `obs-nvenc-test`, `obs-qsv-test`, `get-graphics-offsets`, `inject-helper`. Use `dumpbin /loadconfig` to confirm the DependentLoadFlags field. Launch OBS and confirm it starts, plugins load (check the log for module load failures), a recording via ffmpeg-mux works, and game capture inject works. Third-party plugins are not available locally: UNTESTED for those.

### [#14012](https://github.com/obsproject/obs-studio/pull/14012) — frontend: Adjust shutdown handling of frontend rendering

**Verdict: CANNOT_VERIFY**

This is a maintainer PR labelled "Seeking Testers". The author says it is speculative: it "hopefully" addresses intermittent shutdown crashes, and there is no specific crash stack or root cause. It also changes Unix signal handling (`processSigInt/Term/Abrt/Quit` now call `closeWindow()`), which the author says needs rigorous Unix testing. On review, the third commit has a flaw. `ScreenshotObj`'s constructor registers `obs_frontend_add_event_callback(onFrontendEvent, this)`, but the destructor path (`~ScreenshotObj` -> `destroy()`) never removes it. Only the EXIT event handler removes it. Every completed screenshot therefore leaves a dangling frontend callback that would run on a freed object at `OBS_FRONTEND_EVENT_EXIT`. That is a new use-after-free. Taking the PR as-is is not safe, and the crash it targets cannot be reproduced or justified from code.

Evidence:
- PR diff `frontend/utility/ScreenshotObj.cpp`: ctor adds the event callback, `destroy()` does not remove it, and only the `OBS_FRONTEND_EVENT_EXIT` branch calls `obs_frontend_remove_event_callback`.
- Current master: `frontend/OBSApp.cpp:1925-1997` (signal handlers call `saveAll()` [+ `close()` for SIGINT]), `frontend/widgets/OBSBasic.cpp:1331` (draw callback removed in `applicationShutdown`), `:1843` (`ui->preview->DestroyDisplay()` in `closeWindow`).
- Diff applies cleanly (6 files, +80/-31).

Related: upstream #12668, #13347, #13056 (prior shutdown work).

### [#14019](https://github.com/obsproject/obs-studio/issues/14019) — Black Box around cursor on Linux

**Verdict: IMPLEMENT (cherry-pick-pr #14073)**

The root cause is confirmed. When the output colour space is HDR, libobs renders a source that does not report its colour space into `color_space_texrender` with blending explicitly disabled. `obs_pipewire_stream_video_render` sets `gs_blend_function(ONE, INVSRCALPHA)` but never enables blending, so the cursor texture's transparent pixels overwrite the frame and show as a black square. In SDR the default state has blending enabled, which is why the bug only shows with an HDR profile. #14073 adds `gs_enable_blending(true)` inside the existing push/pop.

Evidence:
- `libobs/obs-source.c:2838-2848`: `gs_enable_blending(false)` around `source->info.video_render` for colour-space conversion.
- `plugins/linux-pipewire/pipewire.c:1358-1359`: `gs_blend_state_push(); gs_blend_function(GS_BLEND_ONE, GS_BLEND_INVSRCALPHA);` with no enable.

Slice: same as #14073.
Related: #14073, #13350 (upstream original).

### [#14036](https://github.com/obsproject/obs-studio/issues/14036) — linux-v4l2: frame rate list truncates packed value to 32-bit int

**Verdict: IMPLEMENT (cherry-pick-pr #13808)**

This is the same defect as #13808 and #13896, with an accurate analysis by the reporter. The side effects described (select() timeout computed from the wrong fps, MJPG stalls) follow from `data->framerate` being the driver's max rate after the 0/60 request.

Evidence: `plugins/linux-v4l2/v4l2-input.c:590`, `plugins/linux-v4l2/v4l2-helpers.h:159-169`, `plugins/linux-v4l2/v4l2-input.c:946-953` (logs the effective framerate).
Slice: same commit as #13808. Reference #14036.
Related: #13808, #13896.

### [#14054](https://github.com/obsproject/obs-studio/issues/14054) — Linux: obs-ffmpeg-mux inherits V4L2 device file descriptors

**Verdict: IMPLEMENT (new-change)**

The defect is confirmed. V4L2 nodes are opened without `O_CLOEXEC`: the virtual camera output in `v4l2-output.c` and the capture device in `v4l2-input.c`. `os_process_pipe_create` spawns `obs-ffmpeg-mux` with `posix_spawn` and only adjusts its own pipe fds, so every other open fd is inherited. With `exclusive_caps=1`, the muxer still holding the loopback fd stops the virtual camera from reopening as a producer until the recording ends.

Evidence:
- `plugins/linux-v4l2/v4l2-output.c:118` `open(new_device, O_RDWR)` and `:158` `vcam->device = open(device, O_RDWR)`.
- `plugins/linux-v4l2/v4l2-input.c:892` `v4l2_open(data->device_id, O_RDWR | O_NONBLOCK)` (long-lived capture fd). Also short-lived opens at `:373, :619, :648, :667, :714` and `plugins/linux-v4l2/v4l2-controls.c:37`.
- `libobs/util/pipe-posix.c:71-97`: only the pipe fds get `FD_CLOEXEC`, then `posix_spawn(...)`.

Slice: add `O_CLOEXEC` to the open flags at `v4l2-output.c:118,158` and `v4l2-input.c:892` (and, for consistency, to the other `v4l2_open` calls in `v4l2-input.c`/`v4l2-controls.c`). About 8 one-token changes in 3 files. `fcntl.h` is already included where `open` is used, and libv4l2 passes flags through to `open(2)`. Leave a broader fix in `pipe-posix.c` (closing all non-std fds in the child) out of scope.
Test plan: Linux-only. UNTESTED on this box.

### [#14064](https://github.com/obsproject/obs-studio/pull/14064) — linux-pipewire: Use serials to select nodes when available

**Verdict: IMPLEMENT (cherry-pick-pr)**

The bug is real and the fix is small. PipeWire node IDs are recycled, so after the captured window or screen goes away, OBS can attach to an unrelated node with the same ID. PipeWire deprecated targeting by ID in favour of `PW_KEY_TARGET_OBJECT` with the object serial, and the ScreenCast portal v6 exposes `pipewire-serial`. The PR adds an `obs_pipewire_stream_target` struct (id or serial). The screencast portal fills in the serial when the portal version is 6 or later, and the code sets `PW_KEY_TARGET_OBJECT` and connects with `PW_ID_ANY`. The camera portal still uses the node ID. `stream_properties` is already a `struct pw_properties *` (`pipewire.h:32`), so `pw_properties_setf` is valid. It raises the minimum PipeWire to 0.3.44 (released 2022). Camera support already gates on 0.3.60. It is 35 lines in 5 files and applies cleanly.

Evidence:
- `plugins/linux-pipewire/screencast-portal.c:253`: only the node ID is read (`g_variant_iter_loop(..., &capture->pipewire_node, ...)`).
- `plugins/linux-pipewire/pipewire.c:1243` (master): `pw_stream_connect(..., pipewire_node, PW_STREAM_FLAG_AUTOCONNECT ...)`.
- `plugins/linux-pipewire/CMakeLists.txt:8`: `find_package(PipeWire 0.3.33 REQUIRED)`; `:17` camera feature needs 0.3.60.

Slice: cherry-pick `63dae216e` (author Joaquim Monteiro).
Test plan: Linux-only plugin. UNTESTED here. Note the minimum PipeWire version bump in the commit body.

### [#14073](https://github.com/obsproject/obs-studio/pull/14073) — linux-pipewire: Enable blending for cursor rendering

**Verdict: IMPLEMENT (cherry-pick-pr)**

See #14019 for the root cause. This is a 1-line `gs_enable_blending(true)` after `gs_blend_function`, inside the existing `gs_blend_state_push/pop`, so the caller's state is restored afterwards. The enable also applies to the main frame draw. That matches what already happens in the SDR path, where blending is enabled by default, so behaviour does not change there. The author did not test on an HDR session.

Evidence: `plugins/linux-pipewire/pipewire.c:1358-1359`, `libobs/obs-source.c:2838`.
Slice: cherry-pick `9854cdb39` (author dualfroz). Commit body notes the fix for #14019 and #13350.
Test plan: Linux-only. UNTESTED (no HDR Wayland session).

Related: #14019.

### [#14080](https://github.com/obsproject/obs-studio/pull/14080) — libobs: Map non-numlock keypad keys on Wayland

**Verdict: IMPLEMENT (cherry-pick-pr)**

The defect is confirmed. `obs_nix_wayland_key_from_virtual_key` maps `XKB_KEY_KP_0..9` but has no case for the NumLock-off keypad keysyms (`KP_Home`, `KP_End`, `KP_Up`, `KP_Begin`, ...). They fall through to `OBS_KEY_NONE` and cannot be bound as hotkeys. The PR maps them to the regular navigation keys (the same as Windows VKs), maps `KP_Begin` to `OBS_KEY_CLEAR`, and adds a "Clear" label in `key_to_str`. The reverse mapping (`OBS_KEY_CLEAR` -> `XKB_KEY_Clear`) already exists. It is +25 lines in 1 file and applies cleanly.

Evidence:
- `libobs/obs-nix-wayland.c:379` (`key_from_virtual_key`), `:1033` (`XKB_KEY_KP_9` case). There are no `KP_Home`/`KP_Insert`/`KP_Begin` cases (grep).
- `libobs/obs-nix-wayland.c:271-310` (`key_to_str`, no `OBS_KEY_CLEAR` label), `:1137` (`OBS_KEY_CLEAR` -> `XKB_KEY_Clear` already present).

Slice: cherry-pick `24915ef06` (author dualfroz). Commit body notes the fix for upstream #9244.
Test plan: `obs-nix-wayland.c` is Linux-only. UNTESTED here (the author tested the mapping against a real xkb keymap).

Related: upstream #9244.
