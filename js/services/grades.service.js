/* ============================================================
   grades.service.js — Grade do aluno (grades + student_classes)
   O que faz: garante que existe UMA grade ativa por semestre/ano,
   lista as turmas matriculadas nela, adiciona/remove turmas e
   atualiza a visibilidade (private/friends/public).
   Travas de pré-requisito e choque de horário são impostas pelos
   triggers do banco (trg_check_prerequisites / trg_check_time_conflict)
   — aqui só traduzimos o erro para pt-BR quando isso acontece.
   O que NÃO faz: não toca no DOM, não lê sessão, não carrega o
   catálogo (isso é catalog.service.js).
   Depende de: js/core/supabase-client.js.
   ============================================================ */

import { supabase } from '../core/supabase-client.js';

/**
 * Busca a grade ativa do aluno; se não existir, cria uma
 * (semestre/ano correntes, visibilidade 'private' por padrão).
 * @param {string} studentId - id do profile do aluno.
 * @returns {Promise<{data: object|null, error: object|null}>}
 */
export async function getOrCreateActiveGrade(studentId) {
  const { data: found, error: findError } = await supabase
    .from('grades')
    .select('id, name, semester, year, visibility, is_active')
    .eq('student_id', studentId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (findError) return { data: null, error: findError };
  if (found) return { data: found, error: null };

  const now = new Date();
  const semester = now.getMonth() < 7 ? 1 : 2;
  const year = now.getFullYear();

  const { data: created, error: createError } = await supabase
    .from('grades')
    .insert({
      student_id: studentId,
      name: `Grade ${year}/${semester}`,
      semester,
      year,
      visibility: 'private',
      is_active: true,
    })
    .select('id, name, semester, year, visibility, is_active')
    .single();

  return { data: created, error: createError };
}

/**
 * Lista os ids das turmas matriculadas (status 'enrolled') numa grade.
 * @param {string} gradeId
 * @returns {Promise<{data: Set<string>|null, error: object|null}>}
 */
export async function listEnrolledClassIds(gradeId) {
  const { data, error } = await supabase
    .from('student_classes')
    .select('class_id')
    .eq('grade_id', gradeId)
    .eq('status', 'enrolled');

  if (error) return { data: null, error };
  return { data: new Set((data || []).map((r) => r.class_id)), error: null };
}

/**
 * Matricula o aluno numa turma (INSERT em student_classes).
 * O banco pode recusar por pré-requisito ou choque de horário;
 * nesse caso devolvemos a mensagem traduzida em `friendlyError`.
 * @param {string} gradeId
 * @param {string} classId
 * @returns {Promise<{error: object|null, friendlyError: string|null}>}
 */
export async function addClass(gradeId, classId) {
  const { error } = await supabase
    .from('student_classes')
    .insert({ grade_id: gradeId, class_id: classId, status: 'enrolled' });

  return { error, friendlyError: error ? friendlyGradeError(error) : null };
}

/**
 * Remove a matrícula numa turma.
 * @param {string} gradeId
 * @param {string} classId
 * @returns {Promise<{error: object|null}>}
 */
export async function removeClass(gradeId, classId) {
  const { error } = await supabase
    .from('student_classes')
    .delete()
    .eq('grade_id', gradeId)
    .eq('class_id', classId);
  return { error };
}

/**
 * Atualiza a visibilidade da grade (private | friends | public).
 * @param {string} gradeId
 * @param {string} visibility
 * @returns {Promise<{error: object|null}>}
 */
export async function setGradeVisibility(gradeId, visibility) {
  const { error } = await supabase
    .from('grades')
    .update({ visibility })
    .eq('id', gradeId);
  return { error };
}

/** Traduz erros conhecidos dos triggers do banco para pt-BR.
 *  O banco responde mensagens sem acento e com maiúscula inicial
 *  (ex.: "Choque de horario com a materia: X", "Pre-requisitos nao
 *  cumpridos: Y") — por isso normalizamos caixa E acentos antes de casar. */
function friendlyGradeError(error) {
  const msg = String(error?.message || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // remove acentos
  if (msg.includes('pre-requisito') || msg.includes('prerequisito') || msg.includes('requisito')) {
    return 'Pré-requisito pendente: conclua a matéria exigida antes de se matricular nesta turma.';
  }
  if (msg.includes('choque') || msg.includes('conflict') || msg.includes('overlap')) {
    return 'Choque de horário: esta turma colide com outra já na sua grade.';
  }
  return 'Não foi possível adicionar a turma. Tente de novo.';
}
