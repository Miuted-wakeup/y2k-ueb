# HOME companion source art

These PNGs are byte-identical copies of the two files supplied by the site owner.
The originals in Downloads remain untouched. No pixels were redrawn, removed,
recolored, resampled or generated. The site loads only the local copies.

| Local file | Supplied source | Original dimensions | SHA-256 |
| --- | --- | --- | --- |
| `shurelia-atlas.png` | `PlayStation 2 - Ar Tonelico_ Melody of Elemia - Portraits - Shurelia (Monet).png` | 256×896 RGBA | `4883fb9d114141f7d280836abecc1a23ab0d60f96dd4fec06ecc32bc6799fac2` |
| `dialogue-font.png` | `PlayStation 2 - Twisted Metal_ Black - Miscellaneous - Font.png` | 128×128 RGBA | `18f37637fd3345d3e8c4f56268567dc795fc8d48802a1072c3e50525682797f9` |

## Portrait composition

Use the first original body rectangle `(x:0, y:184, width:256, height:328)`.
Its transparent facial aperture is `(82,260,64,56)` in source coordinates:
overlay one 64×56 face at `(left:82, top:76)` relative to that body.
Scale the assembled body and face together; retain the image's transparency.

The nine face tiles begin at `(0,0)`, `(64,0)`, `(128,0)`, `(192,0)`,
`(0,56)`, `(64,56)`, `(128,56)`, `(192,56)` and `(0,112)`.
The second, smaller portrait set remains intact in the atlas but is not needed
for this composition. Do not display the entire sheet as one character.

## Bitmap text API

`home-companion-art.js` exposes `HomeCompanionArt` in a classic browser script
and the same API through CommonJS for local tests:

- `normalizeText(text)`: uppercase/base-letter visual text; Spanish accents
  become their base letters. Curly quotes, long dashes, ellipses and Spanish
  opening punctuation use their closest available glyphs. Unsupported symbols
  become `?`, never silently disappear.
- `glyphFor(character)`: `{ column, row, character }` for a normalized glyph;
  a space or empty input returns `null`.
- `renderText(container, text)`: replaces previous content, returns all glyph
  spans in reading order, groups words in `.hc-word` spans and inserts spaces
  as real text nodes. Uses `container.ownerDocument`, never HTML parsing.
- `cellSize:12`, `sheetSize:96`: source cells are 16×16 in an 8×8 atlas;
  the visual scale is 75%. Use 12×12 glyph spans and `background-size:96px 96px`.
  Each span carries its normalized character in `data-glyph`.

The PNG is not an installable font. It has A–Z, numbers, selected punctuation
and console symbols; it has no lowercase or accented Spanish glyphs. Its symbol
slots are not ASCII-contiguous. The apostrophe is at column6/row7; square and
triangle symbols occupy positions that must not be mistaken for dollar signs
or apostrophes. Keep `image-rendering:pixelated` for faithful bitmap scaling.

The bitmap container is visual only: its caller must set `aria-hidden="true"`
and provide equivalent real text retaining the original Spanish accents.
Keep a plain readable fallback until the script and local art are available.

## Live HOME behavior

With the persistent site-audio host available, HOME is an isolated child document.
Its shared client owns no native audio context and no duplicate welcome dialog:
parent `entered` state releases the neutral/unconsumed director, then the original
two-second greeting wait. Shurelia's scoped voice lease routes glyphs to the one
parent engine; destroying this child releases only its voice/notes. Parent music,
volume/mute and context survive section replacement. The standalone HOME entry
described below remains the fallback when the new bootstrap is unavailable.

Shurelia is anchored directly above HOME's player, aligned with the right column.
Only that column's available area is shortened by the portrait's height. Its
compact widgets now fit without independent scrolling at normal desktop heights;
very low windows retain an explicitly labelled reachable fallback. The original
main clearance already supplies an 8px gap. Left and center scrolling are unchanged.
No other section loads these scripts/styles. The old `character.png` is retained.

