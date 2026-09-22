/* Script LOCAL de QA visual completo (não vai pro repo).
 * Percorre TODAS as telas e estados, clicando de verdade, comprint de
 * cada estado em docs/qa-prints/. Também mede alinhamentos/vazamentos
 * que E2E funcional não pega. Saída: docs/qa-prints/*.png + resumo no console. */
const { chromium } = require('D:/aphmgbr/Documents/VS-CODE/Test/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:4173';
const OUT = path.join(__dirname, 'docs', 'qa-prints');
fs.mkdirSync(OUT, { recursive: true });

const findings = [];
const note = (area, issue, shot) => {
  findings.push({ area, issue, shot });
  console.log(`⚠️  [${area}] ${issue} (${shot || 'sem print'})`);
};
const ok = (msg) => console.log(`OK  ${msg}`);

/** Print com nome padronizado. fullPage=false para estados com painel aberto
    (o resize interno do screenshot fullPage fecharia dropdowns, por design). */
async function shot(page, name, opts = {}) {
  await page.waitForTimeout(opts.settle ?? 450);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: opts.fullPage ?? true });
  console.log(`📸 ${name}.png`);
}

/** Sem scroll horizontal na viewport atual? */
async function noHScroll(page, name) {
  const fits = await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  if (!fits) note('layout', `scroll horizontal em ${name}`, name);
}

