-- fix: granted_by CASCADE (testes/limpeza)
ALTER TABLE admin_grants DROP CONSTRAINT IF EXISTS admin_grants_granted_by_fkey;
ALTER TABLE admin_grants ADD CONSTRAINT admin_grants_granted_by_fkey
    FOREIGN KEY (granted_by) REFERENCES profiles(id) ON DELETE CASCADE;
