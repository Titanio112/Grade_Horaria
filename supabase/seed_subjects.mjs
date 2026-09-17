// seed_subjects.mjs - Popula hierarquia + subjects + classes com os dados reais do dados.js
// Uso: node seed_subjects.mjs  (idempotente)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { getClient } = require('./db.js');
const __dirnameLocal = path.dirname(fileURLToPath(import.meta.url));

// dados.js eh ES Module puro; extrair apenas o array defaultSubjectsData
const src = fs.readFileSync(path.join(__dirnameLocal, '..', 'dados.js'), 'utf8');
const match = src.match(/export const defaultSubjectsData = (\[[\s\S]*?\n\]);/);
if (!match) throw new Error('defaultSubjectsData nao encontrado em dados.js');
const defaultSubjectsData = eval(match[1]);

const DAY_MAP = { Seg: 'monday', Ter: 'tuesday', Qua: 'wednesday', Qui: 'thursday', Sex: 'friday', Sab: 'saturday' };

function parseHorarios(horarios, sala) {
    const schedule = {};
    for (const h of horarios || []) {
        const m = h.match(/^(\w{3})\s+(\d{2}:\d{2})-(\d{2}:\d{2})/);
        if (!m) continue;
        const day = DAY_MAP[m[1]];
        if (!day) continue;
        (schedule[day] ||= []).push({ start: m[2], end: m[3], room: sala || null });
    }
    return schedule;
}

async function seed() {
    const client = getClient();
    await client.connect();
    try {
        // 0) Hierarquia: CEFET-MG > Varginha > Sistemas de Informacao
        await client.query(
            `INSERT INTO institutions (name, acronym, state) VALUES ($1,$2,$3)
             ON CONFLICT (acronym) DO NOTHING`,
            ['Centro Federal de Educacao Tecnologica de Minas Gerais', 'CEFET-MG', 'MG']);
        const inst = (await client.query(`SELECT id FROM institutions WHERE acronym='CEFET-MG'`)).rows[0].id;

        await client.query(
            `INSERT INTO campuses (institution_id, name, city) VALUES ($1,$2,$3)
             ON CONFLICT (institution_id, name) DO NOTHING`,
            [inst, 'Varginha', 'Varginha']);
        const campus = (await client.query(`SELECT id FROM campuses WHERE institution_id=$1 AND name='Varginha'`, [inst])).rows[0].id;

        await client.query(
            `INSERT INTO courses (campus_id, name) VALUES ($1,$2)
             ON CONFLICT (campus_id, name) DO NOTHING`,
            [campus, 'Sistemas de Informacao']);
        const course = (await client.query(`SELECT id FROM courses WHERE campus_id=$1 AND name='Sistemas de Informacao'`, [campus])).rows[0].id;
        console.log('🏛️ Hierarquia ok: CEFET-MG > Varginha > Sistemas de Informacao');

        // 1) Flatten dados.js
        const all = [];
        defaultSubjectsData.forEach((sem, i) => {
            for (const d of sem.disciplinas) {
                all.push({
                    code: d.id,
                    name: d.nome,
                    professor: d.professor || null,
                    semester: i + 1,
                    schedule: parseHorarios(d.horarios, d.sala),
                    requisitos: d.requisitos || [],
                    correquisitos: d.correquisitos || []
                });
            }
        });
        console.log(`📚 ${all.length} disciplinas extraidas do dados.js`);

        // 2) Subjects (catalogo base)
        for (const s of all) {
            await client.query(
                `INSERT INTO subjects (code, course_id, name, workload_hours)
                 VALUES ($1,$2,$3,60)
                 ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, course_id=EXCLUDED.course_id`,
                [s.code, course, s.name]
            );
        }
        console.log('✅ Subjects inseridas/atualizadas');

        // 3) Classes (turma com professor + horarios)
        const { rows: subjRows } = await client.query('SELECT id, code FROM subjects');
        const uuidByCode = Object.fromEntries(subjRows.map(r => [r.code, r.id]));
        for (const s of all) {
            await client.query(
                `INSERT INTO classes (subject_id, professor_name, semester, schedule)
                 VALUES ($1,$2,$3,$4)
                 ON CONFLICT (subject_id, professor_name, semester) DO UPDATE SET schedule=EXCLUDED.schedule`,
                [uuidByCode[s.code], s.professor, s.semester, JSON.stringify(s.schedule)]
            );
        }
        console.log('✅ Classes inseridas/atualizadas');

        // 4) Pre/co-requisitos (string id -> uuid)
        let reqCount = 0, coreqCount = 0;
        for (const s of all) {
            const pre = s.requisitos.map(c => uuidByCode[c]).filter(Boolean);
            const co = s.correquisitos.map(c => uuidByCode[c]).filter(Boolean);
            if (pre.length) reqCount++;
            if (co.length) coreqCount++;
            await client.query(
                'UPDATE subjects SET prerequisites=$2, corequisites=$3 WHERE code=$1',
                [s.code, pre, co]
            );
        }
        console.log(`✅ Pre-requisitos: ${reqCount} materias | Co-requisitos: ${coreqCount} materias`);

        const t = await client.query('SELECT (SELECT count(*) FROM subjects) AS subjects, (SELECT count(*) FROM classes) AS classes');
        console.log(`📊 Banco: ${t.rows[0].subjects} subjects, ${t.rows[0].classes} classes`);
    } catch (e) {
        console.error('❌ Erro:', e.message);
        process.exitCode = 1;
    } finally {
        await client.end();
    }
}
seed();

