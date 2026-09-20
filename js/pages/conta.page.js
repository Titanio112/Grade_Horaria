/**
 * conta.page.js — Tela pós-login mínima (conta.html).
 *
 * O que faz: exige sessão (senão redireciona para login), lê o profile,
 * faz o backfill do course_id escolhido no cadastro (primeiro login
 * após confirmar o e-mail) e renderiza nome, e-mail, curso/instituição.
 * O botão Sair encerra a sessão e volta para login.html.
 * O que NÃO faz: não é o app completo (grade, social, admin vêm em
 * fases futuras), não fala com o Supabase diretamente.
 * Depende de: js/services/auth.service.js, js/services/profiles.service.js,
 * js/services/institutions.service.js, js/core/utils.js e do markup de conta.html.
 */

import { getSession, signOut } from '../services/auth.service.js';
import { getMyProfile, ensureProfileCourse } from '../services/profiles.service.js';
import { getCoursePath } from '../services/institutions.service.js';
import { initialOf } from '../core/utils.js';
import { mountThemeToggle } from '../components/theme-toggle.component.js';

const avatar = document.getElementById('account-avatar');
const nameEl = document.getElementById('account-name');
const emailEl = document.getElementById('account-email');
const courseEl = document.getElementById('account-course');
const logoutButton = document.getElementById('logout-button');

/** Preenche a linha curso/campus/instituição a partir do course_id. */
async function renderCoursePath(courseId) {
  if (!courseId) {
    courseEl.textContent = 'Curso não informado.';
    return;
  }
  const { data, error } = await getCoursePath(courseId);
  courseEl.textContent = error || !data
    ? 'Não foi possível carregar seu curso.'
    : `${data.courseName} — ${data.campusName}, ${data.institutionName}`;
}

async function init() {
  const session = await getSession();
  if (!session) {
    window.location.replace('login.html');
    return;
  }

  const { data: profile, error } = await getMyProfile(session.user.id);
  if (error || !profile) {
    nameEl.textContent = 'Não foi possível carregar seu perfil.';
    emailEl.textContent = session.user.email || '';
    return;
  }

  // Backfill: grava o course_id vindo dos metadados do signup (1º login).
  const { courseId } = await ensureProfileCourse(session.user, profile);
  const effectiveCourseId = profile.course_id || courseId;

  avatar.textContent = initialOf(profile.full_name || session.user.email);
  nameEl.textContent = profile.full_name || 'Aluno';
  emailEl.textContent = profile.email || session.user.email || '';
  await renderCoursePath(effectiveCourseId);
}

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  logoutButton.textContent = 'Saindo…';
  await signOut();
  window.location.replace('login.html');
});

init();
mountThemeToggle();
