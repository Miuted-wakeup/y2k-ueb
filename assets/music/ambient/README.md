# Ambient soundtracks

Ambient music is separate from the main player's playlist and shared across all
seven sections. Put tracks anywhere under this directory. Use MP3 or OGG files,
preferably with simple lowercase names such as
`aero-evening.mp3` or `soft-menu.ogg`. Keep the original audio files; no conversion
or normalization is required just to place them here.

## Register tracks explicitly

Copying files here does **not** start playback. The shared allowlist is
`AMBIENCE.default.tracks` in the repository's `site-audio-core.js`. It registers
nine tracks: the original `assets/music/ambient/home/crystal-settings.mp3` and
eight recordings in `global/` (see that folder's README for source attribution).
The historical `home/` folder name does not limit the original track to HOME.
Additional copies remain inactive until registered. There is no folder scan,
guessed filename or fallback soundtrack.

For example, after adding the corresponding real files, the shared entry could be
edited to contain:

```js
default: Object.freeze({
  volume: 0.10,
  tracks: Object.freeze([
    Object.freeze({ src: 'assets/music/ambient/aero-evening.mp3', title: 'Aero evening' }),
    Object.freeze({ src: 'assets/music/ambient/soft-menu.ogg', title: 'Soft menu' })
  ])
})
```

Paths are relative to the site root, not to this README. Edit the configuration
literal; the exported registry is frozen at runtime. Every section without an
explicit rule uses `default`, sharing one continuous player and shuffle bag.
An explicit section rule can override the default; an empty `tracks` override
intentionally makes that section silent. Folder names alone never choose scope.
Each entry can be a legacy path string or an object with `src`, `title` and an
optional `cover` path under `assets/images/ambient/`.
Use the latter to choose the readable title on the brief now-playing card.
Titles are bounded plain text, not markup. A missing title falls back to the filename.

## Now-playing card

The persistent shell displays a small, noninteractive card 14px from the top-left
for 4.2 seconds when ambient playback actually starts or resumes. It shows the
track title alongside a 44px cover from `assets/images/ambient/`. Those nine
local covers are still frames from the existing downloaded source videos, not
newly downloaded or independently verified official album art. Invalid, absent
or failed images leave the title-only notice intact. Images never delay playback
or extend the timer. Its palette
matches the current section, including if navigation occurs while it is visible.
An ordinary route change, preload, muted entry prime or speech-volume fade does
not trigger another card. Entry covers, hidden documents and page exit hide it.
The card does not alter section layout, players or companion controls.

## Mixing policy

- The default `0.10` is a quiet ambient multiplier of the player's master volume, not
  a new change to the main player's own volume setting.
- The shared audio owner starts eligible ambience only after entry. Silent entry,
  master mute/zero volume and hidden/suspended state are respected.
- Main-player playback or the JAPAN favorite takes priority and pauses ambience;
  it can resume when that playback stops and the current section is eligible.
- HOME Shurelia's speech remains audible independently of whether the main player
  is paused or playing. Her voice uses a stronger per-instance peak gain (`0.20`)
  and ambience ducks during her speech. Actual balance can be tuned from the user's audible feedback; no listening
  or loudness-analysis check was requested or run.

No section HTML, CSS, player skin or other aesthetic component is needed to add
files or register these tracks.

## Playback order

One registered track loops continuously. With multiple unique tracks, playback
starts at a random entry and draws from a shuffled bag: every source plays once
before a new round. A new round cannot immediately repeat the track that just
ended. Pausing the foreground player or navigating between sections using the
same pool does not draw a fresh track, clear the remaining bag, pause playback or
restart the current recording. Duplicate source URLs are ignored.