- Dialogue remains automatic after HOME's separate welcome entry; the character
  has no buttons/click action or extra tab stops. The entry offers a real trusted
  sound activation and an explicit silent choice. See `home-entry-README.md`.
- Greeting starts after entry finishes plus 2 seconds when the portrait is visible. Text types at
  70ms per glyph with its original speaking expressions, then remains readable
  for 4.2–12 seconds according to length. The bubble disappears afterward.
  Commas/colons/semicolons add 150ms; sentence punctuation adds 300ms. Ellipsis
  pauses only after its last dot. These pauses also rest the speaking pose.
- Her default is the original neutral/eyes-open face (tile0). A phrase changes
  it to its assigned reaction while typing AND reading; when the bubble hides,
  she returns to neutral. The welcome line visibly changes neutral → smile →
  neutral, including with reduced motion enabled.
- Later comments start 48–82 seconds after the bubble hides. Hidden tabs or an
  offscreen portrait cancel timers; returning resumes incomplete text or a fresh
  wait, never a backlog of hidden comments.
- The bubble is content-sized, to the LEFT of the head. It can briefly overlap
  adjacent content, as requested, and is not included in the scroll reservation.
  It has no pointer interception and no unsolicited live-reader announcements.
- Reduced motion keeps gradual text but a static emotional face, with the same
  reading/hidden intervals. Sequential text does not move the scene or bubble.
- Missing bitmap font uses gradual normal-font glyphs with the same reserved
  full-message space; equivalent semantic text remains complete and accented.
  No JavaScript leaves a static
  neutral original portrait with the bubble hidden.

## Edit your messages

Edit **`home-companion-messages.js` in the site root**, save, and reload HOME.
Each entry has the message `text` and its expression `mood`:

```js
{ mood: 'sleepy', text: 'Una canción más antes de dormir.' },
```

Keep the quotes and comma between entries. Accents and punctuation are welcome;
equivalent real text retains them even when the atlas uses base-letter glyphs.
Choose `warm`, `playful`, `sleepy`, `curious`, `serious`, or `calm`.
Unknown mood names fall back to `calm`; empty/invalid entries are skipped, and an
empty collection uses a safe greeting. Short messages work best for this corner.
`EMOTIONS` in `home-companion.js` maps moods to the original held/talking tiles.
Its `rest` means the reaction held while the message is readable, **not** the
global idle face. No need to touch that controller, CSS, font or source images
to write text.

| Mood | Reaction assigned to these messages |
| --- | --- |
| `warm` | Clear smile for greetings, welcoming or hopeful lines |
| `playful` | Animated friendly smile for jokes about repeating songs |
| `sleepy` | Subdued/downcast face for late-night tiredness |
| `curious` | Attentive face, surprised speaking pose for questions |
| `serious` | Focused/attentive reaction for thoughtful statements, not anger |
| `calm` | Gentle speaking face for quiet listening and unhurried moments |

The supplied sheet has nine expressions, not six complete emotional animation
sets. Some moods intentionally share a held face but use different speaking
poses. There is no dedicated sleeping face; the subdued original is the closest
available approximation. Reduced motion keeps each semantic reaction static
while the text still types; it never forces a permanent smile or instant text.

## Retro speech blips

`home-companion-speech.js` synthesizes short, quiet, filtered square/triangle
blips locally, with a small contextual pitch variation. There are no voice
recordings, generated media, services, dependencies or browser storage.

- No audio context or notes are created on page load. HOME's trusted primary
  entry click (including native keyboard activation) must allow its AudioContext
  to run before the first greeting is released. Failure remains retryable and
  has an explicit silent escape; text never depends on successful sound.
- HOME speech is independent of the song's Play/Pause state: after the first
  trusted primary entry, it can be heard while the music is paused. Mute and
  zero volume still silence it immediately; the existing player's volume controls
  both layers. No extra character button or automatic song playback is added.
  Choosing silent entry destroys character sound for that visit, including a
  pending native resume, without changing the music/player's state.
