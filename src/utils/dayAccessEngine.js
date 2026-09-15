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
 * Calculates the schedule Date for a specific week and day,
 * continuing continuously from the effective start date for all 12 weeks.
 * 
 * Rules:
 * - Start date is based on the student's date of joining / registration:
 *   - Joined before 6:00 PM (18:00) -> start date is the same date.
 *   - Registered at or after 6:00 PM (18:00) -> starting date is tomorrow.
 * - Continuing 12-week schedule:
 *   - Week 1: Day 1 (start) to Day 7 (start + 6 days)
 *   - Week 2: Day 8 (start + 7 days) to Day 14 (start + 13 days)
 *   ...
 *   - Week 12: Day 78 (start + 77 days) to Day 84 (start + 83 days)
 */
export function getCourseWeekScheduleDate(enrolledAt, weekNum = 1, dayOfWeek = 1) {
    const effectiveStart = getEffectiveStartDate(enrolledAt);
    const targetDate = new Date(effectiveStart.getTime());

    let dayIndex = 1;
    if (dayOfWeek === 'end') {
        dayIndex = 7;
    } else if (dayOfWeek === 'start' || dayOfWeek === undefined || dayOfWeek === null) {
        dayIndex = 1;
    } else {
        const parsed = Number(dayOfWeek);
        dayIndex = Number.isNaN(parsed) || parsed < 1 ? 1 : Math.min(7, Math.max(1, parsed));
    }

    const w = Math.max(1, Number(weekNum) || 1);
    const offsetDays = (w - 1) * 7 + (dayIndex - 1);
    targetDate.setDate(targetDate.getDate() + offsetDays);
    return targetDate;
}

/**
 * Returns the formatted date range for a specific week:
 * e.g. { start: Date, end: Date, label: '15 Sep - 21 Sep' }
 */
export function getWeekDateRange(enrolledAt, weekNum = 1, locale = 'en-GB') {
    const start = getCourseWeekScheduleDate(enrolledAt, weekNum, 1);
    const end = getCourseWeekScheduleDate(enrolledAt, weekNum, 7);
    const formatOptions = { day: 'numeric', month: 'short' };
    const label = `${start.toLocaleDateString(locale, formatOptions)} - ${end.toLocaleDateString(locale, formatOptions)}`;
    return { start, end, label };
}

/**
 * Returns a 12-week continuous schedule list
 */
export function getTwelveWeeksSchedule(enrolledAt, totalWeeks = 12, currentDate = new Date(), locale = 'en-GB') {
    const now = toCalendarDay(currentDate);
    const weeks = [];
    for (let w = 1; w <= totalWeeks; w++) {
        const { start, end, label } = getWeekDateRange(enrolledAt, w, locale);
        const startTime = start.getTime();
        const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999).getTime();
        const nowTime = now.getTime();

        let status = 'in-progress';
        if (nowTime < startTime) {
            status = 'upcoming';
        } else if (nowTime > endTime) {
            status = 'completed';
        }

        weeks.push({
            weekNum: w,
            start,
            end,
            label,
            status,
            isCurrent: status === 'in-progress'
        });
    }
    return weeks;
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
