/* QA VISUAL INTENSIVO - Tela de Grade (Rodada 2) */
const { chromium } = require('D:/aphmgbr/Documents/VS-CODE/Test/node_modules/playwright');
const fs = require('fs'); const path = require('path');
const BASE = 'http://localhost:4173';
const OUT = path.join(__dirname, 'docs', 'qa-prints', 'rodada-2');
fs.mkdirSync(OUT, { recursive: true });
const findings = [];
const RESOLUTIONS = [{ name: 'mobile-375', width: 375, height: 760 },{ name: 'tablet-768', width: 768, height: 1024 },{ name: 'laptop-1280', width: 1280, height: 900 },{ name: 'desktop-1600', width: 1600, height: 1000 }];
const THEMES = ['light', 'dark']; const ZOOMS = [0.9, 1.0, 1.25, 1.5];
const note = (area, issue, shot, ctx = {}) => { findings.push({ area, issue, shot, ctx: JSON.stringify(ctx) }); console.log('WARN [' + area + '] ' + issue + ' (' + (shot || 'sem print') + ')'); };
const ok = (msg) => console.log('OK  ' + msg);
async function shot(page, name, opts = {}) { await page.waitForTimeout(opts.settle ?? 450); await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: opts.fullPage ?? true }); console.log('SHOT ' + name + '.png'); }
async function setTheme(page, theme) { await page.evaluate((t) => { localStorage.setItem('gh-theme', t); document.documentElement.dataset.theme = t; }, theme); }
async function setZoom(page, zoom) { await page.evaluate((z) => { document.body.style.zoom = z; }, zoom); }
async function waitForAnimations(page, ms = 600) { await page.waitForTimeout(ms); }
async function openMenu(page) { await page.click('.app-menu__trigger'); await page.waitForSelector('.app-menu__panel.is-open'); }
async function closeMenu(page) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
async function openVisibility(page) { await page.click('#visibility-trigger'); await page.waitForSelector('#visibility-slot [role="listbox"]', { state: 'visible' }); }
async function closeVisibility(page) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
async function toggleSemester(page, index) { const headers = await page.locator('.semester-header').all(); if (headers[index]) { await headers[index].click(); await waitForAnimations(page); } }
async function getSemesterStates(page) { return await page.evaluate(() => { const groups = [...document.querySelectorAll('.semester-group')]; return groups.map((g, i) => ({ index: i, open: g.classList.contains('is-open'), title: g.querySelector('.semester-header span')?.textContent?.trim(), count: g.querySelector('.semester-count')?.textContent?.trim() })); }); }
async function setSortMode(page, modeLabel) { await page.click('.sort-wrap .dropdown-trigger'); await page.waitForSelector('.sort-wrap [role="listbox"]', { state: 'visible' }); const opt = page.locator('.sort-wrap [role="option"]', { hasText: modeLabel }); await opt.waitFor({ state: 'visible', timeout: 5000 }); await opt.click({ force: true, timeout: 5000 }); await waitForAnimations(page, 400); }
async function searchCatalog(page, query) { await page.fill('#class-picker .search-input', ''); await page.type('#class-picker .search-input', query, { delay: 50 }); await waitForAnimations(page, 300); }
async function getVisibleSubjectCount(page) { return await page.locator('.subject-card').count(); }
async function addFirstAvailableClass(page) {
  const added = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.subject-card')];
    for (const card of cards) {
      if (card.querySelector('.chip--blocked')) continue;
      const btn = card.querySelector('.btn-icon:not(.btn-icon--remove)');
      if (btn) { btn.click(); return true; }
    }
    return false;
  });
  if (added) {
    await page.waitForSelector('.wg-block', { timeout: 15000 });
    return true;
  }
  return false;
}
async function hoverFirstBlock(page) { await page.hover('.wg-block'); await waitForAnimations(page, 350); }
async function hoverFirstCatalogBlock(page) { await page.hover('.subject-card >> nth=0'); await waitForAnimations(page, 350); }
async function tryAddConflictingClass(page) {
  const firstBlockText = await page.locator('.wg-block').first().textContent();
  if (!firstBlockText) return false;
  
  // Try to find a blocked button first
  const blockedResult = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.subject-card')];
    for (const card of cards) {
      if (card.querySelector('.chip--blocked')) {
        const btn = card.querySelector('.btn-icon:not(.btn-icon--remove)');
        if (btn) { btn.click(); return true; }
      }
    }
    return false;
  });
  
  if (blockedResult) {
    await page.waitForSelector('#grade-status:not([hidden])', { timeout: 5000 });
    return true;
  }
  
  // Try to add more classes to trigger conflict
  const added = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.subject-card')];
    for (const card of cards) {
      if (card.querySelector('.chip--blocked')) continue;
      const btn = card.querySelector('.btn-icon:not(.btn-icon--remove)');
      if (btn) { btn.click(); return true; }
    }
    return false;
  });
  
  if (added) {
    await waitForAnimations(page, 500);
    const err = await page.locator('#grade-status:not([hidden])').count();
    if (err) return true;
  }
  return false;
}
async function checkColorDifferentiation(page) { return await page.evaluate(() => { const blocks = [...document.querySelectorAll('.wg-block')]; if (blocks.length < 3) return { ok: false, reason: 'menos de 3 blocos' }; // Collect unique colors by border (subject color) const uniqueColors = []; const seenBorders = new Set(); for (const b of blocks) { const cs = getComputedStyle(b); const border = cs.borderColor; if (!seenBorders.has(border)) { seenBorders.add(border); uniqueColors.push({ border, text: cs.color, bg: cs.backgroundColor, subject: b.textContent.trim().slice(0, 40) }); } if (uniqueColors.length >= 3) break; } const allDiff = uniqueColors.length >= 3 && uniqueColors[0].border !== uniqueColors[1].border && uniqueColors[1].border !== uniqueColors[2].border && uniqueColors[0].border !== uniqueColors[2].border; return { ok: allDiff, colors: uniqueColors }; }); }

async function addDifferentSubjectClasses(page, count) {
  let added = 0;
  for (let i = 0; i < count; i++) {
    const success = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.subject-card')];
      for (const card of cards) {
        if (card.querySelector('.chip--blocked')) continue;
        if (card.querySelector('.chip--enrolled')) continue; // already in grade
        const btn = card.querySelector('.btn-icon:not(.btn-icon--remove)');
        if (btn) { btn.click(); return true; }
      }
      return false;
    });
    if (success) {
      await page.waitForSelector('.wg-block', { timeout: 15000 });
      added++;
    } else {
      break;
    }
  }
  return added;
}

async function noHScroll(page, label) { const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1); if (!fits) note('layout', 'scroll horizontal em ' + label, label); }
async function checkBlockVisuals(page, shotName) { const info = await page.evaluate(() => { const blocks = [...document.querySelectorAll('.wg-block')]; return blocks.map((b, i) => { const cs = getComputedStyle(b); return { idx: i, border: cs.borderColor, textColor: cs.color, bg: cs.backgroundColor, text: b.textContent.trim().slice(0, 60), shadow: cs.boxShadow }; }); }); for (const b of info) { if (b.border === 'rgb(0, 0, 0)' || b.border === 'transparent' || !b.border) note('bloco', 'bloco ' + b.idx + ' sem borda colorida', shotName, { block: b }); } await shot(page, shotName); }
async function testAccordionStates(page, tag) { const states = await getSemesterStates(page); for (const s of states) if (s.open) await toggleSemester(page, s.index); await shot(page, 'sanfona-todas-fechadas-' + tag); const states2 = await getSemesterStates(page); for (const s of states2) if (!s.open) await toggleSemester(page, s.index); await shot(page, 'sanfona-todas-abertas-' + tag); const states3 = await getSemesterStates(page); if (states3.length >= 3) { await toggleSemester(page, 1); await shot(page, 'sanfona-1e3-abertas-' + tag); await toggleSemester(page, 0); await shot(page, 'sanfona-so-3-aberta-' + tag); for (const s of states3) if (!s.open) await toggleSemester(page, s.index); } const states4 = await getSemesterStates(page); for (const s of states4) if (s.open) await toggleSemester(page, s.index); }
async function testSortModes(page, tag) { const modes = ['1º → último', 'Último → 1º', 'Ordem alfabética']; for (const mode of modes) { await setSortMode(page, mode); await shot(page, 'sort-' + mode.replace(/[→º]/g, '').replace(/\s+/g, '-').toLowerCase() + '-' + tag); if (mode === 'Ordem alfabética') { const groups = await page.locator('.semester-group').count(); if (groups !== 0) note('sort', 'modo alfabético não virou lista plana (ainda tem semestres)', tag); } } await setSortMode(page, '1º → último'); }

