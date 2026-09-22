/* ============================================================
   utils.js — Funções puras de validação e formatação
   O que faz: valida e-mail/senha, extrai iniciais e traduz
   erros do Supabase Auth para pt-BR amigável.
   O que NÃO faz: não toca no DOM, não fala com rede/Supabase.
   Depende de: nada (módulo puro).
   ============================================================ */

/**
 * Valida formato de e-mail (usuário@domínio.tld).
 * Não verifica se o domínio existe de verdade — isso é coberto pela
 * confirmação de e-mail do Supabase.
 * @param {string} email - e-mail digitado pelo usuário.
 * @returns {boolean} true se o formato é válido.
 */
export function isValidEmail(email) {
  const re = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
  return re.test(String(email).trim());
}

/* Sequências de teclado comuns (linhas do teclado QWERTY). */
const KEYBOARD_RUNS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

/**
 * Detecta sequência óbvia na senha: 4+ caracteres consecutivos em ordem
 * (numérica ou alfabética, crescente ou decrescente: "1234", "dcba",
 * "abcd"), repetição do mesmo caractere 3+ vezes seguidas ("aaaa") ou
 * trecho de linha de teclado ("qwer", "asdf").
 * @param {string} password
 * @returns {boolean}
 */
export function hasObviousSequence(password) {
  const pw = String(password).toLowerCase();
  if (!pw) return false;

  /* Repetição do mesmo caractere 3+ vezes seguidas */
  if (/(.)\1{2,}/.test(pw)) return true;

  /* Sequência contígua de 4+ caracteres em ordem (alfa ou numérica) */
  for (let i = 0; i + 3 < pw.length; i++) {
    const a = pw.charCodeAt(i);
    const b = pw.charCodeAt(i + 1);
    const c = pw.charCodeAt(i + 2);
    const d = pw.charCodeAt(i + 3);
    const ascending = b === a + 1 && c === b + 1 && d === c + 1;
    const descending = b === a - 1 && c === b - 1 && d === c - 1;
    if (ascending || descending) return true;
  }

  /* Trecho de 4+ caracteres de uma linha do teclado */
  for (const run of KEYBOARD_RUNS) {
    for (let i = 0; i + 4 <= run.length; i++) {
      const chunk = run.slice(i, i + 4);
      if (pw.includes(chunk) || pw.includes([...chunk].reverse().join(''))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Valida a senha. Regras BLOQUEANTES (além do mínimo do Supabase Auth):
 * sem espaços, sem sequências óbvias ("123456", "abcdef", "qwer"…),
 * sem repetição de caractere ("aaaa"…).
 * @param {string} password - senha digitada.
 * @returns {string|null} mensagem de erro em pt-BR, ou null se válida.
 */
export function validatePassword(password) {
  if (!password) return 'Informe uma senha.';
  if (/\s/.test(password)) return 'A senha não pode conter espaços.';
  if (password.length < 6) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (hasObviousSequence(password)) {
    return 'Senha muito óbvia: evite sequências ("123456", "abcdef"…) e repetições ("aaaa"…).';
  }
  return null;
}

/**
 * Aviso NÃO bloqueante de senha fraca (o cadastro segue mesmo assim).
 * Padrões óbvios e repetições já são BLOQUEADOS por validatePassword;
 * aqui ficam só os alertas suaves (tamanho, pouca variedade).
 * @param {string} password - senha digitada.
 * @returns {string|null} aviso em pt-BR, ou null se a senha é razoável.
 */
export function weakPasswordWarning(password) {
  if (!password) return null;
  if (hasObviousSequence(password)) return null; // vira erro de campo no submit
  if (password.length < 8) {
    return 'Senha fraca: recomendamos pelo menos 8 caracteres.';
  }
  if (/^\d+$/.test(password) || /^[a-z]+$/i.test(password)) {
    return 'Senha ok, mas fraca: misture letras, números e símbolos.';
  }
  return null;
}

/* Caracteres permitidos em nome completo: letras (qualquer idioma),
   espaço, apóstrofo e hífen (nomes como "D'Ávila", "Jean-Pierre"). */
const NAME_ALLOWED = /[^\p{L}\s'-]/gu;

/**
 * Remove do texto tudo que não pode existir num nome completo
 * (números, símbolos etc.). Usar no handler de input.
 * @param {string} raw
 * @returns {string}
 */
export function cleanNameInput(raw) {
  return String(raw).replace(NAME_ALLOWED, '');
}

/**
 * Capitaliza a primeira letra de cada palavra, sem forçar o restante
 * para minúsculo (respeita "McDonald", "da Silva" digitado à mão…).
 * @param {string} name
 * @returns {string}
 */
export function titleCaseName(name) {
  return String(name).replace(/(^|\s)(\p{L})/gu, (m, sp, ch) => sp + ch.toUpperCase());
}

/**
 * Valida o nome completo. Regras BLOQUEANTES: ao menos duas palavras
 * (nome + sobrenome) e sem repetição sem sentido ("aaaa").
 * @param {string} name
 * @returns {string|null} mensagem de erro em pt-BR, ou null se válido.
 */
export function validateFullName(name) {
  const clean = String(name).trim().replace(/\s+/g, ' ');
  if (!clean) return 'Informe seu nome completo.';
  const words = clean.split(' ').filter(Boolean);
  if (words.length < 2) {
    return 'Ei, sabemos que você tem um sobrenome! Por favor, insira pelo menos um sobrenome.';
  }
  if (/(\p{L})\1{2,}/iu.test(clean)) {
    return 'Hmm, isso não parece um nome de verdade — evite repetir a mesma letra ("aaaa"…).';
  }
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
