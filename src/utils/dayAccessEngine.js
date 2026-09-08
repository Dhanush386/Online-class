/**
 * Centralized Day Access & Content Drip Engine
 * 
 * Business Rules:
 * 1. 6:00 PM Cutoff Rule:
 *    - Registered before 6:00 PM (18:00) local time -> Day 1 unlocks on registration day.
 *    - Registered at or after 6:00 PM (18:00) local time -> Day 1 unlocks at 12:00 AM next calendar day.
 * 2. Continuous Day-by-Day Unlocking:
 *    - Day 1: Effective Start Date
 *    - Day 2: Start Date + 1 calendar day
 *    - Day 3: Start Date + 2 calendar days... and so on.
 * 3. Free Day Access:
 *    - Within an unlocked day, all items (recorded video, coding challenge, quiz, resources)
 *      are freely accessible without mandatory sequential blocking.
 */

/**
 * Normalizes a Date to midnight (00:00:00.000) in local timezone.
 * Using year, month, date prevents DST and timezone skew.
 */
export function toCalendarDay(date) {
    if (!date) return new Date(new Date().setHours(0, 0, 0, 0));
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return new Date(new Date().setHours(0, 0, 0, 0));
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Returns the effective Day 1 start calendar date.
 * If enrolled before 6:00 PM (18:00), effective start is enrollment day.
 * If enrolled at or after 6:00 PM (18:00), effective start is next calendar day (12:00 AM).
 */
export function getEffectiveStartDate(enrolledAt) {
    if (!enrolledAt) return toCalendarDay(new Date());
    const enrollDate = enrolledAt instanceof Date ? enrolledAt : new Date(enrolledAt);
    if (Number.isNaN(enrollDate.getTime())) return toCalendarDay(new Date());

    const start = toCalendarDay(enrollDate);
    const hour = enrollDate.getHours();

    // 6:00 PM (18:00) cutoff
    if (hour >= 18) {
        start.setDate(start.getDate() + 1);
    }
    return start;
}

/**
 * Calculates current accessible absolute day number (1-based index).
 * Returns 0 if current date is before effective start date (e.g. registered after 6 PM today).
 * Returns 1 on Day 1, 2 on Day 2, etc.
 */
export function calculateAccessibleDay(enrolledAt, currentDate = new Date()) {
    const effectiveStart = getEffectiveStartDate(enrolledAt);
    const currentCalDay = toCalendarDay(currentDate);

    const diffTime = currentCalDay.getTime() - effectiveStart.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return 0; // Not yet unlocked (unlocks at 12:00 AM next day)
    }
    return diffDays + 1;
}

/**
 * Normalizes an item's day number across course structures.
 */
export function getItemAbsoluteDay(item) {
    if (!item) return 1;

    // Prioritize week_number and day_of_week (standard curriculum schedule)
    const week = Number(item.week_number);
    const dow = Number(item.day_of_week ?? item.day);
    if (week > 0 && dow > 0) {
        return (week - 1) * 7 + dow;
    }

    // Fallback to explicit day_number if week/dow not both present
    if (item.day_number && Number(item.day_number) > 0) {
        return Number(item.day_number);
    }

    if (week > 0) {
        return (week - 1) * 7 + 1;
    }

    return 1;
}

/**
 * Evaluates whether a learning item is unlocked for a student.
 */
export function isItemUnlocked({
    item,
    type,
    accessibleDay = 1,
    lockedCodingIds = [],
    lockedAssessIds = [],
    lockedMaterialIds = [],
    groupDayAccess = [],
    earlyUnlockedIds = []
}) {
    if (!item) return { isLocked: false };

    // Early unlock by student via coins
    if (item.id && earlyUnlockedIds.includes(item.id)) {
        return { isLocked: false, isEarlyUnlocked: true };
    }

    // 1. Live classes with direct join links are always unlocked
    if (type === 'live') {
        return { isLocked: false };
    }
    if (type === 'video') {
        const isRecorded = item.video_url && (
            item.video_url.includes('supabase.co/storage') ||
            item.video_url.includes('drive.google.com') ||
            !item.video_url.startsWith('http')
        );
        // If scheduled live class without uploaded recording
        if (!isRecorded && item.scheduled_time && !item.video_url) {
            return { isLocked: false };
        }
    }

    // 2. Explicit individual manual locks by instructor
    if (type === 'coding' && lockedCodingIds.includes(item.id)) {
        return { isLocked: true, reason: 'This coding challenge is locked by your instructor.' };
    }
    if (type === 'assessment' && lockedAssessIds.includes(item.id)) {
        return { isLocked: true, reason: 'This assessment is locked by your instructor.' };
    }
    if (type === 'resource' && lockedMaterialIds.includes(item.id)) {
        return { isLocked: true, reason: 'This resource is locked by your instructor.' };
    }

    // 3. Group manual day lock
    const itemDay = getItemAbsoluteDay(item);
    const dayLock = (groupDayAccess || []).find(da => da.day_number === itemDay);
    if (dayLock && dayLock.is_locked) {
        return { isLocked: true, reason: 'This day is currently locked for your group.' };
    }

    // 4. Day-by-Day continuous unlocking
    if (accessibleDay === 0) {
        return { 
            isLocked: true, 
            reason: 'Course content unlocks tomorrow at 12:00 AM.',
            daysToWait: 1 
        };
    }

    if (itemDay > accessibleDay) {
        const daysToWait = itemDay - accessibleDay;
        const reason = daysToWait === 1 
            ? 'Unlocks tomorrow at 12:00 AM.' 
            : `Unlocks in ${daysToWait} days.`;
        return { isLocked: true, reason, daysToWait };
    }

    // All items within an unlocked day (Day <= accessibleDay) are freely accessible
    return { isLocked: false };
}

/**
 * Returns the exact Date (at 12:00:00 AM) when a given item unlocks naturally.
 */
export function getItemUnlockTargetDate(item, enrolledAt) {
    const itemDay = getItemAbsoluteDay(item);
    const effectiveStart = getEffectiveStartDate(enrolledAt);
    const targetDate = new Date(effectiveStart.getTime());
    targetDate.setDate(targetDate.getDate() + (itemDay - 1));
    targetDate.setHours(0, 0, 0, 0);
    return targetDate;
}
