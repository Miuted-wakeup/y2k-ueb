# Tech profile decoration assets

These resources were supplied by the site owner for decorations in the Tech profile card. They were copied unchanged: no resizing, cropping, transparency cleanup, redrawing or transcoding was applied. The original files in Downloads remain untouched.

| Supplied source | Local asset | Source metadata |
| --- | --- | --- |
| `C:/Users/Gustavo/Downloads/assets ueb/noFilter.webp` | `assets/images/tech/profile/no-filter.webp` | 420 x 420; static RGBA WebP; 7,820 bytes |
| `C:/Users/Gustavo/Downloads/assets ueb/toro-and-kuro.gif` | `assets/gifs/tech/profile/toro-and-kuro.gif` | 144 x 80; 15 frames at 200ms each; 3-second infinite loop; 64,667 bytes |

Both sources contain real transparency. The gray RGB value at the GIF's transparent corner is not an opaque background; no removal is necessary.

## Presentation geometry

Coordinates below use the unmodified source image, with right/bottom bounds exclusive.

- WebP visible-alpha bounds: `(111, 38, 387, 376)`. Its lower 44 pixels are transparent. At a rendered square width of 72 CSS pixels, the visible feet end about 7.54px above the image box's bottom. A seat anchored above a line can compensate with `bottom: calc(100% - 7.54px)` rather than `bottom: 100%`. The visible character is approximately 47.3 x 57.9px at that scale; asymmetrical source padding biases its visible center about 6.7px right of the box center.
- GIF union of visible-alpha bounds: `(1, 6, 139, 76)`. Preserve the full frame and original timing; use `image-rendering: pixelated` for the site's GIF style.

This note records local provenance and presentation guidance only. A supplied filename is not proof of authorship or a license; no redistribution rights are inferred.