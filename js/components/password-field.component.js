/* ============================================================
   password-field.component.js — Campo de senha turbinado
   O que faz: dado um <input type="password">, envolve num wrapper
   com um botão "olho" (mostrar/esconder) e BLOQUEIA a tecla espaço
   (tecla ignorada + espaços colados são removidos), já que
   validatePassword (utils.js) proíbe espaços — feedback imediato
   é melhor que erro só no submit.
   O que NÃO faz: não valida regras de força (isso é utils.js),
   não fala com rede/Supabase.
   API:
     attachPasswordField(input) → { button }
   Depende de: css/auth.css (.password-wrap, .password-eye).
   ============================================================ */

const EYE_OPEN =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_CLOSED =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><line x1="3" y1="21" x2="21" y2="3"/></svg>';

/**
 * Turbinar um campo de senha existente.
 * @param {HTMLInputElement} input
 * @returns {{button: HTMLButtonElement}}
 */
export function attachPasswordField(input) {
  /* Wrapper para posicionar o olho dentro do campo */
  const wrapper = document.createElement('div');
  wrapper.className = 'password-wrap';
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'password-eye';
  button.innerHTML = EYE_OPEN;
  button.setAttribute('aria-label', 'Mostrar senha');
  button.setAttribute('aria-pressed', 'false');
  button.tabIndex = -1; /* olho não entra na ordem de Tab (senha → submit) */

  function syncIcon() {
    const showing = input.type === 'text';
    button.innerHTML = showing ? EYE_CLOSED : EYE_OPEN;
    button.setAttribute('aria-pressed', showing ? 'true' : 'false');
    button.setAttribute('aria-label', showing ? 'Esconder senha' : 'Mostrar senha');
  }

  button.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
    syncIcon();
    input.focus({ preventScroll: true });
  });

  /* Espaço nunca entra: nem digitado, nem colado */
  input.addEventListener('keydown', (event) => {
    if (event.key === ' ') event.preventDefault();
  });
  input.addEventListener('input', () => {
    const clean = input.value.replace(/\s+/g, '');
    if (clean !== input.value) input.value = clean;
  });

  wrapper.appendChild(button);
  return { button };
}
