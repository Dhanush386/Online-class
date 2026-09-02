INSERT INTO public.xp_config (event_type, xp_amount, coin_amount, streak_multiplier, first_attempt_multiplier, description) 
VALUES ('weekly_champion', 200, 50, 1.0, 1.0, 'Weekly Champion (Perfect scores on all tasks)')
ON CONFLICT (event_type) DO UPDATE 
SET xp_amount = 200, coin_amount = 50;
