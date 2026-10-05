(() => {
  const section = document.querySelector("#landing-live-reviews");
  const grid = document.querySelector("#landing-review-grid");
  if (!section || !grid) return;
  fetch("/api/reviews", { credentials: "same-origin", cache: "no-store" })
    .then((response) => response.ok ? response.json() : [])
    .then((reviews) => {
      if (!Array.isArray(reviews) || !reviews.length) return;
      for (const review of reviews.slice(0, 3)) {
        const card = document.createElement("article");
        card.className = "landing-review-card";
        const head = document.createElement("div");
        head.className = "landing-review-head";
        const author = document.createElement("b");
        author.textContent = String(review.name || "ElTurco müşterisi");
        const stars = document.createElement("span");
        const rating = Math.max(0, Math.min(5, Number(review.rating) || 0));
        stars.textContent = "★".repeat(rating) + "☆".repeat(5 - rating);
        stars.setAttribute("aria-label", rating + " / 5");
        head.append(author, stars);
        const title = document.createElement("h3");
        title.textContent = String(review.title || "Sipariş deneyimi");
        const comment = document.createElement("p");
        comment.textContent = String(review.comment || "");
        card.append(head, title, comment);
        grid.append(card);
      }
      section.hidden = !grid.children.length;
    })
    .catch(() => {});
})();
(() => {
  const accountModal = document.querySelector("#account-modal");
  if (!accountModal) return;
  const dismiss = () => {
    accountModal.classList.remove("show");
    document.body.classList.remove("auth-modal-open");
  };
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !target.closest("#account-modal .ops-close, #account-modal .ops-backdrop")) return;
    event.preventDefault();
    dismiss();
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && accountModal.classList.contains("show")) dismiss();
  }, true);
})();


;(() => {
  const initWelcomeAuthEnhancements = () => {
    document.querySelectorAll("[data-password-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = document.querySelector(button.dataset.passwordToggle || "");
        if (!(target instanceof HTMLInputElement)) return;
        const show = target.type === "password";
        target.type = show ? "text" : "password";
        button.textContent = show ? "🙈" : "👁";
        button.setAttribute("aria-label", show ? "Şifreyi gizle" : "Şifreyi göster");
      });
    });
    const remember = document.querySelector("#remember-login");
    const email = document.querySelector('#auth-form input[name="email"]');
    if (remember instanceof HTMLInputElement && email instanceof HTMLInputElement) {
      const saved = localStorage.getItem("elturco_remembered_email") || "";
      if (saved) { email.value = saved; remember.checked = true; }
      document.querySelector("#auth-form")?.addEventListener("submit", () => {
        if (remember.checked && email.value.trim()) localStorage.setItem("elturco_remembered_email", email.value.trim());
        else localStorage.removeItem("elturco_remembered_email");
      });
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initWelcomeAuthEnhancements);
  else initWelcomeAuthEnhancements();
})();

;(() => {
  const run = () => {
    const params = new URLSearchParams(location.search);
    const auth = params.get('auth');
    if (auth === 'login' || auth === 'register') {
      const button = document.querySelector('[data-account="' + auth + '"]');
      if (button) setTimeout(() => button.click(), 120);
    }
    if (params.get('assistant') === '1') {
      const button = document.querySelector('[data-assistant-open]');
      if (button) setTimeout(() => button.click(), 180);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();