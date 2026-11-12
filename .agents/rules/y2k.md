---
trigger: always_on
---

CONTEXT (read before every task):
You are building a personal blog called /y2k-blog.

PHILOSOPHY:
A personal internet portal inspired by 2005-2010 
Japanese web design. Dense, expressive, visually 
saturated. Every section has its own personality — 
no two sections share the same layout, color or 
decoration style.

TECH:
Pure HTML + CSS + vanilla JS. No frameworks.
Shared: style.css, sections.css, scripts.js.
Each section overrides colors via body id.
Google Fonts: Press Start 2P, VT323, 
Noto Sans JP, Caveat, Russo One.
Body font: Verdana 12px.

LAYOUT RULES — READ CAREFULLY:
- The full page width is the canvas. Use ALL of it.
- Panels can be wide, short, tall, side by side, 
  asymmetric — break the grid intentionally.
- NEVER create a single narrow center column.
- Sidebars can be any width that fits the content.
- Two or more panels can sit side by side anywhere.
- The layout should feel like a collage, not a list.
- Content should reach the edges of the 1024px wrapper.

GLOBAL ELEMENTS (in ALL pages):
- Windows XP .panel with titlebar + min/close buttons
- Fixed #now-playing-bar at bottom (48px height)
- Fixed #side-dock on far right (social links + chat)
- Falling elements per section (symbols or images)
- Cursor sparkle trail on mousemove
- Entrance: background + images fade in first,
  panels fade in 700ms later simultaneously
- Characters/GIFs live OUTSIDE panels as fixed 
  or absolute decorations, never inside panels

CURRENT STATE:
index.html — HOME
  Colors: red #CC0000 / black #0D0D0D / silver
  Layout: 3 columns (200px / flex1 / 190px)
  Decoration: character right side, background image

japan.html — JAPAN  
  Colors: cobalt blue #0047AB / navy / cyan #00BFFF
  Layout: 3 columns (160px / flex1 / 210px)
  Decoration: character left side, cats on panels,
  background image

music.html — MUSIC
  Colors: purple #4B0082 / black / neon green #00FF41
  Layout: 3 columns (180px / flex1 / 240px)
  Decoration: Miku fixed bottom left, fondo glitch,
  cat on artistas panel, Ado gif in fave panel
  Special: playlist table, genre bars, covers grid,
  lyrics panel, mood panel


DESIGN RULES:
- Each section gets unique layout, panels and decor
- Embrace saturation, layering and visual density
- Nothing should look clean, minimal or modern
- Characters face inward toward content always
- Panels overlap decorations, not the other way

Build only what I ask. Make bold creative choices.
Do not repeat layouts between sections.