/**
 * Rank providers for dispatch (admin assignment UI).
 * @param {import('mongoose').Document[]} providers - User docs with providerProfile
 * @param {{ serviceCategory?: string, city?: string }} bookingLike
 * @returns {Array<{ user: object, score: number }>}
 */
function scoreProviders(providers, bookingLike) {
  const { serviceCategory, city } = bookingLike || {}
  const cat = serviceCategory ? String(serviceCategory).toLowerCase() : ''
  const cityNorm = city ? String(city).toLowerCase().trim() : ''

  const scored = providers.map((user) => {
    const p = user.providerProfile || {}
    if (p.isAvailable === false) {
      return { user, score: Number.NEGATIVE_INFINITY }
    }

    const rating = typeof p.averageRating === 'number' ? p.averageRating : 0
    const ratingScore = (rating / 5) * 35

    const skills = (p.skills || []).map((s) => String(s).toLowerCase())
    const skillMatch = cat && skills.some((s) => s.includes(cat) || cat.includes(s)) ? 25 : 0

    const provCity = (p.serviceCity && String(p.serviceCity).toLowerCase().trim()) || ''
    const cityMatch = cityNorm && provCity && provCity === cityNorm ? 20 : 0

    const completed = p.completedJobs || 0
    const totalAssigned = Math.max(completed, 1)
    const completionRate = (completed / totalAssigned) * 15

    let penalty = 0
    if (p.lastJobAt && Date.now() - new Date(p.lastJobAt).getTime() < 60 * 60 * 1000) {
      penalty = 5
    }

    const score = ratingScore + skillMatch + cityMatch + completionRate - penalty
    return { user, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored
}

module.exports = { scoreProviders }
