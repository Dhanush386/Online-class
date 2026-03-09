-- =============================================
-- EduStream Online Course System — Supabase Schema
-- Run this in the Supabase SQL Editor
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============ USERS ============
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null check (role in ('organizer', 'student')),
  status text default 'approved' check (status in ('pending', 'approved', 'rejected')),
  avatar_url text,
  created_at timestamptz default now()
);

-- ============ COURSES ============
create table if not exists public.courses (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  organizer_id uuid references public.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- ============ VIDEOS (Live Sessions) ============
create table if not exists public.videos (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references public.courses(id) on delete cascade,
  title text not null,
  description text,
  video_url text,              -- stores the live meeting link (Google Meet / Zoom / Teams)
  scheduled_time timestamptz,
  duration_minutes integer,
  created_at timestamptz default now()
);

-- ============ ENROLLMENTS ============
create table if not exists public.enrollments (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references public.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  enrolled_at timestamptz default now(),
  unique(student_id, course_id)
);

-- ============ PROGRESS ============
create table if not exists public.progress (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references public.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  video_id uuid references public.videos(id) on delete set null,
  completion_percentage integer default 0 check (completion_percentage between 0 and 100),
  time_spent_minutes integer default 0,
  completed boolean default false,
  created_at timestamptz default now()
);

-- ============ ASSESSMENTS ============
create table if not exists public.assessments (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references public.courses(id) on delete cascade,
  type text not null check (type in ('daily', 'weekly', 'final')),
  title text not null,
  description text,
  due_date timestamptz,
  created_at timestamptz default now()
);

-- ============ BADGES ============
create table if not exists public.badges (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references public.users(id) on delete cascade,
  title text not null,
  icon text,
  awarded_at timestamptz default now()
);

-- ============ QUESTIONS ============
create table if not exists public.questions (
  id uuid primary key default uuid_generate_v4(),
  assessment_id uuid references public.assessments(id) on delete cascade,
  question_text text not null,
  options jsonb not null, -- Array of strings
  correct_answer text not null,
  created_at timestamptz default now()
);

-- ============ CODING CHALLENGES ============
create table if not exists public.coding_challenges (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references public.courses(id) on delete cascade,
  title text not null,
  description text,
  problem_statement text not null,
  constraints text,
  input_format text,
  output_format text,
  language text not null, -- 'python', 'javascript', 'java', 'cpp', 'c', 'sql', 'html', 'css'
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  starter_code text,
  test_cases jsonb, -- Array of { input, expected_output, is_hidden }
  xp_reward integer default 15,
  created_at timestamptz default now()
);

-- ============ CODING SUBMISSIONS ============
create table if not exists public.coding_submissions (
  id uuid primary key default uuid_generate_v4(),
  challenge_id uuid references public.coding_challenges(id) on delete cascade,
  student_id uuid references public.users(id) on delete cascade,
  code text not null,
  status text check (status in ('pending', 'accepted', 'wrong_answer', 'runtime_error', 'compilation_error')),
  score integer default 0,
  tests_passed integer default 0,
  results jsonb, -- Detailed results per test case
  created_at timestamptz default now()
);

-- ============ ORGANIZER INVITES ============
create table if not exists public.organizer_invites (
  email text primary key,
  invited_by uuid references public.users(id),
  created_at timestamptz default now()
);

-- ============ ASSESSMENT SUBMISSIONS ============
create table if not exists public.assessment_submissions (
  id uuid primary key default uuid_generate_v4(),
  assessment_id uuid references public.assessments(id) on delete cascade,
  student_id uuid references public.users(id) on delete cascade,
  score integer not null,
  total_questions integer not null,
  answers jsonb, -- Array of { question_id, selected_option, is_correct }
  created_at timestamptz default now()
);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

alter table public.users enable row level security;
alter table public.courses enable row level security;
alter table public.videos enable row level security;
alter table public.enrollments enable row level security;
alter table public.progress enable row level security;
alter table public.assessments enable row level security;
alter table public.badges enable row level security;
alter table public.questions enable row level security;
alter table public.coding_challenges enable row level security;
alter table public.coding_submissions enable row level security;
alter table public.organizer_invites enable row level security;
alter table public.assessment_submissions enable row level security;

-- Users
drop policy if exists "Users can read all profiles" on public.users;
drop policy if exists "Users can update own profile" on public.users;
drop policy if exists "Users can insert own profile" on public.users;
create policy "Users can read all profiles" on public.users for select using (true);
create policy "Users can update own profile" on public.users for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.users for insert with check (auth.uid() = id);

-- Courses
drop policy if exists "Anyone can view courses" on public.courses;
drop policy if exists "Organizers can insert courses" on public.courses;
drop policy if exists "Organizers can update own courses" on public.courses;
drop policy if exists "Organizers can delete own courses" on public.courses;
create policy "Anyone can view courses" on public.courses for select using (true);
create policy "Organizers can insert courses" on public.courses for insert with check (auth.uid() = organizer_id);
create policy "Organizers can update own courses" on public.courses for update using (auth.uid() = organizer_id);
create policy "Organizers can delete own courses" on public.courses for delete using (auth.uid() = organizer_id);

-- Videos
drop policy if exists "Anyone can view videos" on public.videos;
drop policy if exists "Organizers can insert videos" on public.videos;
drop policy if exists "Organizers can update own videos" on public.videos;
drop policy if exists "Organizers can delete own videos" on public.videos;
create policy "Anyone can view videos" on public.videos for select using (true);
create policy "Organizers can insert videos" on public.videos for insert with check (
  exists (select 1 from public.courses where id = course_id and organizer_id = auth.uid())
);
create policy "Organizers can update own videos" on public.videos for update using (
  exists (select 1 from public.courses where id = course_id and organizer_id = auth.uid())
);
create policy "Organizers can delete own videos" on public.videos for delete using (
  exists (select 1 from public.courses where id = course_id and organizer_id = auth.uid())
);

-- Enrollments
drop policy if exists "Students can view own enrollments" on public.enrollments;
drop policy if exists "Organizers can view enrollments for their courses" on public.enrollments;
drop policy if exists "Students can enroll" on public.enrollments;
create policy "Students can view own enrollments" on public.enrollments for select using (auth.uid() = student_id);
create policy "Organizers can view enrollments for their courses" on public.enrollments for select using (
  exists (select 1 from public.courses where id = course_id and organizer_id = auth.uid())
);
create policy "Students can enroll" on public.enrollments for insert with check (auth.uid() = student_id);

-- Progress
drop policy if exists "Students can view own progress" on public.progress;
drop policy if exists "Organizers can view student progress" on public.progress;
drop policy if exists "Students can insert progress" on public.progress;
drop policy if exists "Students can update own progress" on public.progress;
create policy "Students can view own progress" on public.progress for select using (auth.uid() = student_id);
create policy "Organizers can view student progress" on public.progress for select using (
  exists (select 1 from public.courses where id = course_id and organizer_id = auth.uid())
);
create policy "Students can insert progress" on public.progress for insert with check (auth.uid() = student_id);
create policy "Students can update own progress" on public.progress for update using (auth.uid() = student_id);

-- Assessments
drop policy if exists "Anyone can view assessments" on public.assessments;
drop policy if exists "Organizers can manage assessments" on public.assessments;
create policy "Anyone can view assessments" on public.assessments for select using (true);
create policy "Organizers can manage assessments" on public.assessments for all using (
  exists (select 1 from public.courses where id = course_id and organizer_id = auth.uid())
);

-- Badges
drop policy if exists "Anyone can view badges" on public.badges;
drop policy if exists "Organizers can award badges" on public.badges;
create policy "Anyone can view badges" on public.badges for select using (true);
create policy "Organizers can award badges" on public.badges for insert with check (
  exists (select 1 from public.users where id = auth.uid() and role = 'organizer')
);

-- Questions
drop policy if exists "Anyone can view questions" on public.questions;
drop policy if exists "Organizers can manage questions" on public.questions;
create policy "Anyone can view questions" on public.questions for select using (true);
create policy "Organizers can manage questions" on public.questions for all using (
  exists (select 1 from public.assessments a join public.courses c on a.course_id = c.id where a.id = assessment_id and c.organizer_id = auth.uid())
);

-- Coding Challenges
drop policy if exists "Anyone can view coding challenges" on public.coding_challenges;
drop policy if exists "Organizers can manage coding challenges" on public.coding_challenges;
create policy "Anyone can view coding challenges" on public.coding_challenges for select using (true);
create policy "Organizers can manage coding challenges" on public.coding_challenges for all using (
  exists (select 1 from public.courses where id = course_id and organizer_id = auth.uid())
);

-- Coding Submissions
drop policy if exists "Students can manage own submissions" on public.coding_submissions;
drop policy if exists "Organizers can view submissions for their challenges" on public.coding_submissions;
create policy "Students can manage own submissions" on public.coding_submissions for all using (auth.uid() = student_id);
create policy "Organizers can view submissions for their challenges" on public.coding_submissions for select using (
  exists (select 1 from public.coding_challenges ch join public.courses c on ch.course_id = c.id where ch.id = challenge_id and c.organizer_id = auth.uid())
);

-- Organizer Invites
drop policy if exists "Organizers can manage invites" on public.organizer_invites;
drop policy if exists "Anyone can check their own invite" on public.organizer_invites;
create policy "Organizers can manage invites" on public.organizer_invites for all using (
  exists (select 1 from public.users where id = auth.uid() and role = 'organizer')
);
create policy "Anyone can check their own invite" on public.organizer_invites for select using (true);

-- Assessment Submissions
drop policy if exists "Students can manage own assessment submissions" on public.assessment_submissions;
drop policy if exists "Organizers can view assessment submissions" on public.assessment_submissions;
create policy "Students can manage own assessment submissions" on public.assessment_submissions for all using (auth.uid() = student_id);
create policy "Organizers can view assessment submissions" on public.assessment_submissions for select using (
  exists (select 1 from public.assessments a join public.courses c on a.course_id = c.id where a.id = assessment_id and c.organizer_id = auth.uid())
);
-- Create video_progress table to track individual watched videos
CREATE TABLE IF NOT EXISTS public.video_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    watched_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, video_id)
);

