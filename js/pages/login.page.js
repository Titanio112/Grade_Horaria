/**
 * login.page.js — Orquestração da tela de entrada (login.html).
 *
 * O que faz: lê o formulário, valida no cliente, chama o auth.service,
 * exibe erros inline/por formulário e redireciona para conta.html no sucesso.
 * Se já houver sessão ativa ao abrir a página, vai direto para conta.html.
 * O que NÃO faz: não fala com o Supabase diretamente (isso é services/),
 * não contém CSS, não implementa cadastro (isso é cadastro.page.js).
 * Depende de: js/services/auth.service.js, js/core/utils.js e do
 * markup de login.html (ids: login-form, email, password, *-error, form-error).
 */

import { signIn, getSession } from '../services/auth.service.js';
import { isValidEmail, friendlyAuthError } from '../core/utils.js';
import { mountThemeToggle } from '../components/theme-toggle.component.js';

const form = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const formError = document.getElementById('form-error');
const submitButton = form.querySelector('button[type="submit"]');

/** Exibe erro inline num campo e marca o input para leitores de tela. */
function showFieldError(input, message) {
  const errorEl = document.getElementById(`${input.id}-error`);
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (errorEl) {
    errorEl.textContent = message || '';
    errorEl.hidden = !message;
  }
}

/** Exibe/esconde o erro de nível de formulário (role="alert" no HTML). */
function showFormError(message) {
  formError.textContent = message || '';
  formError.hidden = !message;
}

/** Se já existe sessão, a tela de login nem precisa ser usada. */
async function redirectIfLoggedIn() {
  const session = await getSession();
  if (session) window.location.replace('conta.html');
}

async function handleSubmit(event) {
  event.preventDefault();
  showFormError('');

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  // Validação client-side (feedback imediato; o backend reválida tudo)
  let valid = true;
  if (!isValidEmail(email)) {
    showFieldError(emailInput, 'Informe um e-mail válido.');
    valid = false;
  } else {
    showFieldError(emailInput, '');
  }
  if (!password) {
    showFieldError(passwordInput, 'Informe sua senha.');
    valid = false;
  } else {
    showFieldError(passwordInput, '');
  }
  if (!valid) return;

  submitButton.disabled = true;
  submitButton.textContent = 'Entrando…';

  const { error } = await signIn(email, password);

  submitButton.disabled = false;
  submitButton.textContent = 'Entrar';

  if (error) {
    showFormError(friendlyAuthError(error));
    return;
  }
  window.location.assign('conta.html');
}

form.addEventListener('submit', handleSubmit);
redirectIfLoggedIn();
mountThemeToggle();
