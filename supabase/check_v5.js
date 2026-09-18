// check_v5.js - verificacao pos-migracao v5
const { getClient } = require('./db');
(async () => {
    const c = getClient(); await c.connect();
    const t = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`);
    console.log('tabelas:', t.rows.map(r => r.table_name).join(', '));
    const cols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name IN ('grades','profiles') AND table_schema='public' ORDER BY table_name, column_name`);
    console.log('grades+profiles colunas:', cols.rows.map(r => r.column_name).join(', '));
    const f = await c.query(`SELECT routine_name FROM information_schema.routines WHERE routine_schema='public' ORDER BY 1`);
    console.log('funcoes:', f.rows.map(r => r.routine_name).join(', '));
    const codes = await c.query(`SELECT friend_code, color_preset FROM profiles LIMIT 3`);
    console.log('profiles amostra:', JSON.stringify(codes.rows));
    const grants = await c.query(`SELECT count(*) FROM admin_grants`);
    console.log('admin_grants:', grants.rows[0].count);
    await c.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
