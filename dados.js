// dados.js — Data layer (ES Module)

// --- Grid constants ---
export const GRID_START_HOUR = 7;
export const GRID_END_HOUR = 23;
export const PIXELS_PER_HOUR = 60;
export const PIXELS_PER_MINUTE = PIXELS_PER_HOUR / 60;

// --- Pure helpers ---
export function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// --- Raw curriculum data (NEVER modify during refactor) ---
export const defaultSubjectsData = [
  {
    "semestre": "1º Semestre",
    "disciplinas": [
      { "id": "metodologia", "nome": "Metodologia Científica", "professor": "Edilaine", "horarios": ["Seg 13:00-14:40"], "sala": "S309", "verificado": true },
      { "id": "ingles1", "nome": "Inglês Instrumental I", "professor": "Maria Beatriz", "horarios": ["Seg 14:40-16:40"], "sala": "N/A", "verificado": true, "civilNight": true },
      { "id": "leitura", "nome": "Leitura e Produção de Textos Acadêmicos", "professor": "Edilaine", "horarios": ["Seg 16:40-18:30"], "sala": "S309", "verificado": true, "civilNight": true },
      { "id": "contexto", "nome": "Contexto Social e Profissional do Bacharel em Sistemas de Informação", "professor": "Eduardo G.", "horarios": ["Ter 13:00-14:40"], "sala": "N/A", "verificado": true },
      { "id": "calc_fvr", "nome": "Cálculo com Funções de uma Variável Real", "professor": "Matemática", "horarios": ["Ter 14:40-16:40", "Qua 13:00-14:40", "Qui 16:40-18:30"], "sala": "S305", "verificado": true, "civilNight": true },
      { "id": "lab_prog", "nome": "Laboratório de Programação de Computadores I", "correquisitos": ["prog1"], "professor": "Weider/Marcelo", "horarios": ["Ter 16:40-18:30"], "sala": "S116/S114", "verificado": true, "civilNight": true },
      { "id": "gaal", "nome": "Geometria Analítica e Álgebra Linear", "professor": "Wélson", "horarios": ["Qui 13:00-14:40", "Sex 14:40-16:40"], "sala": "S305", "verificado": true },
      { "id": "prog1", "nome": "Programação de Computadores I", "correquisitos": ["lab_prog"], "professor": "Weider", "horarios": ["Qui 14:40-16:40"], "sala": "S305", "verificado": true, "civilNight": true }
    ]
  },
  {
    "semestre": "2º Semestre",
    "disciplinas": [
      { "id": "bd1", "nome": "Banco de Dados I", "correquisitos": ["lab_bd1"], "professor": "Deisymar", "horarios": ["Seg 13:00-14:40"], "sala": "S312", "verificado": true },
      { "id": "arq1", "nome": "Arquitetura e Organização de Computadores", "professor": "Novo Efetivo", "horarios": ["Seg 14:40-16:40", "Qui 13:00-14:40"], "sala": "S312", "verificado": true },
      { "id": "info_soc", "nome": "Informática e Sociedade", "professor": "Cristiano", "horarios": ["Seg 16:40-18:30"], "sala": "S312", "verificado": true },
      { "id": "lab_prog2", "nome": "Laboratório de Programação de Computadores II", "requisitos": ["prog1", "lab_prog"], "correquisitos": ["prog2"], "professor": "Eduardo/Weider", "horarios": ["Ter 14:40-16:40"], "sala": "S112", "verificado": true, "civilNight": true },
      { "id": "int_series", "nome": "Integração e Séries", "requisitos": ["calc_fvr"], "professor": "Nilton", "horarios": ["Ter 16:40-18:30", "Sex 16:40-18:30"], "sala": "S308", "verificado": true },
      { "id": "calc_vv1", "nome": "Cálculo com Funções de Várias Variáveis I", "requisitos": ["calc_fvr", "gaal"], "professor": "Wélson", "horarios": ["Qua 13:00-14:40", "Qui 14:40-16:40"], "sala": "S308", "verificado": true, "civilNight": true },
      { "id": "prog2", "nome": "Programação de Computadores II", "requisitos": ["prog1", "lab_prog"], "correquisitos": ["lab_prog2"], "professor": "Eduardo/Weider", "horarios": ["Qui 16:40-18:30"], "sala": "S308", "verificado": true },
      { "id": "lab_bd1", "nome": "Laboratório de Banco de Dados I", "correquisitos": ["bd1"], "professor": "Eduardo G.", "horarios": ["Sex 14:40-16:40"], "sala": "S312", "verificado": true }
    ]
  },
  {
    "semestre": "3º Semestre",
    "disciplinas": [
      { "id": "lab_prog3", "nome": "Laboratório de Programação de Computadores III", "requisitos": ["prog2", "lab_prog2"], "correquisitos": ["prog3"], "professor": "Douglas/Luiz", "horarios": ["Seg 13:00-14:40"], "sala": "S116", "verificado": true },
      { "id": "metodos_num", "nome": "Métodos Numéricos Computacionais", "requisitos": ["prog1", "lab_prog"], "professor": "Paulo M.", "horarios": ["Seg 14:40-16:40", "Ter 13:00-14:40"], "sala": "S314", "verificado": true, "civilNight": true },
      { "id": "sociologia", "nome": "Introdução à Sociologia", "professor": "Carlos", "horarios": ["Qui 13:00-14:40"], "sala": "S314", "verificado": true, "civilNight": true },
      { "id": "bd2", "nome": "Banco de Dados II", "requisitos": ["bd1", "lab_bd1"], "correquisitos": ["lab_bd2"], "professor": "Deisymar", "horarios": ["Ter 14:40-16:40"], "sala": "S314", "verificado": true },
      { "id": "algebra_lin", "nome": "Álgebra Linear", "requisitos": ["gaal"], "professor": "Matemática", "horarios": ["Ter 16:40-18:30", "Qui 14:40-16:40"], "sala": "S314", "verificado": true, "civilNight": true },
      { "id": "lab_bd2", "nome": "Laboratório de Banco de Dados II", "requisitos": ["bd1", "lab_bd1"], "correquisitos": ["bd2"], "professor": "Deisymar/Weider", "horarios": ["Sex 16:40-18:30"], "sala": "S108", "verificado": true },
      { "id": "edo", "nome": "Equações Diferenciais Ordinárias", "requisitos": ["calc_vv1", "int_series"], "professor": "Nilton", "horarios": ["Qua 13:00-14:40", "Sex 13:00-14:40"], "sala": "S314", "verificado": true, "civilNight": true },
      { "id": "prog3", "nome": "Programação de Computadores III", "requisitos": ["prog2", "lab_prog2"], "correquisitos": ["lab_prog3"], "professor": "Douglas", "horarios": ["Sex 14:40-16:40"], "sala": "S112", "verificado": true }
    ]
  },
  {
    "semestre": "4º Semestre",
    "disciplinas": [
      { "id": "so", "nome": "Sistemas Operacionais", "requisitos": ["arq1"], "professor": "Wanderson", "horarios": ["Seg 13:00-14:40", "Qui 16:40-18:30"], "sala": "S309", "verificado": true },
      { "id": "design", "nome": "Design de Interação", "professor": "Wanderson", "horarios": ["Seg 14:40-16:40", "Qui 13:00-14:40"], "sala": "S114", "verificado": true },
      { "id": "lab_eng_soft", "nome": "Laboratório de Engenharia de Software", "requisitos": ["prog1", "lab_prog"], "correquisitos": ["eng_soft"], "professor": "Deisymar", "horarios": ["Ter 13:00-14:40"], "sala": "S112", "verificado": true },
      { "id": "estatistica", "nome": "Estatística", "requisitos": ["int_series"], "professor": "Nilton", "horarios": ["Ter 14:40-16:40", "Sex 14:40-16:40"], "sala": "S309", "verificado": true, "civilNight": true },
      { "id": "lab_redes", "nome": "Laboratório de Redes de Computadores", "correquisitos": ["redes"], "professor": "Novo Efetivo", "horarios": ["Qua 13:00-14:40"], "sala": "S108", "verificado": true },
      { "id": "redes", "nome": "Redes de Computadores", "correquisitos": ["lab_redes", "so"], "professor": "Novo Efetivo", "horarios": ["Qui 14:40-16:40", "Sex 13:00-14:40"], "sala": "S309", "verificado": true },
      { "id": "eng_soft", "nome": "Engenharia de Software", "requisitos": ["prog1", "lab_prog"], "correquisitos": ["lab_eng_soft"], "professor": "Bruno", "horarios": ["Sex 16:40-18:30"], "sala": "S309", "verificado": true }
    ]
  },
  {
    "semestre": "5º Semestre",
    "disciplinas": [
      { "id": "ger_proj", "nome": "Gerenciamento de Projetos", "requisitos": ["eng_soft", "lab_eng_soft"], "correquisitos": ["lab_ger_proj"], "professor": "Wanderson", "horarios": ["Seg 13:00-14:40"], "sala": "S305", "verificado": true },
      { "id": "probabilidade", "nome": "Teoria da Probabilidade", "requisitos": ["estatistica"], "professor": "Nilton", "horarios": ["Ter 13:00-14:40", "Qui 13:00-14:40"], "sala": "S305", "verificado": true },
      { "id": "filosofia", "nome": "Filosofia da Tecnologia", "professor": "Paulo Bicalho", "horarios": ["Ter 14:40-16:40"], "sala": "S305", "verificado": true, "civilNight": true },
      { "id": "lab_prog_web", "nome": "Laboratório de Programação Web", "requisitos": ["prog3", "lab_prog3", "bd2", "lab_bd2"], "correquisitos": ["prog_web"], "professor": "Lázaro", "horarios": ["Ter 16:40-18:30", "Sex 13:00-14:40"], "sala": "S112/S114", "verificado": true },
      { "id": "lab_ger_proj", "nome": "Laboratório de Gerenciamento de Projetos", "requisitos": ["eng_soft", "lab_eng_soft"], "correquisitos": ["ger_proj"], "professor": "Wanderson", "horarios": ["Qua 13:00-14:40"], "sala": "S110", "verificado": true },
      { "id": "metodologia_pesq", "nome": "Metodologia da Pesquisa", "requisitos": ["metodologia"], "professor": "Eduardo G.", "horarios": ["Qui 14:40-16:40"], "sala": "S305", "verificado": true },
      { "id": "prog_web", "nome": "Programação Web", "requisitos": ["prog3", "lab_prog3", "bd2", "lab_bd2"], "correquisitos": ["lab_prog_web"], "professor": "Lázaro", "horarios": ["Qui 16:40-18:30"], "sala": "S305", "verificado": true },
      { "id": "prototipacao", "nome": "Introdução à Experimentação e ao Desenvolvimento de Protótipos e Projetos", "professor": "Eduardo G.", "horarios": ["Sex 09:00-10:40"], "sala": "S305", "verificado": true },
      { "id": "est_dados", "nome": "Estrutura de Dados", "requisitos": ["prog2", "lab_prog2"], "correquisitos": ["lab_est_dados"], "professor": "Luiz Flavio", "horarios": ["Sex 14:40-16:40"], "sala": "S305", "verificado": true },
      { "id": "lab_est_dados", "nome": "Laboratório de Estrutura de Dados", "requisitos": ["prog2", "lab_prog2"], "correquisitos": ["est_dados"], "professor": "Luiz Flavio", "horarios": ["Sex 16:40-18:30"], "sala": "S110", "verificado": true }
    ]
  },
  {
    "semestre": "6º Semestre",
    "disciplinas": [
      { "id": "emp1", "nome": "Empreendedorismo I", "professor": "Cristiano", "horarios": ["Seg 13:00-14:40", "Sex 14:40-16:40"], "sala": "S316", "verificado": true },
      { "id": "nuvem", "nome": "Computação em Nuvem", "requisitos": ["redes", "lab_redes"], "correquisitos": ["lab_nuvem"], "professor": "BP", "horarios": ["Seg 14:40-16:40"], "sala": "S316", "verificado": true },
      { "id": "ml", "nome": "Análise Multivariada", "requisitos": ["probabilidade"], "professor": "André", "horarios": ["Seg 16:40-18:30", "Ter 13:00-14:40"], "sala": "S110/S116", "verificado": true },
      { "id": "lab_mobile", "nome": "Laboratório de Desenvolvimento de Aplicações para Dispositivos Móveis", "requisitos": ["prog_web", "lab_prog_web"], "correquisitos": ["mobile"], "professor": "Lázaro", "horarios": ["Ter 14:40-16:40", "Sex 16:40-18:30"], "sala": "S116", "verificado": true },
      { "id": "lab_nuvem", "nome": "Laboratório de Computação em Nuvem", "requisitos": ["redes", "lab_redes"], "correquisitos": ["nuvem"], "professor": "BP", "horarios": ["Qua 13:00-14:40"], "sala": "S114", "verificado": true },
      { "id": "mobile", "nome": "Desenvolvimento de Aplicações para Dispositivos Móveis", "requisitos": ["prog_web", "lab_prog_web"], "correquisitos": ["lab_mobile"], "professor": "Lázaro", "horarios": ["Qui 13:00-14:40"], "verificado": true },
      { "id": "discreta", "nome": "Matemática Discreta", "requisitos": ["prog2", "lab_prog2", "probabilidade"], "professor": "Luiz Flavio", "horarios": ["Qui 14:40-16:40", "Sex 13:00-14:40"], "sala": "S316", "verificado": true }
    ]
  },
  {
    "semestre": "7º Semestre",
    "disciplinas": [
      { "id": "lab_mineracao", "nome": "Laboratório de Mineração de Dados", "requisitos": ["est_dados", "bd2"], "correquisitos": ["mineracao"], "professor": "BP", "horarios": ["Seg 13:00-14:40"], "sala": "S110", "verificado": true },
      { "id": "emp2", "nome": "Empreendedorismo II", "requisitos": ["emp1"], "professor": "Cristiano", "horarios": ["Seg 14:40-16:40", "Ter 15:30-17:20"], "sala": "S112", "verificado": true },
      { "id": "lab_ling_prog", "nome": "Laboratório de Linguagens de Programação", "requisitos": ["prog2", "lab_prog2"], "correquisitos": ["ling_prog"], "professor": "Novo Efetivo 2", "horarios": ["Seg 16:40-18:30"], "sala": "S116", "verificado": true },
      { "id": "econ", "nome": "Engenharia Econômica", "professor": "BP", "horarios": ["Ter 13:00-15:30"], "sala": "S316", "verificado": true },
      { "id": "iai", "nome": "Inteligência Artificial I", "requisitos": ["est_dados", "lab_est_dados", "ml"], "correquisitos": ["lab_iai"], "professor": "Lázaro/Marcelo", "horarios": ["Qua 13:00-14:40", "Sex 14:40-16:40"], "sala": "S305", "verificado": true },
      { "id": "mineracao", "nome": "Mineração de Dados", "requisitos": ["est_dados", "lab_est_dados", "bd2", "lab_bd2"], "correquisitos": ["lab_mineracao"], "professor": "BP", "horarios": ["Qui 13:00-14:40"], "sala": "S305", "verificado": true },
      { "id": "lab_iai", "nome": "Laboratório de Inteligência Artificial I", "requisitos": ["est_dados", "lab_est_dados", "ml"], "correquisitos": ["iai"], "professor": "Lázaro/Marcelo", "horarios": ["Qui 14:40-16:40"], "sala": "S114", "verificado": true },
      { "id": "ling_prog", "nome": "Linguagens de Programação", "requisitos": ["prog2", "lab_prog2"], "correquisitos": ["lab_ling_prog"], "professor": "Novo Efetivo 2", "horarios": ["Sex 13:00-14:40"], "sala": "S305", "verificado": true }
    ]
  },
  {
    "semestre": "8º Semestre",
    "disciplinas": [
      { "id": "sist_info", "nome": "Sistemas de Informação", "correquisitos": ["seguranca_aud"], "professor": "Wanderson", "horarios": ["Seg 13:00-14:40", "Ter 14:40-16:40"], "sala": "S302", "verificado": true },
      { "id": "gestao_ti", "nome": "Gestão de TI", "correquisitos": ["sist_info"], "professor": "Wanderson", "horarios": ["Seg 14:40-16:40", "Ter 13:00-14:40"], "sala": "S302", "verificado": true },
      { "id": "lab_cien_dados", "nome": "Laboratório de Ciência de Dados", "requisitos": ["mineracao", "lab_mineracao", "ml"], "correquisitos": ["cien_dados"], "professor": "Bruno Perillo", "horarios": ["Seg 16:40-18:30"], "sala": "S114", "verificado": true },
      { "id": "gest_tec_seg", "nome": "Seminários de SI", "professor": "Eduardo G.", "horarios": ["Qua 14:40-16:40"], "verificado": true },
      { "id": "iaii", "nome": "Inteligência Artificial II", "requisitos": ["iai", "lab_iai"], "correquisitos": ["lab_iaii"], "professor": "Douglas", "horarios": ["Qua 13:00-14:40", "Sex 16:40-18:30"], "verificado": true },
      { "id": "lab_iaii", "nome": "Laboratório de Inteligência Artificial II", "requisitos": ["iai", "lab_iai"], "correquisitos": ["iaii"], "professor": "Douglas", "horarios": ["Qui 13:00-14:40"], "sala": "S112", "verificado": true },
      { "id": "cien_dados", "nome": "Ciência de Dados", "requisitos": ["mineracao", "lab_mineracao", "ml"], "correquisitos": ["lab_cien_dados"], "professor": "Bruno Perillo", "horarios": ["Qui 14:40-16:40"], "sala": "S305", "verificado": true },
      { "id": "psic_organ", "nome": "Psicologia Aplicada às Organizações", "professor": "Evelyn", "horarios": ["Qui 16:40-18:30"], "verificado": true, "civilNight": true },
      { "id": "seguranca_aud", "nome": "Segurança e Auditoria de Sistemas", "correquisitos": ["gestao_ti"], "professor": "João Carlos", "horarios": ["Sex 14:40-16:40"], "verificado": true }
    ]
  }
];

// --- Mutable runtime state (shared reference across modules) ---
export let subjectsData = JSON.parse(JSON.stringify(defaultSubjectsData));

export let appState = {
  profiles: [],
  activeProfileId: null,
  darkMode: false,
  groupMode: false
};

// --- Subject lookup map (built once) ---
export const subjectMap = new Map();
defaultSubjectsData.forEach(sem => sem.disciplinas.forEach(d => subjectMap.set(d.id, d.nome)));

// --- Lookup helper ---
export function findSubjectById(id) {
  for (const sem of subjectsData) {
    const found = sem.disciplinas.find(d => d.id === id);
    if (found) return found;
  }
  return null;
}