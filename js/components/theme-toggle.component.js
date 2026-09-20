/**
 * theme-toggle.component.js — Botão "Liquid Glass" de alternância claro/escuro.
 *
 * O que faz: cria e injeta no <body> um botão fixo (canto superior direito)
 * que alterna document.documentElement[data-theme] entre 'light' e 'dark',
 * persistindo a escolha em localStorage ('gh-theme').
 * O que NÃO faz: não decide o tema inicial (isso é o bootstrap inline no
 * <head> de cada página, que roda antes do paint pra evitar flash), não
 * conhece Supabase, não é um formulário.
 * Depende de: css/base.css (.theme-toggle) e css/tokens.css (as cores).
 * Ícones: Fluent Emoji 3D via CDN jsdelivr (sem download local, por decisão).
 */

const ICONS = {
  light: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Crescent%20moon/3D/crescent_moon_3d.png',
  dark: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Sun/3D/sun_3d.png',
};

/** Lê o tema atual aplicado ao documento. */
function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Aplica o tema e atualiza o ícone/estado do botão. */
function apply(theme, button, img) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('gh-theme', theme);
  } catch {
    /* storage indisponível (modo anônimo estrito etc.) — segue sem persistir */
  }
  img.src = ICONS[theme]; // mostra o ícone do OUTRO modo (o que o clique ativa)
  img.alt = theme === 'dark' ? 'Sol (mudar para modo claro)' : 'Lua (mudar para modo escuro)';
  button.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  button.title = img.alt;
}

/**
 * Cria e monta o botão de alternância de tema no <body>.
 * @returns {HTMLButtonElement} o botão criado.
 */
export function mountThemeToggle() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'theme-toggle';

  const img = document.createElement('img');
  img.width = 22;
  img.height = 22;
  img.decoding = 'async';
  button.appendChild(img);

  apply(currentTheme(), button, img);
  button.addEventListener('click', () => {
    apply(currentTheme() === 'dark' ? 'light' : 'dark', button, img);
  });

  document.body.appendChild(button);
  return button;
}
