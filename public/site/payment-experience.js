(() => {
  const modal = document.querySelector("#pay-modal");
  const form = document.querySelector("#pay-form");
  const amount = document.querySelector("#payment-amount");
  const method = document.querySelector("#payment-method");
  const manual = document.querySelector("#manual-payment-method");
  const shopierGrid = document.querySelector("#shopier-options");
  const submit = document.querySelector("#payment-submit");
  const instructions = document.querySelector("#payment-instructions");
  const currentBalance = document.querySelector("#payment-current-balance");
  const summaryAmount = document.querySelector("#payment-summary-amount");
  const summaryTotal = document.querySelector("#payment-summary-total");
  const summaryMethod = document.querySelector("#payment-summary-method");
  const tabs = [...document.querySelectorAll("[data-payment-category]")];
  const amountPresets = document.querySelector(".payment-presets");
  const panels = [...document.querySelectorAll("[data-payment-panel]")];
  const format = value => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(value || 0));
  const updateSummary = () => {
    summaryAmount.textContent = format(amount.value);
    summaryTotal.textContent = format(amount.value);
  };
  const setCategory = category => {
    tabs.forEach(tab => {
      const active = tab.dataset.paymentCategory === category;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-pressed", String(active));
    });
    panels.forEach(panel => {
      const active = panel.dataset.paymentPanel === category;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });
    summaryMethod.textContent = category === "shopier" ? "Shopier" : category === "transfer" ? "Banka Havalesi / EFT" : "Kripto para";
    if (amountPresets) amountPresets.hidden = category !== "shopier";
    if (category !== "shopier") {
      const selectedAmount = Number(amount.value) >= 10 ? amount.value : "100";
      amount.readOnly = false;
      manual.value = category === "transfer" ? "transfer:telegram" : document.querySelector("#crypto-network").value;
      manual.dispatchEvent(new Event("change", { bubbles: true }));
      amount.value = selectedAmount;
      updateSummary();
      instructions.textContent = category === "transfer"
        ? "Talebin kaydedilir; IBAN ve alıcı bilgileri için @taycanqs Telegram hesabına yönlendirilirsin. Bu ekranda IBAN gösterilmez."
        : "Talebin kaydedilir; doğru coin, ağ ve cüzdan adresini @taycanqs Telegram hesabından teyit et.";
      submit.disabled = false;
      submit.textContent = category === "transfer" ? "Havale / EFT için Telegram’a geç →" : "Kripto ödeme bilgisi al →";
    } else {
      manual.value = "";
      manual.dispatchEvent(new Event("change", { bubbles: true }));
      const selected = shopierGrid.querySelector(".shopier-option.selected");
      if (!selected) {
        amount.value = "";
        amount.placeholder = "Önce Shopier tutarı seç";
        amount.readOnly = true;
        updateSummary();
        submit.disabled = true;
        submit.textContent = "Shopier tutarı seç →";
        instructions.textContent = "Shopier tutarlarından birini seçerek devam et.";
      }
    }
  };
  tabs.forEach(tab => tab.addEventListener("click", () => {
    if (tab.dataset.paymentCategory === "shopier") shopierGrid.querySelectorAll(".shopier-option").forEach(option => option.classList.remove("selected"));
    setCategory(tab.dataset.paymentCategory);
  }));
  document.querySelector("#crypto-network").addEventListener("change", event => {
    if (document.querySelector('[data-payment-category="crypto"]').classList.contains("active")) {
      manual.value = event.target.value;
      manual.dispatchEvent(new Event("change", { bubbles: true }));
      const label = event.target.selectedOptions[0]?.textContent || "Kripto para";
      summaryMethod.textContent = label;
      instructions.textContent = "Talebin kaydedilir; " + label + " için cüzdan adresini ve ağı @taycanqs Telegram hesabından teyit et.";
      submit.textContent = "Kripto ödeme bilgisi al →";
    }
  });
  document.querySelectorAll("[data-payment-preset]").forEach(button => button.addEventListener("click", () => {
    const activeCategory = document.querySelector(".payment-method-tabs .active")?.dataset.paymentCategory;
    if (activeCategory === "shopier") {
      const target = [...shopierGrid.querySelectorAll(".shopier-option")].find(option => option.textContent.includes(Number(button.dataset.paymentPreset).toLocaleString("tr-TR")));
      if (target) target.click();
      return;
    }
    amount.value = button.dataset.paymentPreset;
    document.querySelectorAll("[data-payment-preset]").forEach(item => item.classList.toggle("active", item === button));
    updateSummary();
  }));
  amount.addEventListener("input", () => {
    document.querySelectorAll("[data-payment-preset]").forEach(item => item.classList.toggle("active", Number(item.dataset.paymentPreset) === Number(amount.value)));
    updateSummary();
  });
  if (shopierGrid) shopierGrid.addEventListener("click", event => {
    const option = event.target.closest(".shopier-option");
    if (!option) return;
    tabs.forEach(tab => {
      const active = tab.dataset.paymentCategory === "shopier";
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-pressed", String(active));
    });
    panels.forEach(panel => {
      const active = panel.dataset.paymentPanel === "shopier";
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });
    summaryMethod.textContent = "Shopier";
    requestAnimationFrame(() => {
      updateSummary();
      summaryMethod.textContent = "Shopier";
      submit.disabled = !method.value;
      submit.textContent = "Shopier’de güvenle öde →";
      instructions.textContent = document.querySelector("#payment-instructions").textContent;
    });
  });
  const paymentButtons = [...document.querySelectorAll("[data-pay]")];
  paymentButtons.forEach(button => {
    const previous = button.onclick;
    if (!previous) return;
    button.onclick = async function (event) {
      await previous.call(this, event);
      if (!modal.classList.contains("show")) return;
      const paymentConfig = await fetch("/api/payment-request", { credentials: "same-origin", cache: "no-store" }).then(response => response.json()).catch(() => ({ cryptoEnabled: false }));
      const cryptoTab = document.querySelector('[data-payment-category="crypto"]');
      const cryptoPanel = document.querySelector('[data-payment-panel="crypto"]');
      if (cryptoTab) cryptoTab.hidden = paymentConfig.cryptoEnabled !== true;
      if (cryptoPanel) cryptoPanel.hidden = paymentConfig.cryptoEnabled !== true;
      const name = document.querySelector("#account-name")?.textContent || "";
      const email = document.querySelector("#account-email")?.textContent || "";
      document.querySelector("#payment-customer-name").value = name;
      document.querySelector("#payment-customer-email").value = email;
      currentBalance.textContent = document.querySelector("#account-balance")?.textContent || "₺0,00";
      ["transfer:telegram", "crypto:usdt-trc20", "crypto:usdt-erc20", "crypto:btc", "crypto:eth"].forEach(value => {
        if (![...manual.options].some(option => option.value === value)) {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = value.startsWith("transfer:") ? "Banka Havalesi / EFT · Telegram" : value.slice(7).toUpperCase();
          manual.add(option);
        }
      });
      document.querySelectorAll("[data-payment-preset]").forEach(item => item.classList.remove("active"));
      tabs.forEach(tab => { tab.classList.remove("active"); tab.setAttribute("aria-pressed", "false"); });
      panels.forEach(panel => { panel.classList.remove("active"); panel.hidden = true; });
      if (amountPresets) amountPresets.hidden = true;
      amount.value = "";
      amount.readOnly = true;
      summaryMethod.textContent = "Ödeme yöntemi seç";
      instructions.textContent = "Başlamak için bir ödeme yöntemi seç.";
      submit.disabled = true;
      submit.textContent = "Ödeme yöntemi seç →";
      updateSummary();
    };
  });
  const shopierSubmit = form.onsubmit;
  form.onsubmit = async event => {
    if (!method.value.startsWith("transfer:") && !method.value.startsWith("crypto:")) {
      return shopierSubmit.call(form, event);
    }
    event.preventDefault();
    if (!Number(amount.value) || Number(amount.value) < 10) {
      amount.setCustomValidity("En az 10 TL yükleyebilirsin.");
      amount.reportValidity();
      amount.setCustomValidity("");
      return;
    }
    submit.disabled = true;
    submit.textContent = "Talep kaydediliyor…";
    try {
      const response = await fetch("/api/payment-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ...Object.fromEntries(new FormData(form)), method: method.value })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Talep oluşturulamadı.");
      const category = method.value.startsWith("transfer:") ? "Banka Havalesi / EFT" : document.querySelector("#crypto-network").selectedOptions[0]?.textContent || "Kripto";
      const toast = document.querySelector(".toast");
      if (toast) toast.textContent = "Talep #" + data.id + " kaydedildi. Telegram’a aktarılıyorsun…";
      modal.classList.remove("show");
      window.setTimeout(() => window.location.assign("https://t.me/taycanqs"), 650);
    } catch (error) {
      instructions.textContent = error.message || "Talep oluşturulamadı. Tekrar deneyebilirsin.";
      submit.disabled = false;
      submit.textContent = method.value.startsWith("transfer:") ? "Havale / EFT için Telegram’a geç →" : "Kripto ödeme bilgisi al →";
    }
  };
})();