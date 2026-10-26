# Triage batch build-ci-docs-01

- Batch: build-ci-docs-01 (area hint: build-ci-docs; the hint was mostly wrong, since most items are runtime and platform bugs)
- Items: 4531, 5043, 5191, 5248, 5476, 5590, 5595, 5626, 5899, 6004, 6010, 6075, 6200, 6917, 7356, 7424, 7481, 7608, 7640, 7927, 7990, 8166
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: I read each item's body from `notes/upstream-triage/data/all.json` and checked it against the code in master. I fetched one comment thread with WebFetch (#5191). Old git 2.33 has no `merge-tree --write-tree`, so I checked whether each PR applies with the 3-arg form `git merge-tree $(git merge-base master PR) master PR` and looked for conflict markers.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 4531 | issue | IMPLEMENT (Windows monitoring latency cap) |
| 5043 | issue | ALREADY_ADDRESSED (Add Source popup menu replaced by a dialog) |
| 5191 | issue | DEFER_LARGE (CEA-608 pacing) |
| 5248 | PR | OUT_OF_SCOPE (upstream PR-process tooling, unused in this fork) |
| 5476 | issue | ALREADY_ADDRESSED (same as 5043) |
| 5590 | issue | DEFER_LARGE (hw encoders in custom FFmpeg output) |
| 5595 | issue | OUT_OF_SCOPE (Flatpak/KDE portal) |
| 5626 | issue | IMPLEMENT (D3D11 texture register binding) |
| 5899 | issue | OUT_OF_SCOPE (CEF / obs-browser under Flatpak X11) |
| 6004 | issue | ALREADY_ADDRESSED (Flatpak plugin extension point adds lib to ld path) |
| 6010 | issue | OUT_OF_SCOPE (obs-browser / CEF) |
| 6075 | issue | CANNOT_VERIFY (AJA Corvid44 hardware) |
| 6200 | issue | ALREADY_ADDRESSED (mute is now a checkable QPushButton) |
| 6917 | issue | OUT_OF_SCOPE (libjack inside the Flatpak sandbox) |
| 7356 | issue | CANNOT_VERIFY (HQX decode performance on M1) |
| 7424 | issue | OUT_OF_SCOPE (IME in CEF dock under Flatpak) |
| 7481 | issue | IMPLEMENT (glad NULL GL_VERSION guard) |
| 7608 | issue | ALREADY_ADDRESSED (same as 5043) |
| 7640 | PR | IMPLEMENT (cherry-pick, integer premultiply) |
| 7927 | issue | CANNOT_VERIFY (Flatpak crash, no stack) |
| 7990 | issue | ALREADY_ADDRESSED (pkg-config is now a static template) |
| 8166 | issue | CANNOT_VERIFY (crash in libVLC subtitle path, no stack) |

---

### [#4531](https://github.com/obsproject/obs-studio/issues/4531) — Audio Monitoring Buffer Buildup / Offsync

**Verdict: IMPLEMENT**

Reasoning: On Windows, monitoring audio drifts further and further behind for audio-only sources such as a microphone. The report says toggling the source visibility resets the drift. The WASAPI monitor opens a shared-mode client with a 1 s buffer. For sources with video it runs latency correction (`process_audio_delay`), but audio-only sources never take that path. Nothing caps the device padding (`pad`). When the OBS audio clock runs slightly faster than the render device's clock, queued audio grows until the 1 s buffer overflows. `GetBuffer` then fails and the monitor reconnects, which resets the drift. That matches the reported symptom and the visibility-toggle workaround.

Evidence:
- `libobs/audio-monitoring/win32/wasapi-output.c:197` sets the buffer duration to 10,000,000 hns (1 s).
- `libobs/audio-monitoring/win32/wasapi-output.c:308-322` reads `pad`, but only calls `process_audio_delay` when `monitor->source_has_video && !decouple_audio`. Audio-only sources get no latency control.
- `libobs/audio-monitoring/win32/wasapi-output.c:325-327` reconnects when `GetBuffer` fails, which is the only way the queued audio gets drained.

