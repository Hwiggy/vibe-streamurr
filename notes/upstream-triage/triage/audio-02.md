# Upstream triage — batch audio-02

- Batch: audio-02 (area hint: audio)
- Items: 8776, 8841, 8842, 9007, 9159, 9677, 9755, 9838, 10586, 11073, 11088, 11183, 11193, 11339, 11400, 11475, 11508, 11640 (all issues, no PRs)
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: issue bodies from `notes/upstream-triage/data/all.json`; code read at master. No comment threads were fetched (no WebFetch used).

Summary:

| # | Verdict |
|---|---|
| 8776 | CANNOT_VERIFY |
| 8841 | ALREADY_ADDRESSED |
| 8842 | ALREADY_ADDRESSED |
| 9007 | DEFER_LARGE |
| 9159 | CANNOT_VERIFY |
| 9677 | CANNOT_VERIFY |
| 9755 | CANNOT_VERIFY |
| 9838 | DEFER_LARGE |
| 10586 | CANNOT_VERIFY |
| 11073 | DEFER_LARGE |
| 11088 | CANNOT_VERIFY |
| 11183 | **IMPLEMENT** |
| 11193 | CANNOT_VERIFY |
| 11339 | DEFER_LARGE |
| 11400 | **IMPLEMENT** |
| 11475 | DEFER_LARGE |
| 11508 | CANNOT_VERIFY |
| 11640 | CANNOT_VERIFY |

---

### [#8776](https://github.com/obsproject/obs-studio/issues/8776) — Application Audio Capture: Window Match Priority having no effect

**Verdict:** CANNOT_VERIFY

**Reasoning:** The process-output capture does re-run window matching with the configured priority on every reconnect (`ms_find_window(INCLUDE_MINIMIZED, priority, ...)`) and leaves the stream (to reconnect) when the hooked window goes away. The report is from 29.0.2. The code has had several fixes since then (hook/unhook signals, timestamp handling, a Stop hang fix). One possible gap: `IsWindow(hwnd)` is only checked inside `ProcessCaptureData`, which runs only when WASAPI signals that a packet is ready. If a dead process's loopback stream stops signalling, the source might never notice. But the reporter says the mixer meter stays active, which means packets still arrive, and in that case the check would fire. I could not find a definite defect without reproducing it.

**Evidence:**
- `plugins/win-wasapi/win-wasapi.cpp:860` — reconnect re-resolves the window with `priority`, class, title, exe.
- `plugins/win-wasapi/win-wasapi.cpp:1005` — `IsWindow(hwnd)` check only on the sample-ready path.
- `plugins/win-wasapi/win-wasapi.cpp:1290-1340` — OnSampleReady failure leads to reconnect and unhook signal.
- `plugins/win-wasapi/win-wasapi.cpp:910-927` — hooked signal re-emitted after reconnect.

**Related:** 9838, 11073, 11475 (other app-audio-capture targeting issues).

---

### [#8841](https://github.com/obsproject/obs-studio/issues/8841) — Remuxing fails when source video has PCM audio

**Verdict:** ALREADY_ADDRESSED

**Reasoning:** At the time of the report, FFmpeg's mov/mp4 muxer could not write PCM into MP4, so remuxing failed. Current FFmpeg (bundled deps from the 2026-10-23 CI deps) supports PCM in ISO-BMFF ("ipcm"/"fpcm"). The frontend now lists `pcm_s16le/s24le/f32le` as compatible with `mp4`, `fragmented_mp4` and the native `hybrid_mp4` output. The default container is also the native hybrid MP4 now, so remuxing is rarely needed. The request for a more descriptive remux error is a separate UX nicety, not the reported bug.

**Evidence:**
- `frontend/utility/FFmpegCodec.cpp:96-121` — PCM codecs listed as compatible with mp4/fragmented_mp4/hybrid_mp4.
- `libobs/media-io/media-remux.c:66-130` — remux copies codec params straight through. Whether it works depends on FFmpeg muxer support.
- `frontend/widgets/OBSBasic.cpp:634,658` — default `RecFormat2` = `DEFAULT_CONTAINER`.

