import { NextRequest, NextResponse } from 'next/server'
import { readPlayerNotes, writePlayerNotes, addPlayerNote } from '@/lib/player-development-storage'

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
    const notes = readPlayerNotes(playerId)
    return NextResponse.json({
      success: true,
      data: notes
    })
  } catch (error) {
    console.error('Error fetching player notes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch player notes' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { playerId, note, createdBy } = body
    
    if (!playerId || !note) {
      return NextResponse.json(
        { error: 'Player ID and note required' },
        { status: 400 }
      )
    }
    
    const newNote = addPlayerNote(playerId, {
      playerName: '', // Will be filled from player data
      note,
      createdAt: new Date().toISOString(),
      createdBy: createdBy || 'Coach'
    })
    
    if (newNote) {
      return NextResponse.json({
        success: true,
        data: newNote
      })
    } else {
      return NextResponse.json(
        { error: 'Failed to add note' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error adding player note:', error)
    return NextResponse.json(
      { error: 'Failed to add note' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { playerId, notes } = body
    
    if (!playerId || !notes) {
      return NextResponse.json(
        { error: 'Player ID and notes required' },
        { status: 400 }
      )
    }
    
    const success = writePlayerNotes(playerId, notes)
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Player notes saved'
      })
    } else {
      return NextResponse.json(
        { error: 'Failed to save player notes' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error saving player notes:', error)
    return NextResponse.json(
      { error: 'Failed to save player notes' },
      { status: 500 }
    )
  }
}