/** Alterna para dark/light via toggle (se existir) ou localStorage. */
async function setTheme(page, theme) {
  await page.evaluate((t) => {
    localStorage.setItem('gh-theme', t);
    document.documentElement.dataset.theme = t;
  }, theme);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  page.on('pageerror', (e) => note('js', `pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('status of 400')) {
      note('js', `console error: ${m.text()}`);
    }
  });

  /* ============ LOGIN ============ */
  await page.goto(`${BASE}/pages/login.html`, { waitUntil: 'networkidle' });
  await noHScroll(page, 'login');
  await shot(page, 'login-01-claro');

  /* olho da senha */
  await page.fill('#password', 'Segredo123!');
  await page.click('.password-eye');
  const pwType = await page.getAttribute('#password', 'type');
  if (pwType !== 'text') note('login', 'olho não revelou a senha', 'login-02');
  await shot(page, 'login-02-olho-aberto');

  /* espaço bloqueado */
  await page.click('.password-eye'); // esconde de novo
  await page.click('#password');
  await page.keyboard.press('End');
  await page.keyboard.type(' ');
  const pwVal = await page.inputValue('#password');
  if (pwVal.includes(' ')) note('login', 'espaço entrou na senha', 'login-02-olho-aberto');
  else ok('login: espaço bloqueado na senha');

  /* erro de login */
  await page.fill('#email', 'gradehoraria+mock.ana@gmail.com');
  await page.fill('#password', 'errada123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('#form-error:not([hidden])', { timeout: 15000 });
  await shot(page, 'login-03-erro');

  /* dark */
  await setTheme(page, 'dark');
  await shot(page, 'login-04-dark');

  /* mobile */
  await page.setViewportSize({ width: 375, height: 700 });
  await setTheme(page, 'light');
  await shot(page, 'login-05-mobile');
  await noHScroll(page, 'login mobile');
  await page.setViewportSize({ width: 1360, height: 900 });

  /* ============ CADASTRO ============ */
  await page.goto(`${BASE}/pages/cadastro.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => document.getElementById('institution').textContent.includes('Selecione a instituição'),
    { timeout: 15000 });
  await noHScroll(page, 'cadastro');
  await shot(page, 'cadastro-01-claro');

  /* cascata aberta (vidro) */
  await page.click('#institution');
  await page.waitForSelector('[role="listbox"]', { state: 'visible' });
  const listboxFilter = await page.evaluate(() =>
    getComputedStyle(document.querySelector('#institution').parentNode.querySelector('[role="listbox"]')).backdropFilter);
  if (!listboxFilter || listboxFilter === 'none') note('cadastro', 'dropdown sem backdrop-filter (vidro)', 'cadastro-02-dropdown-aberto');
  await shot(page, 'cadastro-02-dropdown-aberto', { fullPage: false });
  await page.keyboard.press('Escape');

  /* nome: uma palavra → erro */
  await page.fill('#name', 'Ana');
  await page.click('button[type="submit"]');
  await page.waitForSelector('#name-error:not([hidden])');
  await shot(page, 'cadastro-03-erro-sobrenome');

  /* senha: olho + aviso de fraca */
  await page.fill('#name', 'Ana Silva');
  await page.fill('#email', 'ana@exemplo.com');
  await page.fill('#password', 'abcdefg1');
  await page.waitForTimeout(300);
  await page.click('.password-eye');
  await shot(page, 'cadastro-04-senha-visivel');
  await page.click('.password-eye');

  /* senha óbvia: erro bloqueante */
  await page.fill('#password', '123456');
  await page.click('button[type="submit"]');
  await page.waitForSelector('#password-error:not([hidden])');
  await shot(page, 'cadastro-05-senha-obvia');

  /* solicitação de instituição aberta */
  await page.evaluate(() => { document.getElementById('request-block').open = true; });
  await shot(page, 'cadastro-06-solicitacao-aberta');

  /* rascunho: recarrega e confere */
  await page.fill('#name', 'Carla Souza');
  await page.fill('#email', 'carla@exemplo.com');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const restoredName = await page.inputValue('#name');
  if (restoredName !== 'Carla Souza') note('cadastro', `rascunho não restaurou nome ("${restoredName}")`);
  else ok('cadastro: rascunho restaurado após reload');
  await shot(page, 'cadastro-07-rascunho-restaurado');
  await page.evaluate(() => sessionStorage.clear());

  /* dark + mobile */
  await setTheme(page, 'dark');
  await shot(page, 'cadastro-08-dark');
  await page.setViewportSize({ width: 375, height: 700 });
  await setTheme(page, 'light');
  await shot(page, 'cadastro-09-mobile');
  await noHScroll(page, 'cadastro mobile');
  await page.setViewportSize({ width: 1360, height: 900 });

  /* ============ RECUPERAR ============ */
  await page.goto(`${BASE}/pages/recuperar.html`, { waitUntil: 'networkidle' });
  await shot(page, 'recuperar-01-claro');
  await page.fill('#email', 'naoexiste');
  await page.click('button[type="submit"]');
  await page.waitForSelector('#email-error:not([hidden])');
  await shot(page, 'recuperar-02-email-invalido');
  await page.fill('#email', 'qualquer@exemplo.com');
  await page.click('button[type="submit"]');
  await page.waitForSelector('#recover-success:not([hidden])');
  const recoverMsg = await page.textContent('#recover-success');
  if (!recoverMsg.includes('Se qualquer@exemplo.com estiver cadastrado')) {
    note('recuperar', 'mensagem anti-enumeração mudou!', 'recuperar-03');
  }
  await shot(page, 'recuperar-03-sucesso');
  await setTheme(page, 'dark');
  await page.goto(`${BASE}/pages/recuperar.html`, { waitUntil: 'networkidle' });
  await shot(page, 'recuperar-04-dark');
  await setTheme(page, 'light');

  /* ============ REDEFINIR (link inválido, sem sessão) ============ */
  await page.goto(`${BASE}/pages/redefinir.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#reset-invalid:not([hidden])', { timeout: 15000 });
  await shot(page, 'redefinir-01-link-invalido');



  /* ============ LOGIN REAL → CONTA ============ */
  await page.goto(`${BASE}/pages/login.html`, { waitUntil: 'networkidle' });
  await page.fill('#email', 'gradehoraria+mock.ana@gmail.com');
  await page.fill('#password', 'Mock@123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/grade**', { timeout: 20000 });

  await page.goto(`${BASE}/pages/conta.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => document.getElementById('account-name')?.textContent !== 'Carregando…',
    { timeout: 15000 });
  await noHScroll(page, 'conta');
  await shot(page, 'conta-01-claro');
  await setTheme(page, 'dark');
  await shot(page, 'conta-02-dark');
  await setTheme(page, 'light');

  /* ============ GRADE (foco principal) ============ */
  await page.goto(`${BASE}/pages/grade.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.subject-card', { timeout: 20000 });
  await noHScroll(page, 'grade');
  await shot(page, 'grade-01-claro-carregada');

  /* Header: toggle e menu alinhados na mesma linha? */
  const align = await page.evaluate(() => {
    const t = document.querySelector('.app-actions .theme-toggle')?.getBoundingClientRect();
    const m = document.querySelector('.app-menu__trigger')?.getBoundingClientRect();
    const h = document.querySelector('.app-header')?.getBoundingClientRect();
    if (!t || !m || !h) return null;
    return { toggleCenter: t.top + t.height / 2, menuCenter: m.top + m.height / 2, headerTop: h.top, headerBottom: h.bottom };
  });
  if (align) {
    const drift = Math.abs(align.toggleCenter - align.menuCenter);
    if (drift > 2) note('grade/header', `toggle e menu desalinhados (${drift.toFixed(1)}px)`, 'grade-01-claro-carregada');
    if (align.toggleCenter < align.headerTop || align.toggleCenter > align.headerBottom) {
      note('grade/header', 'toggle fora da faixa vertical do header', 'grade-01-claro-carregada');
    } else ok('header: toggle + menu alinhados dentro do header');
  }

  /* Menu ⋯ aberto (vidro) */
  await page.click('.app-menu__trigger');
  await page.waitForSelector('.app-menu__panel.is-open');
  const menuGlass = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.app-menu__panel')).backdropFilter);
  if (!menuGlass || menuGlass === 'none') note('grade/menu', 'painel do menu sem backdrop-filter', 'grade-02-menu-aberto');
  await shot(page, 'grade-02-menu-aberto', { fullPage: false });
  await page.keyboard.press('Escape');

  /* Visibilidade dropdown aberto */
  await page.click('#visibility-trigger');
  await page.waitForSelector('#visibility-slot [role="listbox"]', { state: 'visible' });
  await shot(page, 'grade-04-visibilidade-aberto', { fullPage: false });
  await page.keyboard.press('Escape');

  /* Sanfona: todas abertas no load; recolhe a 1ª */
  const groupsOpen = await page.locator('.semester-group.is-open').count();
  const groupsTotal = await page.locator('.semester-group').count();
  if (groupsOpen !== groupsTotal) note('grade/catalogo', `nem todas as gavetas abrem no load (${groupsOpen}/${groupsTotal})`, 'grade-01-claro-carregada');

  /* Sobreposição: gavetas não devem se sobrepor */
  const overlap = await page.evaluate(() => {
    const gs = [...document.querySelectorAll('.semester-group')];
    for (let i = 0; i + 1 < gs.length; i++) {
      const a = gs[i].getBoundingClientRect();
      const b = gs[i + 1].getBoundingClientRect();
      if (a.bottom > b.top + 2) return `grupo ${i} vaza por cima do ${i + 1} (${a.bottom.toFixed(0)} > ${b.top.toFixed(0)})`;
    }
    return null;
  });
  if (overlap) note('grade/catalogo', `gavetas sobrepostas: ${overlap}`, 'grade-01-claro-carregada');
  else ok('sanfona: sem sobreposição entre gavetas');

  await shot(page, 'grade-05-sanfona-toda-aberta');
  await page.locator('.semester-header').first().click();
  await page.waitForTimeout(600); // espera a mola terminar
  const firstClosed = await page.evaluate(() => {
    const g = document.querySelector('.semester-group');
    const panel = g.querySelector('.semester-panel');
    return { closed: !g.classList.contains('is-open'), panelH: panel.getBoundingClientRect().height };
  });
  if (!firstClosed.closed || firstClosed.panelH > 2) {
    note('grade/sanfona', `1ª gaveta não recolheu (panel h=${firstClosed.panelH.toFixed(0)}px)`, 'grade-06');
  } else ok('sanfona: 1ª gaveta recolhe de verdade');
  await shot(page, 'grade-06-sanfona-recolhida');
  await page.locator('.semester-header').first().click();
  await page.waitForTimeout(600);


  /* Seletor de ordenação: aberto, alfabética, voltando a semestre */
  await page.click('.sort-wrap .dropdown-trigger');
  await page.waitForSelector('.sort-wrap [role="listbox"]', { state: 'visible' });
  await shot(page, 'grade-07-sort-aberto', { fullPage: false });
  await page.locator('.sort-wrap [role="option"]', { hasText: 'Ordem alfabética' }).click();
  await page.waitForTimeout(300);
  const flatCount = await page.locator('.semester-group').count();
  if (flatCount !== 0) note('grade/sort', 'modo alfabético não virou lista plana', 'grade-08');
  await shot(page, 'grade-08-ordem-alfabetica');
  await page.click('.sort-wrap .dropdown-trigger');
  await page.locator('.sort-wrap [role="option"]', { hasText: '1º → último' }).click();
  await page.waitForTimeout(300);

  /* Adiciona uma turma e confere bloco (cor, hover, conteúdo) */
  const addBtn = page.locator('.subject-card:not(:has(.chip--blocked)) .btn-icon:not(.btn-icon--remove)').first();
  await addBtn.click();
  await page.waitForSelector('.wg-block', { timeout: 15000 });
  await shot(page, 'grade-09-com-turma');
  const blockInfo = await page.evaluate(() => {
    const b = document.querySelector('.wg-block');
    const cs = getComputedStyle(b);
    return { bg: cs.backgroundImage || cs.backgroundColor, border: cs.borderColor, text: b.textContent };
  });
  ok(`bloco: borda ${blockInfo.border} / texto "${blockInfo.text.slice(0, 50)}"`);

  /* Hover no bloco: efeito vidro visível? */
  await page.hover('.wg-block');
  await page.waitForTimeout(350);
  const hoverFx = await page.evaluate(() => {
    const b = document.querySelector('.wg-block');
    const cs = getComputedStyle(b);
    return { shadow: cs.boxShadow, filter: cs.backdropFilter };
  });
  if (hoverFx.shadow === 'none') note('grade/bloco', 'hover sem sombra de vidro', 'grade-10-hover-bloco');
  await shot(page, 'grade-10-hover-bloco');

  /* Pré-requisito bloqueado: erro de página */
  const blockedBtn = page.locator('.subject-card:has(.chip--blocked) .btn-icon:not(.btn-icon--remove)').first();
  if (await blockedBtn.count()) {
    await blockedBtn.click();
    await page.waitForSelector('#grade-status:not([hidden])', { timeout: 5000 });
    await shot(page, 'grade-11-prereq-bloqueado');
  }

  /* Dark mode na grade */
  await setTheme(page, 'dark');
  await page.waitForTimeout(400);
  await shot(page, 'grade-12-dark');
  await page.click('.app-menu__trigger');
  await page.waitForSelector('.app-menu__panel.is-open');
  await shot(page, 'grade-13-dark-menu-aberto', { fullPage: false });
  await page.keyboard.press('Escape');
  await setTheme(page, 'light');

  /* Mobile */
  await page.setViewportSize({ width: 375, height: 760 });
  await page.waitForTimeout(400);
  await noHScroll(page, 'grade mobile');
  await shot(page, 'grade-14-mobile');
  await page.locator('.semester-header').first().click();
  await page.waitForTimeout(600);
  await shot(page, 'grade-15-mobile-sanfona');
  await page.setViewportSize({ width: 1360, height: 900 });

  /* Remove TODAS as turmas da grade (deixa a conta de teste limpa) */
  for (let i = 0; i < 20; i++) {
    const blocks = await page.locator('.wg-block').count();
    if (blocks === 0) break;
    await page.hover('.wg-block >> nth=0');
    await page.locator('.wg-block .b-remove').first().click();
    await page.waitForTimeout(700);
  }
  const restantes = await page.locator('.wg-block').count();
  if (restantes > 0) note('grade/limpeza', `sobraram ${restantes} blocos após remoção`);
  else ok('limpeza: grade da conta de teste esvaziada');

  /* ============ RESUMO ============ */
  console.log('\n================ RESUMO QA ================');
  if (findings.length === 0) console.log('✅ Nenhum problema detectado pelas sondas.');
  for (const f of findings) console.log(`⚠️  [${f.area}] ${f.issue} → ${f.shot}.png`);
  console.log(`Total: ${findings.length} achado(s). Prints em docs/qa-prints/`);
  await browser.close();
  process.exit(0);
})();
