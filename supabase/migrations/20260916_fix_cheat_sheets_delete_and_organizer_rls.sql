-- ==========================================================
-- Migration: Fix Cheat Sheets Delete & Update RLS for Organizers
-- Date: 2026-09-16
-- ==========================================================

-- 1. Update DELETE policy so organizers and admins can delete any cheat sheet
-- (including standalone sheets where course_id is null or seeded sheets where created_by is null)
DROP POLICY IF EXISTS "cheat_sheets_delete_policy" ON public.cheat_sheets;
CREATE POLICY "cheat_sheets_delete_policy" ON public.cheat_sheets
  FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
        AND users.role IN ('main_admin', 'organizer', 'sub_admin')
    )
    OR (
      course_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.courses 
        WHERE courses.id = cheat_sheets.course_id 
          AND courses.organizer_id = auth.uid()
      )
    )
    OR (
      course_id IS NULL AND EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
          AND users.role IN ('organizer', 'sub_admin')
      )
    )
  );

-- 2. Update UPDATE policy so organizers can update standalone sheets
DROP POLICY IF EXISTS "cheat_sheets_update_policy" ON public.cheat_sheets;
CREATE POLICY "cheat_sheets_update_policy" ON public.cheat_sheets
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
        AND users.role IN ('main_admin', 'organizer', 'sub_admin')
    )
    OR (
      course_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.courses 
        WHERE courses.id = cheat_sheets.course_id 
          AND courses.organizer_id = auth.uid()
      )
    )
    OR (
      course_id IS NULL AND EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
          AND users.role IN ('organizer', 'sub_admin')
      )
    )
  );

-- 3. Dedicated RPC to securely delete cheat sheets for organizers and admins
CREATE OR REPLACE FUNCTION public.delete_cheat_sheet(p_sheet_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is organizer or admin
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
      AND role IN ('organizer', 'main_admin', 'sub_admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized to delete cheat sheets';
  END IF;

  DELETE FROM public.cheat_sheet_completions WHERE cheat_sheet_id = p_sheet_id;
  DELETE FROM public.cheat_sheets WHERE id = p_sheet_id;
  RETURN TRUE;
END;
$$;
