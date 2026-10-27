(() => {
  const items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) items.forEach(item => item.classList.add('visible'));
  else {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    }), { threshold: 0.12 });
    items.forEach(item => observer.observe(item));
  }

  const $ = id => document.getElementById(id);
  const overlay = $('admin-overlay'), login = $('admin-login'), tools = $('admin-tools'), blockEditor = $('admin-block-editor');
  const defaults = {
    headline: 'Создаю идеи. Запускаю проекты.',
    intro: document.querySelector('.lead')?.textContent || '',
    telegram: 'https://t.me/', github: 'https://github.com/',
    aboutTitle: 'Люблю создавать новое',
    aboutText: document.querySelector('.about-panel p')?.textContent || '',
    quote: 'Большие проекты начинаются с маленькой идеи.',
    deleted: {about:false, quote:false},
    projects: [
      {id:'project-1', title:'EKOOOL Messenger', text:'Идея собственного мессенджера с чатами, профилями и дополнительными цифровыми возможностями.', deleted:false},
      {id:'project-2', title:'Telegram-боты', text:'Боты для управления чатами, автоматизации задач и поиска информации.', deleted:false},
      {id:'project-3', title:'Веб-проекты', text:'Сайты, интерфейсы и небольшие инструменты — от идеи до первой версии.', deleted:false}
    ]
  };
  let config = structuredClone(defaults), selected = null, picking = false, authenticated = false;
  const headlineNode = document.querySelector('h1'), introNode = document.querySelector('.lead');
  const safeUrl = (value, fallback) => { try { const u = new URL(value); return ['https:','http:'].includes(u.protocol) ? u.href : fallback; } catch (_) { return fallback; } };
  async function api(path, body) {
    const r = await fetch(path, {method: body ? 'POST' : 'GET', headers: body ? {'Content-Type':'application/json'} : {}, body: body ? JSON.stringify(body) : undefined, credentials:'same-origin'});
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.message || (data.error === 'BAD_CODE' ? 'Неверный код.' : data.error === 'UNAUTHORIZED' ? 'Сессия завершилась. Войди снова.' : 'Ошибка сервера.'));
    return data;
  }
  function applyConfig(c) {
    config = {...structuredClone(defaults), ...c, deleted:{...defaults.deleted,...(c.deleted||{})}, projects:Array.isArray(c.projects)?c.projects:structuredClone(defaults.projects)};
    if (headlineNode) {
      const parts = String(config.headline || defaults.headline).split(/\s+/), splitAt = Math.max(1, Math.ceil(parts.length/2));
      headlineNode.replaceChildren(document.createTextNode(parts.slice(0,splitAt).join(' ')+' '));
      const accent = document.createElement('span'); accent.className='gradient-text'; accent.textContent=parts.slice(splitAt).join(' ') || ' ';
      headlineNode.append(document.createElement('br'),accent);
    }
    if (introNode) introNode.textContent = config.intro || '';
    const about = document.querySelector('[data-admin-block="about"]');
    if (about) { about.hidden=!!config.deleted.about; const h=about.querySelector('h3'), p=about.querySelector('p'); if(h)h.textContent=config.aboutTitle||'Обо мне'; if(p)p.textContent=config.aboutText||''; }
    const quote = document.querySelector('[data-admin-block="quote"]');
    if (quote) { quote.hidden=!!config.deleted.quote; const p=quote.querySelector('p'); if(p)p.textContent=config.quote||''; }
    document.querySelectorAll('.project-card[data-admin-block]').forEach(card => {
      const id=card.dataset.adminBlock, item=config.projects.find(p=>p.id===id);
      if (!item) return;
      card.hidden=!!item.deleted;
      const h=card.querySelector('h3'), p=card.querySelector('p');
      if(h)h.textContent=item.title; if(p)p.textContent=item.text;
    });
    config.projects.filter(p=>p.id.startsWith('custom-')).forEach(item=>{
      let card=document.querySelector('[data-admin-block="'+CSS.escape(item.id)+'"]');
      if(!card) {
        const grid=document.querySelector('.project-grid'), template=grid?.querySelector('.project-card');
        if(!grid||!template)return;
        card=template.cloneNode(true); card.dataset.adminBlock=item.id; card.classList.remove('featured'); grid.append(card);
      }
      card.hidden=!!item.deleted;
      const h=card.querySelector('h3'), p=card.querySelector('p'); if(h)h.textContent=item.title;if(p)p.textContent=item.text;
    });
    const tg=safeUrl(config.telegram,defaults.telegram), gh=safeUrl(config.github,defaults.github);
    document.querySelectorAll('a[href^="https://t.me/"]').forEach(a=>a.href=tg);
    document.querySelectorAll('a[href^="https://github.com/"]').forEach(a=>a.href=gh);
  }
  async function loadConfig() {
    try { const result=await api('/api/site'); if(result.config)applyConfig(result.config); }
    catch (_) { /* Site remains usable while storage is not configured. */ }
  }
  function openModal(view='login') {
    overlay.hidden=false; login.hidden=view!=='login'; tools.hidden=view!=='tools'; blockEditor.hidden=view!=='block';
    if(view==='login') $('admin-code').focus();
  }
  function fillSettings() {
    $('admin-headline').value=config.headline||''; $('admin-intro').value=config.intro||'';
    $('admin-telegram').value=config.telegram||''; $('admin-github').value=config.github||'';
  }
  async function saveConfig() {
    const result=await api('/api/admin',{action:'save',config});
    applyConfig(result.config||config);
  }
  $('admin-trigger')?.addEventListener('click',()=>{openModal(authenticated?'tools':'login');$('admin-error').textContent='';$('admin-code').value='';});
  $('admin-close')?.addEventListener('click',()=>{overlay.hidden=true; picking=false;document.body.classList.remove('admin-picking');});
  overlay?.addEventListener('click',e=>{if(e.target===overlay)overlay.hidden=true;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay&&!overlay.hidden)overlay.hidden=true;});
  $('admin-login-form')?.addEventListener('submit',async e=>{
    e.preventDefault(); $('admin-error').textContent='Проверяем код…';
    try { await api('/api/admin',{action:'login',code:$('admin-code').value}); authenticated=true; await loadConfig(); fillSettings(); $('admin-error').textContent=''; openModal('tools'); }
    catch(err){$('admin-error').textContent=err.message;}
  });
  $('admin-settings-form')?.addEventListener('submit',async e=>{
    e.preventDefault();
    config.headline=$('admin-headline').value.trim()||defaults.headline;
    config.intro=$('admin-intro').value.trim();
    config.telegram=safeUrl($('admin-telegram').value.trim(),defaults.telegram);
    config.github=safeUrl($('admin-github').value.trim(),defaults.github);
    $('admin-status').textContent='Сохраняем…';
    try {await saveConfig();$('admin-status').textContent='Сохранено на сервере и опубликовано для посетителей.';}
    catch(err){$('admin-status').textContent=err.message;}
  });
  $('admin-pick-block')?.addEventListener('click',()=>{overlay.hidden=true;picking=true;document.body.classList.add('admin-picking');});
  document.addEventListener('click',e=>{
    if(!picking)return;
    const node=e.target.closest('[data-admin-block]');
    if(!node)return;
    e.preventDefault(); e.stopPropagation(); selected=node.dataset.adminBlock; picking=false;document.body.classList.remove('admin-picking');
    const item=selected==='about'?{title:config.aboutTitle,text:config.aboutText}:selected==='quote'?{title:'Цитата',text:config.quote}:config.projects.find(p=>p.id===selected);
    if(!item)return;
    $('admin-block-heading').textContent='Изменить: '+(item.title||selected);
    $('admin-block-title').value=item.title||''; $('admin-block-text').value=item.text||'';
    $('admin-block-status').textContent='';openModal('block');
  },true);
  $('admin-block-form')?.addEventListener('submit',async e=>{
    e.preventDefault(); const title=$('admin-block-title').value.trim(), text=$('admin-block-text').value.trim();
    if(selected==='about'){config.aboutTitle=title;config.aboutText=text;}
    else if(selected==='quote'){config.quote=text;}
    else {
      let item=config.projects.find(p=>p.id===selected);
      if(!item){item={id:selected,title,text,deleted:false};config.projects.push(item);}
      item.title=title||'Без названия';item.text=text;
    }
    $('admin-block-status').textContent='Сохраняем…';
    try {await saveConfig();$('admin-block-status').textContent='Блок сохранён.';setTimeout(()=>openModal('tools'),450);}
    catch(err){$('admin-block-status').textContent=err.message;}
  });
  $('admin-delete-block')?.addEventListener('click',async()=>{
    if(!selected)return;
    if(selected==='about')config.deleted.about=true;
    else if(selected==='quote')config.deleted.quote=true;
    else {const item=config.projects.find(p=>p.id===selected);if(item)item.deleted=true;}
    try {await saveConfig();openModal('tools');}catch(err){$('admin-block-status').textContent=err.message;}
  });
  $('admin-back')?.addEventListener('click',()=>openModal('tools'));
  $('admin-add-project')?.addEventListener('click',async()=>{
    const id='custom-'+Date.now();config.projects.push({id,title:'Новый проект',text:'Описание проекта',deleted:false});
    try {await saveConfig();applyConfig(config);selected=id;$('admin-block-heading').textContent='Новый проект';$('admin-block-title').value='Новый проект';$('admin-block-text').value='Описание проекта';openModal('block');}
    catch(err){$('admin-status').textContent=err.message;}
  });
  $('admin-reset')?.addEventListener('click',async()=>{
    if(!confirm('Сбросить все изменения сайта?'))return;
    try {await api('/api/admin',{action:'reset'});config=structuredClone(defaults);applyConfig(config);fillSettings();$('admin-status').textContent='Настройки сброшены.';}
    catch(err){$('admin-status').textContent=err.message;}
  });
  $('admin-logout')?.addEventListener('click',async()=>{try{await api('/api/admin',{action:'logout'});}catch(_){} authenticated=false;overlay.hidden=true;});
  loadConfig();
})();