Related: none in batch.

Slice plan:
- In `on_audio_playback` after `GetCurrentPadding`, add a cap for audio that is not delayed against video. If `pad` already exceeds a threshold (for example `monitor->sample_rate / 5`, about 200 ms, defined as a `#define`), skip writing this chunk (`goto unlock`) so the device queue drains back below the cap. Optionally emit a debug log under `DEBUG_AUDIO`.
- About 10 lines in a single file. Windows only. The Pulse and CoreAudio backends are separate and not touched.
- Test: MSVC build of `libobs`. Manual run with a mic set to Monitor and Output, watching that monitoring latency stays bounded over a long session. Reproducing the clock drift needs real hardware over a long run, so the drift fix itself is likely UNTESTED and only build-verified.

### [#5043](https://github.com/obsproject/obs-studio/issues/5043) — Incorrect popup positions under swaywm (Wayland)

**Verdict: ALREADY_ADDRESSED**

Reasoning: The report is about the QMenu popup that the "+" Add Source button opened, which landed in the wrong place under sway. In current master that button no longer opens a popup menu. `on_actionAddSource_triggered` opens a top-level dialog (`OBSBasicSourceSelect`). The menu that was mispositioned no longer exists. Placement of a top-level dialog is left to the compositor.

Evidence:
- `frontend/widgets/OBSBasic_SceneItems.cpp:818-840` shows `AddSourceDialog()` creating `new OBSBasicSourceSelect(this, undo_s)` and `on_actionAddSource_triggered()` calling it.
- `git grep AddSourcePopup` / `CreateAddSourcePopupMenu` in `frontend/` returns no hits.

Related: 5476, 7608.

### [#5191](https://github.com/obsproject/obs-studio/issues/5191) — SendCaptions not working

**Verdict: DEFER_LARGE**

Reasoning: The root cause is in code. `add_caption` turns a whole caption into CEA-608 byte pairs and puts all of them into the next video frame. libcaption's `sei_encode_eia608` splits them into extra `cea708` user-data blocks once the 31 `cc_count` limit is reached.

I counted the reporter's two strings:
- With "...captione" there are 30 data pairs before end-of-caption, so the first EOC still fits in the first block.
- With "...captioner" the count reaches exactly 31, so both EOC commands move into a second block, which players ignore. That is exactly the one-character boundary in the report.

The thread (one WebFetch) has a libklvanc engineer's analysis that confirms this. OBS should pace one or two 608 tuples per frame with padding (cc_count 10 at 59.94 fps, 20 at 29.97 fps) and alternate fields, instead of bursting a whole sentence into one frame. That needs a per-track pacing queue tied to the output frame rate. The raw `caption_data` path has the same burst problem.

This is a redesign of caption muxing. It is not a one-line fix, and it cannot be checked without a real ingest (YouTube or Facebook) or a caption analyzer.

Evidence:
- `libobs/obs-output.c:1604-1613` calls `caption_frame_from_text` then `sei_from_caption_frame`, putting the whole caption into one packet.
- `libobs/obs-output.c:1565-1599` drains the raw `caption_data` deque fully into one `cea708` per frame.
- `deps/libcaption/src/mpeg.c:414-435`: `sei_encode_eia608` flushes when `cc_count == 31` and starts a continuation block. EOC is written at flush time.
- `deps/libcaption/src/cea708.c:156-160` limits `cc_count` to 31.
- `deps/libcaption/caption/caption.h:54-55` sets 32 columns, which is where the text wraps (25 + 26/27 characters).

Related: upstream #4006, referenced in the thread.

### [#5248](https://github.com/obsproject/obs-studio/pull/5248) — CI: Check commit message compliance

**Verdict: OUT_OF_SCOPE**

