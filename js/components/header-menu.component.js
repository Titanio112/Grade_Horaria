/* ============================================================
   header-menu.component.js — Menu ⋯ do header do app
   O que faz: agrupa os itens de navegação (Minha grade, Conta…)
   e o logout sob um botão "três pontinhos", com painel em vidro
   (Liquid Glass) abrindo com a animação padrão do site (mola).
   Acessível: role="menu"/"menuitem", Esc fecha, clique fora fecha,
   foco vai para o painel ao abrir.
   O que NÃO faz: não fala com o Supabase — o logout é um callback
   injetado pela página.
   API:
     createHeaderMenu({ container, links, onLogout })
       links: [{ href, label, current }]  (current = aria-current="page")
     → { logoutButton, trigger, isOpen() }
   Depende de: css/components.css (.app-menu-*), css/motion.css.
   ============================================================ */

export function createHeaderMenu({ container, links = [], onLogout = () => {} }) {
  const root = document.createElement('div');
  root.className = 'app-menu';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'app-menu__trigger';
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', 'Menu');
  trigger.title = 'Menu';
  trigger.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">' +
    '<circle cx="9" cy="3.5" r="1.6"/><circle cx="9" cy="9" r="1.6"/><circle cx="9" cy="14.5" r="1.6"/></svg>';

  const panel = document.createElement('div');
  panel.className = 'app-menu__panel';
  panel.setAttribute('role', 'menu');

  for (const link of links) {
    const a = document.createElement('a');
    a.className = 'app-menu__link';
    a.href = link.href;
    a.textContent = link.label;
    a.setAttribute('role', 'menuitem');
    if (link.current) a.setAttribute('aria-current', 'page');
    panel.appendChild(a);
  }

  const logoutButton = document.createElement('button');
  logoutButton.type = 'button';
  logoutButton.id = 'logout-button';
  logoutButton.className = 'app-menu__button';
  logoutButton.setAttribute('role', 'menuitem');
  logoutButton.textContent = 'Sair';
  logoutButton.addEventListener('click', () => { closeMenu(); onLogout(); });
  panel.appendChild(logoutButton);

  let open = false;

  function openMenu() {
    if (open) return;
    open = true;
    panel.classList.add('is-open', 'animate-pop');
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKeydown);
    if (panel.firstElementChild) panel.firstElementChild.focus();
  }

  function closeMenu() {
    if (!open) return;
    open = false;
    panel.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onKeydown);
  }

  function onDocClick(e) {
    if (!root.contains(e.target)) closeMenu();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      closeMenu();
      trigger.focus();
    }
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    open ? closeMenu() : openMenu();
  });

  root.append(trigger, panel);
  container.appendChild(root);

  return { logoutButton, trigger, isOpen: () => open };
}
