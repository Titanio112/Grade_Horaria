// test_mock_flow.js - Teste funcional com dados FICTICIOS (3 alunos mock)
// Cenario: grades, trigger de pre-requisitos, privacidade publica/privada, colegas de turma.
// Limpeza: node cleanup_mocks.js
const { loadEnv, getClient } = require('./db');

const env = loadEnv();
const URL = env.SUPABASE_URL;
const KEY = env.SUPABASE_ANON_KEY;
const baseHeaders = { 'apikey': KEY, 'Content-Type': 'application/json' };

const STUDENTS = [
    { name: 'Ana Mock', email: 'gradehoraria+mock.ana@gmail.com', publicGrade: true },
    { name: 'Bruno Mock', email: 'gradehoraria+mock.bruno@gmail.com', publicGrade: true },
    { name: 'Carla Mock', email: 'gradehoraria+mock.carla@gmail.com', publicGrade: false },
];
const PASS = 'Mock@123456';

let pass = 0, fail = 0;
function check(name, ok, detail = '') {
    if (ok) { pass++; console.log(`  ✅ ${name}`, detail); }
    else { fail++; console.log(`  ❌ ${name}`, detail); }
}

async function api(path, { method = 'GET', token = null, body = null, prefer = 'return=representation' } = {}) {
    const headers = { ...baseHeaders, Prefer: prefer };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const r = await fetch(`${URL}/rest/v1${path}`, { method, headers, body: body ? JSON.stringify(body) : null });
    let j = null; try { j = await r.json(); } catch {}
    return { status: r.status, body: j };
}

async function signupOrLogin(email, name) {
    const s = await fetch(`${URL}/auth/v1/signup`, { method: 'POST', headers: baseHeaders,
        body: JSON.stringify({ email, password: PASS, data: { full_name: name } }) });
    const sj = await s.json();
    if (!s.ok) console.log(`    [signup ${name}] ${s.status}: ${sj.error_code || sj.msg || JSON.stringify(sj).slice(0,80)}`);
    const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: baseHeaders,
        body: JSON.stringify({ email, password: PASS }) });
    const j = await r.json();
    if (!j.access_token) console.log(`    [login ${name}] ${r.status}: ${j.error_code || j.msg || JSON.stringify(j).slice(0,80)}`);
    return j.access_token ? { token: j.access_token, id: j.user.id } : null;
}


async function enroll(token, gradeId, classId) {
    const r = await api('/student_classes', { method: 'POST', token, body: { grade_id: gradeId, class_id: classId } });
    if (r.status === 201) return r;
    // ja matriculado (rerun) conta como "permitido"
    if (r.status >= 400 && String(r.body?.message || r.body?.code || '').match(/duplicate|23505/)) {
        return { ...r, status: 201, body: r.body, _dup: true };
    }
    return r;
}

