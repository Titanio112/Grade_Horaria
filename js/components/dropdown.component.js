/* ============================================================
   dropdown.component.js — Dropdown customizado (listbox ARIA)
   O que faz: substitui <select> nativo por um componente 100%
   estilável (role="listbox" + role="option"), mantendo
   acessibilidade total (teclado, ARIA, foco).
   O que NÃO faz: NÃO fala com Supabase, NÃO decide lógica de negócio.
   API:
     createDropdown({ trigger, options, placeholder, name, required, onChange })
   Retorna: { setOptions, setValue, setPlaceholder, disable, enable,
              destroy, getValue, element, open, close }
   Estilos: css/components.css (.dropdown-* + vidro). Movimento:
   css/motion.css (.animate-pop na abertura).
   Depende de: css/tokens.css, css/components.css, css/motion.css.
   ============================================================ */

function createDropdown({
  trigger,
  options = [],
  placeholder = 'Selecione',
  name = '',
  required = false,
  onChange = () => {},
}) {
  let isOpen = false;
  let highlightedIndex = -1;
  let selectedValue = '';
  let currentPlaceholder = placeholder;
  const listboxId = 'dropdown-listbox-' + Math.random().toString(36).slice(2, 9);

  /* Wrapper com position:relative para ancorar o painel no botão
     (o listbox NÃO pode ficar no <body>: top/left em % seriam
     relativos à página inteira e o painel abriria no lugar errado). */
  const originalParent = trigger.parentNode;
  const originalNextSibling = trigger.nextSibling;
  const wrapper = document.createElement('div');
  wrapper.className = 'dropdown-wrap';
  originalParent.insertBefore(wrapper, trigger);
  wrapper.appendChild(trigger);

  /* O rótulo fica num <span> próprio: se usássemos trigger.textContent
     para trocar o texto, o chevron (filho do botão) seria apagado. */
  const labelSpan = document.createElement('span');
  labelSpan.className = 'dropdown-label';
  labelSpan.textContent = currentPlaceholder;

  const listbox = document.createElement('div');
  listbox.id = listboxId;
  listbox.className = 'dropdown-listbox';
  listbox.setAttribute('role', 'listbox');
  listbox.setAttribute('aria-label', currentPlaceholder);

  function renderOptions() {
    listbox.innerHTML = '';
    if (selectedValue === '' && currentPlaceholder) {
      const ph = document.createElement('div');
      ph.setAttribute('role', 'option');
      ph.className = 'dropdown-option dropdown-option--placeholder';
      ph.id = listboxId + '-option-placeholder';
      ph.dataset.value = '';
      ph.textContent = currentPlaceholder;
      ph.addEventListener('click', () => selectOption(''));
      ph.addEventListener('mouseenter', () => highlightIndex(0));
      listbox.appendChild(ph);
    }
    options.forEach((opt) => {
      const option = document.createElement('div');
      option.setAttribute('role', 'option');
      option.className = 'dropdown-option';
      option.id = listboxId + '-option-' + opt.value;
      option.dataset.value = opt.value;
      option.textContent = opt.label;
      const selected = opt.value === selectedValue;
      if (selected) option.setAttribute('aria-selected', 'true');
      option.addEventListener('click', () => selectOption(opt.value));
      option.addEventListener('mouseenter', () => {
        const items = Array.from(listbox.querySelectorAll('[role="option"]'));
        highlightIndex(items.indexOf(option));
      });
      listbox.appendChild(option);
    });
  }

  function highlightIndex(idx) {
    const items = listbox.querySelectorAll('[role="option"]');
    items.forEach((el, i) => {
      el.classList.toggle('is-highlighted', i === idx);
      if (i === idx) el.scrollIntoView({ block: 'nearest' });
    });
    highlightedIndex = idx;
  }


  function selectOption(value) {
    selectedValue = value;
    const opt = options.find((o) => o.value === value);
    const label = value === '' ? currentPlaceholder : (opt ? opt.label : currentPlaceholder);
    labelSpan.textContent = label;
    trigger.dataset.value = value;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.classList.toggle('has-value', value !== '');
    close();
    onChange(value);
  }

  function open() {
    if (trigger.disabled) return;
    isOpen = true;
    /* is-open exibe; animate-pop = entrada com mola (css/motion.css) */
    listbox.classList.add('is-open', 'animate-pop');
    trigger.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-controls', listboxId);
    wrapper.appendChild(listbox);
    positionListbox();
    renderOptions();
    setTimeout(() => document.addEventListener('click', outsideClick), 0);
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    listbox.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    if (listbox.parentNode) listbox.parentNode.removeChild(listbox);
    document.removeEventListener('click', outsideClick);
    window.removeEventListener('scroll', onViewportChange, true);
    window.removeEventListener('resize', onViewportChange);
  }

  function outsideClick(e) {
    if (!wrapper.contains(e.target)) close();
  }

  function onViewportChange() {
    close();
  }

  function onKeydown(e) {
    /* Fechado: só reage se o foco estiver no próprio trigger —
       senão Espaço/Seta em qualquer lugar da página abriria o dropdown. */
    if (!isOpen) {
      if (document.activeElement !== trigger) return;
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
      return;
    }
    const items = listbox.querySelectorAll('[role="option"]');
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        highlightIndex(Math.min(highlightedIndex + 1, items.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        highlightIndex(Math.max(highlightedIndex - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (highlightedIndex >= 0) selectOption(items[highlightedIndex].dataset.value);
        break;
      case 'Escape':
        close();
        trigger.focus();
        break;
      case 'Tab':
        close();
        break;
    }
  }

  function positionListbox() {
    /* Abre para cima quando não há espaço embaixo (viewport). */
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    listbox.classList.toggle('opens-up', spaceBelow < 200 && rect.top > spaceBelow);
  }

  /* Handlers nomeados para que destroy() consiga removê-los de verdade
     (removeEventListener exige a MESMA referência de função). */
  function handleTriggerClick(e) {
    e.stopPropagation();
    isOpen ? close() : open();
  }

  trigger.type = 'button';
  trigger.classList.add('dropdown-trigger');
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-autocomplete', 'none');
  trigger.setAttribute('aria-controls', listboxId);
  if (required) trigger.setAttribute('aria-required', 'true');
  if (name) trigger.dataset.name = name;
  trigger.textContent = '';
  trigger.appendChild(labelSpan);
  const chevron = document.createElement('span');
  chevron.setAttribute('aria-hidden', 'true');
  chevron.className = 'dropdown-chevron';
  chevron.innerHTML = '<svg width="12" height="8" viewBox="0 0 12 8" fill="none"><path d="M1 1l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  trigger.appendChild(chevron);
  trigger.addEventListener('click', handleTriggerClick);
  /* keydown fica permanente (a guarda de foco em onKeydown impede
     disparo quando o trigger não está focado); destroy() remove. */
  document.addEventListener('keydown', onKeydown);

  /* Atualiza as opções; placeholder novo é opcional (a cascata usa isso
     para trocar "Carregando…" por "Selecione a instituição"). */
  function setOptions(newOpts, newPlaceholder) {
    options = newOpts;
    if (newPlaceholder !== undefined) currentPlaceholder = newPlaceholder;
    if (selectedValue === '') labelSpan.textContent = currentPlaceholder;
    if (isOpen) renderOptions();
  }

  function setValue(value) { selectOption(value); }

  function setPlaceholder(text) {
    currentPlaceholder = text;
    if (selectedValue === '') labelSpan.textContent = text;
  }

  function disable() {
    trigger.disabled = true;
    close();
  }

  function enable() {
    trigger.disabled = false;
  }

  function destroy() {
    close();
    document.removeEventListener('keydown', onKeydown);
    trigger.removeEventListener('click', handleTriggerClick);
    /* Desfaz o wrapper: devolve o trigger ao pai original. */
    if (wrapper.parentNode) {
      wrapper.parentNode.insertBefore(trigger, wrapper);
      wrapper.parentNode.removeChild(wrapper);
    } else if (originalParent) {
      originalParent.insertBefore(trigger, originalNextSibling);
    }
  }

  renderOptions();

  return { setOptions, setValue, setPlaceholder, disable, enable, destroy, getValue: () => selectedValue, element: trigger, open, close };
}

export { createDropdown };
