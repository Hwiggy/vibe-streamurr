# Triage batch build-ci-docs-02

- Batch id: build-ci-docs-02 (area hint: build-ci-docs; several items are really Linux runtime bugs, the hint was ignored where wrong)
- Items: 8910, 8983, 9104, 9110, 9199, 9247, 9736, 9974, 9979, 10113, 10399, 10459, 10756, 10771, 10808, 10976, 10979, 11012, 11166, 11417, 12057, 12138
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; PR heads from `refs/upstream-pr/<N>`. No GitHub API/WebFetch used. The local git (2.33) lacks `merge-tree --write-tree`, so conflicts were checked with legacy `git merge-tree <merge-base> master refs/upstream-pr/N` (counting `+<<<<<<<` markers).

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 8910 | issue | OUT_OF_SCOPE |
| 8983 | issue | ALREADY_ADDRESSED |
| 9104 | issue | IMPLEMENT |
| 9110 | issue | ALREADY_ADDRESSED |
| 9199 | issue | IMPLEMENT (docs part only) |
| 9247 | issue | CANNOT_VERIFY |
| 9736 | issue | CANNOT_VERIFY |
| 9974 | PR | IMPLEMENT (cherry-pick) |
| 9979 | PR | DEFER_LARGE |
| 10113 | PR | IMPLEMENT (partial-pr + missing registration) |
| 10399 | issue | OUT_OF_SCOPE |
| 10459 | PR | IMPLEMENT (re-port, conflicts) |
| 10756 | PR | IMPLEMENT (cherry-pick) |
| 10771 | issue | ALREADY_ADDRESSED |
| 10808 | issue | CANNOT_VERIFY |
| 10976 | issue | ALREADY_ADDRESSED |
| 10979 | PR | IMPLEMENT (partial-pr, adapt to Gio finder) |
| 11012 | issue | CANNOT_VERIFY |
| 11166 | PR | IMPLEMENT (partial-pr, drop conflicting hunks) |
| 11417 | issue | OUT_OF_SCOPE |
| 12057 | PR | IMPLEMENT (cherry-pick) |
| 12138 | PR | DEFER_LARGE |

---

### [#8910](https://github.com/obsproject/obs-studio/issues/8910) — OBS rendering problem when dragging between two monitors if scaling is enabled on one of them

**Verdict: OUT_OF_SCOPE**

Reporter sees the Qt UI break when moving the window between Wayland outputs with fractional scaling (GNOME experimental fractional scaling, labwc). Upstream labelled it `area/dependency` + `platform/linux`, i.e. triaged as a Qt/compositor problem, not OBS code. OBS does not do its own window-scale handling for the Qt widget tree; the preview uses Qt's devicePixelRatio. Nothing in OBS to change without a repro on Wayland, which this Windows box cannot provide.

Evidence:
- Upstream labels `area/dependency`, `platform/linux` (item metadata).
- No OBS-side fractional-scale handling to patch; window/UI rendering belongs to Qt's Wayland platform plugin.

Related: none.

### [#8983](https://github.com/obsproject/obs-studio/issues/8983) — A problem with exporting header files

**Verdict: ALREADY_ADDRESSED**

The report is about the legacy CMake build where install components were named `obs_libraries` while docs and scripts used `--component obs_${target}`. That legacy CMake framework was replaced by build framework 3.0 (`ae6e9c875 cmake: Add OBS CMake build framework 3.0`). Install components are now only `Runtime` and `Development`, and no `obs_libraries` or `obs_${target}` component names remain.

Evidence:
- `cmake/common/helpers_common.cmake:311-320` puts headers and libraries under `COMPONENT Development`.
- `cmake/windows/helpers.cmake:248-254` uses `COMPONENT Runtime` / `Development`.
- `grep obs_libraries cmake/` finds nothing.

Related: none.

### [#9104](https://github.com/obsproject/obs-studio/issues/9104) — clang fails to compile obs-studio: comparison of integers of different signs: 'int' and 'uint_fast8_t'

**Verdict: IMPLEMENT**

The defect is still present. `jack_data::channels` is `uint_fast8_t`. On FreeBSD that type is `unsigned int`; on glibc it is `unsigned char`, which promotes to int, so Linux builds don't warn. The plugin compares it against an `int`. Clang C builds enable `-Wsign-compare`, and with `CMAKE_COMPILE_WARNING_AS_ERROR` that becomes a build error. FreeBSD is a supported build target (`cmake/*/os-freebsd.cmake`).

