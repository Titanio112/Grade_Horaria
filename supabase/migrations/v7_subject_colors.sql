-- v7: cor algorítmica por matéria (subjects.color)
-- Gerada por supabase/generate_subject_colors.js (determinista, por curso).
-- Matérias-base (sem pré-requisito) recebem tons primários da paleta do curso;
-- derivadas herdam a família da cadeia de pré-requisitos (matiz rotacionado).
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS color text;

COMMENT ON COLUMN public.subjects.color IS
  'Cor hex (#RRGGBB) gerada por algoritmo por curso (ver supabase/generate_subject_colors.js). Não editar à mão.';

-- Só aceita hex válido (ou NULL até o gerador rodar)
ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_color_hex_check
  CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$');
