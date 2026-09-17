// cleanup_mocks.js - Remove TODOS os dados ficticios (emails gradehoraria+mock.*)
// Uso: node cleanup_mocks.js
const { getClient } = require('./db');

(async () => {
    const c = getClient();
    await c.connect();
    try {
        // Cascade: auth.users -> profiles -> grades -> student_classes/grade_subjects
        const users = await c.query(`SELECT id, email FROM auth.users WHERE email LIKE 'gradehoraria+mock.%'`);
        if (!users.rows.length) { console.log('Nada a limpar.'); return; }

        await c.query(`DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE 'gradehoraria+mock.%')`);
        const del = await c.query(`DELETE FROM auth.users WHERE email LIKE 'gradehoraria+mock.%' RETURNING email`);
        console.log(`🧹 ${del.rowCount} usuarios mock removidos (profiles/grades/matriculas em cascata):`, del.rows.map(r => r.email));

        const rest = await c.query(`SELECT count(*) FROM profiles WHERE email LIKE 'gradehoraria+mock.%'`);
        console.log('Profiles mock restantes (esperado 0):', rest.rows[0].count);
    } finally {
        await c.end();
    }
})().catch(e => { console.error('❌', e.message); process.exit(1); });
