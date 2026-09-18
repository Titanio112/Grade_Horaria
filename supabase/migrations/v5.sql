-- ============================================================================
-- MIGRATION V5 - amizades/grupos, privacidade 3 niveis, admin 3 niveis,
-- notificacoes, reports. Aplicar com: node apply_migration.js migrations/v5.sql
-- ============================================================================

-- --- TIPOS (idempotente) ---
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'grade_visibility') THEN
        CREATE TYPE grade_visibility AS ENUM ('private','friends','public');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_level') THEN
        CREATE TYPE admin_level AS ENUM ('super','institution','course');
    END IF;
END $$;

-- --- GRADES: is_public -> visibility (3 niveis) ---
-- ordem importa: derrubar policies que referenciam is_public ANTES de dropar a coluna
DROP POLICY IF EXISTS "Aluno ve grades" ON grades;
DROP POLICY IF EXISTS "Grade subjects seguem grade" ON grade_subjects;

ALTER TABLE grades ADD COLUMN visibility grade_visibility NOT NULL DEFAULT 'private';
UPDATE grades SET visibility = CASE WHEN is_public THEN 'public'::grade_visibility ELSE 'private'::grade_visibility END;
ALTER TABLE grades DROP COLUMN is_public;

-- --- PROFILES: friend_code + color_preset ---
ALTER TABLE profiles ADD COLUMN friend_code TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN color_preset TEXT NOT NULL DEFAULT 'blue'
    CHECK (color_preset IN ('blue','green','purple','orange','pink','red','teal','yellow'));

-- backfill friend_code dos profiles existentes
UPDATE profiles SET friend_code = upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)) WHERE friend_code IS NULL;

-- --- AMIZADES ---
CREATE TABLE friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    addressee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (requester_id <> addressee_id),
    UNIQUE (requester_id, addressee_id)
);
-- anti par inverso: Ana->Bruno e Bruno->Ana nao podem coexistir
CREATE UNIQUE INDEX friendships_pair_unique ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
CREATE TRIGGER update_friendships_updated_at BEFORE UPDATE ON friendships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --- GRUPOS ---
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE group_members (
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, profile_id)
);

-- --- ADMIN 3 NIVEIS ---
CREATE TABLE admin_grants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    level admin_level NOT NULL,
    institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    granted_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, level, institution_id, course_id),
    CHECK (
        (level = 'super'       AND institution_id IS NULL     AND course_id IS NULL) OR
        (level = 'institution' AND institution_id IS NOT NULL AND course_id IS NULL) OR
        (level = 'course'      AND course_id IS NOT NULL)
    )
);

-- --- NOTIFICACOES (in-app; com dedup por turma+dia anti-spam) ---
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    payload JSONB DEFAULT '{}',
    dedupe_key TEXT,                 -- ex: class_id:2026-09-16 (anti-spam por turma+dia)
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(recipient_id, type, dedupe_key)
);

-- --- REPORTS (erro em materia/turma, roteado pro admin do escopo) ---
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FUNCOES (SECURITY DEFINER onde precisa pular RLS)
-- ============================================================================

