// ============================================================
// XP Rank / Tier System — Single Source of Truth
// Import from here instead of re-defining in each component
// ============================================================

export const XP_TIERS = [
  { name: 'Iron',    color: '#94a3b8', base: 0,    step: 200  },
  { name: 'Bronze',  color: '#b45309', base: 1000, step: 200  },
  { name: 'Silver',  color: '#64748b', base: 2000, step: 300  },
  { name: 'Gold',    color: '#f59e0b', base: 3500, step: 800  },
  { name: 'Diamond', color: '#a855f7', base: 7500, step: 1000 },
]

export const ROMAN_LEVELS = ['I', 'II', 'III', 'IV', 'V']

/**
 * Returns the tier object for a given XP value.
 * @param {number} xp
 * @returns {{ name: string, color: string, base: number, step: number }}
 */
export function getTierForXP(xp) {
  for (let i = XP_TIERS.length - 1; i >= 0; i--) {
    if (xp >= XP_TIERS[i].base) return XP_TIERS[i]
  }
  return XP_TIERS[0]
}

/**
 * Returns the full rank name (e.g. "Gold III") for a given XP value.
 * @param {number} xp
 * @returns {string}
 */
export function getRankName(xp) {
  const tier = getTierForXP(xp)
  const xpInTier = xp - tier.base
  const levelNum = Math.min(5, Math.floor(xpInTier / tier.step) + 1)
  return `${tier.name} ${ROMAN_LEVELS[Math.max(0, levelNum - 1)]}`
}

/**
 * Returns progress (0–100) within the current level sub-step.
 * @param {number} xp
 * @returns {number}
 */
export function getLevelProgress(xp) {
  const tier = getTierForXP(xp)
  const xpInTier = xp - tier.base
  return Math.min(100, Math.round((xpInTier % tier.step) / tier.step * 100))
}