(async () => {
    const dbc = getClient();
    await dbc.connect();

    console.log('\n== 1) CRIAR 3 ALUNOS FICTICIOS ==');
    const sessions = {};
    for (const s of STUDENTS) {
        let sess = await signupOrLogin(s.email, s.name);
        // confirmar email via banco (mock nao recebe email real) e tentar de novo
        if (!sess) {
            await dbc.query('UPDATE auth.users SET email_confirmed_at = NOW() WHERE email = $1', [s.email]);
            sess = await signupOrLogin(s.email, s.name);
        }
        check(`Signup/login ${s.name}`, !!sess);
        if (sess) sessions[s.name] = sess;
    }
    if (Object.keys(sessions).length < 3) { console.log('Abortando: faltam sessoes'); await dbc.end(); process.exit(1); }

    // profiles + vinculo ao curso BSI
    await dbc.query(`INSERT INTO public.profiles (id, email, full_name, role)
        SELECT u.id, u.email, u.raw_user_meta_data->>'full_name', 'student'::user_role
        FROM auth.users u WHERE u.email LIKE 'gradehoraria+mock.%'
        AND NOT EXISTS (SELECT 1 FROM profiles p2 WHERE p2.id = u.id) ON CONFLICT (id) DO NOTHING`);
    await dbc.query(`UPDATE profiles SET course_id = (SELECT id FROM courses WHERE name='Sistemas de Informacao')
        WHERE email LIKE 'gradehoraria+mock.%'`);
    console.log('  ✅ Profiles criados e vinculados ao curso BSI');

    const cls = (await api('/classes?select=id,subjects(code,name)')).body;
    const C = {}; for (const c of cls) C[c.subjects.code] = c.id;

    console.log('\n== 2) GRADES + TRIGGER DE PRE-REQUISITOS (multiplo) ==');
    // limpar grades antigas de runs anteriores (via API, deleta em cascata)
    for (const s of STUDENTS) {
        await api(`/grades?student_id=eq.${sessions[s.name].id}`, { method: 'DELETE', token: sessions[s.name].token });
    }
    for (const s of STUDENTS) {
        const t = sessions[s.name].token, uid = sessions[s.name].id;
        const g = await api('/grades', { method: 'POST', token: t,
            body: { student_id: uid, semester: 2, year: 2026, name: `Grade ${s.name}`, is_public: s.publicGrade } });
        s.gradeId = g.body?.[0]?.id;
        if (!s.gradeId) { // ja existe (UNIQUE): reutilizar
            const ex = await api(`/grades?student_id=eq.${uid}&semester=eq.2&year=eq.2026`, { token: t });
            s.gradeId = ex.body?.[0]?.id;
        }
        check(`Grade criada (${s.name}, publica=${s.publicGrade})`, !!s.gradeId);
    }

    // Ana: prog2 bloqueado -> completa pre-reqs -> liberado
    const tA = sessions['Ana Mock'].token, gA = STUDENTS[0].gradeId;
    const failA = await enroll(tA, gA, C['prog2']);
    check('Ana -> prog2 SEM pre-req: BLOQUEADO pelo banco', failA.status >= 400 && !failA._dup);
    await enroll(tA, gA, C['prog1']);
    await enroll(tA, gA, C['lab_prog']);
    await api(`/student_classes?grade_id=eq.${gA}&class_id=in.(${C['prog1']},${C['lab_prog']})`, { method: 'PATCH', token: tA, body: { status: 'completed', final_grade: 9.0 } });
    const okA = await enroll(tA, gA, C['prog2']);
    check('Ana -> prog2 APOS completar pre-reqs: LIBERADO', okA.status === 201);
    await enroll(tA, gA, C['metodologia']);

    // Bruno: metodologia (turma comum) + bd2 bloqueado + bd1 liberado
    const tB = sessions['Bruno Mock'].token, gB = STUDENTS[1].gradeId;
    await enroll(tB, gB, C['metodologia']);
    const failB = await enroll(tB, gB, C['bd2']);
    check('Bruno -> bd2 SEM pre-req: BLOQUEADO pelo banco', failB.status >= 400 && !failB._dup, String(failB.body?.message || '').slice(0, 70));
    const okB = await enroll(tB, gB, C['arq1']);  // Seg 14:40-16:40 (sequencia apos metodologia 13-14:40)
    check('Bruno -> arq1 (sem pre-req, sem choque): LIBERADO', okB.status === 201);

    // Carla: metodologia (grade privada)
    const tC = sessions['Carla Mock'].token, gC = STUDENTS[2].gradeId;
    await enroll(tC, gC, C['metodologia']);

    console.log('\n== 3) PRIVACIDADE: GRADE PUBLICA vs PRIVADA ==');
    const readB = await api(`/grades?student_id=eq.${sessions['Bruno Mock'].id}`, { token: tA });
    check('Ana le grade PUBLICA de Bruno', Array.isArray(readB.body) && readB.body.length === 1);
    const readC = await api(`/grades?student_id=eq.${sessions['Carla Mock'].id}`, { token: tA });
    check('Ana NAO le grade PRIVADA de Carla', Array.isArray(readC.body) && readC.body.length === 0);
    const readOwn = await api(`/grades?student_id=eq.${sessions['Carla Mock'].id}`, { token: tC });
    check('Carla le a PROPRIA grade', Array.isArray(readOwn.body) && readOwn.body.length === 1);

    console.log('\n== 4) COLEGAS DE TURMA (shares_class) - "modo grupo" ==');
    const colegas = await api(`/student_classes?class_id=eq.${C['metodologia']}&select=grade_id,status&grade_id=neq.${gA}`, { token: tA });
    check('Ana ve colegas da turma de Metodologia', (colegas.body || []).length >= 2, `${(colegas.body || []).length} colegas visiveis`);
    const arq1view = await api(`/student_classes?class_id=eq.${C['arq1']}&select=id`, { token: tA });
    check('Ana NAO ve matricula de Bruno em arq1 (ela nao frequenta essa turma)', (arq1view.body || []).length === 0);

    console.log('\n== 5) FALTAS (contador) ==');
    const abs = await api(`/student_classes?grade_id=eq.${gA}&class_id=eq.${C['metodologia']}`,
        { method: 'PATCH', token: tA, body: { absences: 8 } });
    check('Ana registra 8 faltas (regra 25% na UI)', abs.status < 300);

    await dbc.end();
    console.log(`\n📊 RESULTADO GERAL: ${pass} PASS / ${fail} FAIL`);
    console.log('🧹 Para limpar: node cleanup_mocks.js');
    process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error('❌ FATAL:', e.message); process.exit(1); });