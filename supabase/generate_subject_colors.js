/* generate_subject_colors.js — Gera cores algorítmicas por matéria (v7)
 *
 * Teoria aplicada:
 * - Cada CURSO ganha um matiz-base derivado de hash do course_id (determinista).
 * - Matérias-BASE (sem pré-requisito dentro do curso) recebem matizes
 *   primários espalhados pela roda de cores a partir do matiz do curso,
 *   usando o ângulo áureo (137.508°) — máximo contraste entre cadeias
 *   não relacionadas.
 * - Matérias DERIVADAS (com pré-requisito) herdam o matiz do pré-requisito
 *   principal rotacionado +18° por geração (esquema análogo: parentesco
 *   visual dentro da família), com saturação/luminosidade ajustadas pela
 *   profundidade na cadeia.
 * - Determinista e idempotente: mesmo catálogo → mesmas cores. Por padrão
 *   só preenche quem está sem cor (ou divergente); --force regenera tudo.
 *
 * Uso:  node generate_subject_colors.js [--force] [--dry-run]
 */
const { getClient } = require('./db');

const GOLDEN_ANGLE = 137.508;
const FAMILY_SHIFT = 18;       // graus por geração dentro da mesma cadeia
const BASE_SAT = 72;           // saturação das matérias-base
const BASE_LIGHT = 55;         // luminosidade das matérias-base
const DEPTH_LIGHT_STEP = 4;    // clareia... na prática: escurece por geração

/** Hash estável de string → 0..359 (matiz do curso). */
function hashHue(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h % 360;
}

/** HSL (°,% ,%) → hex #RRGGBB */
function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.min(100, Math.max(0, s)) / 100;
  l = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to2 = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`.toUpperCase();
}

/**
 * Atribui cores para UM curso. Retorna Map subjectId → hex.
 * @param {Array<{id:string, code:string, prerequisites:string[]}>} subjects
 * @param {string} courseId
 */
function assignCourseColors(subjects, courseId) {
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const baseHue = hashHue(courseId);

  /* Profundidade = maior distância até uma raiz (memoizado, com guarda contra ciclo) */
  const depth = new Map();
  function depthOf(id, seen = new Set()) {
    if (depth.has(id)) return depth.get(id);
    if (seen.has(id)) return 0; // ciclo: trata como raiz
    const subject = byId.get(id);
    if (!subject) return 0;
    const prereqs = (subject.prerequisites || []).filter((p) => byId.has(p));
    if (prereqs.length === 0) { depth.set(id, 0); return 0; }
    seen.add(id);
    const d = 1 + Math.max(...prereqs.map((p) => depthOf(p, seen)));
    seen.delete(id);
    depth.set(id, d);
    return d;
  }

  /* Matiz de uma matéria: raiz → posição na roda; derivada → família do
     pré-requisito "principal" (o de menor código, determinista). */
  const hue = new Map();
  const roots = subjects
    .filter((s) => depthOf(s.id) === 0)
    .sort((a, b) => a.code.localeCompare(b.code));
  roots.forEach((s, i) => hue.set(s.id, (baseHue + i * GOLDEN_ANGLE) % 360));

  /* Processa por profundidade crescente para garantir pai antes do filho */
  const chain = subjects
    .filter((s) => depthOf(s.id) > 0)
    .sort((a, b) => depthOf(a.id) - depthOf(b.id) || a.code.localeCompare(b.code));

  for (const s of chain) {
    const d = depthOf(s.id);
    const prereqs = (s.prerequisites || []).filter((p) => byId.has(p));
    /* Pré-requisito principal = o de MAIOR profundidade (herda da ponta da
       cadeia); desempate por código para determinismo. */
    const parent = prereqs
      .map((p) => byId.get(p))
      .sort((a, b) => depthOf(b.id) - depthOf(a.id) || a.code.localeCompare(b.code))[0];
    const parentHue = hue.get(parent.id);
    hue.set(s.id, (parentHue + FAMILY_SHIFT * d) % 360);
  }

  const colors = new Map();
  for (const s of subjects) {
    const d = depthOf(s.id);
    const h = hue.get(s.id);
    if (d === 0) {
      colors.set(s.id, hslToHex(h, BASE_SAT, BASE_LIGHT));
    } else {
      /* Derivadas: mesma família, levemente menos saturadas e mais escuras */
      colors.set(s.id, hslToHex(h, Math.max(48, BASE_SAT - d * 5), Math.max(34, BASE_LIGHT - d * DEPTH_LIGHT_STEP)));
    }
  }
  return colors;
}

(async () => {
  const force = process.argv.includes('--force');
  const dryRun = process.argv.includes('--dry-run');
  const c = getClient();
  await c.connect();
  try {
    const { rows: subjects } = await c.query(
      'SELECT id, code, course_id, prerequisites, color FROM subjects WHERE is_active = true ORDER BY code'
    );
    const byCourse = new Map();
    for (const s of subjects) {
      if (!byCourse.has(s.course_id)) byCourse.set(s.course_id, []);
      byCourse.get(s.course_id).push(s);
    }

    let updated = 0;
    let skipped = 0;
    for (const [courseId, courseSubjects] of byCourse) {
      const colors = assignCourseColors(courseSubjects, courseId);
      for (const s of courseSubjects) {
        const expected = colors.get(s.id);
        if (!force && s.color === expected) { skipped++; continue; }
        if (dryRun) {
          const d = (s.prerequisites || []).length > 0 ? 'derivada' : 'base    ';
          console.log(`${d} ${s.code.padEnd(16)} ${s.color || '—'} → ${expected}`);
          continue;
        }
        await c.query('UPDATE subjects SET color = $1 WHERE id = $2', [expected, s.id]);
        updated++;
      }
    }
    console.log(
      dryRun
        ? `\n(dry-run) ${subjects.length} matérias em ${byCourse.size} curso(s)`
        : `\n✅ ${updated} cor(es) gravadas, ${skipped} já estavam certas (${byCourse.size} curso(s))`
    );
  } finally {
    await c.end();
  }
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
