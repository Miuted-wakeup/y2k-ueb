# Persistent site audio

The seven original HTML sections share one live top-level audio engine. Each
section retains its own complete document, CSS, scale and player design inside
an unzoomed full-viewport frame. No framework, HTML-fetch router or new art is
required. The parent owns music, the JAPAN favorite and one Web Audio context;
child players and effects use validated commands and authoritative snapshots.

## Enter and navigate

Every fresh document checks actual native AudioContext state. When already
running, the requested section opens directly. Otherwise a keyboard-accessible
**ENTRAR** button (accessible name: activate audio) resumes native audio from that real event.
The short reveal is decorative, not network progress or a loading screen.
The section frame loads/handshakes without layout until entry is released, so
a zoomed section does not build a stale native scroll tree under the inert modal.
**sin sonido** (also Escape) releases the same section without automatic
effects. Music does not start merely because sound is enabled if it was paused.

Direct URLs, query strings, fragments and reload preserve their destination.
Ordinary navigation among the seven sections replaces only the child document:
music and permission are not recreated. Back/Forward takes one step per route.
Modified/new-tab/download links retain native semantics. An unrelated external
link leaves the entire app rather than loading inside its persistent frame.

A fresh document/reload must validate again: browser permission cannot honestly
be persisted as a localStorage boolean. Stored values contain only requested
music selection, playback position, volume and mute. Silent entry persists over
routes and probes; a later explicit activation request can show the parent button
again. Manual player controls remain available. Master mute/zero volume silences
voice and effects, even while the song is paused. Leaving a section stops its
held synth/tuner/voice and favorite without closing the shared context.

## Shared GIF entrance experiment

The saved **Puerta de biblioteca** concept remains a separate alternative, not
an implemented room; its saved source/export is under `odd/concepts/entry-library-door*`.
The current experiment replaces the cluttered splash with
a flat `#150e14` background (the mean edge tone of the supplied dark textured
GIF) and one centered **ENTRAR** button with slowly oscillating text. A flat
color cannot reproduce the GIF's original noise exactly. A display-only CSS alpha
mask blends the outer 10% of each edge into that background, leaving the central
80% in each axis fully opaque. No blur filter or bitmap/animation edits are used.

Native audio activation still happens synchronously from that real click. Once
permission is confirmed, the optional cancellable `beforeReveal` hook creates a
fresh native image URL and attaches it only after loading. It shows one declared
GIF cycle, removes the image, waits 500ms on the plain background, then splits
the cover upward/downward over 600ms. Configuration is `ENTRY_INTRO` in
`site-audio-shell.js`: 3010ms cycle, 500ms hold, 8000ms load watchdog. The original
600x450 GIF is copied unchanged to `assets/gifs/entry/portal-intro.gif`; it has
90 frames and an infinite loop flag, so one cycle is timed, not an `ended` event.
Native browser scheduling may affect the visual boundary; no playback QA was run.

The native modal closes before the section frame is first laid out. A separate
non-modal visual cover blocks input during the split while the controller keeps
`entered=false`, so the first companion greeting/effects are not consumed under
the intro. At completion the cover is removed, normal focus is restored and entry
is published. The controller's optional hook does not change the default path
for callers without it. Existing route/query/fragment and engine ownership remain.

**sin sonido** uses the same intro without audio activation. Escape during the
intro cancels it and proceeds silently. Load errors/watchdog skip the missing
animation and continue through the short hold, not an endless blank screen.
Lifecycle cancellation clears image callbacks/timers. Reduced motion removes the
idle text oscillation and substitutes a fade for the split; the explicitly
clicked GIF still plays. No automatic intro audio, music start or loading overlay
was added. Every GIF keeps `image-rendering: pixelated`.

Source edits and diffs only: no tests, lint/type/syntax checks, browser/runtime
verification or validation build were requested or performed. `dist` was not
rebuilt. The original resource and earlier entrance assets are preserved.

## File development and static hosting

Open `index.html` directly as usual. The outer URL becomes, for example,
`index.html#/tech.html?view=retro#hardware`: file URLs cannot push a sibling file
path into browser history. A direct `tech.html` works too; it remains the physical
host for that visit. HTTP keeps normal `/tech.html?view=retro#hardware` paths.

Run `node tools/build-static.cjs` for the guarded public-only `dist` output.
See [static publishing](vercel-static-README.md) for Vercel configuration.
No deployment, remote account access, commit or push is part of this change.
Never publish private repository notes/tests/provenance/archived concepts.

## Shared ambience across all sections

