(() => {
  const form = document.querySelector('#profile-edit-form');
  document.querySelector('#account-settings-open')?.addEventListener('click', () => {
    form.elements.name.value = account?.name || '';
  });
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button'), feedback = document.querySelector('#profile-edit-feedback');
    button.disabled = true; feedback.textContent = 'Kaydediliyor…';
    try {
      const response = await fetch('/api/account/profile', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({name:form.elements.name.value})});
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Profil kaydedilemedi.');
      account = data.user;
      for (const id of ['account-label','account-name','settings-account-name']) document.getElementById(id).textContent = account.name;
      document.querySelector('#order-form [name=name]').value = account.name;
      feedback.textContent = 'Profilin kaydedildi.';
    } catch (error) { feedback.textContent = error.message || 'Bağlantı kurulamadı.'; }
    finally { button.disabled = false; }
  });
  const retry = document.createElement('button');
  retry.type = 'button'; retry.className = 'catalog-retry'; retry.textContent = 'Hizmetleri yeniden yükle';
  retry.onclick = async () => {retry.disabled=true; await loadServices(); renderCatalogFilters(); retry.disabled=false;};
  document.querySelector('#service-list')?.after(retry);
  const reset = document.createElement('button'); reset.type='button'; reset.className='catalog-retry'; reset.textContent='Filtreleri temizle';
  reset.onclick=()=>{catalogPlatform='';catalogCountry='';catalogCategory='';catalogRefill='all';catalogSort='popular';catalogLimit=100;document.querySelector('#service-search').value='';document.querySelector('#refill-filter').value='all';document.querySelector('#service-sort').value='popular';renderCatalogFilters();renderServices('');};
  retry.after(reset);
  fetch('/api/site-config').then(r=>r.json()).then(data=>{
    const news=(data.content||[]).filter(x=>x.module==='news'&&x.active);
    const board=document.createElement('section');board.className='settings-section announcement-board';board.setAttribute('aria-label','Duyurular');
    const heading=document.createElement('h3');heading.textContent='Duyurular';board.append(heading);
    if(news.length)for(const row of news){const item=document.createElement('article'),title=document.createElement('b'),body=document.createElement('p');title.textContent=row.data.title;body.textContent=row.data.body;item.append(title,body);board.append(item)}
    else{const empty=document.createElement('p');empty.textContent='Yeni duyuru bulunmuyor.';board.append(empty)}
    document.querySelector('#new-services-section')?.before(board);
    if(!data.privatePreview)return;
    const start=document.createElement('button');start.type='button';start.className='submit-order preview-account-start';start.textContent='ChatGPT hesabımla test panelini aç';
    start.onclick=async()=>{start.disabled=true;try{const response=await fetch('/api/account/preview',{method:'POST'});if(!response.ok)throw Error();await loadAccount()}catch{toast('Test oturumu açılamadı. Sayfayı yenileyip tekrar dene.')}finally{start.disabled=false}};
    document.querySelector('.auth-tabs')?.after(start);
    const note=document.createElement('div'); note.className='private-preview-banner';note.textContent='Özel test ortamı · Kayıt ve profil kalıcıdır. Gerçek ödeme ve dış servis siparişi kapalıdır.';
    document.body.prepend(note);
    document.querySelectorAll('[data-pay]').forEach(button=>{button.disabled=true;button.title='Özel test ortamında ödeme alınmıyor.';});
  }).catch(()=>{});
  document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;document.querySelectorAll('.ops-modal.show').forEach(el=>el.classList.remove('show'));document.body.classList.remove('auth-modal-open');});
})();
