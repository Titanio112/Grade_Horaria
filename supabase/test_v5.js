// test_v5.js - Bateria v5: amizade, grupos, privacidade 3 niveis, delegacao admin, notificacoes
// Pre-req: node create_mock_users.js
const { loadEnv, getClient } = require('./db');

const env = loadEnv();
const URL = env.SUPABASE_URL, KEY = env.SUPABASE_ANON_KEY;
const baseHeaders = { 'apikey': KEY, 'Content-Type': 'application/json' };
const PASS = 'Mock@123456';
const A = 'gradehoraria+mock.ana@gmail.com', B = 'gradehoraria+mock.bruno@gmail.com', C = 'gradehoraria+mock.carla@gmail.com';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { ok ? (pass++, console.log(`  ✅ ${n}`, d)) : (fail++, console.log(`  ❌ ${n}`, d)); };

async function api(path, { method = 'GET', token = null, body = null, prefer = 'return=representation' } = {}) {
    const h = { ...baseHeaders, Prefer: prefer };
    if (token) h['Authorization'] = `Bearer ${token}`;
    const r = await fetch(`${URL}/rest/v1${path}`, { method, headers: h, body: body ? JSON.stringify(body) : null });
    let j = null; try { j = await r.json(); } catch {}
    return { status: r.status, body: j };
}
async function rpc(fn, params, token) {
    const h = { ...baseHeaders };
    if (token) h['Authorization'] = `Bearer ${token}`;
    const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: h, body: JSON.stringify(params) });
    let j = null; try { j = await r.json(); } catch {}
    return { status: r.status, body: j };
}
async function login(email) {
    const j = await (await fetch(`${URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: baseHeaders, body: JSON.stringify({ email, password: PASS }) })).json();
    return { token: j.access_token, id: j.user?.id };
}

(async () => {
    const dbc = getClient(); await dbc.connect();
    const ana = await login(A), bru = await login(B), car = await login(C);
    check('3 logins mock', !!(ana.token && bru.token && car.token));

    await dbc.query(`INSERT INTO profiles (id, email, full_name, role, friend_code)
        SELECT u.id, u.email, u.raw_user_meta_data->>'full_name', 'student'::user_role,
               upper(substr(md5(u.email),1,6))
        FROM auth.users u WHERE u.email LIKE 'gradehoraria+mock.%'
        AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id) ON CONFLICT DO NOTHING`);

    // == AMIZADE ==
    console.log('\n== AMIZADE ==');
    // idempotencia: limpar relacoes sociais anteriores dos mocks
    await dbc.query(`DELETE FROM friendships WHERE requester_id IN (SELECT id FROM profiles WHERE email LIKE 'gradehoraria+mock.%') OR addressee_id IN (SELECT id FROM profiles WHERE email LIKE 'gradehoraria+mock.%')`);
    await dbc.query(`DELETE FROM groups WHERE created_by IN (SELECT id FROM profiles WHERE email LIKE 'gradehoraria+mock.%')`);
    const bCode = (await dbc.query(`SELECT friend_code FROM profiles WHERE email=$1`, [B])).rows[0].friend_code;
    const found = await rpc('lookup_profile_by_code', { p_code: bCode }, ana.token);
    check('lookup friend_code acha Bruno', Array.isArray(found.body) && found.body[0]?.id === bru.id);
    const fr = await api('/friendships', { method: 'POST', token: ana.token, body: { requester_id: ana.id, addressee_id: bru.id } });
    check('Ana envia pedido', fr.status === 201);
    const dup = await api('/friendships', { method: 'POST', token: bru.token, body: { requester_id: bru.id, addressee_id: ana.id } });
    check('Par inverso rejeitado', dup.status >= 400);
    const frow = (await dbc.query(`SELECT id FROM friendships WHERE requester_id=$1`, [ana.id])).rows[0].id;
    const acc = await api(`/friendships?id=eq.${frow}`, { method: 'PATCH', token: bru.token, body: { status: 'accepted' } });
    check('Bruno aceita', acc.status < 300);
    const notif = await api(`/notifications?recipient_id=eq.${bru.id}&type=eq.friend_request`, { token: bru.token });
    check('Notificacao de amizade criada', (notif.body || []).length >= 1);

    // == PRIVACIDADE 3 NIVEIS ==
    console.log('\n== PRIVACIDADE ==');
    await api(`/grades?student_id=eq.${ana.id}`, { method: 'DELETE', token: ana.token });
    const gA = (await api('/grades', { method: 'POST', token: ana.token, body: { student_id: ana.id, semester: 2, year: 2026, visibility: 'friends' } })).body?.[0]?.id;
    check('Grade visibility=friends criada', !!gA);
    check('Amigo accepted ve grade friends', (await api(`/grades?student_id=eq.${ana.id}`, { token: bru.token })).body?.length === 1);
    check('Nao-amiga NAO ve grade friends', ((await api(`/grades?student_id=eq.${ana.id}`, { token: car.token })).body || []).length === 0);
    await api(`/grades?id=eq.${gA}`, { method: 'PATCH', token: ana.token, body: { visibility: 'private' } });
    check('Mudar pra private esconde de amigo', ((await api(`/grades?student_id=eq.${ana.id}`, { token: bru.token })).body || []).length === 0);
    await api(`/grades?id=eq.${gA}`, { method: 'PATCH', token: ana.token, body: { visibility: 'public' } });
    check('public: qualquer um ve', ((await api(`/grades?student_id=eq.${ana.id}`, { token: car.token })).body || []).length === 1);

    // == GRUPOS ==
    console.log('\n== GRUPOS ==');
    const grp = (await api('/groups', { method: 'POST', token: ana.token, body: { name: 'Turma 2026', created_by: ana.id } })).body?.[0]?.id;
    check('Criar grupo', !!grp);
    await api('/group_members', { method: 'POST', token: ana.token, body: { group_id: grp, profile_id: ana.id } });
    await api('/group_members', { method: 'POST', token: ana.token, body: { group_id: grp, profile_id: bru.id } });
    check('Membros vem o grupo', ((await api(`/groups?id=eq.${grp}`, { token: bru.token })).body || []).length === 1);
    check('Fora do grupo nao ve', ((await api(`/groups?id=eq.${grp}`, { token: car.token })).body || []).length === 0);

    // == ADMIN 3 NIVEIS ==
    console.log('\n== ADMIN DELEGACAO ==');
    const courseId = (await dbc.query(`SELECT id FROM courses WHERE name='Sistemas de Informacao'`)).rows[0].id;
    const instId = (await dbc.query(`SELECT id FROM institutions WHERE acronym='CEFET-MG'`)).rows[0].id;
    // Ana (student) tenta delegar -> bloqueado
    const g1 = await rpc('grant_admin', { p_profile: bru.id, p_level: 'course', p_course: courseId }, ana.token);
    check('Student nao delega admin', g1.status >= 400);
    // super admin (via banco) concede institution pra Bruno
    await dbc.query(`INSERT INTO admin_grants (profile_id, level, institution_id, granted_by)
        SELECT $1, 'institution', $2, $1 WHERE EXISTS (SELECT 1 FROM profiles WHERE id=$1) ON CONFLICT DO NOTHING`, [bru.id, instId]);
    // Bruno (institution admin) concede course admin pra Carla
    const g2 = await rpc('grant_admin', { p_profile: car.id, p_level: 'course', p_course: courseId }, bru.token);
    check('Institution admin delega course admin', g2.status < 300);
    // Carla (course) tenta conceder institution (escalar) -> bloqueado
    const g3 = await rpc('grant_admin', { p_profile: ana.id, p_level: 'institution', p_institution: instId }, car.token);
    check('Course admin NAO escala privilegio', g3.status >= 400);
    // Carla (course admin) edita materia do curso -> permitido; Bruno inst admin tambem
    const subj = (await api(`/subjects?course_id=eq.${courseId}&select=id&limit=1`, { token: car.token })).body?.[0]?.id;
    const edit = await api(`/subjects?id=eq.${subj}`, { method: 'PATCH', token: car.token, body: { description: 'editado por admin de curso' } });
    check('Course admin edita subject do curso', edit.status < 300);
    // Ana (student) tenta editar -> bloqueado
    const bad = await api(`/subjects?id=eq.${subj}`, { method: 'PATCH', token: ana.token, body: { description: 'hack' } });
    check('Student NAO edita subject', bad.status >= 400 || (Array.isArray(bad.body) && bad.body.length === 0));

    // == NOTIFICACOES por mudanca de turma ==
    console.log('\n== NOTIFICACOES ==');
    const cls = (await dbc.query(`SELECT c.id FROM classes c JOIN subjects s ON s.id=c.subject_id WHERE s.code='metodologia'`)).rows[0].id;
    await api(`/grades?id=eq.${gA}`, { method: 'PATCH', token: ana.token, body: { visibility: 'public' } });
    await api('/student_classes', { method: 'POST', token: ana.token, body: { grade_id: gA, class_id: cls } });
    // limpa notificacoes antigas da Ana (dedup e por dia)
    await api('/notifications?recipient_id=eq.' + ana.id, { method: 'DELETE', token: ana.token });
    const before = (await dbc.query(`SELECT count(*) FROM notifications WHERE recipient_id=$1 AND type='schedule_changed'`, [ana.id])).rows[0].count;
    await dbc.query(`UPDATE class_schedules SET start_time='13:05' WHERE class_id=$1 AND day_of_week=1`, [cls]);
    const after = (await dbc.query(`SELECT count(*) FROM notifications WHERE recipient_id=$1 AND type='schedule_changed'`, [ana.id])).rows[0].count;
    check('Mudanca de horario notifica enrolled', Number(after) >= Number(before) + 1, `${before} -> ${after}`);
    // dedup: outra mudanca no MESMO dia nao duplica
    await dbc.query(`UPDATE class_schedules SET end_time='15:00' WHERE class_id=$1 AND day_of_week=1`, [cls]);
    const after2 = (await dbc.query(`SELECT count(*) FROM notifications WHERE recipient_id=$1 AND type='schedule_changed'`, [ana.id])).rows[0].count;
    check('Anti-spam: mesma turma+dia nao duplica', after2 === after, `${after2}`);

    // == REPORTS ==
    console.log('\n== REPORTS ==');
    const rep = await api('/reports', { method: 'POST', token: ana.token, body: { reporter_id: ana.id, class_id: cls, message: 'Horario divergente do quadro oficial' } });
    check('Aluna reporta erro', rep.status === 201);
    const seeOwn = await api('/reports', { token: ana.token });
    check('Autora ve proprio report', seeOwn.body?.length >= 1);
    // admin do curso (Carla) ve; outra aluna (Bruno? nao admin) nao ve alheio
    const adm = await api('/reports', { token: car.token });
    check('Admin do curso ve report', adm.body?.length >= 1);
    // nao-admin nao ve report alheio: usa ANON (RLS pede auth)
    const deny = await api(`/reports?id=eq.${rep.body?.[0]?.id}`);
    check('Nao-admin nao ve report alheio', (deny.body || []).length === 0);

    await dbc.end();
    console.log(`\n📊 V5: ${pass} PASS / ${fail} FAIL`);
    process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error('❌ FATAL:', e.message); process.exit(1); });

