(() => {
  'use strict';
  const chatUrl = 'https://tawk.to/chat/6ac60b8069205a34bff50751/1k4appsfq?layout=modern';
  const embedUrl = 'https://embed.tawk.to/6ac60b8069205a34bff50751/1k4appsfq';
  let pendingOpen = false;
  let failed = false;
  let fallbackTimer;
  const api = window.Tawk_API = window.Tawk_API || {};
  const previousOnLoad = api.onLoad;
  api.onLoad = function () {
    clearTimeout(fallbackTimer);
    if (typeof previousOnLoad === 'function') previousOnLoad.apply(this, arguments);
    if (pendingOpen && typeof api.maximize === 'function') {
      pendingOpen = false;
      api.maximize();
    }
  };
  document.addEventListener('click', (event) => {
    const button = event.target instanceof Element && event.target.closest('[data-live-support]');
    if (!button) return;
    event.preventDefault();
    if (typeof api.maximize === 'function') return api.maximize();
    if (failed) {
      window.open(chatUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    pendingOpen = true;
    clearTimeout(fallbackTimer);
    fallbackTimer = setTimeout(() => {
      // If a blocker prevents the widget from loading, offer a normal chat link.
      failed = true;
      button.textContent = 'Sohbeti yeni sekmede aç';
      pendingOpen = false;
    }, 8000);
  });
  if (document.querySelector('script[src="' + embedUrl + '"]')) return;
  window.Tawk_LoadStart = new Date();
  const script = document.createElement('script');
  script.async = true;
  script.src = embedUrl;
  script.charset = 'UTF-8';
  script.setAttribute('crossorigin', '*');
  script.onerror = () => { failed = true; };
  document.head.appendChild(script);
})();
