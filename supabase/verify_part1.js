// verify_part1.js - Verificacao INDEPENDENTE do estado do banco (Parte 1 do briefing)
// + teste multi-instituicao real (2a instituicao ficticia, criada e removida)
const { loadEnv, getClient } = require('./db');

const env = loadEnv();
const URL = env.SUPABASE_URL, KEY = env.SUPABASE_ANON_KEY;
const h = { 'apikey': KEY, 'Content-Type': 'application/json' };

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { ok ? (pass++, console.log(`  ✅ ${n}`, d)) : (fail++, console.log(`  ❌ ${n}`, d)); };

(async () => {
    const c = getClient(); await c.connect();

    console.log('\n== 1) ESTADO VIVO DO SCHEMA ==');
    const t = await c.query(`SELECT count(*) FROM information_schema.tables WHERE table_schema='public'`);
    const p = await c.query(`SELECT count(*) FROM pg_policies WHERE schemaname='public'`);
    const f = await c.query(`SELECT count(*) FROM information_schema.routines WHERE routine_schema='public'`);
    const tr = await c.query(`SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgrelid::regclass::text NOT LIKE 'pg_%'`);
    const ix = await c.query(`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'idx_%' ORDER BY 1`);
    const rls = await c.query(`SELECT count(*) FROM pg_tables WHERE schemaname='public' AND rowsecurity`);
    console.log(`  tabelas=${t.rows[0].count} policies=${p.rows[0].count} funcoes=${f.rows[0].count} triggers=${tr.rows[0].count} tabelas c/ RLS=${rls.rows[0].count}`);
    console.log(`  indices de busca: ${ix.rows.map(r => r.indexname).join(', ')}`);
    check('RLS ativo em TODAS as tabelas publicas', Number(t.rows[0].count) === Number(rls.rows[0].count), `${rls.rows[0].count}/${t.rows[0].count}`);

    const data = await c.query(`SELECT
        (SELECT count(*) FROM institutions) i, (SELECT count(*) FROM campuses) cp,
        (SELECT count(*) FROM courses) co, (SELECT count(*) FROM subjects) s,
        (SELECT count(*) FROM professors) pr, (SELECT count(*) FROM rooms) rm,
        (SELECT count(*) FROM classes) cl, (SELECT count(*) FROM class_schedules) cs,
        (SELECT count(*) FROM schedule_rooms) sr, (SELECT count(*) FROM class_professors) cpp`);
    console.log('  dados:', JSON.stringify(data.rows[0]));

    console.log('\n== 2) MULTI-INSTITUICAO (teste real com 2a instituicao ficticia) ==');
    // criar instituicao ficticia completa
    const i2 = (await c.query(`INSERT INTO institutions (name, acronym, state) VALUES ('Universidade Ficticia QA','UFQA','SP') RETURNING id`)).rows[0].id;
    const cp2 = (await c.query(`INSERT INTO campuses (institution_id, name, city) VALUES ($1,'Campus QA','Sao Paulo') RETURNING id`, [i2])).rows[0].id;
    const co2 = (await c.query(`INSERT INTO courses (campus_id, name) VALUES ($1,'Curso QA') RETURNING id`, [cp2])).rows[0].id;
    const s2 = (await c.query(`INSERT INTO subjects (code, course_id, name) VALUES ('QA101',$1,'Materia QA') RETURNING id`, [co2])).rows[0].id;
    const pr2 = (await c.query(`INSERT INTO professors (name, campus_id) VALUES ('Prof QA',$1) RETURNING id`, [cp2])).rows[0].id;
    const rm2 = (await c.query(`INSERT INTO rooms (name, campus_id) VALUES ('Q101',$1) RETURNING id`, [cp2])).rows[0].id;
    const cl2 = (await c.query(`INSERT INTO classes (code, subject_id, semester) VALUES ('QA101-A',$1,1) RETURNING id`, [s2])).rows[0].id;
    await c.query(`INSERT INTO class_professors (class_id, professor_id) VALUES ($1,$2)`, [cl2, pr2]);
    const sch2 = (await c.query(`INSERT INTO class_schedules (class_id, day_of_week, start_time, end_time) VALUES ($1,1,'08:00','10:00') RETURNING id`, [cl2])).rows[0].id;
    await c.query(`INSERT INTO schedule_rooms (schedule_id, room_id) VALUES ($1,$2)`, [sch2, rm2]);
    check('2a instituicao criada sem conflito com a 1a', true);

    // leitura publica via API (anon) das DUAS instituicoes
    const r = await fetch(`${URL}/rest/v1/institutions?select=acronym&order=acronym`, { headers: h });
    const insts = await r.json();
    check('API anon ve ambas instituicoes', insts.length === 2, insts.map(x => x.acronym).join(' + '));
    const r2 = await fetch(`${URL}/rest/v1/subjects?select=code,course_id`, { headers: h });
    const subs = await r2.json();
    check('Catalogo misto: 65 BSI + 1 QA', subs.length === 66, `${subs.length} subjects`);

    // isolamento: sala S305 da UFQA nao colide com CEFET via UNIQUE(name,campus)
    await c.query(`INSERT INTO rooms (name, campus_id) VALUES ('S305',$1)`, [cp2]);
    const dup = await c.query(`SELECT count(*) FROM rooms WHERE name='S305'`);
    check('Sala S305 pode existir nos 2 campi (UNIQUE por campus)', dup.rows[0].count == 2, `${dup.rows[0].count} S305`);

    // cleanup da 2a instituicao (cascata manual)
    await c.query(`DELETE FROM schedule_rooms WHERE schedule_id=$1`, [sch2]);
    await c.query(`DELETE FROM institutions WHERE id=$1`, [i2]); // cascata campuses->courses; resto manual
    await c.query(`DELETE FROM class_professors WHERE class_id=$1`, [cl2]);
    await c.query(`DELETE FROM classes WHERE subject_id=$1`, [s2]);
    await c.query(`DELETE FROM subjects WHERE id=$1`, [s2]);
    await c.query(`DELETE FROM professors WHERE id=$1`, [pr2]);
    await c.query(`DELETE FROM rooms WHERE campus_id=$1`, [cp2]);
    const after = await c.query(`SELECT count(*) FROM institutions`);
    check('Limpeza da 2a instituicao ok', after.rows[0].count == 1);

    await c.end();
    console.log(`\n📊 VERIFICACAO PARTE 1: ${pass} PASS / ${fail} FAIL`);
    process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error('❌ FATAL:', e.message); process.exit(1); });
