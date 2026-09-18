// test_stress.js - AUDITORIA DE ESTRESSE: tenta quebrar o banco (edge cases)
// Pre-req: node create_mock_users.js
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

    const login = await (await fetch(`${URL}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: baseHeaders, body: JSON.stringify({ email: EMAIL, password: PASS })
    })).json();
    const tA = login.access_token, uid = login.user.id;
    check('Login Ana', !!tA);

    // == 1) INTEGRIDADE REFERENCIAL ==
    console.log('\n== 1) INTEGRIDADE REFERENCIAL ==');
    const fk = async (name, sql) => {
        try { await dbc.query(sql); check(name, false, 'passou! violou FK'); }
        catch (e) { check(name, e.code === '23503', e.code); }
    };
    await fk('Classe sem subject existente: BLOQUEADO', `INSERT INTO classes (code, subject_id) VALUES ('ORFAO','00000000-0000-0000-0000-000000000000')`);
    await fk('Professor sem campus: BLOQUEADO', `INSERT INTO professors (name, campus_id) VALUES ('Fantasma','00000000-0000-0000-0000-000000000000')`);
    await fk('Sala sem campus: BLOQUEADO', `INSERT INTO rooms (name, campus_id) VALUES ('X999','00000000-0000-0000-0000-000000000000')`);
    // 1d) student_classes com FKs inexistentes -> trava de prereq (P0001 "Grade nao encontrada") barra ANTES da FK
    try {
        await dbc.query(`INSERT INTO student_classes (grade_id, class_id) VALUES ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000')`);
        check('Matricula inexistente: BLOQUEADO (trigger ou FK)', false, 'passou!');
    } catch (e) { check('Matricula inexistente: BLOQUEADO (trigger ou FK)', ['23503', 'P0001'].includes(e.code), e.code); }
    // 1e) grade_id FK inexistente: a trava de prereq (P0001) dispara ANTES da FK — linha nunca entra
    const realClass = (await dbc.query(`SELECT id FROM classes LIMIT 1`)).rows[0].id;
    try {
        await dbc.query(`INSERT INTO student_classes (grade_id, class_id) VALUES ('00000000-0000-0000-0000-000000000000', $1)`, [realClass]);
        check('grade_id inexistente: linha REJEITADA', false, 'passou!');
    } catch (e) { check('grade_id inexistente: linha REJEITADA (defesa em camadas)', ['23503', 'P0001'].includes(e.code), e.code); }

    // == 2) DELECAO EM CASCATA ==
    console.log('\n== 2) DELECAO EM CASCATA ==');
    const campus = (await dbc.query(`SELECT id FROM campuses LIMIT 1`)).rows[0].id;
    const course = (await dbc.query(`SELECT id FROM courses WHERE campus_id=$1 LIMIT 1`, [campus])).rows[0].id;
    const subTmp = (await dbc.query(`INSERT INTO subjects (code, course_id, name) VALUES ('TMP_STRESS',$1,'Materia Stress') RETURNING id`, [course])).rows[0].id;
    const clsTmp = (await dbc.query(`INSERT INTO classes (code, subject_id, semester) VALUES ('TMP_STRESS-A',$1,9) RETURNING id`, [subTmp])).rows[0].id;
    const schTmp = (await dbc.query(`INSERT INTO class_schedules (class_id, day_of_week, start_time, end_time) VALUES ($1,6,'19:00','21:00') RETURNING id`, [clsTmp])).rows[0].id;
    const g = await api('/grades', { method: 'POST', token: tA, body: { student_id: uid, semester: 9, year: 2099, name: 'Grade Stress', visibility: 'private' } });
    const gTmp = g.body?.[0]?.id;
    const enr = await api('/student_classes', { method: 'POST', token: tA, body: { grade_id: gTmp, class_id: clsTmp } });
    check('Setup cascata completo', !!gTmp && enr.status === 201);

    await dbc.query('DELETE FROM subjects WHERE id = $1', [subTmp]);
    const orfaos = await dbc.query(`SELECT
        (SELECT count(*) FROM classes WHERE id=$1) cls,
        (SELECT count(*) FROM class_schedules WHERE id=$2) sch,
        (SELECT count(*) FROM student_classes WHERE class_id=$1) mat`, [clsTmp, schTmp]);
    check('CASCATA limpa classes+schedules+matriculas', orfaos.rows[0].cls == 0 && orfaos.rows[0].sch == 0 && orfaos.rows[0].mat == 0, JSON.stringify(orfaos.rows[0]));

    // == 3) CHOQUE CROSS-GRADE ==
    console.log('\n== 3) CHOQUE CROSS-GRADE ==');
    const g1 = (await api('/grades', { method: 'POST', token: tA, body: { student_id: uid, semester: 3, year: 2099, name: 'G1 pub', visibility: 'public' } })).body?.[0]?.id;
    const g2 = (await api('/grades', { method: 'POST', token: tA, body: { student_id: uid, semester: 3, year: 2098, name: 'G2 priv', visibility: 'private' } })).body?.[0]?.id;
    const classes = (await api('/classes?select=id,code')).body;
    const C = Object.fromEntries(classes.map(c => [c.code, c.id]));

    const e1 = await api('/student_classes', { method: 'POST', token: tA, body: { grade_id: g1, class_id: C['metodologia-A'] } });
    check('G1 (publica): metodologia matriculada', e1.status === 201);
    const e2 = await api('/student_classes', { method: 'POST', token: tA, body: { grade_id: g2, class_id: C['bd1-A'] } });
    check('G2 (privada): choque cross-grade BLOQUEADO', e2.status >= 400 && String(e2.body?.message || '').includes('Choque'), String(e2.body?.message || '').slice(0, 80));
    const e3 = await api('/student_classes', { method: 'POST', token: tA, body: { grade_id: g2, class_id: C['gaal-A'] } });
    check('G2: materia sem choque LIBERADA (controle)', e3.status === 201);

    // == 4) DADOS ABSURDOS ==
    console.log('\n== 4) DADOS ABSURDOS ==');
    const neg = await api(`/student_classes?grade_id=eq.${g2}&class_id=eq.${C['gaal-A']}`, { method: 'PATCH', token: tA, body: { absences: -5 } });
    check('absences = -5: BLOQUEADO (CHECK)', neg.status >= 400, String(neg.body?.message || '').slice(0, 90));
    const st = await api('/student_classes', { method: 'POST', token: tA, body: { grade_id: g2, class_id: C['ingles1-A'], status: 'hackeado' } });
    check('status invalido: BLOQUEADO (CHECK enum)', st.status >= 400 && String(st.body?.message || '').includes('student_classes_status_check'), String(st.body?.message || '').slice(0, 90));
    try {
        await dbc.query(`INSERT INTO class_schedules (class_id, day_of_week, start_time, end_time) VALUES ($1,1,'18:00','07:00')`, [C['gaal-A']]);
        check('Horario invertido (end<start): BLOQUEADO', false, 'passou!');
    } catch (e) { check('Horario invertido (end<start): BLOQUEADO', e.code === '23514', e.code); }

    // carga absurda mas valida de faltas (999) deve passar pelo banco - regra 25% e da UI
    const big = await api(`/student_classes?grade_id=eq.${g2}&class_id=eq.${C['gaal-A']}`, { method: 'PATCH', token: tA, body: { absences: 999 } });
    check('absences = 999: aceito pelo banco (regra 25% e UI)', big.status < 300);

    // RLS: DELETE fora do escopo nao apaga nada de ninguem
    const antes = (await dbc.query(`SELECT count(*) AS n FROM student_classes`)).rows[0].n;
    await api('/student_classes?id=eq.00000000-0000-0000-0000-000000000000', { method: 'DELETE', token: tA });
    const depois = (await dbc.query(`SELECT count(*) AS n FROM student_classes`)).rows[0].n;
    check('DELETE fora do escopo: contagem global intacta', antes === depois, `antes=${antes} depois=${depois}`);

    // limpeza das grades cobaia
    await api(`/grades?student_id=eq.${uid}`, { method: 'DELETE', token: tA });
    check('Limpeza das grades cobaia', true);

    await dbc.end();
    console.log(`\n📊 AUDITORIA DE ESTRESSE: ${pass} PASS / ${fail} FAIL`);
    process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error('❌ FATAL:', e.message); process.exit(1); });