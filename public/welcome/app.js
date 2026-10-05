(() => {
  const qa = (s, r=document) => [...r.querySelectorAll(s)];

  fetch('/api/site-config', { cache: 'no-store' })
    .then((r) => r.ok ? r.json() : null)
    .then((data) => {
      const allowed = new Set(['cinematic','classic-purple','midnight-glass','neon-grid']);
      document.documentElement.dataset.welcomeTheme =
        allowed.has(data?.settings?.welcome_theme) ? data.settings.welcome_theme : 'cinematic';
    })
    .catch(() => { document.documentElement.dataset.welcomeTheme = 'cinematic'; });

  qa('[data-account]').forEach((el) => el.addEventListener('click', () => {
    const mode = el.getAttribute('data-account') || 'login';
    location.href = '/site/?auth=' + encodeURIComponent(mode);
  }));
  qa('[data-assistant-open]').forEach((el) => el.addEventListener('click', () => {
    location.href = '/site/?assistant=1';
  }));


  // Enable motion only after all handlers are safely installed.
  document.documentElement.classList.add('safe-motion');

  const revealTargets = [
    ...qa('.wv-head'),
    ...qa('.wv-social-card'),
    ...qa('.wv-pane'),
    ...qa('.wv-video'),
    ...qa('.wv-workcard'),
    ...qa('.wv-trial-card'),
    ...qa('.wv-bottom')
  ];
  revealTargets.forEach((el) => el.classList.add('safe-reveal'));

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('safe-visible');
      io.unobserve(entry.target);
    });
  }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });
  revealTargets.forEach((el) => io.observe(el));

  const phone = document.querySelector('.wv-phone-wrap');
  const hero = document.querySelector('.wv-hero');
  if (!phone || !hero) return;

  let mx=0,my=0,raf=0;
  const draw=()=>{
    raf=0;
    const rect=hero.getBoundingClientRect();
    const total=Math.max(1,hero.offsetHeight-innerHeight);
    const p=Math.max(0,Math.min(1,-rect.top/total));
    const x=mx*10, y=my*6 + p*90;
    phone.style.transform='translate(-50%,-50%) translate3d('+x+'px,'+y+'px,0) scale('+(1-p*.1)+') rotateX('+(p*8-my*2)+'deg) rotateZ('+(-p*3+mx)+'deg)';
  };
  const schedule=()=>{ if(!raf) raf=requestAnimationFrame(draw); };
  addEventListener('mousemove',(e)=>{mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5;schedule();},{passive:true});
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule,{passive:true});
  draw();
})();