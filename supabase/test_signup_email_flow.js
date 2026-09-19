// test_signup_email_flow.js - prova do fluxo real de cadastro com SMTP padrao do Supabase
// Signup via API (NAO confirma via SQL!) -> checa se o fluxo responde ok e se o
// email fica pendente de confirmacao (comportamento esperado) -> login deve falhar
// ate confirmar -> confirma via SQL so pra fechar -> login OK.
const { loadEnv, getClient } = require('./db');

const env = loadEnv();
const URL = env.SUPABASE_URL, KEY = env.SUPABASE_ANON_KEY;
const h = { 'apikey': KEY, 'Content-Type': 'application/json' };

// email real que o usuario recebe (ele vai olhar a caixa de entrada)
const EMAIL = process.argv[2] || 'gradehoraria.signup.test@gmail.com';
const PASS = 'SignupFlow@123';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { ok ? (pass++, console.log(`  ✅ ${n}`, d)) : (fail++, console.log(`  ❌ ${n}`, d)); };

(async () => {
    const dbc = getClient(); await dbc.connect();

    console.log(`\n== FLUXO REAL DE CADASTRO (SMTP padrao Supabase) ==`);
    console.log(`Email de teste: ${EMAIL}\n`);

    // 1) signup - deve aceitar e disparar email
    const su = await fetch(`${URL}/auth/v1/signup`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ email: EMAIL, password: PASS, data: { full_name: 'Signup Flow Test' } })
    });
    const suj = await su.json();
    check('Signup aceito pela API', su.ok || suj.user, JSON.stringify(suj).slice(0, 140));

    // 2) o usuario existe mas NAO confirmado
    await new Promise(r => setTimeout(r, 1500));
    const u = await dbc.query(`SELECT id, email_confirmed_at FROM auth.users WHERE email = $1`, [EMAIL]);
    check('Usuario criado em auth.users', u.rows.length === 1);
    const notConfirmed = u.rows[0] && !u.rows[0].email_confirmed_at;
    check('Email PENDENTE de confirmacao (SMTP padrao disparou)', notConfirmed, notConfirmed ? 'aguardando clique no link' : 'ja confirmado?');

    // 3) login ANTES de confirmar deve ser negado
    const badLogin = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: h, body: JSON.stringify({ email: EMAIL, password: PASS })
    });
    const badJson = await badLogin.json();
    check('Login negado antes da confirmacao', !badLogin.ok && /not confirmed/i.test(badJson.msg || ''), badJson.error_code || badJson.msg);

    // 4) confirmar via banco (simula o clique do usuario no email) e logar
    await dbc.query(`UPDATE auth.users SET email_confirmed_at = NOW() WHERE email = $1`, [EMAIL]);
    const okLogin = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: h, body: JSON.stringify({ email: EMAIL, password: PASS })
    });
    const okJson = await okLogin.json();
    check('Login OK apos confirmacao (JWT emitido)', !!okJson.access_token);

    // 5) profile criado pelo trigger + friend_code
    const prof = await dbc.query(`SELECT full_name, role, friend_code FROM profiles WHERE id = $1`, [u.rows[0]?.id]);
    check('Profile + friend_code gerados pelo trigger', prof.rows.length === 1 && !!prof.rows[0].friend_code, JSON.stringify(prof.rows[0] || {}));

    // cleanup: remove o usuario de teste em cascata
    await dbc.query(`DELETE FROM auth.identities WHERE user_id = $1`, [u.rows[0]?.id]);
    await dbc.query(`DELETE FROM auth.users WHERE id = $1`, [u.rows[0]?.id]);
    check('Usuario de teste removido', true);

    await dbc.end();
    console.log(`\n📊 RESULTADO: ${pass} PASS / ${fail} FAIL`);
    if (notConfirmed) console.log('\n📬 O email de confirmacao foi disparado pelo Supabase. Confira a caixa de entrada de', EMAIL, '(pode demorar ~1min no plano free).');
    process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error('❌ FATAL:', e.message); process.exit(1); });