-- Enable RLS on video_progress
ALTER TABLE public.video_progress ENABLE ROW LEVEL SECURITY;

-- Policies for video_progress
DROP POLICY IF EXISTS "Students can view own video progress" ON public.video_progress;
CREATE POLICY "Students can view own video progress" ON public.video_progress FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can insert own video progress" ON public.video_progress;
CREATE POLICY "Students can insert own video progress" ON public.video_progress FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Organizers can view student video progress" ON public.video_progress;
CREATE POLICY "Organizers can view student video progress" ON public.video_progress FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND organizer_id = auth.uid())
);

-- Fix progress table constraints (drop potential duplicates first)
-- Ensure only one progress row per student per course
ALTER TABLE public.progress DROP CONSTRAINT IF EXISTS progress_student_id_course_id_key;
ALTER TABLE public.progress ADD CONSTRAINT progress_student_id_course_id_key UNIQUE (student_id, course_id);
-- Create saved_code_snippets table
CREATE TABLE IF NOT EXISTS public.saved_code_snippets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    language TEXT NOT NULL,
    code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_code_snippets ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view own snippets" ON public.saved_code_snippets;
CREATE POLICY "Users can view own snippets" ON public.saved_code_snippets 
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own snippets" ON public.saved_code_snippets;
CREATE POLICY "Users can insert own snippets" ON public.saved_code_snippets 
FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own snippets" ON public.saved_code_snippets;
CREATE POLICY "Users can update own snippets" ON public.saved_code_snippets 
FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own snippets" ON public.saved_code_snippets;
CREATE POLICY "Users can delete own snippets" ON public.saved_code_snippets 
FOR DELETE USING (auth.uid() = user_id);
