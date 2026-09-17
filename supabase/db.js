// db.js - Helper compartilhado: conexao Postgres lendo ../.env
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env');
    const env = {};
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
        if (m) env[m[1]] = m[2];
    }
    return env;
}

function getClient() {
    const env = loadEnv();
    if (!env.SUPABASE_DB_URL) throw new Error('SUPABASE_DB_URL nao definida no .env');
    return new Client({ connectionString: env.SUPABASE_DB_URL });
}

module.exports = { loadEnv, getClient };
