# Upstream triage — batch audio-03

- Batch: audio-03 (area hint: audio — several items are actually display/UI/Linux)
- Items: 11656, 11671, 11739, 11771, 11858, 11868, 11979, 12008, 12027, 12028, 12059, 12084, 12128, 12273, 12346, 12355, 12431, 12579
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`, local PR refs `refs/upstream-pr/<N>`, read-only code inspection. No comment threads were fetched (0 WebFetch used).
- Tooling note: local git is 2.33, which has no `merge-tree --write-tree`; applicability was checked with the legacy three-way form
  `git merge-tree $(git merge-base master <ref>) master <ref>` and counting `<<<<<<<` conflict markers (0 = applies cleanly).

## Summary

| # | Kind | Verdict | One-liner |
|---|------|---------|-----------|
| 11656 | issue | CANNOT_VERIFY | macOS sync offset "lost" after opening Adv. Audio; dialog code does not write the offset |
| 11671 | issue | OUT_OF_SCOPE | one third-party website's alerts produce no sound in browser source |
| 11739 | issue | IMPLEMENT (cherry-pick PR 14091) | monitoring goes silent for media with cover art: `prev_video_ts` is never updated |
| 11771 | PR | DEFER_LARGE | audio timings in the source profiler; changes the public `profiler_result_t` ABI and has no in-tree consumer |
| 11858 | issue | CANNOT_VERIFY | per-monitor DPI; Qt 6 is already per-monitor aware and OBS overrides nothing |
| 11868 | issue | IMPLEMENT (new change) | a Windows monitor that fails to start is dropped for good and skipped by device-change resets |
| 11979 | issue | CANNOT_VERIFY | random crash in audio teardown while a third-party multistream plugin is in use |
| 12008 | issue | OUT_OF_SCOPE | VRR/G-Sync stops when any window is visible: OS/driver behaviour |
| 12027 | issue | CANNOT_VERIFY | Xlib BadWindow exit on KDE Wayland; no in-tree Xlib caller runs there without a handler |
| 12028 | issue | CANNOT_VERIFY | gap when looping an mp3 (probably the encoder's priming/padding samples); needs the sample files |
| 12059 | issue | CANNOT_VERIFY | start of short sounds clipped in browser source (obs-browser/CEF) |
| 12084 | issue | IMPLEMENT (new change) | WASAPI properties silently replace a missing device with "Default" |
| 12128 | issue | CANNOT_VERIFY | one-frame audio gaps; ASIO plugin and specific hardware involved |
| 12273 | issue | IMPLEMENT (cherry-pick PR 13788) | display capture assumes the active device is at index 0 |
| 12346 | issue | CANNOT_VERIFY | tearing in monitor capture between versions; GPU/driver/compositor |
| 12355 | PR | DEFER_LARGE | dynamic audio-track count; about 1.8k lines removed, Settings UI redesign |
| 12431 | PR | DEFER_LARGE | rework of async video/audio timestamp semantics in the libobs hot path; self-described as breaking |
| 12579 | issue | IMPLEMENT (new change) | VLC source 5.1/7.1 channels arrive in VLC's internal (WG4) order and are never reordered |

---

### [#11656](https://github.com/obsproject/obs-studio/issues/11656) — Audio Sync Offset resets when opening the Advanced Audio Properties window.

**Verdict: CANNOT_VERIFY**

Reasoning: The report (macOS 14, mp3 media source) says the offset is applied after a restart but appears to stop working once Advanced Audio Properties has been opened. The dialog code does not show that. `OBSAdvAudioCtrl` reads the offset with `obs_source_get_sync_offset` and sets the spin box *before* it connects `valueChanged`, so building the dialog never calls `obs_source_set_sync_offset`. The only writer is `syncOffsetChanged`, which runs on user edits, and the signal-driven refresh blocks signals. The report also mixes in the source being hidden and shown again, which restarts the media source and resets its timestamps. That is a more likely cause, but there is no repro to separate the two. The Windows-only monitoring delay logic (`process_audio_delay`) does not exist on macOS, so #11739's root cause does not apply.

Evidence:
- `frontend/components/OBSAdvAudioCtrl.cpp:144-148` — the initial value comes from `obs_source_get_sync_offset`; `setValue` runs before `connect` (line 200).
- `frontend/components/OBSAdvAudioCtrl.cpp:352-354` — the signal-driven update blocks signals.
- `frontend/components/OBSAdvAudioCtrl.cpp:493-511` — the only place that writes the offset, and only on a user edit.

Related: none.

---

### [#11671](https://github.com/obsproject/obs-studio/issues/11671) — [Source/Browser] Bug - OBS Studio Does Not Playing Sound from the Website LivePix

**Verdict: OUT_OF_SCOPE**

Reasoning: Only one third-party alert site (livepix.gg) is affected; its voice alerts are silent while its visual alerts work. There is no general browser-source audio defect: other sites' audio works through the same obs-browser/CEF path. The browser source lives in the `obs-browser` submodule, which is a separate repo. What remains is site behaviour (autoplay policy, the site's audio API usage, or what the site does when it detects OBS) and belongs in obs-browser support or with the site. There is nothing to change in this repo.

Evidence:
- The browser source is the `plugins/obs-browser` submodule, not core code.
- The report itself says the problem is site-specific; no other site is affected.

Related: 12059.

---

### [#11739](https://github.com/obsproject/obs-studio/issues/11739) — when switch between scenes music with album covers cause audio monitoring malfunction

**Verdict: IMPLEMENT — cherry-pick PR #14091**

Reasoning: I found the root cause in the Windows monitoring code. `process_audio_delay` keeps audio in line with the source's video by comparing it to `source->last_frame_ts`. To avoid waiting forever when the "video" is a still image, it tracks `monitor->prev_video_ts` and `time_since_prev`. Once `time_since_prev > 100 ms`, the diff counts as "bad" and audio passes through. However, the branch that runs when the video timestamp *changes* only resets `time_since_prev = 0`; it never stores the new timestamp in `prev_video_ts`. A file with cover art produces one video frame per playback. After a restart (scene switch, restart-on-activate, loop) a new cover frame arrives with a new timestamp. From then on `prev_video_ts != last_frame_ts` on every callback, so `time_since_prev` is reset to 0 every time, the bad-diff escape never fires, and audio counts as "rushing" (`diff > 75 ms`) and is dropped. This matches every symptom: the first play works, the second play or loop fails, and turning monitoring off and on (which creates a fresh monitor with `prev_video_ts = 0`) fixes it. The bug dates from commit 528325578 (2017). Open upstream PR #14091 adds the missing assignment as a one-line change that names this issue. It applies cleanly (0 conflict markers).

Evidence:
- `libobs/audio-monitoring/win32/wasapi-output.c:74-81` — the `else` branch resets `time_since_prev` but never sets `prev_video_ts`.
- `libobs/audio-monitoring/win32/wasapi-output.c:91` — `bad_diff` depends on `time_since_prev > 100000000ULL`.
- `libobs/audio-monitoring/win32/wasapi-output.c:94-103` — the "rushing" early return drops the audio.
- `git show 528325578` — the original commit that added `prev_video_ts`/`time_since_prev` (Lain, 2017).
- `refs/upstream-pr/14091` — a one-line fix by prgmitchell; the PR body says it fixes #9428 and #11739.

Related: PR 14091 (fix), 12059 (possibly related; the browser source also has video and also goes through this delay logic on Windows).

Slice:
- Approach: cherry-pick `refs/upstream-pr/14091` (1 line, keeps the original author).
- Files: `libobs/audio-monitoring/win32/wasapi-output.c`.
- Test plan: build `libobs` with MSVC on this Windows box. Manual test: an mp3 with embedded cover art in a Media Source set to Monitor and Output; switch scenes away and back, or enable loop, and confirm monitoring keeps playing. Needs speakers or headphones; if the manual test cannot be run, mark it UNTESTED in the commit.

---

### [#11771](https://github.com/obsproject/obs-studio/pull/11771) — libobs: Add audio to source profiler

**Verdict: DEFER_LARGE**

Reasoning: The PR is small (one commit, +134 lines) and applies cleanly, but it is not a good local pick. It adds four fields to the public `profiler_result_t`. `source_profiler_fill_result` does `memset(result, 0, sizeof(struct profiler_result))`, so a plugin built against the old, smaller struct and passing a stack instance would get a buffer overflow. That is a libobs ABI change that needs an upstream API decision, for example a versioned or size-tagged struct. Nothing in the tree reads the new data: the only consumer is the author's out-of-tree plugin. It also takes the profiler's hashmap **write** lock once per source on every audio tick, on the audio thread, and once per async audio packet. This is the "needs design decision" case, not a cleanup.

Evidence:
- `libobs/util/source-profiler.h` (`profiler_result_t`) — the PR appends `audio_render_*`/`audio_async_*` fields.
- `libobs/util/source-profiler.c:594-600` — `memset(result, 0, sizeof(struct profiler_result))` writes the full new size into a caller-owned struct.
- `git diff master...refs/upstream-pr/11771 -- libobs/obs-audio.c` — the timing calls wrap every `obs_source_audio_render` in `audio_callback`.
- `grep source_profiler_fill_result frontend plugins` — no in-tree consumer.

Related: none.

---

### [#11858](https://github.com/obsproject/obs-studio/issues/11858) — OBS uses Scaling set by the primary monitor but not the monitor that it is in

**Verdict: CANNOT_VERIFY**

Reasoning: This is not an audio issue. OBS's Windows manifest declares no DPI awareness, so Qt 6 sets its default Per-Monitor-V2 awareness. The frontend only sets `HighDpiScaleFactorRoundingPolicy::PassThrough`. Nothing in OBS pins scaling to the primary monitor. The behaviour described is typical of an external override, such as a compatibility-tab "Override high DPI scaling" setting or `QT_*` environment variables, and cannot be reproduced from code.

Evidence:
- `frontend/obs-main.cpp:501` — only the rounding policy is set.
- `frontend/cmake/windows/obs.manifest` — no `dpiAware`/`dpiAwareness` element (only `frontend/updater/updater.manifest:6-7` declares any, and that applies to the updater only).

Related: none.

---

### [#11868](https://github.com/obsproject/obs-studio/issues/11868) — Audio Monitor setting on sources needs to be reset whenever monitor device is changed

**Verdict: IMPLEMENT — new change**

Reasoning: I found the root cause. When monitoring is enabled on a source (including at scene-collection load), `obs_source_set_monitoring_enabled` calls `audio_monitor_create`. On Windows, `audio_monitor_init` returns the result of `audio_monitor_init_wasapi`. If the saved monitoring device ID cannot be opened at that moment, creation returns `NULL`. That happens when an HDMI/display endpoint is missing or has been given a new ID after a replug. The source is left with `monitoring_enabled = true` and `source->monitor = NULL`, and the failed monitor is never added to `obs->audio.monitors`. As a result:
1. Nothing ever retries. The lazy reconnect in `on_audio_playback` (`!monitor->client && !audio_monitor_init_wasapi`) only exists for a monitor object that was created.
2. Changing the monitoring device in Settings calls `obs_reset_audio_monitoring`, which only walks `obs->audio.monitors`, so these sources stay silent.
3. The only recovery is toggling the source to off and back on, which calls `audio_monitor_create` again. That is exactly the workaround the reporter and the linked forum thread describe.

Slice:
- Approach: new change.
- Files: `libobs/audio-monitoring/win32/wasapi-output.c`.
- Change: in `audio_monitor_init`, if `audio_monitor_init_wasapi()` fails, log a warning, call `audio_monitor_free_for_reconnect(monitor)` to release any half-initialised client, render client or resampler (so `client == NULL`), and still `return true`. The monitor is then registered in `obs->audio.monitors`, is reset when the device changes, and retries lazily through the existing reconnect path in `on_audio_playback`. Optionally throttle the lazy retry (for example a `last_reconnect_attempt` timestamp, at most once per second) so that a missing device does not cause a `CoCreateInstance` per audio packet. About 15-25 lines.
- Platform: Windows (PulseAudio/CoreAudio monitors may have the same create-failure pattern, but they are out of scope for this slice).
- Test plan: MSVC build of `libobs`. Manual test: set the monitoring device to a device that can be disabled (in the Windows Sound control panel), disable it, start OBS with a source set to monitor, re-enable the device or choose another device in Settings > Audio > Monitoring Device, and confirm audio monitoring resumes without toggling the source. If the device cannot be disabled on this box, mark it UNTESTED.

Evidence:
- `libobs/obs-source.c:5628-5634` — `source->monitor = audio_monitor_create(source)`; a NULL result is kept silently.
- `libobs/audio-monitoring/win32/wasapi-output.c:374-399` — `audio_monitor_init` returns the WASAPI init result directly.
- `libobs/audio-monitoring/win32/wasapi-output.c:412-431` — `audio_monitor_create` frees the monitor and returns NULL on failure, before `da_push_back(obs->audio.monitors, ...)`.
- `libobs/audio-monitoring/win32/wasapi-output.c:296-298` — the existing lazy reconnect in `on_audio_playback`.
- `libobs/audio-monitoring/win32/wasapi-output.c:256-277` — `audio_monitor_free_for_reconnect` safely clears client, render client and resampler.
- `libobs/obs.c:2964-2977` — `obs_reset_audio_monitoring` only iterates the registered monitors.

Related: 11739 (same file, independent fix).

---

### [#11979](https://github.com/obsproject/obs-studio/issues/11979) — OBS Studio Crashes with "Unhandled Exception: c0000005" During Audio Device Disconnect

**Verdict: CANNOT_VERIFY**

Reasoning: The crash is intermittent (10 minutes to hours) and the stack shows `audio_output_disconnect` reached from `stop_audio_encoders`/`end_data_capture_thread` when an output stops. The reporter uses the third-party Aitum Multistream plugin, and the crash coincides with that plugin's Twitch output stopping. Without the full crash dump, or a repro without the plugin, there is no identifiable defect in libobs, and the plugin's own output and encoder lifetime handling is the more likely cause. The title's "audio device disconnect" is the reporter's guess; nothing shows a device actually being removed.

Evidence:
- The crash path named in the report (libobs output teardown) is shared by every output and stable for built-in outputs; the plugin manages its own outputs and encoders.

Related: none.

---

### [#12008](https://github.com/obsproject/obs-studio/issues/12008) — VRR/Gsync not working in some games when obs window visible (not minimized) on second monitor

**Verdict: OUT_OF_SCOPE**

Reasoning: VRR only engages for borderless or windowed games when DWM/NVIDIA can use independent flip for the game. Any other window on another monitor that keeps redrawing can disable it. This is an OS compositor and driver limitation that affects any frequently redrawing application, not a defect in OBS. Minimising the preview or turning it off is the known workaround. Nothing in OBS can opt out of it.

Evidence:
- The behaviour depends on whether the game uses exclusive fullscreen (from the report's own repro), which points to DWM presentation mode, not OBS code.

Related: 12346 (also display/driver behaviour).

---

### [#12027](https://github.com/obsproject/obs-studio/issues/12027) — OBS randomly crashes with "X Error of failed request: BadWindow (invalid Window parameter)"

**Verdict: CANNOT_VERIFY**

Reasoning: The output is Xlib's *default* error handler, which prints and calls `exit()`, on an `X_GetProperty` request, on KDE Wayland. I checked every in-tree Xlib user:
- `libobs-opengl/gl-x11-egl.c:295-324` installs a non-fatal, process-global `XSetErrorHandler(x_error_handler)`, so on an X11/xcb session this message could not come from the default handler.
- `plugins/frontend-tools/auto-scene-switcher-nix.cpp` calls `XFetchName`/`XGetWindowProperty` without a handler. It would be the obvious suspect, but `InitSceneSwitcher` returns early on Wayland (`auto-scene-switcher.cpp:501-503`).
- `plugins/linux-capture/xcomposite-input.c` silences its own errors and is X11-only. `libobs/obs-nix-x11.c` only runs on the X11 platform.

So no in-tree code path explains a default-handler BadWindow exit on Wayland. A third-party plugin or library is the likely source. The log URL is not available offline.

Evidence:
- `libobs-opengl/gl-x11-egl.c:295-324` — the global, non-fatal X error handler (X11 platform).
- `plugins/frontend-tools/auto-scene-switcher.cpp:498-503` — the scene switcher is disabled on Wayland.
- `plugins/linux-capture/xcomposite-input.c:346-393` — existing error silencing.
- Side note, not tied to this report: `plugins/frontend-tools/auto-scene-switcher-nix.cpp:160-200` dereferences `data[0]` without checking that `XGetWindowProperty` succeeded or returned any items, and never frees `data`. It is worth a separate hardening pass, but it would cause a segfault, not this message.

Related: none.

---

### [#12028](https://github.com/obsproject/obs-studio/issues/12028) — Looped .mp3 audio in media source plays a half-second dead spot where equivalent .wav doesn't

**Verdict: CANNOT_VERIFY**

Reasoning: MP3 frames always carry encoder priming and padding samples, and Audacity/LAME exports also add delay. A gapless loop only works if the decoder trims the samples given in the LAME/Xing header. The media source loops by seeking `media-playback` back to the start, so the gap may come from untrimmed priming/padding plus the restart latency of the seek and decoder flush. The reported ~0.5 s is longer than typical priming (~50 ms), however, and the reporter could not attach the files. Without the sample files the decode path cannot be compared with WAV, so there is no identified code defect.

Evidence:
- The loop is handled in the `shared/media-playback` / `plugins/obs-ffmpeg/obs-ffmpeg-source.c` restart path. The report has no log evidence of where the time goes.

Related: none.

---

### [#12059](https://github.com/obsproject/obs-studio/issues/12059) — Very short sounds in browser source get the beginning cut off

**Verdict: CANNOT_VERIFY**

Reasoning: Browser-source audio comes from CEF in the `obs-browser` submodule. A clipped start on very short clips could come from CEF's audio stream start-up or from timestamp alignment when a new audio stream begins after silence. If the user listens through Windows monitoring, it could also come from the `process_audio_delay` video-sync gate described in #11739, because the browser source has video. The report gives no detail on whether the loss is in monitoring only, in the recording, or both, so the cause cannot be pinned down.

Evidence:
- `libobs/audio-monitoring/win32/wasapi-output.c:52-128` — monitoring can drop "rushing" audio for sources with video. This is a candidate only, not confirmed.

Related: 11671, 11739.

---

### [#12084](https://github.com/obsproject/obs-studio/issues/12084) — Missing audio device resetting to "Default"

**Verdict: IMPLEMENT — new change**

Reasoning: I found the defect, and it matches the log the reporter describes. The WASAPI input and output-capture property callbacks build the device list only from the devices currently present. When the saved `device_id` is unplugged it is not in the list. The shared Qt properties view handles a missing value by calling `info->ControlChanged()` ("trigger a settings update if the index was not found"). That writes the first entry ("Default") into the source's settings and calls `obs_source_update`, so simply opening Properties silently replaces the user's chosen device with Default. This is why the log shows the default device being loaded. Other plugins avoid this by adding a disabled placeholder item for the missing value, which the properties view shows as a warning and does not auto-change.

Slice:
- Approach: new change.
- Files: `plugins/win-wasapi/win-wasapi.cpp` (optionally one locale string in `plugins/win-wasapi/data/locale/en-US.ini`).
- Change: in `GetWASAPIPropertiesInput` and `GetWASAPIPropertiesDeviceOutput`, use the `data` parameter (`WASAPISource *`, may be NULL). If it is non-NULL, read the current `device_id` from `obs_source_get_settings(source->source)`. If that ID is not `"default"` and not among the enumerated devices, add an item for it (label: the ID, or a localized "Device not available" label) and mark it with `obs_property_list_item_disable(prop, idx, true)`. Factor this into a small shared helper. About 30-40 lines.
- Platform: Windows.
- Test plan: MSVC build of `win-wasapi`. Manual test: create an Audio Input Capture on a USB or secondary device, close OBS, disable or unplug the device, reopen OBS, open Properties, confirm the saved device is shown as unavailable rather than changing to Default, and confirm `device_id` in the scene collection JSON is unchanged after closing the dialog. Needs a removable or disableable audio device; otherwise UNTESTED.

Evidence:
- `plugins/win-wasapi/win-wasapi.cpp:1516-1561` — the device lists contain only the devices currently present.
- `shared/properties-view/properties-view.cpp:671-709` — `findData` returns -1, then `info->ControlChanged()` writes the first item.
- `shared/properties-view/properties-view.cpp:698` — a disabled (NoItemFlags) current item is treated as a warning, not changed.
- `plugins/decklink/decklink-output.cpp:206`, `plugins/aja/aja-common.cpp:231` — existing uses of the disabled-placeholder pattern.

Related: PR 13903 (stable endpoint IDs; addresses device IDs changing after updates, a different root cause).

---

### [#12128](https://github.com/obsproject/obs-studio/issues/12128) — 1-Frame Long Audio Gaps on Both Mic & Gameplay Audio Tracks

**Verdict: CANNOT_VERIFY**

Reasoning: The gaps are rare (a few per recording), one frame long, and appear on both a WASAPI output capture and a third-party ASIO plugin source, with a MOTU M2 interface. Gaps on both tracks point to audio-buffering or timestamp resets (for example jitter in device timing pushing a source past the buffering limit) rather than to a specific source. The log is offline, so whether "audio buffering" increases or timestamps jump cannot be checked. There is no code defect to identify without that data or a repro.

Evidence:
- Audio mixing and buffering is in `libobs/obs-audio.c` (`audio_callback`). The report has no log excerpt showing buffering or timestamp-jump messages.

Related: none.

---

### [#12273](https://github.com/obsproject/obs-studio/issues/12273) — Display Capture can only capture first monitor, if third monitor is disabled

**Verdict: IMPLEMENT — cherry-pick PR #13788**

Reasoning: I found the root cause. Display Capture identifies monitors by the `DeviceID` from `EnumDisplayDevicesA(mi.szDevice, 0, ...)`, which always takes **index 0** for the adapter output. When a monitor is disabled, or several monitors share an output path, index 0 can be an inactive or disconnected device. Then several HMONITORs report the same or a wrong `DeviceID`, the property list holds duplicate values, and `find_monitor` matches the first one: "it just picks the first monitor". Enabling the third monitor makes the issue go away, which fits this. Open PR #13788 (prgmitchell) adds `get_active_display_device()`, which walks the indices until it finds one flagged `DISPLAY_DEVICE_ATTACHED_TO_DESKTOP` as Microsoft documents, and uses it in both `enum_monitor` and `enum_monitor_props`. It is about 17 lines in one file and applies cleanly (0 conflict markers). PR #12248 attempts the same thing with `DISPLAY_DEVICE_ACTIVE`, but it can add *several* list entries per HMONITOR in `enum_monitor_props`, so 13788 is the cleaner choice.

Evidence:
- `plugins/win-capture/duplicator-monitor-capture.c:197` — `EnumDisplayDevicesA(mi.szDevice, 0, &device, ...)` in `enum_monitor`.
- `plugins/win-capture/duplicator-monitor-capture.c:745-747` — the same index-0 assumption in `enum_monitor_props`.
- `plugins/win-capture/duplicator-monitor-capture.c:282-289` — `find_monitor` takes the first `DeviceID` match.
- `refs/upstream-pr/13788` — the fix, 1 commit and 1 file; `refs/upstream-pr/12248` is an alternative.

Related: PR 13788 (fix), PR 12248 (alternative), upstream #8040 (earlier report cited in PR 13788).

Slice:
- Approach: cherry-pick `refs/upstream-pr/13788`.
- Files: `plugins/win-capture/duplicator-monitor-capture.c`.
- Test plan: MSVC build of `win-capture`. Manual test on this box: with two or more monitors, disable one in Windows Display Settings, add Display Capture, and switch between the listed monitors; each should capture the right screen. Needs a multi-monitor setup; otherwise mark UNTESTED.

---

### [#12346](https://github.com/obsproject/obs-studio/issues/12346) — Possible loss of VSync functionality of "Monitor" source

**Verdict: CANNOT_VERIFY**

Reasoning: The report is tearing in display-capture output after moving from 30.2.3 to 31.0.4, with both DXGI and WGC capture methods. Neither DXGI Desktop Duplication nor WGC is synchronised to vblank by OBS; both hand over whatever frame the compositor presented. A torn frame inside the captured image comes from the compositor or the video player's presentation (for example tearing-allowed flip presentation), which in turn depends on drivers and Windows updates. There is no OBS code change that controls this, and no regression in the capture code could be identified without a bisect on the user's hardware.

Evidence:
- `plugins/win-capture/duplicator-monitor-capture.c` — capture copies the compositor-provided texture; there is no vsync control.

Related: 12008.

---

### [#12355](https://github.com/obsproject/obs-studio/pull/12355) — Eliminate strict 6 audio tracks implementation

**Verdict: DEFER_LARGE**

Reasoning: The PR has 6 commits across 14 files (+377/−1822). It replaces about 1,300 lines of `OBSBasicSettings.ui` with widgets built at runtime and reworks the Settings, Advanced Audio and Output track handling. Its own stated purpose is to prepare for changing `MAX_AUDIO_MIXES`, which is a compile-time constant at 6 in the shipped build, so it brings no user-visible feature without a further, unwritten setting. That makes it a large UI refactor tied to a future design decision. It merges cleanly today, but it is far above the size threshold and would make later upstream syncs of the Settings dialog much harder.

Evidence:
- `git diff master...refs/upstream-pr/12355 --stat` — 14 files, +377/−1822, including `frontend/forms/OBSBasicSettings.ui` (−1332).

Related: PR 13314 (canvas audio mixes; overlaps the audio-mix design).

---

### [#12431](https://github.com/obsproject/obs-studio/pull/12431) — libobs: Amend timestamp semantics for async video and audio

**Verdict: DEFER_LARGE**

Reasoning: The PR changes the meaning of `last_frame_ts` and replaces `last_sys_timestamp` with `last_frame_sys_ts` in the async-video ready and smoothing path (`obs-source.c` +233 lines, 5 commits, 3 files). Every async source (webcams, media, capture cards) and the audio/video sync that depends on `last_frame_ts`, including Windows monitoring's `process_audio_delay`, would be affected. The author lists it as a breaking change and tested it on Linux (V4L2, test inputs, a C270 webcam). A rewrite of core timing semantics needs maintainer review and broad hardware testing that this box cannot provide (no capture cards). It merges cleanly, but it is not a "small slice".

Evidence:
- `git diff master...refs/upstream-pr/12431 --stat` — `libobs/obs-source.c` (+233/−79), `obs-internal.h`, `obs-source-deinterlace.c`.
- `libobs/audio-monitoring/win32/wasapi-output.c:56` — monitoring also reads `last_frame_ts`, which widens the impact of the change.

Related: upstream #12459 (the issue this PR addresses), 11739 (monitoring depends on `last_frame_ts`).

---

### [#12579](https://github.com/obsproject/obs-studio/issues/12579) — VLC Video Source Surround Audio Channels are Swapped

**Verdict: IMPLEMENT — new change**

Reasoning: I found the root cause (the issue is also labelled `issue/confirmed`). `vlcs_audio_setup` sets `speakers = (enum speaker_layout)channels` and `vlcs_audio_play` `memcpy`s VLC's interleaved samples directly into `obs_source_audio`. libVLC's audio callbacks (amem) deliver channels in VLC's internal WG4 order. For 5.1 that order is L, R, RL, RR, C, LFE, while OBS `SPEAKERS_5POINT1` expects FL, FR, FC, LFE, RL, RR. Feeding one into the other sends C to the rear-left speaker and LFE to rear-right, and vice versa, which is exactly the swap reported for every 5.1 file. For 7.1 the WG4 order is L, R, SL, SR, RL, RR, C, LFE and OBS expects FL, FR, FC, LFE, RL, RR, SL, SR, so it is wrong there too. No open PR addresses this (the only PR touching the file, #12577, is about natsort).

Slice:
- Approach: new change.
- Files: `plugins/vlc-video/vlc-video-source.c`.
- Change: in `vlcs_audio_play`, after copying the buffer, reorder the interleaved frames in place when `c->audio.speakers` is `SPEAKERS_5POINT1` (VLC→OBS index map `{0,1,4,5,2,3}`) or `SPEAKERS_7POINT1` (map `{0,1,6,7,4,5,2,3}`). Handle both sample sizes (S16N = 2 bytes, FL32 = 4 bytes) with a small swap loop over a temporary frame (at most 8 × 4 bytes). Other layouts are left unchanged. About 30-40 lines.
- Platform: cross-platform plugin (VLC source builds on Windows, macOS and Linux).
- Test plan: MSVC build of `vlc-video` on this box (needs VLC headers via deps). Manual test: a 5.1 channel-ID test clip in a VLC Video Source with monitoring on and OBS audio set to 5.1; confirm Center/LFE/Rear come out of the right speakers, or check a recording's channels in Audacity. Without a 5.1 setup this is UNTESTED, apart from checking the recorded file's per-channel waveforms.

Evidence:
- `plugins/vlc-video/vlc-video-source.c:464-479` — `vlcs_audio_play` does a plain `memcpy` with no channel reordering.
- `plugins/vlc-video/vlc-video-source.c:481-506` — `vlcs_audio_setup` maps the channel count straight to `speaker_layout`.
- `plugins/vlc-video/vlc-video-source.c:955` — `libvlc_audio_set_format_callbacks_` (amem path).
- Channel-order mismatch: VLC `pi_vlc_chan_order_wg4` (L R ML MR RL RR C LFE) vs OBS layout order in `libobs/media-io/audio-io.h` (`SPEAKERS_5POINT1`/`SPEAKERS_7POINT1`, FL FR FC LFE RL RR [SL SR]).

Related: none.