**Related:** 8842.

---

### [#8842](https://github.com/obsproject/obs-studio/issues/8842) — Audio Track names aren't persisted when remuxing

**Verdict:** ALREADY_ADDRESSED

**Reasoning:** The remuxer copies per-stream metadata (which includes the track `title`) from input to output, and has done so since 22.0. The native MP4 muxer, which is now the default, writes track names directly. Any remaining loss of names in remuxed MP4 depends on how FFmpeg's mov muxer maps `title`/`handler_name` and on which tag the player reads. OBS does not drop them.

**Evidence:**
- `libobs/media-io/media-remux.c:92` — `av_dict_copy(&out_stream->metadata, in_stream->metadata, 0);`
- `git log -S` gives commit 797c9d330 "libobs: Copy metadata for tracks/streams when remuxing" (in 22.0.0).

**Related:** 8841.

---

### [#9007](https://github.com/obsproject/obs-studio/issues/9007) — Stereo downmix of 7.1 sources differs by capture type

**Verdict:** DEFER_LARGE

**Reasoning:** This comes from two different downmix paths, not a single bug. Application Audio Capture asks Windows for a process-loopback stream in OBS's own channel layout (stereo), so Windows does any channel conversion. Audio Output Capture opens the device mix format (7.1), and OBS downmixes it with libswresample's default normalized matrix, which lowers levels to avoid clipping. Making the two match means picking a custom downmix matrix or gain policy for everyone. That is a design decision affecting all multichannel inputs, not a small fix.

**Evidence:**
- `plugins/win-wasapi/win-wasapi.cpp:670-693` — process loopback requests `get_audio_channels(oai.speakers)` channels.
- `plugins/win-wasapi/win-wasapi.cpp:723-733` — device capture uses `GetMixFormat` (device layout).
- `libobs/media-io/audio-resampler-ffmpeg.c:145-156` — only a custom mono-upmix matrix exists. Other conversions use swr defaults.

**Related:** none.

---

### [#9159](https://github.com/obsproject/obs-studio/issues/9159) — 2 devices audio issue

**Verdict:** CANNOT_VERIFY

**Reasoning:** Two Elgato Cam Link channels: the DirectShow audio that OBS gets follows whichever device is the Windows default, even when custom audio is selected. This is specific to the hardware and its driver, and it involves how libdshowcapture/the driver tell apart same-named audio endpoints. Nothing in the issue points to a code defect I can identify without the hardware.

**Evidence:**
- `plugins/win-dshow/` (libdshowcapture submodule) — device selection by name/path. Cannot be exercised without two identical capture devices.

**Related:** none.

---

### [#9677](https://github.com/obsproject/obs-studio/issues/9677) — App Audio Delay (~20 ms)

**Verdict:** CANNOT_VERIFY

**Reasoning:** Application audio capture already uses the timestamps WASAPI provides (commit 82f51f24e). A constant ~20 ms offset compared with another capture path is most likely the latency of the Windows process-loopback API (the reporter suspects this too). Users can already compensate with the per-source Sync Offset. There is no identifiable code defect.

**Evidence:**
- `plugins/win-wasapi/win-wasapi.cpp:1024+` — `GetBuffer(..., &pos, &ts)` timestamp used for process output.
- `git log` 82f51f24e "win-wasapi: Use provided timestamp for application audio capture".

**Related:** 8776.

---

### [#9755](https://github.com/obsproject/obs-studio/issues/9755) — Stinger Transition with Audio is being cut early

**Verdict:** CANNOT_VERIFY

**Reasoning:** The stinger's total length comes from the media source's `get_duration`, which is the container's `AVFormatContext::duration`, plus 250 ms. Once that length has passed, the transition ends and the media is stopped. The report involves an AVI file. If the AVI header reports a shorter duration than the audio stream really has, this cutoff is expected. I can't confirm that without the sample file. Other reports (normal stingers in MP4/WebM) don't show the problem.

