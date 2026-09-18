// check_state.js - verifica contagens rapidas do banco
const { getClient } = require('./db');
(async () => {
    const c = getClient(); await c.connect();
    const r = await c.query(`SELECT
        (SELECT count(*) FROM subjects) s,
        (SELECT count(*) FROM professors) p,
        (SELECT count(*) FROM rooms) rm,
        (SELECT count(*) FROM classes) c,
        (SELECT count(*) FROM class_schedules) cs,
        (SELECT count(*) FROM schedule_rooms) sr,
        (SELECT count(*) FROM class_professors) cp`);
    console.log('state:', r.rows[0]);
    await c.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
