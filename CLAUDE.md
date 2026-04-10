# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A screen ruler web application built with Rust (compiled to WebAssembly) with an earth-tone color palette. The app replicates the functionality of ruler.now — a pixel/unit measurement tool for the screen.

## Tech Stack

- **Language**: Rust → WebAssembly (via `wasm-pack`)
- **Frontend**: Rust + `web-sys` / `wasm-bindgen` for DOM interaction, or a Leptos/Yew SPA
- **Styling**: CSS with earth tones (browns, tans, ochres, terracottas)
- **Deployment**: Vercel (static site output from `wasm-pack build`)

## Build Commands

```bash
# Install wasm-pack (one-time)
cargo install wasm-pack

# Build WASM package
wasm-pack build --target web

# Serve locally (requires a static file server)
npx serve .
# or
python3 -m http.server 8080
```

## Project Structure (planned)

```
ruler/
├── src/
│   └── lib.rs          # Main Rust/WASM logic
├── www/
│   ├── index.html      # Entry point
│   ├── index.js        # WASM bootstrap
│   └── styles.css      # Earth-tone styling
├── Cargo.toml
└── CLAUDE.md
```

## Color Palette (Earth Tones)

| Role       | Color     | Hex       |
|------------|-----------|-----------|
| Background | Sand      | `#D4B896` |
| Ruler body | Tan       | `#C19A6B` |
| Tick marks | Dark brown| `#5C3D2E` |
| Labels     | Espresso  | `#3B1F0E` |
| Highlight  | Ochre     | `#B5860D` |

## Deployment

- Push to `main` branch on GitHub (`ppwnr88/ruler`)
- Vercel auto-deploys from `main`; output directory is `www/` (or `dist/` after wasm-pack build)
- No server-side code — pure static deployment
