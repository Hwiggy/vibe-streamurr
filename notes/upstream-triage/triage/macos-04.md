# Upstream triage — batch macos-04

- Batch id: macos-04 (area hint: macos)
- Items: 11923, 11933, 12014, 12015, 12023, 12044, 12062, 12104, 12126, 12141, 12147, 12193, 12245, 12300, 12358, 12450, 12495, 12519, 12602, 12610
- Date: 2026-10-26
- Base commit: 72e866557 (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; PR heads from `refs/upstream-pr/<N>`; code read on master. No GitHub API / WebFetch used.

Summary:

| # | Kind | Verdict |
|---|------|---------|
| 11923 | issue | CANNOT_VERIFY |
| 11933 | PR | IMPLEMENT (partial-pr) |
| 12014 | issue | CANNOT_VERIFY |
| 12015 | issue | OUT_OF_SCOPE |
| 12023 | issue | CANNOT_VERIFY |
| 12044 | issue | CANNOT_VERIFY |
| 12062 | issue | IMPLEMENT (new-change) |
| 12104 | issue | CANNOT_VERIFY |
| 12126 | issue | CANNOT_VERIFY |
| 12141 | issue | ALREADY_ADDRESSED |
| 12147 | PR | ALREADY_ADDRESSED |
| 12193 | issue | DEFER_LARGE |
| 12245 | issue | CANNOT_VERIFY |
| 12300 | PR | DEFER_LARGE |
| 12358 | issue | OUT_OF_SCOPE |
| 12450 | issue | IMPLEMENT (new-change) |
| 12495 | issue | CANNOT_VERIFY |
| 12519 | issue | OUT_OF_SCOPE |
| 12602 | issue | CANNOT_VERIFY |
| 12610 | issue | CANNOT_VERIFY |

---

### [#11923](https://github.com/obsproject/obs-studio/issues/11923) — After a force quit, Tools windows (Scripts, WebSocket settings) do not open

**Verdict: CANNOT_VERIFY**

After a force-quit and restart, Tools menu entries (Script Manager, WebSocket settings) do nothing until the Automatic Scene Switcher is opened, and then all the queued windows appear together. Upstream labels it confirmed, but the body gives no stack and no code-level cause. The symptom points to a Qt/Cocoa event-loop or modality problem that follows the unclean-shutdown (safe mode) prompt. I could not find the defect in the frontend code. The plugin tool actions are plain `menuTools->addAction` entries, so there is nothing special about them.

Evidence:
- `frontend/OBSStudioAPI.cpp:317-336`: tools menu actions added by plugins (scripts, websocket) are ordinary QActions with `NoRole`. There is no startup gating in this code.

Related: none.

### [#11933](https://github.com/obsproject/obs-studio/pull/11933) — mac-capture: Show warning for macOS system effect on audio devices

**Verdict: IMPLEMENT (partial-pr)**

The PR is by an OBS team member. It adds a warning in CoreAudio source properties when a macOS microphone mode (Voice Isolation / Wide Spectrum) is active, because these per-app effects silently change the sound of every audio device in OBS. The useful part is about 25 lines in commit e6801946b. The other two commits rename `mac-audio.c` to `mac-audio.m` (about 1000 lines of churn) and reformat it. `mac-audio.c` has changed on master since then (d412d64ef, d4ef5ef2d, 7979421cb), so the rename is a merge hazard. The smallest slice skips the rename. Put the `AVCaptureDevice.activeMicrophoneMode` check in a tiny new Objective-C helper that returns the locale key, and call it from the existing C `coreaudio_properties`.

Evidence:
- `plugins/mac-capture/mac-audio.c:984-1008`: `coreaudio_properties` adds the device list (line 1006 callback) and then downmix (line 1008). The warning goes between them.
- `plugins/mac-capture/CMakeLists.txt:6-20` (sources) and `:27-34` (frameworks): AVFoundation is not linked yet.
- PR commit e6801946b: the functional change (`@available(macOS 12.0, *)`, switch on `AVCaptureMicrophoneMode`, `OBS_TEXT_INFO_WARNING`), plus two en-US strings.
- `git diff master...refs/upstream-pr/11933 --stat`: 1077+/1058-, mostly the rename.

Slice plan:
- New `plugins/mac-capture/mac-audio-effects.m` and `.h` exposing `const char *mac_audio_active_effect_warning_key(void)`, which returns NULL or `"Warning.Effect.Audio.VoiceIsolation"` / `"Warning.Effect.Audio.WideSpectrum"`.
- `mac-audio.c`: after line 1006, if the key is non-NULL, add an `OBS_TEXT_INFO` property and set it to `OBS_TEXT_INFO_WARNING`.
- `CMakeLists.txt`: add the new sources and link `AVFoundation.framework`.
- `data/locale/en-US.ini`: add the 2 strings from the PR.
- Credit jcm93 (PR #11933) in the commit message. Drop the unused `effect_warning` struct field from the PR.
- Platform: macOS. UNTESTED on this Windows box.

Related: none.

### [#12014](https://github.com/obsproject/obs-studio/issues/12014) — M4 MacBook stuttering in full-screen projector with capture cards

**Verdict: CANNOT_VERIFY**

Stutter shows up after about an hour in a full-screen projector, with two different capture cards on an M4 Pro. CPU load is low and the body has no code pointer. This needs a repro or profiling on that hardware (display link / projector vsync / AVCapture timing). It cannot be tied to a code defect from here.

Evidence:
- No code-level information in the body. The projector and mac-avcapture paths are generic.

Related: 12044 (macOS 15 preview freezes).

### [#12015](https://github.com/obsproject/obs-studio/issues/12015) — OBS virtual camera overrides FaceTime even after uninstalling

**Verdict: OUT_OF_SCOPE**

The reporter fixed it by deleting `~/Library/Preferences/com.apple.FaceTime.plist`. FaceTime had saved the virtual camera as its chosen device in its own preferences. OBS does not write other apps' preference files. The legacy DAL plugin and the camera system extension are removed through OS mechanisms that the KB already documents. This is OS/FaceTime behavior and a support matter, not an OBS code defect.

Evidence:
- `plugins/mac-virtualcam/`: OBS only registers a CMIO device. Nothing in the tree touches `com.apple.FaceTime` preferences.

Related: none.

### [#12023](https://github.com/obsproject/obs-studio/issues/12023) — macOS 15.4 crashes every time after exiting OBS

**Verdict: CANNOT_VERIFY**

Main-thread SIGSEGV at shutdown. The stack goes from an OBS QMainWindow posted event into obs-browser and then into Chromium Embedded Framework (an ObjC message forward to a freed object). The OBS and obs-browser frames are unsymbolicated, and obs-browser is a submodule with its own CEF lifecycle. A NULL-address crash in CEF teardown cannot be traced to a specific line without symbols or a repro.

Evidence:
- Stack in issue body: frames 4-6 `obs-browser +0x31...`, frames 0-1 CEF, frames 7-9 OBS, all unsymbolicated.

Related: 12126 (similar "quit unexpectedly" on close).

### [#12044](https://github.com/obsproject/obs-studio/issues/12044) — macOS 15.4: preview freezes and system audio stops (M-series)

**Verdict: CANNOT_VERIFY**

With Screen/Display Capture (ScreenCaptureKit) the preview freezes and system audio playback stops, while the UI stays responsive. Window Capture makes it happen less often. Other apps' audio stopping as well points at the OS ScreenCaptureKit/CoreAudio stack. There is no stack or code pointer, and it is specific to the macOS version and hardware.

Evidence:
- `plugins/mac-capture/mac-sck-video-capture.m`, `mac-sck-common.m`: the SCK stream is configured once. Nothing in the body links a particular call to the freeze.

Related: 12014.

### [#12062](https://github.com/obsproject/obs-studio/issues/12062) — Modern mac-avcapture loses reference to iOS display device on restart

**Verdict: IMPLEMENT (new-change)**

Root cause found. iOS screen devices only show up after `kCMIOHardwarePropertyAllowScreenCaptureDevices` is set, and they appear asynchronously, with an `AVCaptureDeviceWasConnectedNotification` after source creation. At startup `switchCaptureDevice:` cannot find the device yet and logs "Unable to initialize device with unique ID". It returns without recording the wanted UUID, because `self.deviceUUID` is only set on success or for an empty UUID. When the connect notification arrives later, `deviceConnected:` compares the device to `self.deviceUUID`, which is nil, and returns early, so the source never reconnects. The legacy plugin stores the wanted uid and reconnects in its connect observer, which matches the report that Legacy works.

Evidence:
- `plugins/mac-avcapture/OBSAVCapture.m:26-29`: screen-capture devices are enabled in the init.
- `plugins/mac-avcapture/OBSAVCapture.m:56-58`: the connect observer is registered.
- `plugins/mac-avcapture/OBSAVCapture.m:193-215`: `switchCaptureDevice:`. In the `!device` path, `deviceUUID` is set only when `uuid.length < 1` (line 210). The non-empty case (line 213) logs a warning and leaves `deviceUUID` stale or nil.
- `plugins/mac-avcapture/OBSAVCapture.m:1154`: `deviceConnected:` returns when the UUID differs from `self.deviceUUID`.
- `plugins/mac-avcapture/legacy/av-capture.mm:1209-1215`: legacy stores `capture->uid` and reconnects on connect.

Slice plan:
- `OBSAVCapture.m` around line 213: set `self.deviceUUID = uuid;` before returning NO in the "Unable to initialize" branch, so a later connect event for that device reconnects. About 1-3 lines.
- Possible side effect: `OBSAVCapture.m:617` skips the switch when the UUID matches. Re-selecting the same missing device in properties will then not retry, but the connect notification covers that case.
- Platform: macOS. UNTESTED on this Windows box.

Related: none.

### [#12104](https://github.com/obsproject/obs-studio/issues/12104) — Instance freezes with multiple OBS instances using SRT via VLC sources

**Verdict: CANNOT_VERIFY**

Two instances, each with a VLC source receiving SRT. One instance slowly freezes, then hangs on exit. This looks like a deadlock, possibly in libVLC or in vlc-video teardown, but there is no stack or sample. It cannot be pinned to code from the body.

Evidence:
- `plugins/vlc-video/`: libVLC is loaded at runtime from the user's VLC install, so third-party code is involved. No thread dump was provided.

Related: none.

### [#12126](https://github.com/obsproject/obs-studio/issues/12126) — macOS reports OBS quit unexpectedly after a normal close

**Verdict: CANNOT_VERIFY**

A crash on close leads to the safe-mode prompt on the next start. No crash log was attached, and only the OBS log is linked. This is likely the same family as #12023 (obs-browser/CEF teardown), but that cannot be confirmed without a stack.

Evidence:
- Body has no crash report. See #12023 for the CEF-at-exit stack.

Related: 12023.

### [#12141](https://github.com/obsproject/obs-studio/issues/12141) — os_process_pipe_create with "r" fails on macOS

**Verdict: ALREADY_ADDRESSED**

The read path called `posix_spawn_file_actions_addclose` on `mainfds[0]` twice. On macOS that makes `posix_spawn` return EBADF (9). Master commit 49708181b ("libobs/util: Fix fd management in os_process_pipe_create", 2026-03-07) rewrote this block. The read branch now closes `mainfds[0]` once, then dup2s and closes `mainfds[1]`.

Evidence:
- `libobs/util/pipe-posix.c:75-80`: read path: `addclose(mainfds[0])`, then `adddup2(mainfds[1], STDOUT)` and `addclose(mainfds[1])`. No double close.
- `git show 49708181b`: replaces the second `addclose(mainfds[0])` with `addclose(mainfds[1])`.

Related: 12147 (the PR fixing it).

### [#12147](https://github.com/obsproject/obs-studio/pull/12147) — libobs/util: Fix posix_spawn failed when read pipe needed on macOS

**Verdict: ALREADY_ADDRESSED**

The PR deletes the duplicate `addclose(mainfds[0])`. Master fixed the same line differently and more completely in 49708181b: it closes `mainfds[1]` after the dup, as POSIX hygiene requires, and also fixes the write and stderr paths. The PR diff no longer applies to the current text, and its intent is already met.

Evidence:
- `git diff master...refs/upstream-pr/12147`: removes the old line 78. On master that line is now `addclose(mainfds[1])` (`libobs/util/pipe-posix.c:79`).
- Commit 49708181b on master.

Related: 12141.

### [#12193](https://github.com/obsproject/obs-studio/issues/12193) — Mac capture clips to sRGB even in HDR projects

**Verdict: DEFER_LARGE**

Correct observation: the ScreenCaptureKit capture hardcodes `kCGColorSpaceDisplayP3`, which is SDR. Real HDR capture needs SCK HDR stream configuration (macOS 15 presets), 10-bit or half-float pixel formats, matching OBS texture formats and color-space/transfer tagging on the source, plus handling of the project color space. That is a feature across several files with design choices (an option versus following the project setting), not a one-line fix.

Evidence:
- `plugins/mac-capture/mac-sck-video-capture.m:203`: `setColorSpaceName:kCGColorSpaceDisplayP3` is hardcoded.
- No HDR, `captureDynamicRange` or 10-bit pixel-format handling anywhere in `plugins/mac-capture/mac-sck-*.m`.

Related: none.

### [#12245](https://github.com/obsproject/obs-studio/issues/12245) — macOS context menus invisible when starting in fullscreen

**Verdict: CANNOT_VERIFY**

Context menus are invisible but still clickable when OBS starts in fullscreen, and only intermittently. This is most likely a Qt Cocoa / window-level interaction (Qt 6 update in 31.1). There is no reproducible trigger and no OBS code path that sets menu window levels.

Evidence:
- No OBS code sets NSWindow level for QMenus. Context menus are plain `QMenu::exec`.

Related: none.

### [#12300](https://github.com/obsproject/obs-studio/pull/12300) — mac-capture: Filter multiple applications

**Verdict: DEFER_LARGE**

The PR adds a new libobs public property type (`OBS_EDITABLE_LIST_TYPE_COMBO`), along with the properties-view UI and docs. It also changes the mac SCK `application` setting from a string to an array. The PR says this is a breaking change that silently empties existing scene configs, and that would need a settings migration. It conflicts with master (merge-tree reports conflicts) and touches libobs API and UX, which needs maintainer design sign-off.

Evidence:
- `git diff master...refs/upstream-pr/12300 --stat`: 9 files, +236/-32, including `libobs/obs-properties.h`, `shared/properties-view/properties-view.cpp`.
- `git merge-tree` against master shows conflicting hunks.

Related: none.

### [#12358](https://github.com/obsproject/obs-studio/issues/12358) — OBS ignores MacType font rendering (Windows)

**Verdict: OUT_OF_SCOPE**

This is a Windows issue despite the keyword. MacType is a third-party DLL injector that hooks GDI text rendering. From 31.1, OBS ships a newer Qt whose Windows platform plugin renders through DirectWrite by default, so the GDI hooks no longer take effect. Third-party rendering hooks are not something OBS should design around. Users can change Qt's font engine through Qt's own platform options (e.g. `-platform windows:fontengine=gdi`) without code changes.

Evidence:
- Regression range in the body (31.0.4 to 31.1.0-beta1) matches the Qt version bump. No OBS code chooses a font rasterizer.

Related: none.

### [#12450](https://github.com/obsproject/obs-studio/issues/12450) — [macOS] With Italian, Preferences opens the Auto-Configuration Wizard

**Verdict: IMPLEMENT (new-change)**

Root cause found. On macOS, Qt's default `QAction::TextHeuristicRole` gives `PreferencesRole` to any menu action whose text starts with "config"/"setting"/"option"/"preference"/"setup". The Italian `Basic.AutoConfig` string is "Configurazione automatica guidata", which starts with "Config". That action then takes the application-menu Preferences slot (and Cmd+,) away from `action_Settings`. Plugin tool actions already get `NoRole` for this reason. The built-in `autoConfigure` action in the .ui file does not, which matches RytoEX's comment quoted in the issue ("not created the same way as all of the other items in the Tools menu").

Evidence:
- `frontend/data/locale/it-IT.ini:162`: `Basic.AutoConfig="Configurazione automatica guidata"`.
- `frontend/forms/OBSBasic.ui:949` (Tools menu `autoConfigure`), `:2035-2044` (`autoConfigure`/`autoConfigure2` have no `menuRole` property).
- `frontend/widgets/OBSBasic.cpp:372-375`: the `__APPLE__` block sets explicit roles for CheckForUpdates, Settings and MacPermissions only.
- `frontend/OBSStudioAPI.cpp:321,334`: plugin tools actions use `setMenuRole(QAction::NoRole)`.

Slice plan:
- `frontend/widgets/OBSBasic.cpp`, inside the `#ifdef __APPLE__` block near line 375: add `ui->autoConfigure->setMenuRole(QAction::NoRole);` (and `autoConfigure2`, which is unused in menus but harmless). 1-2 lines. Alternatively set `<property name="menuRole"><enum>QAction::NoRole</enum></property>` on these actions in `OBSBasic.ui`.
- Test: build the frontend with MSVC to confirm it compiles. The behavior is macOS-only and UNTESTED.

Related: upstream #12261 (Catalan variant, closed).

### [#12495](https://github.com/obsproject/obs-studio/issues/12495) — Program projector on a secondary monitor sometimes not restored on macOS

**Verdict: CANNOT_VERIFY**

The projector fails to restore about 1 in 6 launches. This is probably a startup race with screen enumeration or window placement on macOS. It is intermittent with no log excerpt that identifies the failing step, so I could not tie it to a specific line in the projector restore code.

Evidence:
- The body reports an intermittent failure only. Upstream has no repro data.

Related: none.

### [#12519](https://github.com/obsproject/obs-studio/issues/12519) — XRGB/MJPEG capture formats available on Windows but not macOS

**Verdict: OUT_OF_SCOPE**

This is a question. On macOS, mac-avcapture lists the formats that AVFoundation reports for the device, and it already knows 32BGRA/ARGB and JPEG codec types. Which formats appear depends on Apple's UVC driver and AVFoundation, which typically decode MJPEG internally and do not expose raw RGB for these cards. This is an OS/driver limitation, not an OBS defect.

Evidence:
- `plugins/mac-avcapture/OBSAVCapture.m:811-835`: format mapping already includes `kCVPixelFormatType_32BGRA`, `32ARGB` and `kCMVideoCodecType_JPEG`. OBS shows what the device's `AVCaptureDeviceFormat`s offer.

Related: none.

### [#12602](https://github.com/obsproject/obs-studio/issues/12602) — Hotkeys stop working after ~30 minutes on macOS

**Verdict: CANNOT_VERIFY**

Hotkeys use a listen-only CGEventTap. The callback already re-enables the tap after `kCGEventTapDisabledByTimeout`. Other possible causes include `kCGEventTapDisabledByUserInput` (Secure Input, which is not re-enabled and is only logged as "unexpected event"), a stuck key-down state, or the OS revoking Input Monitoring. Without a log showing the `[hotkeys-cocoa]` messages, none of these can be confirmed.

Evidence:
- `libobs/obs-cocoa.m:510-544`: `KeyboardEventProc`. Timeout is handled (534-537). `kCGEventTapDisabledByUserInput` falls into `default` (only a warning).
- `libobs/obs-cocoa.m:588-602`: tap creation.

Related: none.

### [#12610](https://github.com/obsproject/obs-studio/issues/12610) — [FreeType 2] Scroll filter makes multiline text-from-file vanish

**Verdict: CANNOT_VERIFY**

Plausible, but the defect could not be found in code. FreeType2 computes `cy` from line breaks in `fill_vertex_buffer`, and the scroll filter renders the source to a texture of its reported size. No obvious bug in the line-break or size handling explains the text disappearing. The cause may be the size of a very tall render target, the custom-width wrap path, or the file encoding. This needs a repro with the attached file.

Evidence:
- `plugins/text-freetype2/text-functionality.c:129-192`: `fill_vertex_buffer` handles `\n` and skips `\r`, and sets `cy = max_y`.
- `plugins/text-freetype2/text-freetype2.c:141-153`: `get_width`/`get_height` return `cx`/`cy` + outline.

Related: none.
