(() => {
  'use strict';
  const propertyId='6ac60b8069205a34bff50751';
  const widgets={tr:'1k4appsfq',en:'1k4io5tj7',fr:'1k4iokblt',uk:'1k4ioo1qu',it:'1k4iorkre',ru:'1k4iou0p3',de:'1k4ip13l3','pt-BR':'1k4ip3spq',es:'1k4ip6lrj'};
  const selected=()=>{const value=localStorage.getItem('elturco_language')||'tr';return value==='pt'?'pt-BR':widgets[value]?value:'tr'};
  let loaded=selected(),switching=false;
  const chatUrl=()=>`https://tawk.to/chat/${propertyId}/${widgets[selected()]}?layout=modern`;
  const embedUrl=`https://embed.tawk.to/${propertyId}/${widgets[loaded]}`;
  let pendingOpen = false;
  let failed = false;
  let fallbackTimer;
  const api = window.Tawk_API = window.Tawk_API || {};
  const previousOnLoad = api.onLoad;
  function syncLanguage(){const locale=selected();if(locale===loaded||switching||typeof api.switchWidget!=='function')return;if(typeof api.isChatOngoing==='function'&&api.isChatOngoing())return;const opened=typeof api.isChatMaximized==='function'&&api.isChatMaximized();switching=true;api.switchWidget({propertyId,widgetId:widgets[locale]},error=>{switching=false;if(!error){loaded=locale;failed=false;if(opened&&typeof api.maximize==='function')api.maximize();if(selected()!==loaded)syncLanguage()}else failed=true})}
  document.addEventListener('elturco:language',syncLanguage);
  const previousOnChatEnded=api.onChatEnded;
  api.onChatEnded=function(){if(typeof previousOnChatEnded==='function')previousOnChatEnded.apply(this,arguments);syncLanguage()};
  api.onLoad = function () {
    clearTimeout(fallbackTimer);
    if (typeof previousOnLoad === 'function') previousOnLoad.apply(this, arguments);
    syncLanguage();
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
      window.open(chatUrl(), '_blank', 'noopener,noreferrer');
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
