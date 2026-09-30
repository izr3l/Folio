import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { createEditor, getEditorContent, formatSelection, setEditorContent } from './editor.js';
import { renderMarkdown } from './reader.js';
import { enableGaugeResize, updateGauge } from './gauge.js';
import { enableScrollSync } from './scroll-sync.js';

const state = { path: null, source: '', mode: 'reading', dirty: false, editor: null, scrollSync: null };
const $ = (selector) => document.querySelector(selector);
const typeScales = [0.85, 1, 1.15, 1.3, 1.5];
let typeScaleIndex = Number(localStorage.getItem('folio-type-scale-index') || 1);

function setDirty(value) { state.dirty = value; $('#unsaved-dot').hidden = !value; }
function filename(path) { return path ? path.split(/[\\/]/).pop() : 'Untitled manuscript'; }
function recentFiles() { return JSON.parse(localStorage.getItem('folio-recent') || '[]'); }
function remember(path) { if (!path) return; localStorage.setItem('folio-recent', JSON.stringify([path, ...recentFiles().filter((item) => item !== path)].slice(0, 10))); }
function updateTitle() { $('#filename').textContent = filename(state.path); document.title = `${state.dirty ? '• ' : ''}${filename(state.path)} — Folio`; }
function updateTypeScale() { const scale = typeScales[typeScaleIndex]; document.documentElement.style.setProperty('--type-scale', scale); $('#text-size-label').textContent = `${Math.round(scale * 100)}%`; localStorage.setItem('folio-type-scale-index', typeScaleIndex); state.scrollSync?.refresh(); }
function adjustTypeScale(direction) { typeScaleIndex = Math.min(typeScales.length - 1, Math.max(0, typeScaleIndex + direction)); updateTypeScale(); }
function showSelectionPopover(coords) {
    const popup = $('#selection-popover');
    if (!coords || state.mode !== 'editing') { popup.hidden = true; return; }
    popup.hidden = false;
    popup.style.left = `${Math.min(window.innerWidth - popup.offsetWidth - 12, Math.max(12, coords.left))}px`;
    popup.style.top = `${Math.min(window.innerHeight - popup.offsetHeight - 12, coords.bottom + 8)}px`;
}

function showMode(mode) {
    state.mode = mode;
    $('#reading-view').hidden = mode !== 'reading';
    $('#editing-view').hidden = mode !== 'editing';
    $('#reading-content').hidden = mode !== 'reading';
    $('#edit-toggle').textContent = mode === 'reading' ? 'Edit' : 'Proof';
    $('#edit-toggle').title = mode === 'reading' ? 'Switch to Manuscript view' : 'Switch to Folio reading view';
    if (mode === 'reading') renderMarkdown(state.source, $('#reading-content'));
    else { renderMarkdown(state.source, $('#proof-content')); updateGauge(state.source); state.editor?.focus(); state.scrollSync?.refresh(true); }
}

async function loadFile(path, mode = 'reading') {
    try {
        state.source = await invoke('read_file', { path });
        state.path = path;
        remember(path);
        setDirty(false);
        updateTitle();
        $('#reading-empty').hidden = true;
        if (state.editor) setEditorContent(state.source);
        setDirty(false);
        showMode(mode);
        renderRecent();
    } catch (error) { alert(`Could not open file: ${error}`); }
}

async function openFile() {
    const path = await open({ multiple: false, filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }] });
    if (path) await loadFile(path);
}

async function saveFile() {
    let path = state.path;
    if (!path) path = await save({ defaultPath: 'untitled.md', filters: [{ name: 'Markdown', extensions: ['md'] }] });
    if (!path) return;
    try { await invoke('write_file', { path, contents: getEditorContent() || state.source }); state.path = path; state.source = getEditorContent() || state.source; remember(path); setDirty(false); updateTitle(); renderRecent(); } catch (error) { alert(`Could not save file: ${error}`); }
}

function newFile() { state.path = null; state.source = ''; updateTitle(); $('#reading-empty').hidden = true; if (state.editor) setEditorContent(''); setDirty(false); showMode('editing'); }
function renderRecent() { const container = $('#recent-files'); container.innerHTML = ''; recentFiles().forEach((path) => { const button = document.createElement('button'); button.textContent = filename(path); button.title = path; button.addEventListener('click', () => loadFile(path)); container.append(button); }); if (!container.children.length) container.innerHTML = '<small style="display:block;padding:8px;color:var(--muted)">No recent files</small>'; }
function wire() {
    $('#edit-toggle').addEventListener('click', () => showMode(state.mode === 'reading' ? 'editing' : 'reading'));
    $('#home-button').addEventListener('click', () => showMode('reading'));
    $('#menu-button').addEventListener('click', () => { $('#menu-popover').hidden = !$('#menu-popover').hidden; renderRecent(); });
    $('#open-button').addEventListener('click', openFile); $('#empty-open').addEventListener('click', openFile); $('#new-button').addEventListener('click', newFile); $('#save-button').addEventListener('click', saveFile);
    $('#theme-toggle').addEventListener('click', () => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'night' ? 'day' : 'night'; localStorage.setItem('folio-theme', document.documentElement.dataset.theme); });
    $('#text-smaller').addEventListener('click', () => adjustTypeScale(-1));
    $('#text-larger').addEventListener('click', () => adjustTypeScale(1));
    document.querySelectorAll('[data-format]').forEach((button) => button.addEventListener('click', () => formatSelection(button.dataset.format)));
    document.querySelectorAll('[data-popup-format]').forEach((button) => {
        button.addEventListener('mousedown', (event) => event.preventDefault());
        button.addEventListener('click', () => { formatSelection(button.dataset.popupFormat); $('#selection-popover').hidden = true; });
    });
    document.addEventListener('keydown', async (event) => {
        if (!event.ctrlKey) return;
        const key = event.key.toLowerCase();
        if (key === 'o') { event.preventDefault(); await openFile(); }
        if (key === 'n') { event.preventDefault(); newFile(); }
        if (key === 's') { event.preventDefault(); await saveFile(); }
        if (key === '-' || event.code === 'NumpadSubtract') { event.preventDefault(); adjustTypeScale(-1); }
        if (key === '+' || key === '=' || event.code === 'NumpadAdd') { event.preventDefault(); adjustTypeScale(1); }
        if (key === '0') { event.preventDefault(); typeScaleIndex = 1; updateTypeScale(); }
    });
    window.addEventListener('click', (event) => { if (!event.target.closest('.menu-popover, #menu-button')) $('#menu-popover').hidden = true; });
    window.addEventListener('dragover', (event) => event.preventDefault());
    window.addEventListener('drop', async (event) => { event.preventDefault(); const file = [...event.dataTransfer.files].find((item) => /\.md$/i.test(item.name)); if (file?.path) await loadFile(file.path); });
}

async function boot() {
    document.documentElement.dataset.theme = localStorage.getItem('folio-theme') || 'day';
    updateTypeScale();
    state.editor = createEditor($('#editor'), '', (source) => { state.source = source; setDirty(true); renderMarkdown(source, $('#proof-content')); updateGauge(source); }, showSelectionPopover, (update) => {
        if (update.docChanged || update.geometryChanged) state.scrollSync?.refresh(update.docChanged);
    });
    state.scrollSync = enableScrollSync(state.editor, $('#proof-content'));
    enableGaugeResize(); wire(); renderRecent();
    const path = await invoke('launch_path').catch(() => null);
    if (path) await loadFile(path);
    else { $('#reading-empty').hidden = false; $('#reading-content').hidden = true; showMode('reading'); }
}
boot();
