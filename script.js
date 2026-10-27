(() => {
  const items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach(item => item.classList.add('visible'));
  } else {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    items.forEach(item => observer.observe(item));
  }

  // Simple browser-only admin panel. This is not secure server-side authentication.
  const ACCESS_CODE = '20151110';
  const overlay = document.getElementById('admin-overlay');
  const login = document.getElementById('admin-login');
  const tools = document.getElementById('admin-tools');
  const loginForm = document.getElementById('admin-login-form');
  const settingsForm = document.getElementById('admin-settings-form');
  const error = document.getElementById('admin-error');
  const status = document.getElementById('admin-status');
  const defaults = {
    headline: 'Создаю идеи. Запускаю проекты.',
    intro: document.querySelector('.lead')?.textContent || '',
    telegram: 'https://t.me/',
    github: 'https://github.com/'
  };
  const headlineNode = document.querySelector('h1');
  const introNode = document.querySelector('.lead');
  const storageKey = 'my-space-admin-settings-v1';

  function readSettings() {
    try { return { ...defaults, ...(JSON.parse(localStorage.getItem(storageKey) || '{}')) }; }
    catch (_) { return { ...defaults }; }
  }
  function safeUrl(value, fallback) {
    try {
      const u = new URL(value);
      return ['https:', 'http:'].includes(u.protocol) ? u.href : fallback;
    } catch (_) { return fallback; }
  }
  function applySettings(settings) {
    if (headlineNode) {
      const parts = String(settings.headline || defaults.headline).split(/\s+/);
      const splitAt = Math.max(1, Math.ceil(parts.length / 2));
      headlineNode.replaceChildren(document.createTextNode(parts.slice(0, splitAt).join(' ') + ' '));
      const accent = document.createElement('span');
      accent.className = 'gradient-text';
      accent.textContent = parts.slice(splitAt).join(' ') || ' ';
      headlineNode.append(document.createElement('br'), accent);
    }
    if (introNode) introNode.textContent = settings.intro || '';
    const telegram = safeUrl(settings.telegram, defaults.telegram);
    const github = safeUrl(settings.github, defaults.github);
    document.querySelectorAll('a[href^="https://t.me/"]').forEach(a => a.href = telegram);
    document.querySelectorAll('a[href^="https://github.com/"]').forEach(a => a.href = github);
  }
  function fillForm(settings) {
    document.getElementById('admin-headline').value = settings.headline;
    document.getElementById('admin-intro').value = settings.intro;
    document.getElementById('admin-telegram').value = settings.telegram;
    document.getElementById('admin-github').value = settings.github;
  }
  applySettings(readSettings());

  document.getElementById('admin-trigger')?.addEventListener('click', () => {
    overlay.hidden = false;
    login.hidden = false;
    tools.hidden = true;
    error.textContent = '';
    document.getElementById('admin-code').value = '';
    document.getElementById('admin-code').focus();
  });
  document.getElementById('admin-close')?.addEventListener('click', () => { overlay.hidden = true; });
  overlay?.addEventListener('click', e => { if (e.target === overlay) overlay.hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay && !overlay.hidden) overlay.hidden = true; });

  loginForm?.addEventListener('submit', e => {
    e.preventDefault();
    if (document.getElementById('admin-code').value === ACCESS_CODE) {
      login.hidden = true;
      tools.hidden = false;
      fillForm(readSettings());
      error.textContent = '';
    } else {
      error.textContent = 'Неверный код доступа.';
    }
  });

  settingsForm?.addEventListener('submit', e => {
    e.preventDefault();
    const next = {
      headline: document.getElementById('admin-headline').value.trim() || defaults.headline,
      intro: document.getElementById('admin-intro').value.trim(),
      telegram: safeUrl(document.getElementById('admin-telegram').value.trim(), defaults.telegram),
      github: safeUrl(document.getElementById('admin-github').value.trim(), defaults.github)
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      applySettings(next);
      status.textContent = 'Сохранено в этом браузере.';
    } catch (_) {
      status.textContent = 'Не удалось сохранить настройки браузера.';
    }
  });

  document.getElementById('admin-reset')?.addEventListener('click', () => {
    localStorage.removeItem(storageKey);
    applySettings(defaults);
    fillForm(defaults);
    status.textContent = 'Локальные изменения сброшены.';
  });
})();