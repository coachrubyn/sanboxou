/**
 * CFBD (College Football Data) API Integration
 * Documentation: https://collegefootballdata.com/
 */

// Import Player type
import type { Player } from './types'

const CFBD_API_BASE = 'https://api.collegefootballdata.com'

export interface CFBDPlayerStats {
  season: number
  playerId?: number
  player?: string
  team?: string
  conference?: string
  category?: string
  statType?: string
  stat?: number
}

export interface CFBDPlayer {
  id: number
  first_name: string
  last_name: string
  team: string
  position?: string
}

/**
 * Search for a player in CFBD database
 */
export async function searchCFBDPlayer(
  playerName: string,
  team: string = 'Oklahoma'
): Promise<CFBDPlayer | null> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_CFBD_API_KEY
    
    if (!apiKey) {
      console.warn('CFBD API key not configured')
      return null
    }

    const response = await fetch(
      `${CFBD_API_BASE}/player/search?searchTerm=${encodeURIComponent(playerName)}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      console.error(`CFBD API error: ${response.statusText}`)
      return null
    }

    const results = await response.json()
    
    // Find OU player
    const ouPlayer = results.find((p: any) => 
      p.team === 'Oklahoma' || 
      p.team === 'OU' ||
      (p.team && p.team.toLowerCase().includes('oklahoma'))
    )
    
    return ouPlayer || null
  } catch (error) {
    console.error('Error searching CFBD player:', error)
    return null
  }
}

/**
 * Get player stats from CFBD API
 */
export async function getCFBDPlayerStats(
  playerName: string,
  team: string = 'Oklahoma',
  season: number = 2024
): Promise<CFBDPlayerStats[]> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_CFBD_API_KEY
    
    if (!apiKey) {
      console.warn('CFBD API key not configured')
      return []
    }

    // First, search for the player
    const player = await searchCFBDPlayer(playerName, team)
    
    if (!player) {
      console.log(`Player ${playerName} not found in CFBD`)
      return []
    }

    // Get player stats for the season
    const response = await fetch(
      `${CFBD_API_BASE}/stats/player/season?year=${season}&team=Oklahoma`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      console.error(`CFBD API error: ${response.statusText}`)
      return []
    }

    const stats = await response.json()
    
    // Filter for specific player
    const playerStats = stats.filter((stat: any) => 
      stat.playerId === player.id || 
      stat.player?.toLowerCase().includes(playerName.toLowerCase()) ||
      (stat.firstName && stat.lastName && 
       `${stat.firstName} ${stat.lastName}`.toLowerCase() === playerName.toLowerCase())
    )

    return playerStats
  } catch (error) {
    console.error('Error fetching CFBD stats:', error)
    return []
  }
}

/**
 * Transform CFBD stats to our Player stats format
 */
export function transformCFBDStats(cfbdStats: CFBDPlayerStats[]): Player['stats'] {
  if (!cfbdStats || cfbdStats.length === 0) {
    return undefined
  }

  const transformed: Player['stats'] = {
    season: cfbdStats[0]?.season || 2024,
    games: 0
  }
  
  cfbdStats.forEach(stat => {
    const category = stat.category?.toLowerCase() || ''
    const statType = stat.statType?.toLowerCase() || ''
    const value = stat.stat || 0

    if (category === 'rushing') {
      if (statType.includes('yards') || statType === 'rushingyards') {
        transformed.rushingYards = (transformed.rushingYards || 0) + value
      }
      if (statType.includes('td') || statType === 'rushingtds') {
        transformed.touchdowns = (transformed.touchdowns || 0) + value
      }
    }
    
    if (category === 'passing') {
      if (statType.includes('yards') || statType === 'passingyards') {
        transformed.passingYards = (transformed.passingYards || 0) + value
      }
      if (statType.includes('td') || statType === 'passingtds') {
        transformed.touchdowns = (transformed.touchdowns || 0) + value
      }
    }
    
    if (category === 'receiving') {
      if (statType.includes('yards') || statType === 'receivingyards') {
        transformed.receivingYards = (transformed.receivingYards || 0) + value
      }
      if (statType.includes('td') || statType === 'receivingtds') {
        transformed.touchdowns = (transformed.touchdowns || 0) + value
      }
    }
    
    if (category === 'defensive' || category === 'defense') {
      if (statType.includes('tackle')) {
        transformed.tackles = (transformed.tackles || 0) + value
      }
      if (statType.includes('sack')) {
        transformed.sacks = (transformed.sacks || 0) + value
      }
      if (statType.includes('interception')) {
        transformed.interceptions = (transformed.interceptions || 0) + value
      }
    }
  })
  
  return transformed
}

/**
 * Transform CFBD stats by season to our format
 */
export function transformCFBDStatsBySeason(
  seasonsStats: Record<number, CFBDPlayerStats[]>
): Player['seasonStats'] {
  const transformed: Player['seasonStats'] = {}
  
  Object.entries(seasonsStats).forEach(([year, stats]) => {
    const season = parseInt(year)
    // Get the team from the stats - if player played for multiple teams in same year, use the first one
    // In most cases, all stats for a year will be from the same team
    const team = stats.length > 0 ? (stats[0].team || (stats[0] as any).teamName || (stats[0] as any).team_name || 'Unknown') : undefined
    const seasonData: NonNullable<Player['seasonStats']>[number] = {
      season,
      team
    }
    
    // Debug: Log if we see multiple teams in one season (rare case)
    if (stats.length > 1) {
      const uniqueTeams = [...new Set(stats.map((s: any) => s.team || s.teamName || s.team_name).filter(Boolean))]
      if (uniqueTeams.length > 1) {
        console.log(`Player played for multiple teams in ${season}: ${uniqueTeams.join(', ')}`)
      }
    }
    
    stats.forEach(stat => {
      const category = (stat.category || '').toLowerCase().trim()
      const statType = (stat.statType || (stat as any).stat_type || '').toString().trim()
      // Handle stat value - could be number or string
      const value = typeof stat.stat === 'string' ? parseFloat(stat.stat) || 0 : (stat.stat || 0)
      
      // Debug logging for first few stats
      if (Object.keys(transformed).length === 0 && stats.indexOf(stat) < 5) {
        console.log(`Processing stat: category="${category}", statType="${statType}", value=${value}`)
      }

      if (category === 'passing') {
        // Handle different stat type formats from CFBD
        const statUpper = statType.toUpperCase()
        if (statUpper === 'YDS' || statUpper.includes('YARD') || statUpper === 'PASSINGYARDS') {
          seasonData.passingYards = (seasonData.passingYards || 0) + Number(value)
        }
        if (statUpper === 'TD' || statUpper.includes('TOUCHDOWN') || statUpper === 'PASSINGTDS') {
          seasonData.passingTDs = (seasonData.passingTDs || 0) + Number(value)
        }
        if (statUpper === 'ATT' || statUpper.includes('ATTEMPT') || statUpper === 'ATTEMPTS') {
          seasonData.passingAttempts = (seasonData.passingAttempts || 0) + Number(value)
        }
        if (statUpper === 'COMP' || statUpper === 'COMPLETIONS' || statUpper.includes('COMPLETION')) {
          seasonData.completions = (seasonData.completions || 0) + Number(value)
        }
        if (statUpper === 'INT' || statUpper.includes('INTERCEPTION') || statUpper === 'INTERCEPTIONS') {
          seasonData.interceptions = (seasonData.interceptions || 0) + Number(value)
        }
        if (statUpper === 'PCT' || statUpper === 'COMPLETIONPERCENTAGE' || statUpper.includes('PERCENTAGE')) {
          seasonData.completionPercentage = Number(value)
        }
      }
      
      if (category === 'rushing') {
        const statUpper = statType.toUpperCase()
        if (statUpper === 'YDS' || statUpper.includes('YARD') || statUpper === 'RUSHINGYARDS') {
          seasonData.rushingYards = (seasonData.rushingYards || 0) + Number(value)
        }
        if (statUpper === 'TD' || statUpper.includes('TOUCHDOWN') || statUpper === 'RUSHINGTDS') {
          seasonData.rushingTDs = (seasonData.rushingTDs || 0) + Number(value)
        }
        if (statUpper === 'ATT' || statUpper.includes('ATTEMPT') || statUpper === 'RUSHINGATTEMPTS') {
          seasonData.rushingAttempts = (seasonData.rushingAttempts || 0) + Number(value)
        }
      }
      
      if (category === 'receiving') {
        const statUpper = statType.toUpperCase()
        if (statUpper === 'YDS' || statUpper.includes('YARD') || statUpper === 'RECEIVINGYARDS') {
          seasonData.receivingYards = (seasonData.receivingYards || 0) + Number(value)
        }
        if (statUpper === 'TD' || statUpper.includes('TOUCHDOWN') || statUpper === 'RECEIVINGTDS') {
          seasonData.receivingTDs = (seasonData.receivingTDs || 0) + Number(value)
        }
        if (statUpper === 'REC' || statUpper === 'RECEPTIONS' || statUpper.includes('RECEPTION')) {
          seasonData.receptions = (seasonData.receptions || 0) + Number(value)
        }
      }
      
      if (category === 'defensive' || category === 'defense') {
        const statUpper = statType.toUpperCase()
        if (statUpper === 'TACKLES' || statUpper === 'TOTAL' || statUpper.includes('TACKLE')) {
          seasonData.tackles = (seasonData.tackles || 0) + Number(value)
        }
        if (statUpper === 'SOLO' || statUpper === 'SOLOTACKLES') {
          seasonData.soloTackles = (seasonData.soloTackles || 0) + Number(value)
        }
        if (statUpper === 'SACKS' || statUpper.includes('SACK')) {
          seasonData.sacks = (seasonData.sacks || 0) + Number(value)
        }
        if (statUpper === 'TFL' || statUpper === 'TACKLESFORLOSS' || statUpper.includes('LOSS')) {
          seasonData.tacklesForLoss = (seasonData.tacklesForLoss || 0) + Number(value)
        }
        if (statUpper === 'INT' || statUpper === 'INTERCEPTIONS' || statUpper.includes('INTERCEPTION')) {
          seasonData.interceptions = (seasonData.interceptions || 0) + Number(value)
        }
        if (statUpper === 'PD' || statUpper === 'PASSESDEFENDED' || statUpper.includes('DEFENDED')) {
          seasonData.passesDefended = (seasonData.passesDefended || 0) + Number(value)
        }
        if (statUpper === 'QB HUR' || statUpper === 'QBHURRIES' || statUpper.includes('HURRY')) {
          seasonData.qbHurries = (seasonData.qbHurries || 0) + Number(value)
        }
        if (statUpper === 'TD' && category === 'defensive') {
          seasonData.defensiveTDs = (seasonData.defensiveTDs || 0) + Number(value)
        }
      }
      
      if (category === 'kicking' || category === 'fieldgoals') {
        const statUpper = statType.toUpperCase()
        if (statUpper === 'MADE' || statUpper.includes('MADE')) {
          seasonData.fieldGoalsMade = (seasonData.fieldGoalsMade || 0) + Number(value)
        }
        if (statUpper === 'ATT' || statUpper === 'ATTEMPTED' || statUpper.includes('ATTEMPT')) {
          seasonData.fieldGoalsAttempted = (seasonData.fieldGoalsAttempted || 0) + Number(value)
        }
        if (statUpper === 'LONG' || statUpper.includes('LONG')) {
          seasonData.fieldGoalLong = Math.max(seasonData.fieldGoalLong || 0, Number(value))
        }
        if (statUpper === 'XP' || statUpper === 'EXTRAPOINTS') {
          if (statUpper.includes('MADE')) {
            seasonData.extraPointsMade = (seasonData.extraPointsMade || 0) + Number(value)
          } else if (statUpper.includes('ATT')) {
            seasonData.extraPointsAttempted = (seasonData.extraPointsAttempted || 0) + Number(value)
          }
        }
        if (statUpper === 'POINTS' || statUpper.includes('POINT')) {
          seasonData.kickingPoints = (seasonData.kickingPoints || 0) + Number(value)
        }
      }
      
      if (category === 'punting') {
        const statUpper = statType.toUpperCase()
        if (statUpper === 'NO' || statUpper === 'PUNTS' || statUpper.includes('PUNT')) {
          seasonData.punts = (seasonData.punts || 0) + Number(value)
        }
        if (statUpper === 'YDS' || statUpper === 'YARDS' || statUpper.includes('YARD')) {
          seasonData.puntingYards = (seasonData.puntingYards || 0) + Number(value)
        }
        if (statUpper === 'LONG' || statUpper.includes('LONG')) {
          seasonData.puntingLong = Math.max(seasonData.puntingLong || 0, Number(value))
        }
        if (statUpper === 'IN 20' || statUpper === 'INSIDE20' || statUpper.includes('20')) {
          seasonData.puntsInside20 = (seasonData.puntsInside20 || 0) + Number(value)
        }
        if (statUpper === 'TB' || statUpper === 'TOUCHBACKS' || statUpper.includes('TOUCHBACK')) {
          seasonData.puntingTouchbacks = (seasonData.puntingTouchbacks || 0) + Number(value)
        }
      }
    })
    
    // Calculate completion percentage if we have completions and attempts
    if (seasonData.completions !== undefined && seasonData.passingAttempts !== undefined && seasonData.passingAttempts > 0) {
      seasonData.completionPercentage = (seasonData.completions / seasonData.passingAttempts) * 100
    }
    
    transformed[season] = seasonData
  })
  
  return transformed
}
