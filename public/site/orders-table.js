/* Pure presentation helpers. Eligibility is decided by the authenticated API. */
const pendingOrderActions=new Set();
function bindOrderTable(host){
 if(!host)return;
 let feedback=document.querySelector('#orders-action-feedback');
 if(!feedback){feedback=document.createElement('p');feedback.id='orders-action-feedback';feedback.className='orders-action-feedback';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');host.before(feedback)}
 host.querySelectorAll('[data-copy-order]').forEach(button=>button.onclick=async()=>{const row=orderRows.find(order=>Number(order.id)===Number(button.dataset.copyOrder));if(!row?.link)return;try{await navigator.clipboard.writeText(row.link);feedback.textContent='Sipariş #'+row.id+' bağlantısı kopyalandı.'}catch{feedback.textContent='Bağlantı kopyalanamadı. Satırdaki bağlantıyı seçerek kopyalayabilirsin.'}});
 host.querySelectorAll('[data-order-action]').forEach(button=>{
  const id=Number(button.dataset.id);button.disabled=pendingOrderActions.has(id);
  button.onclick=async()=>{
   if(pendingOrderActions.has(id))return;
   pendingOrderActions.add(id);button.disabled=true;
   feedback.textContent='Sipariş #'+id+' için talep gönderiliyor…';
   try{
    const response=await fetch('/api/orders',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify({action:button.dataset.orderAction,id})}),data=await response.json();
    feedback.textContent='Sipariş #'+id+' · '+(data.message||data.error||'İşlem tamamlanamadı.');
    const row=orderRows.find(order=>Number(order.id)===id);
    if(row&&data.action){row.providerAction=data.action;if(!data.action.endsWith('_failed')){row.canRefill=false;row.canCancel=false}}
    await renderLocalOrders();
    if(response.ok)await loadNotifications();
   }catch{feedback.textContent='Sipariş #'+id+' · Talebin sonucu alınamadı. Yeniden göndermeden önce listeyi yenile veya destekle görüş.';const row=orderRows.find(order=>Number(order.id)===id);if(row){row.canRefill=false;row.canCancel=false}await renderLocalOrders()}
   finally{pendingOrderActions.delete(id);host.querySelectorAll('[data-order-action]').forEach(control=>control.disabled=pendingOrderActions.has(Number(control.dataset.id)))}
  };
 });
}
function orderRefillControl(order){
 const states={refill_sending:'Gönderiliyor',refill_requested:'Telafi bekliyor',refill_completed:'Telafi tamamlandı',refill_uncertain:'Kontrol gerekli'};
 if(order.canRefill===true)return '<button type="button" class="order-refill" data-order-action="refill" data-id="'+Number(order.id)+'">↻ Telafi iste</button>';
 const label=states[order.providerAction]||(order.refillSupported===false?'Telafi yok':order.refillSupported===true?'Telafi kapalı':'—');
 const reason=order.refillUnavailableReason||'Bu sipariş için telafi bilgisi bulunmuyor.';
 return '<span class="order-refill-note" title="'+escapeHtml(reason)+'">'+escapeHtml(label)+'</span>'+(order.providerAction==='refill_uncertain'?'<button type="button" data-live-support>Destek</button>':'');
}
function orderTableMarkup(rows){
 if(!rows.length)return '<p class="orders-empty">Henüz sipariş görünmüyor.</p>';
 return '<div class="orders-table-scroll" role="region" aria-label="Sipariş listesi" tabindex="0"><table class="orders-table"><thead><tr><th scope="col">#</th><th scope="col">Hizmet</th><th scope="col">Adet</th><th scope="col">Tutar</th><th scope="col">Durum</th><th scope="col">Tarih</th><th scope="col">İşlem</th></tr></thead><tbody>'+rows.map(order=>{
  const state=orderStatusInfo(order.status),status=String(order.status||'pending').toLowerCase();
  const tone=status==='completed'?'complete':['processing','in_progress'].includes(status)?'processing':['canceled','cancelled','failed','refunded'].includes(status)?'closed':'waiting';
  const date=order.createdAt?new Date(Number(order.createdAt)*1000).toLocaleString(currentLanguage==='tr'?'tr-TR':currentLanguage,{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
  return '<tr class="order-table-row" data-order-id="'+Number(order.id)+'"><td class="order-number">'+escapeHtml(order.id)+'</td><td class="order-service-cell"><b title="'+escapeHtml(order.service||'')+'">'+escapeHtml(order.service||'Hizmet bilgisi yok')+'</b>'+(order.link?'<div class="order-link"><span title="'+escapeHtml(order.link)+'">'+escapeHtml(order.link)+'</span><button type="button" data-copy-order="'+Number(order.id)+'" aria-label="Sipariş '+Number(order.id)+' bağlantısını kopyala">⧉</button></div>':'')+'</td><td class="order-quantity">'+(order.quantity==null?'—':Number(order.quantity).toLocaleString(currentLanguage))+'</td><td class="order-charge">'+(order.amount==null?'—':money(Number(order.amount)/100))+'</td><td><span class="order-pill '+tone+'">'+escapeHtml(state[0])+'</span></td><td class="order-date">'+escapeHtml(date)+'</td><td class="order-table-actions">'+orderRefillControl(order)+(order.canCancel?'<button type="button" data-order-action="cancel" data-id="'+Number(order.id)+'">İptal iste</button>':'')+'</td></tr>';
 }).join('')+'</tbody></table><p class="order-filter-empty" hidden>Aramana uygun sipariş yok.</p></div>';
}
