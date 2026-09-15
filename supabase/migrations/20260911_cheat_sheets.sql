-- ==========================================================
-- Migration: Cheat Sheet System with Hardened Security & RLS
-- Date: 2026-09-11
-- ==========================================================

-- 1. Create cheat_sheets table
CREATE TABLE IF NOT EXISTS public.cheat_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  topic_badge TEXT DEFAULT 'Introduction to HTML & CSS',
  breadcrumb_title TEXT DEFAULT 'Introduction to CSS | Part 3 | Cheat Sheet',
  week_number INTEGER DEFAULT 1,
  day_number INTEGER DEFAULT 1,
  day_of_week INTEGER DEFAULT 1,
  estimated_minutes INTEGER DEFAULT 10,
  xp_reward INTEGER DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cheat_sheets ADD COLUMN IF NOT EXISTS day_number INTEGER DEFAULT 1;
ALTER TABLE public.cheat_sheets ADD COLUMN IF NOT EXISTS day_of_week INTEGER DEFAULT 1;


-- 2. Create cheat_sheet_completions table (Idempotent tracking)
CREATE TABLE IF NOT EXISTS public.cheat_sheet_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cheat_sheet_id UUID NOT NULL REFERENCES public.cheat_sheets(id) ON DELETE CASCADE,
  xp_awarded INTEGER NOT NULL DEFAULT 10,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_student_cheat_sheet UNIQUE(student_id, cheat_sheet_id)
);

-- Indexes for high performance
CREATE INDEX IF NOT EXISTS idx_cheat_sheets_course_id ON public.cheat_sheets(course_id);
CREATE INDEX IF NOT EXISTS idx_cheat_sheets_slug ON public.cheat_sheets(slug);
CREATE INDEX IF NOT EXISTS idx_cheat_sheets_status ON public.cheat_sheets(status);
CREATE INDEX IF NOT EXISTS idx_cheat_sheet_completions_student ON public.cheat_sheet_completions(student_id);
CREATE INDEX IF NOT EXISTS idx_cheat_sheet_completions_sheet ON public.cheat_sheet_completions(cheat_sheet_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.cheat_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cheat_sheet_completions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for cheat_sheets
-- Read policy: Students can read published sheets for enrolled courses (or public/standalone sheets)
DROP POLICY IF EXISTS "cheat_sheets_select_policy" ON public.cheat_sheets;
CREATE POLICY "cheat_sheets_select_policy" ON public.cheat_sheets
  FOR SELECT
  USING (
    -- Platform organizers & admins can view all sheets (including drafts)
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
        AND users.role IN ('organizer', 'main_admin', 'sub_admin')
    )
    OR
    -- Students can view only published sheets for courses they are enrolled in (or standalone sheets)
    (
      status = 'published'
      AND (
        course_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.enrollments 
          WHERE enrollments.student_id = auth.uid() 
            AND enrollments.course_id = cheat_sheets.course_id
        )
      )
    )
  );

-- Write policies: Strictly course-ownership bound
DROP POLICY IF EXISTS "cheat_sheets_insert_policy" ON public.cheat_sheets;
CREATE POLICY "cheat_sheets_insert_policy" ON public.cheat_sheets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
        AND users.role = 'main_admin'
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

DROP POLICY IF EXISTS "cheat_sheets_update_policy" ON public.cheat_sheets;
CREATE POLICY "cheat_sheets_update_policy" ON public.cheat_sheets
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
        AND users.role = 'main_admin'
    )
    OR (
      course_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.courses 
        WHERE courses.id = cheat_sheets.course_id 
          AND courses.organizer_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "cheat_sheets_delete_policy" ON public.cheat_sheets;
CREATE POLICY "cheat_sheets_delete_policy" ON public.cheat_sheets
  FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
        AND users.role = 'main_admin'
    )
    OR (
      course_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.courses 
        WHERE courses.id = cheat_sheets.course_id 
          AND courses.organizer_id = auth.uid()
      )
    )
  );

-- 5. RLS Policies for cheat_sheet_completions
DROP POLICY IF EXISTS "completions_select_policy" ON public.cheat_sheet_completions;
CREATE POLICY "completions_select_policy" ON public.cheat_sheet_completions
  FOR SELECT
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
        AND users.role IN ('organizer', 'main_admin', 'sub_admin')
    )
  );

DROP POLICY IF EXISTS "completions_insert_policy" ON public.cheat_sheet_completions;
CREATE POLICY "completions_insert_policy" ON public.cheat_sheet_completions
  FOR INSERT
  WITH CHECK (student_id = auth.uid());

