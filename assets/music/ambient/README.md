# Ambient soundtracks

Ambient music is separate from the main player's playlist and shared across all
seven sections. Put tracks anywhere under this directory. Use MP3 or OGG files,
preferably with simple lowercase names such as
`aero-evening.mp3` or `soft-menu.ogg`. Keep the original audio files; no conversion
or normalization is required just to place them here.

## Register tracks explicitly

Copying files here does **not** start playback. The shared allowlist is
`AMBIENCE.default.tracks` in the repository's `site-audio-core.js`. It registers
`assets/music/ambient/home/crystal-settings.mp3`, which loops as the only track.
The historical `home/` folder name does not limit that track to HOME.
Additional copies remain inactive until registered. There is no folder scan,
guessed filename or fallback soundtrack.

For example, after adding the corresponding real files, the shared entry could be
edited to contain:

```js
default: Object.freeze({
  volume: 0.10,
  tracks: Object.freeze([
    'assets/music/ambient/aero-evening.mp3',
    'assets/music/ambient/soft-menu.ogg'
  ])
})
```

Paths are relative to the site root, not to this README. Edit the configuration
literal; the exported registry is frozen at runtime. Every section without an
explicit rule uses `default`, sharing one continuous player and shuffle bag.
An explicit section rule can override the default; an empty `tracks` override
intentionally makes that section silent. Folder names alone never choose scope.

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
