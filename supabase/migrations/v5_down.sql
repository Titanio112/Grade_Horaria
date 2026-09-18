-- ROLLBACK V5: volta 100% ao estado v4
-- (remove o que v5 criou, restaura grades.is_public e policies antigas)

-- realtime: remover novas
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['friendships','groups','group_members','notifications','reports'] LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE %I', t);
        EXCEPTION WHEN undefined_object OR undefined_table THEN NULL;
        END;
    END LOOP;
END $$;

-- triggers de emissao de notificacao
DROP TRIGGER IF EXISTS trg_class_changed ON classes;
DROP TRIGGER IF EXISTS trg_schedule_changed ON class_schedules;
DROP TRIGGER IF EXISTS trg_room_changed ON schedule_rooms;
DROP TRIGGER IF EXISTS trg_friendship_notify ON friendships;
DROP TRIGGER IF EXISTS update_friendships_updated_at ON friendships;
DROP TRIGGER IF EXISTS update_groups_updated_at ON groups;

-- restaura handle_new_user v4
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

-- grades: volta pra is_public boolean
ALTER TABLE grades ADD COLUMN is_public BOOLEAN DEFAULT FALSE;
UPDATE grades SET is_public = (visibility = 'public');
ALTER TABLE grades DROP COLUMN visibility;
DROP TYPE IF EXISTS grade_visibility;

-- profiles: remove colunas v5
ALTER TABLE profiles DROP COLUMN IF EXISTS friend_code;
ALTER TABLE profiles DROP COLUMN IF EXISTS color_preset;

-- policies antigas de volta (v4)
DROP POLICY IF EXISTS "Aluno ve grades" ON grades;
CREATE POLICY "Aluno ve grades" ON grades FOR SELECT USING (student_id = auth.uid() OR is_public = TRUE);

DROP POLICY IF EXISTS "Grade subjects seguem grade" ON grade_subjects;
CREATE POLICY "Grade subjects seguem grade" ON grade_subjects FOR SELECT USING (
    EXISTS (SELECT 1 FROM grades WHERE grades.id = grade_subjects.grade_id AND (grades.student_id = auth.uid() OR grades.is_public = TRUE))
);

-- policies do catalogo voltam pra is_admin()
DROP POLICY IF EXISTS "Admin gerencia instituicoes" ON institutions;
CREATE POLICY "Admin gerencia instituicoes" ON institutions FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Admin gerencia campi" ON campuses;
CREATE POLICY "Admin gerencia campi" ON campuses FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Admin gerencia cursos" ON courses;
CREATE POLICY "Admin gerencia cursos" ON courses FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Admin CRUD materias" ON subjects;
CREATE POLICY "Admin CRUD materias" ON subjects FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Admin CRUD professores" ON professors;
CREATE POLICY "Admin CRUD professores" ON professors FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Admin CRUD salas" ON rooms;
CREATE POLICY "Admin CRUD salas" ON rooms FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Admin CRUD turmas" ON classes;
CREATE POLICY "Admin CRUD turmas" ON classes FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Admin CRUD prof-turma" ON class_professors;
CREATE POLICY "Admin CRUD prof-turma" ON class_professors FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Admin CRUD horarios" ON class_schedules;
CREATE POLICY "Admin CRUD horarios" ON class_schedules FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Admin CRUD horario-sala" ON schedule_rooms;
CREATE POLICY "Admin CRUD horario-sala" ON schedule_rooms FOR ALL USING (public.is_admin());

-- is_admin() volta a olhar profiles.role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'); $$ LANGUAGE sql SECURITY DEFINER STABLE;

-- funcoes v5
DROP FUNCTION IF EXISTS public.trg_class_changed CASCADE;
DROP FUNCTION IF EXISTS public.trg_schedule_changed CASCADE;
DROP FUNCTION IF EXISTS public.trg_room_changed CASCADE;
DROP FUNCTION IF EXISTS public.trg_friendship_notify CASCADE;
DROP FUNCTION IF EXISTS public.notify_class_change CASCADE;
DROP FUNCTION IF EXISTS public.is_friend CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin CASCADE;
DROP FUNCTION IF EXISTS public.is_institution_admin CASCADE;
DROP FUNCTION IF EXISTS public.is_course_admin CASCADE;
DROP FUNCTION IF EXISTS public.grant_admin CASCADE;
DROP FUNCTION IF EXISTS public.lookup_profile_by_code CASCADE;

-- tabelas v5
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS admin_grants CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS friendships CASCADE;

DROP TYPE IF EXISTS admin_level;