Evidence:
- `plugins/linux-jack/jack-wrapper.h:29`: `uint_fast8_t channels;`
- `plugins/linux-jack/jack-input.c:62`: `int new_channel_count = obs_data_get_int(settings, "channels");`
- `plugins/linux-jack/jack-input.c:69`: `if (new_channel_count != data->channels)`
- `cmake/common/compiler_common.cmake:47` (`-Wsign-compare` in clang common options); `cmake/common/compiler_common.cmake:65` and `cmake/linux/compilerconfig.cmake:51` apply them to C/Clang.

Slice plan:
- Approach: new-change, about 1-2 lines in `plugins/linux-jack/jack-input.c`.
- Change the comparison to `if (new_channel_count != (int)data->channels)`, which is exact because channels is at most 8.
- Test plan: linux-jack is built only on Linux/FreeBSD, so this cannot be compiled on Windows. The commit must say UNTESTED. A visual diff review is the only check.

Related: 9110, 10976 (other FreeBSD/clang build-failure reports from the same reporter).

### [#9110](https://github.com/obsproject/obs-studio/issues/9110) — error: unqualified call to 'std::move' [-Werror,-Wunqualified-std-cast-call]

**Verdict: ALREADY_ADDRESSED**

The vendored json11 still calls `move(...)` unqualified (via `using std::move;`), but its CMake target now turns off that warning for AppleClang >= 14 and Clang >= 15. Those are exactly the compilers that introduced `-Wunqualified-std-cast-call`, so the build no longer fails.

Evidence:
- `deps/json11/json11.cpp:39` (`using std::move;`), `:202,210,218,260` (unqualified `move(`).
- `deps/json11/CMakeLists.txt:10-15`: `target_compile_options(json11 PUBLIC -Wno-unqualified-std-cast-call)` for Clang >= 15 / AppleClang >= 14.

Related: 9104.

### [#9199](https://github.com/obsproject/obs-studio/issues/9199) — obs-scripting + API doc: obs_source_get_color_space() and gs_get_format_from_space()

**Verdict: IMPLEMENT (documentation part only; scripting array binding deferred)**

The issue makes two requests:
1. `gs_get_format_from_space()` is missing from the API docs. This is true: it is a public static-inline helper in `graphics.h` with no docs entry. Its siblings `gs_get_format_bpp`, `gs_is_srgb_format` and `gs_generalize_format` are also undocumented.
2. Lua/Python cannot pass the `const enum gs_color_space *preferred_spaces` array to `obs_source_get_color_space()`. Fixing this needs a SWIG typemap or hand-written glue in both `obs-scripting-lua.c` and `obs-scripting-python.c`, plus design work on table/list handling. That is not small and cannot be tested well here, so it is deferred.

Evidence:
- `libobs/graphics/graphics.h:995-1007`: `gs_get_format_from_space` definition.
- `docs/sphinx/reference-libobs-graphics-graphics.rst:652` documents `gs_get_color_space` but has no entry for `gs_get_format_from_space` (grep finds no match in docs).
- `docs/sphinx/reference-sources.rst:1064` documents `obs_source_get_color_space` with the array param.
- `shared/obs-scripting/obspython/obspython.i` has no typemap for `enum gs_color_space const *`.

Slice plan:
- Approach: new-change, about 15-25 lines in `docs/sphinx/reference-libobs-graphics-graphics.rst`.
- Add `.. function:: enum gs_color_format gs_get_format_from_space(enum gs_color_space space)` next to `gs_get_color_space`. Describe it as returning `GS_RGBA16F` for `GS_CS_SRGB_16F`, `GS_CS_709_EXTENDED` and `GS_CS_709_SCRGB`, and `GS_RGBA` otherwise. Optionally add a note to `obs_source_get_color_space` that scripting bindings cannot pass the array.
- Test plan: docs only. Run `sphinx-build` if Sphinx is available locally; otherwise review the rst syntax by eye.

Related: 10756, 9974 (other docs gaps).

### [#9247](https://github.com/obsproject/obs-studio/issues/9247) — Flatpak and git (29.1.3) hang with mask applied to source

**Verdict: CANNOT_VERIFY**

