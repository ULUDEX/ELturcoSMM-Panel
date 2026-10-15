(() => {
  const host = document.querySelector('#new-services-list');
  if (!host) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let timer, paused = reduced.matches, visible = true, hovering = false, focused = false;
  let track, resizeObserver;
  function measure() {
    const first = track?.firstElementChild;
    if (!first) return { count: 0, page: 0, index: 0 };
    const width = first.getBoundingClientRect().width + 12;
    return { count: track.children.length, page: Math.max(1, Math.round((track.clientWidth + 12) / width)), index: Math.round(track.scrollLeft / width) };
  }
  function update() {
    const { count, page, index } = measure();
    const status = host.querySelector('[data-slide-status]');
    if (status) status.textContent = count ? (index + 1) + '–' + Math.min(count, index + page) + ' / ' + count : '';
    const toggle = host.querySelector('[data-slide-pause]');
    if (toggle) { toggle.textContent = paused ? 'Oynat' : 'Duraklat'; toggle.setAttribute('aria-pressed', String(paused)); toggle.hidden = count <= page || reduced.matches; }
    for (const button of host.querySelectorAll('[data-slide-prev],[data-slide-next]')) button.disabled = count <= page;
  }
  function move(direction) {
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    const next = direction > 0 && track.scrollLeft >= max - 4 ? 0 : direction < 0 && track.scrollLeft <= 4 ? max : track.scrollLeft + direction * (track.clientWidth + 12);
    track.scrollTo({ left: Math.max(0, Math.min(max, next)), behavior: reduced.matches ? 'instant' : 'smooth' });
  }
  function sync() {
    clearInterval(timer);
    if (!paused && !reduced.matches && !hovering && !focused && visible && !document.hidden && track && track.scrollWidth > track.clientWidth + 4) timer = setInterval(() => move(1), 6000);
    update();
  }
  function setup() {
    clearInterval(timer); resizeObserver?.disconnect();
    track = host.querySelector('.new-services-track');
    if (!track) return;
    track.addEventListener('scroll', update, { passive: true });
    host.querySelector('[data-slide-prev]').onclick = () => move(-1);
    host.querySelector('[data-slide-next]').onclick = () => move(1);
    host.querySelector('[data-slide-pause]').onclick = () => { paused = !paused; sync(); };
    if ('ResizeObserver' in window) { resizeObserver = new ResizeObserver(sync); resizeObserver.observe(track); }
    sync();
  }
  host.addEventListener('mouseenter', () => { hovering = true; sync(); });
  host.addEventListener('mouseleave', () => { hovering = false; sync(); });
  host.addEventListener('focusin', () => { focused = true; sync(); });
  host.addEventListener('focusout', event => { if (!host.contains(event.relatedTarget)) { focused = false; sync(); } });
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', () => { if (reduced.matches) paused = true; sync(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(host);
  new MutationObserver(setup).observe(host, { childList: true });
  setup();
})();
