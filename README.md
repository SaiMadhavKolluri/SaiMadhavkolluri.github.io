# MASSBOX® 3D viewer

Interactive 3D viewer for the Exum Instruments MASSBOX®, hosted on GitHub Pages at
https://saimadhavkolluri.github.io/

It runs on Google's [`<model-viewer>`](https://modelviewer.dev/) 3.4. There is no build step: the site is plain HTML, CSS and JavaScript modules.

## What it does

- Rotate, zoom and place the MASSBOX in your room. iPhone uses AR Quick Look (`Mass.usdz`); Android uses Scene Viewer or WebXR.
- The product video plays on the 3D touchscreen.
- A guided tour of six stops, each with a camera move, a short card and the matching video clip. The tour loops, and touching the model pauses it.
- Points of interest (toolbar ⓘ): sample door, touchscreen, power and I/O.
- Dimensions overlay in inches or centimetres, and a banana for scale.
- Dark and light studio themes. The visitor's choice is remembered.
- On desktop, "View in your space" shows a QR code that opens the page on a phone.

## URL options

| URL | Effect |
| --- | --- |
| `/?kiosk` | Starts the tour on load. It restarts after 30 s without a touch. Meant for trade-show screens. |
| `/?ar` | Used by the desktop QR code. On a phone it highlights the AR button. |

## Run locally

Any static server works. Opening the file directly (`file://`) does not, because the page uses ES modules.

```bash
npx http-server . -p 8123 -c-1
```

Then open http://localhost:8123.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page markup, toolbar, hotspots and cards |
| `styles.css` | All styles. Theme colours are CSS variables at the top. |
| `script.js` | Viewer basics: loading, theme, dimensions, banana, video on the screen |
| `stories.js` | Hotspots, guided tour, kiosk mode and the desktop QR code |
| `Mass.glb` | Web model (Draco meshes, WebP textures, about 1.7 MB) |
| `Mass.usdz` | iPhone AR model (product only, with no banana or floor glow) |
| `vid.mp4` | Screen video (1024 px H.264, no audio, faststart) |
| `studio_dark.hdr`, `studio_light.hdr` | Studio lighting for each theme |
| `poster.webp`, `og-image.jpg` | Loading poster and link-preview image |

## Updating content

### Tour and hotspot text

The text lives in the `STOPS` list at the top of `stories.js`. Each stop has a title, text, camera orbit and target, and a `clip` of `[start, end]` seconds in `vid.mp4`. To move a hotspot, edit its `data-position` and `data-normal` in `index.html`.

### Video

If you replace `vid.mp4`, encode it small and web-friendly, then re-check the `clip` times in `STOPS`.

```bash
ffmpeg -i source.mp4 -vf "scale=1024:-2" -c:v libx264 -profile:v main -pix_fmt yuv420p -crf 23 -an -movflags +faststart vid.mp4
```

### Model

The Blender source (`MassBox_web.blend`) is kept outside this repo. Export a GLB with Draco compression and WebP textures, and a USDZ without the `banana` and `floor_glow` objects. The page code looks up these material names, so keep them: `screen`, `LED`, `floor_glow`, `banana`, `decal_massbox`, `decal_exum`. The `decal_*` and `floor_glow` materials should be unlit (`KHR_materials_unlit`).

## Notes

- iPhone AR Quick Look only shows static models, so in AR the screen shows a still image instead of the video.
- Rendering is pinned to 2× pixel density, which smooths edges on 1× screens and keeps 3× phones at a steady frame rate. See the inline script in `index.html`.
- Visitors with "reduce motion" turned on get no auto-rotate and no intro camera glide.
