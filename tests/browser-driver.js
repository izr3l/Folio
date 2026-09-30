import { EditorView } from '@codemirror/view';
export { setEditorContent } from '../editor.js';

export function editor() {
    return EditorView.findFromDOM(document.querySelector('.cm-editor'));
}
