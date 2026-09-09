import { describe, it, expect } from 'vitest'
import { calculateCourseProgress } from '../utils/progressSync'

describe('calculateCourseProgress', () => {
    it('returns 0% when no curriculum items exist', () => {
        const result = calculateCourseProgress([], [], [], [], [], [])
        expect(result.percentage).toBe(0)
        expect(result.totalTopics).toBe(0)
        expect(result.completedTopics).toBe(0)
    })

    it('correctly calculates 2 out of 14 completed items as 14%', () => {
        const vids = [
            { id: 'v1' }, { id: 'v2' }, { id: 'v3' }, { id: 'v4' }, { id: 'v5' }
        ]
        const chls = [
            { id: 'c1' }, { id: 'c2' }
        ]
        const assess = [
            { id: 'a1' }, { id: 'a2' }, { id: 'a3' }, { id: 'a4' }, { id: 'a5' }, { id: 'a6' }, { id: 'a7' }
        ]
        // Total items = 5 + 2 + 7 = 14
        const vpData = [{ video_id: 'v1' }, { video_id: 'v2' }]
        const codingSubs = []
        const assessSubs = []

        const result = calculateCourseProgress(vids, chls, assess, vpData, codingSubs, assessSubs)
        expect(result.totalTopics).toBe(14)
        expect(result.completedTopics).toBe(2)
        expect(result.percentage).toBe(14) // Math.round(2/14 * 100) = 14
    })

    it('correctly calculates 100% when all items are completed', () => {
        const vids = [{ id: 'v1' }]
        const chls = [{ id: 'c1' }]
        const assess = [{ id: 'a1' }]
        const vpData = [{ video_id: 'v1' }]
        const codingSubs = [{ challenge_id: 'c1', status: 'accepted' }]
        const assessSubs = [{ assessment_id: 'a1' }]

        const result = calculateCourseProgress(vids, chls, assess, vpData, codingSubs, assessSubs)
        expect(result.totalTopics).toBe(3)
        expect(result.completedTopics).toBe(3)
        expect(result.percentage).toBe(100)
    })

    it('ignores rejected coding submissions', () => {
        const chls = [{ id: 'c1' }]
        const codingSubs = [{ challenge_id: 'c1', status: 'failed' }]

        const result = calculateCourseProgress([], chls, [], [], codingSubs, [])
        expect(result.totalTopics).toBe(1)
        expect(result.completedTopics).toBe(0)
        expect(result.percentage).toBe(0)
    })
})
