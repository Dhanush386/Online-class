-- ============ PUSH SUBSCRIPTIONS ============
create table if not exists public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  subscription_json jsonb not null,
  created_at timestamptz default now(),
  unique(user_id, subscription_json)
);

-- Enable RLS
alter table public.push_subscriptions enable row level security;

-- Policies
drop policy if exists "Users can manage own push subscriptions" on public.push_subscriptions;
create policy "Users can manage own push subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id);
