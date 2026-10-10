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
  let ready = false;
  let fallbackTimer;
  const api = window.Tawk_API = window.Tawk_API || {};
  const previousOnLoad = api.onLoad;
  function syncLanguage(){const locale=selected();if(locale===loaded||switching||typeof api.switchWidget!=='function')return;if(typeof api.isChatOngoing==='function'&&api.isChatOngoing())return;const opened=typeof api.isChatMaximized==='function'&&api.isChatMaximized();switching=true;api.switchWidget({propertyId,widgetId:widgets[locale]},error=>{switching=false;if(!error){loaded=locale;failed=false;if(opened&&typeof api.maximize==='function')api.maximize();if(selected()!==loaded)syncLanguage()}else failed=true})}
  document.addEventListener('elturco:language',syncLanguage);
  const previousOnChatEnded=api.onChatEnded;
  api.onChatEnded=function(){if(typeof previousOnChatEnded==='function')previousOnChatEnded.apply(this,arguments);syncLanguage()};
  api.onLoad = function () {
    ready = true;
    failed = false;
    document.getElementById('live-support-fallback')?.remove();
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
    if (ready && !failed && typeof api.maximize === 'function') {
      try { api.maximize(); return; } catch { failed = true; }
    }
    if (failed) {
      window.location.assign(chatUrl());
      return;
    }
    pendingOpen = true;
    clearTimeout(fallbackTimer);
    fallbackTimer = setTimeout(() => {
      // If a blocker prevents the widget from loading, offer a normal chat link.
      failed = true;
      offerFallback();
      pendingOpen = false;
    }, 5000);
  });
  function offerFallback(){
    if(document.getElementById('live-support-fallback'))return;
    const box=document.createElement('aside');box.id='live-support-fallback';box.setAttribute('role','status');
    box.style.cssText='position:fixed;right:16px;bottom:96px;z-index:10000;max-width:300px;padding:16px;border:1px solid #334155;border-radius:16px;background:#101827;color:#fff;box-shadow:0 12px 40px #0006;font:13px/1.6 Arial,sans-serif';
    const message=document.createElement('p');message.textContent='Canlı sohbet yüklenemedi. Destek sayfasından devam edebilirsin.';message.style.margin='0 0 10px';
    const link=document.createElement('a');link.href=chatUrl();link.textContent='Canlı desteği aç →';link.style.cssText='display:block;color:#fff;background:#713de0;border-radius:9px;padding:9px 12px;text-decoration:none';
    const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Kapat');close.style.cssText='position:absolute;right:5px;top:0;background:none;border:0;color:#fff;font-size:20px;cursor:pointer';close.onclick=()=>box.remove();box.append(message,link,close);document.body.append(box);window.ElTurcoI18n?.refresh();
  }
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
