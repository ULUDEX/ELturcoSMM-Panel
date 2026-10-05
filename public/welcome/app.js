(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const q = (s, r=document) => r.querySelector(s);
  const qa = (s, r=document) => [...r.querySelectorAll(s)];
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));

  fetch('/api/site-config', { cache: 'no-store' })
    .then((r) => r.ok ? r.json() : null)
    .then((data) => {
      const allowed = new Set(['cinematic','classic-purple','midnight-glass','neon-grid']);
      document.documentElement.dataset.welcomeTheme =
        allowed.has(data?.settings?.welcome_theme) ? data.settings.welcome_theme : 'cinematic';
    })
    .catch(() => { document.documentElement.dataset.welcomeTheme = 'cinematic'; });

  qa('[data-account]').forEach((el) => {
    el.addEventListener('click', () => {
      const mode = el.getAttribute('data-account') || 'login';
      location.href = '/site/?auth=' + encodeURIComponent(mode);
    });
  });
  qa('[data-assistant-open]').forEach((el) => {
    el.addEventListener('click', () => { location.href = '/site/?assistant=1'; });
  });

  const hero = q('.wv-hero');
  const phoneWrap = q('.wv-phone-wrap');
  const orbit = q('.wv-orbit-stage');
  const title = q('.wv-title');
  const sub = q('.wv-sub');
  const kicker = q('.wv-kicker');
  const floats = qa('.wv-float');
  const rings = qa('.wv-ring');
  const logos = qa('.wv-logo');
  const socialCard = q('.wv-social-card');
  const panes = qa('.wv-pane');
  const video = q('.wv-video');
  const demoPhone = q('.wv-demo-phone');
  const workCards = qa('.wv-workcard');
  const trialCards = qa('.wv-trial-card');
  const bottom = q('.wv-bottom');

  document.documentElement.classList.add('motion-ready');

  const revealTargets = [
    ...qa('.wv-head'),
    socialCard,
    video,
    ...workCards,
    ...trialCards,
    bottom
  ].filter(Boolean);

  revealTargets.forEach((el) => el.classList.add('wv-reveal'));
  panes.forEach((el, i) => {
    el.classList.add('wv-reveal-side');
    el.dataset.side = i === 0 ? 'left' : 'right';
  });

  if (reduce) {
    document.documentElement.classList.add('motion-reduced');
    qa('.wv-reveal,.wv-reveal-side').forEach(el => el.classList.add('is-visible'));
    return;
  }

  // Initial cinematic entrance.
  requestAnimationFrame(() => {
    document.documentElement.classList.add('wv-loaded');
  });

  // Reveal sections on approach.
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      io.unobserve(entry.target);
    }
  }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });

  qa('.wv-reveal,.wv-reveal-side').forEach(el => io.observe(el));

  let mouseX = 0, mouseY = 0, scrollY = window.scrollY, raf = 0;

  const draw = () => {
    raf = 0;
    const vh = innerHeight || 1;

    if (hero && phoneWrap) {
      const rect = hero.getBoundingClientRect();
      const total = Math.max(1, hero.offsetHeight - vh);
      const passed = clamp(-rect.top, 0, total);
      const p = passed / total;

      const tx = mouseX * 18;
      const ty = mouseY * 10 + p * 145;
      const scale = 1 - p * .18;
      const rx = p * 14 + (-mouseY * 2.5);
      const rz = -p * 5 + mouseX * 1.6;

      phoneWrap.style.transform =
        `translate(-50%,-50%) translate3d(${tx}px,${ty}px,0) scale(${scale}) rotateX(${rx}deg) rotateZ(${rz}deg)`;

      if (title) {
        title.style.transform =
          `translateX(-50%) translateY(${p * -28}px) scale(${1 + p * .03})`;
        title.style.opacity = String(1 - p * .32);
      }
      if (sub) {
        sub.style.transform = `translateX(-50%) translateY(${p * -18}px)`;
        sub.style.opacity = String(1 - p * .45);
      }
      if (kicker) kicker.style.transform = `translateY(${p * -12}px)`;

      floats.forEach((el, i) => {
        const dir = i % 2 === 0 ? -1 : 1;
        el.style.transform = i === 2
          ? `translateX(-50%) translateY(${p * (20 + i*11)}px) scale(${1 - p*.05})`
          : `translate3d(${dir * p * (22 + i*8)}px,${p * (18 + i*12)}px,0)`;
        el.style.opacity = String(1 - p * .5);
      });

      rings.forEach((el, i) => {
        el.style.opacity = String(.85 - p * (.2 + i*.07));
        el.style.scale = String(1 + p * (.08 + i*.035));
      });

      if (orbit) orbit.style.animationDuration = (26 - p * 11) + 's';
      logos.forEach((logo, i) => {
        logo.style.filter = `brightness(${1 + Math.sin(p*8+i)*.12}) drop-shadow(0 0 ${8 + p*14}px rgba(151,88,255,.22))`;
      });
    }

    // Parallax inside the explainer block.
    if (video) {
      const vr = video.getBoundingClientRect();
      const vp = clamp((vh - vr.top) / (vh + vr.height), 0, 1);
      if (demoPhone) {
        demoPhone.style.transform =
          `translate(-50%,-50%) translateY(${(vp-.5)*-28}px) rotate(${-12 + vp*7}deg) scale(${.94 + vp*.08})`;
      }
      video.style.setProperty('--wv-video-shift', `${(vp-.5)*40}px`);
    }

    scrollY = window.scrollY;
  };

  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(draw);
  };

  addEventListener('mousemove', (e) => {
    mouseX = e.clientX / innerWidth - .5;
    mouseY = e.clientY / innerHeight - .5;
    schedule();
  }, { passive:true });

  addEventListener('scroll', schedule, { passive:true });
  addEventListener('resize', schedule, { passive:true });

  draw();
})();