'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Player, PlayerRole } from '@/lib/types'
import { getPositionAdvancedStats, calculateMaddenGrade } from '@/lib/player-stats'

interface PlayerCardProps {
  player: Player
  onStatusChange?: (playerId: string, newStatus: Player['status']) => void
  onRoleChange?: (playerId: string, newRole: PlayerRole) => void
  showRoleDropdown?: boolean
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
}

const ROLE_OPTIONS: PlayerRole[] = ['Starter', 'Back-Up', 'Practice Player', 'Rehab']

// Helper function to generate headshot URL variations
function generateHeadshotVariations(firstName: string, lastName: string): string[] {
  const baseUrl = 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/soonersports.com/images'
  const datePaths = ['2025/7/14', '2025/3/4', '2025/1/1', '2024/12/1', '2024/8/1']
  const filenameVariations = [
    `${lastName}__${firstName}_2025_web.jpg`,
    `${lastName}__${firstName}_2025_web.JPG`,
    `${firstName}_${lastName}_2025_web.jpg`,
    `${firstName}_${lastName}_2025_web.JPG`,
    `${firstName}_${lastName}_2025_SHcjw.JPG`,
    `${lastName}__${firstName}_2025_SHcjw.JPG`,
    `${lastName}__${firstName}_web.jpg`,
    `${firstName}_${lastName}_web.jpg`,
    `${lastName}_${firstName}_2025.jpg`,
    `${firstName}_${lastName}_2025.jpg`,
  ]
  
  const urls: string[] = []
  for (const datePath of datePaths) {
    for (const filename of filenameVariations) {
      const imageUrl = `${baseUrl}/${datePath}/${filename}`
      const encodedUrl = encodeURIComponent(imageUrl)
      urls.push(`https://images.sidearmdev.com/crop?url=${encodedUrl}&width=180&height=270&type=webp`)
    }
  }
  return urls
}

