# HOME readiness and standalone welcome entry

## Hosted site mode

With the site-audio bootstrap available, the persistent top document owns the music,
native Web Audio context and destination-safe activation screen. A child HOME does
**not** create another `#home-entry`, native speech context or music controller.
It waits neutral with its first message unconsumed until a validated parent state
sets `entered:true`; the original two-second greeting delay then begins. A silent
parent entry still releases text, but voice glyphs remain gated by the actual
parent permission, running-state, mute and volume snapshot.

`SiteAudioClient` is a classic-script singleton, with `createClient` exported for
Node tests. Its handshake accepts only the exact parent source, origin (opaque
file `null` also requires capability), random token/current epoch and complete
schema. `getPlayer()`/`getFavorite()` are EventTarget media facades, not overrides
of native WebIDL properties. Setters send bounded commands; getters/events enter
only from validated authoritative state. `play()` resolves/rejects only its
matching native-result ACK, not from an optimistic `play` event. The parent alone
advances ended tracks and persists music state.

HOME holds `createSpeechLease('shurelia')`. Its unlock method can read actual active
host state or request the parent's button; a transferred message is never treated
as a trusted gesture. Stop/destroy release only that voice, never the parent
context/music. Cached child pagehide stops notes and reports `page-leaving`;
persisted pageshow re-handshakes. Final child teardown cancels pending ACKs and
subscriptions/observers. A five-second missing bridge fails closed with a visible
connection error rather than constructing another local audio owner.

The shared legacy script is skipped entirely in the host and waits for bridge
state before child evaluation. Its DOM/load callbacks are readiness-aware and
queued after lexical declarations, preserving the original 700ms entrance.
Classic inspection identifiers (`npIndex`, `isPlaying`, `startFrom`, `npVolume`,
`playlist`, `updateNP` and other existing functions) remain available. Section
synth/filter/tuner/chime and favorite controls use the same parent engine.

Approved ordinary section links delegate to the parent route helper. Modified
clicks, downloads and explicit non-self targets remain native. External ordinary
HTTP/file links leave the entire app; placeholder `#` links do not navigate but
still reach their legacy handlers. Owned child documents set no-referrer policy
so the capability-bearing frame URL cannot leak through ordinary requests.

## Standalone fallback (bootstrap unavailable)

HOME has a themed welcome screen with **ENTRAR / activar sonido** and **Entrar sin sonido**. It reuses the existing collage, original Shurelia atlas and library crops; there are no new assets, downloads, services or frameworks. It is not the withdrawn LOADING trial and does not intercept links or represent network progress.

## Consent and first greeting

The native primary button's click calls `speech.unlock(event)` synchronously in the trusted activation stack. Only a confirmed running result starts the 600ms CRT reveal. Entry completion then releases the director's readiness gate; its original **2-second first-greeting wait starts at that point**, not while the cover is visible. A rejected/unsupported result leaves a retry and silent escape. An unresolved native resume is bounded to 2500ms before the same escapeable failure state.

The silent button and Escape mean **no character sound for this visit**. They destroy the owned speech controller immediately, including any pending native resume, then use the same reveal/readiness path. An old promise cannot enable sound or release the greeting again. Music is neither started nor muted by either choice; existing player volume/mute, speech gain .12 and contextual pitches remain unchanged. The site's generic gesture-unlock listener is gated while entry is pending and never preempts the silent choice.

## DOM, accessibility and lifecycle

- `#home-entry` is a JS-created native modal dialog appended to the root, outside the body's existing opacity entrance. It has a labelled title/description, real buttons, polite status and visible focus. Tab/Shift+Tab remain among enabled entry choices; Escape is silent continuation.
- Native `showModal` owns temporary background inertness. No body/root inert, overflow, opacity or tab-index attributes are changed. The previous connected focus is restored; pre-existing inert state is untouched.
- HOME CSS supplies the existing red/chrome/collage style and one 600ms CRT clipping reveal, not a wait/progress animation. Reduced motion holds a static cover for that brief interval. Inline critical sizing and native controls still work if HOME CSS fails; no-JS HOME is visible with a neutral portrait and no cover.
- A hidden pending entry or pending cached-page departure destroys the old mount, disconnects observers/listeners, invalidates promises/timers and cancels font callbacks. Returning mounts a fresh reachable entry with an unconsumed greeting. Calling the old public `destroy()` additionally cancels that pending replacement.
- A **completed** bfcache-preserved document keeps its accepted entry/director/context when the browser allows caching; hiding/pagehide stops notes and pauses dialogue. A persisted return does not demand another entry. Browser audio state/eligibility is still authoritative, not a promised permission bypass.
- In this standalone fallback, nonpersisted navigation destroys the old component. A real new HTML document constructs its own player/speech objects and HOME entry. No storage flag pretends to preserve a live AudioContext or permission across documents. The hosted mode above is the separately authorized persistent-document implementation.

## Small APIs and tests

`HomeCompanion.createDirector({ready:false})` opts into readiness gating. The default remains `true`; `setReady(boolean)` is idempotent and pauses/resumes without replaying glyph effects. Mounted HOME exposes its director at `document.querySelector('#home-companion').homeCompanion`, with `entry.snapshot()` reporting waiting/unlocking/failed/revealing/complete/destroyed. These inspection APIs are not simulated browser consent.

```text
node --test tests/home-entry.test.cjs tests/home-companion.test.cjs
node --test tests/site-audio-client.test.cjs
node tests/home-entry.browser.cjs
node tests/home-companion.browser.cjs --audio-only
```

Native integration tests use a fresh temporary Chrome/Edge profile and localhost/file URLs, with external fonts/video blocked. Hosted geometry/audio helpers must inspect the owned child context and authoritative client facades; standalone tests can exercise the fallback directly. Dedicated audio checks use a real native activation and inspect the actual parent Web Audio waveform. No gain, mute or playback assertions are weakened. The client unit suite pins source/token/epoch/schema rejection, ACK ordering, classic globals, no child media/storage ownership and hosted HOME lease/readiness teardown without installing dependencies.
