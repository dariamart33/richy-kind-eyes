(() => {
  const counterId = 111802288;
  const consentKey = "richy-analytics-consent";
  let consent = window.localStorage.getItem(consentKey);
  let banner = null;

  function startMetrica() {
    window.ym = window.ym || function () {
      (window.ym.a = window.ym.a || []).push(arguments);
    };
    window.ym.l = window.ym.l || Date.now();

    if (!document.querySelector("script[data-yandex-metrica]")) {
      const script = document.createElement("script");
      script.async = true;
      script.dataset.yandexMetrica = "true";
      script.src = `https://mc.yandex.ru/metrika/tag.js?id=${counterId}`;
      document.head.append(script);
    }

    if (!document.documentElement.dataset.metrikaInitialized) {
      window.ym(counterId, "init", {
        ssr: true,
        webvisor: false,
        clickmap: false,
        trackLinks: true,
        accurateTrackBounce: true,
        referrer: document.referrer,
        url: window.location.href,
      });
      document.documentElement.dataset.metrikaInitialized = "true";
    }
  }

  function closeBanner() {
    banner?.remove();
    banner = null;
  }

  function saveConsent(value) {
    consent = value;
    window.localStorage.setItem(consentKey, value);
    closeBanner();

    if (value === "granted") {
      startMetrica();
    } else if (document.documentElement.dataset.metrikaInitialized) {
      window.location.reload();
    }
  }

  function showBanner() {
    closeBanner();
    banner = document.createElement("aside");
    banner.className = "consent-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-labelledby", "consent-title");
    banner.setAttribute("aria-describedby", "consent-description");
    banner.innerHTML = `
      <div>
        <strong id="consent-title">Можно собирать анонимную статистику?</strong>
        <p id="consent-description">
          Яндекс Метрика поможет понять, как находят сайт и переходят ли в
          Telegram. Она загрузится только с вашего согласия. Подробнее — в
          <a href="#privacy">политике конфиденциальности</a>.
        </p>
      </div>
      <div class="consent-actions">
        <button type="button" data-consent="granted">Разрешить</button>
        <button type="button" class="consent-secondary" data-consent="denied">
          Только необходимые
        </button>
      </div>`;

    banner.querySelector('[data-consent="granted"]').addEventListener("click", () => {
      saveConsent("granted");
    });
    banner.querySelector('[data-consent="denied"]').addEventListener("click", () => {
      saveConsent("denied");
    });
    document.body.append(banner);
  }

  document.querySelector(".analytics-settings")?.addEventListener("click", showBanner);
  document.addEventListener("click", (event) => {
    if (consent !== "granted") return;
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest('[data-analytics-goal="telegram_click"]')) return;
    window.ym?.(counterId, "reachGoal", "telegram_click");
  });

  if (consent === "granted") {
    startMetrica();
  } else if (consent !== "denied") {
    showBanner();
  }
})();
