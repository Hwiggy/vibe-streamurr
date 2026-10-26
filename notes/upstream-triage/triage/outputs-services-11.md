# Triage batch outputs-services-11

- Batch: `outputs-services-11` (area hint: outputs-services)
- Items: 13812, 13819, 13830, 13853, 13856, 13860, 13875, 13883, 13926, 13927, 13970, 13980, 14020, 14050, 14051, 14052, 14057, 14079
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item body from `data/all.json` + reading current code. No comment threads were read (no WebFetch used).
  PR applicability: the local git (2.33) has no `merge-tree --write-tree`, so the legacy three-way
  `git merge-tree $(git merge-base master PR) master PR` was used and scanned for conflict markers.

## Policy note for rtmp-services service-list PRs (13883, 13926, 13980, 14020)

Adding or changing third-party service entries is a curation and partner matter that upstream handles
(the service-list policy and, for Enhanced Broadcasting, a partner config endpoint). In this fork it also has
little effect: `services.json` is replaced at runtime by the upstream remote copy whenever upstream's package
version is higher (`ENABLE_SERVICE_UPDATES` defaults ON, `plugins/rtmp-services/CMakeLists.txt:3`; updater
created in `plugins/rtmp-services/rtmp-services-main.c:107-115` pointing at
`https://obsproject.com/obs2_update/rtmp-services`, `CMakeLists.txt:7`). A fork-local service entry would be
overwritten by the next upstream service update. So these are OUT_OF_SCOPE for the fork. Users can still use
"Custom..." for any of these services.

---

### [#13812](https://github.com/obsproject/obs-studio/pull/13812) — libobs: Fix audio transitions with output scaling

**Verdict: IMPLEMENT** (cherry-pick-pr)

