/* ============================================================
   catalog.service.js — Catálogo do curso (subjects → classes)
   O que faz: carrega as matérias ativas do curso do aluno com
   turmas ativas, horários (class_schedules) e professores, já
   normalizado para o front (minutos desde meia-noite etc.).
   Também expõe listCompletedSubjectIds (matérias já concluídas
   pelo aluno, para o cálculo local de pré-requisito).
   O que NÃO faz: não toca no DOM, não conhece sessão/auth (o
   courseId/studentId chegam prontos), não monta grade (isso é
   grades.service.js).
   Depende de: js/core/supabase-client.js.
   ============================================================ */

import { supabase } from '../core/supabase-client.js';

/** Converte "HH:MM:SS"/"HH:MM" em minutos desde meia-noite. */
function toMinutes(timeStr) {
  const [h, m] = String(timeStr).split(':');
  return Number(h) * 60 + Number(m || 0);
}

/**
 * Carrega o catálogo completo do curso.
 * @param {string} courseId - id do curso (profiles.course_id).
 * @returns {Promise<{data: {subjects: Array, byId: Map}|null, error: object|null}>}
 *   subjects: [{ id, code, name, workloadHours, prerequisites, corequisites,
 *                classes: [{ id, code, semester, socialGroupLink,
 *                            schedules: [{ day, startMin, endMin }],
 *                            professors: [nome] }] }]
 *   byId: Map subjectId → subject (para resolver nomes de pré-requisitos).
 */
export async function listCatalog(courseId) {
  const { data, error } = await supabase
    .from('subjects')
    .select(`id, code, name, workload_hours, prerequisites, corequisites,
             classes!inner(id, code, semester, social_group_link,
               class_schedules(id, day_of_week, start_time, end_time),
               class_professors(professors(name)))`)
    .eq('course_id', courseId)
    .eq('is_active', true)
    .eq('classes.is_active', true)
    .order('name');

  if (error) return { data: null, error };

  const subjects = (data || []).map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    workloadHours: s.workload_hours,
    prerequisites: s.prerequisites || [],
    corequisites: s.corequisites || [],
    classes: (s.classes || []).map((c) => ({
      id: c.id,
      code: c.code,
      semester: c.semester,
      socialGroupLink: c.social_group_link,
      schedules: (c.class_schedules || [])
        .map((sc) => ({
          day: sc.day_of_week,
          startMin: toMinutes(sc.start_time),
          endMin: toMinutes(sc.end_time),
        }))
        .sort((a, b) => a.day - b.day || a.startMin - b.startMin),
      professors: (c.class_professors || [])
        .map((cp) => cp.professors?.name)
        .filter(Boolean),
    })),
  }));

  const byId = new Map(subjects.map((s) => [s.id, s]));
  return { data: { subjects, byId }, error: null };
}

/**
 * Lista os ids de matérias JÁ CONCLUÍDAS pelo aluno
 * (student_classes com status 'completed', em qualquer grade dele).
 * Serve para o cálculo local de pré-requisitos.
 * @param {string} studentId - id do profile do aluno.
 * @returns {Promise<{data: Set<string>|null, error: object|null}>}
 */
export async function listCompletedSubjectIds(studentId) {
  const { data, error } = await supabase
    .from('student_classes')
    .select('grades!inner(student_id), classes!inner(subject_id)')
    .eq('grades.student_id', studentId)
    .eq('status', 'completed');

  if (error) return { data: null, error };

  const ids = new Set((data || []).map((row) => row.classes.subject_id));
  return { data: ids, error: null };
}