The UI hangs when an image mask is applied, on Gentoo with an FX-8350, in both Flatpak and self-built versions. There is no backtrace, and the image mask filter is used widely on all platforms without similar reports. The hang is probably environment- or GPU/driver-specific. No defect can be found in `obs-filters/mask-filter.c` from the body alone.

Evidence:
- Body has only reproduction steps and a log URL, with no stack trace.
- `plugins/obs-filters/mask-filter.c`: the image is loaded through the standard `gs_image_file` path shared with the image source.

Related: none.

### [#9736](https://github.com/obsproject/obs-studio/issues/9736) — Unable to Build Debian Package

**Verdict: CANNOT_VERIFY**

`cpack` on Debian Sid with a `/usr/local` prefix fails in `dpkg-shlibdeps` when it resolves `libobs-frontend-api.so.0` for `_obspython.so`. Current CMake installs a legacy `.so.0` symlink for libobs and obs-frontend-api next to the `.so.30` SONAME, and Linux uses `CPACK_DEBIAN_PACKAGE_SHLIBDEPS TRUE`. Upstream CI builds `.deb` packages on Ubuntu with the same config (`.github/scripts/package-ubuntu`). The failure looks specific to the reporter's prefix or dpkg version. Confirming which DT_NEEDED entry `_obspython.so` carries needs a Linux build, which this Windows box cannot do.

Evidence:
- `cmake/linux/cpackconfig.cmake` (OS_LINUX block): `CPACK_DEBIAN_PACKAGE_SHLIBDEPS TRUE`, `CPACK_SET_DESTDIR TRUE`.
- `cmake/linux/helpers.cmake:22` (`OBS_SOVERSION 30`), `:94-112` (legacy `.so.0` symlink installed for libobs/obs-frontend-api).
- `shared/obs-scripting/obspython/CMakeLists.txt:70` links `OBS::frontend-api`.

Related: none.

### [#9974](https://github.com/obsproject/obs-studio/pull/9974) — Update reference-sources.rst with obs_source_frame2 documentation

**Verdict: IMPLEMENT (cherry-pick-pr)**

`obs_source_frame2`, `obs_source_output_video2`, `obs_source_preload_video2` and `obs_source_set_video_frame2` are public API in `obs.h`, but the sphinx docs never document them. The only mention is a cross-reference to `obs_source_output_video2()` in the profiler docs, which currently points nowhere. The PR adds 105 lines of docs only, and legacy merge-tree shows no conflicts.

Evidence:
- `libobs/obs.h:325` (`struct obs_source_frame2`), `:1447-1478` (the `*2` functions and their "use ...2 for partial range" notes).
- `docs/sphinx/reference-libobs-util-source-profiler.rst:36` references `obs_source_output_video2()`, which has no definition anywhere in the docs.
- `git diff master...refs/upstream-pr/9974 --stat`: 1 file, +105.

Slice plan:
- Approach: cherry-pick `b2137de06` and `23c01449c` (author preserved; GPL-2.0-or-later contribution).
- Fixup to consider: the struct block mixes a tab indent (`enum video_range_type range`), and a blank line is missing before the `obs_source_set_async_rotation` entry. A small follow-up commit can fix whitespace.
- Test plan: docs only. Run `sphinx-build` if available, otherwise review by eye.

Related: 10756, 9199.

### [#9979](https://github.com/obsproject/obs-studio/pull/9979) — Add Flatpak aarch64 builds (Part 1: build)

**Verdict: DEFER_LARGE**

This is a draft CI redesign: 7 commits and 10 files, +278/-81. It splits the Flatpak workflow into reusable multi-job pipelines and runs 6-hour or longer QEMU aarch64 builds. It also changes QSV enablement CMake. It conflicts with master in 3 hunks (base 2023-12), the author says the publish workflow depends on design approval, and this fork does not publish Flatpaks. No small slice delivers value. The QSV-arch commit is already covered: `plugins/CMakeLists.txt:94-98` builds obs-qsv11 only for `ARCHITECTURES x64 x86_64`.

Evidence:
- `git diff master...refs/upstream-pr/9979 --stat`: 10 files, 278+/81-.
- Legacy merge-tree finds 3 conflict blocks.

Related: none.

### [#10113](https://github.com/obsproject/obs-studio/pull/10113) — obs-scripting: Add methods for getting scene/hotkey from calldata

