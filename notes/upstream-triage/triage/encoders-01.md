# Upstream triage — batch encoders-01

- Batch: encoders-01 (area hint: encoders; several items are actually media-source / muxer / AJA)
- Items: 4103, 6239, 6638, 6673, 6687, 6739, 7530, 7635, 7867, 7940, 8094, 8451, 8766, 8795, 8804, 8898, 9017, 9571, 9628
- Date: 2026-10-26
- Base commit: `72e866557` (master)
- Method: item bodies from `notes/upstream-triage/data/all.json`; PR heads from `refs/upstream-pr/<N>`.
  Conflict check: local git is 2.33 (no `merge-tree --write-tree`), so the legacy
  `git merge-tree $(git merge-base master PR) master PR` was used and `+<<<<<<<` markers counted.
  Note that `UI/` was renamed to `frontend/` and `deps/media-playback` to `shared/media-playback` upstream,
  so the legacy merge-tree count understates real conflicts for PRs that touch those paths.
  No WebFetch was used; no comment threads consulted.

## Summary

| # | Kind | Verdict |
|---|------|---------|
| 4103 | PR | DEFER_LARGE |
| 6239 | PR | DEFER_LARGE |
| 6638 | Issue | CANNOT_VERIFY |
| 6673 | Issue | CANNOT_VERIFY |
| 6687 | PR | DEFER_LARGE |
| 6739 | PR | DEFER_LARGE |
| 7530 | Issue | IMPLEMENT |
| 7635 | Issue | CANNOT_VERIFY |
| 7867 | Issue | CANNOT_VERIFY |
| 7940 | PR (draft) | DEFER_LARGE |
| 8094 | PR (draft) | DEFER_LARGE |
| 8451 | Issue | CANNOT_VERIFY |
| 8766 | PR | DEFER_LARGE |
| 8795 | PR | DEFER_LARGE |
| 8804 | Issue | CANNOT_VERIFY |
| 8898 | Issue | CANNOT_VERIFY |
| 9017 | Issue | CANNOT_VERIFY |
| 9571 | PR | IMPLEMENT |
| 9628 | Issue | ALREADY_ADDRESSED |

---

### [#4103](https://github.com/obsproject/obs-studio/pull/4103) — libobs, obs-x264: MISP precision timestamps

**Verdict: DEFER_LARGE**

Adds a new libobs utility that generates MISB ST0603/ST0604 precision-timestamp SEI messages, plus
platform time helpers (UTC/TAI offset) and an x264 option to inject them. In scope (stream sync for
multi-camera production) but it is a ~373-line feature with new public libobs API, a per-encoder opt-in
design and 8 conflict regions against master. Master has since grown a different SEI timing mechanism
(BPM / `user_data_unregistered` SEI in `shared/bpm/bpm.c`), so any port also needs a design decision about
how the two coexist. Not a small slice.

Evidence:
- `git diff master...refs/upstream-pr/4103 --stat`: 12 files, +373/-1; new `libobs/util/misp-precision-timestamp.{c,h}`.
- legacy merge-tree: 8 conflict blocks.
- `shared/bpm/bpm.c:397` — master already injects timing SEI (`sei_type_user_data_unregistered`) for BPM metrics; no MISP code anywhere in master (grep for `misp`/`ST0604` empty).

Related: none in batch.

### [#6239](https://github.com/obsproject/obs-studio/pull/6239) — obs-ffmpeg: Add end action UI property for local file source

**Verdict: DEFER_LARGE**

Replaces the media source's two checkboxes ("Loop", "Show nothing when playback ends") with a single
"End action" list for local files. Purely a UX reshuffle with no functional change; it requires a settings
migration decision and maintainer UX sign-off, and it conflicts (3 blocks). The underlying behaviour it
describes (clear-on-end ignored when looping) is consistent with current code and not a bug.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:175` / `:192` — separate `looping` and `clear_on_media_end` bools still present.
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:252`, `:327` — `is_clear_on_media_end || is_looping` logic; looping implies the clear flag is irrelevant, by design.
- legacy merge-tree: 3 conflict blocks.

Related: 6739 (same author, same UI pattern).

### [#6638](https://github.com/obsproject/obs-studio/issues/6638) — Deity VO-7U mic cracks/pops/audio skips only in OBS

**Verdict: CANNOT_VERIFY**

Device-specific audio dropouts with one USB microphone model on Windows. No stack, no code path
identified; capture goes through WASAPI (`plugins/win-wasapi`), and nothing in the report points at a
specific defect (it is not actually an encoder problem). Needs the hardware to reproduce.

