# Folio

Folio is a lightweight, native Markdown reader and editor for Windows and Linux. It opens documents in a quiet, typeset reading view and keeps editing available when you need it.

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
- Desktop file associations for `.md` and `.markdown` files

## Tech stack

- Tauri 2 with a Rust backend
- Plain HTML, CSS, and JavaScript frontend
- CodeMirror 6 for editing
- `markdown-it` for rendering
- Vite for frontend development and builds

## Development

Install Node.js, a current stable Rust toolchain, and the
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform.
Windows requires WebView2; Linux uses WebKitGTK 4.1.

On Fedora, install the native build dependencies (including Rust and Cargo):

```bash
sudo dnf install rust cargo gcc gcc-c++ make pkgconf-pkg-config \
  webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel libxdo-devel
```

Then, on either platform:

```sh
npm ci
npm run tauri -- dev
```

For a frontend-only production build:

```sh
npm run build
```

Run the source-mapping tests with `npm test`. The browser regression test checks
caret stability during live rendering, scroll alignment in both directions,
text size, wrapping, pane resizing, and short documents:

```powershell
# Use the installed Microsoft Edge browser on Windows.
$env:FOLIO_BROWSER_CHANNEL = 'msedge'
npm run test:browser
```

With no browser channel set, the test uses Playwright's Chromium (install it
with `npx playwright install chromium`). The test starts and stops its own local
Vite server; the Tauri backend is not required.

## Build the Windows installer

```powershell
npm run package:windows
```

The NSIS installer is written to `src-tauri/target/release/bundle/nsis/`. It installs Folio for the current Windows user, registers the Markdown file associations, and allows Markdown files to be opened directly in Folio.

## Build the Linux package

Build on Linux with the prerequisites above installed:

```bash
npm run package:linux
```

The Fedora RPM is written to `src-tauri/target/release/bundle/rpm/`. Install the
generated package with `sudo dnf install ./path/to/Folio.rpm`, using its actual
filename. It includes an application-menu launcher and advertises support for
Markdown files in the file manager's **Open With** menu. You can select Folio as
the default Markdown application in your desktop's file properties.

Tauri automatically merges `src-tauri/tauri.linux.conf.json` on Linux, so the
default build produces an RPM while Windows keeps its NSIS installer. For other
Linux formats, override the bundle target, for example:

```bash
npm run tauri -- build --bundles deb
npm run tauri -- build --bundles appimage
```

The Linux desktop-entry template forwards the selected file to Folio, including
paths containing spaces, so **Open With** opens the document directly.

For packages intended for older distributions, build on the oldest supported
distribution with WebKitGTK 4.1. A build made on a recent Fedora release may
depend on system libraries newer than those available on older Linux systems.

## Project structure

```text
app.js                 Application state and file actions
editor.js              CodeMirror editor setup
reader.js              Markdown rendering
gauge.js               Editing-pane gauge and statistics
styles/                Reading, editing, and design-token CSS
src-tauri/             Tauri and Rust configuration
```
