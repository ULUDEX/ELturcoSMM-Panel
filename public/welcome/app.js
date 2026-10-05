
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  fetch('/api/site-config', { cache: 'no-store' })
    .then((r) => r.ok ? r.json() : null)
    .then((data) => {
      const allowed = new Set(['cinematic','classic-purple','midnight-glass','neon-grid']);
      const theme = allowed.has(data?.settings?.welcome_theme) ? data.settings.welcome_theme : 'cinematic';
      document.documentElement.dataset.welcomeTheme = theme;
    })
    .catch(() => { document.documentElement.dataset.welcomeTheme = 'cinematic'; });

  const phone = document.querySelector('.wv-phone-wrap');
  const orbit = document.querySelector('.wv-orbit-stage');
  const hero = document.querySelector('.wv-hero');
  const logos = [...document.querySelectorAll('.wv-logo')];

  document.querySelectorAll('[data-account]').forEach((el) => {
    el.addEventListener('click', () => {
      const mode = el.getAttribute('data-account') || 'login';
      location.href = '/site/?auth=' + encodeURIComponent(mode);
    });
  });
  document.querySelectorAll('[data-assistant-open]').forEach((el) => {
    el.addEventListener('click', () => { location.href = '/site/?assistant=1'; });
  });

  if (!reduce) {
    addEventListener('mousemove', (e) => {
      if (!phone) return;
      const x = (e.clientX / innerWidth - .5) * 18;
      const y = (e.clientY / innerHeight - .5) * 10;
      phone.style.marginLeft = x + 'px';
      phone.style.marginTop = y + 'px';
    }, { passive:true });

    let ticking = false;
    const update = () => {
      ticking = false;
      if (!hero || !phone) return;
      const rect = hero.getBoundingClientRect();
      const total = hero.offsetHeight - innerHeight;
      const passed = Math.max(0, Math.min(total, -rect.top));
      const p = total > 0 ? passed / total : 0;
      phone.style.transform =
        'translate(-50%,-50%) translateY(' + (p*155) + 'px) scale(' + (1-p*.20) + ') rotateX(' + (p*14) + 'deg) rotateZ(' + (-p*5) + 'deg)';
      if (orbit) orbit.style.animationDuration = (26 - p*10) + 's';
      logos.forEach((logo, i) => {
        logo.style.filter = 'brightness(' + (1 + Math.sin(p*7+i)*.08) + ')';
      });
    };
    addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive:true });
    update();
  }
})();