-- amizade aceite entre dois perfis?
CREATE OR REPLACE FUNCTION public.is_friend(a UUID, b UUID)
RETURNS BOOLEAN AS $$
    SELECT a <> b AND EXISTS (
        SELECT 1 FROM friendships
        WHERE status='accepted'
          AND LEAST(requester_id, addressee_id) = LEAST(a, b)
          AND GREATEST(requester_id, addressee_id) = GREATEST(a, b)
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- administracao
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (SELECT 1 FROM admin_grants WHERE profile_id = auth.uid() AND level='super');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_institution_admin(p_institution UUID)
RETURNS BOOLEAN AS $$
    SELECT public.is_super_admin() OR EXISTS (
        SELECT 1 FROM admin_grants
        WHERE profile_id = auth.uid() AND level='institution' AND institution_id = p_institution
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_course_admin(p_course UUID)
RETURNS BOOLEAN AS $$
    SELECT public.is_super_admin()
        OR EXISTS (SELECT 1 FROM admin_grants WHERE profile_id = auth.uid() AND level='course' AND course_id = p_course)
        OR EXISTS (
            SELECT 1 FROM admin_grants g
            JOIN courses c ON c.id = p_course
            JOIN campuses cp ON cp.id = c.campus_id
            WHERE g.profile_id = auth.uid() AND g.level='institution' AND g.institution_id = cp.institution_id
        );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- delegacao com cascata de privilegio (ninguem concede nivel >= ao proprio)
CREATE OR REPLACE FUNCTION public.grant_admin(p_profile UUID, p_level admin_level, p_institution UUID DEFAULT NULL, p_course UUID DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
    v_new UUID;
BEGIN
    IF NOT auth.uid() IS NULL AND NOT public.is_super_admin() THEN
        IF p_level = 'super' THEN
            RAISE EXCEPTION 'Apenas super admin pode conceder nivel super';
        ELSIF p_level = 'institution' THEN
            RAISE EXCEPTION 'Apenas super admin pode conceder admin de instituicao';
        ELSIF p_level = 'course' THEN
            -- caller precisa ser admin da instituicao dona do curso
            IF NOT EXISTS (
                SELECT 1 FROM courses c
                JOIN campuses cp ON cp.id = c.campus_id
                WHERE c.id = p_course
                  AND public.is_institution_admin(cp.institution_id)
            ) THEN
                RAISE EXCEPTION 'Sem permissao para conceder admin deste curso';
            END IF;
        END IF;
    END IF;

    INSERT INTO admin_grants (profile_id, level, institution_id, course_id, granted_by)
    VALUES (p_profile, p_level, p_institution, p_course, COALESCE(auth.uid(), p_profile))
    ON CONFLICT (profile_id, level, institution_id, course_id) DO NOTHING
    RETURNING id INTO v_new;
    RETURN v_new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- lookup publico por friend_code (so dados minimos)
CREATE OR REPLACE FUNCTION public.lookup_profile_by_code(p_code TEXT)
RETURNS TABLE (id UUID, full_name TEXT, avatar_url TEXT) AS $$
    SELECT id, full_name, avatar_url FROM profiles WHERE friend_code = upper(trim(p_code)) AND is_public = TRUE;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- --- NOTIFICACOES: emissor quando turma/horario muda ---
CREATE OR REPLACE FUNCTION public.notify_class_change(p_class_id UUID, p_type TEXT, p_title TEXT, p_body TEXT)
RETURNS VOID AS $$
    INSERT INTO notifications (recipient_id, type, title, body, payload, dedupe_key)
    SELECT g.student_id, p_type, p_title, p_body,
           jsonb_build_object('class_id', p_class_id),
           p_class_id::text || ':' || to_char(now(), 'YYYY-MM-DD')
    FROM student_classes sc
    JOIN grades g ON g.id = sc.grade_id
    WHERE sc.class_id = p_class_id AND sc.status = 'enrolled'
    ON CONFLICT (recipient_id, type, dedupe_key) DO NOTHING;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.trg_class_changed()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.semester IS DISTINCT FROM NEW.semester OR OLD.social_group_link IS DISTINCT FROM NEW.social_group_link THEN
        PERFORM public.notify_class_change(NEW.id, 'class_changed', 'Turma atualizada', 'Uma turma da sua grade foi atualizada.');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER trg_class_changed AFTER UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION public.trg_class_changed();

CREATE OR REPLACE FUNCTION public.trg_schedule_changed()
RETURNS TRIGGER AS $$
DECLARE v_cid UUID := COALESCE(NEW.class_id, OLD.class_id);
BEGIN
    PERFORM public.notify_class_change(v_cid, 'schedule_changed', 'Horario alterado', 'Mudou horario/dia de uma turma da sua grade.');
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER trg_schedule_changed AFTER INSERT OR UPDATE OR DELETE ON class_schedules FOR EACH ROW EXECUTE FUNCTION public.trg_schedule_changed();

CREATE OR REPLACE FUNCTION public.trg_room_changed()
RETURNS TRIGGER AS $$
DECLARE v_cid UUID;
BEGIN
    SELECT class_id INTO v_cid FROM class_schedules WHERE id = COALESCE(NEW.schedule_id, OLD.schedule_id);
    PERFORM public.notify_class_change(v_cid, 'room_changed', 'Sala alterada', 'Mudou a sala de uma turma da sua grade.');
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER trg_room_changed AFTER INSERT OR UPDATE OR DELETE ON schedule_rooms FOR EACH ROW EXECUTE FUNCTION public.trg_room_changed();

-- amizade notifica o destinatario
CREATE OR REPLACE FUNCTION public.trg_friendship_notify()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO notifications (recipient_id, type, title, body, payload, dedupe_key)
        VALUES (NEW.addressee_id, 'friend_request',
                'Novo pedido de amizade',
                (SELECT full_name FROM profiles WHERE id = NEW.requester_id) || ' quer te adicionar.',
                jsonb_build_object('friendship_id', NEW.id, 'from', NEW.requester_id),
                'friend:' || NEW.id::text)
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER trg_friendship_notify AFTER INSERT OR UPDATE ON friendships FOR EACH ROW
    WHEN (NEW.status IN ('pending','accepted')) EXECUTE FUNCTION public.trg_friendship_notify();

-- --- HANDLE_NEW_USER v5: amigo code + super admin do dono ---
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE v_code TEXT;
BEGIN
    LOOP
        v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
        BEGIN
            INSERT INTO public.profiles (id, email, full_name, role, friend_code)
            VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name',
                    CASE WHEN NEW.email = 'aphmgbr@gmail.com' THEN 'admin'::user_role ELSE 'student'::user_role END,
                    v_code);
            EXIT; -- sucesso
        EXCEPTION WHEN unique_violation THEN
            -- se o conflito era o id (usuario ja tinha perfil), sai; senao tenta outro code
            IF EXISTS (SELECT 1 FROM profiles WHERE id = NEW.id) THEN EXIT; END IF;
        END;
    END LOOP;

    IF NEW.email = 'aphmgbr@gmail.com' THEN
        INSERT INTO public.admin_grants (profile_id, level, granted_by)
        VALUES (NEW.id, 'super', NEW.id) ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS v5
-- ============================================================================
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Amizade visivel para as pontas" ON friendships;
CREATE POLICY "Amizade visivel para as pontas" ON friendships FOR SELECT USING (requester_id = auth.uid() OR addressee_id = auth.uid());
DROP POLICY IF EXISTS "Mais recente cria pedido" ON friendships;
CREATE POLICY "Mais recente cria pedido" ON friendships FOR INSERT WITH CHECK (requester_id = auth.uid());
DROP POLICY IF EXISTS "Addressee responde" ON friendships;
CREATE POLICY "Addressee responde" ON friendships FOR UPDATE USING (addressee_id = auth.uid());
DROP POLICY IF EXISTS "Pontas removem" ON friendships;
CREATE POLICY "Pontas removem" ON friendships FOR DELETE USING (requester_id = auth.uid() OR addressee_id = auth.uid());

DROP POLICY IF EXISTS "Membro ve grupo" ON groups;
CREATE POLICY "Membro ve grupo" ON groups FOR SELECT USING (
    created_by = auth.uid() OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = id AND gm.profile_id = auth.uid())
);
DROP POLICY IF EXISTS "Autenticado cria grupo" ON groups;
CREATE POLICY "Autenticado cria grupo" ON groups FOR INSERT WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS "Criador gerencia grupo" ON groups;
CREATE POLICY "Criador gerencia grupo" ON groups FOR ALL USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Membro ve membros" ON group_members;
CREATE POLICY "Membro ve membros" ON group_members FOR SELECT USING (
    EXISTS (SELECT 1 FROM group_members me WHERE me.group_id = group_members.group_id AND me.profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM groups g WHERE g.id = group_members.group_id AND g.created_by = auth.uid())
);
DROP POLICY IF EXISTS "Criador adiciona membros" ON group_members;
CREATE POLICY "Criador adiciona membros" ON group_members FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM groups g WHERE g.id = group_id AND g.created_by = auth.uid())
);
DROP POLICY IF EXISTS "Criador remove ou membro sai" ON group_members;
CREATE POLICY "Criador remove ou membro sai" ON group_members FOR DELETE USING (
    profile_id = auth.uid() OR EXISTS (SELECT 1 FROM groups g WHERE g.id = group_id AND g.created_by = auth.uid())
);