const PlayerCard = ({ 
  player, 
  onStatusChange, 
  onRoleChange, 
  showRoleDropdown = true,
  draggable = false,
  onDragStart,
  onDragEnd
}: PlayerCardProps) => {
  const router = useRouter()
  const [showTooltip, setShowTooltip] = useState(false)
  const [hoveredFlag, setHoveredFlag] = useState<string | null>(null)
  
  // Generate headshot variations and track current index
  const nameParts = player.name.trim().split(/\s+/)
  const firstName = nameParts[0] || ''
  const lastName = nameParts[nameParts.length - 1] || ''
  const headshotVariations = nameParts.length >= 2 
    ? generateHeadshotVariations(firstName, lastName)
    : []
  
  // Start with the provided headshot, or first variation
  const [currentHeadshotIndex, setCurrentHeadshotIndex] = useState<number>(
    player.headshot && headshotVariations.includes(player.headshot)
      ? headshotVariations.indexOf(player.headshot)
      : 0
  )
  const [currentHeadshot, setCurrentHeadshot] = useState<string>(
    player.headshot || (headshotVariations.length > 0 ? headshotVariations[0] : '')
  )

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on the dropdown
    if ((e.target as HTMLElement).closest('select')) {
      return
    }
    router.push(`/player-profile?player=${encodeURIComponent(player.name)}`)
  }

  const handleRoleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation()
    if (onRoleChange) {
      onRoleChange(player.id, e.target.value as PlayerRole)
    }
  }
  
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement
    // Try next variation
    if (currentHeadshotIndex < headshotVariations.length - 1) {
      const nextIndex = currentHeadshotIndex + 1
      setCurrentHeadshotIndex(nextIndex)
      setCurrentHeadshot(headshotVariations[nextIndex])
      // Reset the src to trigger a new load attempt
      target.src = headshotVariations[nextIndex]
    } else {
      // All variations failed, hide the image
      target.style.display = 'none'
    }
  }

  // Card styling - removed conditional formatting
  const cardBorderColor = 'border-gray-200 bg-white'
  
  return (
    <div
      onClick={handleCardClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => {
        setShowTooltip(false)
        setHoveredFlag(null)
      }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`relative rounded-lg shadow-md border-2 hover:border-ou-crimson transition-all cursor-pointer p-4 ${cardBorderColor} ${
        draggable ? 'cursor-move' : ''
      }`}
    >
      {draggable && (
        <div className="absolute top-2 left-2 text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
      )}

      {/* Injury Flags - Removed emojis, showing text labels only */}
      {player.injuryFlags && (
        <div className="absolute top-2 right-2 flex gap-1">
          {player.injuryFlags.playerLoad && (
            <div 
              className="relative"
              onMouseEnter={() => setHoveredFlag('playerLoad')}
              onMouseLeave={() => setHoveredFlag(null)}
            >
              <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded cursor-help">High Load</span>
              {hoveredFlag === 'playerLoad' && (
                <div className="absolute z-50 right-0 top-6 w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg">
                  High Player Load: Spike in player load detected
                </div>
              )}
            </div>
          )}
          {player.injuryFlags.acr && (
            <div 
              className="relative"
              onMouseEnter={() => setHoveredFlag('acr')}
              onMouseLeave={() => setHoveredFlag(null)}
            >
              <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded cursor-help">ACR Alert</span>
              {hoveredFlag === 'acr' && (
                <div className="absolute z-50 right-0 top-6 w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg">
                  ACR Alert: Acute:Chronic Ratio spike detected
                </div>
              )}
            </div>
          )}
          {player.injuryFlags.medical && (
            <div 
              className="relative"
              onMouseEnter={() => setHoveredFlag('medical')}
              onMouseLeave={() => setHoveredFlag(null)}
            >
              <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded cursor-help">Medical</span>
              {hoveredFlag === 'medical' && (
                <div className="absolute z-50 right-0 top-6 w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg">
                  Medical Flag: Active injury or medical concern
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Headshot */}
      <div className="flex items-center mb-3">
        {currentHeadshot ? (
          <img
            src={currentHeadshot}
            alt={player.name}
            className="w-16 h-16 rounded-full object-cover mr-3 border-2 border-ou-crimson"
            onError={handleImageError}
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-ou-crimson text-white flex items-center justify-center font-bold text-lg mr-3 border-2 border-ou-crimson">
            {player.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 truncate">
              {player.name}
              {player.number && (
                <span className="ml-2 text-sm text-gray-600">#{player.number}</span>
              )}
            </h3>
          </div>
          <p className="text-sm text-gray-600">
            {player.position}
            {player.class && ` • ${player.class}`}
          </p>
        </div>
      </div>

      {/* Role Selection Dropdown */}
      {showRoleDropdown && (
        <div className="mb-3" onClick={(e) => e.stopPropagation()}>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Role
          </label>
          <select
            value={player.role || 'Practice Player'}
            onChange={handleRoleSelectChange}
            className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 hover:border-ou-crimson focus:outline-none focus:border-ou-crimson focus:ring-2 focus:ring-ou-crimson focus:ring-opacity-20 appearance-none cursor-pointer"
            style={{ color: '#111827' }}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role} style={{ color: '#111827', backgroundColor: '#ffffff' }}>
                {role}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Advanced Stats */}
      {(() => {
        const advancedStats = getPositionAdvancedStats(player)
        if (advancedStats.length > 0) {
          return (
            <div className="mb-3 pt-3 border-t border-gray-200">
              <div className="text-xs font-semibold text-gray-600 uppercase mb-2">
                Advanced Stats
              </div>
              <div className="space-y-1">
                {advancedStats.map((stat, index) => (
                  <div key={index} className="flex justify-between text-xs">
                    <span className="text-gray-600">{stat.label}:</span>
                    <span className="font-semibold">
                      {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                      {stat.percentile !== undefined && (
                        <span className="ml-1 text-gray-500">({stat.percentile}%)</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        }
        return null
      })()}

      {/* CFBD Stats Preview */}
      {player.stats && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="text-xs font-semibold text-gray-600 uppercase mb-2">
            Season Stats
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {player.stats.passingYards !== undefined && (
              <div>
                <span className="text-gray-600">Pass:</span>{' '}
                <span className="font-semibold">{player.stats.passingYards} yds</span>
              </div>
            )}
            {player.stats.rushingYards !== undefined && (
              <div>
                <span className="text-gray-600">Rush:</span>{' '}
                <span className="font-semibold">{player.stats.rushingYards} yds</span>
              </div>
            )}
            {player.stats.receivingYards !== undefined && (
              <div>
                <span className="text-gray-600">Rec:</span>{' '}
                <span className="font-semibold">{player.stats.receivingYards} yds</span>
              </div>
            )}
            {player.stats.touchdowns !== undefined && (
              <div>
                <span className="text-gray-600">TDs:</span>{' '}
                <span className="font-semibold">{player.stats.touchdowns}</span>
              </div>
            )}
            {player.stats.tackles !== undefined && (
              <div>
                <span className="text-gray-600">Tackles:</span>{' '}
                <span className="font-semibold">{player.stats.tackles}</span>
              </div>
            )}
            {player.stats.sacks !== undefined && (
              <div>
                <span className="text-gray-600">Sacks:</span>{' '}
                <span className="font-semibold">{player.stats.sacks}</span>
              </div>
            )}
            {player.stats.interceptions !== undefined && (
              <div>
                <span className="text-gray-600">INTs:</span>{' '}
                <span className="font-semibold">{player.stats.interceptions}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Performance Metrics Preview */}
      {player.metrics && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="text-xs font-semibold text-gray-600 uppercase mb-2">
            Performance
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {player.metrics.maxVelocity !== undefined && (
              <div>
                <span className="text-gray-600">Max Vel:</span>{' '}
                <span className="font-semibold">{player.metrics.maxVelocity.toFixed(1)} mph</span>
              </div>
            )}
            {player.metrics.totalDistance !== undefined && (
              <div>
                <span className="text-gray-600">Distance:</span>{' '}
                <span className="font-semibold">{Math.round(player.metrics.totalDistance)} yds</span>
              </div>
            )}
            {player.metrics.acr !== undefined && (
              <div>
                <span className="text-gray-600">ACR:</span>{' '}
                <span className="font-semibold text-gray-700">
                  {player.metrics.acr.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alerts */}
      {player.alerts && player.alerts.length > 0 && (
        <div className="mt-2 space-y-1">
          {player.alerts.map((alert, index) => (
            <div
              key={index}
              className={`text-xs p-2 rounded ${
                alert.severity === 'high'
                  ? 'bg-red-50 text-red-800 border-l-2 border-red-500'
                  : alert.severity === 'moderate'
                  ? 'bg-yellow-50 text-yellow-800 border-l-2 border-yellow-500'
                  : 'bg-blue-50 text-blue-800 border-l-2 border-blue-500'
              }`}
            >
              <strong>{alert.type}:</strong> {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Tooltip with additional info */}
      {showTooltip && (player.notes && player.notes.length > 0) && (
        <div className="absolute z-50 w-80 p-4 bg-white border-2 border-ou-crimson rounded-lg shadow-xl top-full left-1/2 transform -translate-x-1/2 mt-2 pointer-events-none">
          <div className="font-semibold text-ou-crimson mb-3 border-b border-gray-200 pb-2">
            {player.name}
          </div>
          {player.notes.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Recent Notes
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {player.notes.slice(0, 3).map((note) => (
                  <div
                    key={note.id}
                    className="text-xs p-2 rounded bg-blue-50 text-blue-900 border-l-2 border-blue-400"
                  >
                    <div className="font-medium mb-1">{note.note}</div>
                    <div className="text-gray-600 text-xs">
                      {new Date(note.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default PlayerCard
