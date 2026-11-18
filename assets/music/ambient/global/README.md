# Shared ambient recordings

These eight user-supplied sources join the original `../home/crystal-settings.mp3`
in `AMBIENCE.default.tracks` in `site-audio-core.js`. They play across all seven
sections from the same random, nonrepeating pool. Display titles are explicit
registry metadata, independent of these ID-based filenames.

## Source attribution

| File | Source title | Source channel | User-supplied source | Converted duration |
| --- | --- | --- | --- | --- |
| `youtube-_u58MXgRjGQ.mp3` | Sunshower | Home - Topic | [YouTube](https://www.youtube.com/watch?v=_u58MXgRjGQ) | 2:56.38 |
| `youtube-tXfFJ2zyeYU.mp3` | distant ocean | alyzea | [YouTube](https://www.youtube.com/watch?v=tXfFJ2zyeYU) | 1:58.20 |
| `youtube-FBT6pVibU5k.mp3` | Schedule I OST - adventures in grassland | Schedule I | [YouTube](https://www.youtube.com/watch?v=FBT6pVibU5k) | 4:49.74 |
| `youtube-T-_hOj-eUds.mp3` | Atlas | Home - Topic | [YouTube](https://www.youtube.com/watch?v=T-_hOj-eUds) | 3:08.38 |
| `youtube-2aaNu_uTrn4.mp3` | logged in for hours | alyzea | [YouTube](https://www.youtube.com/watch?v=2aaNu_uTrn4) | 1:39.44 |
| `youtube-Gm0K-CL8yoc.mp3` | floating signal | alyzea | [YouTube](https://www.youtube.com/watch?v=Gm0K-CL8yoc) | 1:22.50 |
| `youtube-GOQEOkPsdcM.mp3` | HOME - Tides | CosmicKiefKid | [YouTube](https://www.youtube.com/watch?v=GOQEOkPsdcM) | 4:00.02 |
| `youtube--V_sltvF08Y.mp3` | Network Winds | 憂鬱 - Topic | [YouTube](https://www.youtube.com/watch?v=-V_sltvF08Y) | 4:40.01 |

The double hyphen in the last filename preserves its leading-hyphen YouTube ID.
Source titles/channel names are download metadata, not independently asserted
authorship or licensing claims.

## Retrieval and conversion

Retrieved on 2026-11-17 through Gustavo's own `descargar videos/downloader.py`
API, using its existing virtual environment and approved local Node/EJS runtime.
No cookies, accounts, new dependency installs or alternative downloader were used.
Network Winds required the tool's built-in alternate-format fallback after a
403 response for its preferred format; its source quality can therefore differ.

Existing local FFmpeg extracted audio with `libmp3lame -q:a 2`, without video
and without overwriting existing files. All eight conversions completed with
exit code 0. Total MP3 size: 35,024,489 bytes. Intermediary videos, logs and the
download manifest remain outside public site assets, in the local temporary
download directory. No loudness normalization, listening or playback checks were
performed. Existing ambient volume and player/voice priorities are unchanged.

Source attribution does not establish a license or permission to publish these
recordings. No commit, push or deployment is part of this addition.
