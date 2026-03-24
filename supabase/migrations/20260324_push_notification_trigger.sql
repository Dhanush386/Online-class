-- =============================================
-- Push Notification Trigger & Webhook
-- =============================================

-- 1. Enable the pg_net extension (for making HTTP requests from SQL)
-- In Supabase dashboard, go to Extensions and enable "pg_net"
-- Or run:
create extension if not exists pg_net;

-- 2. Create the Trigger Function
create or replace function public.trigger_push_notification()
returns trigger as $$
begin
  -- Call your Supabase Edge Function whenever a notification is created
  -- Replace 'YOUR_PROJECT_REF' and 'YOUR_ANON_KEY' with your project details
  perform net.http_post(
    url := 'https://YOUR_PROJECT_REF.functions.supabase.co/push-notifier',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_ANON_KEY'
    ),
    body := jsonb_build_object(
      'id', new.id,
      'title', new.title,
      'message', new.message,
      'target', new.target
    )
  );
  return new;
end;
$$ language plpgsql security definer;

-- 3. Create the Trigger on the notifications table
drop trigger if exists on_notification_created on public.notifications;
create trigger on_notification_created
after insert on public.notifications
for each row execute function public.trigger_push_notification();