Reasoning: The PR adds a composite action and a `check-format.yaml` job that check PR commit subjects and body line length over `HEAD^1..HEAD^2`, which is GitHub's PR merge commit. It applies cleanly (no conflict markers) and is small (77 lines). It is still out of scope for this fork, for these reasons:
1. It is a contributor-policy gate that upstream maintainers have not adopted in about five years.
2. It only does anything on GitHub `pull_request` merge commits, and this fork never opens upstream PRs.
3. It declares `failCondition` and `unknownModuleLevel` inputs that the script never reads. Its Windows guard prints a "services-validation" notice, copied from another action.

If this fork wants commit-message linting, a local hook or script is a better fit than this PR.

Evidence:
- `git diff master...refs/upstream-pr/5248 --stat` shows `.github/actions/commit-message-validator/action.yaml` (+65) and `.github/workflows/check-format.yaml` (+12).
- In the PR's action.yaml, `COMMIT_RANGE='HEAD^1..HEAD^2'` is hard-coded and the `inputs.failCondition` input is never used.
- `.github/actions/` in master has no commit-message validator.

Related: none.

### [#5476](https://github.com/obsproject/obs-studio/issues/5476) — "Add Source" context menu not visible on Linux Wayland tiling WM in portrait mode

**Verdict: ALREADY_ADDRESSED**

Reasoning: This is the same component as #5043. The off-screen QMenu has been replaced by the `OBSBasicSourceSelect` dialog, so there is no popup menu left to position.

Evidence:
- `frontend/widgets/OBSBasic_SceneItems.cpp:818-840`

Related: 5043, 7608.

### [#5590](https://github.com/obsproject/obs-studio/issues/5590) — Custom Output (FFmpeg) vaapi encoder crashes on init

**Verdict: DEFER_LARGE**

Reasoning: The Custom Output (FFmpeg) path finds the encoder by name and applies user options with `av_opt_set` on the codec context. `vaapi_device` is not an AVCodecContext option, so you get "Failed to set". More importantly, `h264_vaapi` needs an `AVHWDeviceContext` and `hw_frames_ctx`, and the output must upload software frames to them. `obs-ffmpeg-output.c` has none of that hardware plumbing.

