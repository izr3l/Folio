# Folio

Folio is a lightweight, native Markdown reader and editor for Windows. It opens documents in a quiet, typeset reading view and keeps editing available when you need it.

## Features

- Render `.md` and `.markdown` files with `markdown-it`
- Switch between reading view and split Manuscript/Proof editing view
- Live preview with synced scrolling
- Formatting actions for headings, lists, quotes, links, code, and emphasis
- Word count, character count, and estimated reading time
- Open, create, and save Markdown files with keyboard shortcuts
- Drag and drop Markdown files into the window
- Recent files menu
- Day/Night themes and adjustable reading size
- Windows file association for `.md` and `.markdown` files

## Tech stack

- Tauri 2 with a Rust backend
- Plain HTML, CSS, and JavaScript frontend
- CodeMirror 6 for editing
- `markdown-it` for rendering
- Vite for frontend development and builds

## Development

Install Node.js, Rust, the Tauri Windows prerequisites, and WebView2. Then run:

```powershell
npm install
npm run tauri dev
```

For a frontend-only production build:

```powershell
npm run build
```

## Build the Windows installer

```powershell
npm run package:windows
```

The NSIS installer is written to `src-tauri/target/release/bundle/nsis/`. It installs Folio for the current Windows user, registers the Markdown file associations, and allows Markdown files to be opened directly in Folio.

## Project structure

```text
app.js                 Application state and file actions
editor.js              CodeMirror editor setup
reader.js              Markdown rendering
gauge.js               Editing-pane gauge and statistics
styles/                Reading, editing, and design-token CSS
src-tauri/             Tauri and Rust configuration
```