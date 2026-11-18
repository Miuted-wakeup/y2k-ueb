# Tech blog and optional laboratory

Tech is a personal technology blog first. Its profile and links occupy an anchored upper-left sidebar; only the central column scrolls through the existing essays, notes and optional laboratory. The Aero styling remains, but applications and gadgets are secondary.

## Photographic Aero masthead

`tech-header.css`, loaded only by Tech, uses the owner's supplied `asadal_stock_399.jpg` as a panoramic header background. The local copy is `assets/images/tech/header/asadal-stock-399.jpg`; the original JPEG is unchanged. `background-size: cover` and a center/65% focal position frame the horizon, sea and palm rather than stretching the photograph. A panoramic banner necessarily crops part of the original composition; no crop is baked into the file.

The existing title and tagline share a compact row on a pale glass plaque when space permits, wrapping only when necessary. The narrow message strip retains its glossy glass edge; navigation, routes and the provisional site name are unchanged. Reduced padding, a 20px title and shared-row identity keep this an editorial masthead rather than a tall hero. This is a Tech-only decoration, not a change to other sections or the wallpaper selector. Asset provenance is recorded beside the image in `assets/images/tech/header/README.md`.

### Passing phrases, not aesthetic labels

The header carries a continuous right-to-left ribbon, not a slideshow and not a component with previous/pause/next buttons. Its twelve original Spanish lines evoke everyday MSN/PC habits, downloads, MP3s and wallpapers rather than announcing the name of an aesthetic. These are newly written atmosphere, not attributed historical quotations, notifications, personal facts or live activity. Edit the `.tech-header-phrase` elements in `tech.html` to change the copy; there is no duplicated JS catalog.

The existing filename `tech-header-carousel.js` now implements steady 32 CSS-pixel-per-second movement with `requestAnimationFrame`. One adjacent, accessibility-hidden copy creates a seamless loop; all phrases travel together without a six-second hold, per-message replacement, fade or visible controls. Initial copy is visible immediately, and the ribbon retains its 16px height. Font/viewport changes update the loop width. Keyboard focus on the text stops it for reading; moving focus away resumes it. Hidden documents and page departure stop scheduling, and BFCache restoration retains the position without a clock jump. The duplicate is excluded from assistive technology and the text is not a live announcement. Without JavaScript the source phrases remain static. No audio, storage, network dependency or other section is involved.

## Entries and editorial order

The entries live in `#tech-blog-feed` in `tech.html`, separate from the laboratory. Existing texts are retained without inventing publication dates. Future entries should be inserted at the beginning of that section, newest first, using the `article.panel.tech-entry` structure.

`main#center-feed.tech-blog-content` is the single central scroll surface, containing the entries, wallpaper settings and laboratory. The author/Tech Bookmarks rail and local heading/navigation are outside that surface. Flex/grid containers use constrained height and `min-height: 0` so central content cannot push the rail or player off screen. Navigation scrolls this element explicitly, compensating the site's zoom; keyboard focus does not scroll its ancestors. Paint's existing `closest('#center-feed')` integration now measures the actual scroll column.

In the wide two-column layout, the rail reserves the CD's lower-left footprint instead of letting Bookmarks extend behind it. With the disc mounted, bottom padding is `max(0px, disc diameter × .75 − player height)`; together with the wrapper's existing 8px bottom inset this leaves an 8px separation above the raw disc frame. Named size-container queries compact the portrait, decorations, gaps and bookmark rows at 420px and 360px of actual remaining rail height, not just the total viewport height. The two density modes retain a 64px or 60px portrait instead of shrinking the identity indiscriminately. All labels and links remain present, and no sidebar scroller is introduced. Size containment is limited to the stretched desktop grid item so the narrow layout's auto-height author row does not collapse. These rules are guarded by size-container support; extremely short or unsupported viewports can still exceed the minimum readable rail height. The CD's position, size, rotation and player geometry are unchanged.

