import { NextRequest, NextResponse } from 'next/server'
import { getCachedPlayerStats, savePlayerStatsToCache } from '@/lib/cache'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const playerName = searchParams.get('player')
  const playerId = searchParams.get('playerId') // Optional: use player ID if available (more reliable)
  const team = searchParams.get('team') || 'Oklahoma'
  const startYear = parseInt(searchParams.get('startYear') || '2020')
  const endYear = parseInt(searchParams.get('endYear') || new Date().getFullYear().toString())
  const forceRefresh = searchParams.get('refresh') === 'true' // Force refresh cache
  
  if (!playerName && !playerId) {
    return NextResponse.json(
      { error: 'Player name or player ID required' },
      { status: 400 }
    )
  }

  try {
    const apiKey = process.env.CFBD_API_KEY || process.env.NEXT_PUBLIC_CFBD_API_KEY
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'CFBD API key not configured' },
        { status: 500 }
      )
    }

    // If we have a player ID, use it directly (more reliable than name search)
    let finalPlayerId: string | null = null
    let playerInfo: any = null
    
    if (playerId) {
      // Use the provided player ID directly
      finalPlayerId = playerId
      console.log(`Using provided player ID: ${playerId}`)
    } else if (playerName) {
      // Search for the player by name
      const searchResponse = await fetch(
        `https://api.collegefootballdata.com/player/search?searchTerm=${encodeURIComponent(playerName)}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
          }
        }
      )

      if (!searchResponse.ok) {
        throw new Error(`CFBD API search error: ${searchResponse.statusText}`)
      }

      const searchResults = await searchResponse.json()
      
      // Find OU player - the search results have firstName and lastName (camelCase)
      let ouPlayer = searchResults.find((p: any) => {
        const isOU = p.team === 'Oklahoma' || p.team === 'OU' || (p.team && p.team.toLowerCase().includes('oklahoma'))
        if (!isOU) return false
        
        // Try matching with name field
        if (p.name && p.name.toLowerCase() === playerName.toLowerCase()) return true
        
        // Try matching with firstName + lastName
        const fullName = p.firstName && p.lastName 
          ? `${p.firstName} ${p.lastName}`.toLowerCase()
          : ''
        if (fullName === playerName.toLowerCase()) return true
        
        // Try matching with first_name + last_name (snake_case)
        const fullNameSnake = p.first_name && p.last_name
          ? `${p.first_name} ${p.last_name}`.toLowerCase()
          : ''
        if (fullNameSnake === playerName.toLowerCase()) return true
        
        return false
      })
      
      // If no exact match, try partial name match
      if (!ouPlayer) {
        ouPlayer = searchResults.find((p: any) => {
          const isOU = p.team === 'Oklahoma' || p.team === 'OU' || (p.team && p.team.toLowerCase().includes('oklahoma'))
          if (!isOU) return false
          
          const name = (p.name || '').toLowerCase()
          const fullName = p.firstName && p.lastName 
            ? `${p.firstName} ${p.lastName}`.toLowerCase()
            : p.first_name && p.last_name
            ? `${p.first_name} ${p.last_name}`.toLowerCase()
            : ''
          
          return name.includes(playerName.toLowerCase()) || fullName.includes(playerName.toLowerCase())
        })
      }

      if (!ouPlayer) {
        console.log(`Player ${playerName} not found. Search results:`, searchResults.slice(0, 5))
        return NextResponse.json({
          count: 0,
          data: [],
          message: `Player ${playerName} not found for ${team}`,
          searchResults: searchResults.slice(0, 10) // Return first 10 results for debugging
        })
      }
      
      playerInfo = ouPlayer
      finalPlayerId = ouPlayer.id || ouPlayer.playerId
      console.log(`Found player: ${ouPlayer.name || `${ouPlayer.firstName || ouPlayer.first_name} ${ouPlayer.lastName || ouPlayer.last_name}`} (ID: ${finalPlayerId})`)
    }
    
    if (!finalPlayerId) {
      return NextResponse.json({
        count: 0,
        data: [],
        message: 'Could not determine player ID'
      })
    }

    // Check cache now that we have the player ID (unless force refresh is requested)
    if (!forceRefresh) {
      const cachedData = getCachedPlayerStats(finalPlayerId)
      if (cachedData) {
        console.log(`Returning cached stats for player ${finalPlayerId} (${cachedData.playerName || 'unknown'})`)
        return NextResponse.json({
          count: Object.keys(cachedData.data).length,
          data: cachedData.data,
          player: playerInfo || { id: finalPlayerId, name: cachedData.playerName || playerName || 'Unknown' },
          cached: true,
          cachedAt: new Date(cachedData.cachedAt).toISOString()
        })
      }
    }

    // Cache miss or force refresh - fetch from API
    console.log(`Cache miss for player ${finalPlayerId}, fetching from CFBD API...`)

    // Fetch stats for multiple seasons
    // Note: We fetch stats without team filter to get stats from all schools the player played at
    const seasonsStats: Record<number, any[]> = {}
    
    for (let year = startYear; year <= endYear; year++) {
      try {
        // Fetch stats without team filter to get all stats for the player across all schools
        const statsResponse = await fetch(
          `https://api.collegefootballdata.com/stats/player/season?year=${year}`,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Accept': 'application/json'
            }
          }
        )

        if (statsResponse.ok) {
          const stats = await statsResponse.json()
          
          // Filter for specific player using player ID (this will get stats from all teams)
          const playerStats = stats.filter((stat: any) => {
            // Match by player ID (most reliable)
            if (stat.playerId && finalPlayerId && String(stat.playerId) === String(finalPlayerId)) {
              return true
            }
            
            // Match by player name as fallback (only if we have playerName)
            if (playerName) {
              const statPlayerName = stat.player || (stat.firstName && stat.lastName ? `${stat.firstName} ${stat.lastName}` : '')
              if (statPlayerName && statPlayerName.toLowerCase() === playerName.toLowerCase()) {
                return true
              }
            }
            
            return false
          })

          if (playerStats.length > 0) {
            // Group stats by team if player played for multiple teams in same year (rare but possible)
            // For now, we'll combine all stats for the year - the transform function will handle team extraction
            seasonsStats[year] = playerStats
          }
        }
      } catch (error) {
        console.error(`Error fetching stats for year ${year}:`, error)
        // Continue to next year
      }
    }

    // Save to cache if we have a player ID
    if (finalPlayerId && Object.keys(seasonsStats).length > 0) {
      const playerDisplayName = playerInfo?.name || 
                                (playerInfo?.firstName && playerInfo?.lastName 
                                  ? `${playerInfo.firstName} ${playerInfo.lastName}` 
                                  : playerName) || 
                                'Unknown'
      savePlayerStatsToCache(finalPlayerId, playerDisplayName, seasonsStats)
    }

    return NextResponse.json({
      count: Object.keys(seasonsStats).length,
      data: seasonsStats,
      player: playerInfo || { id: finalPlayerId, name: playerName || 'Unknown' },
      cached: false
    })
  } catch (error) {
    console.error('Error fetching multi-season stats:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch player stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
