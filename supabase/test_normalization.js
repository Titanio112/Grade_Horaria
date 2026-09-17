// test_normalization.js - Provas da remodelagem v3 (normalizacao + trava de choque)
// Pre-req: node create_mock_users.js antes (banco limpo de mocks antigos)
const { loadEnv, getClient } = require('./db');

const env = loadEnv();
const URL = env.SUPABASE_URL, KEY = env.SUPABASE_ANON_KEY;
const baseHeaders = { 'apikey': KEY, 'Content-Type': 'application/json' };
const EMAIL = 'gradehoraria+mock.ana@gmail.com', PASS = 'Mock@123456';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { ok ? (pass++, console.log(`  ✅ ${n}`, d)) : (fail++, console.log(`  ❌ ${n}`, d)); };

async function api(path, { method = 'GET', token = null, body = null } = {}) {
    const headers = { ...baseHeaders, Prefer: 'return=representation' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const r = await fetch(`${URL}/rest/v1${path}`, { method, headers, body: body ? JSON.stringify(body) : null });
    let j = null; try { j = await r.json(); } catch {}
    return { status: r.status, body: j };
}

(async () => {
    const dbc = getClient(); await dbc.connect();

    // Login Ana (mock)
    const login = await (await fetch(`${URL}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: baseHeaders, body: JSON.stringify({ email: EMAIL, password: PASS })
    })).json();
    const tA = login.access_token, uid = login.user.id;
    check('Login Ana', !!tA);

    // ---------- A) Busca cruzada: Materia + Professor + Dia ----------
    console.log('\n== A) BUSCA CRUZADA (materia + professor + dia) ==');
    // "Programação de Computadores I" (semestre 1) professores Weider/Marcelo, Qui (4)
    const q = await api('/classes?select=id,subjects!inner(name),class_professors(professors!inner(name)),class_schedules!inner(day_of_week,start_time,end_time,room)'
        + '&subjects.name=ilike.*Computadores*'
        + '&class_professors.professors.name=ilike.*Weider*'
        + '&class_schedules.day_of_week=eq.4', { token: tA });
    check('Filtro cruzado retorna turma', Array.isArray(q.body) && q.body.length >= 1,
        Array.isArray(q.body) ? `${q.body.length} resultado(s): ${q.body.map(c => c.subjects?.name).join(' | ')}` : JSON.stringify(q.body).slice(0, 150));
    if (Array.isArray(q.body) && q.body[0]) {
        const profs = q.body[0].class_professors?.flatMap(cp => cp.professors?.name) || [];
        check('Professor batido no filtro', profs.some(p => String(p).includes('Weider')), profs.join(', '));
    }

    // ---------- B) 2 professores na mesma turma ----------
    console.log('\n== B) 2 PROFESSORES NA MESMA TURMA ==');
    const prof2 = await api(`/classes?select=id,subjects(name),class_professors(professors(name))&code=eq.lab_prog-A`, { token: tA });
    const names = prof2.body?.[0]?.class_professors?.map(cp => cp.professors.name) || [];
    check('Turma lab_prog-A tem 2 professores (split "Weider/Marcelo")', names.length === 2, names.join(' + '));

    // ---------- C/D) Trava de choque de horarios ----------
    console.log('\n== C/D) TRAVA DE CHOQUE ==');
    // limpar grades anteriores da Ana (teste isolado)
    await api(`/grades?student_id=eq.${uid}`, { method: 'DELETE', token: tA });
    // grade da Ana
    const g = await api('/grades', { method: 'POST', token: tA, body: { student_id: uid, semester: 1, year: 2026, name: 'Grade Teste Choque', is_public: true } });
    const gId = g.body?.[0]?.id || (await api(`/grades?student_id=eq.${uid}&semester=eq.1&year=eq.2026`, { token: tA })).body?.[0]?.id;

    const cls = (await api('/classes?select=id,code')).body;
    const C = Object.fromEntries(cls.map(c => [c.code, c.id]));
    const enroll = (code) => api('/student_classes', { method: 'POST', token: tA, body: { grade_id: gId, class_id: C[code] } });

    const r1 = await enroll('metodologia-A');  // Seg 13:00-14:40
    check('Ana -> metodologia (Seg 13:00-14:40)', r1.status === 201);

    // C) sequencia exata: ingles1 Seg 14:40-16:40 -> NAO e conflito
    const r2 = await enroll('ingles1-A');
    check('C) Sequencia exata 14:40->14:40 PERMITIDA (ingles1)', r2.status === 201);

    // D) choque real: bd1 Seg 13:00-14:40 sobrepoe metodologia
    const r3 = await enroll('bd1-A');
    const msg = String(r3.body?.message || '');
    check('D) Choque bd1 x metodologia BLOQUEADO', r3.status >= 400 && msg.includes('Choque'), msg.slice(0, 80));

    // choque parcial tambem bloqueia (area: outra materia Seg sobrepondo meio)
    const r4 = await enroll('leitura-A');      // Seg 16:40-18:30 -> sequencia apos ingles1 (16:40): permitido
    check('C2) leitura (Seg 16:40-18:30) em sequencia PERMITIDA', r4.status === 201);

    // limpeza da grade de teste
    await dbc.query('DELETE FROM grades WHERE id = $1', [gId]);

    // ---------- Extra: indices criados ----------
    const idx = await dbc.query(`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'idx_%' ORDER BY 1`);
    console.log('\n📇 Indices de busca:', idx.rows.map(r => r.indexname).join(', '));

    await dbc.end();
    console.log(`\n📊 RESULTADO v3: ${pass} PASS / ${fail} FAIL`);
    process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error('❌ FATAL:', e.message); process.exit(1); });
