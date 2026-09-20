/**
 * cadastro.page.js — Orquestração da tela de cadastro (cadastro.html).
 *
 * O que faz: monta a cascata instituição → campus → curso (via o
 * componente injetando os loaders de institutions.service), valida o
 * formulário, cria a conta via auth.service e exibe o estado de
 * "confira seu e-mail" (confirmação de e-mail está LIGADA no backend,
 * então não há sessão imediata após o signUp).
 * O que NÃO faz: não fala com o Supabase diretamente, não contém CSS,
 * não redireciona para o app (o usuário precisa confirmar o e-mail).
 * Depende de: js/services/auth.service.js, js/services/institutions.service.js,
 * js/components/select-cascade.component.js, js/core/utils.js e do
 * markup de cadastro.html.
 */

import { signUp } from '../services/auth.service.js';
import { listInstitutions, listCampuses, listCourses } from '../services/institutions.service.js';
import { createSelectCascade } from '../components/select-cascade.component.js';
import { isValidEmail, validatePassword, friendlyAuthError } from '../core/utils.js';

const form = document.getElementById('cadastro-form');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const formError = document.getElementById('form-error');
const submitButton = form.querySelector('button[type="submit"]');
const successBlock = document.getElementById('signup-success');
const successEmail = document.getElementById('signup-success-email');

/** Loader adaptado: services devolvem {data, error}; o componente espera
 *  uma Promise que resolve com o array ou rejeita em caso de erro. */
const asLoader = (serviceCall) => async (...args) => {
  const { data, error } = await serviceCall(...args);
  if (error) throw error;
  return data ?? [];
};

const cascade = createSelectCascade({
  selects: {
    institution: document.getElementById('institution'),
    campus: document.getElementById('campus'),
    course: document.getElementById('course'),
  },
  loaders: {
    institutions: asLoader(listInstitutions),
    campuses: asLoader(listCampuses),
    courses: asLoader(listCourses),
  },
});

/** Exibe erro inline num campo e marca para leitores de tela. */
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

/** Valida todos os campos; retorna true se pode enviar. */
function validateForm() {
  let valid = true;

  if (!nameInput.value.trim()) {
    showFieldError(nameInput, 'Informe seu nome completo.');
    valid = false;
  } else {
    showFieldError(nameInput, '');
  }

  if (!isValidEmail(emailInput.value)) {
    showFieldError(emailInput, 'Informe um e-mail válido.');
    valid = false;
  } else {
    showFieldError(emailInput, '');
  }

  const passwordError = validatePassword(passwordInput.value);
  showFieldError(passwordInput, passwordError || '');
  if (passwordError) valid = false;

  if (!cascade.getCourseId()) {
    showFieldError(document.getElementById('course'), 'Escolha instituição, campus e curso.');
    valid = false;
  } else {
    showFieldError(document.getElementById('course'), '');
  }

  return valid;
}

async function handleSubmit(event) {
  event.preventDefault();
  showFormError('');
  if (!validateForm()) return;

  submitButton.disabled = true;
  submitButton.textContent = 'Criando conta…';

  const { error } = await signUp({
    email: emailInput.value.trim(),
    password: passwordInput.value,
    fullName: nameInput.value.trim(),
    courseId: cascade.getCourseId(),
  });

  submitButton.disabled = false;
  submitButton.textContent = 'Criar conta';

  if (error) {
    showFormError(friendlyAuthError(error));
    return;
  }

  // Confirmação de e-mail LIGADA: não há sessão ainda. Mostra o próximo passo.
  form.hidden = true;
  successEmail.textContent = emailInput.value.trim();
  successBlock.hidden = false;
}

form.addEventListener('submit', handleSubmit);
