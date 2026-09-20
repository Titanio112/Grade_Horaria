-- ============================================================
-- v6 — institution_requests (pedido de cadastro de instituição)
-- Motivo: a pessoa que não encontra sua instituição na cascata
-- do cadastro ainda NÃO tem conta (está anônima), então o INSERT
-- precisa aceitar anon + authenticated. Leitura/atualização só
-- para super admin (revisão manual, sem e-mail automático no MVP).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.institution_requests (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_name TEXT NOT NULL,
    contact_email    TEXT NOT NULL,
    message          TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','reviewed')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.institution_requests ENABLE ROW LEVEL SECURITY;

-- Qualquer visitante (anon) ou usuário logado pode ENVIAR um pedido.
-- Ninguém lê nada além do super admin — INSERT nunca retorna linhas.
DROP POLICY IF EXISTS "Qualquer um solicita instituicao" ON public.institution_requests;
CREATE POLICY "Qualquer um solicita instituicao"
    ON public.institution_requests FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Super admin le pedidos" ON public.institution_requests;
CREATE POLICY "Super admin le pedidos"
    ON public.institution_requests FOR SELECT
    TO authenticated
    USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin atualiza pedidos" ON public.institution_requests;
CREATE POLICY "Super admin atualiza pedidos"
    ON public.institution_requests FOR UPDATE
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());
