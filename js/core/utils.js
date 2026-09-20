/* ============================================================
   utils.js — Funções puras de validação e formatação
   O que faz: valida e-mail/senha, extrai iniciais e traduz
   erros do Supabase Auth para pt-BR amigável.
   O que NÃO faz: não toca no DOM, não fala com rede/Supabase.
   Depende de: nada (módulo puro).
   ============================================================ */

/**
 * Valida formato básico de e-mail.
 * @param {string} email - e-mail digitado pelo usuário.
 * @returns {boolean} true se o formato é plausível.
 */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim());
}

/**
 * Valida a senha contra a regra mínima do Supabase Auth (6 chars).
 * @param {string} password - senha digitada.
 * @returns {string|null} mensagem de erro em pt-BR, ou null se válida.
 */
export function validatePassword(password) {
  if (!password) return 'Informe uma senha.';
  if (password.length < 6) return 'A senha precisa ter pelo menos 6 caracteres.';
  return null;
}

/**
 * Extrai a inicial do nome para o avatar circular.
 * @param {string} fullName - nome completo do perfil.
 * @returns {string} primeira letra maiúscula ('?' se vazio).
 */
export function initialOf(fullName) {
  const clean = String(fullName || '').trim();
  return clean ? clean[0].toUpperCase() : '?';
}

/**
 * Traduz erros conhecidos do Supabase Auth para pt-BR.
 * @param {Error|{message:string}} error - erro retornado pelo SDK.
 * @returns {string} mensagem amigável para exibir no formulário.
 */
export function friendlyAuthError(error) {
  const msg = String(error?.message || '');
  const known = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'User already registered': 'Este e-mail já está cadastrado. Tente entrar.',
    'Email not confirmed': 'Confirme seu e-mail antes de entrar (verifique sua caixa de entrada).',
    'Password should be at least 6 characters': 'A senha precisa ter pelo menos 6 caracteres.',
  };
  for (const [key, text] of Object.entries(known)) {
    if (msg.includes(key)) return text;
  }
  if (msg.toLowerCase().includes('rate limit')) {
    return 'Muitas tentativas. Aguarde um minuto e tente de novo.';
  }
  return 'Não foi possível concluir. Verifique sua conexão e tente de novo.';
}