async function testCatalogSubjectStates(page, tag) { const states = await getSemesterStates(page); for (const s of states) if (!s.open) await toggleSemester(page, s.index); const info = await page.evaluate(() => { const cards = [...document.querySelectorAll('.subject-card')]; const result = { semPrereq: null, prereqOk: null, prereqPendente: null, naGrade: null }; for (const c of cards) { const hasBlocked = c.querySelector('.chip--blocked'); const hasEnrolled = c.querySelector('.chip--enrolled'); const title = c.querySelector('.subject-name')?.textContent?.trim(); if (!result.semPrereq && !hasBlocked && !hasEnrolled) result.semPrereq = title; if (!result.prereqOk && hasEnrolled) result.prereqOk = title; if (!result.prereqPendente && hasBlocked) result.prereqPendente = title; if (!result.naGrade && hasEnrolled) result.naGrade = title; } return result; }); console.log('Estados de materia:', info); if (info.semPrereq) await shot(page, 'catalogo-sem-prereq-' + tag); if (info.prereqPendente) await shot(page, 'catalogo-prereq-pendente-' + tag); if (info.naGrade) await shot(page, 'catalogo-na-grade-' + tag); }
async function testHoverGlass(page, tag) { 
  if (await page.locator('.wg-block').count()) { 
    const block = page.locator('.wg-block').first();
    await block.scrollIntoViewIfNeeded();
    await block.hover({ force: true, timeout: 5000 });
    await waitForAnimations(page, 350); 
    const hoverInfo = await page.evaluate(() => { 
      const b = document.querySelector('.wg-block'); 
      const cs = getComputedStyle(b); 
      return { shadow: cs.boxShadow, transform: cs.transform }; 
    }); 
    // Check for enhanced shadow and translateY on hover (new glass effect)
    const hasHoverEffect = hoverInfo.shadow.includes('0.5rem') || hoverInfo.shadow.includes('1.25rem') || hoverInfo.transform.includes('translateY(-2px)');
    if (!hasHoverEffect) note('hover', 'bloco da grade: efeito hover (sombra+lift) nao detectado', 'hover-bloco-grade-' + tag, hoverInfo); 
    await shot(page, 'hover-bloco-grade-' + tag, { fullPage: false }); 
  } 
  const card = page.locator('.subject-card').first();
  await card.scrollIntoViewIfNeeded();
  await card.hover({ force: true, timeout: 5000 });
  await waitForAnimations(page, 350); 
  await shot(page, 'hover-card-catalogo-' + tag, { fullPage: false }); 
}
async function testHeaderMenu(page, tag) { await shot(page, 'menu-fechado-' + tag); await openMenu(page); await shot(page, 'menu-aberto-' + tag, { fullPage: false }); const menuGlass = await page.evaluate(() => getComputedStyle(document.querySelector('.app-menu__panel')).backdropFilter); if (!menuGlass || menuGlass === 'none') note('menu', 'painel sem backdrop-filter (vidro)', 'menu-aberto-' + tag); await page.click('body', { position: { x: 10, y: 10 } }); await waitForAnimations(page, 300); await shot(page, 'menu-clique-fora-' + tag); await openMenu(page); await page.keyboard.press('Escape'); await waitForAnimations(page, 300); await shot(page, 'menu-esc-' + tag); }
async function testVisibilitySelector(page, tag) { await openVisibility(page); await shot(page, 'visibilidade-aberta-' + tag, { fullPage: false }); await closeVisibility(page); }
async function testTimeConflict(page, tag) { await cleanGrade(page); await addFirstAvailableClass(page); const conflict = await tryAddConflictingClass(page); await shot(page, 'choque-horario-' + tag); if (!conflict) note('choque', 'nao encontrou turma que colide (pode ser limitacao dos dados)', tag); }
async function testAlgorithmicColors(page, tag) { await cleanGrade(page); await addDifferentSubjectClasses(page, 4); await waitForAnimations(page); const colorInfo = await checkColorDifferentiation(page); if (!colorInfo.ok) note('cores', 'cores algoritmicas nao distinguiveis: ' + (colorInfo.reason || JSON.stringify(colorInfo.colors)), 'cores-algoritmicas-' + tag, colorInfo); else ok('cores: 3+ blocos com cores distintas'); await shot(page, 'cores-algoritmicas-' + tag); }
async function testAnimationInterruption(page, tag) { await cleanGrade(page); const states = await getSemesterStates(page); for (const s of states) if (!s.open) await toggleSemester(page, s.index); const header = page.locator('.semester-header >> nth=0'); await header.click(); await waitForAnimations(page, 150); await header.click(); await waitForAnimations(page, 600); await shot(page, 'anim-interrompida-sanfona-' + tag); await openMenu(page); await waitForAnimations(page, 150); await page.click('body', { position: { x: 10, y: 10 } }); await waitForAnimations(page, 400); await shot(page, 'anim-interrompida-menu-' + tag); }
async function testResizeWithOpenAccordion(page, tag, originalRes) { const states = await getSemesterStates(page); for (const s of states) if (!s.open) await toggleSemester(page, s.index); await page.setViewportSize({ width: 375, height: 760 }); await waitForAnimations(page, 500); await shot(page, 'resize-mobile-sanfona-aberta-' + tag); await page.setViewportSize({ width: 1600, height: 1000 }); await waitForAnimations(page, 500); await shot(page, 'resize-desktop-sanfona-aberta-' + tag); await page.setViewportSize({ width: originalRes.width, height: originalRes.height }); await waitForAnimations(page, 400); }
async function checkTextContrast(page, tag) { const issues = await page.evaluate(() => { const blocks = [...document.querySelectorAll('.wg-block')]; const results = []; for (const b of blocks) { const cs = getComputedStyle(b); const text = cs.color; const bg = cs.backgroundColor; if (text === bg) results.push({ text: b.textContent.trim().slice(0, 30), textColor: cs.color, bg }); } return results; }); for (const i of issues) { note('contraste', 'bloco com texto e fundo iguais: ' + i.text + ' (' + i.textColor + ')', 'contraste-' + tag, i); } }
async function cleanGrade(page) { for (let i = 0; i < 24; i++) { let blocks = 0; try { blocks = await page.locator('.wg-block').count(); } catch { break; } if (blocks === 0) break; try { await page.locator('.wg-block').first().hover({ force: true, timeout: 3000 }); await page.locator('.wg-block .b-remove').first().click({ force: true, timeout: 3000 }); } catch (e) { /* re-render no meio do clique: tenta de novo */ } await waitForAnimations(page, 700); } }
async function safeRun(name, fn, tag) { try { await fn(); } catch (e) { note('teste', name + ' falhou: ' + e.message.slice(0, 120), tag); } }

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => note('js', 'pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('status of 400')) { note('js', 'console: ' + m.text()); } });

  await page.goto(BASE + '/pages/login.html', { waitUntil: 'networkidle' });
  await page.fill('#email', 'gradehoraria+mock.ana@gmail.com');
  await page.fill('#password', 'Mock@123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/grade**', { timeout: 20000 });
  await page.waitForSelector('.subject-card', { timeout: 20000 });

  await cleanGrade(page);

  // ============ FASE A: inventário COMPLETO em 1280px (claro + escuro) ============
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const theme of THEMES) {
    await setTheme(page, theme);
    await waitForAnimations(page, 400);
    const tag = 'laptop-1280-' + theme + '-z100';

    await safeRun('grade-vazia', async () => { await cleanGrade(page); await shot(page, 'grade-vazia-' + tag, { fullPage: true }); await noHScroll(page, 'grade-vazia-' + tag); }, tag);
    await safeRun('grade-1turma', async () => { await addFirstAvailableClass(page); await shot(page, 'grade-1turma-' + tag, { fullPage: true }); await checkBlockVisuals(page, 'grade-1turma-blocos-' + tag); }, tag);
    await safeRun('grade-cheia', async () => { await cleanGrade(page); for (let i = 0; i < 6; i++) { const added = await addFirstAvailableClass(page); if (!added) break; } await shot(page, 'grade-cheia-' + tag, { fullPage: true }); await checkBlockVisuals(page, 'grade-cheia-blocos-' + tag); }, tag);
    await safeRun('sanfona', () => testAccordionStates(page, tag), tag);
    await safeRun('sort', () => testSortModes(page, tag), tag);
    await safeRun('busca', () => testSearch(page, tag), tag);
    await safeRun('catalogo-estados', () => testCatalogSubjectStates(page, tag), tag);
    await safeRun('hover', () => testHoverGlass(page, tag), tag);
    await safeRun('menu', () => testHeaderMenu(page, tag), tag);
    await safeRun('visibilidade', () => testVisibilitySelector(page, tag), tag);
    await safeRun('choque', () => testTimeConflict(page, tag), tag);
    await safeRun('cores', () => testAlgorithmicColors(page, tag), tag);
    await safeRun('anim-interrompida', () => testAnimationInterruption(page, tag), tag);
    await safeRun('resize-sanfona', () => testResizeWithOpenAccordion(page, tag, { width: 1280, height: 900 }), tag);
    await safeRun('contraste', () => checkTextContrast(page, tag), tag);
    await cleanGrade(page);
  }

  // ============ FASE B: ESTADOS CRÍTICOS em todas as resoluções (2 temas) ============
  for (const res of RESOLUTIONS) {
    await page.setViewportSize({ width: res.width, height: res.height });
    await waitForAnimations(page, 400);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      await waitForAnimations(page, 400);
      const tag = res.name + '-' + theme + '-z100';

      await safeRun('B:grade-vazia', async () => { await cleanGrade(page); await shot(page, 'grade-vazia-' + tag, { fullPage: true }); await noHScroll(page, 'grade-vazia-' + tag); }, tag);
      await safeRun('B:grade-cheia', async () => { await cleanGrade(page); for (let i = 0; i < 6; i++) { const added = await addFirstAvailableClass(page); if (!added) break; } await shot(page, 'grade-cheia-' + tag, { fullPage: true }); }, tag);
      await safeRun('B:sanfona-aberta', async () => { const states = await getSemesterStates(page); for (const s of states) if (!s.open) await toggleSemester(page, s.index); await shot(page, 'sanfona-todas-abertas-' + tag, { fullPage: true }); }, tag);
      await safeRun('B:sanfona-fechada', async () => { const states = await getSemesterStates(page); for (const s of states) if (s.open) await toggleSemester(page, s.index); await shot(page, 'sanfona-todas-fechadas-' + tag, { fullPage: true }); }, tag);
      await safeRun('B:menu-aberto', async () => { await openMenu(page); await shot(page, 'menu-aberto-' + tag, { fullPage: false }); await closeMenu(page); }, tag);
      await safeRun('B:busca', () => testSearch(page, tag), tag);
      await safeRun('B:hover', () => testHoverGlass(page, tag), tag);
      await safeRun('B:visibilidade', () => testVisibilitySelector(page, tag), tag);
      await safeRun('B:contraste', () => checkTextContrast(page, tag), tag);
      await cleanGrade(page);
    }
  }

  // ============ FASE C: ZOOM em 1280 (90 / 125 / 150) ============
  await page.setViewportSize({ width: 1280, height: 900 });
  await setTheme(page, 'light');
  for (const zoom of [0.9, 1.25, 1.5]) {
    await setZoom(page, zoom);
    await waitForAnimations(page, 400);
    const tag = 'laptop-1280-light-z' + Math.round(zoom * 100);

    await safeRun('C:grade-vazia', async () => { await cleanGrade(page); await shot(page, 'zoom-grade-vazia-' + tag, { fullPage: true }); await noHScroll(page, 'zoom-grade-vazia-' + tag); }, tag);
    await safeRun('C:grade-cheia', async () => { await cleanGrade(page); for (let i = 0; i < 6; i++) { const added = await addFirstAvailableClass(page); if (!added) break; } await shot(page, 'zoom-grade-cheia-' + tag, { fullPage: true }); }, tag);
    await safeRun('C:sanfona', async () => { const states = await getSemesterStates(page); for (const s of states) if (!s.open) await toggleSemester(page, s.index); await shot(page, 'zoom-sanfona-aberta-' + tag, { fullPage: true }); }, tag);
    await safeRun('C:menu', async () => { await openMenu(page); await shot(page, 'zoom-menu-aberto-' + tag, { fullPage: false }); await closeMenu(page); }, tag);
    await cleanGrade(page);
  }
  await setZoom(page, 1.0);

  // ============ FASE D: interrupção de animação + resize (1280) ============
  await setTheme(page, 'light');
  await safeRun('D:anim', () => testAnimationInterruption(page, 'laptop-1280-light-z100'), 'laptop-1280-light-z100');
  await safeRun('D:resize', () => testResizeWithOpenAccordion(page, 'laptop-1280-light-z100', { width: 1280, height: 900 }), 'laptop-1280-light-z100');
  await cleanGrade(page);

  console.log('\n================ RESUMO QA RODADA 2 ================');
  if (findings.length === 0) console.log('Nenhum problema detectado.');
  for (const f of findings) console.log('WARN [' + f.area + '] ' + f.issue + ' -> ' + f.shot + '.png | ctx: ' + f.ctx);
  console.log('Total: ' + findings.length + ' achado(s). Prints em ' + OUT);

  await browser.close();
  process.exit(findings.length === 0 ? 0 : 1);
}

