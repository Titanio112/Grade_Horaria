/* ============================================================
   profiles.service.js — Leitura/escrita da tabela profiles
   O que faz: busca o profile do usuário logado e grava o
   course_id escolhido no cadastro quando o trigger ainda não
   o persistiu (backfill pós-confirmação de e-mail).
   O que NÃO faz: não autentica (isso é auth.service.js), não
   monta a hierarquia instituição→campus→curso (isso é
   institutions.service.js), não toca no DOM.
   Depende de: js/core/supabase-client.js.
   ============================================================ */

import { supabase } from '../core/supabase-client.js';

/**
 * Busca o profile do usuário logado (RLS permite ler o próprio).
 * @param {string} userId - id do auth.users logado.
 * @returns {Promise<{data: object|null, error: object|null}>}
 */
export async function getMyProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, course_id, role, friend_code, avatar_url')
    .eq('id', userId)
    .single();
  return { data, error };
}

/**
 * Backfill: se o profile está sem course_id e o metadata do
 * signup trouxe um (fluxo de confirmação de e-mail), grava no
 * profile. RLS permite UPDATE apenas no próprio profile.
 * @param {object} user - auth user da sessão (com user_metadata).
 * @param {object} profile - profile lido via getMyProfile.
 * @returns {Promise<{updated: boolean, courseId: string|null}>}
 */
export async function ensureProfileCourse(user, profile) {
  if (!user || !profile) return { updated: false, courseId: null };
  if (profile.course_id) return { updated: false, courseId: profile.course_id };

  const metaCourseId = user.user_metadata?.course_id || null;
  if (!metaCourseId) return { updated: false, courseId: null };

  const { error } = await supabase
    .from('profiles')
    .update({ course_id: metaCourseId })
    .eq('id', user.id);

  return { updated: !error, courseId: error ? null : metaCourseId };
}