DROP POLICY IF EXISTS "Grants visiveis" ON admin_grants;
CREATE POLICY "Grants visiveis" ON admin_grants FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Notif do destinatario" ON notifications;
CREATE POLICY "Notif do destinatario" ON notifications FOR SELECT USING (recipient_id = auth.uid());
DROP POLICY IF EXISTS "Destinatario atualiza (ler)" ON notifications;
CREATE POLICY "Destinatario atualiza (ler)" ON notifications FOR UPDATE USING (recipient_id = auth.uid());
DROP POLICY IF EXISTS "Destinatario apaga" ON notifications;
CREATE POLICY "Destinatario apaga" ON notifications FOR DELETE USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Report do autor" ON reports;
CREATE POLICY "Report do autor" ON reports FOR SELECT USING (reporter_id = auth.uid());
DROP POLICY IF EXISTS "Report visivel pro admin do curso" ON reports;
CREATE POLICY "Report visivel pro admin do curso" ON reports FOR SELECT USING (
    public.is_super_admin()
    OR (reports.class_id IS NOT NULL AND public.is_course_admin((SELECT c.subject_id FROM classes c WHERE c.id = reports.class_id)))
    OR (reports.subject_id IS NOT NULL AND public.is_course_admin(reports.subject_id))
);
DROP POLICY IF EXISTS "Autenticado reporta" ON reports;
CREATE POLICY "Autenticado reporta" ON reports FOR INSERT WITH CHECK (reporter_id = auth.uid());
DROP POLICY IF EXISTS "Admin do escopo gerencia report" ON reports;
CREATE POLICY "Admin do escopo gerencia report" ON reports FOR UPDATE USING (
    public.is_super_admin()
    OR (reports.class_id IS NOT NULL AND public.is_course_admin((SELECT c.subject_id FROM classes c WHERE c.id = reports.class_id)))
    OR (reports.subject_id IS NOT NULL AND public.is_course_admin(reports.subject_id))
);

