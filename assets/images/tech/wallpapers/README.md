# Tech wallpapers

These assets are derived from media supplied by the site owner. Source filenames are preserved below for provenance; no authorship, license or redistribution permission is inferred or granted by this repository note. Confirm any applicable rights before redistribution.

## Sources and outputs

User-provided source directory: `C:/Users/Gustavo/Downloads/assets ueb/wallpapers frutiger/`.

| Source | Full wallpaper | Thumbnail |
| --- | --- | --- |
| `asadal_stock_2.jpg` | `asadal-2.jpg` | `asadal-2-thumb.jpg` |
| `asadal_stock_219.jpg` | `asadal-219.jpg` | `asadal-219-thumb.jpg` |
| `asadal_stock_221.jpg` | `asadal-221.jpg` | `asadal-221-thumb.jpg` |
| `asadal_stock_5.jpg` | `asadal-5.jpg` | `asadal-5-thumb.jpg` |
| `tomorrow_12.jpg` | `tomorrow-12.jpg` | `tomorrow-12-thumb.jpg` |
| `tomorrow_22.jpg` | `tomorrow-22.jpg` | `tomorrow-22-thumb.jpg` |
| Existing `assets/images/tech/bg-tech.jpg` | Original unchanged; used directly | `original-thumb.jpg` |

## Technical preparation

FFmpeg creates new JPEG derivatives only. The supplied originals and the existing Tech background remain untouched. Images retain their entire composition and aspect ratio: no crop, stretch or upscaling is applied.

- Full wallpapers: fit within 2560 × 1600 pixels, Lanczos downsampling, JPEG quality scale 3.
- Thumbnails: fit within 320 × 200 pixels, Lanczos downsampling, JPEG quality scale 5.
- Source images below a limit remain at their source resolution for that derivative.
- Output creation refuses existing files instead of overwriting other work.

Filter for full wallpapers:

```text
scale=w='min(iw,2560)':h='min(ih,1600)':force_original_aspect_ratio=decrease:flags=lanczos
```

Filter for thumbnails:

```text
scale=w='min(iw,320)':h='min(ih,200)':force_original_aspect_ratio=decrease:flags=lanczos
```

The catalog is defined in the site-root `tech-wallpapers.js` as `window.TechWallpaperCatalog`, an array of `{ id, title, src, thumbnail }` entries. The first entry points to the unchanged original Tech background. The manifest contains local asset paths only and does not fetch images by itself.
