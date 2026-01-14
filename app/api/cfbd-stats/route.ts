import { NextRequest, NextResponse } from 'next/server'
import { getCachedData, saveCachedData } from '@/lib/redis-cache'

const CFBD_STATS_CACHE_TTL_SECONDS = 6 * 60 * 60 // 6 hours

function getCFBDStatsCacheKey(playerName: string, season: string, team: string): string {
  return `cfbd-stats:${playerName.toLowerCase()}:${season}:${team}`
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const playerName = searchParams.get('player')
  const season = searchParams.get('season') || '2024'
  const team = searchParams.get('team') || 'Oklahoma'
  const forceRefresh = searchParams.get('refresh') === 'true'
  
  if (!playerName) {
    return NextResponse.json(
      { error: 'Player name required' },
      { status: 400 }
    )
  }

  try {
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cacheKey = getCFBDStatsCacheKey(playerName, season, team)
      const cachedData = await getCachedData(cacheKey)
      if (cachedData) {
        console.log(`[CACHE] Returning cached CFBD stats for ${playerName}, season ${season}`)
        return NextResponse.json({
          count: cachedData.count || cachedData.data?.length || 0,
          data: cachedData.data || cachedData,
          player: cachedData.player,
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

    // First, search for the player
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
    
    // Find OU player
    const ouPlayer = searchResults.find((p: any) => 
      p.team === 'Oklahoma' || 
      p.team === 'OU' ||
      (p.team && p.team.toLowerCase().includes('oklahoma'))
    )

    if (!ouPlayer) {
      return NextResponse.json({
        count: 0,
        data: [],
        message: `Player ${playerName} not found for ${team}`
      })
    }

    // Get player stats for the season
    const statsResponse = await fetch(
      `https://api.collegefootballdata.com/stats/player/season?year=${season}&team=${team}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        }
      }
    )

    if (!statsResponse.ok) {
      throw new Error(`CFBD API stats error: ${statsResponse.statusText}`)
    }

    const stats = await statsResponse.json()
    
    // Filter for specific player
    const playerStats = stats.filter((stat: any) => 
      stat.playerId === ouPlayer.id || 
      stat.player?.toLowerCase().includes(playerName.toLowerCase()) ||
      (stat.firstName && stat.lastName && 
       `${stat.firstName} ${stat.lastName}`.toLowerCase() === playerName.toLowerCase())
    )

    const result = {
      count: playerStats.length,
      data: playerStats,
      player: ouPlayer
    }

    // Save to cache
    const cacheKey = getCFBDStatsCacheKey(playerName, season, team)
    await saveCachedData(cacheKey, result, CFBD_STATS_CACHE_TTL_SECONDS)

    return NextResponse.json({
      ...result,
      cached: false
    })
  } catch (error) {
    console.error('Error fetching CFBD stats:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch CFBD stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