- Spaces/punctuation are silent. At most one 45–53ms blip per two printable
  characters, with a minimum 100ms gap; `SPEECH_GAIN` in the isolated speech
  module is .12 × player volume (twice the previous .06 level).
  Its nominal gain is ten times the original .012 level, with a brighter filtered
  pitch and soft fades rather than a harsh continuous tone.
- Hidden/offscreen comments, mute/zero volume, completed notes and destroyed
  components release their owned audio nodes. Nothing queues for later playback.
- Text, face cycling and audio share one glyph event; font loading or visibility
  changes do not replay already written letters/sounds.
- The isolated factory keeps its original `requirePlaying: true` default for
  compatibility. HOME explicitly passes its own `requirePlaying: false`; no
  inherited/non-boolean value can opt another caller out of that default.

## Compact status and fortune rail

`home-sidebar.css` is loaded only by HOME, after the companion stylesheet.
The clock and decorative `004827` counter share one compact neon status panel.
The counter is not real analytics; its tooltip/accessible label says so.
Omikuji retains its original handler, full result/lucky item and visible action.
The old placeholder guestbook is now an honest, noninteractive construction badge.

All six fortune results fit without overflow in the tested 900–1080px desktop
windows. For physically low windows (e.g. 1920×768), a sticky
`VENTANA BAJA · DESPLAZA ↓` cue exposes a reachable native-scroll fallback rather
than clipping the action. No invented filler was added to occupy tall-window space.

## Small library setting

The same reserved portrait corner now includes a library wall behind Shurelia
and a wooden counter/ledge in front. Both use exact native-resolution rectangles
from the owner's supplied `DS _ DSi - Castlevania_ Order of Ecclesia - Backgrounds - Library.png`.
The original atlas and original character/font PNGs are not altered or redrawn.

- `shurelia-room-books.png`: source book/library wall, fitted behind the portrait.
- `shurelia-room-counter.png`: original wooden surface repeated across the base.
- `shurelia-room-sources.json`: original dimensions/hash, exact crop coordinates
  and output hashes for reproduction and provenance (Castlevania / KONAMI).

Only small lossless source crops are shipped, avoiding the full 4512×8064 atlas's
roughly 139MiB decoded pixel footprint. CSS preserves pixelated rendering. The
room is clipped to the existing portrait rectangle; the separate dialogue bubble
is not clipped by it. Layer order is wall, character, counter, then dialogue.
Scene height does not alter the player anchor or the right-column scroll limit.

## Checks

From the site root, run `node --test tests/home-companion-art.test.cjs`.
The tests pin source hashes/dimensions, decode PNG transparency to check the
facial aperture, verify glyph coordinates and normalization, and check DOM
grouping/no-injection behavior. They do not read Downloads or use the network.

`node --test tests/home-companion.test.cjs tests/home-companion-art.test.cjs`
checks the director, clock/visibility transitions and faithful art renderer.
`node tests/home-companion.browser.cjs` checks real Chromium anchor/scroll geometry,
transient content-sized bubbles, automatic expressions, editable messages,
resize/zoom, reduced motion, fallbacks and direct local-file preview.
`node --test tests/home-companion-scene-assets.test.cjs` checks the source-derived
scene assets and their provenance without needing the external Downloads file.
`node --test tests/home-companion-speech.test.cjs` checks lazy activation, native
running-state gating, volume/pause, throttling/envelopes and resource cleanup.
The Chromium test also probes a meaningful Web Audio peak above .05 at 50%
volume with the song paused, silence before activation, and live mute/zero-volume
gates. Use `--audio-only` for that focused integration probe.
`node tests/home-sidebar.browser.cjs` checks every fortune across five desktop
sizes, plus short-window fallback and original panel controls.
