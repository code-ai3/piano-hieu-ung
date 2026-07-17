# 🎹 Piano FX

> MIDI-powered falling-notes piano visualizer with particle effects, audio-to-MIDI transcription, and MP4 export.  
> Built with Vue 3 + Vite + Web Audio + WebCodecs. 100% client-side — no backend, no registration.

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3.x-42b883?logo=vuedotjs" alt="Vue" />
  <img src="https://img.shields.io/badge/Vite-5.x-646cff?logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript" alt="TS" />
  <img src="https://img.shields.io/badge/Web_Audio-supported-ff69b4" alt="Web Audio" />
  <img src="https://img.shields.io/badge/WebCodecs-supported-00bcd4" alt="WebCodecs" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License" />
</p>

<p align="center">
  <img src="./images/image.png" alt="Piano FX Screenshot" width="800" />
</p>

> 🚀 **[Try it online →](https://tools.lishiyuan.cn/)** &nbsp;|&nbsp; 📖 [中文文档](./README_zh-CN.md)

---

## ✨ Features

### Core Visualization
- **Falling-notes waterfall** — parses MIDI files and drops color-coded notes onto a realistic piano keyboard.
- **Real-time keyboard highlight** — keys light up with configurable glow and pulse as notes strike.
- **Three built-in tracks** — Canon, Kiss The Rain, Rivers Flow In You. Drag & drop your own MIDI or audio files.

### Contact Effects (two modes)

| Mode | Behavior |
|---|---|
| 🔥 **Burn & Smoke** | Notes ignite at keyboard contact. A heat front climbs from bottom to top with white-hot glow. The note body burns away asymmetrically, releasing **debris shards** (flying outward), **smoke puffs** (rising & expanding), **sparks** (high-velocity particles), and a momentary **flash** at impact. The burn duration matches the note length — long notes take time to burn out; short notes vanish quickly. |
| 💫 **Diffuse Aura** | A colorful radiating halo blooms at contact, fading within 0.6s, while the note rectangle stays lit in your chosen active color with glow. Cleaner, more ambient look. |

### Audio → MIDI Transcription
- Upload any audio file (mp3, m4a, wav, ogg, flac) and transcribe to MIDI using **Spotify Basic Pitch**.
- Adjustable parameters: onset threshold, frame threshold, minimum note length.
- The transcribed MIDI instantly loads and plays — no intermediate download required.

### MP4 Video Export
- Off-screen canvas rendering at **1920×1080** at **30 fps**, with real audio from smplr offline rendering.
- Uses [mediabunny](https://github.com/codler/mediabunny) (WebCodecs-based) for H.264 + AAC multiplexing.
- **Stream-to-disk** mode via `showSaveFilePicker` (low memory usage), with fallback to in-memory download.
- Real-time progress bar + ETA.

### Customization
- **Note color** — pick any hex color for active notes.
- **Keyboard color** — active/inactive white keys, active/inactive black keys — each independently set.
- **Glow & opacity** — independent sliders for note glow, note opacity, keyboard glow, keyboard opacity (0–240px glow, 10%–100% opacity).
- **Divider line** — configurable thickness (1–10px), with animated wave + multi-layer gradient glow.
- **Background** — choose from built-in presets (starry sky image, ocean waves video) or upload your own image/video. Toggle dark overlay transparency.
- **Fullscreen mode** — immersive canvas with optional control hiding.

### Localization & UI
- **中文 / English** bilingual with real-time switching.
- **Dark / light theme** toggle with persistent preference.
- Full playlist management — add tracks, switch tracks, single-track repeat.
- **Speed control not yet exposed in UI** — but the playback engine supports variable speed internally.

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────┐
│                    PianoView.vue                 │
│   (1176 lines — UI state, canvas render,         │
│    playback control, export orchestration)       │
├──────────────────────────────────────────────────┤
│  🎵 Audio Engine          │  🎬 Export Pipeline  │
│  smplr → Web Audio API   │  smplr renderOffline  │
│  (real-time synthesis)   │  → AudioBuffer → AAC  │
│                          │  + canvas per-frame   │
│                          │  → H.264 → MP4 mux    │
├──────────────────────────────────────────────────┤
│  🎼 MIDI Layer            │  🤖 ML (optional)    │
│  @tonejs/midi parser      │  @spotify/basic-pitch│
│  → NoteEvent[] sorted     │  + TensorFlow.js     │
│    by time                │  → audio → MIDI      │
├──────────────────────────────────────────────────┤
│  🎨 Canvas 2D Rendering   │  📦 Shared Components│
│  requestAnimationFrame    │  Btn / Modal /       │
│  devicePixelRatio-aware   │  AppCheckbox         │
└──────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

```bash
git clone <repo-url> piano-fx
cd piano-fx
npm install
npm run dev
```

Open `http://localhost:5173` in Chrome or Edge.

### Requirements

| Dependency | Why |
|---|---|
| Node.js 18+ | Build toolchain |
| Chrome / Edge | WebCodecs (export), `showSaveFilePicker` (streaming export), AudioContext |
| ~50 MB disk | Piano samples + ML model + MIDI files |

### Production Build

```bash
npm run build      # type-check + Vite build
npm run preview    # local preview of dist/
```

The build output in `dist/` is a static site — deploy to any static hosting (GitHub Pages, Vercel, Netlify, Nginx, etc.).

---

## 📦 Bundled Assets

| Path | Size | Description | Source License |
|---|---|---|---|
| `public/samples/sfzinstruments-splendid-grand-piano/` | ~43 MB | Grand piano soundfont (453 `.m4a`/`.ogg` files) | [smplr](https://github.com/djipco/smplr), sfzinstruments |
| `public/models/basic-pitch/` | ~900 KB | Spotify Basic Pitch TensorFlow.js model | [Apache-2.0](https://github.com/spotify/basic-pitch) |
| `public/midi/` | ~28 KB | 3 demo MIDI files | — |
| `public/wallpaper/` | ~5 MB | Star background image + ocean wave video | — |

> The piano sample filenames contain `#` characters which Vite's static file server mishandles. A custom middleware in `vite.config.ts` intercepts `/samples/` requests and serves them correctly. This works in both `dev` and `preview` modes.

---

## 🧪 Development

```bash
npm run dev         # Vite dev server with HMR
npm run type-check  # vue-tsc type checking only
npm run build       # type-check + production build
npm run preview     # serve dist/ locally
```

### Project Layout

```
src/
├── views/PianoView.vue         # Main piano SFC (composition API)
├── components/
│   ├── Btn.vue                 # Glass-morphism button
│   ├── Model.vue               # Modal dialog with open/close animation
│   └── AppCheckbox.vue         # Styled checkbox
├── util/
│   └── audio-to-midi.ts        # Lazy-loaded: audio → MIDI via Basic Pitch
├── locales/
│   ├── zh-CN.ts                 # Chinese locale (piano.* + app.*)
│   └── en.ts                   # English locale
├── assets/tailwind.css          # Tailwind + modal/glass utility classes
├── App.vue                     # Root: background gradient + PianoView + floating controls
├── main.ts                     # Entry: Vue app + i18n (no router, no Pinia, no analytics)
└── i18n.ts                     # vue-i18n setup with zh-CN/en, locale detection
```

---

## ❓ FAQ

**Q: Why is the sound delayed / silent on first click?**  
A: Browsers require a user gesture to resume an `AudioContext`. Click the ▶ Play button after loading a track — the piano will init and audio will start.

**Q: My MIDI file sounds wrong / notes are off?**  
A: The piano keyboard range is auto-calculated from the MIDI file. Very large files (>1 hour) may have cumulative timing drift in the canvas, but audio scheduling is precise.

**Q: Export takes a long time — can I speed it up?**  
A: Video export renders every frame through Canvas 2D — it's CPU-bound. Close other tabs. Use the stream-to-disk mode (`showSaveFilePicker` dialog) to avoid building a giant in-memory buffer.

**Q: Audio-to-MIDI transcription produces noisy / fragmented notes?**  
A: Adjust the parameters in "Other Settings" → "Audio to MIDI Params":
- Increase **onset threshold** to reduce false onsets.
- Increase **frame threshold** to keep only high-confidence notes.
- Increase **min note length** to discard short spurious fragments.
Then re-upload your audio file.

**Q: Can I use this without the bundled samples?**  
A: The smplr `baseUrl` points to `/samples/sfzinstruments-splendid-grand-piano/samples`. You can replace this directory with any compatible SFZ soundfont or configure a CDN URL inline.

---

## 🙏 Credits

Piano FX builds on several open-source projects:

| Project | Role |
|---|---|
| [smplr](https://github.com/djipco/smplr) | Web Audio sampler with multi-velocity piano layers |
| [@tonejs/midi](https://github.com/Tonejs/Midi) | MIDI file parser |
| [Spotify Basic Pitch](https://github.com/spotify/basic-pitch) | Audio-to-MIDI transcription model |
| [mediabunny](https://github.com/codler/mediabunny) | WebCodecs-based MP4 muxer |
| [TensorFlow.js](https://www.tensorflow.org/js) | ML inference runtime for Basic Pitch |
| [Vue 3](https://vuejs.org/) + [Vite](https://vitejs.dev/) | Frontend framework & build tool |
| [Tailwind CSS](https://tailwindcss.com/) | Utility-first CSS |
| [Font Awesome](https://fontawesome.com/) | Icons |
| [vue-i18n](https://vue-i18n.intlify.dev/) | Internationalization |

---

## 📄 License

This project is licensed under [MIT](./LICENSE).

Bundled third-party assets (piano samples, Basic Pitch model) retain their original licenses. See [Bundled Assets](#-bundled-assets) for details.
