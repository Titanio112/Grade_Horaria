// seed_subjects.mjs - v3: hierarquia + subjects + professors + classes + class_schedules
// (professores normalizados "Weider/Marcelo" -> 2 linhas; horarios como linhas, sem JSONB)
// Uso: node seed_subjects.mjs  (idempotente)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { getClient } = require('./db.js');
const __dirnameLocal = path.dirname(fileURLToPath(import.meta.url));

const src = fs.readFileSync(path.join(__dirnameLocal, '..', 'dados.js'), 'utf8');
const match = src.match(/export const defaultSubjectsData = (\[[\s\S]*?\n\]);/);
if (!match) throw new Error('defaultSubjectsData nao encontrado em dados.js');
const defaultSubjectsData = eval(match[1]);

// day_of_week: 0=domingo, 1=segunda ... 6=sabado
const DAY_MAP = { Seg: 1, Ter: 2, Qua: 3, Qui: 4, Sex: 5, Sab: 6 };

function parseHorarios(horarios, sala) {
    const out = [];
    for (const h of horarios || []) {
        const m = h.match(/^(\w{3})\s+(\d{2}:\d{2})-(\d{2}:\d{2})/);
        if (!m || !(m[1] in DAY_MAP)) continue;
        out.push({ day: DAY_MAP[m[1]], start: m[2], end: m[3], room: sala || null });
    }
    return out;
}

function splitProfessores(str) {
    return (str || '').split('/').map(s => s.trim()).filter(Boolean);
}

async function seed() {
    const client = getClient();
    await client.connect();
    try {
        // 0) Hierarquia: CEFET-MG > Varginha > BSI
        await client.query(
            `INSERT INTO institutions (name, acronym, state) VALUES ($1,$2,$3) ON CONFLICT (acronym) DO NOTHING`,
            ['Centro Federal de Educacao Tecnologica de Minas Gerais', 'CEFET-MG', 'MG']);
        const inst = (await client.query(`SELECT id FROM institutions WHERE acronym='CEFET-MG'`)).rows[0].id;
        await client.query(
            `INSERT INTO campuses (institution_id, name, city) VALUES ($1,'Varginha','Varginha') ON CONFLICT (institution_id, name) DO NOTHING`,
            [inst]);
        const campus = (await client.query(`SELECT id FROM campuses WHERE institution_id=$1 AND name='Varginha'`, [inst])).rows[0].id;
        await client.query(
            `INSERT INTO courses (campus_id, name) VALUES ($1,'Sistemas de Informacao') ON CONFLICT (campus_id, name) DO NOTHING`,
            [campus]);
        const course = (await client.query(`SELECT id FROM courses WHERE campus_id=$1 AND name='Sistemas de Informacao'`, [campus])).rows[0].id;
        console.log('🏛️ Hierarquia ok: CEFET-MG > Varginha > Sistemas de Informacao');

        // 1) Flatten dados.js
        const all = [];
        defaultSubjectsData.forEach((sem, i) => {
            for (const d of sem.disciplinas) {
                all.push({
                    code: d.id, name: d.nome,
                    professors: splitProfessores(d.professor),
                    semester: i + 1,
                    scheduleRows: parseHorarios(d.horarios, d.sala),
                    requisitos: d.requisitos || [],
                    correquisitos: d.correquisitos || []
                });
            }
        });
        console.log(`📚 ${all.length} disciplinas extraidas do dados.js`);

        // 2) Subjects
        for (const s of all) {
            await client.query(
                `INSERT INTO subjects (code, course_id, name, workload_hours) VALUES ($1,$2,$3,60)
                 ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, course_id=EXCLUDED.course_id`,
                [s.code, course, s.name]);
        }
        const { rows: subjRows } = await client.query('SELECT id, code FROM subjects');
        const subjId = Object.fromEntries(subjRows.map(r => [r.code, r.id]));
        console.log('✅ Subjects ok');

        // 3) Professors normalizados
        const profNames = [...new Set(all.flatMap(s => s.professors))];
        for (const name of profNames) {
            await client.query(
                `INSERT INTO professors (name, campus_id) VALUES ($1,$2) ON CONFLICT (name, campus_id) DO NOTHING`,
                [name, campus]);
        }
        const { rows: profRows } = await client.query('SELECT id, name FROM professors WHERE campus_id=$1', [campus]);
        const profId = Object.fromEntries(profRows.map(r => [r.name, r.id]));
        console.log(`✅ Professores: ${profRows.length} (normalizados, sem "A/B")`);

        // 4) Classes + class_professors + class_schedules
        for (const s of all) {
            const clsRes = await client.query(
                `INSERT INTO classes (code, subject_id, semester) VALUES ($1,$2,$3)
                 ON CONFLICT (code) DO UPDATE SET subject_id=EXCLUDED.subject_id, semester=EXCLUDED.semester
                 RETURNING id`,
                [s.code + '-A', subjId[s.code], s.semester]);
            const classId = clsRes.rows[0].id;
            for (const pn of s.professors) {
                await client.query(
                    `INSERT INTO class_professors (class_id, professor_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
                    [classId, profId[pn]]);
            }
            await client.query('DELETE FROM class_schedules WHERE class_id=$1', [classId]);
            for (const r of s.scheduleRows) {
                await client.query(
                    `INSERT INTO class_schedules (class_id, day_of_week, start_time, end_time, room) VALUES ($1,$2,$3,$4,$5)`,
                    [classId, r.day, r.start, r.end, r.room]);
            }
        }
        const tot = await client.query(`SELECT (SELECT count(*) FROM classes) AS c,
            (SELECT count(*) FROM class_professors) AS cp, (SELECT count(*) FROM class_schedules) AS cs`);
        console.log(`✅ ${tot.rows[0].c} classes | ${tot.rows[0].cp} vinculos prof | ${tot.rows[0].cs} blocos de horario`);

        // 5) Pre/co-requisitos
        let reqCount = 0, coreqCount = 0;
        for (const s of all) {
            const pre = s.requisitos.map(c => subjId[c]).filter(Boolean);
            const co = s.correquisitos.map(c => subjId[c]).filter(Boolean);
            if (pre.length) reqCount++;
            if (co.length) coreqCount++;
            await client.query('UPDATE subjects SET prerequisites=$2, corequisites=$3 WHERE code=$1', [s.code, pre, co]);
        }
        console.log(`✅ Pre-requisitos: ${reqCount} | Co-requisitos: ${coreqCount}`);
    } catch (e) {
        console.error('❌ Erro:', e.message);
        process.exitCode = 1;
    } finally {
        await client.end();
    }
}
seed();