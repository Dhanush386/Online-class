import { describe, it, expect } from 'vitest'
import {
    toCalendarDay,
    getEffectiveStartDate,
    calculateAccessibleDay,
    getItemAbsoluteDay,
    isItemUnlocked,
    getItemUnlockTargetDate
} from '../utils/dayAccessEngine'

describe('dayAccessEngine — 6:00 PM Cutoff & Calendar Day Logic', () => {
    it('normalizes dates to local calendar midnight', () => {
        const d = new Date(2026, 8, 7, 15, 30, 45) // Sep 7, 2026 3:30:45 PM
        const cal = toCalendarDay(d)
        expect(cal.getFullYear()).toBe(2026)
        expect(cal.getMonth()).toBe(8) // 0-based Sep
        expect(cal.getDate()).toBe(7)
        expect(cal.getHours()).toBe(0)
        expect(cal.getMinutes()).toBe(0)
        expect(cal.getSeconds()).toBe(0)
    })

    describe('getEffectiveStartDate', () => {
        it('enrollment at Sep 7, 3:30 PM (15:30) -> Effective Day 1 is Sep 7', () => {
            const enrolledAt = new Date(2026, 8, 7, 15, 30, 0)
            const effectiveStart = getEffectiveStartDate(enrolledAt)
            expect(effectiveStart.getDate()).toBe(7)
            expect(effectiveStart.getMonth()).toBe(8)
        })

        it('enrollment at Sep 7, 5:59 PM (17:59) -> Effective Day 1 is Sep 7', () => {
            const enrolledAt = new Date(2026, 8, 7, 17, 59, 59)
            const effectiveStart = getEffectiveStartDate(enrolledAt)
            expect(effectiveStart.getDate()).toBe(7)
        })

        it('enrollment at Sep 7, 6:00 PM (18:00) -> Effective Day 1 is Sep 8 (next day)', () => {
            const enrolledAt = new Date(2026, 8, 7, 18, 0, 0)
            const effectiveStart = getEffectiveStartDate(enrolledAt)
            expect(effectiveStart.getDate()).toBe(8)
        })

        it('enrollment at Sep 7, 6:30 PM (18:30) -> Effective Day 1 is Sep 8', () => {
            const enrolledAt = new Date(2026, 8, 7, 18, 30, 0)
            const effectiveStart = getEffectiveStartDate(enrolledAt)
            expect(effectiveStart.getDate()).toBe(8)
        })

        it('enrollment at Sep 7, 11:59 PM (23:59) -> Effective Day 1 is Sep 8', () => {
            const enrolledAt = new Date(2026, 8, 7, 23, 59, 59)
            const effectiveStart = getEffectiveStartDate(enrolledAt)
            expect(effectiveStart.getDate()).toBe(8)
        })

        it('enrollment at Sep 8, 12:00 AM (00:00) -> Effective Day 1 is Sep 8', () => {
            const enrolledAt = new Date(2026, 8, 8, 0, 0, 0)
            const effectiveStart = getEffectiveStartDate(enrolledAt)
            expect(effectiveStart.getDate()).toBe(8)
        })
    })

    describe('calculateAccessibleDay — Progression Matrix', () => {
        it('enrolled Sep 7 at 3:30 PM: Accessible Day is 1 on Sep 7 at 10 PM', () => {
            const enrolledAt = new Date(2026, 8, 7, 15, 30, 0)
            const now = new Date(2026, 8, 7, 22, 0, 0)
            expect(calculateAccessibleDay(enrolledAt, now)).toBe(1)
        })

        it('enrolled Sep 7 at 6:00 PM: Accessible Day is 0 (locked) on Sep 7 at 10 PM', () => {
            const enrolledAt = new Date(2026, 8, 7, 18, 0, 0)
            const now = new Date(2026, 8, 7, 22, 0, 0)
            expect(calculateAccessibleDay(enrolledAt, now)).toBe(0)
        })

        it('enrolled Sep 7 at 6:00 PM: Accessible Day is 1 on Sep 8 at 12:00 AM', () => {
            const enrolledAt = new Date(2026, 8, 7, 18, 0, 0)
            const now = new Date(2026, 8, 8, 0, 0, 0)
            expect(calculateAccessibleDay(enrolledAt, now)).toBe(1)
        })

        it('continuous day-by-day unlocking: Sep 8 -> Day 1, Sep 9 -> Day 2, Sep 10 -> Day 3', () => {
            // Student effectively starts on Sep 8
            const enrolledAt = new Date(2026, 8, 7, 19, 0, 0) // Enrolled Sep 7 after 6 PM
            
            const sep8 = new Date(2026, 8, 8, 14, 0, 0)
            const sep9 = new Date(2026, 8, 9, 10, 0, 0)
            const sep10 = new Date(2026, 8, 10, 8, 0, 0)

            expect(calculateAccessibleDay(enrolledAt, sep8)).toBe(1)
            expect(calculateAccessibleDay(enrolledAt, sep9)).toBe(2)
            expect(calculateAccessibleDay(enrolledAt, sep10)).toBe(3)
        })
    })

    describe('isItemUnlocked — Free Day Access without sequential barrier', () => {
        it('unlocks recorded lesson on Day 1 when student is on Day 1', () => {
            const item = { id: 'v1', day_number: 1, video_url: 'https://supabase.co/storage/video.mp4' }
            const status = isItemUnlocked({ item, type: 'video', accessibleDay: 1 })
            expect(status.isLocked).toBe(false)
        })

        it('unlocks quiz and coding challenge on Day 1 even if video is not completed', () => {
            const quizItem = { id: 'q1', day_number: 1 }
            const codingItem = { id: 'c1', day_number: 1 }

            expect(isItemUnlocked({ item: quizItem, type: 'assessment', accessibleDay: 1 }).isLocked).toBe(false)
            expect(isItemUnlocked({ item: codingItem, type: 'coding', accessibleDay: 1 }).isLocked).toBe(false)
        })

        it('locks Day 2 items when student is on Day 1 with "Unlocks tomorrow"', () => {
            const day2Video = { id: 'v2', day_number: 2, video_url: 'https://drive.google.com/file/d/xyz' }
            const status = isItemUnlocked({ item: day2Video, type: 'video', accessibleDay: 1 })
            expect(status.isLocked).toBe(true)
            expect(status.reason).toContain('tomorrow')
        })

        it('locks Day 3 items when student is on Day 1 with "Unlocks in 2 days"', () => {
            const day3Item = { id: 'v3', day_number: 3 }
            const status = isItemUnlocked({ item: day3Item, type: 'video', accessibleDay: 1 })
            expect(status.isLocked).toBe(true)
            expect(status.reason).toBe('Unlocks in 2 days.')
        })

        it('locks all items if accessibleDay is 0 (enrolled after 6 PM today)', () => {
            const day1Item = { id: 'v1', day_number: 1 }
            const status = isItemUnlocked({ item: day1Item, type: 'video', accessibleDay: 0 })
            expect(status.isLocked).toBe(true)
            expect(status.reason).toContain('tomorrow')
        })
        it('unlocks early if item.id is in earlyUnlockedIds', () => {
            const day3Item = { id: 'v3-early', week_number: 1, day_of_week: 3 }
            const status = isItemUnlocked({
                item: day3Item,
                type: 'video',
                accessibleDay: 1,
                earlyUnlockedIds: ['v3-early']
            })
            expect(status.isLocked).toBe(false)
            expect(status.isEarlyUnlocked).toBe(true)
        })
    })

    describe('getItemUnlockTargetDate', () => {
        it('calculates exact 12:00 AM date for future day item', () => {
            // Enrolled Sep 7 before 6 PM -> Day 1 is Sep 7
            const enrolledAt = new Date(2026, 8, 7, 10, 0, 0)
            // Item on Day 3 (Week 1 Day 3) -> Day 3 unlocks Sep 9 at 12:00 AM
            const day3Item = { week_number: 1, day_of_week: 3 }
            const targetDate = getItemUnlockTargetDate(day3Item, enrolledAt)

            expect(targetDate.getFullYear()).toBe(2026)
            expect(targetDate.getMonth()).toBe(8) // Sep
            expect(targetDate.getDate()).toBe(9)
            expect(targetDate.getHours()).toBe(0)
            expect(targetDate.getMinutes()).toBe(0)
            expect(targetDate.getSeconds()).toBe(0)
        })
    })

    describe('getItemAbsoluteDay', () => {
        it('prefers explicit day_number when week/dow are not specified', () => {
            expect(getItemAbsoluteDay({ day_number: 5 })).toBe(5)
        })

        it('computes day from week_number and day_of_week', () => {
            // Week 2 Day 3 -> (2 - 1) * 7 + 3 = 10
            expect(getItemAbsoluteDay({ week_number: 2, day_of_week: 3 })).toBe(10)
        })

        it('computes day from week_number and day_of_week even if legacy day_number=1 is present in DB row', () => {
            // Week 2 Day 3 with DB default day_number: 1 -> should still be 10, not 1!
            expect(getItemAbsoluteDay({ week_number: 2, day_of_week: 3, day_number: 1 })).toBe(10)
            // Week 1 Day 6 with DB default day_number: 1 -> should be 6, not 1!
            expect(getItemAbsoluteDay({ week_number: 1, day_of_week: 6, day_number: 1 })).toBe(6)
            // Week 1 Day 1 -> should be 1
            expect(getItemAbsoluteDay({ week_number: 1, day_of_week: 1, day_number: 1 })).toBe(1)
        })
    })
})