When an encoder uses output scaling, libobs creates an encoder-only video mix that shares the main mix's view
(`mix->view = current_mix->view`). `audio_callback()` walks every mix and enumerates each view's channels, so
the same view's source tree is walked twice. Since the duplicate-detection change (50cdabbb5), the second walk
makes `push_audio_tree2()` see every individual audio source as "already present". It marks them
`audio_is_duplicated` and pushes them as root nodes, so they are mixed directly instead of through the
transition. The result is a hard audio cut in place of a crossfade when rescaling is on (issue #12912). The PR
skips any mix whose view was already processed by an earlier mix. The diff is small (12+/3-) and merges cleanly
(the file was changed on both sides but there are no conflict markers).

Evidence:
- `libobs/obs-encoder.c:312-314`: encoder-only mix is created with `mix->view = current_mix->view` (shared view).
- `libobs/obs-audio.c:576-604`: loop over `obs->video.mixes` enumerates `view->channels` for every mix and calls `obs_source_enum_active_tree(source, push_audio_tree2, audio)`.
- `libobs/obs-audio.c:59-82`: `push_audio_tree2` treats a second sighting as a duplicate: it sets `audio_is_duplicated = true` and pushes the source into `root_nodes`.
- `git log`: 50cdabbb5 "libobs: Fix audio duplication" introduced the tagging.

Related: #12912 (the issue it fixes; not in this batch).

Slice plan: cherry-pick `refs/upstream-pr/13812` (4686a8c2a) onto the work branch. One file, `libobs/obs-audio.c`, about 15 lines.
Edge note: the main mix is always created before an encoder-only mix, so the first mix that has the view, which is the
one with `mix_audio`, is the one that gets processed. Test: build libobs plus obs-studio on Windows x64. A manual
check is possible here: two scenes, each with a media source playing audio, a 5 s Fade transition, and the
encoder "Rescale Output" option. The audio should fade rather than cut.

---

### [#13819](https://github.com/obsproject/obs-studio/issues/13819) — Twitch Stream Information dock is a web page and is unusable with a screen reader

**Verdict: DEFER_LARGE**

The Twitch "Stream Information" dock is a `BrowserDock` that loads Twitch's own dashboard popout page. Its
accessibility depends on Twitch's web page and on CEF/obs-browser. YouTube has a native Qt dialog
(`OBSYoutubeActions`) because OBS implements the YouTube Data API calls itself. The reporter suggests three fixes:
- A native Twitch dialog for title, category and tags. This needs a new Helix API client, OAuth scopes, a category search and a new dialog, so it is a feature, not a slice.
- A "focus dock" hotkey. This is a UX design decision for upstream.
- Dropping `WS_EX_TOOLWINDOW` from floating docks. That style comes from Qt's `QDockWidget` floating-window behavior (Qt::Tool) and changing it affects every dock.

All three are valid accessibility asks, but each needs design work.

Evidence:
- `frontend/oauth/TwitchAuth.cpp:335-350`: the Stream Info dock is a `BrowserDock` for `https://dashboard.twitch.tv/popout/u/<name>/stream-manager/edit-stream-info`.
- `frontend/oauth/TwitchAuth.cpp:245-281`: the chat dock follows the same web-page pattern.
- `frontend/dialogs/OBSYoutubeActions.cpp`: the native YouTube dialog exists only because of the YouTube API wrappers (`frontend/utility/YoutubeApiWrappers.cpp`).

Related: none in batch.

---

### [#13830](https://github.com/obsproject/obs-studio/issues/13830) — Video Delay (Async) filter degrades recorded audio at multi-second delays

**Verdict: DEFER_LARGE**

The report is detailed and probably valid. The async delay filter also delays the audio. It queues audio
packets and re-emits them with their original, now old timestamps. The reported failure threshold (fine at 2 s,
broken at 4 s and above) matches libobs' `MAX_TS_VAR` (2 s). In `source_output_audio_data()`, timestamps within
2 s of `os_gettime_ns()` are treated as "direct" timestamps. Beyond 2 s, the timing-adjust, jump-handling and
reset paths are used instead (`reset_audio_timing`, `handle_ts_jump`), which can produce repeated resyncs and
broken audio. The memory growth is expected, because the filter stores uncompressed video frames for the whole
delay. A real fix needs a design decision. Options are rebasing delayed audio timestamps in the filter, making
the filter stop delaying audio (its own header comment says delaying audio "shouldn't be necessary"), or
changing core audio timing thresholds. Each has A/V-sync side effects for every async source, and there is no
safe one-liner. The reporter's workaround (the Render Delay filter) exists.

Evidence:
- `plugins/obs-filters/async-delay-filter.c:5-6`: comment says delaying audio shouldn't be necessary.
- `plugins/obs-filters/async-delay-filter.c:180-221`: audio is queued and returned with its original timestamp once `interval` is reached.
- `plugins/obs-filters/async-delay-filter.c:123`: delay range 0 to 20000 ms.
- `libobs/obs-internal.h:1068`: `#define MAX_TS_VAR 2000000000ULL` (2 s), matching the onset of the problem.
- `libobs/obs-source.c:1619-1673`: direct-timestamp detection and the reset paths keyed on `MAX_TS_VAR`.

Related: none in batch (the reporter cites upstream #4600, #9566 and #6673).

---

### [#13853](https://github.com/obsproject/obs-studio/issues/13853) — SRT reading via media source uses old/incorrect URL or streamid in 32.2.2

**Verdict: CANNOT_VERIFY**

The reporter calls this a regression between 32.1.2 and 32.2.2. Between those tags, no OBS source changed in
the media source or media-playback code paths. The diff touches CI, formatting, deps presets and the frontend
FFmpeg utilities only. The most recent functional media-source change for SRT (3d30a4efe, removing the mpegts
format override) predates 32.1. The behavior ("reads from an old URL or streamid") points to the bundled
FFmpeg/libsrt dependency update, or to a stale settings or cache issue we cannot reproduce here, rather than to
an identifiable defect in OBS code. It needs a reproduction with an SRT sender.

Evidence:
- `git log 32.1.2..32.2.2 -- plugins/obs-ffmpeg shared/media-playback`: only CI, clang-format and brace-style commits.
- `git diff --stat 32.1.2 32.2.2`: `CMakePresets.json` and `build-aux/com.obsproject.Studio.json` changed (dependency versions).
- `git log -- plugins/obs-ffmpeg/obs-ffmpeg-source.c`: 3d30a4efe "obs-ffmpeg: Remove mpegts format override for SRT and RIST" is older.

Related: none.

---

### [#13856](https://github.com/obsproject/obs-studio/issues/13856) — Two confirmed bugs in the YouTube broadcast dialog (language not sent; Auto-stop not saved)

**Verdict: IMPLEMENT** (new-change, bug 2 only)

Bug 2 is confirmed in the code. `OBSYoutubeActions::SaveSettings()` writes the "AutoStop" key from
`broadcast.auto_start`, a copy-paste error, and the load path reads "AutoStop" back into the Auto-stop checkbox.
That is a one-token fix.

Bug 1 (stream language always English) is not a small slice. The YouTube liveBroadcast resource has no
language field. Setting it means updating the bound video resource (`snippet.defaultLanguage` and
`defaultAudioLanguage` through `videos.update`), mapping the OBS locale to a BCP-47 tag, and probably adding a
UI choice. That is deferred, so only bug 2 is implemented. The reporter's earlier PRs (#13185 and #13854) are
closed upstream and the reporter says they don't plan to resubmit.

Evidence:
- `frontend/dialogs/OBSYoutubeActions.cpp:637-638`: `config_set_bool(..., "AutoStart", broadcast.auto_start);` followed by `config_set_bool(..., "AutoStop", broadcast.auto_start);` (the bug).
- `frontend/dialogs/OBSYoutubeActions.cpp:684`: `autoStop = config_get_bool(..., "AutoStop")` is loaded back into the UI.
- `frontend/utility/YoutubeApiWrappers.cpp:293`: `hl=` is used only for the category list, and no language is sent on broadcast insert.

Related: #13185, #13854 (closed upstream PRs).

Slice plan: in `frontend/dialogs/OBSYoutubeActions.cpp:638`, change `broadcast.auto_start` to `broadcast.auto_stop` (1 line).
Test: build the frontend with MSVC. A runtime check needs a linked YouTube account, so mark the runtime behavior UNTESTED unless one is available.

---

### [#13860](https://github.com/obsproject/obs-studio/issues/13860) — OBS initializing HDMI capture cards at 44.1 kHz and causing havoc on the USB bus

**Verdict: CANNOT_VERIFY**

win-dshow does not pick the sample rate. It takes whatever format libdshowcapture negotiates with the device's
DirectShow audio pin and passes `config.sampleRate` to libobs, which resamples to the output rate (48 kHz) in
any case. A 44.1 kHz input is therefore not a defect by itself. The symptoms ("Max audio buffering reached",
"audio is lagging … Restarting source audio") point to timestamp or clock problems in this specific AVerMedia
device or driver. The reporter's own workaround (disabling the separate audio filter) supports that. This is
device-specific and cannot be justified or reproduced from code here. Forcing 48 kHz pin negotiation would be a
libdshowcapture submodule change with an unknown effect on other devices.

Evidence:
- `plugins/win-dshow/win-dshow.cpp:671`: `audio.samples_per_sec = (uint32_t)config.sampleRate;` (the device-negotiated rate is passed through).
- `plugins/win-dshow/win-dshow.cpp:1023-1070`: audio config uses the separate audio filter. The rate is only logged and not requested.

Related: none.

---

### [#13875](https://github.com/obsproject/obs-studio/pull/13875) — frontend: Fix Streamlabs sync offset overflow

**Verdict: IMPLEMENT** (cherry-pick-pr)

The Streamlabs importer computes the sync offset in nanoseconds into an `int`. Any offset above about ±2.147 s
overflows, and the UI allows up to 20 s. libobs stores sync offsets as `int64_t`. The PR computes in `int64_t`
and serializes as a double, because json11 has no int64 constructor. json11 prints whole doubles without a
decimal point, so the value reads back as an integer. The diff is 4+/2- and merges without conflict.

Evidence:
- `frontend/importers/sl.cpp:271`: `int sync = (int)(in_sync["sec"].number_value() * 1000000000 + in_sync["nsec"].number_value());`
- `frontend/importers/sl.cpp:309`: `{"sync", sync}` is written into the imported collection.
- `libobs/obs-source.c:4583`: `obs_source_set_sync_offset(obs_source_t *source, int64_t offset)`.

Related: none.

Slice plan: cherry-pick 8e91c4f90 (`frontend/importers/sl.cpp`). Test: MSVC build of the frontend. Optionally import a
hand-made Streamlabs JSON with `syncOffset {sec: 3, nsec: 0}` and check that the source sync shows 3000 ms.

---

### [#13883](https://github.com/obsproject/obs-studio/pull/13883) — rtmp-services: Add MyVideoSpot

**Verdict: OUT_OF_SCOPE**

This is a new third-party service entry, which upstream curates under its service-list policy. In this fork the
local `services.json` is superseded by upstream's remote service updates (see the policy note above). It also
conflicts on `package.json` (version bump). Users can use "Custom..." with `rtmp://streaming.myvrspot.com/mvs`.

Evidence:
- `plugins/rtmp-services/CMakeLists.txt:3,7`: `ENABLE_SERVICE_UPDATES` ON, with an upstream update URL.
- `plugins/rtmp-services/rtmp-services-main.c:107-115`: the remote updater.
- `plugins/rtmp-services/data/package.json:4`: master is at version 295, and the PR's bump conflicts.

Related: #13926, #14020, #13980 (same policy).

---

### [#13926](https://github.com/obsproject/obs-studio/pull/13926) — Add Yandex Cloud Video

**Verdict: OUT_OF_SCOPE**

Same reasoning as #13883. This is a new third-party service listing with a 76-line services.json addition, and
upstream service-list policy decides it. A fork-local entry would be overridden by remote updates. It merges
cleanly, but the decision belongs to upstream curation.

Evidence: `plugins/rtmp-services/rtmp-services-main.c:107-115`, `plugins/rtmp-services/CMakeLists.txt:3`.

Related: #13883, #14020, #13980.

---

### [#13927](https://github.com/obsproject/obs-studio/pull/13927) — rtmp-services: Remove defunct recommended output field

**Verdict: IMPLEMENT** (partial-pr)

This is a maintainer-authored cleanup. The `recommended.output` field is not read by any C code (a grep of
`plugins/rtmp-services/*.c` and the frontend finds no `"output"` lookup). The schema calls it "Unused since OBS
Studio 30". Two services still set it, and the schema's conditional rule that requires it for non-RTMP protocols
blocks WHIP service entries (#12033). The only conflict is the `package.json` version bump: master moved to 295.
The schema and services.json hunks merge cleanly.

Evidence:
- `plugins/rtmp-services/data/services.json:98`: `"output": "ffmpeg_hls_muxer"` (YouTube HLS).
- `plugins/rtmp-services/data/services.json:2470`: `"output": "rtmp_output"`.
- `plugins/rtmp-services/data/schema/service-schema-v5.json` (around lines 120 and 233): the field definition and the "Require recommended output field" conditional.
- Grep: no reader of `"output"` in `plugins/rtmp-services/*.c` or `frontend/settings/OBSBasicSettings_Stream.cpp`.

Related: #12033 (WHIP services, not in batch).

Slice plan: take the `services.json` and `service-schema-v5.json` hunks of 28221e3aa. Drop the `package.json` hunk
and do not bump the version: there is no runtime effect, and a fork bump would only fight the remote updater.
About 17 lines removed. Test: validate `services.json` against `service-schema-v5.json` with a JSON-schema
validator (Python `jsonschema`, if available), and build rtmp-services.

---

### [#13970](https://github.com/obsproject/obs-studio/issues/13970) — WHIP output: video RTP timestamps run ~66.6 ppm fast at 23.976 fps

**Verdict: IMPLEMENT** (new-change)

The root cause is confirmed in the code. For each video packet, `WHIPOutput::Data()` computes
`duration = dts_usec - lastVideoTimestamp`. `Send()` converts that duration to 90 kHz ticks with
`secondsToTimestamp()`, which rounds to the nearest tick, and adds the result to the running RTP timestamp. At
24000/1001 fps each frame is about 3753.75 ticks and always rounds to 3754, so the rounding error accumulates
(+66.6 ppm; at 59.94 fps the drift is -111 ppm). `videoLayerState` is value-initialized, so `rtpTimestamp` and
`lastVideoTimestamp` start at 0 and the RTP timestamp is effectively meant to be `ticks(dts_usec)`. Deriving it
directly from the absolute `dts_usec` with 64-bit integer math removes the accumulation and needs no
libdatachannel change. Audio is unaffected (exactly 960 ticks per 20 ms Opus frame) and can stay as is.

Evidence:
- `plugins/obs-webrtc/whip-output.cpp:124-134`: per-layer state, duration from dts deltas, and the RTP timestamp carried forward.
- `plugins/obs-webrtc/whip-output.cpp:706-713`: `elapsed_timestamp = rtp_config->secondsToTimestamp(elapsed_seconds); rtp_config->timestamp += elapsed_timestamp;` (rounded steps are summed).
- `plugins/obs-webrtc/whip-output.cpp:71`: `std::make_shared<videoLayerState>()`, so fields start at zero.
- `plugins/obs-webrtc/whip-output.h:17-23`: `videoLayerState` fields.

Related: none.

Slice plan (about 20 to 30 lines, `plugins/obs-webrtc/whip-output.cpp` and maybe `.h`):
- In the video branch of `Data()`, compute
  `uint64_t ticks = ((uint64_t)packet->dts_usec * clockRate + 500000) / 1000000` (`clockRate` from `rtp_config->clockRate`, which is 90000).
  Then set `rtp_config->timestamp = (uint32_t)ticks`, so it wraps mod 2^32 as RTP requires. Guard against a negative `dts_usec` by clamping at 0.
- Pass a zero duration to `Send()`, or add a `Send` overload that does not advance the timestamp. Keep the audio path unchanged.
- Keep the `RTC_VERSION < 0.23` SR-report logic working, because it reads `rtp_config->timestamp` after the update.

Test: MSVC build of obs-webrtc only (whether it builds depends on libdatachannel in the deps). The behavior needs a
WHIP server such as MediaMTX and RTP capture, so mark it UNTESTED at runtime. Reasoning about the arithmetic
can be checked with a scratch script.

---

### [#13980](https://github.com/obsproject/obs-studio/pull/13980) — rtmp-services: Update Restream service

**Verdict: OUT_OF_SCOPE**

This is a service-owner update. It adds Enhanced Broadcasting (`multitrack_video_configuration_url` pointing at
Restream's config endpoint, which is a partner integration) and reshuffles the ingest list. The ingest list is
delivered to users by the upstream remote updater, and Enhanced Broadcasting enablement is a partner agreement
decision. Neither belongs in a private fork.

Evidence:
- `plugins/rtmp-services/data/services.json:392-460`: the current Restream.io entry.
- `plugins/rtmp-services/rtmp-services-main.c:107-115`: the remote updater.

Related: #13883, #13926, #14020.

---

### [#14020](https://github.com/obsproject/obs-studio/pull/14020) — rtmp-services: Add OneStream Live

**Verdict: OUT_OF_SCOPE**

This is a new third-party service listing (156 lines across many regional servers). Same policy reasoning as
#13883. The branch also contains four merge-from-master commits, against upstream's "no merge commits" rule.

Evidence: `plugins/rtmp-services/rtmp-services-main.c:107-115`; `git log master..refs/upstream-pr/14020` shows 4 merge commits.

Related: #13883, #13926, #13980.

---

### [#14050](https://github.com/obsproject/obs-studio/pull/14050) — libobs, frontend: Don't crash on NULL output id

**Verdict: IMPLEMENT** (cherry-pick-pr)

There is a real defect. In `OBSBasicSettings_Stream.cpp` four call sites declare `const char *output;`
uninitialized and then call `obs_enum_output_types_with_protocol()`. That function returns early, without
invoking the callback, when the protocol isn't registered, for example SRT or RIST when the obs-ffmpeg mpegts
output isn't built. The uninitialized pointer then reaches
`obs_get_output_supported_*_codecs()` → `find_output()` → `strcmp`, which crashes (#12843). The PR's net diff is
frontend-only, because its second commit dropped the libobs `find_output` NULL check. The diff:
- initializes `output = nullptr` and bails out or skips when the protocol has no output;
- makes `FindProtocol()` return SRT or RIST only when that protocol is registered.

Both commits together are 21+/10- in one file, with no conflicts.

Evidence:
- `frontend/settings/OBSBasicSettings_Stream.cpp:1464,1499,1668,1676`: `const char *output;` (uninitialized).
- `frontend/settings/OBSBasicSettings_Stream.cpp:1436-1442`: `return_first_id` is the only writer.
- `libobs/obs-output.c:3271-3274`: `obs_enum_output_types_with_protocol` returns early if the protocol isn't registered.
- `libobs/obs-output.c:122-129`: `find_output` calls `strcmp(..., id)` without a NULL check.

Related: #12843 (the issue it fixes; not in this batch).

Slice plan: cherry-pick 1f80dd49b and ad9405c15 (net change: `frontend/settings/OBSBasicSettings_Stream.cpp` only).
Optionally also add `if (!id) return NULL;` in `libobs/obs-output.c:find_output` as defense in depth.
Test: MSVC build of the frontend, then open Settings > Stream with a Custom server `srt://...` in a build
without SRT output support, if one can be arranged. Otherwise mark the runtime check UNTESTED.

---

### [#14051](https://github.com/obsproject/obs-studio/issues/14051) — Automatic File Splitting (by time) not splitting Hybrid MP4 files

**Verdict: IMPLEMENT** (fixed by #14052, cherry-pick)

The root cause is confirmed. `should_split()` in the hybrid MP4 output splits on time only if a keyframe's runtime
is within ±1 ms of `max_time` (`llabs(...) < 1000`). With a 60 fps frame grid and typical keyframe intervals, no
keyframe lands within 1 ms of the target, and once the runtime passes `max_time + 1 ms` the condition can never
be true again. The ffmpeg-mux path uses `>=`. Splitting by size and manual splitting are unaffected, which
matches the report.

Evidence:
- `plugins/obs-outputs/mp4-output.c:351-356`: `return llabs(out->max_time - current_runtime) < 1000LL;`
- `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:707`: `packet->dts_usec - stream->cur_time >= stream->max_time` (the correct comparison elsewhere).

Related: #14052.

Slice plan: see #14052.

---

### [#14052](https://github.com/obsproject/obs-studio/pull/14052) — obs-outputs: Fix Hybrid MP4 not splitting by time

**Verdict: IMPLEMENT** (cherry-pick-pr)

A one-line fix that drops `llabs`, so the check becomes `max_time - current_runtime < 1000`. That means "the
runtime has reached `max_time - 1 ms` or more", which keeps the 1 ms tolerance and splits at the first keyframe
past the limit. It is consistent with the ffmpeg-mux behavior and merges cleanly.

Evidence: `plugins/obs-outputs/mp4-output.c:355`; `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:707`.

Related: #14051.

Slice plan: cherry-pick 22d4c44f6 (1 line in `plugins/obs-outputs/mp4-output.c`). Test: MSVC build of obs-outputs.
Then run OBS, record Hybrid MP4 with split-by-time set to 1 min for about 2.5 min at 60 fps and keyframe interval
auto, and expect 3 files. This is feasible on this Windows box with an x264 encoder.

---

### [#14057](https://github.com/obsproject/obs-studio/pull/14057) — obs-outputs: Use correct source of framerate for FLV mux

**Verdict: IMPLEMENT** (cherry-pick-pr)

There is a real defect. `video_output_get_frame_rate()` walks up to the root `video_t` (`get_const_root`). An
encoder using an FPS divisor gets a child `video_t` whose `info.fps_den` is multiplied by the divisor, so the FLV
`onMetaData` `framerate` field reports the parent rate, for example 60 instead of 30. The PR reads the encoder's
own `video_output_get_info(video)` instead. Other muxers already do this (mp4-mux, flv-output, rtmp-stream). It
merges cleanly. It was authored by a maintainer (tt2468), who reproduced the bug.

Evidence:
- `plugins/obs-outputs/flv-mux.c:215`: `enc_num_val(&enc, end, "framerate", video_output_get_frame_rate(video));`
- `libobs/media-io/video-io.c:606-614`: `video_output_get_frame_rate` uses `get_const_root(video)`.
- `libobs/media-io/video-io.c:660-671`: the divisor child sets `new_video->info.fps_den *= divisor`.
- `plugins/obs-outputs/mp4-mux.c:613`, `plugins/obs-outputs/rtmp-stream.c:841`: these use `video_output_get_info`.

Related: upstream #14056 (closed, the original report and fix).

Slice plan: cherry-pick c20028a39 (`plugins/obs-outputs/flv-mux.c`, 2+/1-). Consider a NULL guard on `voi`
(`video_output_get_info` returns NULL for a NULL video). The old function returned 0.0 in that case. Test: MSVC
build of obs-outputs. Runtime with an FPS divisor needs a code modification or a multitrack setup, so mark that UNTESTED.

---

### [#14079](https://github.com/obsproject/obs-studio/issues/14079) — VDO.Ninja conference sound not recorded via Browser Source with "Control audio via OBS"

**Verdict: CANNOT_VERIFY**

The report is sparse. It describes the mixer meter showing activity followed by a "grey" segment, with no
audio in the recording. That most likely means the source is muted or not assigned to the recording track, or
it is behavior inside obs-browser and VDO.Ninja's audio routing (the browser-source "reroute audio" path lives in
the obs-browser submodule). There is no stack, no track configuration and nothing in the body that points at a
defect in OBS core recording code.

Evidence:
- The body gives only the reproduction steps "set up VDO.Ninja call, check Control audio via OBS". No settings or track assignment is described.
- Browser-source audio capture is implemented in the `plugins/obs-browser` submodule, not in core.

Related: none.

---

## Summary

| # | Kind | Verdict |
|---|---|---|
| 13812 | PR | IMPLEMENT (cherry-pick) |
| 13819 | issue | DEFER_LARGE |
| 13830 | issue | DEFER_LARGE |
| 13853 | issue | CANNOT_VERIFY |
| 13856 | issue | IMPLEMENT (AutoStop one-liner only) |
| 13860 | issue | CANNOT_VERIFY |
| 13875 | PR | IMPLEMENT (cherry-pick) |
| 13883 | PR | OUT_OF_SCOPE |
| 13926 | PR | OUT_OF_SCOPE |
| 13927 | PR | IMPLEMENT (partial: drop package.json bump) |
| 13970 | issue | IMPLEMENT (new change in whip-output.cpp) |
| 13980 | PR | OUT_OF_SCOPE |
| 14020 | PR | OUT_OF_SCOPE |
| 14050 | PR | IMPLEMENT (cherry-pick) |
| 14051 | issue | IMPLEMENT (via #14052) |
| 14052 | PR | IMPLEMENT (cherry-pick) |
| 14057 | PR | IMPLEMENT (cherry-pick) |
| 14079 | issue | CANNOT_VERIFY |