Supporting hardware encoders in the custom output means creating a device and frames context and uploading frames. That is a sizeable feature. Native VAAPI recording is already available through the separate FFmpeg VAAPI encoder (`obs-ffmpeg-vaapi.c`) in standard or advanced output mode.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-output.c:58` calls `avcodec_find_encoder_by_name`.
- `plugins/obs-ffmpeg/obs-ffmpeg-output.c:75-94`: `parse_params` sets options with `av_opt_set` and logs "Failed to set %s=%s".
- A grep for `hw_device`, `av_hwdevice`, and `vaapi` in `obs-ffmpeg-output.c` finds nothing.
- `plugins/obs-ffmpeg/obs-ffmpeg-vaapi.c` is the existing native VAAPI encoder.

Related: none in batch.

### [#5595](https://github.com/obsproject/obs-studio/issues/5595) — Folder selection hangs on flatpak in KDE

**Verdict: OUT_OF_SCOPE**

Reasoning: The hang happens only in the Flatpak build on KDE, and the report says GNOME works. Inside Flatpak, Qt routes the file dialog through xdg-desktop-portal, so the dialog comes from xdg-desktop-portal-kde, not OBS. OBS just calls the standard Qt dialog API, and nothing in the OBS code path is specific to KDE.

Evidence:
- `build-aux/com.obsproject.Studio.json:7-20` uses finish-args with `--filesystem=host`. The portal file chooser is provided by the host, not by OBS.

Related: 6917, 7424, 7927, all Flatpak sandbox interactions.

### [#5626](https://github.com/obsproject/obs-studio/issues/5626) — (apparent) Shader pixelshader parser/compiler bug

**Verdict: IMPLEMENT**

Reasoning: The root cause is in the D3D11 backend. Texture uniforms go into HLSL as `uniform Texture2D name;` with no explicit `register(tN)`. OBS binds each texture to slot `param.textureID`, a counter in declaration order (src0 gets slot 0, src1 gets slot 1). `D3DCompile` at OPTIMIZATION_LEVEL3 removes resources the shader never reads and gives the rest compacted registers.

When `rgba0` is sampled but never used, src0 is optimized out and src1 is compiled to `t0`. OBS still binds src0's texture to slot 0, so "return rgba1" shows src0. That is exactly the report. OpenGL looks up uniforms by name and is not affected.

Evidence:
- `libobs-d3d11/d3d11-shaderprocessor.cpp:152-166`: `textureID(texCounter)`, incremented for every texture param in declaration order.
- `libobs-d3d11/d3d11-shaderprocessor.cpp:201-231`: `BuildString` rewrites `texture2d` as `Texture2D` and emits no register.
- `libobs-d3d11/d3d11-shader.cpp:302-303` compiles with `D3D10_SHADER_OPTIMIZATION_LEVEL3`.
- `libobs-d3d11/d3d11-shader.cpp:365-372` binds textures and samplers at `param.textureID`.
- `libobs/graphics/effect-parser.c:1434-1458`: `ep_write_param` emits `uniform <type> <name>;`, so the pattern `uniform` + texture type + name + `;` is reliable.

Related: none.

Slice plan:
- In `ShaderProcessor::BuildString`, keep a texture counter. When a `uniform` token is followed (after whitespace) by `texture2d`, `texture3d`, or `texture_cube`, emit the type and the name as before. At the terminating `;`, insert ` : register(t<N>)` and increment N. N must count in the same order and over the same set as `AddParam` / `texCounter`, which covers texture uniforms in `parser.params`. Leave non-uniform texture function parameters untouched.
- About 25 to 40 lines in `libobs-d3d11/d3d11-shaderprocessor.cpp`. The shader cache is keyed on the source text, so cached blobs are rebuilt automatically.
- Test on this Windows box:
  - MSVC build of `libobs-d3d11`.
  - Run OBS and check that the built-in effects still render correctly.
  - Optionally dump the generated HLSL for an effect with two textures and the reporter's "sample both, return the second" pixel shader, and confirm `register(t1)` is emitted and the right texture shows.

### [#5899](https://github.com/obsproject/obs-studio/issues/5899) — Using pinned Browser Dock freezes all open applications

**Verdict: OUT_OF_SCOPE**

Reasoning: Clicking a docked CEF view freezes the whole X session until OBS is killed. That points to a pointer or keyboard grab held by CEF's embedded X11 window inside the Flatpak build. Browser docks are implemented in the `plugins/obs-browser` submodule (a separate repo) on top of CEF. The core OBS frontend has no code that would hold an X grab. The report is also against 27.2.0-rc1 Flatpak.

Evidence:
- Browser dock widgets come from the obs-browser submodule (`plugins/obs-browser`, a separate upstream repo), not `frontend/`.
- Labels on the item: platform/linux, area/dependency.

Related: 6010, 7424, 7927 (CEF / obs-browser).

### [#6004](https://github.com/obsproject/obs-studio/issues/6004) — Flatpak: Blackmagic Libs no longer supported

**Verdict: ALREADY_ADDRESSED** (packaging mechanism exists; shipping the proprietary library itself is out of scope)

Reasoning: The request is a way to make the proprietary `libDeckLinkAPI.so` visible to the Flatpak build. The in-tree manifest declares a `com.obsproject.Studio.Plugin` extension point with `subdirectories: true` and `add-ld-path: "lib"`. A locally built extension that ships the library under `lib/` therefore ends up on the loader path. The DeckLink dispatcher `dlopen`s the library by soname. OBS cannot redistribute the Blackmagic library itself.

Evidence:
- `build-aux/com.obsproject.Studio.json:22-31` defines the Plugin extension with `"add-ld-path": "lib"`.
- `plugins/decklink/linux/decklink-sdk/DeckLinkAPIDispatch.cpp:34,60` calls `dlopen("libDeckLinkAPI.so", ...)`.

Related: none.

### [#6010](https://github.com/obsproject/obs-studio/issues/6010) — Browser's last frame shows black background for `<canvas>`

**Verdict: OUT_OF_SCOPE**

Reasoning: Refreshing a browser source briefly shows black instead of transparent, on Windows only, starting with the 27.2 CEF update. That is CEF compositing and shared-texture behavior inside the `obs-browser` submodule (separate repo) and CEF. It is not core OBS code. It is labeled area/dependency.

Evidence:
- Rendering for browser sources lives in `plugins/obs-browser` (submodule). Neither libobs nor the frontend is involved in how browser frames are composited.

Related: 5899, 7424.

### [#6075](https://github.com/obsproject/obs-studio/issues/6075) — aja: Not detecting input from all ports with Corvid44

**Verdict: CANNOT_VERIFY**

Reasoning: SDI 3 on an AJA Corvid44 shows no signal or a stale signal on one specific setup (two cards, Windows LTSC). That depends on the hardware's routing and channel configuration through the NTV2 SDK. Without the device or a debug log I cannot tie it to a defect in `plugins/aja`.

Evidence:
- `plugins/aja/` does the signal routing through `libajantv2` (`cmake/finders/FindLibAJANTV2.cmake`). The behavior depends on the device.

Related: none.

### [#6200](https://github.com/obsproject/obs-studio/issues/6200) — Source audio mute doesn't work with VoiceOver on macOS

**Verdict: ALREADY_ADDRESSED**

Reasoning: The bug was that muting was wired to `mousePressEvent` on a QCheckBox, so the accessibility "press" action changed the visual state without muting. The redesigned mixer uses a checkable `QPushButton` with an accessible name, connected to `QPushButton::clicked`. Accessibility press actions emit `clicked`, so `obs_source_set_muted` is reached. `MuteCheckBox` is still in the tree but only as an include, with no mouse override.

Evidence:
- `frontend/components/VolumeControl.cpp:71-72` creates `muteButton = new QPushButton(this); setCheckable(true)`.
- `frontend/components/VolumeControl.cpp:130` connects `QPushButton::clicked` to `handleMuteButton`.
- `frontend/components/VolumeControl.cpp:815-817` and `:687-697`: `handleMuteButton` calls `setMuted`, which calls `obs_source_set_muted`.
- `frontend/components/VolumeControl.cpp:916` sets `setAccessibleName(VolControl.Mute)`.
- `frontend/components/MuteCheckBox.hpp` has no `mousePressEvent` override.

Related: none.

### [#6917](https://github.com/obsproject/obs-studio/issues/6917) — OBS hang on adding JACK input source [flatpak]

**Verdict: OUT_OF_SCOPE**

Reasoning: The hang is inside `jack_client_open`, and only in the Flatpak build; the Debian package works. OBS passes `JackNoStartServer` by default. A hang there comes from the libjack in the Flatpak runtime failing to talk to the host's jackd: a protocol or version mismatch, or a sandboxed /dev/shm. That is a sandbox and runtime issue. A workaround is PipeWire's JACK through the host.

Evidence:
- `plugins/linux-jack/jack-wrapper.c:106-114` passes `JackNoStartServer` unless the user opts in, and handles a NULL return.

Related: 5595.

### [#7356](https://github.com/obsproject/obs-studio/issues/7356) — Stinger track matte transition lags (macOS M1)

**Verdict: CANNOT_VERIFY**

Reasoning: A 3840x1080 QuickTime HQX file with alpha used as a side-by-side track-matte stinger decodes too slowly (over 110% CPU), and the transition is cut off when its time runs out. The reporter says it works after converting to WebM. That points to FFmpeg's software HQX decoder being too slow on this machine, not to a defect in the stinger logic. Proving a regression needs the asset and an M1 profile.

Evidence:
- The stinger runs through the media source and FFmpeg (`plugins/obs-transitions/transition-stinger.c` → ffmpeg_source). HQX has no hardware decode path.

Related: none.

### [#7424](https://github.com/obsproject/obs-studio/issues/7424) — Japanese (Anthy/IBus) input not working in Twitch chat dock

**Verdict: OUT_OF_SCOPE**

Reasoning: IME composition works in OBS's Qt widgets and fails only inside the CEF-based Twitch chat dock in the Flatpak build. CEF's off-screen or embedded IME integration lives in obs-browser and CEF, not in core OBS.

Evidence:
- The reporter says Qt text fields (scene and source names) accept Hiragana, so the Qt IME path in the frontend works. The failing widget is a CEF browser dock (obs-browser submodule).

Related: 5899, 6010.

### [#7481](https://github.com/obsproject/obs-studio/issues/7481) — Crashes when glGetString returns nullptr

**Verdict: IMPLEMENT**

Reasoning: The defect is confirmed in the vendored glad loader (MIT-licensed, under `deps/glad`). `find_coreGL` dereferences `glGetString(GL_VERSION)` without a NULL check, which happens with a broken or missing GL context. `gladLoadGL` also returns 1 whatever happened.

With a guard, the GLAD_GL_VERSION_* flags stay 0, and the existing check in `gl_init_extensions` fails cleanly with an error log instead of a segfault. `has_ext` already tolerates a NULL `GL_EXTENSIONS`, so only the version path needs fixing.

Evidence:
- `deps/glad/src/glad.c:7053-7056`: `const char *v = glGetString(GL_VERSION); int major = v[0] - '0';` has no NULL check.
- `deps/glad/src/glad.c:7077-7081`: `gladLoadGLLoader` checks only the function pointer, not the returned string.
- `deps/glad/src/glad.c:102-108`: `gladLoadGL` always returns 1 once the library has opened.
- `deps/glad/src/glad.c:124-127`: `has_ext` already NULL-checks `GL_EXTENSIONS`.
- `libobs-opengl/gl-subsystem.c:132-134`: `gl_init_extensions` rejects GL older than 3.3, which handles failure gracefully once the version stays 0.
- The `gladLoadGL()` callers already handle a 0 return: `libobs-opengl/gl-x11-egl.c:341`, `gl-wayland-egl.c:222`, `gl-windows.c:450`.

Related: none.

Slice plan:
- In `find_coreGL`, if `v == NULL`, set `GLVersion.major = GLVersion.minor = 0` and return, leaving all GLAD_GL_VERSION flags 0.
- In `gladLoadGLLoader`, return early after `find_coreGL()` if `GLVersion.major == 0`.
- Make `gladLoadGL` return `GLVersion.major != 0`, matching newer glad 0.1.x behavior, so callers log "Failed to load OpenGL entry functions" and fail cleanly.
- About 10 lines in `deps/glad/src/glad.c`. MIT licence, compatible with GPL-2.0-or-later.
- Test: MSVC build of `glad` and `libobs-opengl`. The NULL path cannot be triggered on this box, so that path is UNTESTED and only build-verified.

### [#7608](https://github.com/obsproject/obs-studio/issues/7608) — Missing sources in "Add source" menu when list is long (multi-monitor)

**Verdict: ALREADY_ADDRESSED**

Reasoning: The truncated multi-column QMenu came from the old "+" popup. That popup has been replaced by the scrollable `OBSBasicSourceSelect` dialog, so Qt's menu wrapping (which depends on screen geometry) no longer applies.

Evidence:
- `frontend/widgets/OBSBasic_SceneItems.cpp:818-840`

Related: 5043, 5476.

### [#7640](https://github.com/obsproject/obs-studio/pull/7640) — Improve Premultiplication Performance

**Verdict: IMPLEMENT** (cherry-pick-pr)

Reasoning: The PR is one commit to `libobs/graphics/srgb.h`. It replaces the float round trip used for non-sRGB premultiplication with the integer formula `(c*a + 127) / 255`, and adds an early return when alpha is 255. On ARM NEON and AVX2 builds the early return is left out so the loop can still be vectorized. The sRGB variants only get the alpha==255 shortcut.

I exhaustively compared the integer formula with the existing float path (`(u/255)*(a/255)*255 + 0.5`, truncated, in float32) over all 256x256 input pairs: 0 mismatches. The output is identical, and the PR claims about 2x throughput.

The PR applies with no conflict markers against master. It was formatted at the old 80-column clang-format width, so re-run clang-format (the repo now uses 120 columns) after cherry-picking. Callers are the image decode and ffmpeg image paths.

Evidence:
- `libobs/graphics/srgb.h:93-148` shows the current float-based `gs_premultiply_xyza*` functions.
- `libobs/graphics/srgb.h:51-53`: `gs_float_to_u8` is `(uint8_t)(f*255 + 0.5f)`, which is the rounding the integer formula reproduces.
- Callers: `libobs/graphics/image-file.c:180-182,349-351`, `libobs/graphics/graphics-ffmpeg.c:371-377,490-492`.
- `git diff master...refs/upstream-pr/7640 --stat` shows 1 file, +40/-23.

Related: none.

Slice plan:
- `git cherry-pick refs/upstream-pr/7640` (43ac30654, authorship preserved, GPL-2.0-or-later), then run clang-format on `libobs/graphics/srgb.h`.
- Test: MSVC build of `libobs`. Also a small standalone C check that includes `srgb.h` and compares the old and new `gs_premultiply_xyza` over all 65,536 (color, alpha) pairs. My numpy float32 equivalence check already gave 0 mismatches.

### [#7927](https://github.com/obsproject/obs-studio/issues/7927) — (Flatpak) OBS crashes when adding a Browser source

**Verdict: CANNOT_VERIFY**

Reasoning: Adding a browser source crashes the Flatpak build on Fedora 37. There is no stack trace (the "crash log" link is the same normal log) and no steps beyond adding the source. It most likely involves CEF and the Flatpak runtime or the GPU. There is nothing to act on in the code.

Evidence:
- No stack is provided. Browser sources live in the `plugins/obs-browser` submodule.

Related: 5899.

### [#7990](https://github.com/obsproject/obs-studio/issues/7990) — Garbage in pkg-config on FreeBSD

**Verdict: ALREADY_ADDRESSED**

Reasoning: The regression came from expanding `INTERFACE_COMPILE_OPTIONS` (including `Threads::Threads` generator expressions) into `libobs.pc`. CMake build framework 3.0 now generates `libobs.pc` with `configure_file(... @ONLY)` from a static template. The only substitutions are `CMAKE_INSTALL_PREFIX`, `OBS_VERSION_CANONICAL`, and `CMAKE_C_STANDARD`, so no target properties or generator expressions get into the file.

The old template with `@_TARGET_OPTIONS@` / `@_LINKED_OPTIONS@` (`libobs/pkgconfig/libobs.pc.in`) is still in the tree, but nothing references it.

Side observations, not part of this item: the new template hard-codes `libdir=${prefix}/lib` and `includedir=${prefix}/include`, while headers install to `include/obs`. Its Cflags also include `-Werror`, which is unusual to push onto consumers. These would be separate issues.

Evidence:
- `cmake/linux/helpers.cmake:303-317`: `target_export` runs `configure_file` on `cmake/linux/${target}.pc.in` with `@ONLY` at install time.
- `libobs/cmake/linux/libobs.pc.in:1-13` is a static template with no option or linked-library substitutions.
- `git grep pkgconfig/libobs` finds no references to the old `libobs/pkgconfig/libobs.pc.in`.

Related: none.

### [#8166](https://github.com/obsproject/obs-studio/issues/8166) — Segfault when switching off a scene with a VLC source playing subtitles

**Verdict: CANNOT_VERIFY**

Reasoning: The freeze or segfault happens when deactivating a VLC source after embedded text subtitles (with embedded fonts) have rendered. The crash link is just the normal log, and there is no symbolized stack. The reporter changed both the OBS version and the packaging at once (Snap to Apt), so the libVLC and libass versions changed too. The subtitle rendering runs inside libVLC. The vlc-video plugin only stops the media player when the source is deactivated, so I cannot identify a defect in OBS code without a backtrace from the core dump.

Evidence:
- `plugins/vlc-video/vlc-video-source.c` controls playback through the libVLC media player API. Subtitle rendering happens inside libVLC and libass.

Related: none.
