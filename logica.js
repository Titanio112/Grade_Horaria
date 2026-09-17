// logica.js — Business logic layer (ES Module)

import { 
  subjectsData, appState, defaultSubjectsData, subjectMap 
} from './dados.js';

// --- Constants ---
export const GRID_START_HOUR = 7;
export const GRID_END_HOUR = 23;
export const PIXELS_PER_HOUR = 60;
export const PIXELS_PER_MINUTE = PIXELS_PER_HOUR / 60;

// --- Pure helpers ---
export function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

export function timeToPixels(horarioStr) {
  const match = horarioStr.match(/(\w{3})\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
  if (!match) return { day: 'Seg', top: 0, height: 60 };
  
  const [, day, startStr, endStr] = match;
  const start = timeToMinutes(startStr);
  const end = timeToMinutes(endStr);
  const gridStart = GRID_START_HOUR * 60;
  
  const top = (start - gridStart) * PIXELS_PER_MINUTE;
  const height = (end - start) * PIXELS_PER_MINUTE;
  
  return { day, top, height };
}

export function findSubjectById(id) {
  for (const sem of subjectsData) {
    const found = sem.disciplinas.find(d => d.id === id);
    if (found) return found;
  }
  return null;
}

export function findSubjectByName(name) {
  for (const sem of subjectsData) {
    const found = sem.disciplinas.find(d => d.nome === name);
    if (found) return found;
  }
  return null;
}

export function getCorequisiteGroup(subject) {
  const group = [subject];
  if (subject.correquisitos) {
    for (const coreqId of subject.correquisitos) {
      const coreq = findSubjectById(coreqId);
      if (coreq && !group.some(s => s.id === coreq.id)) {
        group.push(coreq);
      }
    }
  }
  return group;
}

export function getActiveProfile() {
  return appState.profiles.find(p => p.id === appState.activeProfileId) || appState.profiles[0];
}

export function toggleSubject(subject) {
  const profile = getActiveProfile();
  
  // Verifica se está tentando selecionar (não deselecionar)
  const group = getCorequisiteGroup(subject);
  const allSelected = group.every(s => profile.selected.includes(s.nome));
  
  // Se está tentando SELECIONAR (não deselecionar), valida pré-requisitos
  if (!allSelected) {
    // Verifica pré-requisitos de todas as matérias do grupo
    for (const s of group) {
      if (s.requisitos && s.requisitos.length > 0) {
        const missingReqs = s.requisitos.filter(reqId => {
          const reqSubject = findSubjectById(reqId);
          return reqSubject && !profile.history.approved.includes(reqSubject.id);
        });
        
        if (missingReqs.length > 0) {
          const missingNames = missingReqs.map(reqId => {
            const req = findSubjectById(reqId);
            return req ? req.nome : reqId;
          }).join(', ');
          alert(`Pré-requisito pendente para "${s.nome}": ${missingNames}`);
          return false; // Bloqueia a seleção - retorna false
        }
      }
    }
  }

  // Se passou na validação ou está deselecionando, prossegue
  if (allSelected) {
    for (const s of group) {
      const idx = profile.selected.indexOf(s.nome);
      if (idx > -1) profile.selected.splice(idx, 1);
    }
  } else {
    for (const s of group) {
      if (!profile.selected.includes(s.nome)) {
        profile.selected.push(s.nome);
      }
    }
  }
  saveAppState();
  updateSchedule();
  return true; // Retorna true indicando que a seleção foi alterada
}

export function toggleHistoryStatus(id, element, name, profile) {
  const approvedSet = new Set(profile.history.approved);
  const failedSet = new Set(profile.history.failed);
  element.classList.remove('status-none', 'status-approved', 'status-failed');

  if (approvedSet.has(id)) {
    approvedSet.delete(id); failedSet.add(id);
    element.classList.add('status-failed');
    element.innerHTML = `<span>${name}</span> <span class="status-icon">🔴</span>`;
  } else if (failedSet.has(id)) {
    failedSet.delete(id);
    element.classList.add('status-none');
    element.innerHTML = `<span>${name}</span> <span class="status-icon">⚪</span>`;
  } else {
    approvedSet.add(id);
    element.classList.add('status-approved');
    element.innerHTML = `<span>${name}</span> <span class="status-icon">✅</span>`;
  }
  profile.history.approved = Array.from(approvedSet);
  profile.history.failed = Array.from(failedSet);
}

export function toggleDarkMode() {
  appState.darkMode = !appState.darkMode;
  document.body.classList.toggle('dark-mode', appState.darkMode);
  saveAppState();
}

export function toggleGroupMode() {
  appState.groupMode = !appState.groupMode;
  saveAppState();
}

export function saveAppState() {
  localStorage.setItem('gradeOrganizer_v2', JSON.stringify(appState));
}

export function loadAppState() {
  try {
    const saved = localStorage.getItem('gradeOrganizer_v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.assign(appState, parsed);
    }
  } catch (e) {
    console.error('Erro ao carregar estado:', e);
    Object.assign(appState, { profiles: [], activeProfileId: null, darkMode: false, groupMode: false });
  }
}

export function resetAllData() {
  const confirmed = confirm('Isso vai apagar TODOS os perfis, histórico e grades. Tem certeza absoluta?');
  if (confirmed) {
    localStorage.removeItem('gradeOrganizer_v2');
    location.reload();
  }
}

// --- Color helpers ---
export function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).substr(-2);
  }
  return color;
}

export function getUserColor(index) {
  const baseColors = [
    { bg: '#dbeafe', border: '#2563eb', text: '#1e40af' },
    { bg: '#fef3c7', border: '#d97706', text: '#92400e' },
    { bg: '#dcfce7', border: '#16a34a', text: '#166534' },
    { bg: '#fce7f3', border: '#db2777', text: '#9d174d' },
    { bg: '#e0e7ff', border: '#4f46e5', text: '#312e81' },
    { bg: '#fef9c3', border: '#ca8a04', text: '#854d0e' },
    { bg: '#fef2f2', border: '#dc2626', text: '#991b1b' },
    { bg: '#ecfdf5', border: '#059669', text: '#065f46' }
  ];
  if (index < baseColors.length) return baseColors[index];
  const color = stringToColor(String(index));
  return {
    bg: color + '33',
    border: color,
    text: color
  };
}

// --- Calendar Grid initialization ---
export function initCalendarGrid() {
  const timeLabels = document.getElementById('time-labels');
  const daysGrid = document.getElementById('days-grid');
  
  timeLabels.innerHTML = '';
  daysGrid.innerHTML = '';
  
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  
  for (let hour = GRID_START_HOUR; hour < GRID_END_HOUR; hour++) {
    const label = document.createElement('div');
    label.className = 'time-label';
    label.innerHTML = `<span>${hour}:00</span>`;
    timeLabels.appendChild(label);
  }
  
  days.forEach(day => {
    const col = document.createElement('div');
    col.className = 'day-column';
    col.dataset.day = day;
    
    const header = document.createElement('div');
    header.className = 'day-header';
    header.textContent = day;
    col.appendChild(header);
    
    for (let hour = GRID_START_HOUR; hour < GRID_END_HOUR; hour++) {
      const line = document.createElement('div');
      line.className = 'grid-line';
      col.appendChild(line);
    }
    
    daysGrid.appendChild(col);
  });
}

// --- Callback for real-time schedule updates ---
let _updateSchedule = () => {};

export function setUpdateSchedule(fn) {
  _updateSchedule = fn;
}

export function updateSchedule() {
  return _updateSchedule();
}