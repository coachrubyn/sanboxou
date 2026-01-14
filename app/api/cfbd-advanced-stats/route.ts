import { NextRequest, NextResponse } from 'next/server'
import { getCachedData, saveCachedData } from '@/lib/redis-cache'

const ADVANCED_STATS_CACHE_TTL_SECONDS = 6 * 60 * 60 // 6 hours

function getAdvancedStatsCacheKey(playerId: string, year: string, team: string): string {
  return `advanced-stats:${playerId}:${year}:${team}`
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const playerId = searchParams.get('playerId')
  const year = searchParams.get('year') || new Date().getFullYear().toString()
  const team = searchParams.get('team') || 'Oklahoma'
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
      const cacheKey = getAdvancedStatsCacheKey(playerId, year, team)
      const cachedData = await getCachedData(cacheKey)
      if (cachedData) {
        console.log(`[CACHE] Returning cached advanced stats for player ${playerId}, year ${year}`)
        return NextResponse.json({
          success: true,
          data: cachedData,
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

    // Fetch player usage data
    const usageResponse = await fetch(
      `https://api.collegefootballdata.com/player/usage?year=${year}&team=${team}&player_id=${playerId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        }
      }
    )

    let usageData = null
    if (usageResponse.ok) {
      const usageResults = await usageResponse.json()
      const playerUsage = usageResults.find((u: any) => u.id === String(playerId) || u.id === playerId)
      if (playerUsage && playerUsage.usage) {
        usageData = playerUsage.usage.overall || null
      }
    }

    // Fetch player PPA (predicted points added) data
    const ppaResponse = await fetch(
      `https://api.collegefootballdata.com/ppa/players/season?year=${year}&team=${team}&player_id=${playerId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        }
      }
    )

    let ppaData = null
    if (ppaResponse.ok) {
      const ppaResults = await ppaResponse.json()
      const playerPPA = ppaResults.find((p: any) => p.id === playerId || p.id === String(playerId))
      if (playerPPA && playerPPA.averagePPA) {
        ppaData = playerPPA.averagePPA.all || null
      }
    }

    const resultData = {
      usage: usageData,
      ppa: ppaData,
      year: parseInt(year)
    }

    // Save to cache
    const cacheKey = getAdvancedStatsCacheKey(playerId, year, team)
    await saveCachedData(cacheKey, resultData, ADVANCED_STATS_CACHE_TTL_SECONDS)

    return NextResponse.json({
      success: true,
      data: resultData,
      cached: false
    })
  } catch (error) {
    console.error('Error fetching CFBD advanced stats:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch CFBD advanced stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
