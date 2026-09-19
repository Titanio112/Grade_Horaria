// check_admin_confirm.js - confirmacao do cadastro real do admin
const { getClient } = require('./db');
(async () => {
    const c = getClient(); await c.connect();
    const u = await c.query(`SELECT email, email_confirmed_at, last_sign_in_at FROM auth.users WHERE email='aphmgbr@gmail.com'`);
    const p = await c.query(`SELECT full_name, role, friend_code FROM profiles WHERE id=(SELECT id FROM auth.users WHERE email='aphmgbr@gmail.com')`);
    const g = await c.query(`SELECT level FROM admin_grants WHERE profile_id=(SELECT id FROM auth.users WHERE email='aphmgbr@gmail.com')`);
    console.log('user:', u.rows[0]);
    if (u.rows[0]) {
        console.log('email CONFIRMADO?', !!u.rows[0].email_confirmed_at);
    }
    console.log('profile:', p.rows[0]);
    console.log('grant:', g.rows[0]);
    await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
