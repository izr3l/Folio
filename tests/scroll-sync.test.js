import test from 'node:test';
import assert from 'node:assert/strict';
import { mapScrollPosition } from '../scroll-sync.js';
import { renderMarkdown } from '../reader.js';

test('scroll mapping follows matching blocks in both directions', () => {
    const anchors = [[0, 0], [100, 400], [500, 600], [1000, 1600]];
    assert.equal(mapScrollPosition(300, anchors, 0), 500);
    assert.equal(mapScrollPosition(500, anchors, 1), 300);
    assert.equal(mapScrollPosition(750, anchors, 0), 1100);
    assert.equal(mapScrollPosition(1100, anchors, 1), 750);
    assert.equal(mapScrollPosition(0, anchors, 0), 0);
});

test('the proof exposes locations for headings, list items, tables and code', () => {
    const target = {};
    renderMarkdown('# Heading\n\n- First\n- Second\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n```js\ncode()\n```\n\n---', target);
    assert.match(target.innerHTML, /<h1 data-source-line="1">/);
    assert.match(target.innerHTML, /<li data-source-line="3">/);
    assert.match(target.innerHTML, /<li data-source-line="4">/);
    assert.match(target.innerHTML, /<table data-source-line="6">/);
    assert.match(target.innerHTML, /<tr data-source-line="8">/);
    assert.match(target.innerHTML, /<pre data-source-line="10"><code/);
    assert.match(target.innerHTML, /<hr data-source-line="14">/);
});

test('empty documents and untrusted HTML still render safely', () => {
    const target = {};
    renderMarkdown('', target);
    assert.equal(target.innerHTML, '');
    renderMarkdown('<script>alert(1)</script>', target);
    assert.ok(!target.innerHTML.includes('<script>'));
});