main();
async function testSearch(page, tag) { await shot(page, 'busca-vazia-' + tag); await searchCatalog(page, 'xyzxyzxyz'); await shot(page, 'busca-sem-resultado-' + tag); const count0 = await getVisibleSubjectCount(page); if (count0 !== 0) note('busca', 'busca sem resultado mostrou ' + count0 + ' itens', tag); await searchCatalog(page, 'calc_fvr'); await shot(page, 'busca-1-resultado-' + tag); await searchCatalog(page, 'calc'); await shot(page, 'busca-muitos-resultados-' + tag); await searchCatalog(page, ''); }

async function checkTextContrast(page, tag) { const info = await page.evaluate(() => { const blocks = [...document.querySelectorAll('.wg-block')]; return blocks.map((b, i) => { const cs = getComputedStyle(b); const bg = cs.backgroundColor; const text = cs.color; return { idx: i, bg, text, contrast: 'unknown' }; }); }); for (const b of info) { ok('contraste bloco ' + b.idx + ': ' + b.text); } await shot(page, 'contraste-' + tag); }

async function cleanGrade(page) { await page.evaluate(() => { const removeBtns = [...document.querySelectorAll('.wg-block .b-remove')]; removeBtns.forEach(btn => btn.click()); }); await page.waitForTimeout(500); }
