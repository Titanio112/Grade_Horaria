// fix_users.js - Cria profiles retroativos para usuarios sem profile (bug antigo do trigger)
const { getClient } = require('./db');

(async () => {
    const c = getClient();
    await c.connect();
    const r = await c.query(`
        INSERT INTO public.profiles (id, email, full_name, role)
        SELECT u.id, u.email, u.raw_user_meta_data->>'full_name',
               CASE WHEN u.email = 'aphmgbr@gmail.com' THEN 'admin'::user_role ELSE 'student'::user_role END
        FROM auth.users u
        WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id)
        ON CONFLICT (id) DO NOTHING
        RETURNING email, role
    `);
    console.log('✅ Profiles criados retroativamente:', r.rows);
    await c.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
