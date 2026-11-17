# Publish only the public static output

This repository contains private tests, task notes, agent rules, provenance and
archived concepts. Do **not** publish the repository directory itself. The local
zero-dependency Node build copies only browser files and binary assets into
`dist`; it never bundles, rewrites source HTML or installs a framework.

## Local build

```text
node tools/build-static.cjs
node --test tests/static-build.test.cjs
```

The seven HTML destinations remain `index.html`, `japan.html`, `music.html`,
`canto.html`, `tech.html`, `sobre-mi.html` and `cosas.html`. New non-hidden root
HTML/CSS/JS runtime files are automatically included. Binary assets retain their
exact original bytes and relative directories.

Included assets cover images/GIFs/cursors, audio, video, web fonts, browser
CSS/JS, WASM and binary runtime data. Markdown, JSON/provenance, hidden folders,
and every `concepts` folder are excluded. Tests, `odd`, agent rules, Git data,
tools and source documentation are never published. The one generated hidden
ownership manifest contains only a constant owner and relative paths/hashes;
it contains no local absolute paths or permissions/secrets.

## Safe rebuilds

The output is fixed to the build root's `dist` directory. An existing directory
without the correct `.static-build-manifest.json` is refused, even if empty.
Before writing, a rebuild verifies every previous output hash and rejects any
unowned file, edited/deleted output, link/junction or escaping manifest path.
Hardlinked output is rejected too. Keep manual edits in source, not in `dist`.

Only verified manifest-owned stale files are unlinked. Empty ancestor folders
of those files may be removed; there is no recursive output deletion. Each
replacement is copied to a temporary sibling and renamed after hash checks.
An interrupted build can intentionally fail closed on its next attempt; inspect
the incomplete generated output rather than automatically erasing or claiming it.

The test-only API is `require('./tools/build-static.cjs').buildStatic({fixtureRoot})`.
It still fixes output to that root's `dist`; no arbitrary output path exists.

## File development versus HTTP hosting

Open the source `index.html` for normal file-based development. Persistent audio
uses file hash routes there because file URLs cannot push sibling history paths.
HTTP/Vercel keeps the actual sibling HTML paths, queries and fragments. The build
does not convert the site into an SPA or add a catch-all rewrite.

## Vercel configuration — no deployment performed

For the current Git repository, leave Vercel **Root Directory** at the repository
root (`.`): that is the local `principal` folder containing `index.html` and
`vercel.json`, not a nested `principal/` path. Only choose `principal` as a
subdirectory if importing a different outer repository that actually contains it.
Use Framework Preset **Other**, build command
`node tools/build-static.cjs`, and output directory `dist`. The local `vercel.json`
sets these static settings and `cleanUrls:false`; existing links retain `.html`.
No external destinations or SPA rewrites are configured. Vercel documents the
`cleanUrls` setting in its [project configuration reference](https://vercel.com/docs/project-configuration/vercel-json#cleanurls).

Alternatively, a manual static upload must use only the generated `dist` folder.
These files prepare a local artifact; they do not create a Vercel project,
connect credentials, push source or publish anything. Remote deployment remains
a separate user decision.
