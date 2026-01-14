import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const playerName = searchParams.get('player')
  const season = searchParams.get('season') || '2024'
  const team = searchParams.get('team') || 'Oklahoma'
  
  if (!playerName) {
    return NextResponse.json(
      { error: 'Player name required' },
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

    return NextResponse.json({
      count: playerStats.length,
      data: playerStats,
      player: ouPlayer
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
