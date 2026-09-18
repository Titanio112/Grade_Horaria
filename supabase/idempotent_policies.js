// idempotent_policies.js - adiciona DROP POLICY IF EXISTS antes de cada CREATE POLICY no v5.sql
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'migrations', 'v5.sql');
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/^CREATE POLICY "([^"]+)" ON (\w+)/gm, (m, name, table) => `DROP POLICY IF EXISTS "${name}" ON ${table};\nCREATE POLICY "${name}" ON ${table}`);
fs.writeFileSync(p, s);
console.log('policies preparadas para idempotencia:', (s.match(/CREATE POLICY/g) || []).length);
