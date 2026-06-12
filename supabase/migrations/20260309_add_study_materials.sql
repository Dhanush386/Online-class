-- ============ COURSE RESOURCES (PDF/PPT) ============
create table if not exists public.course_resources (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references public.courses(id) on delete cascade,
  title text not null,
  description text,
  file_url text not null,
  resource_type text not null check (resource_type in ('pdf', 'ppt', 'other')),
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.course_resources enable row level security;

-- Policies
drop policy if exists "Anyone can view resources for their enrolled courses" on public.course_resources;
create policy "Anyone can view resources for their enrolled courses" on public.course_resources for select using (
  exists (select 1 from public.enrollments where course_id = public.course_resources.course_id and student_id = auth.uid())
  OR
  exists (select 1 from public.courses where id = public.course_resources.course_id and organizer_id = auth.uid())
);

drop policy if exists "Organizers can manage resources for their courses" on public.course_resources;
create policy "Organizers can manage resources for their courses" on public.course_resources for all using (
  exists (select 1 from public.courses where id = public.course_resources.course_id and organizer_id = auth.uid())
);
