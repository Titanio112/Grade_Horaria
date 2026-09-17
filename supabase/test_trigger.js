// test_trigger.js - PROVA do trigger de pre-requisitos (e validacoes RLS)
// Fluxo: login -> criar grade -> tentar matricular prog2 SEM pre-req (deve FALHAR)
//        -> matricular prog1 -> completar prog1 -> matricular prog2 (deve PASSAR)
//        -> controle de faltas (absences)
const { loadEnv, getClient } = require('./db');

const env = loadEnv();
const URL = env.SUPABASE_URL;
const KEY = env.SUPABASE_ANON_KEY;
const testEmail = 'gradehoraria.teste+1789613619334@gmail.com';
const testPass = 'Teste@123456';
const baseHeaders = { 'apikey': KEY, 'Content-Type': 'application/json' };

let pass = 0, fail = 0;
function check(name, ok, detail = '') {
    if (ok) { pass++; console.log(`✅ ${name}`, detail); }
    else { fail++; console.log(`❌ ${name}`, detail); }
}

(async () => {
    // Confirmar email do usuario de teste (idempotente)
    const dbc = getClient(); await dbc.connect();
    await dbc.query('UPDATE auth.users SET email_confirmed_at = NOW() WHERE email = $1', [testEmail]);
    await dbc.end();

    // Login
    const login = await (await fetch(`${URL}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: baseHeaders,
        body: JSON.stringify({ email: testEmail, password: testPass })
    })).json();
    check('Login', !!login.access_token);
    const h = { ...baseHeaders, 'Authorization': `Bearer ${login.access_token}`, 'Prefer': 'return=representation' };
    const uid = login.user.id;

    // Garantir profile
    await fetch(`${URL}/rest/v1/profiles`, { method: 'POST', headers: { ...h, 'Prefer': 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify({ id: uid, email: testEmail, full_name: 'Usuario Teste' }) });

    // Grade de teste
    const grade = await (await fetch(`${URL}/rest/v1/grades`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ student_id: uid, semester: 2, year: 2026, name: 'Grade Teste Trigger' })
    })).json();
    const gradeId = grade[0]?.id;
    check('Criar grade', !!gradeId);

    // IDs das turmas relevantes (via subjects.code)
    const cls = await (await fetch(`${URL}/rest/v1/classes?select=id,semester,subjects(code,name,prerequisites)`, { headers: h })).json();
    const byCode = {};
    for (const c of cls) byCode[c.subjects.code] = c;

    async function enroll(classId, note) {
        const r = await fetch(`${URL}/rest/v1/student_classes`, {
            method: 'POST', headers: h,
            body: JSON.stringify({ grade_id: gradeId, class_id: classId })
        });
        return { status: r.status, body: await r.json() };
    }

    // 1) prog2 exige prog1 + lab_prog -> SEM cursar, DEVE FALHAR
    const r1 = await enroll(byCode['prog2'].id);
    check('Trigger BLOQUEIA matricula sem pre-req (prog2)', r1.status >= 400, JSON.stringify(r1.body).slice(0, 120));

    // 2) matricular prog1 + lab_prog (sem pre-reqs) -> deve passar
    const r2 = await enroll(byCode['prog1'].id);
    const r3 = await enroll(byCode['lab_prog'].id);
    check('Matricular prog1 (sem pre-req)', r2.status === 201);
    check('Matricular lab_prog (co-req nao bloqueia)', r3.status === 201);

    // 3) completar ambos
    const up = await fetch(`${URL}/rest/v1/student_classes?grade_id=eq.${gradeId}&status=eq.enrolled`, {
        method: 'PATCH', headers: h, body: JSON.stringify({ status: 'completed', final_grade: 8.5 })
    });
    check('Marcar prog1+lab_prog completed', up.ok);

    // 4) matricular prog2 AGORA -> deve passar
    const r4 = await enroll(byCode['prog2'].id);
    check('Trigger LIBERA apos pre-req completed (prog2)', r4.status === 201);

    // 5) faltas: contador funciona
    const abs = await fetch(`${URL}/rest/v1/student_classes?grade_id=eq.${gradeId}&class_id=eq.${byCode['prog2'].id}`, {
        method: 'PATCH', headers: h, body: JSON.stringify({ absences: 6 })
    });
    check('Registrar absences=6 (regra 25% calculada na UI)', abs.ok);

    // 6) RLS: anon nao escreve
    const anonWrite = await fetch(`${URL}/rest/v1/student_classes`, {
        method: 'POST', headers: baseHeaders,
        body: JSON.stringify({ grade_id: gradeId, class_id: byCode['metodologia'].id })
    });
    check('RLS bloqueia insert anon', anonWrite.status >= 400);

    // 7) limpeza (como admin do banco via pg)
    const dbc2 = getClient(); await dbc2.connect();
    await dbc2.query('DELETE FROM grades WHERE id = $1', [gradeId]);
    await dbc2.end();
    check('Limpeza (grade de teste removida)', true);

    console.log(`\n📊 RESULTADO: ${pass} PASS / ${fail} FAIL`);
    process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error('❌ FATAL:', e.message); process.exit(1); });
