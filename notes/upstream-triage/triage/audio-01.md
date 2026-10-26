# Upstream triage: batch audio-01

- Batch: audio-01 (area hint: audio)
- Items: 5356, 5408, 5551, 5692, 5993, 6111, 6113, 6133, 6149, 6334, 6351, 6435, 6707, 7063, 7408, 7955, 8181, 8346
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: I read the item bodies from `notes/upstream-triage/data/all.json` and checked them against the code on master. I inspected PR heads at `refs/upstream-pr/N`. The local git is 2.33, which has no `merge-tree --write-tree`, so I tested whether each PR still applies with `git diff master...refs/upstream-pr/N | git apply --check`. That check does not change the tree. I used two WebFetch calls, on #8181 and #6133, to read their comment threads.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 5356 | issue | IMPLEMENT |
| 5408 | issue | CANNOT_VERIFY |
| 5551 | issue | CANNOT_VERIFY |
| 5692 | PR | DEFER_LARGE |
| 5993 | PR | DEFER_LARGE |
| 6111 | issue | CANNOT_VERIFY |
| 6113 | issue | ALREADY_ADDRESSED |
| 6133 | PR | DEFER_LARGE |
| 6149 | issue | IMPLEMENT |
| 6334 | issue | ALREADY_ADDRESSED |
| 6351 | PR | DEFER_LARGE |
| 6435 | issue | CANNOT_VERIFY |
| 6707 | issue | CANNOT_VERIFY |
| 7063 | issue | IMPLEMENT |
| 7408 | issue | CANNOT_VERIFY |
| 7955 | issue | OUT_OF_SCOPE |
| 8181 | issue | CANNOT_VERIFY |
| 8346 | issue | CANNOT_VERIFY |

---

### [#5356](https://github.com/obsproject/obs-studio/issues/5356) — Audio Sync Offset not working until UI control is touched (or randomly)

**Verdict: IMPLEMENT**

The reporter says a saved sync offset is often ignored after OBS starts. It takes effect once the value is changed in Advanced Audio Properties. I found the defect in `source_output_audio_data`:

- `libobs/obs.c:2293` creates the source with `obs_source_create_set_last_ver`. Audio capture threads such as WASAPI can start emitting audio at that point. The saved offset is applied later, at `libobs/obs.c:2313-2314` (`obs_source_set_sync_offset`). So the first audio packets can arrive while `sync_offset == 0`. The source's buffer is then anchored without the offset, and later packets go down the contiguous `push_back` path.
- `libobs/obs-source.c:1681-1685`: when the offset changes, re-placement is only forced if `source->last_sync_offset` was non-zero (`if (source->last_sync_offset) push_back = false;`). A change from 0 to N therefore keeps `push_back == true`. `source_output_audio_push_back` (`obs-source.c:1576-1591`) ignores timestamps entirely, so the offset is never applied. Re-placement only happens after some later buffer reset, which is where "randomly" comes from.
- Changing the value in the UI (N, then M, then N) makes `last_sync_offset` non-zero, which forces `source_output_audio_place`. That matches the reported workaround exactly.
- The condition dates from 41fa9c1bd (2016, "Don't include sync offsets in TS smoothing"). It looks meant to skip a forced placement on the very first packet. That case does not need it, because with `audio_ts == 0` the first packet is always placed anyway (`obs-source.c:1688`).

**Slice plan**
- In `libobs/obs-source.c` (~1681), always set `push_back = false` whenever `last_sync_offset != sync_offset`, including a change from 0. That is about a 2-line change. With no offset configured, `0 == 0` and behaviour is unchanged.
- Testing: build libobs and obs with MSVC. Runtime check: set a 300 ms offset on a mic, restart OBS, record a clap with the video visible, and check the A/V offset. If that cannot be done, mark the runtime check UNTESTED.

Related: none in this batch.

---

### [#5408](https://github.com/obsproject/obs-studio/issues/5408) — Canceling out of Audio Mixer source's "Properties" window kills audio for source

**Verdict: CANNOT_VERIFY**