Evidence:
- Report is hardware specific (single mic model, other mics fine); log only, no repro without device.

Related: none.

### [#6673](https://github.com/obsproject/obs-studio/issues/6673) — Short (encoding) lag can destroy A/V sync for monitoring and recordings (Render Delay, NDI, Teleport)

**Verdict: CANNOT_VERIFY**

Describes non-deterministic A/V desync after induced lag, involving third-party sources (NDI, Teleport)
and the Render Delay filter. Behaviour is random across restarts by the reporter's own account; no
specific code defect can be identified from the body. Would need a controlled repro and timing traces of
audio buffering in `libobs/obs-audio.c` and the async-video path.

Evidence:
- Report lists five different random outcomes for the same steps; involves third-party plugins.

Related: none.

### [#6687](https://github.com/obsproject/obs-studio/pull/6687) — obs-ffmpeg: Add support for audio track selection

**Verdict: DEFER_LARGE**

The feature (choose the audio stream of a multi-track file in the Media Source) is in scope and wanted,
but this PR cannot be taken as a small slice: (1) `deps/media-playback` moved to `shared/media-playback`,
so it needs a full port (5 conflict blocks even before the rename); (2) the properties callback calls
`avformat_open_input()` and then dereferences `fmt_ctx->nb_streams` without checking the return value —
an empty or unreadable path would crash the properties dialog; (3) it probes the file synchronously on the
UI thread each time the path changes and rewrites the "auto" setting to an explicit track index;
(4) list labels are hard-coded English (`"Audio Track %d"`). A correct version needs a rework and a UX
decision (auto vs explicit track, how to probe), so it is not a cherry-pick.

Evidence:
- `shared/media-playback/media-playback/decode.c:134`, `:145` — `mp_decode_init` still uses `av_find_best_stream` only (the change point; path moved from `deps/`).
- PR `obs-ffmpeg-source.c` hunk `is_local_file_path_modified`: `ret = avformat_open_input(...)` is never checked before `fmt_ctx->nb_streams`.
- legacy merge-tree: 5 conflict blocks.

Related: 6239, 6739 (same author, media source).

### [#6739](https://github.com/obsproject/obs-studio/pull/6739) — obs-ffmpeg: Add pause visibility behaviour

**Verdict: DEFER_LARGE**