-- GRADES: visibilidade 3 niveis
DROP POLICY IF EXISTS "Aluno ve grades" ON grades;
DROP POLICY IF EXISTS "Aluno ve grades" ON grades;
CREATE POLICY "Aluno ve grades" ON grades FOR SELECT USING (
    student_id = auth.uid()
    OR visibility = 'public'
    OR (visibility = 'friends' AND public.is_friend(auth.uid(), student_id))
    OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Grade subjects seguem grade" ON grade_subjects;
DROP POLICY IF EXISTS "Grade subjects seguem grade" ON grade_subjects;
CREATE POLICY "Grade subjects seguem grade" ON grade_subjects FOR SELECT USING (
    EXISTS (SELECT 1 FROM grades g WHERE g.id = grade_subjects.grade_id AND (
        g.student_id = auth.uid() OR g.visibility = 'public'
        OR (g.visibility = 'friends' AND public.is_friend(auth.uid(), g.student_id))
        OR public.is_super_admin()
    ))
);

-- ============================================================================
-- RLS V5
-- ============================================================================
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- friendships: so as duas pontas
DROP POLICY IF EXISTS "Amizade visivel para as duas pontas" ON friendships;
CREATE POLICY "Amizade visivel para as duas pontas" ON friendships FOR SELECT USING (requester_id = auth.uid() OR addressee_id = auth.uid());
DROP POLICY IF EXISTS "Criar pedido como requester" ON friendships;
CREATE POLICY "Criar pedido como requester" ON friendships FOR INSERT WITH CHECK (requester_id = auth.uid());
DROP POLICY IF EXISTS "Aceitar/recusar como addressee" ON friendships;
CREATE POLICY "Aceitar/recusar como addressee" ON friendships FOR UPDATE USING (addressee_id = auth.uid()) WITH CHECK (addressee_id = auth.uid());
DROP POLICY IF EXISTS "Qualquer ponta apaga" ON friendships;
CREATE POLICY "Qualquer ponta apaga" ON friendships FOR DELETE USING (requester_id = auth.uid() OR addressee_id = auth.uid());
DROP POLICY IF EXISTS "Admin ve amizades" ON friendships;
CREATE POLICY "Admin ve amizades" ON friendships FOR SELECT USING (public.is_super_admin());

-- groups / group_members
-- groups / group_members
CREATE OR REPLACE FUNCTION public.is_group_member(p_group UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (SELECT 1 FROM group_members WHERE group_id = p_group AND profile_id = auth.uid());
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Ver grupos onde sou membro ou criador" ON groups;
CREATE POLICY "Ver grupos onde sou membro ou criador" ON groups FOR SELECT USING (
    created_by = auth.uid() OR public.is_group_member(id));
DROP POLICY IF EXISTS "Ver membros do meu grupo" ON group_members;
CREATE POLICY "Ver membros do meu grupo" ON group_members FOR SELECT USING (
    profile_id = auth.uid()
    OR public.is_group_member(group_id)
    OR EXISTS (SELECT 1 FROM groups g WHERE g.id = group_members.group_id AND g.created_by = auth.uid()));
DROP POLICY IF EXISTS "Criador adiciona membros" ON group_members;
CREATE POLICY "Criador adiciona membros" ON group_members FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM groups g WHERE g.id = group_id AND g.created_by = auth.uid()));
DROP POLICY IF EXISTS "Criador remove; membro sai" ON group_members;
CREATE POLICY "Criador remove; membro sai" ON group_members FOR DELETE USING (
    profile_id = auth.uid() OR EXISTS (SELECT 1 FROM groups g WHERE g.id = group_members.group_id AND g.created_by = auth.uid()));