The report concerns an Elgato HD60 S+ in a Video Capture Device (dshow) source, and it reproduces only "after a few tries". Cancel in the properties dialog restores the original settings, which calls `obs_source_update` and makes dshow re-activate the device. Losing audio on re-activation points to the device/driver or to libdshowcapture (a submodule), and I could not find a defect in OBS code. Reproducing it needs this specific capture hardware.

- `deps/libdshowcapture/src` is a submodule (`.gitmodules`).

Related: none.

---

### [#5551](https://github.com/obsproject/obs-studio/issues/5551) — VLC Video source: audio keeps playing when the source is in a group and the group is hidden

**Verdict: CANNOT_VERIFY**

Labelled confirmed upstream. The VLC source stops or pauses on `deactivate` (`plugins/vlc-video/vlc-video-source.c:975-997`, registered at 1157-1158). Hiding a group item goes through `set_visibility`, which calls `obs_source_remove_active_child` on the parent (`libobs/obs-scene.c:1096-1114`). Group children are also given item transitions by `group_item_transition` (`obs-scene.c:3002-3010`). From reading the code I could not find where the activation refcount leaks. It may be a libvlc media_list_player stop race, since a directory playlist is involved. I could not pin down a root cause without a runtime repro with libvlc installed.

Related: #6435 (also about active state and audio surviving visibility changes).

---

### [#5692](https://github.com/obsproject/obs-studio/pull/5692) — WIP: Fix audio glitch on automatic file splitting

**Verdict: DEFER_LARGE**

This draft PR duplicates boundary audio packets into both split files and offsets the audio PTS. The author lists unfinished parts: it only works when the video encoder has DTS < PTS (B-frames), it needs an audio ring buffer for the no-B-frame case, and it needs a user option. It also no longer applies: `git apply --check` fails on `plugins/obs-ffmpeg/obs-ffmpeg-mux.c` and `.h`. The current split logic lives at `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:689-700` (`should_split`) and `:736` (`prepare_split_file`), with audio offsets at `:362`. Finishing it is a design and feature task, not a small slice.

- `git diff master...refs/upstream-pr/5692 --stat`: 2 files, +37/-1, conflicts.

Related: none in this batch.

---

### [#5993](https://github.com/obsproject/obs-studio/pull/5993) — Fix random audio dropouts and corruption of audio data (2/2)

**Verdict: DEFER_LARGE**

This PR is a superset of #6133 (the `next_audio_ts_min` change). It also changes `audio_thread` and `input_and_output` in `libobs/media-io/audio-io.c` so that audio output is held back while any source has pending audio, and it adds `audio_pending` to `audio_callback` in `libobs/obs-audio.c`. It conflicts in all three files. This is a behaviour change to the core audio clock and it is contested. Reviewers on #6133 objected to the timestamp half (see #6133). The output-hold half changes how the audio thread is paced. Neither half can be validated without long soak tests across devices.

- Applies? No (conflicts in `audio-io.c`, `obs-audio.c`, `obs-source.c`).
- Current code: `libobs/obs-source.c:1630-1648` (timestamp smoothing).

Related: #6133, #6351.

---

### [#6111](https://github.com/obsproject/obs-studio/issues/6111) — Browser source alerts play audio only until "page permissions" is changed

**Verdict: CANNOT_VERIFY**

Changing any browser-source property, page permissions included, runs the source update and reloads the page. So the workaround is really "reload the page". The symptom (webm video and canvas not rendering, audio fine) points to a CEF and GPU/hardware-acceleration problem in the CEF build of that time (OBS 27.2.1), not to the permissions logic. The code lives in the `plugins/obs-browser` submodule (`.gitmodules`; permission handling at `plugins/obs-browser/browser-client.cpp:163-230`). CEF has been updated many times since. There is no actionable defect here.

Related: none.

---

### [#6113](https://github.com/obsproject/obs-studio/issues/6113) — OBS UI issues on dual monitors with different resolutions

**Verdict: ALREADY_ADDRESSED**