The Tech MSN profile uses a vertical composition: the existing avatar is centered and enlarged, with the name and status below. A miniature framed Lain monitor accompanies the portrait using the existing `assets/gifs/tech/lain-glitch-framed.gif` unchanged. It is decorative (`aria-hidden`), retains the full image frame with `object-fit: contain`, and explicitly uses `image-rendering: pixelated`. The current identity, listening text and Nudge button are retained; no new personal facts, widget or audio behavior are introduced. Avatar sizing follows the site's logical viewport height. Short windows use a smaller portrait/monitor; very short windows hide only this extra decoration, not the identity or bookmarks. The profile remains anchored outside the central scroller; the CD/player and other sections are unaffected.

Two supplied character stickers also belong only to this profile: `assets/gifs/tech/profile/toro-and-kuro.gif` sits at the upper-left of the card body, below its title bar, and `assets/images/tech/profile/no-filter.webp` perches over the listening strip containing **Daft Punk — Digital Love**. Both are absolutely anchored to their own host, decorative, pointer-transparent and pixelated; they do not add a row, capture Nudge clicks or modify the track label. The original WebP has 44 transparent pixels below its visible feet out of 420px, so the CSS perch offset compensates 10.4762% of its rendered size rather than making a destructive crop. The GIF already has real transparency and keeps its original 15-frame, three-second loop; its gray preview background did not require removal. Sizes reduce in short windows. Sources, dimensions and transparency details are recorded in `assets/images/tech/profile/README.md`; both source files remain unchanged.

For each new post, write a real title and text, add the actual publication date with a `<time datetime="YYYY-MM-DD">` element, and use a category only when it is meaningful. Do not insert fictional updates, dates, counters, or fake read-more links just to fill the layout. These are static HTML entries, not an automatically generated CMS feed.

The closed-by-default `#tech-laboratory` disclosure is below the entries. Its **Laboratorio** navigation button opens it before scrolling there. It retains the console, the temporary Shurelia visit, Paint, instruments, gadgets, and hardware information. Collapsing it does not remove their DOM or discard an open Paint instance. Shurelia's visibility/audio pauses when its laboratory is hidden; the carousel recalculates when it is revealed.

## Simulated NAVI activity

The existing console readings are decorative telemetry for the fictional retro machine, **not measurements of the visitor's device**. `tech-terminal-metrics.js` supplies 160 distinct activity profiles and randomly chooses targets without immediately repeating a profile. Values approach those targets with bounded small changes every 2.2–4 seconds rather than jumping directly between unrelated values.

CPU/GPU load, used VRAM, RAM, disk occupancy, and network rates vary together. Hardware identities and total capacities stay fixed. Disk changes are much slower than memory or network activity. Uptime advances with elapsed time from the existing fictional six-hour boot baseline; it does not jump randomly. Percentage bars and their accessible labels use the displayed usage values.

The update timer pauses when the statistics are not visible: the laboratory is closed, the console is minimized, the document is hidden, the readings leave the scroll viewport, or Shurelia temporarily replaces them. The terminal lifecycle destroys listeners and observers; a BFCache remount reuses the weakly held model instead of inventing a new boot time. No hardware, process, or network-monitoring API is accessed, and no sound or extra widget is added.

## Wallpaper properties

- Use **Personalizar fondo**, the `fondo` shortcut, or the `fondo` command.
- The gallery contains the original Tech background and the six user-provided wallpapers.
- Selecting a thumbnail applies that background only to Tech. **Restaurar original** restores the existing CSS background.
- `fondo lista` prints the available IDs. For example: `fondo asadal-2` or `fondo original`.
- The selected catalog ID is stored under `muted:tech-wallpaper:v1` in this browser's local storage. Storage errors leave the current visit usable. Arbitrary stored values and remote wallpaper URLs are not accepted.
- A new image is loaded before replacing the current background; a failed load retains the previous one. Rapid selections cannot let an older load overwrite a newer choice.

