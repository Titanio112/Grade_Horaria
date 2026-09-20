/**
 * institutions.service.js — Hierarquia pública institutions → campuses → courses.
 *
 * O que faz: lista instituições, campi e cursos (leitura pública via RLS)
 * e resolve o caminho completo de um curso (curso → campus → instituição).
 * O que NÃO faz: não escreve no banco, não toca no DOM, não conhece auth.
 * Depende de: js/core/supabase-client.js.
 */

import { supabase } from '../core/supabase-client.js';

/**
 * Lista todas as instituições, em ordem alfabética.
 * @returns {Promise<{data: Array<{id: string, name: string, acronym: string}>|null, error: object|null}>}
 */
export async function listInstitutions() {
  const { data, error } = await supabase
    .from('institutions')
    .select('id, name, acronym')
    .order('name');
  return { data, error };
}

/**
 * Lista os campi de uma instituição, em ordem alfabética.
 * @param {string} institutionId - id da instituição selecionada
 * @returns {Promise<{data: Array<{id: string, name: string, city: string}>|null, error: object|null}>}
 */
export async function listCampuses(institutionId) {
  const { data, error } = await supabase
    .from('campuses')
    .select('id, name, city')
    .eq('institution_id', institutionId)
    .order('name');
  return { data, error };
}

/**
 * Lista os cursos de um campus, em ordem alfabética.
 * @param {string} campusId - id do campus selecionado
 * @returns {Promise<{data: Array<{id: string, name: string}>|null, error: object|null}>}
 */
export async function listCourses(campusId) {
  const { data, error } = await supabase
    .from('courses')
    .select('id, name')
    .eq('campus_id', campusId)
    .order('name');
  return { data, error };
}

/**
 * Resolve o caminho completo de um curso (curso, campus, instituição)
 * numa única query aninhada. Usado na tela de conta.
 * @param {string} courseId - id do curso (profiles.course_id)
 * @returns {Promise<{data: {courseName: string, campusName: string, institutionName: string}|null, error: object|null}>}
 */
export async function getCoursePath(courseId) {
  const { data, error } = await supabase
    .from('courses')
    .select('name, campuses(name, institutions(name, acronym))')
    .eq('id', courseId)
    .single();

  if (error || !data) return { data: null, error };

  const campus = data.campuses;
  const institution = campus?.institutions;
  return {
    data: {
      courseName: data.name,
      campusName: campus?.name ?? '',
      institutionName: institution ? `${institution.name} (${institution.acronym})` : '',
    },
    error: null,
  };
}