Adds "pause when not visible" for local media, implemented by replacing the `restart_on_activate`
checkbox with a combobox in local-file mode (modelled on #6239). The capability is reasonable, but it is
coupled to the #6239 UI redesign, needs settings migration of `restart_on_activate`, and conflicts with
master (3 blocks). Needs a maintainer UX decision.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:177` — `restart_on_activate` still a bool checkbox.
- `plugins/obs-ffmpeg/obs-ffmpeg-source.c:662-674` — `ffmpeg_source_deactivate` only stops/clears; no pause option exists.
- legacy merge-tree: 3 conflict blocks.

Related: 6239.

### [#7530](https://github.com/obsproject/obs-studio/issues/7530) — aja: Avoid unconfiguring an aja device if it is in use

**Verdict: IMPLEMENT**

Defect confirmed in code. On module load OBS enumerates every AJA card and calls `CardEntry::Initialize()`,
which first toggles EveryFrameServices (STANDARD -> OEM, which resets the card), then calls
`AcquireStreamForApplicationWithReference()` **ignoring its return value**, then clears routing, sets
reference, stops AutoCirculate and disables channels. The NTV2 SDK documents that acquire fails when a
different process already reserved the device, so OBS currently tears down another application's live
configuration. Fix: acquire first and bail out (skip the card) when the acquire fails.

Evidence:
- `plugins/aja/aja-card-manager.cpp:59-67` — EveryFrameServices reset before any ownership check.
- `plugins/aja/aja-card-manager.cpp:70` — `AcquireStreamForApplicationWithReference(...)` result discarded.
- `plugins/aja/aja-card-manager.cpp:72-123` — routing cleared, reference set, AutoCirculate stopped, channels disabled.
- `plugins/aja/aja-card-manager.cpp:497-525` — `EnumerateCards` only adds the entry when `Initialize()` returns true (so returning false cleanly skips the card).
- `plugins/aja/aja-card-manager.cpp:476-491` — `ClearCardEntries` releases only entries in the map, so a skipped card is never released (no unbalanced release).
- `.deps/obs-deps-2026-10-23-x64/include/libajantv2/ajantv2/includes/ntv2driverinterface.h:464-480` — "If a different host process has already reserved the device, the function will fail."

Slice plan (new-change, ~15 lines, `plugins/aja/aja-card-manager.cpp`):
1. In `CardEntry::Initialize()`, move the `obsPid`/`AcquireStreamForApplicationWithReference` call to just after the `mCard` validity check, before the EveryFrameServices toggle.
2. If it returns false: `blog(LOG_WARNING, "AJA card %s is in use by another application; skipping", mCardID.c_str()); return false;`.
3. Leave the rest of the initialization unchanged.

Risk: if some AJA service permanently holds the stream reservation, the card would no longer appear in OBS;
the warning log makes that diagnosable.

Test plan: MSVC build of the `aja` plugin target (libajantv2 is in the 2026-10-23 deps). Runtime behaviour
UNTESTED — no AJA hardware on this machine.

Related: none.

### [#7635](https://github.com/obsproject/obs-studio/issues/7635) — New AMD Encoder stutters and lags

**Verdict: CANNOT_VERIFY**

OBS 28 AMF encoder stutter on one specific GPU/driver vs the old plugin in 27. No code defect given; the
AMF implementation (`plugins/obs-ffmpeg/texture-amf.cpp`) has been reworked many times since 28.1-rc1.
Hardware/driver specific; cannot reproduce without the AMD GPU.

Evidence:
- Report contains only logs and hardware specs; no repro beyond "stream with the new encoder".

Related: none.

### [#7867](https://github.com/obsproject/obs-studio/issues/7867) — Intel QSV QuickSync H.264 CBR ignores target bitrate

**Verdict: CANNOT_VERIFY**

At 1080p120 with a 1800 kbps target the QSV output sits around 4300 kbps across CBR/VBR/ICQ. OBS passes
the user's target straight to oneVPL (`TargetKbps`); there is no OBS-side clamp that would raise it, so the
floor is set by the Intel runtime/driver. QSV CBR handling has also been reworked since (scenario removed,
optimized BRC buffers). Needs Intel hardware to determine whether anything remains.

Evidence:
- `plugins/obs-qsv11/QSV_Encoder_Internal.cpp:260-276` — `TargetKbps = nTargetBitRate`, buffer sizes derived from it; no minimum clamp.
- `git log` on `plugins/obs-qsv11`: `03b70f067` (Fix unusual CBR bitrate issues), `9f4f2e975` / `7f94906d5` (Fix CBR spike).

Related: 8804, 8451, 9017 (QSV rate control).

### [#7940](https://github.com/obsproject/obs-studio/pull/7940) — [WIP] obs-ffmpeg, hotkey: Implement replay buffer flush and save hotkey

**Verdict: DEFER_LARGE**

Draft/WIP. The description says the setting-based approach is being converted into a hotkey, i.e. the UX
is undecided by the author. The current diff adds a settings checkbox in the old `UI/` tree (now
`frontend/`, so the UI half needs a port) and a flushing flag in the replay buffer. Feature itself is
small and in scope ("clear replay buffer on save"), but taking it means making the setting-vs-hotkey design
call ourselves; parked until a design is chosen.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:1031` (`replay_buffer_purge`), `:1075` (`replay_buffer_mux_thread`), `:1194` (`replay_buffer_data`) — no flush-on-save support in master.
- PR touches `UI/forms/OBSBasicSettings.ui`, `UI/window-basic-*.cpp`; `UI/` no longer exists (renamed to `frontend/`).

Related: none.

### [#8094](https://github.com/obsproject/obs-studio/pull/8094) — obs-ffmpeg: Add support for multiple video tracks to ffmpeg-mux

**Verdict: DEFER_LARGE**

Draft depending on #8093 (libobs multi video encoders). Master already gained multi-video-encoder outputs
via a different implementation (`obs_output_set_video_encoder2`, `MAX_OUTPUT_VIDEO_ENCODERS`), so the libobs
half is superseded and the ffmpeg-mux half (~465 lines) would have to be rewritten against that API.
51 conflict blocks.

Evidence:
- `libobs/obs.h:2061`, `:2083` — `obs_output_set/get_video_encoder2` already exist.
- `libobs/obs-internal.h:1261` — `video_encoders[MAX_OUTPUT_VIDEO_ENCODERS]`.
- `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:269`, `:288` — ffmpeg-mux still sends a single video encoder.
- `git diff --stat`: 7 files, +635/-342; legacy merge-tree: 51 conflict blocks.

Related: none.

### [#8451](https://github.com/obsproject/obs-studio/issues/8451) — Problem with Dynamic bitrate

**Verdict: CANNOT_VERIFY**

With QSV and Dynamic Bitrate, `obs_qsv_update` logs "Failed to reconfigure" and the stream eventually
sits at 0 kb/s. In code, a reconfigure only rewrites `TargetKbps` and calls `MFXVideoENCODE_Reset`; the
HRD buffer sizes (and on new platforms `WinBRCMaxAvgKbps`) stay at the original bitrate, and on failure the
modified `TargetKbps` is left in the param struct. Any of these could matter, but which Reset parameter the
Intel runtime rejects, and why the encoder then stalls, cannot be determined without the hardware. Upstream
already disabled and re-enabled QSV dynamic bitrate once for exactly this "freeze to 0 kb/s" symptom
(1b29bfc88 / 1444ead81), indicating a runtime-side issue.

Evidence:
- `plugins/obs-qsv11/obs-qsv11.c:735-746` — `obs_qsv_update` sets only `nTargetBitRate`, warns "Failed to reconfigure".
- `plugins/obs-qsv11/QSV_Encoder_Internal.cpp:468-483` — `UpdateParams` (TargetKbps only) + `Reset`.
- `plugins/obs-qsv11/QSV_Encoder_Internal.cpp:262-270`, `:333-344` — BufferSizeInKB / InitialDelayInKB / WinBRCMaxAvgKbps fixed at init.
- `plugins/obs-qsv11/obs-qsv11.c:1299-1421` — all QSV encoders still advertise `OBS_ENCODER_CAP_DYN_BITRATE`.
- commits `1b29bfc88` (disable dyn bitrate for QSV/NVENC due to freezes) and `1444ead81` (revert).

Related: 9017 (same symptom), 7867, 8804.

### [#8766](https://github.com/obsproject/obs-studio/pull/8766) — libobs: Add new signals and private support for output, encoder and service

**Verdict: DEFER_LARGE**

Adds create/destroy/update global signals and private-instance creation for outputs/encoders/services,
plus frontend changes to use private instances. This is new public libobs API (needs maintainer API
review), ~290 lines across 13 files, 19 conflict blocks. Partially overlapping work already landed
(`obs_service_create_private`).

Evidence:
- `libobs/obs.h:2521` — `obs_service_create_private` already exists; no output/encoder equivalents.
- `git diff --stat`: 13 files, +292/-52; legacy merge-tree: 19 conflict blocks.

Related: none.

### [#8795](https://github.com/obsproject/obs-studio/pull/8795) — obs-ffmpeg: Refactor muxer file path code

**Verdict: DEFER_LARGE**

A refactor (author notes "little immediate user-facing benefit", labelled Seeking Testers) touching every
recording/replay/HLS path code path; ~250 changed lines with 8 conflict blocks. Parts of the idea already
exist in master (`stream->path`, `generate_filename` from `directory`/`format`/`extension`). Too risky to
re-port for no functional gain.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:574-582` — `generate_filename` already reads `directory`/`format`/`extension`.
- `plugins/obs-ffmpeg/obs-ffmpeg-mux.c:104` — `file_changed(string next_file)` signal (no `last_file` yet).
- legacy merge-tree: 8 conflict blocks.

Related: none.

### [#8804](https://github.com/obsproject/obs-studio/issues/8804) — Quicksync encoder lacks CBR Padding

**Verdict: CANNOT_VERIFY**

QSV CBR drops well below target on static scenes (no filler data). OBS sets no HRD/filler-related
options at all for QSV (no `mfxExtCodingOption` NalHrdConformance etc.), so behaviour is the Intel
runtime default. Whether any oneVPL option forces padding on the reporter's platform can only be determined
on Intel hardware; there is no identifiable OBS defect to change blind.

Evidence:
- `plugins/obs-qsv11/QSV_Encoder_Internal.cpp:260-270` — CBR configures only TargetKbps/BufferSizeInKB/InitialDelayInKB.
- grep for `NalHrd|Filler|m_co.` in `plugins/obs-qsv11` — no matches.

Related: 7867.

### [#8898](https://github.com/obsproject/obs-studio/issues/8898) — The record button is broken when an error occurs when streaming with SVT-AV1 and AOM AV1

**Verdict: CANNOT_VERIFY**

When a shared (stream+record) software AV1 encoder hits the 5-second timeout, libobs `full_stop()` force
stops every output of the encoder, and the user reports a UI freeze when then clicking "Stopping
Recording". No stack/hang dump is provided, and the stop path has been reworked since 29.1 (frontend moved
to `frontend/`). A deadlock is plausible around `outputs_mutex`/`interleaved_mutex` in `full_stop`, but it
cannot be pinpointed from the body alone; needs a repro with a hang dump.

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-video-encoders.c:257-278` — timeout returns failure.
- `libobs/obs-encoder.c:1372-1399` — `full_stop` force-stops all outputs on encode failure.
- `frontend/widgets/OBSBasic_Recording.cpp:150-159`, `:197` — stop and ENCODE_ERROR handling.

Related: none.

### [#9017](https://github.com/obsproject/obs-studio/issues/9017) — Dynamic Bitrate breaks Intel QuickSync encoder

**Verdict: CANNOT_VERIFY**

Same symptom as #8451 (QSV + dynamic bitrate -> 0 kb/s, cannot stop). See #8451 for the code analysis;
cannot be confirmed or fixed without Intel hardware.

Evidence:
- `plugins/obs-qsv11/QSV_Encoder.cpp:229-239` — `qsv_encoder_reconfig` just returns false on Reset failure.
- `plugins/obs-qsv11/QSV_Encoder_Internal.cpp:468-483`.

Related: 8451.

### [#9571](https://github.com/obsproject/obs-studio/pull/9571) — obs-ffmpeg: Allow the user to set metadata

**Verdict: IMPLEMENT**

Small, self-contained (+23 lines, 1 file) and still applies cleanly. The custom FFmpeg output already
parses the user's "muxer settings" into an AVDictionary; this PR treats any `metadata_<key>=<value>` entry as
container metadata (`AVFormatContext.metadata`) before `avformat_write_header`, which enables e.g. MPEG-TS
`service_name`/`service_provider` for DVB use. Master has no equivalent (only per-stream audio titles).

Evidence:
- `plugins/obs-ffmpeg/obs-ffmpeg-output.c:375-430` — `open_output_file` parses muxer settings and writes header; no container metadata handling.
- `plugins/obs-ffmpeg/obs-ffmpeg-output.c:351` — only per-audio-stream `title` metadata is set.
- legacy merge-tree: 0 conflict blocks; `git diff --stat`: 1 file, +23.

Slice plan (cherry-pick-pr, ~30 lines, `plugins/obs-ffmpeg/obs-ffmpeg-output.c`):
1. Cherry-pick `8e7ed5a74` (authorship preserved; GPL-2.0-or-later, same as this fork). Re-run clang-format (master uses a wider column limit).
2. Small follow-up in the same file: only log "Using metadata settings" when at least one metadata key was found (currently logs `(null)` when muxer settings are non-empty but contain no `metadata_` keys), and fix the "metdata" comment typo.
3. Known cosmetic leftover: the `metadata_*` keys remain in the dict and will also be printed as "Invalid muxer settings" after `avformat_write_header`; optionally skip those keys in that second log loop.

Test plan: MSVC build of `obs-ffmpeg`. Functional check if feasible: run OBS with Advanced output ->
Recording -> Custom Output (FFmpeg) -> mpegts file with muxer settings
`metadata_service_name=Test metadata_service_provider=OBS`, then inspect with `ffprobe -show_programs`
(ffprobe availability on this box not confirmed; otherwise mark the runtime check UNTESTED).

Related: none.

### [#9628](https://github.com/obsproject/obs-studio/issues/9628) — B-frames not setting to 0 despite logging so

**Verdict: ALREADY_ADDRESSED**

The failure path was: old `jim-nvenc` clamped B-frames on its internal copy, failed, then fell back to the
FFmpeg NVENC encoder which re-read the unclamped `bf=2` from settings. Both halves are gone: the FFmpeg NVENC
encoder was removed/disabled by default (af555b937, `ENABLE_FFMPEG_NVENC` OFF), and the new `obs-nvenc`
plugin derives the default `bf` from the GPU's reported caps (0 when B-frames are unsupported) and caps
the property range to `caps->bframes`. Simple output mode does not set `bf` itself, so it gets the
caps-aware default.

Evidence:
- `plugins/obs-nvenc/nvenc-properties.c:47` — `bf` default is `caps->bframes > 0 ? 2 : 0`.
- `plugins/obs-nvenc/nvenc-properties.c:209-210` — B-frames property only shown, with max `caps->bframes`, when supported.
- `plugins/obs-nvenc/nvenc-helpers.c:272` — caps loaded from the nvenc test helper (`NV_ENC_CAPS_NUM_MAX_BFRAMES`).
- `plugins/obs-ffmpeg/CMakeLists.txt:7` — `ENABLE_FFMPEG_NVENC` defaults OFF; commit `af555b937` "obs-ffmpeg: Remove native/disable FFmpeg NVENC".
- grep `"bf"` in `frontend/` — no matches (simple mode does not override).

Related: none.
