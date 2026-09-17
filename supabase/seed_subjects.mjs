// seed_subjects.mjs - Popula subjects com os dados reais do dados.js
// Uso: node seed_subjects.mjs
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
        console.log(`📚 ${all.length} disciplinas extraídas do dados.js`);

        // 2) Insert (upsert por code)
        for (const s of all) {
            await client.query(
                `INSERT INTO subjects (code, name, professor, semester, schedule, description, credits, workload)
                 VALUES ($1,$2,$3,$4,$5,$6,4,60)
                 ON CONFLICT (code) DO UPDATE SET
                    name=EXCLUDED.name, professor=EXCLUDED.professor, semester=EXCLUDED.semester,
                    schedule=EXCLUDED.schedule, description=EXCLUDED.description`,
                [s.code, s.name, s.professor, s.semester, JSON.stringify(s.schedule), null]
            );
        }
        console.log('✅ Matérias inseridas/atualizadas');

        // 3) Resolver pre/co-requisitos (string id -> uuid)
        const { rows } = await client.query('SELECT id, code FROM subjects');
        const uuidByCode = Object.fromEntries(rows.map(r => [r.code, r.id]));
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
        console.log(`✅ Pré-requisitos: ${reqCount} matérias | Co-requisitos: ${coreqCount} matérias`);

        const total = await client.query('SELECT count(*) FROM subjects');
        console.log(`📊 Total no banco: ${total.rows[0].count} matérias`);
    } catch (e) {
        console.error('❌ Erro:', e.message);
        process.exitCode = 1;
    } finally {
        await client.end();
    }
}
seed();
