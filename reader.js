import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true });

// Block tokens carry zero-based source ranges. Keep those locations in the
// proof so different fonts and Markdown formatting don't break scroll sync.
markdown.core.ruler.push('source-lines', (state) => {
    for (const token of state.tokens) {
        if (token.block && token.map && token.nesting !== -1 && !token.hidden && token.type !== 'inline') {
            token.attrSet('data-source-line', String(token.map[0] + 1));
        }
    }
});

// markdown-it puts fence attributes on <code>. The scroll anchor belongs on
// <pre>, whose padding is part of the rendered block's position.
const renderFence = markdown.renderer.rules.fence;
markdown.renderer.rules.fence = (tokens, index, options, env, renderer) => {
    tokens[index].attrs = tokens[index].attrs?.filter(([name]) => name !== 'data-source-line');
    const html = renderFence(tokens, index, options, env, renderer);
    return html.replace('<pre>', `<pre data-source-line="${tokens[index].map[0] + 1}">`);
};

export function renderMarkdown(source, target) {
    target.innerHTML = markdown.render(source || '');
}