Place recordings anywhere under `assets/music/ambient/`, then explicitly register
their site-relative filenames in `SiteAudioCore.AMBIENCE.default.tracks`. All
seven sections share nine recordings: `crystal-settings.mp3` and eight tracks in
`assets/music/ambient/global/` (supplied YouTube tracks, downloaded through the
user's own tool and extracted locally with FFmpeg). The original track's historical
`home/` file location does not restrict playback to HOME. A single-track pool loops. There
is no folder scan, guessed filename or fallback song. See `assets/music/ambient/README.md`.

The persistent parent owns a separate, lazy native Audio element. During the
trusted ENTRAR event it may prime a configured source at zero output; it never
blocks the entrance on that optional media promise. The same element is reused
for later playback, including file-based development without fetch/decoded-audio
CORS requirements. Browser refusal, missing files and load timeouts affect only
ambience, not native voice/main-player permission.

After the intro is complete, shared ambience fades up to `0.10 * master volume`.
Shurelia uses peak voice gain `0.20` only in HOME (other voices retain `0.12`).
Her actual glyph sounds temporarily duck ambience to 30% of its normal level,
then it recovers gently after her speech. `requirePlaying: false` remains in
force: voice is independent of whether the main player's song is playing or
paused, while respecting master mute/zero and explicit silent entry.

Starting the main player or JAPAN favorite pauses ambience immediately, rather
than mixing songs. Pausing/stopping foreground playback lets eligible shared
ambience resume at its prior position. Single tracks loop; multiple registered
tracks start randomly and consume a shuffled bag without repeating a source until
the round is exhausted. A new round never starts with the just-finished track;
pause and navigation keep the current selection and bag. Routes using the default
pool share the same media, position and bag, so moving between them does not pause
or restart ambience. An explicitly configured section rule can override that pool;
an empty override intentionally disables ambience there. Hiding the page, native
context suspension, BFCache entry and disposal stop ineligible ambience; no hidden
extra AudioContext or saved permission boolean is created.

When an ambient recording starts or resumes audibly, a small card shows its title
and a 44px cover beside it (local source-video stills, stored under
`assets/images/ambient/`; optional `cover` metadata in the shared registry)
at the physical viewport's top-left (14px inset) for 4.2 seconds. Its colors follow
the current section; a route change only updates the visible card's palette,
without restarting the timer or announcing a new track. It ignores preloads,
silent entry priming and speech-volume ramps, and hides under entry or when the
document is hidden/leaving. It is a polite status region with plain text, no
buttons, focus changes or pointer capture. Failed/missing images keep the title
without a broken-image icon and never delay audio or extend the card's timer.
All card presentation lives in the
shared shell; section HTML/CSS, skins and TECH/workspace/guest files are untouched.

Levels are starting values, not normalized loudness claims;
recordings with different mastering may need a later adjustment. All configured
recordings were downloaded and converted successfully, but no listening tests,
automated checks, browser/runtime verification or site build were requested/run.
`dist` remains unbuilt.

## Existing and future effects

Load order in every HTML HEAD is Core, speech helper, Engine, Client, Shell.
The host skips legacy page effects; the child starts once after bridge readiness.
If bootstrap is unavailable, original standalone pages remain the fallback.

In a hosted section, use `SiteAudioClient.command(...)` for bounded effects or
`createSpeechLease('name')` for editable character dialogue. Call
`requestActivation()` when explicit reactivation is desired; postMessage is not
a native user gesture. Children never construct another persistent context or
write global playlist storage. Native media play success/rejection returns by
ACK; it is not inferred from an optimistic UI event.

The bridge validates exact frame source, HTTP origin (or normalized opaque file
origin), random capability, current epoch, schema, commands and route allowlist.
New section frames get new realms/capabilities; stale messages and replayed
command IDs cannot execute another route's effects. Owned frame URLs suppress
referrers. This boundary does not make same-origin project scripts untrusted or
provide an HTML sandbox; do not insert untrusted scripts into the site.

For API details see [engine](site-audio-engine-README.md) and
[HOME integration/fallback](home-entry-README.md).

## Verification boundaries

Unit regressions cover rejected/native-allowed/suspended/late outcomes, shared
ownership, message validation and fallback compatibility. Native Chrome tests
use fresh local profiles, real input, localhost and actual file URLs, without
autoplay or web-security bypass flags. An analyser observes audio before the
muted test sink; it verifies a waveform, not the user's physical speaker output.
`persistent-audio.browser.cjs` exercises the production global validator and
all-seven continuity. `home-entry.browser.cjs` deliberately blocks only the new
shell to keep testing the retained standalone welcome fallback.

Vercel configuration is tested locally; deployed Vercel, Safari/Firefox, mobile
hardware and device-specific audio interruption are not claimed as verified.

### Remaining extended visual check

The extended ABOUT suite currently passes its sidebar/scroll/Winamp and content
contracts, then fails its historical entrance-fade assertion: initial layout is
held behind the entry screen, so its old load-timed sampling sees opacity jump
from zero to one rather than intermediate transition frames. Later dock/file
checks in that suite are not reached. Keep that assertion; the passing default
35-viewport and production HTTP/file checks do not make this suite fully green.
A follow-up should align the old entrance animation with released entry and
verify the rendered fade without changing the approved About design.
