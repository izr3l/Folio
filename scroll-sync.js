// Interpolate between matching source blocks rather than percentages of two
// documents with different layouts. Coordinates are relative to each scroller.
export function mapScrollPosition(position, anchors, sourceIndex) {
    const targetIndex = 1 - sourceIndex;
    for (let index = 1; index < anchors.length; index += 1) {
        const before = anchors[index - 1];
        const after = anchors[index];
        if (position <= after[sourceIndex]) {
            const span = after[sourceIndex] - before[sourceIndex];
            const fraction = span > 0 ? Math.max(0, (position - before[sourceIndex]) / span) : 0;
            return before[targetIndex] + fraction * (after[targetIndex] - before[targetIndex]);
        }
    }
    return anchors.at(-1)?.[targetIndex] ?? 0;
}

export function enableScrollSync(editor, proof) {
    const manuscript = editor.scrollDOM;
    let driver = manuscript;
    const measureKey = {};

    function read() {
        if (!manuscript.clientHeight || !proof.clientHeight) return null;
        const manuscriptTop = manuscript.getBoundingClientRect().top;
        const proofTop = proof.getBoundingClientRect().top;
        const documentOffset = editor.documentTop - manuscriptTop + manuscript.scrollTop;
        const blocks = new Map();
        for (const element of proof.querySelectorAll('[data-source-line]')) {
            const line = Number(element.dataset.sourceLine);
            if (line < 1 || line > editor.state.doc.lines) continue;
            // Nested list/quote blocks can start on the same line. Prefer the
            // innermost visible block, which sits closest to the actual text.
            blocks.set(line, element);
        }
        const anchors = [[0, 0]];
        for (const [line, element] of [...blocks].sort((a, b) => a[0] - b[0])) {
            const manuscriptY = documentOffset + editor.lineBlockAt(editor.state.doc.line(line).from).top;
            const proofY = element.getBoundingClientRect().top - proofTop + proof.scrollTop;
            const previous = anchors.at(-1);
            if (manuscriptY > previous[0] && proofY > previous[1]) anchors.push([manuscriptY, proofY]);
        }
        anchors.push([Math.max(manuscript.scrollHeight, anchors.at(-1)[0] + 1),
            Math.max(proof.scrollHeight, anchors.at(-1)[1] + 1)]);
        const sourceIndex = driver === manuscript ? 0 : 1;
        const source = driver;
        const target = sourceIndex === 0 ? proof : manuscript;
        const sourceRange = Math.max(0, source.scrollHeight - source.clientHeight);
        const targetRange = Math.max(0, target.scrollHeight - target.clientHeight);
        const position = source.scrollTop;
        const mapped = position <= 0 ? 0
            : sourceRange > 0 && position >= sourceRange - 1 ? targetRange
            : mapScrollPosition(position, anchors, sourceIndex);
        return { target, position: Math.max(0, Math.min(targetRange, mapped)) };
    }

    function refresh(fromEdit = false) {
        if (fromEdit) driver = manuscript;
        // CodeMirror batches layout reads after updating its height map,
        // including wrapped lines that aren't currently rendered in the DOM.
        editor.requestMeasure({ key: measureKey, read, write(result) {
            if (result && Math.abs(result.target.scrollTop - result.position) > 1) {
                result.target.scrollTop = result.position;
            }
        } });
    }

    for (const pane of [manuscript, proof]) {
        for (const event of ['wheel', 'pointerdown', 'touchstart', 'keydown']) {
            pane.addEventListener(event, () => { driver = pane; }, { passive: true });
        }
        pane.addEventListener('scroll', () => {
            // Programmatic scroll events can arrive several frames later.
            // They must never turn the follower into the driving pane.
            if (driver === pane) refresh();
        });
    }

    const resizeObserver = new ResizeObserver(() => refresh());
    resizeObserver.observe(manuscript);
    resizeObserver.observe(proof);
    proof.addEventListener('load', () => refresh(), true);
    document.fonts.ready.then(() => refresh());
    return { refresh };
}
