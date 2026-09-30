import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const source = Array.from({ length: 80 }, (_, index) => `## Section ${index + 1}\n\nParagraph ${index + 1}. ${'Long text with **emphasis** and [links](https://example.com). '.repeat(index % 4 + 2)}\n\n- First item\n- Second item\n\n> A quote for section ${index + 1}.\n\n\`\`\`js\nconst section = ${index + 1};\n\`\`\`\n`).join('\n');
const settle = (page) => page.waitForTimeout(250);

test('editing stays in view and both panes follow matching source blocks', { timeout: 120000 }, async () => {
    const server = await createServer({ server: { host: '127.0.0.1', port: 1421, strictPort: false } });
    let browser;
    try {
        await server.listen();
        browser = await chromium.launch({ channel: process.env.FOLIO_BROWSER_CHANNEL || undefined });
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
        await page.locator('#edit-toggle').click();
        await page.evaluate(async (text) => {
            window.driver = await import('/tests/browser-driver.js');
            window.driver.setEditorContent(text);
        }, source);
        await settle(page);
        assert.equal(await page.locator('vite-error-overlay').count(), 0);
        assert.equal(await page.locator('#proof-content h2').count(), 80);

        async function placeAt(line) {
            await page.evaluate((number) => {
                const view = window.driver.editor();
                const position = view.state.doc.line(number).from;
                view.dispatch({ selection: { anchor: position } });
                view.focus();
                view.scrollDOM.dispatchEvent(new Event('pointerdown'));
                view.scrollDOM.scrollTop += view.documentTop + view.lineBlockAt(position).top - view.scrollDOM.getBoundingClientRect().top - 180;
            }, line);
            await settle(page);
        }

        async function alignment() {
            const result = await page.evaluate(() => {
                const view = window.driver.editor();
                const proof = document.querySelector('#proof-content');
                const proofTop = proof.getBoundingClientRect().top;
                const sourceTop = view.scrollDOM.getBoundingClientRect().top - view.documentTop;
                const sourceLine = view.state.doc.lineAt(view.lineBlockAtHeight(sourceTop).from).number;
                const blocks = [...proof.querySelectorAll('[data-source-line]')]
                    .map((element) => ({ line: Number(element.dataset.sourceLine), top: element.getBoundingClientRect().top - proofTop }))
                    .sort((a, b) => a.top - b.top || a.line - b.line);
                const before = blocks.filter((block) => block.top <= 1).at(-1);
                const after = blocks.find((block) => block.top > 1 && block.line > (before?.line ?? 0));
                // Both viewport tops must fall in the same Markdown block or
                // its adjoining blank line, regardless of fonts/block heights.
                const first = before?.line ?? 1;
                const last = after?.line ?? view.state.doc.lines;
                return { difference: Math.max(0, first - sourceLine, sourceLine - last), sourceLine, first, last,
                    manuscriptScroll: view.scrollDOM.scrollTop, proofScroll: proof.scrollTop };
            });
            if (result.difference > 1) console.log('Alignment mismatch:', result);
            return result.difference;
        }

        await placeAt(300);
        const caretTop = () => page.evaluate(() => {
            const view = window.driver.editor();
            return view.coordsAtPos(view.state.selection.main.head)?.top;
        });
        const before = await caretTop();
        // Changing the proof's height above the viewport used to feed a scroll
        // back into the manuscript, moving the selection out of sight.
        for (let index = 0; index < 12; index += 1) {
            await page.evaluate((iteration) => {
                const view = window.driver.editor();
                const line = view.state.doc.line(3);
                const insert = iteration % 2 ? 'Short text.' : 'Expanded paragraph. '.repeat(50);
                view.dispatch({ changes: { from: line.from, to: line.to, insert } });
            }, index);
            await settle(page);
            const position = await caretTop();
            assert.ok(Number.isFinite(position) && Math.abs(position - before) < 2,
                `Editing moved the caret by ${position - before}px`);
        }

        await page.keyboard.type('Editing should stay in view.');
        await settle(page);
        assert.ok(await page.evaluate(() => {
            const view = window.driver.editor();
            const cursor = view.coordsAtPos(view.state.selection.main.head);
            const bounds = view.scrollDOM.getBoundingClientRect();
            return cursor && cursor.top >= bounds.top && cursor.bottom <= bounds.bottom;
        }), 'The caret left the manuscript viewport');

        // Different block heights, forward and reverse scroll, and many jumps.
        for (const line of [90, 440, 180, 630, 300]) {
            await placeAt(line);
            const difference = await alignment();
            assert.ok(difference <= 1, `Source and proof drifted by ${difference} source lines at line ${line}`);
        }
        await page.locator('#proof-content').evaluate((element) => {
            element.dispatchEvent(new Event('pointerdown'));
            element.scrollTop += 400;
        });
        await settle(page);
        assert.ok(await alignment() <= 1, 'Scrolling the proof did not align the manuscript');

        for (const selector of ['#text-larger', '#text-smaller']) {
            await page.locator(selector).click();
            await settle(page);
            assert.ok(await alignment() <= 1, 'Changing text size broke alignment');
        }
        await page.locator('.cm-content').click();
        await page.keyboard.press('Alt+z');
        await settle(page);
        await placeAt(300);
        assert.ok(await alignment() <= 1, 'Changing wrapping broke alignment');
        await page.keyboard.press('Alt+z');
        await page.locator('#editing-view').evaluate((element) => {
            element.style.gridTemplateColumns = 'minmax(260px, .7fr) 28px minmax(260px, .3fr)';
        });
        await settle(page);
        await placeAt(300);
        assert.ok(await alignment() <= 1, 'Resizing the panes broke alignment');

        for (const fraction of [0, 1]) {
            await page.locator('.cm-scroller').evaluate((element, value) => {
                element.dispatchEvent(new Event('pointerdown'));
                element.scrollTop = value * (element.scrollHeight - element.clientHeight);
            }, fraction);
            await settle(page);
            assert.ok(await page.locator('#proof-content').evaluate((element, value) =>
                Math.abs(element.scrollTop - value * (element.scrollHeight - element.clientHeight)) < 2, fraction));
        }
        await page.locator('#edit-toggle').click();
        await page.locator('#edit-toggle').click();
        await settle(page);
        await page.evaluate(() => window.driver.setEditorContent('A short document.'));
        await settle(page);
        assert.equal(await page.locator('.cm-scroller').evaluate((element) => element.scrollTop), 0);
        assert.equal(await page.locator('#proof-content').evaluate((element) => element.scrollTop), 0);
        assert.deepEqual(errors, []);
    } finally {
        await browser?.close();
        await server.close();
    }
});
