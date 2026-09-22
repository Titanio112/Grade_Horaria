/* ============================================================
   auth.service.js — Autenticação (login, cadastro, sessão)
   O que faz: única porta de entrada para o Supabase Auth:
   signUp, signIn, signOut, getSession e onAuthChange.
   O que NÃO faz: não toca no DOM, não decide navegação/redirect
   (isso é da página), não lê/escreve a tabela profiles
   (isso é profiles.service.js).
   Depende de: js/core/supabase-client.js (cliente configurado).
   ============================================================ */

import { supabase } from '../core/supabase-client.js';

/**
 * Cria conta nova. O trigger handle_new_user (v5) cria o profile
 * com full_name; o course_id vai nos metadados e é gravado no
 * profile no primeiro login (ver profiles.service.ensureProfileCourse).
 * @param {{email: string, password: string, fullName: string, courseId: string}} params
 * @returns {Promise<{data: object|null, error: object|null}>}
 */
export async function signUp({ email, password, fullName, courseId }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, course_id: courseId } },
  });
  return { data, error };
}

/**
 * Entra com e-mail e senha.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{data: object|null, error: object|null}>}
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

/**
 * Encerra a sessão atual.
 * @returns {Promise<{error: object|null}>}
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Lê a sessão persistida (sem rede se o token local for válido).
 * @returns {Promise<object|null>} session ativa ou null.
 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Pede link de recuperação de senha por e-mail. O redirectTo aponta
 * para redefinir.html (URL resolvida a partir deste módulo, então
 * funciona tanto em localhost quanto no GitHub Pages).
 * @param {string} email
 * @returns {Promise<{data: object|null, error: object|null}>}
 */
export async function requestPasswordReset(email) {
  const redirectTo = new URL('../../pages/redefinir.html', import.meta.url).href;
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  return { data, error };
}

/**
 * Define a nova senha (exige a sessão de recuperação criada quando o
 * usuário abre o link do e-mail — detectSessionInUrl já está ligado).
 * @param {string} newPassword
 * @returns {Promise<{data: object|null, error: object|null}>}
 */
export async function updatePassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  return { data, error };
}

/**
 * Observa mudanças de autenticação (SIGNED_IN, SIGNED_OUT...).
 * @param {(event: string, session: object|null) => void} callback
 * @returns {() => void} função para cancelar a inscrição.
 */
export function onAuthChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}
