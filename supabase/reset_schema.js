// reset_schema.js - Reseta o banco e reaplica schema.sql (DESTRUIVO: apaga dados)
const fs = require('fs');
const path = require('path');
const { getClient } = require('./db');

async function reset() {
    const client = getClient();
    try {
        await client.connect();
        console.log('🧹 Limpando objetos antigos...');
        await client.query(`
            DROP TABLE IF EXISTS grade_subjects, student_classes, student_subjects, grades, class_schedules, class_professors, classes, professors, subjects, profiles, courses, campuses, institutions CASCADE;
            DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
            DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
            DROP FUNCTION IF EXISTS public.check_prerequisites CASCADE;
            DROP FUNCTION IF EXISTS public.check_time_conflict CASCADE;
            DROP FUNCTION IF EXISTS public.shares_class CASCADE;
            DROP FUNCTION IF EXISTS public.is_admin CASCADE;
            DROP TYPE IF EXISTS user_role CASCADE;
            DROP TYPE IF EXISTS day_of_week CASCADE;
        `);
        console.log('✅ Reset ok. Aplicando schema...');

        const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        await client.query(schema);
        console.log('✅ Schema aplicado!');

        const tables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`);
        console.log('📋 Tabelas:', tables.rows.map(t => t.table_name).join(', '));
        const funcs = await client.query(`SELECT routine_name FROM information_schema.routines WHERE routine_schema='public' ORDER BY 1`);
        console.log('⚙️ Funções:', funcs.rows.map(f => f.routine_name).join(', '));
        const policies = await client.query(`SELECT count(*) FROM pg_policies WHERE schemaname='public'`);
        console.log('🔒 Policies:', policies.rows[0].count);
        const subjects = await client.query(`SELECT code, name FROM subjects ORDER BY code`);
        console.log('📚 Matérias seed:', subjects.rows.map(s => s.code).join(', '));
    } catch (e) {
        console.error('❌ Erro:', e.message);
        if (e.position) {
            const pos = Number(e.position);
            const fs2 = require('fs');
            const sql = fs2.readFileSync(require('path').join(__dirname, 'schema.sql'), 'utf8');
            console.error('Contexto:', JSON.stringify(sql.slice(Math.max(0, pos - 120), pos + 60)));
        }
        process.exitCode = 1;
    } finally {
        await client.end();
    }
}
reset();