**Evidence:**
- `plugins/obs-transitions/transition-stinger.c:546-575` — duration from `get_duration` + 250 ms, then `obs_transition_enable_fixed`.
- `shared/media-playback/media-playback/media.c:1037-1040` — duration = `fmt->duration`.

**Related:** none.

---

### [#9838](https://github.com/obsproject/obs-studio/issues/9838) — WebView2 subprocesses prevent Application Audio Capture

**Verdict:** DEFER_LARGE

**Reasoning:** Capture targets a window's PID with `PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE`. WebView2 renderer/audio processes are not in the host app's process tree, because they are launched by the msedgewebview2 browser process. Microsoft's WebView2 issue 2236 confirms this. The fix would let the picker target processes without windows, or processes chosen by audio session (for example via `IAudioSessionManager2` enumeration). The picker is built around window matching (`ms_find_window`, priority by title/class/exe), so this means redesigning the target selection and its saved settings. That is not a small slice.

**Evidence:**
- `plugins/win-wasapi/win-wasapi.cpp:697-699` — `PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE` on window's PID.
- `plugins/win-wasapi/win-wasapi.cpp:860-872` — target is always derived from an HWND.

**Related:** 11073 (DuckDuckGo for Windows is WebView2-based, same cause), 11475 (window-less processes).

---

### [#10586](https://github.com/obsproject/obs-studio/issues/10586) — Browser Sources: audio stops after 10–20 min with "Control audio via OBS"

**Verdict:** CANNOT_VERIFY

**Reasoning:** It is intermittent, depends on third-party alert pages (Streamlabs/Blerp), and the code involved is in the obs-browser submodule (CEF audio handler). There is no stack trace, no repro that doesn't need those services, and no log evidence pointing at a defect.

**Evidence:**
- `plugins/obs-browser` submodule at 85c7f26 — CEF audio routing lives there. Nothing actionable in this repo's tree.

**Related:** none.

---

### [#11073](https://github.com/obsproject/obs-studio/issues/11073) — Application Audio Capture doesn't work with DuckDuckGo tabs

**Verdict:** DEFER_LARGE

**Reasoning:** Same root cause as #9838. The DuckDuckGo Windows browser is built on WebView2, so its audio comes from msedgewebview2 processes outside the window owner's process tree. Fixing it needs the same redesign of target selection.