**Verdict: IMPLEMENT (partial-pr plus a fix)**

Scripts cannot turn the `ptr` parameters of signals like `refresh` (scene) or `hotkey_register` (hotkey) into usable objects. Only `calldata_source` and `calldata_sceneitem` exist. The PR copies those helpers for `obs_scene_t` and `obs_hotkey_t` and documents them. However, it never registers the new functions: no `add_func(...)` in Lua and no `DEF_FUNC(...)` in Python, so they would be dead code. The PR head still registers only the two existing functions. `obs_hotkey_t` is visible to SWIG because `obs-hotkey.h` is included in the `.i` file. The diff applies without conflicts.

Evidence:
- `shared/obs-scripting/obs-scripting-lua.c:854,874` (existing helpers), `:1017-1018` (registration).
- `shared/obs-scripting/obs-scripting-python.c:966,988` (existing helpers), `:1205-1206` (registration).
- `git show refs/upstream-pr/10113:shared/obs-scripting/obs-scripting-lua.c | grep add_func("calldata` lists only source/sceneitem.
- `shared/obs-scripting/obspython/obspython.i:15` includes `obs-hotkey.h`; `libobs/obs-hotkey.h:51` defines `obs_hotkey_t`.

Slice plan:
- Approach: partial-pr. Take the content of `fa7ed1694`/`2bf36e290` (skip the merge commits), then add `add_func("calldata_scene", calldata_scene); add_func("calldata_hotkey", calldata_hotkey);` in Lua and the matching `DEF_FUNC` entries in Python. About 106 lines across `obs-scripting-lua.c`, `obs-scripting-python.c` and `docs/sphinx/scripting.rst`.
- Test plan: build the `obs-scripting` target with MSVC on this Windows box if the Python/LuaJIT deps are configured, then run a small Lua script in OBS that connects `hotkey_register` on the global handler and calls `calldata_hotkey`. Mark UNTESTED if scripting deps are unavailable.

Related: 10756.

### [#10399](https://github.com/obsproject/obs-studio/issues/10399) — Changing camera resolution breaks the camera portal

**Verdict: OUT_OF_SCOPE**

On Fedora 39, changing the resolution of a PipeWire camera-portal source freezes the camera until OBS restarts. Upstream labelled it `area/dependency`, meaning the PipeWire/libcamera camera node. OBS's camera source tears down and recreates the stream on reconfiguration, and also supports in-place renegotiation. Nothing in that path looks wrong, and a failure to renegotiate inside the portal/PipeWire node is outside OBS.

Evidence:
- `plugins/linux-pipewire/camera-portal.c:248-281` (`stream_camera` destroys and reconnects with the selected resolution).
- `plugins/linux-pipewire/pipewire.c:1452` (`obs_pipewire_stream_set_resolution` renegotiation).
- Upstream labels `area/dependency`, `platform/linux`.

Related: 10459 (same PipeWire format-param code).

### [#10459](https://github.com/obsproject/obs-studio/pull/10459) — linux-pipewire: Use dynamic pod builder

**Verdict: IMPLEMENT (re-port; PR conflicts)**

Master still builds all EnumFormat pods (every format × every DMA-BUF modifier, each listed twice for DMA-BUF and SHM) into one fixed 4096-byte stack buffer. GPUs that advertise many modifiers can overflow it. The SPA builder then returns NULL pods, which are passed straight to `pw_stream_connect`/`pw_stream_update_params`, and negotiation fails. The PR fixes this by giving each format its own `spa_pod_dynamic_builder` and collecting the results in a `GPtrArray` with `free`. It does not apply: legacy merge-tree finds 10 conflict blocks, mostly from the 120-column clang-format reflow, so the change must be re-applied by hand. The re-port is about 100 changed lines in one file.

Evidence:
- `plugins/linux-pipewire/pipewire.c:553-556` (`uint8_t params_buffer[4096]` in `renegotiate_format`).
- `plugins/linux-pipewire/pipewire.c:1199,1233-1237` (same 4096 buffer in `obs_pipewire_connect_stream`).
- `plugins/linux-pipewire/pipewire.c:299-369` (`build_format` writes modifiers into the shared builder), `:372-412` (`build_format_params` loops over all formats twice).

