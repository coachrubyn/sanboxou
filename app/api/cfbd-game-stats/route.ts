import { NextRequest, NextResponse } from 'next/server'
import { getCachedData, saveCachedData } from '@/lib/redis-cache'

const GAME_STATS_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days - ensures game stats persist

function getGameStatsCacheKey(playerId: string, year: string, team?: string): string {
  return team ? `game-stats:${playerId}:${year}:${team}` : `game-stats:${playerId}:${year}`
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const playerId = searchParams.get('playerId')
  const year = searchParams.get('year') || '2025'
  const team = searchParams.get('team') // Make team optional - don't default to Oklahoma
  const forceRefresh = searchParams.get('refresh') === 'true'
  
  if (!playerId) {
    return NextResponse.json(
      { error: 'Player ID is required' },
      { status: 400 }
    )
  }

  try {
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cacheKey = getGameStatsCacheKey(playerId, year, team || undefined)
      const cachedData = await getCachedData(cacheKey)
      if (cachedData) {
        console.log(`[CACHE] Returning cached game stats for player ${playerId}, year ${year}`)
        return NextResponse.json({
          success: true,
          data: cachedData,
          year: parseInt(year),
          cached: true
        })
      }
    }

    const apiKey = process.env.CFBD_API_KEY || process.env.NEXT_PUBLIC_CFBD_API_KEY
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'CFBD API key not configured' },
        { status: 500 }
      )
    }

    // Build API URL - if team is provided, use it; otherwise fetch all games for the year
    // Note: CFBD API may require team filter, so we'll try with common teams if no team specified
    let gameStatsData: any[] = []
    let gamesData: any[] = []
    
    if (team) {
      // Fetch for specific team
      const gameStatsResponse = await fetch(
        `https://api.collegefootballdata.com/games/players?year=${year}&team=${team}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
          }
        }
      )

      if (gameStatsResponse.ok) {
        gameStatsData = await gameStatsResponse.json()
      }
      
      const gamesResponse = await fetch(
        `https://api.collegefootballdata.com/games?year=${year}&team=${team}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
          }
        }
      )

      if (gamesResponse.ok) {
        gamesData = await gamesResponse.json()
      }
    } else {
      // Try to fetch for multiple common teams the player might have played for
      // First, try to get player info to see what teams they played for
      const teamsToTry = ['Oklahoma', 'OU'] // Add more teams if needed
      
      for (const teamToTry of teamsToTry) {
        try {
          const gameStatsResponse = await fetch(
            `https://api.collegefootballdata.com/games/players?year=${year}&team=${teamToTry}`,
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json'
              }
            }
          )

          if (gameStatsResponse.ok) {
            const data = await gameStatsResponse.json()
            gameStatsData.push(...data)
          }
          
          const gamesResponse = await fetch(
            `https://api.collegefootballdata.com/games?year=${year}&team=${teamToTry}`,
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json'
              }
            }
          )

          if (gamesResponse.ok) {
            const data = await gamesResponse.json()
            // Merge games data, avoiding duplicates
            const existingGameIds = new Set(gamesData.map(g => g.id))
            gamesData.push(...data.filter((g: any) => !existingGameIds.has(g.id)))
          }
        } catch (error) {
          console.error(`Error fetching for team ${teamToTry}:`, error)
        }
      }
    }

    // Transform CFBD game stats to our format
    const transformedGameStats: any[] = []
    
    for (const gameStat of gameStatsData) {
      const gameId = gameStat.id
      const gameInfo = gamesData.find((g: any) => g.id === gameId)
      
      if (!gameInfo) continue
      
      // Find the team that contains the player (could be any team in the game)
      let playerTeam = null
      for (const teamInGame of gameStat.teams || []) {
        // Check if this team has the player
        let hasPlayer = false
        for (const category of teamInGame.categories || []) {
          if (category.types) {
            for (const type of category.types) {
              if (type.athletes) {
                const player = type.athletes.find((p: any) => 
                  String(p.id) === String(playerId) ||
                  String(p.playerId) === String(playerId)
                )
                if (player) {
                  hasPlayer = true
                  break
                }
              }
            }
          }
          if (hasPlayer) break
        }
        if (hasPlayer) {
          playerTeam = teamInGame
          break
        }
      }
      
      if (!playerTeam) continue
      
      // Find the player in the categories
      let playerFound = false
      const playerStats: Record<string, number> = {}
      
      for (const category of playerTeam.categories || []) {
        // Check if category has types with athletes (players)
        if (category.types) {
          for (const type of category.types) {
            if (type.athletes) {
              const player = type.athletes.find((p: any) => 
                String(p.id) === String(playerId) ||
                String(p.playerId) === String(playerId)
              )
              
              if (player) {
                playerFound = true
                // Extract stat value from player.stat
                if (player.stat !== undefined && player.stat !== null) {
                  const statKey = mapStatName(category.name || '', type.name || '')
                  if (statKey) {
                    const statValue = parseFloat(String(player.stat)) || 0
                    // Sum if multiple entries for same stat
                    playerStats[statKey] = (playerStats[statKey] || 0) + statValue
                  }
                }
              }
            }
          }
        }
      }
      
      if (playerFound) {
        // Determine opponent (the other team in the game)
        const playerTeamName = playerTeam.team || ''
        const opponentTeam = gameStat.teams?.find((t: any) => 
          t.team !== playerTeamName
        )
        const opponent = opponentTeam?.team || 'Unknown'
        
        transformedGameStats.push({
          gameId: String(gameId),
          date: gameInfo.start_date || gameInfo.startDate || new Date().toISOString(),
          opponent: opponent,
          stats: playerStats,
          quarters: [], // CFBD doesn't provide quarter-by-quarter breakdown in this endpoint
          coachGrade: undefined // This is subjective and not from CFBD
        })
      }
    }
    
    // Sort by date
    transformedGameStats.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    // Save to cache
    const cacheKey = getGameStatsCacheKey(playerId, year, team || undefined)
    await saveCachedData(cacheKey, transformedGameStats, GAME_STATS_CACHE_TTL_SECONDS)

    return NextResponse.json({
      success: true,
      data: transformedGameStats,
      year: parseInt(year),
      cached: false
    })
  } catch (error) {
    console.error('Error fetching CFBD game stats:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch CFBD game stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Helper function to map CFBD stat names to our internal format
function mapStatName(category: string, stat: string): string | null {
  const categoryLower = category.toLowerCase()
  const statLower = stat.toLowerCase()
  
  // Passing stats
  if (categoryLower.includes('pass') || statLower.includes('pass')) {
    if (statLower.includes('yards') || statLower.includes('yds')) return 'passingYards'
    if (statLower.includes('touchdown') || statLower.includes('td')) return 'passingTDs'
    if (statLower.includes('attempt')) return 'passingAttempts'
    if (statLower.includes('completion')) return 'completions'
    if (statLower.includes('interception') || statLower.includes('int')) return 'interceptions'
  }
  
  // Rushing stats
  if (categoryLower.includes('rush') || statLower.includes('rush')) {
    if (statLower.includes('yards') || statLower.includes('yds')) return 'rushingYards'
    if (statLower.includes('touchdown') || statLower.includes('td')) return 'rushingTDs'
    if (statLower.includes('attempt') || statLower.includes('carry')) return 'rushingAttempts'
  }
  
  // Receiving stats
  if (categoryLower.includes('receiv') || statLower.includes('receiv')) {
    if (statLower.includes('yards') || statLower.includes('yds')) return 'receivingYards'
    if (statLower.includes('touchdown') || statLower.includes('td')) return 'receivingTDs'
    if (statLower.includes('reception') || statLower.includes('catch')) return 'receptions'
  }
  
  // Defensive stats
  if (categoryLower.includes('defense') || categoryLower.includes('tackle')) {
    if (statLower.includes('tackle') && !statLower.includes('loss')) return 'tackles'
    if (statLower.includes('sack')) return 'sacks'
    if (statLower.includes('tackle') && statLower.includes('loss')) return 'tacklesForLoss'
    if (statLower.includes('pass') && statLower.includes('defend')) return 'passesDefended'
    if (statLower.includes('hurry')) return 'qbHurries'
  }
  
  // Kicking stats
  if (categoryLower.includes('kick') || statLower.includes('field goal')) {
    if (statLower.includes('field goal') && statLower.includes('made')) return 'fieldGoalsMade'
    if (statLower.includes('field goal') && statLower.includes('attempt')) return 'fieldGoalsAttempted'
    if (statLower.includes('extra point') && statLower.includes('made')) return 'extraPointsMade'
    if (statLower.includes('extra point') && statLower.includes('attempt')) return 'extraPointsAttempted'
  }
  
  return null
}
