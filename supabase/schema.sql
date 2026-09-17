-- ============================================================================
-- SCHEMA SUPABASE - GRADE HORARIA BSI (v2 - multi-instituicao)
-- Modelo: institutions > campuses > courses > subjects (catalogo) > classes (turma)
-- Aluno: profiles + grades + grade_subjects + student_classes (status/faltas)
-- Seguranca: trigger check_prerequisites() bloqueia matricula sem pre-requisito
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('admin', 'student');
CREATE TYPE day_of_week AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday');

-- ---------------------------------------------------------------------------
-- A. HIERARQUIA INSTITUCIONAL
-- ---------------------------------------------------------------------------
CREATE TABLE institutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    acronym TEXT NOT NULL UNIQUE,
    state TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE campuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    city TEXT,
    UNIQUE(institution_id, name)
);

CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campus_id UUID NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    UNIQUE(campus_id, name)
);

-- ---------------------------------------------------------------------------
-- Funcoes utilitarias
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- B. PROFILES
-- ---------------------------------------------------------------------------
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role user_role NOT NULL DEFAULT 'student',
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    avatar_url TEXT,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verifica admin sem disparar RLS (precisa existir DEPOIS de profiles)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---------------------------------------------------------------------------
-- C. SUBJECTS (disciplina base) vs CLASSES (turma real)
-- ---------------------------------------------------------------------------
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,             -- chave estavel p/ seed (uso interno)
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    workload_hours INTEGER NOT NULL DEFAULT 60 CHECK (workload_hours IN (30, 60, 90)),
    prerequisites UUID[] DEFAULT '{}',
    corequisites UUID[] DEFAULT '{}',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_subjects_updated_at
    BEFORE UPDATE ON subjects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    professor_name TEXT,
    semester INTEGER,
    schedule JSONB DEFAULT '{}',
    social_group_link TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subject_id, professor_name, semester)  -- chave natural p/ seed idempotente
);

CREATE TRIGGER update_classes_updated_at
    BEFORE UPDATE ON classes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- GRADES
-- ---------------------------------------------------------------------------
CREATE TABLE grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Minha Grade',
    semester INTEGER NOT NULL,
    year INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, semester, year, is_active)
);

CREATE TRIGGER update_grades_updated_at
    BEFORE UPDATE ON grades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE grade_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grade_id UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    day day_of_week NOT NULL,
    time_start TIME NOT NULL,
    time_end TIME NOT NULL,
    classroom TEXT,
    color TEXT DEFAULT '#3B82F6',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(grade_id, subject_id)
);

-- ---------------------------------------------------------------------------
-- D. STUDENT_CLASSES (vinculo aluno <-> turma: status, nota, faltas)
-- Faltas = apenas o contador 'absences' (horas-aula). A UI calcula o
-- limite de 25%: absences > 0.25 * subjects.workload_hours
-- ---------------------------------------------------------------------------
CREATE TABLE student_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grade_id UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'completed', 'dropped', 'pending')),
    final_grade NUMERIC(4,2),
    absences INTEGER NOT NULL DEFAULT 0 CHECK (absences >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(grade_id, class_id)
);

CREATE TRIGGER update_student_classes_updated_at
    BEFORE UPDATE ON student_classes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- TRIGGER DE SEGURANCA: bloqueia INSERT em student_classes sem pre-requisito
-- Pre-requisito cumprido = registro do MESMO aluno (qualquer grade) com
-- status='completed' numa turma da disciplina exigida.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_prerequisites()
RETURNS TRIGGER AS $$
DECLARE
    v_student_id UUID;
    v_subject_id UUID;
    v_missing TEXT[];
BEGIN
    SELECT student_id INTO v_student_id FROM grades WHERE id = NEW.grade_id;
    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Grade % nao encontrada', NEW.grade_id;
    END IF;

    SELECT subject_id INTO v_subject_id FROM classes WHERE id = NEW.class_id;
    IF v_subject_id IS NULL THEN
        RAISE EXCEPTION 'Turma % nao encontrada', NEW.class_id;
    END IF;

    SELECT array_agg(s.name) INTO v_missing
    FROM subjects s
    JOIN subjects target ON target.id = v_subject_id
    WHERE s.id = ANY(target.prerequisites)
      AND NOT EXISTS (
          SELECT 1
          FROM student_classes sc
          JOIN grades g  ON g.id  = sc.grade_id AND g.student_id = v_student_id
          JOIN classes c ON c.id = sc.class_id AND c.subject_id = s.id
          WHERE sc.status = 'completed'
      );

    IF v_missing IS NOT NULL AND array_length(v_missing, 1) > 0 THEN
        RAISE EXCEPTION 'Pre-requisitos nao cumpridos: %', array_to_string(v_missing, ', ')
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_check_prerequisites
    BEFORE INSERT ON student_classes
    FOR EACH ROW EXECUTE FUNCTION public.check_prerequisites();

