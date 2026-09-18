-- fix v5: groups/group_members sem recursao (helper functions)
CREATE OR REPLACE FUNCTION public.is_group_member(p_group UUID)
RETURNS BOOLEAN AS $$ SELECT EXISTS (SELECT 1 FROM group_members WHERE group_id = p_group AND profile_id = auth.uid()); $$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_group_creator(p_group UUID)
RETURNS BOOLEAN AS $$ SELECT EXISTS (SELECT 1 FROM groups WHERE id = p_group AND created_by = auth.uid()); $$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Membro ve grupo" ON groups;
DROP POLICY IF EXISTS "Membro ve membros" ON group_members;
DROP POLICY IF EXISTS "Criador adiciona membros" ON group_members;
DROP POLICY IF EXISTS "Criador remove ou membro sai" ON group_members;

CREATE POLICY "Membro ve grupo" ON groups FOR SELECT USING (
    public.is_group_creator(id) OR public.is_group_member(id)
);
CREATE POLICY "Membro ve membros" ON group_members FOR SELECT USING (
    public.is_group_member(group_id) OR public.is_group_creator(group_id)
);
CREATE POLICY "Criador adiciona membros" ON group_members FOR INSERT WITH CHECK (public.is_group_creator(group_id));
CREATE POLICY "Criador remove ou membro sai" ON group_members FOR DELETE USING (
    profile_id = auth.uid() OR public.is_group_creator(group_id)
);