The catalog is in `tech-wallpapers.js`. The UI and behavior are in `tech-backgrounds.css` and `tech-backgrounds.js`. Media provenance and processing details are in `assets/images/tech/wallpapers/README.md`.

## Tech-only cover-art CD

`tech-player-cd.js` and `tech-player-cd.css` add a large viewport-corner CD only in Tech. Half its width is outside the left viewport edge and its bottom quarter extends below the viewport, anchoring it to the actual lower-left corner rather than floating above the player. It is a separate direct child of the document body, not an enlarged player-slot image. The 63px-high player's background spans the entire viewport width underneath the CD, without a notch or detached rounded left edge. Internal left padding preserves the current control positions, and the redundant small Aero icon stays hidden while the CD is mounted. If the ring fails, the original icon and normal padding return. Other section skins and the shared audio engine are unchanged. The hanging Kirby decoration was removed from Tech's HTML at the owner's request; its original GIF and the Kirby song's cover remain intact.

The CD uses the supplied transparent PNG ring unchanged, with a separately masked artwork layer underneath. The annular SVG mask is embedded in CSS and follows the ring's original, slightly off-center geometry; the metal hub and its transparent central hole are not filled with artwork. Portrait/widescreen covers use CSS `object-fit: cover`, never altered source files.

The disc starts rotating when the existing main player reports playback. Pausing freezes its current angle. Its angle and sliding position are explicitly interpolated with `requestAnimationFrame`; the requested playback effect no longer relies on CSS animations/transitions that the former local reduced-motion rule disabled. This exception is confined to the CD, not a change to the visitor's system setting or the rest of the site's motion behavior. Rotation pauses in hidden documents and resumes without a time jump.

On a source change it physically translates completely out of the left edge over 400ms. The completed departure then starts a one-second hidden interval; only afterward can the artwork swap and the 400ms return begin. Image loading may extend the hidden period. Initial display does not impose the track-change delay. Each change cancels the previous timers, sliding frames and image callbacks; a rapid skip starts from the current interpolated position rather than jumping or revealing an older request's cover. Missing artwork uses a neutral silver face, not another song's cover.

The layer is decorative and ignores pointer events, so it does not intercept article links or player controls. Desktop diameter remains 180–260 CSS pixels; narrow screens use 160px and very short viewports use 140px. Its left offset is minus half its diameter and its bottom offset minus one quarter. The player starts at the viewport's left edge; only its controls are inset by half the diameter plus 26px, preserving their former position including the removed 2px notch border. The CD's z-index of 9998 places it over the complete player background at 9997. Geometry, rotation and track-change movement are unchanged.

The component observes the existing `SiteAudioClient` state/subscription; native audio events provide the legacy fallback. It never creates audio, sends playback commands, changes permissions, or sets a music source. Listeners, pending image callbacks, and timers are cleaned up on departure; BFCache restoration resynchronizes the current track.

| Existing audio file | Tech artwork |
| --- | --- |
| `onii_yuukai.mp3` | `onii-yuukai.jpg` |
| `matryoshka.mp3` | `matryoshka.webp` |
| `hatachi.mp3` | `hatashi-no-koi.jpg` |
| `kirby.mp3` | `kirby.webp` |
| `nitori.mp3` | `nitori.jpg` |
| `aishite.mp3` | `aishite.jpg` |
| `yt-3agc6do-624.mp3` | `yt-3agc6do-624.jpg` (video frame) |
| `yt-hxrwlmloaeo.mp3` | `yt-hxrwlmloaeo.jpg` (video frame) |
| `yt-j9sn1nfgqq8.mp3` | `yt-j9sn1nfgqq8.jpg` (video frame) |
| `yt-icbdykfxpms.mp3` | `yt-icbdykfxpms.jpg` (video frame) |
| `vivarium.mp3` | `vivarium.jpg` (prepared; not added to the main playlist) |