Slice plan:
- Approach: partial-pr, re-applying `76ac74dbe` on current code and keeping the PR's design: one dynamic builder per `build_format`, results in a `GPtrArray(free)`, and `pw_stream_update_params`/`pw_stream_connect` fed from `params->pdata`/`params->len`.
- Keep the 1024-byte buffer at `pipewire.c:954` (buffer params) unchanged, because it does not scale with modifiers.
- `#include <spa/pod/dynamic.h>` first shipped in PipeWire 0.3.39 (to be checked against the PipeWire headers on a Linux box), but `plugins/linux-pipewire/CMakeLists.txt:8` still allows `PipeWire 0.3.33`. Raise that minimum to 0.3.39, or guard the dynamic builder with `PW_CHECK_VERSION` and keep the static buffer as a fallback.
- Test plan: linux-pipewire is Linux-only and cannot be built or run here. The commit must say UNTESTED. Note that upstream labelled it "Seeking Testers".

Related: 10399.

### [#10756](https://github.com/obsproject/obs-studio/pull/10756) — docs: Add examples and undocumented callback funcs

**Verdict: IMPLEMENT (cherry-pick-pr)**

This PR is docs only. It documents `calldata_set_data`, `calldata_get_int/float/bool/ptr/string/data`, which are all public in `calldata.h` and missing from `reference-libobs-callback.rst`. It also adds usage examples and short intro paragraphs to the signal/procedure sections. The single commit is +244/-8 across 3 rst files and legacy merge-tree finds no conflicts. It is slightly over the 200-line guide, but it is pure documentation with no code risk.

Evidence:
- `libobs/callback/calldata.h:77-78,103-123`: undocumented `calldata_get_data`, `calldata_set_data`, `calldata_get_*`.
- `docs/sphinx/reference-libobs-callback.rst:15-125` documents only `calldata_init/free/set_*/int/float/bool/ptr/string`.
- `git diff master...refs/upstream-pr/10756 --stat`: 3 files, 244+/8-.

Slice plan:
- Approach: cherry-pick `d2c496f1c` (author preserved).
- Test plan: docs only. Run `sphinx-build` if available, otherwise review by eye.

Related: 9974, 10113, 9199.

### [#10771](https://github.com/obsproject/obs-studio/issues/10771) — Fails to build against new libajantv2

**Verdict: ALREADY_ADDRESSED**

The reporter found three different spellings of the include-dirs variable (`AJA_LIBRARIES_INCLUDE_DIRS`, `LIBAJANTV2_INCLUDE_DIRS`, `LibAJANTV2_INCLUDE_DIRS`) in the old `cmake/Modules/FindLibAJANTV2.cmake`. Because of that, the OS-specific `ajantv2/src/lin` path never reached the target. The current finder in `cmake/finders/` uses one name, `LibAJANTV2_INCLUDE_DIRS`, appends the OS-specific subdir to it, and sets the imported target's `INTERFACE_INCLUDE_DIRECTORIES` from it. The old `cmake/Modules` finder no longer exists.

Evidence:
- `cmake/finders/FindLibAJANTV2.cmake:123-138`: appends `ajantv2/src/lin` on Linux to `LibAJANTV2_INCLUDE_DIRS`.
- `cmake/finders/FindLibAJANTV2.cmake:170`: `INTERFACE_INCLUDE_DIRECTORIES "${LibAJANTV2_INCLUDE_DIRS}"`.
- History: `182410cf6 aja: Prepare plugins for new libajantv2 repo`.

Related: none.

### [#10808](https://github.com/obsproject/obs-studio/issues/10808) — Audio issue with multiple inputs on the same source (OBS 30.1.2, Flatpak, PipeWire)

**Verdict: CANNOT_VERIFY**

Audio becomes choppy when two PulseAudio input sources capture the same default device under pipewire-pulse in Flatpak. The issue is labelled `issue/confirmed`, but the body gives no root cause. Each OBS pulse source opens its own `pa_stream`, and choppy audio with two streams on one device under pipewire-pulse points to buffer/latency negotiation in the server. That cannot be shown from OBS code or reproduced on Windows.

Evidence:
- `plugins/linux-pulseaudio/pulse-input.c:567` (`pulse_input_create`; one stream per source).
- Body has no log analysis or stack trace.

Related: none.

### [#10976](https://github.com/obsproject/obs-studio/issues/10976) — FreeBSD: error: call to undeclared function 'nvenc_device_available'

