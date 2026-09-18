// debug_groups.js
const { loadEnv } = require('./db');
const env = loadEnv();
(async () => {
    const h = { 'apikey': env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
    const login = await (await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: h, body: JSON.stringify({ email: 'gradehoraria+mock.ana@gmail.com', password: 'Mock@123456' }) })).json();
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/groups`, { method: 'POST', headers: { ...h, Authorization: `Bearer ${login.access_token}`, Prefer: 'return=representation' }, body: JSON.stringify({ name: 'Dbg', created_by: login.user.id }) });
    console.log(r.status, JSON.stringify(await r.json()).slice(0, 300));
})();