-- Colegas de turma sem recursao de RLS
CREATE OR REPLACE FUNCTION public.shares_class(p_class_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM student_classes sc
        JOIN grades g ON g.id = sc.grade_id
        WHERE sc.class_id = p_class_id AND g.student_id = auth.uid()
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_classes ENABLE ROW LEVEL SECURITY;

-- Hierarquia institucional: leitura publica, escrita so admin
CREATE POLICY "Instituicoes publicas" ON institutions FOR SELECT USING (TRUE);
CREATE POLICY "Admin gerencia instituicoes" ON institutions FOR ALL USING (public.is_admin());
CREATE POLICY "Campi publicos" ON campuses FOR SELECT USING (TRUE);
CREATE POLICY "Admin gerencia campi" ON campuses FOR ALL USING (public.is_admin());
CREATE POLICY "Cursos publicos" ON courses FOR SELECT USING (TRUE);
CREATE POLICY "Admin gerencia cursos" ON courses FOR ALL USING (public.is_admin());

-- Perfis: publicos visiveis; cada um edita o seu
CREATE POLICY "Perfis visiveis" ON profiles FOR SELECT USING (is_public = TRUE OR id = auth.uid() OR public.is_admin());
CREATE POLICY "Usuario atualiza perfil" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin gerencia perfis" ON profiles FOR ALL USING (public.is_admin());

-- Catalogo e turmas: leitura publica, escrita so admin
CREATE POLICY "Materias publicas" ON subjects FOR SELECT USING (is_active = TRUE OR public.is_admin());
CREATE POLICY "Admin CRUD materias" ON subjects FOR ALL USING (public.is_admin());
CREATE POLICY "Turmas publicas" ON classes FOR SELECT USING (is_active = TRUE OR public.is_admin());
CREATE POLICY "Admin CRUD turmas" ON classes FOR ALL USING (public.is_admin());

-- Grades: dono ou publica
CREATE POLICY "Aluno ve grades" ON grades FOR SELECT USING (student_id = auth.uid() OR is_public = TRUE);
CREATE POLICY "Aluno gerencia grades" ON grades FOR ALL USING (student_id = auth.uid());
CREATE POLICY "Admin ve grades" ON grades FOR ALL USING (public.is_admin());

-- Blocos da grade: seguem a grade pai
CREATE POLICY "Grade subjects seguem grade" ON grade_subjects FOR SELECT USING (EXISTS (SELECT 1 FROM grades WHERE grades.id = grade_subjects.grade_id AND (grades.student_id = auth.uid() OR grades.is_public = TRUE)));
CREATE POLICY "Aluno gerencia grade_subjects" ON grade_subjects FOR ALL USING (EXISTS (SELECT 1 FROM grades WHERE grades.id = grade_subjects.grade_id AND grades.student_id = auth.uid()));
CREATE POLICY "Admin gerencia grade_subjects" ON grade_subjects FOR ALL USING (public.is_admin());

-- Vinculos: dono ou colega de turma
CREATE POLICY "Ver matriculas e colegas" ON student_classes FOR SELECT USING (
    EXISTS (SELECT 1 FROM grades WHERE grades.id = student_classes.grade_id AND grades.student_id = auth.uid())
    OR public.shares_class(student_classes.class_id)
);
CREATE POLICY "Aluno gerencia matriculas" ON student_classes FOR ALL USING (
    EXISTS (SELECT 1 FROM grades WHERE grades.id = student_classes.grade_id AND grades.student_id = auth.uid())
);
CREATE POLICY "Admin gerencia matriculas" ON student_classes FOR ALL USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- PERFIL AUTOMATICO NO SIGNUP
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name',
            CASE WHEN NEW.email = 'aphmgbr@gmail.com' THEN 'admin'::user_role ELSE 'student'::user_role END)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- REALTIME
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE subjects;
ALTER PUBLICATION supabase_realtime ADD TABLE classes;
ALTER PUBLICATION supabase_realtime ADD TABLE grades;
ALTER PUBLICATION supabase_realtime ADD TABLE grade_subjects;
ALTER PUBLICATION supabase_realtime ADD TABLE student_classes;

-- Seed real (instituicao/campus/curso + subjects + classes): `node seed_subjects.mjs`
