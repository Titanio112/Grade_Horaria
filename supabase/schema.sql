-- ============================================================================
-- SCHEMA SUPABASE - GRADE HORARIA COM ADMIN/ALUNO + REALTIME
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('admin', 'student');
CREATE TYPE day_of_week AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday');

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role user_role NOT NULL DEFAULT 'student',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    credits INTEGER NOT NULL DEFAULT 4,
    workload INTEGER NOT NULL DEFAULT 60,
    professor TEXT,
    semester INTEGER,
    prerequisites UUID[] DEFAULT '{}',
    corequisites UUID[] DEFAULT '{}',
    schedule JSONB DEFAULT '{}',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_subjects_updated_at
    BEFORE UPDATE ON subjects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

CREATE TABLE student_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    grade_id UUID REFERENCES grades(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'completed', 'dropped', 'pending')),
    final_grade NUMERIC(4,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, subject_id, grade_id)
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles visiveis" ON profiles FOR SELECT USING (TRUE);
CREATE POLICY "Usuario atualiza perfil" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin gerencia perfis" ON profiles FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Materias publicas" ON subjects FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admin CRUD materias" ON subjects FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Aluno ve grades" ON grades FOR SELECT USING (student_id = auth.uid() OR is_public = TRUE);
CREATE POLICY "Aluno gerencia grades" ON grades FOR ALL USING (student_id = auth.uid());
CREATE POLICY "Admin ve grades" ON grades FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Grade subjects seguem grade" ON grade_subjects FOR SELECT USING (EXISTS (SELECT 1 FROM grades WHERE grades.id = grade_subjects.grade_id AND (grades.student_id = auth.uid() OR grades.is_public = TRUE)));
CREATE POLICY "Aluno gerencia grade_subjects" ON grade_subjects FOR ALL USING (EXISTS (SELECT 1 FROM grades WHERE grades.id = grade_subjects.grade_id AND grades.student_id = auth.uid()));
CREATE POLICY "Admin gerencia grade_subjects" ON grade_subjects FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Ver matriculas e colegas" ON student_subjects FOR SELECT USING (student_id = auth.uid() OR subject_id IN (SELECT subject_id FROM student_subjects WHERE student_id = auth.uid()));
CREATE POLICY "Aluno gerencia matriculas" ON student_subjects FOR ALL USING (student_id = auth.uid());
CREATE POLICY "Admin gerencia matriculas" ON student_subjects FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', CASE WHEN NEW.email = 'aphmgbr@gmail.com' THEN 'admin' ELSE 'student' END)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE subjects;
ALTER PUBLICATION supabase_realtime ADD TABLE grades;
ALTER PUBLICATION supabase_realtime ADD TABLE grade_subjects;
ALTER PUBLICATION supabase_realtime ADD TABLE student_subjects;

-- Seed das materias reais: rodar `node seed_subjects.mjs` (extrai do ../dados.js)
-- Nao manter INSERTs hardcoded aqui.