The main playlist currently has ten tracks. The four additions are appended in both `site-audio-core.js` and the legacy `scripts.js` list, preserving the original six indices and the shared transport. The songs are available through the existing players; the cover-art CD remains exclusive to Tech. Vivarium is a separate favorite used by Sobre mí. Preparing its artwork here does not add that track to the shared playlist or change its separate transport.

### Added YouTube tracks

| Track | Credit shown | Source | Local audio |
| --- | --- | --- | --- |
| Remember Summer Days | Anri | [YouTube](https://www.youtube.com/watch?v=3agC6do-624) | `assets/music/yt-3agc6do-624.mp3` |
| Heroes (NightCore) | Canal: luna love | [YouTube](https://www.youtube.com/watch?v=hXRwlmloAeo) | `assets/music/yt-hxrwlmloaeo.mp3` |
| Color Your Night | Lotus Juice, Azumi Takahashi & ATLUS Sound Team | [YouTube](https://www.youtube.com/watch?v=j9Sn1nFGQQ8) | `assets/music/yt-j9sn1nfgqq8.mp3` |
| Looping the Rooms feat. Hatsune Miku | Canal: rusino / ルシノ | [YouTube](https://www.youtube.com/watch?v=icBDYkfxpMs) | `assets/music/yt-icbdykfxpms.mp3` |

Credits come from the selected video's public metadata. For the two uploads without an artist field, the UI explicitly labels the uploader as a channel rather than inventing a performer credit. Color Your Night's repeated metadata credits are consolidated in the display.

The user's existing downloader retrieved each source video anonymously into a private temporary staging directory; existing FFmpeg converted its audio to MP3 using `libmp3lame -q:a 2`. Covers are locally extracted video frames, not claimed to be official album artwork. Their exact provenance and extraction positions are recorded in `assets/images/tech/player-cd/README.md`. The downloaded source videos remain outside the public assets, and the user's previously supplied artwork is unchanged. No cookies, new downloader, dependency changes, or external image requests are needed by the site's player.

## Paint application area

```text
paint
paint minimizar
paint restaurar
paint cerrar
help paint
```

Inside the optional laboratory, Paint opens in a dedicated full-width row between the console workbench and the gadget collection. It is not inside the terminal and is never a fixed overlay. A closed application reserves no empty space. The window can expand in the page flow, minimize, close, and restore. Opening Paint explicitly also opens its containing laboratory.

Normal editor height follows the actual available scroll area minus the window chrome, within 280–680 CSS pixels. This calculation uses logical dimensions to remain consistent with the site's zoom. Expanded mode intentionally provides a larger canvas; very short viewports may still require scrolling.

The real editor is [JS Paint](https://jspaint.app/), using its [documented iframe integration](https://github.com/1j01/jspaint/blob/master/README.md#embed-in-your-website). It is loaded from `https://jspaint.app/` only on the first opening, so **it requires an Internet connection**. There is no vendored application, framework, remote-control API, multiplayer setup, or automatic file upload in the site integration.

Closing or minimizing the window hides, but does not remove or reload, its iframe. The drawing remains in that editor instance while the visitor stays on the page. **Visitors must save their work from Paint's File menu before leaving or reloading Tech.** The fallback link opens a separate external tab; it does not transfer the current drawing.

The frame has its own origin, no referrer, and sandbox permissions for scripts, its origin, forms, dialogs, downloads, and popups. Top-level navigation and clipboard permission delegation are not granted. External availability and browser-dependent editor features remain outside the site's control.

The module and window styles are in `tech-paint.js` and `tech-paint.css`. `tech-terminal.js` dispatches the commands and preserves focus when an application opens outside the console.

These tools do not change the shared audio shell, music, other sections, Shurelia's existing terminal guest, social links, or the rejected exploratory mockup.