**Evidence:**
- `plugins/win-wasapi/win-wasapi.cpp:697-699`, `:860-872` (see #9838).

**Related:** 9838, 11475.

---

### [#11088](https://github.com/obsproject/obs-studio/issues/11088) — Elgato HD60X audio capture unbalanced (macOS)

**Verdict:** CANNOT_VERIFY

**Reasoning:** Specific to one device on a macOS developer beta, and the reporter thinks it is a macOS compatibility problem. Channel mapping comes from what the device reports through CoreAudio/AVFoundation. Without the hardware there is no code defect to identify.

**Evidence:**
- `plugins/mac-capture/` / `plugins/mac-avcapture/` — channel layout taken from device format. Untestable without hardware.

**Related:** none.

---

### [#11183](https://github.com/obsproject/obs-studio/issues/11183) — Time does not elapse during 24-hour soundtrack playback

**Verdict:** IMPLEMENT

**Reasoning:** Root cause found. `MediaControls::SetSliderPosition` turns the media time into a slider position (slider `maximum` = 1024) and then calls `UpdateLabels(sliderPosition)`. `UpdateLabels` turns that quantized position back into a time. The elapsed label can therefore only change in steps of duration/1024. For a 24 h file that is about 84 s per step, so the timer looks frozen. Short files hide the problem because each step is under a second. The fix is to build the labels from the real media time during playback, and use the slider-derived time only while the user is seeking.

**Evidence:**
- `frontend/forms/source-toolbar/media-controls.ui:216-218` — slider `maximum` = 1024.
- `frontend/components/MediaControls.cpp:328-347` — `SetSliderPosition` passes quantized `sliderPosition` to `UpdateLabels`.
- `frontend/components/MediaControls.cpp:520-538` — `UpdateLabels` uses `percent * duration` (quantized).

**Slice plan:**
- Change `UpdateLabels(int val)` to `UpdateLabels(float timeMs)` (or add an overload) that formats from a time in milliseconds.
- `SetSliderPosition`: call `UpdateLabels(time)` with the real `obs_source_media_get_time` value.
- Seek paths (`AbsoluteSliderReleased` line ~146, `AbsoluteSliderMoved` line ~166): call `UpdateLabels((float)GetSliderTime(seek))`.
- Update the declaration in `frontend/components/MediaControls.hpp`.
- About 15 lines, cross-platform.
- Test: MSVC build of `obs-studio` frontend. Play a long (several hours) media file and check that the elapsed label advances every second. Check that seeking still updates the labels.

**Related:** none.

---

### [#11193](https://github.com/obsproject/obs-studio/issues/11193) — Monitoring not persisted when device reconnects or host restarts (macOS)

**Verdict:** CANNOT_VERIFY

**Reasoning:** macOS-only, with a capture card (NZXT). Monitoring is set up per source by libobs (`audio-monitoring/osx`) and is independent of the input device reconnecting. Toggling monitoring rebuilds the monitor, which the reporter says fixes it. That points to the macOS monitor's AudioQueue ending up stopped or invalidated after a sleep or device change, but I found no definite defect in the code and can't test on this Windows machine.

**Evidence:**
- `libobs/audio-monitoring/osx/` — CoreAudio monitor implementation. Cannot be exercised on Windows.

**Related:** none.

---

### [#11339](https://github.com/obsproject/obs-studio/issues/11339) — Inconsistent volume meter size with display scaling

**Verdict:** DEFER_LARGE

**Reasoning:** The VolumeMeter paints channels with integer logical-pixel rectangles (`channelNr * (meterThickness + 1)`, `fillRect(..., meterThickness, ...)`). At fractional scale factors (125%, 150%) these land on non-integer device pixels, so Qt rounds each bar to a different device-pixel thickness, and the rounding changes when the widget moves (flicker). Fixing it properly means reworking the meter's geometry to snap to device pixels in both the cached background and the live paint paths, with visual tuning across DPI settings. Low value for a visual rework that can't be validated here at several DPIs.

**Evidence:**
- `frontend/components/VolumeMeter.cpp:480-497` — logical-pixel bar geometry, `meterThickness` clamp 3–6.
- `frontend/components/VolumeMeter.cpp:681-725` — background cache at `devicePixelRatioF()` but integer logical rects.
- `frontend/components/VolumeMeter.cpp:795-861` — live paint uses the same integer logical rects.

**Related:** none.

---

### [#11400](https://github.com/obsproject/obs-studio/issues/11400) — Screen readers don't report items in the filter lists

**Verdict:** IMPLEMENT

**Reasoning:** Root cause found. Each filter row is a `QListWidgetItem` with **empty text**. The visible name is drawn by a `VisibilityItemWidget` set with `setItemWidget`, and the rename path even calls `listItem->setText(QString())` explicitly. Qt's item-view accessibility reads `Qt::AccessibleTextRole`, falling back to `DisplayRole`, so screen readers hear nothing. The Sources list was fixed the same way the reporter mentions, by returning the name for `Qt::AccessibleTextRole` (`SourceTreeModel::data`). Setting that role on the filter list items is a small, self-contained fix.

**Evidence:**
- `frontend/dialogs/OBSBasicFilters.cpp:288-299` — item created with no text, then `SetupVisibilityItem`.
- `frontend/dialogs/OBSBasicFilters.cpp:1029-1030` — `listItem->setText(QString())` after rename, then `SetupVisibilityItem`.
- `frontend/components/VisibilityItemWidget.cpp:73-78` — `SetupVisibilityItem` only sets the item widget.
- `frontend/components/SourceTreeModel.cpp:250-256` — precedent: `Qt::AccessibleTextRole` returns source name.

**Slice plan:**
- In `SetupVisibilityItem` (`frontend/components/VisibilityItemWidget.cpp`), add `item->setData(Qt::AccessibleTextRole, QT_UTF8(obs_source_get_name(source)));`. This covers adding filters, reloading the list, and in-dialog renames, since all three call `SetupVisibilityItem`.
- Optional, same slice: `item->setData(Qt::AccessibleDescriptionRole, ...)` for the enabled state. Update it in `VisibilityItemWidget::SourceEnabled` and the checkbox `clicked` handler, using the existing `Enable`/`Disable` strings or a new locale key. Also give the `vis` checkbox an accessible name (`Basic.Main.Sources.Visibility`), matching `SourceTreeItem.cpp:83`.
- About 10–25 lines.
- Test: MSVC build of the frontend. Run with Narrator or NVDA on Windows, open the Filters dialog, and arrow through the filters. The names should be announced. Accessibility Insights / Inspect.exe can also show the Name property.

**Related:** none.

---

### [#11475](https://github.com/obsproject/obs-studio/issues/11475) — Cannot target window-less processes for audio capture

**Verdict:** DEFER_LARGE

**Reasoning:** This is a feature request (VMware `vmware-vmx.exe` has no window). The process-output source can only target a PID through an HWND picked by `ms_find_window`, and its saved settings are the window title/class/exe triple. Supporting window-less processes needs a new way to pick targets (process or audio-session enumeration), new settings, and match logic. The VMware case may also need tree-mode changes. That is a design change, not a small slice. It would also fix #9838 and #11073.

**Evidence:**
- `plugins/win-wasapi/win-wasapi.cpp:860-872` — target PID always from an HWND.
- `plugins/win-wasapi/win-wasapi.cpp:1587-1591` — properties built around window priority matching.

**Related:** 9838, 11073.

---

### [#11508](https://github.com/obsproject/obs-studio/issues/11508) — CPU usage higher with scaling resolution / multiple monitors

**Verdict:** CANNOT_VERIFY

**Reasoning:** Despite the audio area hint, this is about rendering/preview CPU on a hybrid Intel+NVIDIA multi-monitor setup running OBS 30.0.2. The workaround is a sequence of window moves and minimizes. It depends on the GPU/driver/DWM setup, with no log-based evidence or code location that explains it.

**Evidence:**
- No specific code path. The display/preview path depends on the adapter used by the window's monitor, which this machine can't reproduce.

**Related:** none.

---

### [#11640](https://github.com/obsproject/obs-studio/issues/11640) — Audio delay removed from media source after transition

**Verdict:** CANNOT_VERIFY

**Reasoning:** In scope, reproduced by the reporter on two OSes, and the steps are clear. Static reading shows `sync_offset` added to every audio packet's timestamp in `source_output_audio_data`, with a placement reset when the offset changes. For async sources, `timing_adjust` is re-derived from video frames in `obs_source_update_async_video`, and `handle_ts_jump`/`reset_audio_timing` re-base audio timing when the media restarts. The bug is probably in how video and audio timing re-sync after a restart, which can let video re-anchor to the offset audio. I could not find the exact faulty line without a debugger session, so I'm not calling it IMPLEMENT.

**Evidence:**
- `libobs/obs-source.c:1610-1694` — `source_output_audio_data` (sync_offset applied at :1675-1685).
- `libobs/obs-source.c:1491-1520` — `reset_audio_timing` / `handle_ts_jump`.
- `libobs/obs-source.c:2551-2565` — async video resets `timing_adjust` from frame timestamps.

**Related:** none.
