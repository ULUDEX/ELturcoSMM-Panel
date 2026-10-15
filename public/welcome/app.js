(() => {
  const qa = (s, r=document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 760px)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

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
    sessionStorage.setItem('elturco_welcome_auth_entry', mode);
    location.href = '/site/?auth=' + encodeURIComponent(mode);
  }));
  qa('[data-assistant-open]').forEach((el) => el.addEventListener('click', () => {
    location.href = '/site/?assistant=1';
  }));



  // Keep the social field light enough for mobile compositing.
  const bg = document.querySelector('.wv-bg-social');
  if (bg) {
    const seeds = [...bg.querySelectorAll('.wv-bg-icon')];
    const layout = [
      [4,9,46,16,-8],[13,13,70,19,10],[23,7,56,13,-12],[35,15,84,21,7],[48,8,52,15,-6],[61,17,72,18,11],[74,9,60,14,-10],[88,15,88,22,8],[96,7,50,17,-5],
      [7,31,78,20,12],[18,37,50,14,-7],[29,28,68,17,9],[42,36,92,23,-11],[55,29,58,15,6],[67,39,76,19,-8],[79,30,54,13,10],[91,38,82,21,-6],
      [3,56,58,14,8],[14,63,86,22,-10],[26,53,52,15,12],[38,64,74,18,-7],[51,55,96,24,9],[64,67,56,14,-11],[76,56,70,17,6],[89,66,90,21,-9],[97,53,48,13,8],
      [8,82,72,18,-12],[21,75,50,14,7],[34,87,88,22,-8],[47,78,58,16,11],[60,89,76,20,-6],[73,80,52,14,9],[85,90,84,21,-10],[95,78,60,16,6]
    ];
    const populate = () => {
    bg.querySelectorAll('[data-generated-bg-icon]').forEach((n) => n.remove());
    const visibleLayout = layout.filter((_, i) => i % (mobile.matches ? 5 : 3) === 0);
    visibleLayout.forEach((item, i) => {
      const source = seeds[i % seeds.length];
      if (!source) return;
      const clone = source.cloneNode(true);
      clone.dataset.generatedBgIcon = '1';
      clone.style.setProperty('--x', item[0] + '%');
      clone.style.setProperty('--y', item[1] + '%');
      clone.style.setProperty('--size', item[2] + 'px');
      clone.style.setProperty('--dur', item[3] + 's');
      clone.style.setProperty('--delay', (-((i * 1.7) % 13)) + 's');
      clone.style.setProperty('--rot', item[4] + 'deg');
      bg.appendChild(clone);
    });
    };
    populate();
    mobile.addEventListener('change', populate);
    seeds.forEach((n) => n.remove());
  }

  // Enable motion only after all handlers are safely installed.
  const updateMotion = () => root.classList.toggle('safe-motion', !reducedMotion.matches);
  updateMotion();
  reducedMotion.addEventListener('change', updateMotion);

  const revealTargets = [
    ...qa('.wv-head'),
    ...qa('.wv-social-card'),
    ...qa('.wv-pane'),
    ...qa('.wv-video'),
    ...qa('.wv-workcard'),
    ...qa('.wv-bottom')
  ];
  revealTargets.forEach((el) => el.classList.add('safe-reveal'));

  if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('safe-visible');
      io.unobserve(entry.target);
    });
  }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });
  revealTargets.forEach((el) => io.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add('safe-visible'));
  }

  const phone = document.querySelector('.wv-phone-wrap');
  const hero = document.querySelector('.wv-hero');
  if (!phone || !hero) return;

  let mx=0,my=0,raf=0,heroVisible=true,heroTop=0,heroHeight=1,viewportHeight=innerHeight;
  const measure=()=>{
    heroTop=hero.getBoundingClientRect().top+scrollY;
    heroHeight=hero.offsetHeight;
    viewportHeight=innerHeight;
  };
  const motionAllowed=()=>heroVisible&&!document.hidden&&!reducedMotion.matches;
  const syncPlayback=()=>{
    root.classList.toggle('welcome-motion-paused', !heroVisible||document.hidden);
    if (!motionAllowed() && raf) { cancelAnimationFrame(raf); raf=0; }
    if (motionAllowed()) schedule();
  };
  const draw=()=>{
    raf=0;
    if(!motionAllowed())return;
    const total=Math.max(1,heroHeight-viewportHeight);
    const p=Math.max(0,Math.min(1,(scrollY-heroTop)/total));
    const x=mx*10, y=my*6 + p*90;
    phone.style.transform='translate(-50%,-50%) translate3d('+x+'px,'+y+'px,0) scale('+(1-p*.1)+') rotateX('+(p*8-my*2)+'deg) rotateZ('+(-p*3+mx)+'deg)';
  };
  const schedule=()=>{ if(motionAllowed()&&!raf) raf=requestAnimationFrame(draw); };
  addEventListener('pointermove',(e)=>{if(!finePointer.matches||!motionAllowed())return;mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5;schedule();},{passive:true});
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',()=>{measure();schedule();},{passive:true});
  addEventListener('pageshow',()=>{measure();syncPlayback();});
  document.addEventListener('visibilitychange',syncPlayback);
  reducedMotion.addEventListener('change',()=>{
    if(reducedMotion.matches)phone.style.removeProperty('transform');
    syncPlayback();
  });
  if('IntersectionObserver' in window){
    const heroObserver=new IntersectionObserver(([entry])=>{heroVisible=entry.isIntersecting;syncPlayback();});
    heroObserver.observe(hero);
  }
  if('ResizeObserver' in window)new ResizeObserver(()=>{measure();schedule();}).observe(hero);
  measure();
  syncPlayback();
  draw();
})();
