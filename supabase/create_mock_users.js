// create_mock_users.js - Cria 3 usuarios mock direto no banco (contorna rate limit de email)
// Receita completa incluindo auth.identities. Desfazivel com: node cleanup_mocks.js
const { getClient } = require('./db');

const STUDENTS = [
    { name: 'Ana Mock', email: 'gradehoraria+mock.ana@gmail.com' },
    { name: 'Bruno Mock', email: 'gradehoraria+mock.bruno@gmail.com' },
    { name: 'Carla Mock', email: 'gradehoraria+mock.carla@gmail.com' },
];
const PASS = 'Mock@123456';

(async () => {
    const c = getClient();
    await c.connect();
    try {
        for (const s of STUDENTS) {
            await c.query('BEGIN');
            try {
                const u = await c.query(`
                    INSERT INTO auth.users (
                        instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
                        recovery_token, recovery_sent_at, email_change_token_new, email_change,
                        phone_change, phone_change_token, email_change_token_current, reauthentication_token,
                        raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user,
                        is_anonymous, created_at, updated_at, last_sign_in_at
                    ) VALUES (
                        '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
                        $1::varchar, crypt($2::text, gen_salt('bf')),
                        NOW(), NULL, '', NULL,
                        '', NULL, '', '',
                        '', '', '', '',
                        '{"provider":"email","providers":["email"]}'::jsonb, $3::jsonb, FALSE, FALSE,
                        FALSE, NOW(), NOW(), NOW()
                    )
                    RETURNING id`, [s.email, PASS, JSON.stringify({ full_name: s.name })]);
                const uid = u.rows[0].id;

                await c.query(`
                    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
                    VALUES (gen_random_uuid(), $1::uuid, $2::text, $3::jsonb, 'email', NOW(), NOW(), NOW())
                    ON CONFLICT (provider_id, provider) DO NOTHING`,
                    [String(uid), String(uid), JSON.stringify({ sub: String(uid), email: s.email, email_verified: true, phone_verified: false })]);
                await c.query('COMMIT');
                console.log(`✅ ${s.name} criado (${uid.slice(0, 8)}...)`);
            } catch (e) {
                await c.query('ROLLBACK');
                console.log(`❌ ${s.name}:`, JSON.stringify({ message: e.message, detail: e.detail, hint: e.hint, code: e.code, where: e.where }, null, 1));
                process.exitCode = 1;
                break;
            }
        }
        // profiles (trigger pode ou nao ter rodado)
        await c.query(`INSERT INTO public.profiles (id, email, full_name, role)
            SELECT u.id, u.email, u.raw_user_meta_data->>'full_name', 'student'::user_role
            FROM auth.users u WHERE u.email LIKE 'gradehoraria+mock.%'
            AND NOT EXISTS (SELECT 1 FROM profiles p2 WHERE p2.id = u.id) ON CONFLICT (id) DO NOTHING`);
        const p = await c.query(`SELECT email, full_name FROM profiles WHERE email LIKE 'gradehoraria+mock.%'`);
        console.log('Profiles mock:', p.rows.map(r => r.full_name).join(', '));
    } finally {
        await c.end();
    }
})().catch(e => { console.error('❌', e.message); process.exit(1); });
