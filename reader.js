import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true });

export function renderMarkdown(source, target) {
    target.innerHTML = markdown.render(source || '');
}
