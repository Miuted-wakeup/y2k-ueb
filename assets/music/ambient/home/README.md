# Historical ambient track directory

This folder retains the original recording location; its name does not limit
playback to HOME. All seven sections share the configured soundtrack. Further
recordings can go anywhere under `assets/music/ambient/` (MP3 or OGG preferred).
Merely copying files does not activate them: register exact site-relative paths
in `AMBIENCE.default.tracks` in `site-audio-core.js`. Do not replace the main
player's songs. See `../README.md` for mixing and random-order rules.

## Current recording

- File: `crystal-settings.mp3`
- Source title: **crystal settings**
- User-supplied source: https://www.youtube.com/watch?v=P_7kL2GYXOU
- Retrieved anonymously through the user's own `descargar videos/downloader.py`
  API after the user approved updating only its virtual environment.
- Locally extracted from the downloaded source video using existing FFmpeg:
  `libmp3lame`, VBR quality 2, 48 kHz stereo, approximately 2:04.82.
- The intermediary source video remains outside the site's public assets.

This is the only configured shared track, so it loops across all sections.
Moving between sections using the default pool preserves playback, position and
shuffle state without pausing or restarting it. Additional tracks use a random,
nonrepeating round rather than sequential order. The default ambient level remains
0.10 times master volume, with HOME Shurelia priority and automatic pause while
the main player or favorite is active. Loudness and browser playback
have not been auditioned or tested. Source attribution does not establish a
license or permission to publish the recording; no deployment is part of this task.
