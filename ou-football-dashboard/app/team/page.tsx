'use client'

import { useState, useEffect, useCallback } from 'react'
import NavigationBar from '@/components/NavigationBar'
import TeamBoard from '@/components/TeamBoard'
import { getRosterPlayers } from '@/lib/data'
import { Player, PlayerRole, FootballPosition } from '@/lib/types'

export default function TeamPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  const [unsavedChanges, setUnsavedChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [showFullTeamView, setShowFullTeamView] = useState(false)

  // Load saved player roles and depth chart orders
  const loadSavedRoles = useCallback(async () => {
    try {
      const response = await fetch('/api/roster/roles')
      const result = await response.json()
      
      if (result.success && result.data) {
        return result.data as Record<string, { role: string; depthChartOrder?: number }>
      }
    } catch (error) {
      console.error('Error loading saved roles:', error)
    }
    return {}
  }, [])

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [rateLimitExceeded, setRateLimitExceeded] = useState(false)

  const loadPlayers = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    
    setErrorMessage(null)
    setRateLimitExceeded(false)
    
    try {
      const result = await getRosterPlayers()
      
      if (result.error) {
        console.error('Error loading players:', result.error)
        
        // Check if it's a rate limit error
        if (result.rateLimitExceeded || result.error.includes('rate limit') || result.error.includes('quota exceeded')) {
          setRateLimitExceeded(true)
          setErrorMessage('CFBD API monthly quota exceeded. Please wait for the quota to reset or upgrade your API plan.')
        } else {
          setErrorMessage(result.error)
        }
        
        setPlayers([])
      } else {
        // Load saved roles and depth chart orders and apply them
        // Priority: Depth chart role (from API) > Saved role (only if depth chart doesn't have Starter/Back-Up)
        const savedRoles = await loadSavedRoles()
        const playersWithRoles = result.data.map((player: Player) => {
          const savedData = savedRoles[player.id]
          
          // If player has a depth chart role (Starter or Back-Up), use that
          // Only use saved role if player is Practice Player or Rehab (not from depth chart)
          const depthChartRole = player.role
          const isDepthChartRole = depthChartRole === 'Starter' || depthChartRole === 'Back-Up'
          
          const finalRole = isDepthChartRole 
            ? depthChartRole 
            : ((savedData?.role as PlayerRole) || player.role || 'Practice Player')
          
          return {
            ...player,
            role: finalRole,
            depthChartOrder: savedData?.depthChartOrder ?? player.depthChartOrder
          }
        })
        setPlayers(playersWithRoles)
        setLastRefreshTime(new Date())
        setUnsavedChanges(false)
        setErrorMessage(null)
        setRateLimitExceeded(false)
      }
    } catch (error) {
      console.error('Error loading team players:', error)
      const errorMsg = error instanceof Error ? error.message : 'Failed to fetch roster data'
      setErrorMessage(errorMsg)
      
      // Check if it's a rate limit error
      if (errorMsg.includes('429') || errorMsg.includes('rate limit') || errorMsg.includes('quota exceeded')) {
        setRateLimitExceeded(true)
      }
      
      setPlayers([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [loadSavedRoles])

  // Initial load
  useEffect(() => {
    loadPlayers(false)
  }, [loadPlayers])

  // Auto-refresh every hour
  useEffect(() => {
    const interval = setInterval(() => {
      loadPlayers(false)
    }, 60 * 60 * 1000) // 1 hour
    
    return () => clearInterval(interval)
  }, [loadPlayers])

  // Handle player status change
  const handlePlayerMove = useCallback((playerId: string, newStatus: Player['status']) => {
    setPlayers((prevPlayers) => {
      return prevPlayers.map((player) =>
        player.id === playerId ? { ...player, status: newStatus } : player
      )
    })
  }, [])

  // Handle player role change
  const handleRoleChange = useCallback((playerId: string, newRole: PlayerRole) => {
    setPlayers((prevPlayers) => {
      return prevPlayers.map((player) =>
        player.id === playerId ? { ...player, role: newRole } : player
      )
    })
    setUnsavedChanges(true)
    setSaveStatus('idle')
  }, [])

  // Handle player reorder within a column
  const handleReorder = useCallback((
    playerId: string, 
    newIndex: number, 
    role: PlayerRole, 
    position: FootballPosition
  ) => {
    setPlayers((prevPlayers) => {
      // Find the player being moved
      const playerToMove = prevPlayers.find(p => p.id === playerId)
      if (!playerToMove) return prevPlayers

      // Get all players in the same position and role (including the one being moved)
      const samePositionRole = prevPlayers.filter(p => 
        p.position === position && p.role === role
      )

      // Sort them by current depthChartOrder (treat undefined as high number)
      samePositionRole.sort((a, b) => {
        const orderA = a.depthChartOrder ?? 999
        const orderB = b.depthChartOrder ?? 999
        if (orderA !== orderB) return orderA - orderB
        // If same order, maintain current relative order
        return 0
      })

      // Find current index of player being moved
      const currentIndex = samePositionRole.findIndex(p => p.id === playerId)
      
      // Remove player from current position
      const withoutPlayer = samePositionRole.filter(p => p.id !== playerId)
      
      // Insert at new index (adjust if moving from before the target)
      const adjustedIndex = currentIndex !== -1 && currentIndex < newIndex ? newIndex - 1 : newIndex
      const reordered = [...withoutPlayer]
      reordered.splice(adjustedIndex, 0, playerToMove)

      // Update depthChartOrder for all players in this role/position
      const updated = prevPlayers.map(player => {
        if (player.position === position && player.role === role) {
          const index = reordered.findIndex(p => p.id === player.id)
          return {
            ...player,
            depthChartOrder: index >= 0 ? index : undefined
          }
        }
        return player
      })

      return updated
    })
    setUnsavedChanges(true)
    setSaveStatus('idle')
  }, [])

  // Save all player roles and depth chart orders
  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveStatus('idle')
    
    try {
      // Create roles and depth chart orders objects from current players
      const roles: Record<string, string> = {}
      const depthChartOrders: Record<string, number> = {}
      
      players.forEach(player => {
        if (player.role) {
          roles[player.id] = player.role
          if (player.depthChartOrder !== undefined) {
            depthChartOrders[player.id] = player.depthChartOrder
          }
        }
      })

      const response = await fetch('/api/roster/roles', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roles, depthChartOrders }),
      })

      const result = await response.json()

      if (result.success) {
        setUnsavedChanges(false)
        setSaveStatus('success')
        setTimeout(() => setSaveStatus('idle'), 3000)
      } else {
        setSaveStatus('error')
        console.error('Error saving roles:', result.error)
      }
    } catch (error) {
      setSaveStatus('error')
      console.error('Error saving player roles:', error)
    } finally {
      setSaving(false)
    }
  }, [players])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavigationBar />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ou-crimson mx-auto mb-4"></div>
            <p className="text-gray-600">Loading team data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationBar />
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-6">
        {/* Error message display */}
        {errorMessage && (
          <div className={`mb-4 p-4 rounded-lg ${
            rateLimitExceeded 
              ? 'bg-yellow-50 border border-yellow-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-start">
              <div className={`flex-shrink-0 ${rateLimitExceeded ? 'text-yellow-600' : 'text-red-600'}`}>
                {rateLimitExceeded ? '⚠️' : '❌'}
              </div>
              <div className="ml-3 flex-1">
                <h3 className={`text-sm font-medium ${
                  rateLimitExceeded ? 'text-yellow-800' : 'text-red-800'
                }`}>
                  {rateLimitExceeded ? 'API Rate Limit Exceeded' : 'Error Loading Roster'}
                </h3>
                <p className={`mt-1 text-sm ${
                  rateLimitExceeded ? 'text-yellow-700' : 'text-red-700'
                }`}>
                  {errorMessage}
                </p>
                {rateLimitExceeded && (
                  <p className="mt-2 text-xs text-yellow-600">
                    The CFBD API monthly quota has been exceeded. You can continue using cached data, or wait for the quota to reset.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Header with refresh and save buttons */}
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => setShowFullTeamView(!showFullTeamView)}
            className="px-4 py-2 bg-ou-crimson text-white rounded-md hover:bg-red-800 transition-colors"
          >
            {showFullTeamView ? 'Show Position View' : 'View Full Team'}
          </button>
          <div className="flex items-center gap-4">
            {lastRefreshTime && (
              <span className="text-sm text-gray-600">
                Last updated: {lastRefreshTime.toLocaleTimeString()}
              </span>
            )}
            {unsavedChanges && (
              <span className="text-sm text-orange-600 font-medium">
                • Unsaved changes
              </span>
            )}
            {saveStatus === 'success' && (
              <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Saved!
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-sm text-red-600 font-medium">
                Save failed
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !unsavedChanges}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Save Changes</span>
                </>
              )}
            </button>
            <button
              onClick={async () => {
                // Reset saved roles to use depth chart
                try {
                  const response = await fetch('/api/roster/roles/reset', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ all: true }) 
                  })
                  const result = await response.json()
                  if (result.success) {
                    // Reload players after reset
                    await loadPlayers(true)
                  }
                } catch (error) {
                  console.error('Error resetting roles:', error)
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
              title="Reset all roles to match depth chart"
            >
              Reset to Depth Chart
            </button>
            <button
              onClick={() => loadPlayers(true)}
              disabled={refreshing || loading}
              className="flex items-center gap-2 px-4 py-2 bg-ou-crimson text-white rounded-md hover:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refreshing ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Refreshing...</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refresh</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Team Board */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {players.length > 0 ? (
            <TeamBoard 
              players={players} 
              onPlayerMove={handlePlayerMove}
              onRoleChange={handleRoleChange}
              onReorder={handleReorder}
              showFullTeamView={showFullTeamView}
              onFullTeamViewChange={setShowFullTeamView}
            />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600">No player data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
