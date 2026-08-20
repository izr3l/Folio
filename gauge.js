export function updateGauge(source) {
    const words = source.trim() ? source.trim().split(/\s+/).length : 0;
    const chars = source.length;
    const minutes = Math.max(1, Math.ceil(words / 220));
    document.querySelector('#word-count').textContent = `${words} words`;
    document.querySelector('#char-count').textContent = `${chars} chars`;
    document.querySelector('#read-time').textContent = `${minutes} min read`;

    const ticks = document.querySelector('#gauge-ticks');
    ticks.innerHTML = '';
    const count = Math.min(18, Math.max(3, Math.ceil(words / 90)));
    for (let index = 0; index < count; index += 1) {
        const tick = document.createElement('i');
        tick.style.top = `${10 + (index / Math.max(1, count - 1)) * 68}%`;
        ticks.append(tick);
    }
}

export function enableGaugeResize() {
    const rail = document.querySelector('#gauge-rail');
    const layout = document.querySelector('#editing-view');
    let dragging = false;
    rail.addEventListener('pointerdown', (event) => {
        if (window.innerWidth <= 760) return;
        dragging = true;
        rail.setPointerCapture(event.pointerId);
    });
    rail.addEventListener('pointermove', (event) => {
        if (!dragging) return;
        const bounds = layout.getBoundingClientRect();
        const ratio = Math.min(.72, Math.max(.28, (event.clientX - bounds.left) / bounds.width));
        layout.style.gridTemplateColumns = `minmax(260px, ${ratio}fr) 28px minmax(260px, ${1 - ratio}fr)`;
    });
    rail.addEventListener('pointerup', () => { dragging = false; });
}
