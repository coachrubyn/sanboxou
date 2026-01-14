import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const playerId = searchParams.get('playerId')
  const year = searchParams.get('year') || new Date().getFullYear().toString()
  const team = searchParams.get('team') || 'Oklahoma'
  
  if (!playerId) {
    return NextResponse.json(
      { error: 'Player ID is required' },
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

    return NextResponse.json({
      success: true,
      data: {
        usage: usageData,
        ppa: ppaData,
        year: parseInt(year)
      }
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
