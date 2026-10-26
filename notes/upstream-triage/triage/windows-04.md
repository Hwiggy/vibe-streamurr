# Upstream triage: batch windows-04

- Batch: windows-04 (area hint: windows)
- Items: 12544, 12557, 12592, 12594, 12733, 12759, 12768, 12771, 12794, 12818, 12827, 13190, 13274, 13302, 13303, 13326, 13401, 13507, 13704, 13715
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: I read the item bodies from `notes/upstream-triage/data/all.json`. I inspected PR heads at `refs/upstream-pr/<N>` with `git diff master...<ref>`. Local git is 2.33, which does not support `merge-tree --write-tree`, so I checked applicability with legacy `git merge-tree $(git merge-base master ref) master ref` and counted `+<<<<<<<` markers. I fetched two comment threads (#13715, #13326) with WebFetch.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 12544 | issue | CANNOT_VERIFY |
| 12557 | issue | CANNOT_VERIFY |
| 12592 | issue | CANNOT_VERIFY |
| 12594 | issue | CANNOT_VERIFY |
| 12733 | PR | DEFER_LARGE |
| 12759 | PR | IMPLEMENT (cherry-pick) |
| 12768 | PR | IMPLEMENT (new-change, rework of the PR onto the rewritten scripts) |
| 12771 | issue | IMPLEMENT (new-change) |
| 12794 | PR | IMPLEMENT (cherry-pick) |
| 12818 | issue | CANNOT_VERIFY |
| 12827 | issue | CANNOT_VERIFY |
| 13190 | PR | IMPLEMENT (partial-pr: do not log from inside the crash handler) |
| 13274 | PR | IMPLEMENT (cherry-pick, after 12794) |
| 13302 | PR | DEFER_LARGE |
| 13303 | PR | IMPLEMENT (cherry-pick) |
| 13326 | issue | IMPLEMENT (new-change) |
| 13401 | issue | IMPLEMENT (new-change) |
| 13507 | issue | CANNOT_VERIFY |
| 13704 | issue | CANNOT_VERIFY |
| 13715 | issue | CANNOT_VERIFY |

---

### [#12544](https://github.com/obsproject/obs-studio/issues/12544) — Unhandled exception: 80000003

**Verdict: CANNOT_VERIFY**

The report is a crash with exception code 0x80000003 (a breakpoint or `__debugbreak`). It happened while OBS sat minimized after the user tried to add a browser source. The issue has no repro steps or stack in the body; there is only a link to an external crash log. A breakpoint exception in an idle process usually comes from a third-party module or CEF (obs-browser) assert. Nothing in the report points at a code path in this tree.

- Evidence: there is no stack in the body. obs-browser is a submodule (`plugins/obs-browser`) whose CEF asserts are outside the core.
- Related: none.

### [#12557](https://github.com/obsproject/obs-studio/issues/12557) — Mouse Cursor Size

**Verdict: CANNOT_VERIFY**

The game capture cursor is large when a dual-mode monitor runs at 1080p instead of 4K. Display capture looks fine there. Game capture draws the cursor itself: it copies the icon bitmap with `GetCursorInfo`/`CopyIcon` and draws it at the bitmap's native pixel size. It never scales the bitmap against the game's resolution. The icon bitmap size depends on the DPI that Windows gives OBS's process, so the symptom is plausibly a DPI mismatch. Display capture uses OS-composited cursors, which explains the difference. Confirming it needs the specific monitor and DPI setup, and any fix (choosing the cursor bitmap per monitor DPI) is a behaviour decision rather than a clear defect.

- `plugins/win-capture/cursor-capture.c:224-245`: `cursor_draw` draws the texture at its native size with no scaling.
- `plugins/win-capture/game-capture.c:1876`: game capture calls `cursor_draw` with the hook's cx/cy.
- Related: none.

### [#12592](https://github.com/obsproject/obs-studio/issues/12592) — [Windows] Multiple Video Capture Devices with Same Name

**Verdict: CANNOT_VERIFY**

The reporter asks OBS to use the FriendlyName or a serial number so that identical capture cards stay attached to the right sources. OBS already stores and matches devices by name plus the DirectShow device path. The device path is the OS's unique instance path, which includes the USB instance or serial. The FriendlyName already comes from the DirectShow moniker in libdshowcapture. Bindings that move between devices with identical names happen when a device has no serial number, so Windows derives its instance path from the port or enumeration order. That is device and OS behaviour, not a defect I can locate in OBS. One cosmetic option is adding a disambiguating suffix to duplicate names in the list, but that would not fix the "bouncing".

- `plugins/win-dshow/win-dshow.cpp:690-701`: `GetDevice` matches on `name` and `path`.
- `plugins/win-dshow/win-dshow.cpp:1555-1572`: `AddDevice` encodes the id as `name:path` and shows only the name.
- Related: none.

### [#12594](https://github.com/obsproject/obs-studio/issues/12594) — PowerPoint VBA 'SendKeys' no longer working

**Verdict: CANNOT_VERIFY**

Hotkeys sent with VBA `SendKeys` stopped working after 30.2.3. libobs polls `GetAsyncKeyState` for background hotkeys. When OBS has focus, Qt key events are injected instead. The only libobs hotkey change in that window is the removal of the deprecated `obs_hotkey_enable_strict_modifiers` (84d462c31), which does not affect key detection. The more likely cause is a Qt or input-handling change in the frontend, or the very short synthetic press that `SendKeys` produces being missed between polls. I could not pin a specific defect without a repro. A better path for the user is obs-websocket, which ships with OBS.

- `libobs/obs-windows.c:974-990`: `vk_down` and `obs_hotkeys_platform_is_pressed` poll `GetAsyncKeyState`.
- `git show 84d462c31`: only removes the deprecated strict-modifiers API.
- Related: none.

### [#12733](https://github.com/obsproject/obs-studio/pull/12733) — win-asio: Add ASIO host for obs-studio

**Verdict: DEFER_LARGE**

The PR adds a native ASIO source and output, a frontend plugin, an SPSC FIFO in libobs/util, and a monitoring mixer in libobs/audio-monitoring. It has 7 commits across 36 files with about 5,200 added lines. The legacy merge-tree check shows no conflicts, but the PR is far beyond a small slice. It touches libobs core audio monitoring and depends on the Steinberg ASIO SDK, which is available under GPLv3 (or a proprietary licence). Pulling in GPLv3 code turns the combined binary into GPLv3. That is allowed because OBS is GPL-2.0-or-later, but it is a licensing decision for this fork, not a drive-by. The PR also carries the "Seeking Testers" label upstream.

- `git diff master...refs/upstream-pr/12733 --stat`: 36 files changed, 5198 insertions.
- Commit `69f641aa1`: modifies libobs/audio-monitoring, which is core.
- Related: none.

### [#12759](https://github.com/obsproject/obs-studio/pull/12759) — libobs-winrt: Prevent hard cap of 60 fps for WGC capture

**Verdict: IMPLEMENT (cherry-pick-pr)**

Windows Graphics Capture paces frame delivery by default (about 60 fps). Windows SDK 26100 added `GraphicsCaptureSession::MinUpdateInterval`, and master never sets it. The PR is one commit and +40 lines in one file, and it applies cleanly. It sets the interval to half the OBS frame interval. The code compiles only when `WDK_NTDDI_VERSION >= 0x0A000010` (`NTDDI_WIN11_GE`). At runtime it checks the property with `ApiInformation::IsPropertyPresent` and catches `hresult_error`, so older Windows versions and older SDKs are unaffected. The locally installed SDKs 10.0.26100 and 10.0.28000 both define `WDK_NTDDI_VERSION` at or above `NTDDI_WIN11_GE`, and their C++/WinRT headers expose `MinUpdateInterval`. `obs_get_video_info` and `util_mul_div64` reach the file through `obs-module.h` (via `media-io/audio-io.h` and `util/util_uint64.h`).

- `libobs-winrt/winrt-capture.cpp`: no `MinUpdateInterval` in master (grep finds none).
- `libobs-winrt/winrt-capture.cpp:19`: the same `IsPropertyPresent` pattern is already used for other optional properties.
- `C:/Program Files (x86)/Windows Kits/10/Include/10.0.26100.0/shared/sdkddkver.h:164-166`: `NTDDI_WIN11_GE 0x0A000010`.
- Related: none.

**Slice**: cherry-pick `18a164d5d`. Files: `libobs-winrt/winrt-capture.cpp`. Test: MSVC build of `libobs-winrt`. A runtime check of frame rates above 60 fps needs a high-refresh display and Windows 11 24H2. If those are not available, mark the runtime behaviour UNTESTED.

### [#12768](https://github.com/obsproject/obs-studio/pull/12768) — win-dshow: Add support for installing virtualcam on WoA

**Verdict: IMPLEMENT (new-change, based on the PR)**

On ARM64, CMake builds `obs-virtualcam-module-arm64.dll` in addition to the x64 and x86 modules. Neither `virtualcam-install.bat.in` nor `virtualcam-uninstall.bat.in` registers or unregisters the ARM64 module. The updater also registers only the 32 and 64 variants. As a result, the native ARM64 DirectShow filter is never registered by these scripts on Windows on ARM.

The PR conflicts with master because commit `b92a28ffd` (Oct 2026) rewrote both scripts: it removed the registry-key pre-checks and changed the paths to `core\win-dshow\data\`. The PR also has a batch-language bug. It reads `%errorLevel%` inside a parenthesized `if (...)` block. Inside such a block the variable is expanded when the block is parsed, so the `reg query` result is never seen. The slice therefore re-applies the idea onto master's current scripts and avoids that pattern.

- `plugins/win-dshow/virtualcam-module/CMakeLists.txt:129-135`: ARM64 output is named `obs-virtualcam-module-arm64`.
- `plugins/win-dshow/virtualcam-module/virtualcam-install.bat.in:14-47`: registers only module32 and module64.
- `plugins/win-dshow/virtualcam-module/virtualcam-uninstall.bat.in:14-24`: same.
- `frontend/updater/updater.cpp:1741-1771`: the updater registers only the 32 and 64 variants. Changing the updater is out of this slice; it is noted for later.
- Legacy merge-tree: 1 conflict against `b92a28ffd`.
- Related: none.

**Slice**: in `virtualcam-install.bat.in`, after the 32-bit step, add `if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" goto installARM64DLL`. Add an `:installARM64DLL` label that mirrors `:install64DLL` using `core\win-dshow\data\obs-virtualcam-module-arm64.dll`, with its errorlevel check at top level, outside any parenthesized block. In `virtualcam-uninstall.bat.in`, add an unregister step for the arm64 DLL. Credit the PR author's idea in the commit message. Files: the two `.bat.in` files. About 25 lines. Test: configure win-dshow on x64 and inspect the generated `.bat`. The x64 path can be smoke-tested by running the script as admin. The ARM64 path is UNTESTED (no ARM64 hardware).

### [#12771](https://github.com/obsproject/obs-studio/issues/12771) — FreeType2 font renderer does not respect user/profile fonts folder in Windows

**Verdict: IMPLEMENT (new-change)**

I confirmed the defect in code. `load_os_font_list()` and `get_font_checksum()` scan only `CSIDL_FONTS` (`C:\Windows\Fonts`). Since Windows 10 1809, fonts installed per user go to `%LOCALAPPDATA%\Microsoft\Windows\Fonts`. Those fonts appear in the font picker (which uses system enumeration) but are missing from the FreeType path cache, so the font lookup falls back to the wrong face. The fix is to scan both directories and include both in the checksum, so the cached font list is rebuilt when user fonts change.

- `plugins/text-freetype2/find-font-windows.c:179`: `get_font_checksum` uses `SHGetFolderPathA(CSIDL_FONTS)` only.
- `plugins/text-freetype2/find-font-windows.c:206-260`: `load_os_font_list` scans the same single folder.
- Related: none.

**Slice**: factor the directory walk into `static void scan_font_dir(const char *dir)` and a matching checksum helper. Call each for `CSIDL_FONTS` and for `SHGetFolderPathA(CSIDL_LOCAL_APPDATA)` + `\Microsoft\Windows\Fonts`, skipping the second when it is absent. Call `save_font_list()` once at the end. File: `plugins/text-freetype2/find-font-windows.c`. About 40 to 60 lines. Caveat: the existing code uses ANSI APIs, so profile paths that are not ASCII remain unsupported, as they are today. Test: MSVC build of `text-freetype2`. Manual test: install a font "for current user only", delete the cached font list, add a FreeType2 text source, and confirm the font renders.

### [#12794](https://github.com/obsproject/obs-studio/pull/12794) — graphics-hook: Fix D3D9 memory capture regression

**Verdict: IMPLEMENT (cherry-pick-pr)**

I confirmed the root cause. Commit `0b87f533b` ("graphics-hook: Fix null pointer dereference") gated each capture with `data.handle != nullptr`. In `d3d9_data`, `handle` and `shmem_info` are separate fields; there is no union. In shared-memory mode `handle` stays null, so D3D9 memory capture never runs. In D3D10 and D3D11 the two fields overlap in a union, so the check happens to work, but reading the inactive member is undefined behaviour in C++. The PR changes the check to `(data.using_shtex ? data.handle : data.shmem_info) != nullptr` in all three files. It is 3 lines and applies cleanly.

- `plugins/win-capture/graphics-hook/d3d9-capture.cpp:41,47,555`: separate fields and the faulty gate.
- `plugins/win-capture/graphics-hook/d3d11-capture.cpp:16-29,309`: union and gate.
- `plugins/win-capture/graphics-hook/d3d10-capture.cpp:351`: same gate.
- Related: #13274 (builds on this).

**Slice**: cherry-pick `1dd293122`. Files: the d3d9, d3d10 and d3d11 `-capture.cpp` files in graphics-hook. Test: MSVC build of `graphics-hook` (x64 and x86 if available). Runtime D3D9 memory capture needs a D3D9 title that forces shared-memory capture, which is UNTESTED unless one is available.

### [#12818](https://github.com/obsproject/obs-studio/issues/12818) — GPU utilisation spike and low fps in certain Windows UI elements, when OBS is running and hidden

**Verdict: CANNOT_VERIFY**

While OBS is hidden, some shell UI elements (the Start button, kebab menus, tray menus) render at about 2 fps, and GPU use rises in a way that is not attributed to any process. The rise is not attributed to OBS, and OBS has no code that interacts with shell composition of other windows. This looks like DWM or driver behaviour (for example MPO or independent-flip interaction) and depends on the hardware and driver. I found no actionable code path.

- Related: none.

### [#12827](https://github.com/obsproject/obs-studio/issues/12827) — Windows 11 safety capture outlines regression

**Verdict: CANNOT_VERIFY**

In Studio Mode, the yellow WGC border stays on after a window source is hidden. Window capture frees its WGC session in the `hide` callback, which runs only when the source is no longer shown anywhere. In Studio Mode, hiding an item in the preview scene does not hide it in the program scene until a transition, and the program display, multiview and projectors also keep the source showing. A border that remains is therefore expected until the program no longer shows the source. The report does not distinguish this case from a real leak, and I found no defect.

- `plugins/win-capture/window-capture.c:569-575`: `wc_hide` frees `capture_winrt`.
- `plugins/win-capture/window-capture.c:597`: the tick returns early when the source is not showing.
- Related: none.

### [#13190](https://github.com/obsproject/obs-studio/pull/13190) — libobs: Add module version number to Windows crash handler

**Verdict: IMPLEMENT (partial-pr)**

The PR adds each module's file version to the module list in Windows crash logs. It is 1 commit, +15/-5 lines in one file, and applies cleanly. This is useful for triage. One problem: it calls `get_dll_ver()` (in `libobs/util/platform-windows.c:920`), which calls `blog(LOG_ERROR, ...)` for every module without a version resource. Today the crash handler never calls `blog`. Logging from inside the unhandled-exception filter risks deadlock (the frontend log handler takes a mutex that the crashing thread may hold) and spams the log. The slice therefore keeps the output format but uses a quiet local helper.

- `libobs/obs-win-crash-handler.c:212-232`: `enum_all_modules` builds the module list.
- `libobs/util/platform-windows.c:936-951`: `get_dll_ver` logs at LOG_ERROR on each failure.
- `libobs/obs-win-crash-handler.c`: no `blog` calls in master (grep).
- Related: #13303 (same file, separate hunks).

**Slice**: cherry-pick `f3152e581`. Then replace the `get_dll_ver` call with a static helper in the crash handler that calls `GetFileVersionInfoSizeW`, `GetFileVersionInfoW` and `VerQueryValueW` directly without logging. Alternatively, check `GetFileVersionInfoSizeW` first and call `get_dll_ver` only when the size is non-zero. Link `version.lib` if it is not already linked, or reuse the dynamically loaded function pointers. File: `libobs/obs-win-crash-handler.c`. About 40 lines. Test: MSVC build of libobs. Trigger a crash (for example with a debug-only crash hotkey or plugin) and check the module list format.

### [#13274](https://github.com/obsproject/obs-studio/pull/13274) — Fix D3D9 capture for D3DFMT_A2R10G10B10 (e.g. GTA: SA) and MSAA D3D9 memory capture

**Verdict: IMPLEMENT (cherry-pick-pr, after #12794)**

I confirmed the root cause. `d3d9_to_dxgi_format` maps `D3DFMT_A2B10G10R10`, but the 10-bit back buffer format D3D9 games actually use is `D3DFMT_A2R10G10B10`. That format falls through as unsupported, so GTA: SA and similar titles are listed in `compatibility.json` as non-capturable. The PR maps it to `DXGI_FORMAT_R10G10B10A2_UNORM`. It creates the shared texture as `A2B10G10R10`, which matches the DXGI layout, and `StretchRect` performs the channel swap. For shared memory, it adds intermediate render targets for both the format conversion and MSAA resolve, because `GetRenderTargetData` fails on multisampled surfaces. It also removes the GTA:SA and SA:MP entries from `compatibility.json`. The PR is 4 commits including #12794's, about +57/-40 lines, and applies cleanly.

- `plugins/win-capture/graphics-hook/d3d9-capture.cpp:96`: maps `A2B10G10R10` (wrong for back buffers).
- `plugins/win-capture/graphics-hook/d3d9-capture.cpp:530-540`: `GetRenderTargetData` straight from the back buffer, which fails with MSAA.
- `git diff refs/upstream-pr/12794..refs/upstream-pr/13274 --stat`: d3d9-capture.cpp and compatibility.json.
- Related: #12794.

**Slice**: cherry-pick `bf127fbdd`, `96c2d1fe6` and `365748ee0` on top of the #12794 pick. Files: `plugins/win-capture/graphics-hook/d3d9-capture.cpp`, `plugins/win-capture/data/compatibility.json`. Test: MSVC build of `graphics-hook`. Runtime capture of a D3D9 10-bit or MSAA title is UNTESTED unless such a game is available.

### [#13302](https://github.com/obsproject/obs-studio/pull/13302) — win-capture: add capturing specific window by PID

**Verdict: DEFER_LARGE**

The PR adds a "Capture by PID" mode with a second window list. It adds public API to `libobs/util/windows/window-helpers` (`ms_find_window_by_pid`, `ms_fill_pid_window_list`) and changes window-capture properties: 167 lines across 5 files. It applies cleanly. The author notes that PIDs are not stable across sessions, so the saved setting stops working after a restart. That is a UX and design question for maintainers: whether to add a new mode, or to disambiguate the existing title/class/exe match with an instance index or a better window-priority setting. It also adds exported libobs API. Size aside, this is a design decision rather than a small slice.

- `git diff master...refs/upstream-pr/13302 --stat`: window-helpers.c (+77), window-helpers.h (+3), window-capture.c (+91/-8), locale files.
- Related: none.

### [#13303](https://github.com/obsproject/obs-studio/pull/13303) — libobs: Add process uptime to Windows crash logs

**Verdict: IMPLEMENT (cherry-pick-pr)**

The PR adds a "Process Uptime" line to the crash-log header, computed with `GetProcessTimes` and `GetSystemTimeAsFileTime`. It is 1 commit, +33/-2 lines in one file, and applies cleanly. It makes no logging or allocation calls, so it is safe inside the exception filter, and it helps triage.

- `libobs/obs-win-crash-handler.c:242-270`: `write_header` builds the header block.
- Related: #13190 (same file, does not conflict).

**Slice**: cherry-pick `a24064138`. File: `libobs/obs-win-crash-handler.c`. Test: MSVC build of libobs. Force a crash and check the header line.

### [#13326](https://github.com/obsproject/obs-studio/issues/13326) — Audio does not fade in correctly on scene transition when using Game Capture with Capture Audio (BETA)

**Verdict: IMPLEMENT (new-change)**

I traced the root cause in code. When game capture stops being shown, `game_capture_tick` calls `stop_capture()`. When the source was capturing, `stop_capture()` calls `reconfigure_audio_source(gc->audio_source, NULL)`, which clears the linked WASAPI process-capture target. When the scene is shown again at the start of a transition, the WASAPI child activates with no window. Its init fails and its reconnect thread waits `RECONNECT_INTERVAL` (3000 ms). The target is only restored after game capture re-hooks (`reconfigure_audio_source(..., gc->window)`). Audio therefore stays silent for about the transition length; the reporter used a 3000 ms fade.

A standalone Application Audio Capture source keeps its target, which explains why the reporter's workaround works. The maintainer's comment on the issue (fetched) suspects active-state handling. A third-party fork commit titled "win-capture: Keep linked audio across hide" references the issue, which matches this diagnosis.

- `plugins/win-capture/game-capture.c:1727-1733`: the not-showing branch calls `stop_capture`.
- `plugins/win-capture/game-capture.c:355-369`: `stop_capture` clears the audio target when `gc->capturing`.
- `plugins/win-capture/game-capture.c:1794-1795`: the target is restored only after a re-hook.
- `plugins/win-wasapi/win-wasapi.cpp:1089,1166,1184`: 3000 ms reconnect interval.
- `plugins/win-capture/audio-helpers.c:42-46`: the child is an active child, so it is deactivated anyway while the parent is inactive, and keeping its target costs nothing.
- Related: none.

**Slice**: add a `bool keep_audio` parameter to `stop_capture` (or split out a helper). In the not-showing branch of `game_capture_tick`, stop the capture without calling `reconfigure_audio_source(..., NULL)`. All other callers (hook stop, deactivate hotkey, destroy, and errors) keep the current behaviour. File: `plugins/win-capture/game-capture.c`. About 15 lines. Test: MSVC build of `win-capture`. Manual test: two scenes, game capture with Capture Audio, a 3000 ms Fade, and watch the mixer meters during the fade-in. Mark UNTESTED if no game is available.

### [#13401](https://github.com/obsproject/obs-studio/issues/13401) — Upload crash report dialog gets stuck if trying to upload when there are no crash reports

**Verdict: IMPLEMENT (new-change)**

I confirmed the defect in code. When there is no new crash log and no previously uploaded URL, `uploadLastCrashLog` reaches `uploadCrashLogToServer()`. If the crash-log content is empty, that function logs a warning and returns without emitting any signal. `LogUploadDialog` waits for `logUploadFinished` or `logUploadFailed`, so the progress label and wait cursor stay forever. The same path runs on the unclean-shutdown dialog.

- `frontend/utility/CrashHandler.cpp:175-184`: `uploadLastCrashLog`.
- `frontend/utility/CrashHandler.cpp:283-290`: the empty-content early return emits nothing.
- `frontend/utility/CrashHandler.cpp:320-325`, `frontend/OBSApp.cpp:1360-1366`: failures are forwarded as `logUploadFailed`.
- `frontend/dialogs/LogUploadDialog.cpp:77-125`: the dialog leaves the progress state only through those signals.
- Related: none.

**Slice**: in the empty-content branch, `emit crashLogUploadFailed(QTStr("LogUploadDialog.Errors.NoLogFile"))`. Add that string to `frontend/data/locale/en-US.ini`, or reuse an existing one if present. Files: `frontend/utility/CrashHandler.cpp`, `frontend/data/locale/en-US.ini`. About 5 lines. Platform: cross-platform frontend. Test: build obs-studio (frontend) with MSVC, empty the crashes directory, use Help > Crash Reports > Upload, and confirm the error page appears.

### [#13507](https://github.com/obsproject/obs-studio/issues/13507) — 疑似视频源导致的卡死崩溃 (suspected freeze or crash caused by a video source)

**Verdict: CANNOT_VERIFY**

Paraphrased from Chinese: the user double-clicks a hidden Media Source whose file has been deleted. The properties dialog lays out wrongly, freezes, and then OBS crashes. Upstream labels it `needs/repro`, and the crash log is only an external link. A missing file in ffmpeg_source normally produces only a warning, and I found no clear hang path from code reading alone.

- Related: none.

### [#13704](https://github.com/obsproject/obs-studio/issues/13704) — Crash when adding Display Capture on Snapdragon X (ARM64) - dxgi.dll exception c000001d

**Verdict: CANNOT_VERIFY**

The crash is `STATUS_ILLEGAL_INSTRUCTION` inside `dxgi.dll` on the graphics thread, on Snapdragon X. The fault is inside an OS or driver DLL, specific to ARM64 hardware, and has no OBS frames on the stack. This box has no ARM64 hardware to test with. The fix most likely belongs in the Qualcomm driver or in Windows.

- Related: #12768 (another WoA item, unrelated code).

### [#13715](https://github.com/obsproject/obs-studio/issues/13715) — "Save projectors on exit" no longer displays projector properly on application launch

**Verdict: CANNOT_VERIFY**

Projectors restored at startup show grey. From the fetched comment thread: the reporter saw it fixed on 32.2.1 but it came back after an Nvidia driver update (610.74 to 617.14), and it never went away on their AMD machine. Launching through the post-crash "Run in Normal Mode" prompt makes it work, which points to a startup-ordering difference. No maintainer has diagnosed it. The only recent projector change, `c8e74c9de`, rounds the sizes shown in the monitor menu and is unrelated. Without a repro, I cannot identify a defect.

- `git log -- frontend/widgets/OBSProjector.cpp frontend/widgets/OBSQTDisplay.cpp frontend/widgets/OBSBasic_Projectors.cpp`: only cosmetic and refactor changes since 2025-12.
- Related: none.
