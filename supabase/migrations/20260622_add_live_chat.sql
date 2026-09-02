-- 0. Helper function for any admin checks
CREATE OR REPLACE FUNCTION public.is_any_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('organizer', 'main_admin', 'sub_admin'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

create table if not exists public.live_class_sessions (
    video_id uuid primary key references public.videos(id) on delete cascade,
    status text default 'active' check (status in ('active', 'ended', 'archived')),
    chat_cleanup_at timestamptz,
    ended_at timestamptz
);

create table if not exists public.live_chat_messages (
    id uuid primary key default uuid_generate_v4(),
    video_id uuid references public.videos(id) on delete cascade,
    user_id uuid references public.users(id) on delete cascade,
    message text not null,
    message_type text default 'normal' check (message_type in ('normal', 'instructor', 'system', 'announcement')),
    is_pinned boolean default false,
    created_at timestamptz default now()
);

create table if not exists public.live_chat_reactions (
    id uuid primary key default uuid_generate_v4(),
    message_id uuid references public.live_chat_messages(id) on delete cascade,
    user_id uuid references public.users(id) on delete cascade,
    emoji text not null,
    created_at timestamptz default now(),
    unique(message_id, user_id, emoji)
);

-- Enable RLS
alter table public.live_class_sessions enable row level security;
alter table public.live_chat_messages enable row level security;
alter table public.live_chat_reactions enable row level security;

-- Policies for live_class_sessions
create policy "Anyone can read live class sessions" 
    on public.live_class_sessions for select using (true);

create policy "Organizers can insert live class sessions" 
    on public.live_class_sessions for insert with check (
        public.is_any_admin()
    );

create policy "Organizers can update live class sessions" 
    on public.live_class_sessions for update using (
        public.is_any_admin()
    );

-- Policies for live_chat_messages
create policy "Users can read classroom chat" 
    on public.live_chat_messages for select using (
        public.is_any_admin()
        or exists (
            select 1 from public.videos v
            join public.enrollments e on v.course_id = e.course_id
            where v.id = live_chat_messages.video_id
            and e.student_id = auth.uid()
        )
    );

create policy "Users can insert their own chat" 
    on public.live_chat_messages for insert with check (
        auth.uid() = user_id
        and (
            public.is_any_admin()
            or exists (
                select 1 from public.videos v
                join public.enrollments e on v.course_id = e.course_id
                where v.id = video_id
                and e.student_id = auth.uid()
            )
        )
    );

create policy "Organizers can update chat" 
    on public.live_chat_messages for update using (
        public.is_any_admin()
    );

create policy "Organizers can delete chat" 
    on public.live_chat_messages for delete using (
        public.is_any_admin()
    );

-- Policies for live_chat_reactions
create policy "Users can read reactions" 
    on public.live_chat_reactions for select using (true);

create policy "Users can insert their own reactions" 
    on public.live_chat_reactions for insert with check (
        auth.uid() = user_id
    );

create policy "Users can delete their own reactions" 
    on public.live_chat_reactions for delete using (
        auth.uid() = user_id
    );

-- Enable Realtime
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;

alter publication supabase_realtime add table public.live_chat_messages;
alter publication supabase_realtime add table public.live_chat_reactions;
