import { NextRequest, NextResponse } from 'next/server'
import { clearAllCache, clearPlayerCache, getCacheStats } from '@/lib/cache'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { playerId, all } = body

    if (all) {
      // Clear all cache
      const result = clearAllCache()
      return NextResponse.json({
        success: true,
        message: `Cleared ${result.deleted} cache files`,
        deleted: result.deleted,
        errors: result.errors
      })
    } else if (playerId) {
      // Clear cache for specific player
      clearPlayerCache(playerId)
      return NextResponse.json({
        success: true,
        message: `Cleared cache for player ${playerId}`
      })
    } else {
      return NextResponse.json(
        { error: 'Either "all" or "playerId" must be provided' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error clearing cache:', error)
    return NextResponse.json(
      { 
        error: 'Failed to clear cache',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const stats = getCacheStats()
    return NextResponse.json({
      success: true,
      stats
    })
  } catch (error) {
    console.error('Error getting cache stats:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get cache stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
