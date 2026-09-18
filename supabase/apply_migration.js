// apply_migration.js - aplica um arquivo SQL de migracao
// Uso: node apply_migration.js migrations/v5.sql
const fs = require('fs');
const path = require('path');
const { getClient } = require('./db');

(async () => {
    const file = process.argv[2];
    if (!file) { console.error('Uso: node apply_migration.js <arquivo.sql>'); process.exit(1); }
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const c = getClient();
    await c.connect();
    try {
        await c.query(sql);
        console.log(`✅ Migracao aplicada: ${file}`);
    } catch (e) {
        console.error('❌ Falhou:', e.message);
        if (e.position) {
            const pos = Number(e.position);
            console.error('Contexto:', JSON.stringify(sql.slice(Math.max(0, pos - 150), pos + 80)));
        }
        process.exitCode = 1;
    } finally { await c.end(); }
})();
