import { describe, it, expect } from 'vitest'
import { getRankName, getTierForXP, getLevelProgress, XP_TIERS } from '../constants/ranks'
import { calculateXpReward, getQuizEventType } from '../constants/xpRewards'

describe('XP & Rank Calculation Engine', () => {
  it('assigns Iron I rank for starting 0 XP', () => {
    expect(getRankName(0)).toBe('Iron I')
  })

  it('correctly maps tiers as XP compounds', () => {
    expect(getTierForXP(0).name).toBe('Iron')
    expect(getTierForXP(1200).name).toBe('Bronze')
    expect(getTierForXP(3600).name).toBe('Gold')
    expect(getTierForXP(8000).name).toBe('Diamond')
  })

  it('calculates sub-level progress percentage accurately', () => {
    // 100 XP into 200 step tier = 50%
    expect(getLevelProgress(100)).toBe(50)
  })

  it('maps quiz percentages to correct XP reward tiers', () => {
    expect(getQuizEventType(100)).toBe('quiz_high')
    expect(getQuizEventType(65)).toBe('quiz_mid')
    expect(getQuizEventType(30)).toBe('quiz_low')
  })
})

