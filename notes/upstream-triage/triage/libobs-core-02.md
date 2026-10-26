# Upstream triage — batch libobs-core-02

- Batch: libobs-core-02 (area hint: libobs-core)
- Items: 12399, 12543, 12617, 12679, 12832, 12913, 12939, 12953, 12964, 13153, 13166, 13299, 13309, 13595, 13749, 13779, 13784, 13816, 13884, 14004, 14038, 14042, 14076
- Date: 2026-10-26
- Base commit: 72e866557 (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; PR heads from `refs/upstream-pr/<N>`; code read on master. One WebFetch (#14038) to check the comment thread.
- Tooling note: local git is 2.33, which does not support `git merge-tree --write-tree`. Applicability was checked with `git diff master...refs/upstream-pr/N | git apply --check` instead, which is read-only.

## Summary

| # | Kind | Verdict |
|---|---|---|
| 12399 | issue | CANNOT_VERIFY |
| 12543 | PR | IMPLEMENT (cherry-pick) |
| 12617 | issue | ALREADY_ADDRESSED |
| 12679 | issue | CANNOT_VERIFY |
| 12832 | PR | IMPLEMENT (cherry-pick) |
| 12913 | issue | CANNOT_VERIFY |
| 12939 | issue | CANNOT_VERIFY |
| 12953 | issue | IMPLEMENT (via PR 12964) |
| 12964 | PR | IMPLEMENT (cherry-pick) |
| 13153 | issue | DEFER_LARGE |
| 13166 | issue | CANNOT_VERIFY |
| 13299 | PR | DEFER_LARGE |
| 13309 | issue | CANNOT_VERIFY |
| 13595 | issue | CANNOT_VERIFY |
| 13749 | PR | IMPLEMENT (partial: 2 of 10 commits) |
| 13779 | issue | OUT_OF_SCOPE |
| 13784 | issue | CANNOT_VERIFY |
| 13816 | PR | IMPLEMENT (cherry-pick) |
| 13884 | PR | DEFER_LARGE |
| 14004 | PR | IMPLEMENT (cherry-pick) |
| 14038 | issue | CANNOT_VERIFY |
| 14042 | PR | IMPLEMENT (cherry-pick) |
| 14076 | issue | CANNOT_VERIFY |

---

### [#12399](https://github.com/obsproject/obs-studio/issues/12399) — OBS Crashing

- **Verdict:** CANNOT_VERIFY
- **Reasoning:** A generic report of random crashes on macOS 15 with OBS 31.1.1. The log and crash-log URLs are literal placeholders, and there are no reproduction steps beyond "use OBS for a while". Without a stack trace, no code path can be identified.
- **Evidence:** issue body only (placeholder log URLs).
- **Related:** none.

### [#12543](https://github.com/obsproject/obs-studio/pull/12543) — libobs: Add obs_weak_canvas_references_canvas

- **Verdict:** IMPLEMENT
- **Reasoning:** Sources and outputs already provide `obs_weak_*_references_*` helpers, but canvases do not. The PR adds the same one-line comparison for canvases, plus the export and docs. `struct obs_weak_canvas` has a `canvas` field, so the implementation mirrors the source version exactly. The PR is additive and applies cleanly.
- **Evidence:**
  - `libobs/obs-source.c:959-962`: `obs_weak_source_references_source` is the pattern being mirrored.
  - `libobs/obs.h:1096`, `libobs/obs.h:1946`: existing source and output equivalents.
  - `libobs/obs-internal.h:722-725`: `struct obs_weak_canvas { ref; canvas; }`.
  - `libobs/obs-canvas.c:125`, `libobs/obs.h:2693`: there is a weak getter but no references helper.
  - `git apply --check` succeeds (3 files, +12).
- **Slice:** cherry-pick `5b9424db0` (libobs/obs-canvas.c, libobs/obs.h, docs/sphinx/reference-canvases.rst). About 12 lines.
- **Test plan:** build `libobs` with MSVC on Windows x64. The function is trivial; a cmocka test is possible but optional.
- **Related:** none.

### [#12617](https://github.com/obsproject/obs-studio/issues/12617) — OBS crashes when config directory creation fails

- **Verdict:** ALREADY_ADDRESSED
- **Reasoning:** The reported chain was: `MakeUserDirs` fails, AppInit throws, `~OBSApp` runs, `applicationShutdown()` runs, and `config_get_bool(nullptr appConfig)` crashes. On master the destructor calls `applicationShutdown()` only if `libobs_initialized` is true. That flag is set only after `StartupOBS` succeeds in `OBSInit`, which runs after `AppInit`. So when `MakeUserDirs` throws, `applicationShutdown()` is never reached. The guard came in with de997b1e2, which first shipped in tag 32.0.0; the reporter was on 31.1.2.
- **Evidence:**
  - `frontend/OBSApp.cpp:1013-1018`: destructor guarded by `if (libobs_initialized)`.
  - `frontend/OBSApp.cpp:1132-1133`: throw on `MakeUserDirs` failure.
  - `frontend/OBSApp.cpp:1314`: `libobs_initialized = true` only after `StartupOBS`.
  - `frontend/OBSApp.cpp:2060`: the macOS `config_get_bool(appConfig, ...)` call is no longer reached.
  - `git tag --contains de997b1e2` gives 32.0.0 as the earliest release.
- **Related:** none.

### [#12679](https://github.com/obsproject/obs-studio/issues/12679) — OBS 32.0.1 Crashing with "GPU process isn't usable. Goodbye."

- **Verdict:** CANNOT_VERIFY
- **Reasoning:** "GPU process isn't usable" is the Chromium/CEF GPU process giving up (obs-browser). The setup is a Flatpak build on CachyOS with a hybrid Intel iGPU and NVIDIA RTX 5060 and the 580 driver. This is specific to the driver, sandbox and hybrid GPU, and the body contains no OBS-side stack. No defect in OBS code can be identified.
- **Evidence:** issue body (terminal output, nvidia-smi); no crash log generated.
- **Related:** #12913, #13166 (other Linux crashes with no stack).

### [#12832](https://github.com/obsproject/obs-studio/pull/12832) — libobs: Fix signal callback removal during signaling

- **Verdict:** IMPLEMENT
- **Reasoning:** The defects are visible in master `signal.c`:
  1. The callback-ref drop does `os_atomic_set_long(&refs, os_atomic_load_long(&refs) - remove_refs)`, which is a non-atomic read-modify-write. It races with `signal_handler_destroy`'s `os_atomic_dec_long`, so the handler may never be freed or may be freed early. It also never destroys the handler when the count reaches 0.
  2. `sig->signalling` is a bool. A nested `signal_handler_signal` on the same signal (the mutex is recursive) resets it to false and erases callbacks while the outer loop is still iterating, which skips indexes.
  3. `current_signal_cb` and `current_global_cb` are reset to NULL instead of restored after a nested call.
  4. Global callback removal is tracked per callback (`cb->signaling`) instead of per handler, so removing another callback during a global signal erases it immediately.

  The PR replaces these with depth counters, a CAS loop, and save/restore of the current callback. It is 1 file, +42/-25, and applies cleanly. `os_atomic_compare_exchange_long` updates `*old` on failure on both platforms, so the CAS loop is correct.
- **Evidence:**
  - `libobs/callback/signal.c:299`: `sig->signalling = true` (bool, not a depth counter).
  - `libobs/callback/signal.c:306`: `current_signal_cb = NULL` (not restored).
  - `libobs/callback/signal.c:330`: per-callback `cb->signaling++`.
  - `libobs/callback/signal.c:349`: non-atomic refs subtraction.
  - `libobs/callback/signal.c:154-158`: `signal_handler_destroy` uses an atomic decrement and defers freeing while refs > 0.
  - `libobs/util/threading-windows.h:83-89`: CAS semantics.
- **Slice:** cherry-pick `13fc81b85` and `fdf865be2` (libobs/callback/signal.c). About 67 lines.
- **Test plan:** MSVC build of libobs. Add or run a small cmocka test (test/cmocka) covering a nested signal and a disconnect from inside a callback, if the build allows linking libobs. Otherwise mark it UNTESTED at runtime.
- **Related:** none.

### [#12913](https://github.com/obsproject/obs-studio/issues/12913) — Crash on Projector View

- **Verdict:** CANNOT_VERIFY
- **Reasoning:** A fullscreen projector crash on CachyOS/KDE (32.0.2). The body has no stack trace; only an external log link is given. Projector code is shared by all platforms, and the crash is not reported elsewhere in this batch, which points to the distro or GPU stack. A defect cannot be identified from the code.
- **Evidence:** issue body only.
- **Related:** #12679, #13779.

### [#12939](https://github.com/obsproject/obs-studio/issues/12939) — OBS 32.0.4 crashes upon launch

- **Verdict:** CANNOT_VERIFY
- **Reasoning:** A Windows 11 crash on launch with no steps and only external crash-log URLs. These usually come from third-party plugins or overlay DLLs, and nothing in the body points at OBS code.
- **Evidence:** issue body only.
- **Related:** none.

### [#12953](https://github.com/obsproject/obs-studio/issues/12953) — OBS crashes if filename contains german Umlaut

- **Verdict:** IMPLEMENT (fixed by cherry-picking PR #12964)
- **Reasoning:** `os_generate_formatted_filename` expands `%Z` and other specifiers with the narrow CRT `strftime`. On Windows that returns the active ANSI codepage, not UTF-8. On German Windows the timezone name "Mitteleuropäische Zeit" therefore contains a CP1252 `0xE4` byte. The resulting string is invalid UTF-8 and breaks the UTF-8 to wide conversion in later file APIs (`os_fopen` and similar), so the recording path fails or crashes. The root cause is clear in the code.
- **Evidence:**
  - `libobs/util/platform.c:697-733`: `os_generate_formatted_filename`, with `%Z` in the spec table.
  - `libobs/util/platform.c:730`, `libobs/util/platform.c:732`: narrow `strftime` calls.
- **Slice:** see #12964.
- **Related:** #12964.

### [#12964](https://github.com/obsproject/obs-studio/pull/12964) — libobs: Fix crash with non-ASCII characters in formatted filenames

- **Verdict:** IMPLEMENT
- **Reasoning:** Fixes the root cause of #12953. It adds `os_strftime_utf8()`, which on Windows uses `wcsftime` and then `os_wcs_to_utf8`, and on other platforms is a plain `strftime`. The two call sites now use it. The patch is 2 files, +39/-2, and applies cleanly. The buffer sizes are fine: the format is converted into `wchar_t[64]` with a wchar count, and the output buffer is `wchar_t[256]` converted into the existing 128-byte `convert`. The PR also exports a new public symbol; that is acceptable here, though it could be kept `static` if we want to avoid growing the API.
- **Evidence:**
  - `libobs/util/platform.c:730-732`: the `strftime` calls.
  - `libobs/util/platform.c:364-386`: `os_utf8_to_wcs` takes `dst_size` in wchar units, which the PR uses correctly.
- **Slice:** cherry-pick `d514ac4c1` (libobs/util/platform.c, libobs/util/platform.h). About 41 lines.
- **Test plan:** MSVC build of libobs on Windows x64. Optionally add a cmocka test calling `os_strftime_utf8` with `%Y-%m-%d` and `%Z`, and check the output is valid UTF-8. A non-ASCII timezone needs German locale or timezone settings and is not available on this machine, so the reported scenario stays UNTESTED.
- **Related:** #12953.

### [#13153](https://github.com/obsproject/obs-studio/issues/13153) — soname: libobs.so.30 vs libobs.so.0

- **Verdict:** DEFER_LARGE
- **Reasoning:** This is valid. On Linux the SOVERSION is hard-coded to 30 for every shared library, and a legacy `libobs.so.0` symlink is created next to it. The soname therefore does not track ABI breaks, which is what Debian wants to express. Fixing it is an ABI and versioning policy decision (which number, when it bumps, and what to do with the `.so.0` compatibility link). It affects every downstream distro and plugin, and there is no single obvious minimal patch. The decision belongs to maintainers and packagers, and it is Linux-only and untestable here.
- **Evidence:**
  - `cmake/linux/helpers.cmake:22`: `set(OBS_SOVERSION 30)`.
  - `cmake/linux/helpers.cmake:64-68`: VERSION and SOVERSION set from it.
  - `cmake/linux/helpers.cmake:96-112`: `.so.0` legacy symlink.
  - `libobs/CMakeLists.txt:390-394`: libobs requests `SOVERSION "${OBS_VERSION_MAJOR}"`, but the helper later overrides it.
- **Related:** none.

### [#13166](https://github.com/obsproject/obs-studio/issues/13166) — OBS Crashes after obs shutdown

- **Verdict:** CANNOT_VERIFY
- **Reasoning:** A crash on exit on Arch/KDE using the distro (pacman) package, which is not an upstream build. The crash.txt attachment is not available in the item data, and the body has no frames. Shutdown logic was reworked on master (14572498d, 9f4320ec7), but without a stack the report cannot be tied to a specific path.
- **Evidence:**
  - `frontend/OBSApp.cpp:2036-2074`: `applicationShutdown` on master.
  - git log: 9f4320ec7 "frontend: Adjust shutdown logic more" (2026-06).
- **Related:** #12679.

### [#13299](https://github.com/obsproject/obs-studio/pull/13299) — libobs: Add BLERP, an optimized bicubic scaler

- **Verdict:** DEFER_LARGE
- **Reasoning:** The diff is small (+40) and applies, but it adds a new public `enum obs_scale_type` value (`OBS_SCALE_BLERP`), a new serialized scene-item string, and a uniform branch in `bicubic_scale.effect`. The PR body says it also wires multitrack config, but the diff does not touch the frontend, so nothing in the app can select BLERP. The algorithm replaces the four edge-midpoint taps with corner averages, so its output is not the same as bicubic, which contradicts the PR's description. Whether to add a new user-facing scaler, and whether this quality trade-off is acceptable, needs maintainer design and UX decisions. As-is it would add public API with no user-reachable effect in this fork.
- **Evidence:**
  - `libobs/obs.h:126-131`: `enum obs_scale_type`.
  - PR diff: `libobs/data/bicubic_scale.effect` `use_blerp` branch; `libobs/obs-scene.c` load/save; `libobs/obs-video.c` `get_scale_effect_internal`.
- **Related:** none.

### [#13309](https://github.com/obsproject/obs-studio/issues/13309) — OBS Studio crash when selecting IPV6 and binding to IPV4 address

- **Verdict:** CANNOT_VERIFY
- **Reasoning:** With both "IPv6 only" and an IPv4 bind address set, rtmp-stream ignores the family hint and uses the bind address length instead. That is intended: the code comment says the IPv4/IPv6 hint is used only if no binding address is given. happy-eyeballs then restricts `getaddrinfo` to `AF_INET` from `bind_addr_len`, and the connection proceeds as IPv4. There is no obvious memory-safety problem on this path. The crash is intermittent ("might take a few attempts"), and only an external crash-log URL is given. A race in the happy-eyeballs candidate threads is possible but cannot be identified without the stack.
- **Evidence:**
  - `plugins/obs-outputs/rtmp-stream.c:1191-1205`: bind IP overrides the family hint.
  - `plugins/obs-outputs/rtmp-stream.c:1471-1477`: `IPFamily` parsing.
  - `shared/happy-eyeballs/happy-eyeballs.c:197-200`: family derived from `bind_addr_len`.
  - `shared/happy-eyeballs/happy-eyeballs.c:346-347`: `bind` before `connect`.
- **Related:** none.

### [#13595](https://github.com/obsproject/obs-studio/issues/13595) — Consumes GPU watts, memory and processing power unnecessarily unless keeps changing process priority

- **Verdict:** CANNOT_VERIFY
- **Reasoning:** The report is screenshots showing GPU and power use falling after the user changes OBS's process priority in Task Manager. It is labelled needs/more-info upstream. The behaviour is Windows scheduler and GPU-driver power-state behaviour, and no OBS code path is implicated. OBS's own priority setting is applied once at startup by the frontend.
- **Evidence:** issue body; upstream label `needs/more-info`.
- **Related:** none.

### [#13749](https://github.com/obsproject/obs-studio/pull/13749) — libobs: Ensure buffer size for utf-16 converted filepaths

- **Verdict:** IMPLEMENT (partial-pr)
- **Reasoning:** The full PR (10 commits, 37 files, +448/-603) moves the frontend to `std::filesystem` and graphics-hook to W APIs, and removes the plugin-path length limit. That is a broad refactor and is deferred. Two of its commits are self-contained, real bug fixes that can be confirmed on master:
  1. `os_stat` on Windows passes `sizeof(w_file)` (1024 bytes) as the wchar count for a `wchar_t[512]` buffer. `os_utf8_to_wcs` treats `dst_size` as a wchar count, so a UTF-8 path longer than 511 characters overflows the stack buffer.
  2. `BPtr::operator=(BPtr&&)` overwrites `ptr` without `bfree`-ing the old value, which leaks memory. The move constructor also leaves `ptr` uninitialized before delegating.
- **Evidence:**
  - `libobs/util/platform.c:96-97`: `wchar_t w_file[512]` with `sizeof(w_file)`.
  - `libobs/util/platform.c:373-382`: `out_len = dst_size - 1`; `dst[out_len] = 0`.
  - `libobs/util/util.hpp:40`: move ctor without an init.
  - `libobs/util/util.hpp:50-55`: move-assign without `bfree`.
- **Slice:** cherry-pick only `b2f22417b` ("libobs: Fix os_stat overflow with long filenames", 1 line) and `88f9ad90b` ("libobs: Fix BPtr re-assignment leaking pointer", 2 lines). Defer the other 8 commits. In the commit message, note that a self-move-assign would now free the pointer it keeps; no caller does that.
- **Test plan:** MSVC build of libobs and the frontend. Optionally add a cmocka test calling `os_stat` with a 600-character path, which should return -1 without corrupting the stack.
- **Related:** #12964 (same Windows encoding/path area).

### [#13779](https://github.com/obsproject/obs-studio/issues/13779) — When resizing or fullscreening OBS it crashes my pc (hardlock)

- **Verdict:** OUT_OF_SCOPE
- **Reasoning:** A full-system hard lock that needs a reboot (Fedora 44 KDE, PipeWire capture while recording) cannot be caused by a user-space application alone. It is a kernel, GPU driver or compositor fault. The reporter also suspects KDE/PipeWire. Any fix belongs in the driver or compositor.
- **Evidence:** issue body (photo of a frozen screen, no log of the event).
- **Related:** #12913.

### [#13784](https://github.com/obsproject/obs-studio/issues/13784) — Selecting "Microsoft DV Camera and VCR" as a video capture device causes a crash

- **Verdict:** CANNOT_VERIFY
- **Reasoning:** FireWire DV capture through the legacy MSDV DirectShow driver on a VIA VT6308P card. No crash report was produced, and the attached log has no stack. This is in scope (win-dshow / libdshowcapture), but it is hardware specific and cannot be reproduced or traced here.
- **Evidence:** issue body; win-dshow uses libdshowcapture (submodule) for the device graph.
- **Related:** none.

### [#13816](https://github.com/obsproject/obs-studio/pull/13816) — libobs/util: Add thread naming on OpenBSD

- **Verdict:** IMPLEMENT
- **Reasoning:** OpenBSD provides `pthread_set_name_np` in `<pthread_np.h>`, the same as FreeBSD. The build system already treats OpenBSD as a Linux-like host. The change is 2 lines, it only adds `|| defined(__OpenBSD__)` to the existing FreeBSD branches, and it applies cleanly. It cannot affect Windows, macOS or Linux builds.
- **Evidence:**
  - `libobs/util/threading-posix.c:29`: FreeBSD `pthread_np.h` include.
  - `libobs/util/threading-posix.c:262-263`: FreeBSD `pthread_set_name_np`.
  - `cmake/common/osconfig.cmake:15`: `Linux|FreeBSD|OpenBSD` host match.
- **Slice:** cherry-pick `208f8447a` (libobs/util/threading-posix.c). 4 lines.
- **Test plan:** UNTESTED. This is OpenBSD-only code and the Windows build does not compile threading-posix.c. Only a preprocessor check is possible.
- **Related:** none.

### [#13884](https://github.com/obsproject/obs-studio/pull/13884) — libobs: Add sub property group

- **Verdict:** DEFER_LARGE
- **Reasoning:** This is a new properties API feature: a group type whose children are stored in a nested `obs_data` object. It touches libobs properties, the docs, and a substantial part of `shared/properties-view` (+155/-111), and it no longer applies (`properties-view.cpp` hunk at line 276 fails). The author says an earlier version (#7612) was closed by maintainers. The settings-schema design needs maintainer agreement, and the rebase is not trivial.
- **Evidence:**
  - `libobs/obs-properties.h:108-111`: existing group types are only `OBS_GROUP_NORMAL` and `OBS_GROUP_CHECKABLE`.
  - `git apply --check` fails on `shared/properties-view/properties-view.cpp`.
- **Related:** none.

### [#14004](https://github.com/obsproject/obs-studio/pull/14004) — libobs: Fix graphics tasks lost on video reset

- **Verdict:** IMPLEMENT
- **Reasoning:** The root cause is confirmed in the code. Graphics tasks run only once per frame, inside the loop. When `obs_reset_video()` stops the thread, tasks queued after the last frame stay in the queue. `obs_free_video()` then destroys `task_mutex` and frees `video.tasks`, so those tasks are lost. Threads such as the destroy queue can also still be calling `obs_queue_task(OBS_TASK_GRAPHICS)`, which locks a destroyed or re-initialised mutex. The PR:
  1. Runs `execute_graphics_tasks()` once after the loop exits.
  2. Moves the task mutex init into `obs_init` and the queue/mutex teardown into `obs_shutdown`, after the destruction task thread is destroyed.

  The PR author gives a concrete user impact: win-capture's duplicator leaks and display capture stays black. The patch is 2 files, +7/-6, and applies cleanly.
- **Evidence:**
  - `libobs/obs-video.c:957-968`: `execute_graphics_tasks`.
  - `libobs/obs-video.c:1130`: called only inside the loop.
  - `libobs/obs-video.c:1188-1193`: no drain after the loop exits.
  - `libobs/obs.c:700-701`: `task_mutex` init in `obs_init_video` (per reset).
  - `libobs/obs.c:853-855`: mutex destroy and deque free in `obs_free_video`.
  - `libobs/obs.c:1526-1540`: `obs_reset_video` calls `stop_video` and then `obs_free_video`.
  - `libobs/obs.c:3341-3347`: other threads push to `video.tasks` under `task_mutex`.
  - `libobs/obs.c:1442-1443`: shutdown order (`obs_free_video`, then `os_task_queue_destroy`).
- **Slice:** cherry-pick `905ae66b3` and `38ed1e7d6` (libobs/obs-video.c, libobs/obs.c). About 13 lines.
- **Test plan:** MSVC build of libobs and the frontend. Run OBS, change the base/output resolution (video reset) a few times with a display capture present, and check there are no hangs or asserts on reset or exit. The exact display-capture `DXGI_ERROR_ACCESS_LOST` scenario depends on timing and may be impractical to reproduce.
- **Related:** none.

### [#14038](https://github.com/obsproject/obs-studio/issues/14038) — Crash when clicking tray icon

- **Verdict:** CANNOT_VERIFY
- **Reasoning:** macOS 27 with 33.0.0-rc1 crashes when the tray icon is clicked, including in safe mode. On macOS, `IconActivated` only rebuilds the projector submenus (`updateSysTrayProjectorMenu`) while the native menu is opening. That is a plausible suspect, but it cannot be confirmed without the crash stack. A WebFetch of the thread shows no maintainer analysis or stack frames, only a pointer to possibly related issues #13938 and #13736. The bug may also be in Qt or the new macOS.
- **Evidence:**
  - `frontend/widgets/OBSBasic_SysTray.cpp:78`: `activated` is connected to `IconActivated`.
  - `frontend/widgets/OBSBasic_SysTray.cpp:87-98`: `IconActivated` calls `updateSysTrayProjectorMenu()` on every platform.
- **Related:** upstream #13938 and #13736 (not in this batch).

### [#14042](https://github.com/obsproject/obs-studio/pull/14042) — libobs: format_conversion.effect: drop redundant zero texel offsets

- **Verdict:** IMPLEMENT
- **Reasoning:** Five chroma reads call `image.Sample(def_sampler, uv, 0)`. In D3D11 HLSL the third argument is an integer texel offset, and 0 is a no-op. The OpenGL backend passes the call through as `texture(tex, uv, 0)`, where the third argument is a LOD bias, and 0 is again a no-op. Removing the argument does not change behaviour on any backend, makes these lines match the rest of the effect files, and removes an argument that GLSL ES front-ends reject. The change is 5 lines and applies cleanly.
- **Evidence:**
  - `libobs/data/format_conversion.effect:574`, `:585`, `:596`, `:609`, `:622`: the five 3-argument `Sample` calls.
  - `libobs-opengl/gl-shaderparser.c:425-426`: `Sample` is mapped to `texture(...)` with arguments passed through.
  - The 3-argument form was introduced in e119a7024 ("Sample video at default chroma location").
- **Slice:** cherry-pick `afaee51dd` (libobs/data/format_conversion.effect). 10 lines.
- **Test plan:** build on Windows x64 and run OBS, which compiles format_conversion.effect at startup through D3D11. Use a media or capture source with UYVY/YUY2/YVYU input, if one is available, and check that colours are unchanged.
- **Related:** none.

### [#14076](https://github.com/obsproject/obs-studio/issues/14076) — Memory usage in version 33.0.0 appears about 9 times higher than in 32.2.2

- **Verdict:** CANNOT_VERIFY
- **Reasoning:** The reporter says it happens only on one PC and depends on their configuration. The log is flooded with FFmpeg swscale's "deprecated pixel format used" warning, which comes from a source feeding a YUVJ (full-range JPEG) pixel format through swscale, such as an MJPEG camera or a media source. A 30-second startup and about 10 GB of RAM suggest one source misbehaving or buffering. Without the scene collection or a memory profile, no regression between 32.2.2 and 33.0.0 can be pinned to code.
- **Evidence:** issue body (log excerpt description).
- **Related:** none.
