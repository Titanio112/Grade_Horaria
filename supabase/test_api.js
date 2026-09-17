// test_api.js - Teste end-to-end da API Supabase (signup, trigger de perfil, login, RLS)
const { loadEnv, getClient } = require('./db');

const env = loadEnv();
const URL = env.SUPABASE_URL;
const KEY = env.SUPABASE_ANON_KEY;
if (!KEY) { console.error('❌ SUPABASE_ANON_KEY vazia no .env'); process.exit(1); }

const headers = { 'apikey': KEY, 'Content-Type': 'application/json' };
const testEmail = `gradehoraria.teste+1789613619334@gmail.com`;
const testPass = 'Teste@123456';

async function step(name, fn) {
    try {
        const out = await fn();
        console.log(`✅ ${name}`, out || '');
        return out;
    } catch (e) {
        console.error(`❌ ${name}: ${e.message}`);
        process.exitCode = 1;
        return null;
    }
}

(async () => {
    // 1) Signup (tolerante: usuario ja existe ou rate limit de email)
    await step('Signup', async () => {
        const r = await fetch(`${URL}/auth/v1/signup`, {
            method: 'POST', headers,
            body: JSON.stringify({ email: testEmail, password: testPass, data: { full_name: 'Usuario Teste' } })
        });
        const j = await r.json();
        if (!r.ok) {
            if (j.error_code === 'over_email_send_rate_limit' || r.status === 429) return 'rate limit (ok: usuario ja existe)';
            throw new Error(JSON.stringify(j));
        }
        return `user=${j.user?.id?.slice(0, 8)}...`;
    });

    // 1.5) Confirmar email via banco (sempre; teste nao acessa caixa de email)
    await step('Confirmar email (via DB)', async () => {
        const c = getClient();
        await c.connect();
        const r = await c.query('UPDATE auth.users SET email_confirmed_at = NOW() WHERE email = $1', [testEmail]);
        await c.end();
        if (r.rowCount === 0) throw new Error('usuario nao encontrado em auth.users');
    });

    // 2) Login (pegar access token)
    const token = await step('Login', async () => {
        const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
            method: 'POST', headers,
            body: JSON.stringify({ email: testEmail, password: testPass })
        });
        const j = await r.json();
        if (!r.ok) throw new Error(JSON.stringify(j));
        return j.access_token;
    });

    // 3) Perfil criado pelo trigger handle_new_user?
    if (token) await step('Trigger handle_new_user -> profile', async () => {
        const r = await fetch(`${URL}/rest/v1/profiles?select=email,full_name,role`, {
            headers: { ...headers, 'Authorization': `Bearer ${token}` }
        });
        const j = await r.json();
        const me = Array.isArray(j) ? j.find(p => p.email === testEmail) : null;
        if (!me) throw new Error('perfil nao encontrado: ' + JSON.stringify(j).slice(0, 200));
        return `role=${me.role} nome="${me.full_name}"`;
    });

    // 4) SELECT subjects com anon key (policy "Materias publicas")
    await step('SELECT subjects (anon, RLS)', async () => {
        const r = await fetch(`${URL}/rest/v1/subjects?select=code&is_active=eq.true`, { headers });
        const j = await r.json();
        if (!Array.isArray(j)) throw new Error(JSON.stringify(j).slice(0, 200));
        if (j.length === 0) throw new Error('0 materias visiveis');
        return `${j.length} materias visiveis`;
    });

    // 5) INSERT em grades sem auth deve FALHAR (RLS)
    await step('RLS bloqueia anon em grades', async () => {
        const r = await fetch(`${URL}/rest/v1/grades`, {
            method: 'POST', headers,
            body: JSON.stringify({ student_id: crypto.randomUUID(), semester: 1, year: 2026 })
        });
        if (r.ok) throw new Error('anon conseguiu inserir grade - RLS FALHOU');
        return `bloqueado (${r.status})`;
    });
})();
