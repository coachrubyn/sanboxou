import { NextRequest, NextResponse } from 'next/server'
import { readPlayerDevelopment, writePlayerDevelopment } from '@/lib/player-development-storage'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const playerId = searchParams.get('playerId')
  
  if (!playerId) {
    return NextResponse.json(
      { error: 'Player ID required' },
      { status: 400 }
    )
  }
  
  try {
    const development = readPlayerDevelopment(playerId)
    return NextResponse.json({
      success: true,
      data: development
    })
  } catch (error) {
    console.error('Error fetching player development:', error)
    return NextResponse.json(
      { error: 'Failed to fetch player development' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { playerId, development } = body
    
    if (!playerId || !development) {
      return NextResponse.json(
        { error: 'Player ID and development data required' },
        { status: 400 }
      )
    }
    
    const success = writePlayerDevelopment(playerId, development)
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Player development data saved'
      })
    } else {
      return NextResponse.json(
        { error: 'Failed to save player development data' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error saving player development:', error)
    return NextResponse.json(
      { error: 'Failed to save player development' },
      { status: 500 }
    )
  }
}
