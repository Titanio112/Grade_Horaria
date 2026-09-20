/**
 * redefinir.page.js — Orquestração da tela de nova senha (redefinir.html).
 *
 * O que faz: só libera o formulário se houver uma sessão de recuperação
 * ativa (o link do e-mail cria essa sessão via detectSessionInUrl);
 * valida a nova senha (mínimo do Supabase + aviso de senha fraca NÃO
 * bloqueante) e grava via auth.service.updatePassword.
 * O que NÃO faz: não pede o e-mail (isso é recuperar.page.js), não
 * fala com o Supabase diretamente.
 * Depende de: js/services/auth.service.js, js/core/utils.js,
 * js/components/theme-toggle.component.js e do markup de redefinir.html.
 */

import { getSession, updatePassword, onAuthChange } from '../services/auth.service.js';
import { validatePassword, weakPasswordWarning, friendlyAuthError } from '../core/utils.js';
import { mountThemeToggle } from '../components/theme-toggle.component.js';

const form = document.getElementById('redefinir-form');
const passwordInput = document.getElementById('password');
const passwordError = document.getElementById('password-error');
const passwordWarning = document.getElementById('password-warning');
const formError = document.getElementById('form-error');
const submitButton = form.querySelector('button[type="submit"]');
const invalidBlock = document.getElementById('reset-invalid');
const successBlock = document.getElementById('reset-success');

function showFieldError(message) {
  passwordInput.setAttribute('aria-invalid', message ? 'true' : 'false');
  passwordError.textContent = message || '';
  passwordError.hidden = !message;
}

function showFormError(message) {
  formError.textContent = message || '';
  formError.hidden = !message;
}

/** Aviso de senha fraca em tempo real (não bloqueia o submit). */
passwordInput.addEventListener('input', () => {
  const warning = weakPasswordWarning(passwordInput.value);
  passwordWarning.textContent = warning || '';
  passwordWarning.hidden = !warning;
});

/** Habilita o formulário apenas com sessão de recuperação ativa. */
async function init() {
  const session = await getSession();
  if (!session) {
    form.hidden = true;
    invalidBlock.hidden = false;
    return;
  }
  form.hidden = false;
}

async function handleSubmit(event) {
  event.preventDefault();
  showFormError('');

  const password = passwordInput.value;
  const error = validatePassword(password);
  if (error) {
    showFieldError(error);
    return;
  }
  showFieldError('');

  submitButton.disabled = true;
  submitButton.textContent = 'Atualizando…';

  const { error: updateError } = await updatePassword(password);

  submitButton.disabled = false;
  submitButton.textContent = 'Definir nova senha';

  if (updateError) {
    showFormError(friendlyAuthError(updateError));
    return;
  }

  form.hidden = true;
  successBlock.hidden = false;
}

form.addEventListener('submit', handleSubmit);

// O evento PASSWORD_RECOVERY confirma que o link do e-mail foi aberto.
onAuthChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    form.hidden = false;
    invalidBlock.hidden = true;
  }
});

init();
mountThemeToggle();
