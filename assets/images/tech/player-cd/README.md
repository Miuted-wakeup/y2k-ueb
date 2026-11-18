# Tech CD artwork

The files listed under Original source mapping were supplied by the site owner for the Tech section only. Those originals were copied byte-for-byte from `C:/Users/Gustavo/Downloads/`; no resizing, cleanup, redrawing or transcoding was applied to that set. The separately documented video-frame derivatives below are newly encoded JPEGs, not byte-for-byte copies. All source files remain untouched.

This note records local provenance only. It does not infer authorship or a license, and grants no redistribution permission. Confirm applicable rights before redistributing this media.

## Original source mapping

| Exact source filename | Tech asset filename |
| --- | --- |
| `Anillo metálico de CD transparente.png` | `cd-ring.png` |
| `vivarium.jpg` | `vivarium.jpg` |
| `onii yuukai.jpg` | `onii-yuukai.jpg` |
| `nitori.jpg` | `nitori.jpg` |
| `matryoshka.webp` | `matryoshka.webp` |
| `kirby.webp` | `kirby.webp` |
| `hatashi no koi.jpg` | `hatashi-no-koi.jpg` |
| `aishite.jpg` | `aishite.jpg` |

## Original CD geometry

`cd-ring.png` is a 1254 × 1254 RGBA PNG with actual transparency. Both the central hole and the large area between the hub and outer rim are transparent. Artwork is intended to sit beneath the original metallic artwork, with the center hole still transparent.

Approximate geometry in original image coordinates, based on the visually significant alpha edge:

- Main outer ellipse: bounds approximately x = 54…1194, y = 65…1183; center (624, 624), radii (570, 559).
- Metallic hub: bounds approximately x = 466…783, y = 481…795; center (625, 638), radii (159, 157).
- Center hole: approximately x = 547…703, y = 563…715; center (625, 639), radii (78, 76).

The image is not a perfectly centered mathematical circle. Very faint, low-alpha edge fringes extend beyond the main ring (nonzero-alpha bounding box approximately x = 25…1221, y = 15…1231). These original fringes were preserved, not cleaned or redrawn. Geometry values are layout guidance, not modifications to the asset.

## Locally extracted video frames

The following additional Tech CD images were extracted locally with FFmpeg from MP4 files already downloaded at the owner's request. They are video frames, **not guaranteed official album covers**. They are newly encoded JPEG derivatives, not byte-for-byte copies of the MP4s or their embedded video streams. No frame was resized or cropped; each keeps the small source-video dimensions suitable for the Tech CD decoration.

All four frames use the image at **00:10.000** in their respective local MP4s. The extracted frames were viewed during asset preparation to select visible artwork rather than black frames. This was resource preparation, not a website or runtime test.

| Source title | YouTube source / ID | Local source MP4 filename | Frame image | Dimensions |
| --- | --- | --- | --- | --- |
| Remember Summer Days | [3agC6do-624](https://www.youtube.com/watch?v=3agC6do-624) | `Remember Summer Days.mp4` | `yt-3agc6do-624.jpg` | 144 × 144 |
| [NightCore] Heroes \|\| Luna Love ♥ | [hXRwlmloAeo](https://www.youtube.com/watch?v=hXRwlmloAeo) | `[NightCore] Heroes ｜｜ Luna Love ♥.mp4` | `yt-hxrwlmloaeo.jpg` | 254 × 144 |
| Color Your Night | [j9Sn1nFGQQ8](https://www.youtube.com/watch?v=j9Sn1nFGQQ8) | `Color Your Night.mp4` | `yt-j9sn1nfgqq8.jpg` | 144 × 144 |
| ループザルーム feat. 初音ミク / "Looping the Rooms" ft. Hatsune Miku | [icBDYkfxpMs](https://www.youtube.com/watch?v=icBDYkfxpMs) | `ループザルーム feat. 初音ミク ⧸ ＂Looping the Rooms＂ ft. Hatsune Miku.mp4` | `yt-icbdykfxpms.jpg` | 256 × 144 |

Private local source directory at preparation time: `C:/Users/Gustavo/AppData/Local/Temp/y2k-song-import-98031036/`, with each source under its corresponding exact YouTube-ID subdirectory and accompanied by `metadata.json`. The source MP4s and metadata were retained. Public source URLs above record provenance, not a license or a rights grant.

### Audio derivatives paired with these frames

Full-length audio was converted locally from each MP4's first audio stream to `assets/music/yt-<lowercase-ID>.mp3`, using FFmpeg `libmp3lame -q:a 2` (VBR). The four source streams are stereo Opus at 48 kHz. There was no trim, normalization or deliberate change of playback speed. MP3 conversion is a lossy transcode; quality settings do not recreate an uncompressed master or guarantee official audio quality.

FFmpeg preparation options:

```text
Audio: -map 0:a:0 -vn -c:a libmp3lame -q:a 2
Frame: -ss 10 -map 0:v:0 -frames:v 1 -q:v 2
```

This local resource preparation does not change any playlist code or other section.
