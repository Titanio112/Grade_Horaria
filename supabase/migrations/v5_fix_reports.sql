-- fix v5: policies de reports com mapeamento correto subject->course
DROP POLICY IF EXISTS "Report visivel pro admin do curso" ON reports;
DROP POLICY IF EXISTS "Admin do escopo gerencia report" ON reports;

CREATE POLICY "Report visivel pro admin do curso" ON reports FOR SELECT USING (
    public.is_super_admin()
    OR (reports.class_id IS NOT NULL AND public.is_course_admin((
        SELECT s.course_id FROM classes c JOIN subjects s ON s.id = c.subject_id WHERE c.id = reports.class_id)))
    OR (reports.subject_id IS NOT NULL AND public.is_course_admin((
        SELECT s.course_id FROM subjects s WHERE s.id = reports.subject_id)))
);
CREATE POLICY "Admin do escopo gerencia report" ON reports FOR UPDATE USING (
    public.is_super_admin()
    OR (reports.class_id IS NOT NULL AND public.is_course_admin((
        SELECT s.course_id FROM classes c JOIN subjects s ON s.id = c.subject_id WHERE c.id = reports.class_id)))
    OR (reports.subject_id IS NOT NULL AND public.is_course_admin((
        SELECT s.course_id FROM subjects s WHERE s.id = reports.subject_id)))
);