-- 6. Atomic, Idempotent Server-Side Completion & XP RPC
-- Runs as SECURITY DEFINER with in-body authentication, published-status, and enrollment checks
CREATE OR REPLACE FUNCTION public.complete_cheat_sheet(p_sheet_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sheet RECORD;
  v_already_completed BOOLEAN;
  v_xp_to_award INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User is not authenticated';
  END IF;

  -- 1. Fetch sheet and enforce current published status at write time
  SELECT id, course_id, xp_reward, status INTO v_sheet
  FROM public.cheat_sheets
  WHERE id = p_sheet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cheat sheet not found';
  END IF;

  IF v_sheet.status <> 'published' THEN
    RAISE EXCEPTION 'Forbidden: Cheat sheet is not currently published';
  END IF;

  -- 2. Enforce course enrollment check at call time
  IF v_sheet.course_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.enrollments 
      WHERE student_id = v_user_id 
        AND course_id = v_sheet.course_id
    ) THEN
      RAISE EXCEPTION 'Forbidden: Student is not enrolled in this course';
    END IF;
  END IF;

  -- 3. Check for existing completion (Idempotency check)
  SELECT EXISTS (
    SELECT 1 FROM public.cheat_sheet_completions 
    WHERE student_id = v_user_id 
      AND cheat_sheet_id = p_sheet_id
  ) INTO v_already_completed;

  IF v_already_completed THEN
    RETURN jsonb_build_object(
      'success', true, 
      'already_completed', true, 
      'xp_awarded', 0,
      'message', 'Cheat sheet has already been completed.'
    );
  END IF;

  v_xp_to_award := COALESCE(v_sheet.xp_reward, 10);

  -- 4. Record completion row
  INSERT INTO public.cheat_sheet_completions (student_id, cheat_sheet_id, xp_awarded, completed_at)
  VALUES (v_user_id, p_sheet_id, v_xp_to_award, NOW())
  ON CONFLICT (student_id, cheat_sheet_id) DO NOTHING;

  -- 5. Atomically award XP in users table
  UPDATE public.users 
  SET xp = COALESCE(xp, 0) + v_xp_to_award
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true, 
    'already_completed', false, 
    'xp_awarded', v_xp_to_award,
    'message', 'Cheat sheet completed successfully!'
  );
END;
$$;

