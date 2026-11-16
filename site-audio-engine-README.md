# One parent owns site audio

`SiteAudioEngine` keeps native music, the fixed favorite track and one Web Audio
context alive while complete section documents are replaced. Children send
validated commands; they never receive native media or context objects.

## Create and connect

Load `home-companion-speech.js` before `site-audio-engine.js`. Both are classic
browser scripts and CommonJS modules. There is no implicit Core dependency.

```js
const engine = SiteAudioEngine.createEngine({
  window,
  SpeechAPI: HomeCompanionSpeech,
  playlist: SiteAudioCore.PLAYLIST,
  baseURL: location.href,
});
const unsubscribe = engine.subscribe(state => publishValidatedState(state));
const allowed = await engine.probe();
```

The exact factory options are `window`, `SpeechAPI`, `playlist`, `baseURL`,
`AudioCtor`, `AudioContextCtor`, `storage`, `now`, and `random`. Native constructors,
storage and clocks can be injected for tests. The engine has no JS polling or
audio timers: native media events, AudioContext scheduling and `onended` own
those lifetimes. It does not attach document or route listeners.

## Activation is native state, not a storage flag

- Creating the engine allocates two native media elements but **no context**.
- `probe(): Promise<boolean>` explicitly constructs the context, reads its actual
  state and never resumes it or plays a test note. If native state is running,
  it resumes the real music only when stored/user intent requested playback.
- `unlock(event): Promise<boolean>` accepts trusted activation intent. Context
  construction/resume and any pending real music play are called synchronously
  before waiting for their native promises. It is not a postMessage consent API.
- `continueSilent()` invalidates pending enable attempts, pauses forced playback
  and disables automatic FX for this outer visit. Manual music controls remain
  usable; a route change cannot undo the silent choice.
- `permission` is `blocked`, `active`, `silent`, or `unsupported`. New native
  NotAllowed/Security failures publish `blocked`; unsupported media publishes
  `unsupported`. The shell supplies the accessible retry/silent UI and timeout.

Only requested playback state is stored. No audio-permission boolean is read or
written. Every new outer engine probes native capability again.

## Commands and bounds

`execute(command, lease = 'host'): Promise` resolves only when the command's
native outcome is known. In particular, `play` resolves after native `play()`;
it rejects native policy errors and superseded requests. A schema error rejects
with TypeError/RangeError. Blocked FX reject NotAllowedError; silent/muted FX
resolve `false` without queuing a note. Destroyed engines reject AbortError.

| Type | Actions / fields |
| --- | --- |
| `music` | `play`, `pause`, `toggle`, `next`, `prev`, `stop`; `select` with integer `value`; `seek`, `volume`, `mute` with `value` |
| `favorite` | `play`, `pause`, `stop`, `seek`, `volume`; play's optional string `value` must resolve to the fixed Vivarium URL |
| `speech` | `glyph` with `character`, optional `index`, `mood`, `voiceId`; `stop` / `release` with optional `voiceId` |
| `synth` | `start` with `frequency`, optional `wave` / `filter`; `filter` with `filter`; `stop` |
| `tuner` | `start` with `frequency`; `stop` |
| `chime` | optional `frequency`, default520Hz; no `action` field |

Unknown fields are rejected. Optional fields default only when undefined, not
when null. Numeric inputs must be finite numbers, not coerced strings:

- Volume0–1; mute is boolean; seek0–864000seconds, clamped to known duration.
- Track index0–playlist length minus1, integer; playlist contains1–64entries.
- Frequency20–20000Hz; filter40–20000Hz, default3000Hz.
- Wave `sine`, `square`, `sawtooth`, `triangle`; default`sawtooth`.
- Mood `warm`, `playful`, `sleepy`, `curious`, `serious`, `calm`; default`calm`.
- Exactly one Unicode glyph, index integer0–1000000, default0.
- Voice ID matches `[A-Za-z0-9_-]{1,48}`, default`main`.
- Lease matches `[A-Za-z0-9:_-]{1,96}`; up to64leases and16voices per lease.

The shell still independently validates source window, origin, capability token,
epoch and route. A child's command never selects its own parent-issued lease.

## Ownership and channel policy

The engine alone chooses tracks, advances `ended`, writes music storage and
restores time. Repeated/stale play promises cannot overwrite newer pause/source
requests. Children render snapshots; they must not also advance `ended`.

The favorite is always `assets/music/vivarium.mp3`, resolved against `baseURL`.
It keeps its own volume. Starting it ducks the main channel without erasing the
main's requested-playing intent. Pause preserves favorite position; stop resets
it. A favorite stop/end or its document leaving resumes main only if main was
previously requested playing and has not since been paused.

`releaseLease(lease)` releases only that document's voices/held FX/favorite. It
does not pause continuing main music or close the shared context. A new document
may immediately create new voices on the same native context.

Speech keeps its existing0.12gain profile, two-letter/100ms throttle and soft
envelope. Synth/tuner/chime base gains are0.05/0.08/0.06, multiplied by current
music volume. Master mute/zero silence all FX; favorite keeps its independent
volume but follows master mute. Silent visits never automatically resurrect FX.

## State and inspection

`snapshot()` returns `{ revision, permission, contextState, music, favorite,
speech }`. Media objects always exist and contain src/paused/playing/ended,
finite currentTime, volume, muted and duration. Unknown duration is **null**, not
NaN. Music additionally contains index/title/artist. Speech contains supported,
unlocked, contextState, activeNotes and cumulative blipsPlayed. Snapshots contain
no native references. `subscribe(fn)` emits strictly increasing revisions and
returns an unsubscribe function.

Parent-only native QA can call `getNativeContext()` and
`getNativeMedia(): {music,favorite}`. Never put these results into bridge messages.
`destroy(): Promise` stops media/notes, removes listeners and closes the one owned
context once. Late promises cannot reactivate a destroyed engine.

Storage access is guarded for file/opaque environments. Keys are the legacy
npIndex/isPlaying/npTime/npVolume plus npMuted and favoriteVolume. These store
user/media state, never permission.

## Speech helper compatibility

The original `createSpeechSound` remains lazy and requires trusted unlock by
default. It now explicitly exposes `probe()` and `getNativeContext()` for a
parent owner. Existing default require-playing policy and0.12profile are intact.

`createBoundSpeechSound({ getContext, isAuthorized, getPlayerState, now,
requirePlaying })` requires both provider functions. Bound voices never construct,
resume or close a context. Their stop/destroy release only their own nodes;
provider authorization and actual running state are required for every glyph.

## Focused checks

```text
node --test tests/site-audio-engine.test.cjs tests/home-companion-speech.test.cjs
node --check site-audio-engine.js
node --check home-companion-speech.js
```

Unit tests cover native outcomes and ownership with fakes. They do not replace
the shell's fresh-profile file/HTTP permission, navigation and waveform checks.
