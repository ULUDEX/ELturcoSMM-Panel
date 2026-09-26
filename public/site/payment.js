// Adds a hosted Shopier checkout while keeping the existing manual payment request flow.
(() => {
  const payModal = document.querySelector('#pay-modal');
  const payForm = document.querySelector('#pay-form');
  const select = payForm?.querySelector('select[name="method"]');
  const instructions = document.querySelector('#payment-instructions');
  const shopierFields = document.querySelector('#shopier-fields');
  const shopierInputs = shopierFields?.querySelectorAll('input') || [];
  if (!payModal || !payForm || !select || !instructions || !shopierFields) return;
  let methods = [];

  function updateFields(method) {
    const isShopier = method === 'shopier';
    shopierFields.hidden = !isShopier;
    shopierInputs.forEach((input) => {
      input.required = isShopier;
      input.disabled = !isShopier;
    });
    payForm.querySelector('button.submit-order').textContent = isShopier ? 'Shopier ile öde →' : 'Ödeme talebi oluştur →';
  }

  document.querySelectorAll('[data-pay]').forEach((button) => {
    button.onclick = async () => {
      if (!account) {
        openAccount('login');
        toast('Bakiye yüklemek için giriş yapmalısın.');
        return;
      }
      payModal.classList.add('show');
      select.innerHTML = '<option value="">Yükleniyor...</option>';
      try {
        const response = await fetch('/api/payment-request');
        methods = await response.json();
        if (!response.ok || !Array.isArray(methods)) throw new Error('Ödeme yöntemleri yüklenemedi.');
        select.innerHTML = methods.length
          ? '<option value="">Ödeme yöntemi seçin</option>' + methods.map((method) => {
            const value = String(method.id) === 'shopier' ? 'shopier' : method.name;
            return '<option value="' + escapeHtml(value) + '">' + escapeHtml(method.name) + '</option>';
          }).join('')
          : '<option value="">Aktif ödeme yöntemi bulunamadı</option>';
        select.onchange = () => {
          const method = methods.find((item) => (String(item.id) === 'shopier' ? 'shopier' : item.name) === select.value);
          instructions.textContent = method?.instructions || 'Ödeme bilgileri için Telegram desteğe ulaş.';
          updateFields(select.value);
        };
      } catch (error) {
        select.innerHTML = '<option value="">Ödeme yöntemleri yüklenemedi</option>';
        toast(error instanceof Error ? error.message : 'Ödeme yöntemleri yüklenemedi.');
      }
    };
  });

  document.querySelectorAll('.ops-close, .ops-backdrop').forEach((button) => {
    button.onclick = () => payModal.classList.remove('show');
  });

  payForm.onsubmit = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(payForm));
    try {
      if (values.method === 'shopier') {
        const response = await fetch('/api/shopier/checkout', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(values),
        });
        const data = await response.json();
        if (!response.ok) {
          if (data.loginRequired) openAccount('login');
          toast(data.error || 'Shopier ödemesi başlatılamadı.');
          return;
        }
        const form = document.createElement('form');
        form.method = 'post';
        form.action = data.action;
        form.hidden = true;
        Object.entries(data.fields || {}).forEach(([name, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = name;
          input.value = String(value);
          form.append(input);
        });
        document.body.append(form);
        form.submit();
        return;
      }

      const response = await fetch('/api/payment-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.loginRequired) openAccount('login');
        toast(data.error || 'Talep oluşturulamadı.');
        return;
      }
      payModal.classList.remove('show');
      payForm.reset();
      updateFields('');
      toast('Ödeme bildirimin alındı. Referans #' + data.id);
    } catch {
      toast('Bağlantı kurulamadı. Lütfen tekrar dene.');
    }
  };
  updateFields('');
})();
