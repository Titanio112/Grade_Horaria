/**
 * recuperar.page.js — Orquestração da tela de pedido de recuperação (recuperar.html).
 *
 * O que faz: valida o e-mail, chama auth.service.requestPasswordReset e
 * SEMPRE mostra o estado de sucesso (anti-enumeração: não revelamos se o
 * e-mail existe no sistema ou não).
 * O que NÃO faz: não redefine a senha aqui (isso é redefinir.page.js,
 * a partir do link do e-mail), não fala com o Supabase diretamente.
 * Depende de: js/services/auth.service.js, js/core/utils.js,
 * js/components/theme-toggle.component.js e do markup de recuperar.html.
 */

import { requestPasswordReset } from '../services/auth.service.js';
import { isValidEmail } from '../core/utils.js';
import { mountThemeToggle } from '../components/theme-toggle.component.js';

const form = document.getElementById('recuperar-form');
const emailInput = document.getElementById('email');
const emailError = document.getElementById('email-error');
const submitButton = form.querySelector('button[type="submit"]');
const successBlock = document.getElementById('recover-success');
const successEmail = document.getElementById('recover-success-email');

/** Exibe/limpa o erro inline do campo de e-mail. */
function showEmailError(message) {
  emailInput.setAttribute('aria-invalid', message ? 'true' : 'false');
  emailError.textContent = message || '';
  emailError.hidden = !message;
}

async function handleSubmit(event) {
  event.preventDefault();
  const email = emailInput.value.trim();

  if (!isValidEmail(email)) {
    showEmailError('Informe um e-mail válido.');
    return;
  }
  showEmailError('');

  submitButton.disabled = true;
  submitButton.textContent = 'Enviando…';

  // Erro de rede/rate limit não muda a resposta visível: anti-enumeração.
  await requestPasswordReset(email).catch(() => null);

  form.hidden = true;
  successEmail.textContent = email;
  successBlock.hidden = false;
}

form.addEventListener('submit', handleSubmit);
mountThemeToggle();
