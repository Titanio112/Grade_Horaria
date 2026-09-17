// describe_schema.js - Extrai estrutura real do banco para documentacao
const { getClient } = require('./db');

(async () => {
    const c = getClient();
    await c.connect();

    const cols = await c.query(`
        SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position`);
    console.log('=== COLUNAS ===');
    console.log(JSON.stringify(cols.rows));

    const cons = await c.query(`
        SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
               kcu.column_name,
               ccu.table_name AS ref_table, ccu.column_name AS ref_column
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        LEFT JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
        WHERE tc.table_schema = 'public'
        ORDER BY tc.table_name, tc.constraint_type`);
    console.log('=== CONSTRAINTS ===');
    console.log(JSON.stringify(cons.rows));

    const counts = await c.query(`
        SELECT (SELECT count(*) FROM subjects) AS subjects,
               (SELECT count(*) FROM subjects WHERE prerequisites <> '{}') AS com_pre_req,
               (SELECT count(*) FROM subjects WHERE corequisites <> '{}') AS com_co_req`);
    console.log('=== COUNTS ===');
    console.log(JSON.stringify(counts.rows));

    await c.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
