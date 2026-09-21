/**
 * cadastro.page.js — Orquestração da tela de cadastro (cadastro.html).
 *
 * O que faz: monta a cascata instituição → campus → curso (via o
 * componente dropdown customizado injetando os loaders de
 * institutions.service), valida o formulário, cria a conta via
 * auth.service e exibe o estado de "confirme seu e-mail"
 * (confirmação de e-mail está LIGADA no backend, então não há
 * sessão imediata após o signUp).
 * O que NÃO faz: não fala com o Supabase diretamente, não contém CSS,
 * não redireciona para o app (o usuário precisa confirmar o e-mail).
 * Depende de: js/services/auth.service.js, js/services/institutions.service.js,
 * js/components/select-cascade.component.js, js/core/utils.js e do
 * markup de cadastro.html.
 */

import { signUp } from '../services/auth.service.js';
import { listInstitutions, listCampuses, listCourses } from '../services/institutions.service.js';
import { submitInstitutionRequest } from '../services/institution-requests.service.js';
import { createSelectCascade } from '../components/select-cascade.component.js';
import { mountThemeToggle } from '../components/theme-toggle.component.js';
import { isValidEmail, validatePassword, weakPasswordWarning, friendlyAuthError } from '../core/utils.js';

const form = document.getElementById('cadastro-form');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const formError = document.getElementById('form-error');
const submitButton = form.querySelector('button[type="submit"]');
const successBlock = document.getElementById('signup-success');
const successEmail = document.getElementById('signup-success-email');

/* Inputs ocultos para enviar os valores selecionados no submit. */
const instValue = document.getElementById('institution-value');
const campValue = document.getElementById('campus-value');
const courValue = document.getElementById('course-value');

/* Loader adaptado: services devolvem {data, error}; o componente espera
 *  uma Promise que resolve com o array ou rejeita em caso de erro. */
const asLoader = (serviceCall) => async (...args) => {
  const { data, error } = await serviceCall(...args);
  if (error) throw error;
  return data ?? [];
};

const cascade = createSelectCascade({
  triggers: {
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

  const courseId = cascade.getCourseId();
  if (!courseId) {
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

  const fullName = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const courseId = cascade.getCourseId();

  if (!validateForm()) return;

  // Sincroniza hidden inputs para o submit do formulário
  instValue.value = document.getElementById('institution').dataset.value || '';
  campValue.value = document.getElementById('campus').dataset.value || '';
  courValue.value = courseId;

  submitButton.disabled = true;
  submitButton.textContent = 'Criando conta…';

  const { error } = await signUp({
    email,
    password,
    fullName,
    courseId,
  });

  submitButton.disabled = false;
  submitButton.textContent = 'Criar conta';

  if (error) {
    showFormError(friendlyAuthError(error));
    return;
  }

  form.hidden = true;
  successEmail.textContent = email;
  successBlock.hidden = false;
}

form.addEventListener('submit', handleSubmit);
/* ---------- Aviso de senha fraca (NAO bloqueia o cadastro) ---------- */

const passwordWarning = document.getElementById('password-warning');

passwordInput.addEventListener('input', () => {
  const warningMsg = weakPasswordWarning(passwordInput.value);
  passwordWarning.textContent = warningMsg || '';
  passwordWarning.hidden = !warningMsg;
});

/* ---------- Solicitação de instituição não cadastrada ---------- */

const requestForm = document.getElementById('institution-request-form');
const requestSuccess = document.getElementById('request-success');
const requestFormError = document.getElementById('request-form-error');

/** Erro inline de um campo do formulário de solicitação. */
function showRequestError(input, message) {
  const errorEl = document.getElementById(`${input.id}-error`);
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (errorEl) {
    errorEl.textContent = message || '';
    errorEl.hidden = !message;
  }
}

async function handleRequestSubmit(event) {
  event.preventDefault();
  requestFormError.hidden = true;

  const institutionInput = document.getElementById('request-institution');
  const contactInput = document.getElementById('request-email');
  const messageInput = document.getElementById('request-message');

  let valid = true;
  if (institutionInput.value.trim().length < 3) {
    showRequestError(institutionInput, 'Informe o nome da instituição.');
    valid = false;
  } else showRequestError(institutionInput, '');
  if (!isValidEmail(contactInput.value)) {
    showRequestError(contactInput, 'Informe um e-mail válido.');
    valid = false;
  } else showRequestError(contactInput, '');
  if (messageInput.value.trim().length < 10) {
    showRequestError(messageInput, 'Conte em uma frase o que você precisa (mín. 10 caracteres).');
    valid = false;
  } else showRequestError(messageInput, '');
  if (!valid) return;

  const button = requestForm.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Enviando…';

  const { error } = await submitInstitutionRequest({
    institutionName: institutionInput.value,
    contactEmail: contactInput.value,
    message: messageInput.value,
  });

  button.disabled = false;
  button.textContent = 'Enviar solicitação';

  if (error) {
    requestFormError.textContent = 'Não foi possível enviar agora. Tente de novo em instantes.';
    requestFormError.hidden = false;
    return;
  }
  requestForm.hidden = true;
  requestSuccess.hidden = false;
}

requestForm.addEventListener('submit', handleRequestSubmit);

mountThemeToggle();
