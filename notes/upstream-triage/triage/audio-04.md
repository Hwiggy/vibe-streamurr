# Upstream triage — batch audio-04

- Batch: audio-04 (area hint: audio)
- Items: 12803, 12857, 12919, 12973, 12974, 13027, 13175, 13266, 13272, 13297, 13314, 13335, 13429, 13759, 13815, 13824, 14044, 14091
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; PR heads from `refs/upstream-pr/<N>`.
  Local git is 2.33, which has no `merge-tree --write-tree`, so I checked whether each PR applies with
  `git diff master...refs/upstream-pr/N | git apply --check [-3]`, which does not write anything.
  I used 2 WebFetches, on #12974 and #12919, to read their comment threads.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 12803 | issue | CANNOT_VERIFY |
| 12857 | PR | IMPLEMENT (cherry-pick) |
| 12919 | issue | CANNOT_VERIFY |
| 12973 | issue | DEFER_LARGE |
| 12974 | PR | DEFER_LARGE |
| 13027 | issue | CANNOT_VERIFY |
| 13175 | issue | CANNOT_VERIFY |
| 13266 | issue | CANNOT_VERIFY |
| 13272 | issue | OUT_OF_SCOPE |
| 13297 | issue | IMPLEMENT (via PR #13759) |
| 13314 | PR | DEFER_LARGE |
| 13335 | PR | OUT_OF_SCOPE |
| 13429 | issue | DEFER_LARGE |
| 13759 | PR | IMPLEMENT (cherry-pick) |
| 13815 | PR | IMPLEMENT (cherry-pick) |
| 13824 | issue | CANNOT_VERIFY |
| 14044 | PR | DEFER_LARGE |
| 14091 | PR | IMPLEMENT (cherry-pick) |

---

### [#12803](https://github.com/obsproject/obs-studio/issues/12803) — Personalised Alerts in Browser Source Crackle when "Control Audio Via OBS" enabled
**Verdict: CANNOT_VERIFY**

The reporter hears crackling in a browser-source alert only when "Control audio via OBS" is enabled together with monitoring. That path goes through the obs-browser submodule (CEF audio handler) and then the monitoring code in libobs. The report has no reproducible test page, and Discord support could not diagnose it either. Nothing in the report points to a specific defect in the code, and the symptom depends on the reporter's own alert content and audio device.
- Evidence: `libobs/audio-monitoring/win32/wasapi-output.c:310-322`: browser sources have no video-synced async frames, so their audio skips `process_audio_delay`. I found no defect specific to this report.
- Related: none.

### [#12857](https://github.com/obsproject/obs-studio/pull/12857) — frontend: Add logging for not default audio tracks
**Verdict: IMPLEMENT (cherry-pick-pr)**

This is a small logging improvement for diagnostics. When a source does not use all six tracks, the scene-collection log now lists the tracks it does use, or "none". The PR also moves the existing "monitoring: enabled" line inside the `OBS_SOURCE_AUDIO` check. It is one commit, about 20 lines, in one file. Plain `git apply` fails only because master changed a nearby context line (the `- source:` log line now adds "(disabled)"). `git apply -3` applies it cleanly.
- Evidence: `frontend/widgets/OBSBasic_SceneCollections.cpp:1080-1087`: current `LogSceneItem` logs the source and its monitoring state but not its audio mixers.
- Related: none.
- Slice: cherry-pick `29ecff953` and resolve the context conflict, keeping master's "(disabled)" suffix. Files: `frontend/widgets/OBSBasic_SceneCollections.cpp`. About 23 lines.
- Test plan: build the `obs-studio` frontend with MSVC. Load a scene collection where some sources have reduced tracks and check that the log shows `- audio tracks: ...`.

### [#12919](https://github.com/obsproject/obs-studio/issues/12919) — Inputs with audio are not destroyed via websocket 'RemoveInput' on OBS 32.0.3+
**Verdict: CANNOT_VERIFY**

The reporter says that in 32.0.3 and later, removing an input with audio leaves a "ghost" that is still listed under Add Existing, which means the source was never destroyed. The audio mixer in master has since been rewritten. It holds only weak references (`VolumeControl` uses `OBSGetStrongRef(weakSource())`) and removes controls on `source_remove`/`source_destroy`. The comment thread, read via WebFetch, found no root cause from maintainers. One unsubmitted comment guessed at a late queued `source_audio_activate` re-adding a widget after removal. In master, `addControlForUuid` does not check `obs_source_removed()`. But that path does not keep a strong reference, so it cannot explain why the source is never destroyed. Without knowing what holds the leaked reference, there is no fix I can justify.
- Evidence: `frontend/widgets/AudioMixer.cpp:209-210` (remove/destroy signals), `:876-884` (`addControlForUuid` has no removed/null guard), `:1039-1051` (queued add on audio_activate); `libobs/obs.c:2053-2056`.
- Related: upstream #12712, #12880, #12882 (not in this batch).

### [#12973](https://github.com/obsproject/obs-studio/issues/12973) — Audio lag occurs when using audio monitor for long time on sources without video
**Verdict: DEFER_LARGE**

The defect is real and I can see it in the code. On Windows, sources without video never go through `process_audio_delay`, so nothing limits how much audio is queued in the WASAPI endpoint buffer. The shared-mode buffer is requested at 1 s (`10000000` hns). Clock drift between the OBS audio clock and the output device therefore builds up as latency, up to about 1 s. Maintainers on #12974 (norihiro, pkviet) prefer to fix this with dynamic resampling toward a target buffer level rather than dropping samples. PatTheMav suggested doing it once in libobs for all three backends (WASAPI, Pulse, CoreAudio). That is a design decision and a larger change, not a small slice.
- Evidence: `libobs/audio-monitoring/win32/wasapi-output.c:197` (1 s buffer), `:316-322` (delay processing only when `source_has_video`), `:73-80`.
- Related: #12974.

### [#12974](https://github.com/obsproject/obs-studio/pull/12974) — libobs/audio-monitoring: Add audio sync feature for audio-only playback
**Verdict: DEFER_LARGE**

The PR applies to master, but it is not a sound slice to carry:
1. It breaks the clang-format layout by turning tabs into spaces in macro continuations and comment banners. Reviewers flagged this repeatedly.
2. It cuts the WASAPI buffer from 1 s to 50 ms for every monitor, which risks underruns on slow devices. RytoEX said the long buffer was deliberate.
3. It handles drift by dropping or holding packets, while reviewers asked for resampling and for testing across many devices.
4. It is Windows-only.
The maintainers had not settled on an approach, so this waits for an upstream design.
- Evidence: `git diff master...refs/upstream-pr/12974` (108 lines in `libobs/audio-monitoring/win32/wasapi-output.c`); master `wasapi-output.c:197`, `:316-322`.
- Related: #12973.

### [#13027](https://github.com/obsproject/obs-studio/issues/13027) — Audio only on VOD with split audio feature disabled
**Verdict: CANNOT_VERIFY**

The reporter says the stream is intermittently silent while the VOD track still has audio. They have no reproduction steps ("no clue how to replicate"), and it involves the Twitch VOD-track / multitrack output configuration. Without a reproduction or a log showing where the track mapping goes wrong, I cannot tie it to code.
- Evidence: none specific. The report has only a log link and no steps.
- Related: none.

### [#13175](https://github.com/obsproject/obs-studio/issues/13175) — Audio Corruption
**Verdict: CANNOT_VERIFY**

Game Capture's "capture audio (beta)" becomes distorted after about 4 hours of streaming, and recapturing fixes it. This is a long-running timing problem in the win-capture-audio / application-audio path with no actionable stack trace or measurements. I cannot reproduce or pinpoint it from code.
- Evidence: none specific. The symptom is timing-dependent and environment-dependent.
- Related: possibly the same drift family as #12973, but that is unconfirmed.

### [#13266](https://github.com/obsproject/obs-studio/issues/13266) — Audio capture of Sound Alerts repeating through dedicated audio capture for OBS
**Verdict: CANNOT_VERIFY**

A third-party Sound Alerts browser page, captured with application audio capture on `obs-browser-page.exe`, repeats its sound. Refreshing the browser source stops it. That points to the web page or CEF behavior rather than OBS's capture code, and the reporter is unsure themselves. I found no defect in OBS that I can point to.
- Evidence: none. It depends on the behavior of third-party web content.
- Related: none.

### [#13272](https://github.com/obsproject/obs-studio/issues/13272) — Audio lagging/gaps/stuttering when Mic/Auxiliary audio is not disabled and sampling rate is 48 kHz
**Verdict: OUT_OF_SCOPE**

The report is against OBS 30.0.2 from Ubuntu's distro package (`30.0.2.1-3build1`), which is old, unofficial and unsupported upstream. The machine has no microphone plugged in. The reporter fixed it by disabling the unused Mic device and changing the sample rate, so this is a local PulseAudio/PipeWire device configuration problem rather than an OBS code defect. The privacy-policy remark is about the log website, not this repository.
- Evidence: issue body (distro build `30.0.2.1-3build1`; workaround is a configuration change).
- Related: none.

### [#13297](https://github.com/obsproject/obs-studio/issues/13297) — Audio Mixer preview doesn't show audio sources from groups or nested scenes
**Verdict: IMPLEMENT (via PR #13759)**

The defect is confirmed in code. `AudioMixer::updatePreviewSources` enumerates only the preview scene's direct items with `obs_scene_enum_items`. It never recurses into groups (`obs_source_is_group`) or nested scenes (`obs_source_is_scene`), so their audio sources are never added to `previewSources`. Upstream labels it issue/confirmed. PR #13759 is the fix.
- Evidence: `frontend/widgets/AudioMixer.cpp:394-450` (non-recursive lambda enumeration).
- Related: #13759.
- Slice: see #13759.

### [#13314](https://github.com/obsproject/obs-studio/pull/13314) — libobs: Add canvas audio mixes
**Verdict: DEFER_LARGE**

This is an architectural libobs feature: per-canvas audio mixes as groundwork for moving monitoring into a plugin. It is about 800 lines across 15 files, including public API in `obs.h` and the core audio mixing in `obs.c` and `obs-source.c`. The author has tested it only with the main canvas, and plain `git apply` fails on `libobs/obs.h` and `docs/sphinx/reference-canvases.rst`. It is far beyond a small slice.
- Evidence: `git diff master...refs/upstream-pr/13314 --stat` (591+/207-, 15 files).
- Related: none.

### [#13335](https://github.com/obsproject/obs-studio/pull/13335) — libobs: Cleanup local names in obs-audio-controls
**Verdict: OUT_OF_SCOPE (for this fork)**

The PR only renames identifiers (`fader_cb` to `fader_callback`, `m3` to `sinc_minus_03`, `peak` to `max_abs_per_lane`, and so on) and adds redundant zero-initializations in `obs-audio-controls.c`. The author says it changes no behavior, and the diff confirms that. It has 9 commits plus a merge commit. For a fork that tracks upstream, carrying about 115 lines of cosmetic churn in the volmeter's SIMD hot path only adds future merge conflicts and fixes nothing. Upstream has not merged it. If upstream takes it, we get it on the next sync.
- Evidence: `git diff master...refs/upstream-pr/13335` (only renames, plus `float r` changed to `float max_abs_sample = 0.0f`); `libobs/obs-audio-controls.c:39-72`, `:322-377`.
- Related: none.

### [#13429](https://github.com/obsproject/obs-studio/issues/13429) — Audio Filter window has no light or meter to show it is turned on
**Verdict: DEFER_LARGE**

This is a UX request from a usability study: show that an audio filter is active, for example with a meter or an indicator light, in the Filters dialog. Each filter already has an enable/visibility toggle (`VisibilityItemWidget`). Adding a live meter or before/after comparison means designing new UI and adding a volmeter to the dialog. That needs a design decision, not a small fix.
- Evidence: `frontend/dialogs/OBSBasicFilters.cpp:21` (`VisibilityItemWidget` toggle per filter), `:952` (`obs_source_set_enabled`).
- Related: none.

### [#13759](https://github.com/obsproject/obs-studio/pull/13759) — frontend: Mark nested audio sources as previewed
**Verdict: IMPLEMENT (cherry-pick-pr)**

This is the upstream fix for #13297, by a maintainer (Warchamp7). It replaces the lambda with a member function `enumPreviewSources` that recurses through `findAudioSourcesInScene` for scene and group items. It is one commit, +50/-38 lines in 2 files, and applies cleanly. The null checks on `previewScene` stay in place, and `obs_scene_enum_items` is also null-safe. A nested scene is enumerated under its own scene lock, as other frontend code already does.
- Evidence: `frontend/widgets/AudioMixer.cpp:394-450`; `libobs/obs-scene.c:2108-2113` (`obs_scene_enum_items` null guard).
- Related: #13297.
- Slice: cherry-pick `7e71ef3fc`. Files: `frontend/widgets/AudioMixer.cpp`, `frontend/widgets/AudioMixer.hpp`. About 88 lines.
- Test plan: MSVC build of the frontend. In Studio Mode, put a looping media source inside a group and inside a nested scene in the preview, and check that it shows up as preview in the mixer. A manual GUI check is possible on this machine.

### [#13815](https://github.com/obsproject/obs-studio/pull/13815) — frontend: show track label on hover in advanced audio settings
**Verdict: IMPLEMENT (cherry-pick-pr)**

This is a small UI tweak tied to an Ideas-portal request. In Advanced Audio Properties, each track checkbox gets a tooltip with the user's custom track name from `AdvOut/Track%dName`, falling back to the localized "Track N". The checkbox text and accessible name stay as they are. It also folds the six repeated mixer blocks into loops. It applies cleanly. The only problem is `trackIndex+1`, which fails clang-format and needs spaces.
- Evidence: `frontend/components/OBSAdvAudioCtrl.cpp:158-213` (repeated per-mixer setup, no tooltip); `frontend/settings/OBSBasicSettings.cpp:2175`, `:3583` (`AdvOut/Track1Name` config key).
- Related: none.
- Slice: cherry-pick `101befd8b` and `84b69ff10`, skip the merge commit `8f155c14f`, and run clang-format. Files: `frontend/components/OBSAdvAudioCtrl.cpp`. About 77 lines.
- Test plan: MSVC frontend build. Set custom track names in Settings > Output > Advanced > Audio, open Advanced Audio Properties, and hover a track checkbox.

### [#13824](https://github.com/obsproject/obs-studio/issues/13824) — Separate Audio Input Capture of Blackmagic Device renders mute
**Verdict: CANNOT_VERIFY**

On macOS, one Blackmagic model (UltraStudio Mini Recorder 12G) captured through CoreAudio "Audio Input Capture" meters and monitors fine but is silent in recordings and streams. Another model works with the same setup, which points at this device or its driver. Diagnosing it needs that hardware and macOS, so I cannot verify it here.
- Evidence: none specific. The issue body says the UltraStudio 4K Mini works and the 12G does not.
- Related: none.

### [#14044](https://github.com/obsproject/obs-studio/pull/14044) — media-playback: decouple video and audio playback
**Verdict: DEFER_LARGE**

The problem is real and visible in code. `mp_media_prepare_frames` returns early when `mp_decode_frame(&m->v)` fails, so an undecodable video GOP also stalls audio. `mp_media_ready_to_start` likewise needs both streams to be ready. The PR is small at 24 lines, but it changes start and scheduling semantics for every Media Source:
- playback starts once either stream is ready;
- negative `delta` between the two streams is allowed.
The author says they are unfamiliar with OBS internals, and upstream marks it "Seeking Testers". The risk to A/V sync on ordinary files is unknown and can only be judged with broad media testing and maintainer review. I am deferring it until upstream lands or reviews it.
- Evidence: `shared/media-playback/media-playback/media.c:195-202` (both streams required), `:268`, `:290` (an early return on video decode failure skips audio), `:508` (assert/clamp on negative delta).
- Related: none.

### [#14091](https://github.com/obsproject/obs-studio/pull/14091) — libobs: Fix monitoring for media with cover art
**Verdict: IMPLEMENT (cherry-pick-pr)**

This is a one-line fix with a clear root cause. In `process_audio_delay`, `prev_video_ts` is set only once, on the first call, and the `else` branch never updates it. After the first change of video timestamp, every later call resets `time_since_prev` to 0, so the "video stalled for more than 100 ms" escape (`bad_diff`) can never trigger again. When media with cover art (a single still frame) restarts, the cover frame gets a new `last_frame_ts`. Audio then looks like it is rushing ahead of a frozen video timestamp and is held back forever, so monitoring goes silent. The PR stores `last_frame_ts` in that branch. The logic exists only in the Windows backend.
- Evidence: `libobs/audio-monitoring/win32/wasapi-output.c:73-80` (missing `prev_video_ts` update), `:85-97` (`bad_diff` / rushing check); the grep for `prev_video_ts` hits only this file.
- Related: upstream #9428, #11739 (not in batch); #12973/#12974 change the same function.
- Slice: cherry-pick `56a4cd441` (its subject says "libsobs", which is a typo for "libobs"; keep authorship). Files: `libobs/audio-monitoring/win32/wasapi-output.c`. 1 line.
- Test plan: MSVC build of libobs and the frontend on Windows. Monitor an MP3 with embedded cover art, toggle its visibility or restart it, and check that monitoring audio keeps playing. A manual test is possible on this machine.
