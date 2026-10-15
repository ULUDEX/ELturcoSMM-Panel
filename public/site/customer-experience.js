(() => {
  const form = document.querySelector('#auth-form');
  if (form) {
    const links = document.createElement('nav');
    links.className = 'experience-help-links';
    links.setAttribute('aria-label', 'Hesap yardımı');
    links.innerHTML = '<a href="/welcome/">← Ana sayfa</a><a href="/site/info.html?page=how">Kullanım rehberi</a><a href="/site/info.html?page=privacy">Gizlilik</a>';
    form.after(links);
  }
  // Store service IDs only, never account details, prices or order targets.
  const key = 'elturco_saved_services_v1';
  let saved = [];
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(value)) saved = [...new Set(value.filter(Number.isSafeInteger).filter(id => id > 0))].slice(0, 20);
  } catch {}
  const host = document.querySelector('#service-list');
  const selector = document.querySelector('#service-select');
  if (!host || !selector) return;
  const shelf = document.createElement('section');
  shelf.className = 'experience-saved';
  shelf.setAttribute('aria-label', 'Kaydettiğim hizmetler');
  host.before(shelf);
  const save = document.createElement('button');
  save.className = 'experience-save';
  save.type = 'button';
  save.hidden = true;
  const info = document.querySelector('#service-info');
  (info || selector).after(save);
  function persist() { try { localStorage.setItem(key, JSON.stringify(saved)); } catch {} }
  function draw() {
    shelf.replaceChildren();
    const title = document.createElement('h3'); title.textContent = 'Kaydettiğim hizmetler';
    const note = document.createElement('p'); note.textContent = 'Bu cihazda saklanır. Hizmeti seçtiğinde güncel fiyat ve koşulları kontrol et. Sipariş otomatik oluşturulmaz.';
    shelf.append(title, note);
    const list = document.createElement('div'); list.className = 'experience-saved-items';
    for (const id of saved) {
      const service = services.find(item => item.id === id);
      const item = document.createElement('div'); item.className = 'experience-saved-item';
      const open = document.createElement('button'); open.type = 'button';
      open.textContent = service ? service.name : '#' + id + ' · şu anda listede yok';
      open.disabled = !service;
      open.onclick = () => chooseService(id);
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×';
      remove.setAttribute('aria-label', '#' + id + ' hizmetini kayıtlardan çıkar');
      remove.onclick = () => { saved = saved.filter(value => value !== id); persist(); draw(); };
      item.append(open, remove); list.append(item);
    }
    if (!saved.length) {
      const empty = document.createElement('p'); empty.textContent = 'Yeni siparişte bir hizmet seçip kaydederek buraya ekleyebilirsin.'; list.append(empty);
    }
    shelf.append(list);
    const id = Number(selector.value);
    save.hidden = !services.some(item => item.id === id);
    save.textContent = saved.includes(id) ? '★ Kaydedildi · Kaldır' : '☆ Hizmeti kaydet';
    save.setAttribute('aria-pressed', String(saved.includes(id)));
  }
  save.onclick = () => {
    const id = Number(selector.value);
    if (!services.some(item => item.id === id)) return;
    if (saved.includes(id)) saved = saved.filter(value => value !== id);
    else if (saved.length < 20) saved.push(id);
    else { toast('En fazla 20 hizmet kaydedebilirsin. Önce bir hizmeti kaldır.'); return; }
    persist(); draw();
  };
  selector.addEventListener('change', draw);
  new MutationObserver(draw).observe(host, { childList: true });
  draw();
})();