-- 7. Seed Data: "Introduction to CSS | Part 3 | Cheat Sheet"
-- Inserts idempotently using ON CONFLICT (slug) DO NOTHING
INSERT INTO public.cheat_sheets (
  id,
  title,
  slug,
  topic_badge,
  breadcrumb_title,
  description,
  week_number,
  day_number,
  day_of_week,
  estimated_minutes,
  xp_reward,
  status,
  sections
)
VALUES (
  'e2b4f7a1-8c3d-4e5f-9a1b-2c3d4e5f6a7b',
  'Introduction to CSS | Part 3',
  'css-part-3',
  'Introduction to HTML & CSS',
  'Introduction to CSS | Part 3 | Cheat Sheet',
  'Master Font Family, Font Size, Font Style, and Font Weight with live examples, interactive quizzes, and playground.',
  3,
  2,
  2,
  10,
  10,
  'published',
  '[
    {
      "id": "sec-1",
      "type": "standard",
      "title": "1. Font Family",
      "description": "The CSS `font-family` property specifies the font for an element.",
      "codeBlock": {
        "language": "CSS",
        "code": "@import url(\"https://fonts.googleapis.com/css2?family=Bree+Serif&family=Caveat:wght@400;700&family=Lobster&family=Monoton&family=Playfair+Display&family=Playfair+Display+SC&family=Roboto&display=swap\");\n\n.main-heading {\n  font-family: \"Roboto\";\n}\n\n.paragraph {\n  font-family: \"Roboto\";\n}"
      },
      "fontPreview": {
        "text": "You can use one of the below values of the `font-family` property,",
        "sampleWord": "Tourism",
        "fonts": [
          { "name": "\"Roboto\"", "family": "Roboto", "style": "normal", "weight": "700" },
          { "name": "\"Caveat\"", "family": "Caveat", "style": "normal", "weight": "700" },
          { "name": "\"Lobster\"", "family": "Lobster", "style": "normal", "weight": "400" },
          { "name": "\"Bree Serif\"", "family": "Bree Serif", "style": "normal", "weight": "400" },
          { "name": "\"Playfair Display\"", "family": "Playfair Display", "style": "normal", "weight": "700" },
          { "name": "\"Monoton\"", "family": "Monoton", "style": "normal", "weight": "400", "uppercase": true },
          { "name": "\"Playfair Display SC\"", "family": "Playfair Display SC", "style": "normal", "weight": "700", "uppercase": true }
        ]
      },
      "note": {
        "items": [
          "To use font families, you need to import their style sheets into your CSS file.",
          "There shouldn''t be any spelling mistakes in the values of the `font-family` property.",
          "There must be quotations around the value of the `font-family` property."
        ]
      },
      "quiz": {
        "questionNumber": "Question 1 of 1",
        "prompt": "Which of the following is a valid value of the **CSS Property** `font-family` ?",
        "options": [
          "blue",
          "\"Roboto\"",
          "red",
          "center"
        ],
        "correctAnswer": "\"Roboto\"",
        "explanation": "\"Roboto\" is a valid font-family name imported from Google Fonts. Colors like blue/red are used for the color property, while center is a text-align value."
      }
    },
    {
      "id": "sec-2",
      "type": "standard",
      "title": "2. Font Size",
      "description": "The CSS `font-size` property specifies the size of the font.",
      "codeBlock": {
        "language": "CSS",
        "code": ".main-heading {\n  font-size: 36px;\n}\n\n.paragraph {\n  font-size: 28px;\n}"
      },
      "note": {
        "items": [
          "You must add `px` after the number in the value of the `font-size` property.",
          "There shouldn''t be any space between the number and `px`.",
          "There shouldn''t be any quotations around the value of the `font-size` property."
        ]
      }
    },
    {
      "id": "sec-3",
      "type": "standard",
      "title": "3. Font Style",
      "description": "The CSS `font-style` property specifies the font style for a text.",
      "valueTable": {
        "title": "You can use one of the below values of the `font-style` property,",
        "header": "Value",
        "values": ["normal", "italic", "oblique"]
      },
      "codeBlock": {
        "language": "CSS",
        "code": ".main-heading {\n  font-style: italic;\n}\n\n.paragraph {\n  font-style: normal;\n}"
      },
      "note": {
        "items": [
          "There shouldn''t be any spelling mistakes in the values of the `font-style` property.",
          "There shouldn''t be any quotations around the value of the `font-style` property."
        ]
      },
      "quiz": {
        "questionNumber": "Question 1 of 1",
        "prompt": "Fill in the blank with an appropriate **value** for the given **CSS Property**.",
        "snippet": ".paragraph {\n  font-style: ___________;\n}",
        "options": [
          "20px",
          "italic",
          "blue",
          "\"Roboto\""
        ],
        "correctAnswer": "italic",
        "explanation": "italic is a valid value for the font-style property. 20px is for font-size, blue is for color, and \"Roboto\" is for font-family."
      }
    },
    {
      "id": "sec-4",
      "type": "standard",
      "title": "4. Font Weight",
      "description": "The CSS `font-weight` property sets how thick or thin characters in text should be displayed.",
      "codeBlock": {
        "language": "CSS",
        "code": ".main-heading {\n  font-weight: bold;\n}\n\n.paragraph {\n  font-weight: normal;\n}"
      },
      "playground": {
        "starterHtml": "<!DOCTYPE html>\n<html>\n  <head>\n  </head>\n  <body>\n    <h1 class=\"main-heading\">Tourism</h1>\n    <hr />\n    <p class=\"paragraph\">Plan your trip wherever you want to go</p>\n  </body>\n</html>",
        "starterCss": "@import url(\"https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Roboto:wght@400;700&display=swap\");\n\n.main-heading {\n  font-family: \"Caveat\", cursive;\n  font-size: 38px;\n  font-style: italic;\n  color: #1e293b;\n  margin-bottom: 0.25rem;\n}\n\n.paragraph {\n  font-family: \"Roboto\", sans-serif;\n  font-size: 18px;\n  color: #334155;\n}",
        "starterJs": "// Live code runner initialized\nconsole.log(\"Cheat Sheet Playground ready!\");"
      }
    }
  ]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  topic_badge = EXCLUDED.topic_badge,
  breadcrumb_title = EXCLUDED.breadcrumb_title,
  description = EXCLUDED.description,
  week_number = EXCLUDED.week_number,
  day_number = EXCLUDED.day_number,
  day_of_week = EXCLUDED.day_of_week,
  estimated_minutes = EXCLUDED.estimated_minutes,
  xp_reward = EXCLUDED.xp_reward,
  status = EXCLUDED.status,
  sections = EXCLUDED.sections,
  updated_at = NOW();

