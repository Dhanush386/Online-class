-- Add access_expires_at to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_expires_at timestamptz;

-- Add a comment for clarity
COMMENT ON COLUMN users.access_expires_at IS 'Optional timestamp after which the student will be automatically logged out and denied access.';
