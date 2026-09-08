-- ============================================================
-- Migration: Unlock Module with Coins (Atomic RPC)
-- ============================================================

-- 1. Create scoped partial unique index for early unlocks
CREATE UNIQUE INDEX IF NOT EXISTS xp_events_early_unlock_unique
ON public.xp_events (student_id, reference_id)
WHERE event_type = 'early_unlock';

-- 2. Create atomic unlock RPC function
CREATE OR REPLACE FUNCTION public.unlock_module_with_coins(
    p_course_id UUID,
    p_item_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_student_id UUID := auth.uid();
    v_current_coins INTEGER;
    v_item_type TEXT;
    v_cost INTEGER;
    v_rows_affected INTEGER;
BEGIN
    IF v_student_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- 1. Identify actual item type and cost server-side
    IF EXISTS (SELECT 1 FROM public.coding_challenges WHERE id = p_item_id) THEN
        v_item_type := 'coding';
        v_cost := 25;
    ELSIF EXISTS (SELECT 1 FROM public.assessments WHERE id = p_item_id) THEN
        v_item_type := 'assessment';
        v_cost := 15;
    ELSIF EXISTS (SELECT 1 FROM public.videos WHERE id = p_item_id) THEN
        v_item_type := 'video';
        v_cost := 20;
    ELSIF EXISTS (SELECT 1 FROM public.course_resources WHERE id = p_item_id) THEN
        v_item_type := 'resource';
        v_cost := 10;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid curriculum item');
    END IF;

    -- 2. Take row lock on users to serialize concurrent requests for this student
    SELECT coins INTO v_current_coins
    FROM public.users
    WHERE id = v_student_id
    FOR UPDATE;

    -- 3. Idempotency check inside the lock
    IF EXISTS (
        SELECT 1 FROM public.xp_events
        WHERE student_id = v_student_id
          AND event_type = 'early_unlock'
          AND reference_id = p_item_id
    ) THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_unlocked', true,
            'item_id', p_item_id,
            'remaining_coins', v_current_coins
        );
    END IF;

    -- 4. Check sufficient balance
    IF v_current_coins IS NULL OR v_current_coins < v_cost THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient coins',
            'required', v_cost,
            'current', COALESCE(v_current_coins, 0)
        );
    END IF;

    -- 5. Insert debit record into ledger matching the partial unique index
    INSERT INTO public.xp_events (
        student_id,
        course_id,
        event_type,
        module_type,
        reference_id,
        xp_amount,
        coin_amount,
        reason
    ) VALUES (
        v_student_id,
        p_course_id,
        'early_unlock',
        v_item_type,
        p_item_id,
        0,
        -v_cost,
        'Early unlock for ' || v_item_type
    )
    ON CONFLICT (student_id, reference_id) WHERE event_type = 'early_unlock' DO NOTHING;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    -- If another transaction raced and already inserted
    IF v_rows_affected = 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_unlocked', true,
            'item_id', p_item_id,
            'remaining_coins', v_current_coins
        );
    END IF;

    -- 6. Re-read the trigger-synced coin balance from users
    SELECT coins INTO v_current_coins
    FROM public.users
    WHERE id = v_student_id;

    RETURN jsonb_build_object(
        'success', true,
        'cost', v_cost,
        'remaining_coins', v_current_coins,
        'item_id', p_item_id,
        'item_type', v_item_type
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlock_module_with_coins(UUID, UUID) TO authenticated;