This was reported on 27.2.3, which used Qt 5 without per-monitor DPI v2 handling. The current frontend requires Qt 6 (`frontend/cmake/ui-qt.cmake:1`), which is per-monitor DPI aware on Windows by default. OBS also sets `Qt::HighDpiScaleFactorRoundingPolicy::PassThrough` on Windows (`frontend/obs-main.cpp:500-502`). The broken scaling and clipped menus when moving between a 4K and a 1080p-height monitor were a known Qt 5 limitation that the Qt 6 migration (OBS 28) resolved.

Related: #7408 (UI rendering, a different problem).

---

### [#6133](https://github.com/obsproject/obs-studio/pull/6133) — Fix random audio dropouts and corruption of audio data (1/2)

**Verdict: DEFER_LARGE**

This is a one-line change: compute `next_audio_ts_min` from the raw `data->timestamp` instead of the smoothed `in.timestamp`. The drift it describes is real in the code. At `libobs/obs-source.c:1648`, `next_audio_ts_min = in.timestamp + duration` accumulates from the smoothed value, so device/system clock drift builds up until it exceeds `TS_SMOOTHING_THRESHOLD` (`obs-source.c:1489`, 70 ms). That forces a placement and a glitch.

The upstream thread (WebFetch) shows the fix itself is contested:
- PatTheMav questioned whether the deviation is a device or subsystem issue.
- A 2026 Discord review concluded it effectively ignores timestamps after the first segment and could cause A/V drift.
- No tester has confirmed it fixes the dropouts.

The PR also no longer applies (conflict at `obs-source.c`; the line is now 1648). #6351 proposes a different approach to the same root cause. This needs a maintainer-level design choice and long soak testing, not a blind cherry-pick.

Related: #5993 (superset), #6351 (alternative approach).

---

### [#6149](https://github.com/obsproject/obs-studio/issues/6149) — Unvalidated parameters in Vulkan capture layer

**Verdict: IMPLEMENT**

The defect is confirmed in code. `OBS_CreateSwapchainKHR` adds `VK_IMAGE_USAGE_TRANSFER_SRC_BIT` to the application's `imageUsage` and calls `vkCreateSwapchainKHR` without first checking that the implied image parameters are supported. It only falls back after a failure (`plugins/win-capture/graphics-hook/vulkan-capture.c:1633-1639`). Under the Khronos validation layer this raises VUID-VkSwapchainCreateInfoKHR-imageFormat-01778, which makes the OBS hook look like an application bug. The needed query function is already resolved: `GetPhysicalDeviceImageFormatProperties2` is loaded at `vulkan-capture.c:1321` and used at `:1370` (`vk_shared_tex_supported`), the device keeps `phy_device` (`:113`, set at `:1443`), and instance funcs are reachable through `get_inst_funcs_by_physical_device` (`:762`).

**Slice plan**
- In `OBS_CreateSwapchainKHR`, before ORing in `TRANSFER_SRC`, call `ifuncs->GetPhysicalDeviceImageFormatProperties2` with:
  - `format = cinfo->imageFormat`, `type = 2D`, `tiling = OPTIMAL`, `usage = cinfo->imageUsage | TRANSFER_SRC`;
  - `flags` derived from `cinfo->flags`: `MUTABLE_FORMAT_BIT_KHR` maps to `MUTABLE_FORMAT | EXTENDED_USAGE`, `SPLIT_INSTANCE_BIND_REGIONS` maps to `SPLIT_INSTANCE_BIND_REGIONS`, and `PROTECTED` maps to `PROTECTED`.
- If the query does not return `VK_SUCCESS`, skip the modification and call through with the original `cinfo`. Capture of that swapchain then falls back the same way it does today when creation fails. Keep the existing retry-on-failure.
- Size: about 30 lines in one file.
- Testing: MSVC build of the `graphics-hook` target. Runtime validation needs a Vulkan app run with `VK_LAYER_KHRONOS_validation` while game capture hooks it. If no Vulkan SDK or app is available on this box, mark the runtime check UNTESTED.

Related: none.

---

