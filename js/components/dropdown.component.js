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
   Depende de: css/tokens.css (cores), css/base.css (estilos).
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
  wrapper.className = 'dropdown-wrapper';
  wrapper.style.cssText = 'position: relative; width: 100%; min-width: 0;';
  originalParent.insertBefore(wrapper, trigger);
  wrapper.appendChild(trigger);

  /* O rótulo fica num <span> próprio: se usássemos trigger.textContent
     para trocar o texto, o chevron (filho do botão) seria apagado. */
  const labelSpan = document.createElement('span');
  labelSpan.className = 'dropdown-label';
  labelSpan.textContent = currentPlaceholder;
  labelSpan.style.cssText = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;';

  const listbox = document.createElement('div');
  listbox.id = listboxId;
  listbox.setAttribute('role', 'listbox');
  listbox.setAttribute('aria-label', currentPlaceholder);
  listbox.style.cssText = `
    position: absolute; top: 100%; left: 0; right: 0; z-index: 100;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-field); margin-top: 0.25rem;
    max-height: 16rem; overflow-y: auto; display: none;
    box-shadow: 0 0.5rem 1.5rem var(--glass-shadow);
  `;

  function baseOptionStyle() {
    return 'padding: 0.5rem 0.75rem; cursor: pointer;';
  }

  function renderOptions() {
    listbox.innerHTML = '';
    if (selectedValue === '' && currentPlaceholder) {
      const ph = document.createElement('div');
      ph.setAttribute('role', 'option');
      ph.id = listboxId + '-option-placeholder';
      ph.dataset.value = '';
      ph.textContent = currentPlaceholder;
      ph.style.cssText = baseOptionStyle() + ' color: var(--ink-2);';
      ph.addEventListener('click', () => selectOption(''));
      ph.addEventListener('mouseenter', () => highlightIndex(0));
      listbox.appendChild(ph);
    }
    options.forEach((opt) => {
      const option = document.createElement('div');
      option.setAttribute('role', 'option');
      option.id = listboxId + '-option-' + opt.value;
      option.dataset.value = opt.value;
      option.textContent = opt.label;
      const selected = opt.value === selectedValue;
      option.style.cssText = baseOptionStyle() + (selected ? ' background: var(--focus-halo);' : '');
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
      if (i === idx) {
        el.style.background = 'var(--focus-halo)';
        el.scrollIntoView({ block: 'nearest' });
      } else if (el.dataset.value !== selectedValue) {
        el.style.background = '';
      }
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
    listbox.style.display = 'block';
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
    listbox.style.display = 'none';
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
    if (spaceBelow < 200 && rect.top > spaceBelow) {
      listbox.style.top = 'auto';
      listbox.style.bottom = '100%';
      listbox.style.marginTop = '0';
      listbox.style.marginBottom = '0.25rem';
    } else {
      listbox.style.top = '100%';
      listbox.style.bottom = 'auto';
      listbox.style.marginTop = '0.25rem';
      listbox.style.marginBottom = '0';
    }
  }

  /* Handlers nomeados para que destroy() consiga removê-los de verdade
     (removeEventListener exige a MESMA referência de função). */
  function handleTriggerClick(e) {
    e.stopPropagation();
    isOpen ? close() : open();
  }
  function handleTriggerFocus() {
    trigger.style.borderColor = 'var(--accent)';
    trigger.style.boxShadow = '0 0 0 3px var(--focus-halo)';
  }
  function handleTriggerBlur() {
    trigger.style.borderColor = '';
    trigger.style.boxShadow = '';
  }

  trigger.type = 'button';
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-autocomplete', 'none');
  trigger.setAttribute('aria-controls', listboxId);
  if (required) trigger.setAttribute('aria-required', 'true');
  if (name) trigger.dataset.name = name;
  trigger.style.cssText = `
    width: 100%; min-width: 0; min-height: 2.75rem; padding: 0.625rem 0.75rem;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-field); text-align: left;
    display: flex; align-items: center; justify-content: space-between;
    gap: 0.5rem; cursor: pointer; color: var(--ink); font: inherit;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  `;
  trigger.textContent = '';
  trigger.appendChild(labelSpan);
  const chevron = document.createElement('span');
  chevron.setAttribute('aria-hidden', 'true');
  chevron.innerHTML = '<svg width="12" height="8" viewBox="0 0 12 8" fill="none"><path d="M1 1l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  chevron.style.cssText = 'flex-shrink: 0; color: var(--ink-2); transition: transform 150ms ease;';
  trigger.appendChild(chevron);
  trigger.addEventListener('click', handleTriggerClick);
  trigger.addEventListener('focus', handleTriggerFocus);
  trigger.addEventListener('blur', handleTriggerBlur);
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
    trigger.style.opacity = '0.55';
    trigger.style.cursor = 'not-allowed';
    labelSpan.style.color = 'var(--ink-2)';
    close();
  }

  function enable() {
    trigger.disabled = false;
    trigger.style.opacity = '';
    trigger.style.cursor = 'pointer';
    labelSpan.style.color = '';
  }

  function destroy() {
    close();
    document.removeEventListener('keydown', onKeydown);
    trigger.removeEventListener('click', handleTriggerClick);
    trigger.removeEventListener('focus', handleTriggerFocus);
    trigger.removeEventListener('blur', handleTriggerBlur);
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
