/**
 * Utility to manage face verification time periods (Shifts)
 */

export const FACE_PERIODS = {
    MORNING: { name: 'morning', start: 5, end: 12 },   // 05:00 - 11:59
    AFTERNOON: { name: 'afternoon', start: 12, end: 17 }, // 12:00 - 16:59
    EVENING: { name: 'evening', start: 17, end: 21 },   // 17:00 - 20:59
    NIGHT: { name: 'night', start: 21, end: 5 }        // 21:00 - 04:59 (next day)
}

/**
 * Determines the current period based on local time
 * @returns {string} One of 'morning', 'afternoon', 'evening', 'night'
 */
export function getCurrentFacePeriod() {
    const hour = new Date().getHours()

    if (hour >= FACE_PERIODS.MORNING.start && hour < FACE_PERIODS.MORNING.end) return FACE_PERIODS.MORNING.name
    if (hour >= FACE_PERIODS.AFTERNOON.start && hour < FACE_PERIODS.AFTERNOON.end) return FACE_PERIODS.AFTERNOON.name
    if (hour >= FACE_PERIODS.EVENING.start && hour < FACE_PERIODS.EVENING.end) return FACE_PERIODS.EVENING.name
    
    // Night spans across midnight (21:00 to 05:00)
    return FACE_PERIODS.NIGHT.name
}

/**
 * Gets the "Face Verification Date". 
 * For the 'night' shift (after midnight), the date technically belongs to the previous day's shift cycle.
 * @returns {string} YYYY-MM-DD
 */
export function getFaceCheckDate() {
    const now = new Date()
    const hour = now.getHours()
    
    // If it's early morning (e.g. 2 AM), it's still part of the 'night' shift of the previous day
    if (hour < FACE_PERIODS.MORNING.start) {
        const prevDay = new Date(now)
        prevDay.setDate(now.getDate() - 1)
        return prevDay.toISOString().split('T')[0]
    }
    
    return now.toISOString().split('T')[0]
}
