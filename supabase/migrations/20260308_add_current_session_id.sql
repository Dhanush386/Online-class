-- Add current_session_id to users table to enforce single session
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_session_id text;

-- Add a comment for clarity
COMMENT ON COLUMN users.current_session_id IS 'Unique ID of the current active session to prevent multiple system logins.';
