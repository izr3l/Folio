import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { Compartment, EditorState, Transaction } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';

let view;
let changeHandler = () => { };
let selectionHandler = () => { };

// Alt+Z toggles soft wrap; on by default so long lines are visible without scrolling.
const wrapping = new Compartment();
let wrapped = localStorage.getItem('folio-wrap') !== 'off';

function toggleWrap() {
    wrapped = !wrapped;
    localStorage.setItem('folio-wrap', wrapped ? 'on' : 'off');
    view.dispatch({ effects: wrapping.reconfigure(wrapped ? EditorView.lineWrapping : []) });
    return true;
}

export function createEditor(parent, source, onChange, onSelection) {
    changeHandler = onChange;
    selectionHandler = onSelection;
    view = new EditorView({
        state: EditorState.create({
            doc: source,
            extensions: [lineNumbers(), markdown(), history(), wrapping.of(wrapped ? EditorView.lineWrapping : []), keymap.of([...historyKeymap, ...defaultKeymap, indentWithTab, { key: 'Alt-z', run: toggleWrap, preventDefault: true }]), EditorView.updateListener.of((update) => {
                if (update.docChanged) changeHandler(update.state.doc.toString());
                if (update.selectionSet) {
                    const selection = update.state.selection.main;
                    if (!selection.empty) selectionHandler(view.coordsAtPos(selection.to));
                    else selectionHandler(null);
                }
            })]
        }),
        parent
    });
    return view;
}

// Loading a file must not become an undoable edit, or Ctrl+Z wipes the document.
export function setEditorContent(source) {
    if (!view) return;
    view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: source },
        annotations: Transaction.addToHistory.of(false)
    });
}

export function getEditorContent() { return view?.state.doc.toString() || ''; }

export function focusEditor() { view?.focus(); }

export function formatSelection(kind) {
    if (!view) return;
    const selection = view.state.selection.main;
    const selected = view.state.sliceDoc(selection.from, selection.to);
    if (kind === 'clean') {
        const cleaned = selected.split('\n').map((line) => line.trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
        view.dispatch({ changes: { from: selection.from, to: selection.to, insert: cleaned }, selection: { anchor: selection.from + cleaned.length } });
        view.focus();
        return;
    }
    const formats = { bold: [`**${selected || 'bold text'}**`, 2], italic: [`*${selected || 'italic text'}*`, 1], heading: [`# ${selected || 'Heading'}`, 0], list: [`- ${selected || 'list item'}`, 0], quote: [`> ${selected || 'quoted text'}`, 0], link: [`[${selected || 'link text'}](url)`, 1], code: [`\`${selected || 'code'}\``, 1] };
    const [insert, cursorOffset] = formats[kind] || [];
    if (!insert) return;
    view.dispatch({ changes: { from: selection.from, to: selection.to, insert }, selection: { anchor: selection.from + insert.length - cursorOffset } });
    view.focus();
}