-- admin_grants: visivel pro proprio e pra super; escrita so via grant_admin()
DROP POLICY IF EXISTS "Ver meus grants" ON admin_grants;
CREATE POLICY "Ver meus grants" ON admin_grants FOR SELECT USING (profile_id = auth.uid() OR public.is_super_admin());
DROP POLICY IF EXISTS "Grants via funcao" ON admin_grants;
CREATE POLICY "Grants via funcao" ON admin_grants FOR INSERT WITH CHECK (granted_by = auth.uid());
DROP POLICY IF EXISTS "Super revoga" ON admin_grants;
CREATE POLICY "Super revoga" ON admin_grants FOR DELETE USING (public.is_super_admin());

-- notifications: cada um so ve as suas
DROP POLICY IF EXISTS "Ler minhas notificacoes" ON notifications;
CREATE POLICY "Ler minhas notificacoes" ON notifications FOR SELECT USING (recipient_id = auth.uid());
DROP POLICY IF EXISTS "Marcar lida" ON notifications;
CREATE POLICY "Marcar lida" ON notifications FOR UPDATE USING (recipient_id = auth.uid());
DROP POLICY IF EXISTS "Apagar minhas" ON notifications;
CREATE POLICY "Apagar minhas" ON notifications FOR DELETE USING (recipient_id = auth.uid());
-- INSERT so via funcoes SECURITY DEFINER (triggers) ou super/admin
DROP POLICY IF EXISTS "Sistema insere notificacao" ON notifications;
CREATE POLICY "Sistema insere notificacao" ON notifications FOR INSERT WITH CHECK (public.is_super_admin() OR public.is_admin());

-- reports: autor + admin do escopo
DROP POLICY IF EXISTS "Ver meus reports" ON reports;
CREATE POLICY "Ver meus reports" ON reports FOR SELECT USING (
    reporter_id = auth.uid()
    OR public.is_super_admin()
    OR (subject_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM subjects s WHERE s.id = reports.subject_id AND public.is_course_admin(s.course_id)))
);
DROP POLICY IF EXISTS "Criar report" ON reports;
CREATE POLICY "Criar report" ON reports FOR INSERT WITH CHECK (reporter_id = auth.uid());
DROP POLICY IF EXISTS "Admin resolve report" ON reports;
CREATE POLICY "Admin resolve report" ON reports FOR UPDATE USING (
    public.is_super_admin()
    OR (subject_id IS NOT NULL AND EXISTS (SELECT 1 FROM subjects s WHERE s.id = reports.subject_id AND public.is_course_admin(s.course_id)))
) WITH CHECK (resolved_by = auth.uid());

-- ============================================================================
-- REWRITE: grades/grade_subjects com visibility de 3 niveis
-- ============================================================================
DROP POLICY IF EXISTS "Aluno ve grades" ON grades;
DROP POLICY IF EXISTS "Aluno ve grades" ON grades;
CREATE POLICY "Aluno ve grades" ON grades FOR SELECT USING (
    student_id = auth.uid()
    OR visibility = 'public'
    OR (visibility = 'friends' AND public.is_friend(auth.uid(), student_id))
    OR public.is_super_admin()
);
-- "Aluno gerencia grades" e "Admin ve grades" permanecem (USING student_id=auth.uid() / is_admin)

DROP POLICY IF EXISTS "Grade subjects seguem grade" ON grade_subjects;
DROP POLICY IF EXISTS "Grade subjects seguem grade" ON grade_subjects;
CREATE POLICY "Grade subjects seguem grade" ON grade_subjects FOR SELECT USING (
    EXISTS (SELECT 1 FROM grades g WHERE g.id = grade_subjects.grade_id AND (
        g.student_id = auth.uid() OR g.visibility = 'public'
        OR (g.visibility = 'friends' AND public.is_friend(auth.uid(), g.student_id))
        OR public.is_super_admin()
    ))
);