### [#6334](https://github.com/obsproject/obs-studio/issues/6334) — AJA I/O source with KONA4: stereo SDI audio re-maps to 2.1

**Verdict: ALREADY_ADDRESSED**

In 27.2.4 the AJA source passed the card's 8-channel audio through, and OBS remapped it into the output layout, which produced the swapped and duplicated channels the reporter saw. Commit 003241511 (2022-06-20, "aja: Add audio channel selection to capture", after the reported version) added an explicit channel-format property, defaulting to 2 channels. It also added repacking from 8 channels to the selected layout, so stereo now maps channels 1 and 2 to L and R.

- `plugins/aja/aja-source.cpp:20` (`kDefaultAudioCaptureChannels = 2`), `:23-43` (`ConvertRepackFormat`, `SPEAKERS_STEREO` -> `repack_mode_8to2ch`), `:339-353` (repack before output), `:1025-1029` and `:1050` (property and default).

Related: none.

---

### [#6351](https://github.com/obsproject/obs-studio/pull/6351) — libobs: Implement asynchronous sample rate conversion for audio

**Verdict: DEFER_LARGE**

The PR still applies cleanly (`git apply --check` passes; it was rebased onto a 2026-02 base). It is a feature, though, not a small fix. It touches 20 files with +253 lines and adds:
- new public API (`obs.h`, `audio-resampler.h`, docs);
- a new lag-lead PLL filter header;
- swr soft compensation;
- a new user-facing option in each of six capture plugins (wasapi, pulse, alsa, mac, aja, decklink), enabled by default.

It changes audio timing for every device source and needs DSP and soak validation plus a maintainer decision on the API and the defaults. It is a better-designed answer to the root cause behind #6133 and #5993, but it is beyond a small slice.

Related: #6133, #5993.

---

### [#6435](https://github.com/obsproject/obs-studio/issues/6435) — Audio source's monitor stays active when visibility is off and the source has show/hide transitions

**Verdict: CANNOT_VERIFY**

Labelled confirmed. The repro is: toggle hide then show quickly while a hide/show transition is running, then switch to a scene without the source. Item transitions hold the source active through `obs_source_add_active_child(parent, transition)`, which is released only by a `transition_stop` signal handler (`libobs/obs-scene.c:4043-4052`, `:4054-4088`). Transitions only finish while they are being rendered, so a transition left mid-flight in a scene that is no longer shown may never fire `transition_stop`. The source then stays active, and monitoring stays active because the monitor captures all source audio (`libobs/audio-monitoring/win32/wasapi-output.c:398-404`). That is a plausible mechanism, but I could not show from code alone exactly which refcount or path leaks, and the fix (forcing item transitions to stop on scene deactivate) has side effects that need a runtime repro to validate.

Related: #5551.

---

### [#6707](https://github.com/obsproject/obs-studio/issues/6707) — More than 10 monitored media sources results in silent sources

**Verdict: CANNOT_VERIFY**

OBS has no limit on the number of monitors. Each monitored source creates its own shared-mode WASAPI render client (`libobs/audio-monitoring/win32/wasapi-output.c:373-397`, `audio_monitor_init_wasapi`), and the monitor list is unbounded (`libobs/obs.c:2971`). A hard cap at about 10 points to an endpoint or driver stream limit on the reporter's system (Windows 11, no log details pointing elsewhere). The only robust fix would be an architectural change: mix all monitored audio into a single render stream. That would also be DEFER_LARGE. As a bug in OBS code it cannot be verified.

Related: none.

---

### [#7063](https://github.com/obsproject/obs-studio/issues/7063) — libobs: Last audio appears when audio playback restarts

**Verdict: IMPLEMENT**

The report (by norihiro, a libobs contributor) shows that restarting a 44.1 kHz media file in a 48 kHz session first plays the tail of the previous playback. The 48 kHz file, which needs no resampling, does not do this. The code explains why:
- A source's resampler is recreated only when the input format, rate, or layout changes (`libobs/obs-source.c:4035-4037`, `reset_resampler` at `:3923-3952`).
- `audio_resampler_resample` keeps swr's internal delay line (`libobs/media-io/audio-resampler-ffmpeg.c:190-206`, `swr_get_delay`/`swr_convert`).
- When a media source stops and later resumes, the samples still buffered in swr from the end of the previous playback are emitted at the start of the new one.