**Verdict: ALREADY_ADDRESSED**

`nvenc_device_available()` is defined only for `_WIN32` and `__linux__`. The call site now has a separate `#else` branch for other platforms such as FreeBSD that only dlopens `libnvidia-encode.so.1` and does not call the undeclared function. This whole block is also built only when `ENABLE_FFMPEG_NVENC` is set, and that option defaults to OFF.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg.c:126-129` and `:184-201` (definitions under `_WIN32` / `__linux__`).
- `plugins/obs-ffmpeg/obs-ffmpeg.c:257-272`: `#ifdef _WIN32 ... #elif defined(__linux__) ... #else` dlopen-only branch.
- `plugins/obs-ffmpeg/CMakeLists.txt:7`: `option(ENABLE_FFMPEG_NVENC ... OFF)`.

Related: 9104.

### [#10979](https://github.com/obsproject/obs-studio/pull/10979) — frontend,cmake: Get default video path on Linux with GLib

**Verdict: IMPLEMENT (partial-pr; adapt the CMake part)**

On Linux, `GetDefaultVideoSavePath()` returns `$HOME`, so new profiles record into the home directory instead of the XDG Videos directory (the PR says it closes #3746). The PR switches to `g_get_user_special_dir(G_USER_DIRECTORY_VIDEOS)` and falls back to `$HOME`. The C++ change applies cleanly. The CMake part calls `find_package(GLIB2)` and links `GLIB2::GLIB2`, but OBS has no FindGLIB2 finder; the only one is inside the Qt deps package. Its `os-linux.cmake` context line (`Qt::GuiPrivate`) has also changed on master. The in-tree way to get GLib is `find_package(Gio)` / `gio::gio`, which libobs and linux-pipewire already use.

Evidence:
- `frontend/utility/platform-x11.cpp:227-230`: `return string(getenv("HOME"));`.
- `frontend/widgets/OBSBasic.cpp:633,657,665`: used as default for SimpleOutput FilePath, AdvOut RecFilePath and FFFilePath.
- `cmake/finders/FindGio.cmake` exists; `libobs/cmake/os-linux.cmake:5,79-81` and `plugins/linux-pipewire/CMakeLists.txt:9,41` use `gio::gio`.
- `frontend/cmake/os-linux.cmake`: `target_link_libraries(obs-studio PRIVATE Qt::DBus)` (differs from PR context).

Slice plan:
- Approach: partial-pr, about 8 lines. Take the `platform-x11.cpp` hunk (`#include <glib.h>` and the `g_get_user_special_dir` call with HOME fallback) verbatim.
- In `frontend/cmake/os-linux.cmake` and `os-freebsd.cmake`, add `find_package(Gio REQUIRED)` and link `gio::gio` instead of GLIB2.
- Test plan: Linux/FreeBSD-only code path, so it cannot be built here. The commit must say UNTESTED.

Related: none.

### [#11012](https://github.com/obsproject/obs-studio/issues/11012) — OBS core dump when using integrated gpu on wayland

**Verdict: CANNOT_VERIFY**

With `DRI_PRIME=1` in Flatpak on an AMD dGPU + iGPU system, the graphics thread segfaults at instruction pointer 0. That is a call through a NULL function pointer, most likely an EGL/GL entry point the PRIME-selected driver did not provide. Upstream labelled it `area/dependency`. The stack has no symbols and the setup depends on specific hardware and drivers. Finding which unloaded GL/EGL pointer was called needs a symbolized backtrace.

Evidence:
- Body: `segfault at 0 ip 0000000000000000` in thread `libobs: graphic`.
- `libobs-opengl/gl-egl-common.c` loads EGL extensions via glad; no specific unchecked pointer can be identified from the report.

Related: 12057 (same file, unrelated).

### [#11166](https://github.com/obsproject/obs-studio/pull/11166) — Fix spelling errors

**Verdict: IMPLEMENT (partial-pr)**

This is a cosmetic cleanup: 6 commits, 48 files, 91 lines changed one-for-one. It fixes typos in log messages, docs, comments, CMake messages, one libobs parameter name and vendored libcaption. It is in scope and harmless. The `media_set_time` parameter rename (`miliseconds` to `milliseconds`) in `obs-source.h` does not change the ABI. Legacy merge-tree finds 3 real conflict blocks among 24 files changed on both sides. Most hunks still apply, because the clang-format/gersemi reformatting mostly left these lines alone.

Evidence:
- `git log master..refs/upstream-pr/11166`: `32a0f6b96`, `453c3ac36`, `b4e9f5323`, `59b5581fe`, `1eb15da6e`, `eeed96e39`.
- Legacy merge-tree: 3 `+<<<<<<<` blocks, 24 files changed in both.
- `git show 1eb15da6e`: only the `obs-source.h` callback parameter-name typo.

Slice plan:
- Approach: partial-pr. Cherry-pick the six commits in order and resolve or drop the conflicting hunks; never take the PR's version of surrounding lines that master has since changed. Skip any hunk whose target text no longer exists. Keep authorship. Leave the vendored `deps/libcaption` typo commit out if it conflicts, to keep the vendored copy diff-clean.
- Test plan: build the Windows-relevant targets with MSVC (`libobs`, `obs-outputs`, `win-capture`, `obs-qsv11`, `obs-vst`) to confirm the comment/log edits compile. Linux/macOS-only files (linux-*, mac-*) are UNTESTED at compile level, but those changes touch only comments and strings.

Related: none.

### [#11417](https://github.com/obsproject/obs-studio/issues/11417) — Stutters and screen tearing/worble artifacts with VAAPI on AMD 7000 GPUs

**Verdict: OUT_OF_SCOPE**

Tearing and frame-order artifacts with FFmpeg VAAPI H.264 appear only on RDNA3 (7800XT, 7900XTX), using distro builds (Nobara, NixOS). Upstream labelled it `area/dependency`. A problem limited to one GPU generation points to the Mesa radeonsi VA-API driver, not OBS's encoder glue, which is the same for every VA-API GPU.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-vaapi.c` uses the same code path for every VA-API device; nothing in it is specific to one GPU family.
- Upstream labels `area/dependency`, `platform/linux`.

Related: none.

### [#12057](https://github.com/obsproject/obs-studio/pull/12057) — libobs-opengl: Fix compile error on GCC 14+ and i686

**Verdict: IMPLEMENT (cherry-pick-pr)**

There is a real type mismatch on master. The public `gl_egl_query_dmabuf_modifiers_for_format()` takes `size_t *n_modifiers` and passes it straight to the static `query_dmabuf_modifiers()`, which expects `EGLuint64KHR *`. On 64-bit systems both are 8 bytes, so it compiles with a warning. On i686, GCC 14 makes incompatible-pointer-types an error. Even without the error, writing 64 bits into a 4-byte `size_t` would corrupt memory. The PR makes the internal count an `EGLint` and converts it in the public wrapper. It is one file, +6/-3, and applies with no conflicts.

Evidence:
- `libobs-opengl/gl-egl-common.c:351-352`: `EGLuint64KHR *n_modifiers` parameter.
- `libobs-opengl/gl-egl-common.c:398`: `*n_modifiers = (EGLuint64KHR)max_modifiers;`.
- `libobs-opengl/gl-egl-common.c:403-409`: wrapper with `size_t *n_modifiers` passes it through.

Slice plan:
- Approach: cherry-pick `cac040e6b` (author preserved).
- Test plan: the EGL code is Linux/FreeBSD-only and cannot be compiled here. The commit must say UNTESTED. Review the diff to confirm `max_modifiers` (EGLint >= 0) goes to `size_t` without loss.

Related: 11012 (same file).

### [#12138](https://github.com/obsproject/obs-studio/pull/12138) — CI: obs-crowdin-sync Python Rewrite

**Verdict: DEFER_LARGE**

This draft PR (+515/-18, 7 files) rewrites upstream's Crowdin translation-sync tooling in-tree and changes `.github/workflows/scheduled.yaml`. It is marked untested by the author and conflicts with master in 3 blocks. It is only useful with upstream's Crowdin project secrets, which this private fork does not have and will never use. The two small locale commits (removing an obsolete `Language` string and updating URLs in `en-US.ini`) affect upstream translation workflows and are not worth taking alone.

Evidence:
- `git diff master...refs/upstream-pr/12138 --stat`: 7 files, 515+/18-.
- Legacy merge-tree finds 3 conflict blocks; PR is a draft with "Other tests TBD".

Related: none.