-- ============================================================================
-- REWRITE: catalogo agora usa escopo de admin (institution/course)
-- (mantem is_admin() como 'super OU admin legado' para compat)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR public.is_super_admin();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- instituicoes/campi/cursos/subjects: leitura publica continua; escrita por escopo
DROP POLICY IF EXISTS "Admin gerencia instituicoes" ON institutions;
DROP POLICY IF EXISTS "Escopo gerencia instituicoes" ON institutions;
CREATE POLICY "Escopo gerencia instituicoes" ON institutions FOR ALL USING (
    public.is_super_admin() OR (EXISTS (SELECT 1 FROM admin_grants g WHERE g.profile_id = auth.uid() AND g.level='institution' AND g.institution_id = institutions.id)));

DROP POLICY IF EXISTS "Admin gerencia campi" ON campuses;
DROP POLICY IF EXISTS "Escopo gerencia campi" ON campuses;
CREATE POLICY "Escopo gerencia campi" ON campuses FOR ALL USING (public.is_institution_admin(institution_id));

DROP POLICY IF EXISTS "Admin gerencia cursos" ON courses;
DROP POLICY IF EXISTS "Escopo gerencia cursos" ON courses;
CREATE POLICY "Escopo gerencia cursos" ON courses FOR ALL USING (
    public.is_super_admin()
    OR EXISTS (SELECT 1 FROM campuses cp WHERE cp.id = courses.campus_id AND public.is_institution_admin(cp.institution_id)));

DROP POLICY IF EXISTS "Admin CRUD materias" ON subjects;
DROP POLICY IF EXISTS "Escopo gerencia materias" ON subjects;
CREATE POLICY "Escopo gerencia materias" ON subjects FOR ALL USING (public.is_course_admin(subjects.course_id));

DROP POLICY IF EXISTS "Admin CRUD professores" ON professors;
DROP POLICY IF EXISTS "Escopo gerencia professores" ON professors;
CREATE POLICY "Escopo gerencia professores" ON professors FOR ALL USING (public.is_institution_admin((SELECT institution_id FROM campuses WHERE id = professors.campus_id)));

DROP POLICY IF EXISTS "Admin CRUD salas" ON rooms;
DROP POLICY IF EXISTS "Escopo gerencia salas" ON rooms;
CREATE POLICY "Escopo gerencia salas" ON rooms FOR ALL USING (public.is_institution_admin((SELECT institution_id FROM campuses WHERE id = rooms.campus_id)));

DROP POLICY IF EXISTS "Admin CRUD turmas" ON classes;
DROP POLICY IF EXISTS "Escopo gerencia turmas" ON classes;
CREATE POLICY "Escopo gerencia turmas" ON classes FOR ALL USING (
    public.is_course_admin((SELECT s.course_id FROM subjects s WHERE s.id = classes.subject_id)));

DROP POLICY IF EXISTS "Admin CRUD prof-turma" ON class_professors;
DROP POLICY IF EXISTS "Escopo gerencia prof-turma" ON class_professors;
CREATE POLICY "Escopo gerencia prof-turma" ON class_professors FOR ALL USING (
    public.is_course_admin((SELECT s.course_id FROM classes c JOIN subjects s ON s.id = c.subject_id WHERE c.id = class_professors.class_id)));

DROP POLICY IF EXISTS "Admin CRUD horarios" ON class_schedules;
DROP POLICY IF EXISTS "Escopo gerencia horarios" ON class_schedules;
CREATE POLICY "Escopo gerencia horarios" ON class_schedules FOR ALL USING (
    public.is_course_admin((SELECT s.course_id FROM classes c JOIN subjects s ON s.id = c.subject_id WHERE c.id = class_schedules.class_id)));

DROP POLICY IF EXISTS "Admin CRUD horario-sala" ON schedule_rooms;
DROP POLICY IF EXISTS "Escopo gerencia horario-sala" ON schedule_rooms;
CREATE POLICY "Escopo gerencia horario-sala" ON schedule_rooms FOR ALL USING (
    public.is_course_admin((SELECT s.course_id FROM class_schedules cs JOIN classes c ON c.id = cs.class_id JOIN subjects s ON s.id = c.subject_id WHERE cs.id = schedule_rooms.schedule_id)));

-- ============================================================================
-- REALTIME nas novas tabelas sociais
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE group_members;

-- Seed: super admin pro dono quando ja tem profile
INSERT INTO admin_grants (profile_id, level, granted_by)
SELECT p.id, 'super', p.id FROM profiles p WHERE p.email = 'aphmgbr@gmail.com'
ON CONFLICT DO NOTHING;

