import { Player } from './types'
import { generateOUHeadshotUrl } from './ou-headshots'
import { transformCFBDStats } from './cfbd-api'
import { determinePlayerStatus } from './status-determiner'
import { generateInjuryFlags } from './injury-flags'

/**
 * Fetch roster data from API
 */
export async function getRosterPlayers(): Promise<{ count: number; data: Player[]; error?: string; rateLimitExceeded?: boolean }> {
  try {
    const response = await fetch('/api/roster')
    const result = await response.json()
    
    if (result.error) {
      return { 
        count: 0, 
        data: [], 
        error: result.message || result.error,
        rateLimitExceeded: result.rateLimitExceeded || false
      }
    }

    // Process players: add headshots, determine status, etc.
    const processedPlayers: Player[] = (result.data || []).map((player: any) => {
      // Generate headshot if not provided
      const headshot = player.headshot || generateOUHeadshotUrl(player.name)
      
      // Determine status if not explicitly set
      const status = player.status || determinePlayerStatus(player as Player)
      
      // Generate injury flags if not provided
      const playerWithData = {
        ...player,
        headshot,
        status,
      } as Player
      
      const injuryFlags = player.injuryFlags || generateInjuryFlags(playerWithData)
      
      return {
        ...playerWithData,
        injuryFlags,
      } as Player
    })

    return {
      count: processedPlayers.length,
      data: processedPlayers
    }
  } catch (error) {
    console.error('Error fetching roster:', error)
    return {
      count: 0,
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Fetch CFBD stats for a player
 */
export async function getPlayerCFBDStats(
  playerName: string,
  season: number = 2024
): Promise<Player['stats'] | undefined> {
  try {
    const response = await fetch(
      `/api/cfbd-stats?player=${encodeURIComponent(playerName)}&season=${season}`
    )
    const result = await response.json()
    
    if (result.error || !result.data || result.data.length === 0) {
      return undefined
    }

    return transformCFBDStats(result.data)
  } catch (error) {
    console.error('Error fetching CFBD stats:', error)
    return undefined
  }
}

/**
 * Get player by name from roster
 */
export async function getPlayerByName(playerName: string): Promise<Player | null> {
  const roster = await getRosterPlayers()
  const player = roster.data.find(p => 
    p.name.toLowerCase() === playerName.toLowerCase()
  )
  
  if (!player) return null
  
  // Fetch CFBD stats if available
  const stats = await getPlayerCFBDStats(playerName)
  
  return {
    ...player,
    stats
  }
}