**Slice plan**
- Add `uint64_t last_audio_in_end_ts` to `struct obs_source` (`libobs/obs-internal.h`, near `resample_offset` at :857).
- In `process_audio` (`libobs/obs-source.c` ~4031): if `source->resampler` exists and the incoming `audio->timestamp` differs from `last_audio_in_end_ts` by more than `TS_SMOOTHING_THRESHOLD` (or the timestamp goes backwards), call `reset_resampler(source, audio)` before resampling. This drops the stale swr state, which is at most a few ms of old audio.
- Then update `last_audio_in_end_ts = audio->timestamp + frames_to_ns(audio->samples_per_sec, audio->frames)`.
- Size: about 15-20 lines in 2 files.
- Testing: MSVC build of libobs. Runtime check with two media sources at 44.1k and 48k and the scene switching in the issue's steps. If that is not run, mark it UNTESTED.

Related: none.

---

### [#7408](https://github.com/obsproject/obs-studio/issues/7408) — Strobing on monitor

**Verdict: CANNOT_VERIFY**

The window flickers on a second monitor while a fullscreen game (League) runs, reported on 28.0.1. There is no log and no repro beyond that game and GPU setup. This is almost certainly a GPU, driver, compositor, or Qt 6 repaint interaction, and I found nothing in the code to change. The accessibility severity is noted (it reportedly triggered a seizure), but a fix needs a repro on matching hardware.

Related: #6113.

---

### [#7955](https://github.com/obsproject/obs-studio/issues/7955) — VSTs that generate audio don't work, or stop, on unused tracks

**Verdict: OUT_OF_SCOPE**

The user uses a VST filter (the ReaStream receiver) as an audio generator on a source that receives no audio. OBS audio filters run only on audio a source actually outputs, so a filter has no clock to run on when its parent source is silent. WASAPI loopback already keeps a silent render stream alive to avoid stalls (`plugins/win-wasapi/win-wasapi.cpp:774-796`, plus silence handling at :1044-1053), but an input device with no traffic produces no packets. Making filters generate audio without input would change the filter model. The intended use (receiving network audio) is better served by a source plugin, for example an NDI or ReaStream-style source.

Related: none.

---

### [#8181](https://github.com/obsproject/obs-studio/issues/8181) — Unable to select primary monitor despite OBS listing it

**Verdict: CANNOT_VERIFY**

Display capture identifies monitors by `EDD_GET_DEVICE_INTERFACE_NAME` device ID (`plugins/win-capture/duplicator-monitor-capture.c:188-209`), with a fallback to `szDevice` (`:212-232`, `find_monitor` at `:282-292`). The upstream thread (WebFetch) has 45 comments and no confirmed root cause. Users trace it to inactive but connected displays: a TV in standby, a disabled virtual display, or a WMR headset. Maintainers could not reproduce it. A pending upstream PR (#13788, Aug 2026) is awaiting testers, and an earlier attempt (#8081) did not fix it. The cause depends on hardware and the Windows display API.

Related: none in this batch (upstream PRs #8081 and #13788).

---

### [#8346](https://github.com/obsproject/obs-studio/issues/8346) — VLC video source cannot switch to another audio track

**Verdict: CANNOT_VERIFY**

The audio-track setting is passed to libvlc as the media option `:audio-track=<track-1>` (`plugins/vlc-video/vlc-video-source.c:537-540`, read at :618, default 1 at :1006). That is the documented zero-based index among audio tracks, so track 2 maps to index 1, which is correct. One quirk: media objects are reused across updates (`get_media` at :523-526) and options accumulate, but libvlc's later options override earlier ones. Without the specific file I cannot tell whether this is a libvlc demux issue, a problem with the file's second stream, or an OBS defect. Note that the bundled VLC runtime is user-installed.

Related: #5551 (also VLC).
