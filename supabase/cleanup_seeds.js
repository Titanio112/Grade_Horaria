// cleanup_seeds.js - Remove as 4 materias genericas CCO* do seed antigo
const { getClient } = require('./db');

(async () => {
    const c = getClient();
    await c.connect();
    const r = await c.query(`DELETE FROM subjects WHERE code LIKE 'CCO%'`);
    console.log('🗑️ Seeds genéricas removidas:', r.rowCount);
    const t = await c.query('SELECT count(*) FROM subjects');
    console.log('📊 Total de matérias reais:', t.rows[0].count);
    await c.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
