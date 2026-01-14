'use client'

import { useMemo, useState, useEffect } from 'react'
import PlayerCard from './PlayerCard'
import { Player, FootballPosition, POSITION_GROUPS, PlayerRole } from '@/lib/types'

interface TeamBoardProps {
  players: Player[]
  onPlayerMove?: (playerId: string, newStatus: Player['status']) => void
  onRoleChange?: (playerId: string, newRole: PlayerRole) => void
  onReorder?: (playerId: string, newIndex: number, role: PlayerRole, position: FootballPosition) => void
  showFullTeamView?: boolean
  onFullTeamViewChange?: (show: boolean) => void
}

const ROLE_COLUMNS: PlayerRole[] = ['Starter', 'Back-Up', 'Practice Player', 'Rehab']

const TeamBoard = ({ players, onPlayerMove, onRoleChange, onReorder, showFullTeamView = false, onFullTeamViewChange }: TeamBoardProps) => {
  const [activeMainTab, setActiveMainTab] = useState<string>('Offense')
  const [activeSubTab, setActiveSubTab] = useState<FootballPosition | null>(null)

  // Group players by position and role
  const playersByPositionAndRole = useMemo(() => {
    // Initialize all possible positions
    const allPositions: FootballPosition[] = ['QB', 'RB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'LB', 'ILB', 'EDGE', 'IDL', 'CB', 'S', 'K', 'P', 'LS']
    const grouped: Record<FootballPosition, Record<PlayerRole, Player[]>> = {} as Record<FootballPosition, Record<PlayerRole, Player[]>>
    
    // Initialize all positions
    allPositions.forEach(pos => {
      grouped[pos] = {
        Starter: [],
        'Back-Up': [],
        'Practice Player': [],
        Rehab: []
      }
    })
    
    players.forEach(player => {
      const position = player.position
      const role = player.role || 'Practice Player' // Default to Practice Player if no role assigned
      
      // Initialize position if it doesn't exist (for backward compatibility)
      if (!grouped[position]) {
        grouped[position] = {
          Starter: [],
          'Back-Up': [],
          'Practice Player': [],
          Rehab: []
        }
      }
      
      if (grouped[position] && grouped[position][role]) {
        grouped[position][role].push(player)
      }
    })
    
    // Sort each role group by depthChartOrder, then jersey number, then name
    Object.keys(grouped).forEach(pos => {
      ROLE_COLUMNS.forEach(role => {
        grouped[pos as FootballPosition][role].sort((a, b) => {
          // First sort by depthChartOrder if available
          if (a.depthChartOrder !== undefined && b.depthChartOrder !== undefined) {
            return a.depthChartOrder - b.depthChartOrder
          }
          if (a.depthChartOrder !== undefined) return -1
          if (b.depthChartOrder !== undefined) return 1
          // Then by jersey number
          if (a.number && b.number) return a.number - b.number
          if (a.number) return -1
          if (b.number) return 1
          // Finally by name
          return a.name.localeCompare(b.name)
        })
      })
    })
    
    return grouped
  }, [players])

  // Get positions for the active main tab
  const activePositions = POSITION_GROUPS[activeMainTab] || []
  
  // Set default sub-tab to first position with players when main tab changes
  useEffect(() => {
    if (!activeSubTab || !activePositions.includes(activeSubTab)) {
      const firstPositionWithPlayers = activePositions.find(pos => {
        const positionData = playersByPositionAndRole[pos]
        return ROLE_COLUMNS.some(role => positionData[role].length > 0)
      })
      if (firstPositionWithPlayers) {
        setActiveSubTab(firstPositionWithPlayers)
      } else if (activePositions.length > 0) {
        setActiveSubTab(activePositions[0])
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMainTab])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetIndex: number, role: PlayerRole, position: FootballPosition) => {
    e.preventDefault()
    e.stopPropagation()
    const draggedPlayerId = e.dataTransfer.getData('text/plain')
    
    if (!draggedPlayerId) return
    
    // Find the dragged player
    const draggedPlayer = players.find(p => p.id === draggedPlayerId)
    if (!draggedPlayer) return
    
    // Get current players in this role/position
    const currentPlayers = playersByPositionAndRole[position][role]
    
    // Find current index of dragged player in this role/position (if it exists)
    const currentIndex = currentPlayers.findIndex(p => p.id === draggedPlayerId)
    
    // If player is already in this role/position, just reorder
    if (currentIndex !== -1 && onReorder) {
      // Reorder within the same column
      onReorder(draggedPlayerId, targetIndex, role, position)
    } else if (currentIndex === -1) {
      // Player is being moved from a different role - first change role, then set order
      if (onRoleChange) {
        onRoleChange(draggedPlayerId, role)
        // After role change, set the order
        if (onReorder) {
          // Use setTimeout to ensure state update happens first
          setTimeout(() => {
            onReorder(draggedPlayerId, targetIndex, role, position)
          }, 100)
        }
      }
    }
  }

  const renderRoleColumn = (role: PlayerRole, positionPlayers: Player[], position: FootballPosition) => {
    return (
      <div 
        key={role} 
        className="flex-1 bg-white rounded-lg p-4 min-h-[400px] border-2 border-gray-200"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, positionPlayers.length, role, position)}
      >
        <h3 className="font-bold text-ou-crimson mb-4 text-center border-b-2 border-gray-300 pb-2">
          {role}
          <span className="ml-2 text-sm text-gray-500 font-normal">
            ({positionPlayers.length})
          </span>
        </h3>
        <div className="space-y-3">
          {positionPlayers.length === 0 ? (
            <div 
              className="text-center text-gray-400 text-sm py-8 border-2 border-dashed border-gray-300 rounded"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, 0, role, position)}
            >
              No players - Drop here
            </div>
          ) : (
            positionPlayers.map((player, index) => (
              <div
                key={player.id}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(e) => handleDrop(e, index, role, position)}
                className="relative"
              >
                <PlayerCard 
                  player={player}
                  onStatusChange={onPlayerMove}
                  onRoleChange={onRoleChange}
                  showRoleDropdown={true}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', player.id)
                    const target = e.currentTarget as HTMLElement
                    target.style.opacity = '0.5'
                  }}
                  onDragEnd={(e) => {
                    const target = e.currentTarget as HTMLElement
                    target.style.opacity = '1'
                  }}
                />
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  const renderPositionView = (position: FootballPosition) => {
    const positionData = playersByPositionAndRole[position]
    const hasPlayers = ROLE_COLUMNS.some(role => positionData[role].length > 0)
    
    if (!hasPlayers) {
      return (
        <div className="text-center text-gray-400 py-12">
          No players found for {position}
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-ou-crimson mb-4">
          {position}
        </h2>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {ROLE_COLUMNS.map(role => 
            renderRoleColumn(role, positionData[role], position)
          )}
        </div>
      </div>
    )
  }

  // Full team view: all positions in columns
  const renderFullTeamView = () => {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-ou-crimson">Full Team View</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Object.keys(POSITION_GROUPS).map((groupName) => {
            const positions = POSITION_GROUPS[groupName]
            return (
              <div key={groupName} className="space-y-4">
                <h3 className="text-xl font-bold text-ou-crimson border-b-2 border-ou-crimson pb-2">
                  {groupName}
                </h3>
                {positions.map((position) => {
                  const positionData = playersByPositionAndRole[position]
                  if (!positionData) return null
                  
                  // Get all players for this position, sorted by depth
                  const allPlayers: Player[] = []
                  ROLE_COLUMNS.forEach(role => {
                    allPlayers.push(...positionData[role])
                  })
                  
                  // Sort by depth chart order (role priority: Starter > Back-Up > Practice Player > Rehab)
                  allPlayers.sort((a, b) => {
                    const roleOrder: Record<PlayerRole, number> = {
                      'Starter': 0,
                      'Back-Up': 1,
                      'Practice Player': 2,
                      'Rehab': 3
                    }
                    const roleDiff = (roleOrder[a.role || 'Practice Player'] || 2) - (roleOrder[b.role || 'Practice Player'] || 2)
                    if (roleDiff !== 0) return roleDiff
                    
                    // Then by depthChartOrder
                    const orderA = a.depthChartOrder ?? 999
                    const orderB = b.depthChartOrder ?? 999
                    if (orderA !== orderB) return orderA - orderB
                    
                    // Then by jersey number
                    if (a.number && b.number) return a.number - b.number
                    if (a.number) return -1
                    if (b.number) return 1
                    
                    // Finally by name
                    return a.name.localeCompare(b.name)
                  })
                  
                  if (allPlayers.length === 0) return null
                  
                  return (
                    <div key={position} className="mb-6">
                      <h4 className="font-semibold text-gray-700 mb-2">{position}</h4>
                      <div className="space-y-2">
                        {allPlayers.map((player) => (
                          <div key={player.id}>
                            <PlayerCard 
                              player={player}
                              onStatusChange={onPlayerMove}
                              onRoleChange={onRoleChange}
                              showRoleDropdown={true}
                              draggable={false}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (showFullTeamView) {
    return renderFullTeamView()
  }

  return (
    <div className="space-y-6">
      
      {/* Main Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8" aria-label="Main Tabs">
          {Object.keys(POSITION_GROUPS).map((groupName) => {
            const hasPlayers = POSITION_GROUPS[groupName].some(pos => {
              const positionData = playersByPositionAndRole[pos]
              return ROLE_COLUMNS.some(role => positionData[role].length > 0)
            })
            
            if (!hasPlayers) return null
            
            return (
              <button
                key={groupName}
                onClick={() => {
                  setActiveMainTab(groupName)
                  // Reset sub-tab when switching main tabs
                  const firstPos = POSITION_GROUPS[groupName].find(pos => {
                    const positionData = playersByPositionAndRole[pos]
                    return ROLE_COLUMNS.some(role => positionData[role].length > 0)
                  })
                  setActiveSubTab(firstPos || POSITION_GROUPS[groupName][0] || null)
                }}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm bg-transparent
                  ${
                    activeMainTab === groupName
                      ? 'border-ou-crimson text-ou-crimson bg-transparent'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
                style={{
                  color: activeMainTab === groupName ? '#841617' : undefined,
                  backgroundColor: 'transparent'
                }}
              >
                {groupName}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Sub-Tabs (Position Groups) */}
      {activePositions.length > 0 && (
        <div className="border-b border-gray-200">
          <nav className="flex space-x-4 overflow-x-auto" aria-label="Position Tabs">
            {activePositions.map((position) => {
              const positionData = playersByPositionAndRole[position]
              const hasPlayers = ROLE_COLUMNS.some(role => positionData[role].length > 0)
              
              if (!hasPlayers) return null
              
              const totalPlayers = ROLE_COLUMNS.reduce((sum, role) => sum + positionData[role].length, 0)
              
              return (
                <button
                  key={position}
                  onClick={() => setActiveSubTab(position)}
                  className={`
                    py-2 px-4 border-b-2 font-medium text-sm whitespace-nowrap bg-transparent
                    ${
                      activeSubTab === position
                        ? 'border-ou-crimson text-ou-crimson bg-transparent'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                  style={{
                    color: activeSubTab === position ? '#841617' : undefined,
                    backgroundColor: 'transparent'
                  }}
                >
                  {position}
                  <span className="ml-2 text-xs text-gray-400">({totalPlayers})</span>
                </button>
              )
            })}
          </nav>
        </div>
      )}

      {/* Position View with Role Columns */}
      {activeSubTab && (
        <div className="mt-6">
          {renderPositionView(activeSubTab)}
        </div>
      )}
    </div>
  )
}

export default TeamBoard
