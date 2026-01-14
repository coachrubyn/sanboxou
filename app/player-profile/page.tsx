'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import NavigationBar from '@/components/NavigationBar'
import { getPlayerByName } from '@/lib/data'
import { Player } from '@/lib/types'
import { generateMockGameStats, generateMockCatapultData, generateMockForcePlateData, generateMockBodyCompositionData, generateMockPlayerDevelopment } from '@/lib/mock-data'
import { getPositionAdvancedMetrics } from '@/lib/position-metrics'
import { calculateMaddenGrade } from '@/lib/player-stats'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'

type ProfileTab = 'Analytics' | 'High Performance' | 'Player Development'
type HighPerformanceSubTab = 'Catapult' | 'Force Plate' | 'Body Composition'

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

function PlayerProfileContent() {
  const searchParams = useSearchParams()
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ProfileTab>('Analytics')
  const [seasonStatsExpanded, setSeasonStatsExpanded] = useState(true)
  const [selectedGame, setSelectedGame] = useState<string | null>(null)
  const [activeHPSubTab, setActiveHPSubTab] = useState<HighPerformanceSubTab>('Catapult')
  const [newNote, setNewNote] = useState('')
  const [newNoteAuthor, setNewNoteAuthor] = useState('')
  const [selectedGameYear, setSelectedGameYear] = useState<number>(new Date().getFullYear())
  const [selectedCatapultMetric, setSelectedCatapultMetric] = useState<string>('playerLoad')
  const [selectedForcePlateMetric, setSelectedForcePlateMetric] = useState<string>('Peak Force')
  const [selectedBodyCompMetric, setSelectedBodyCompMetric] = useState<string>('weight')
  const playerName = searchParams?.get('player') || ''
  
  // Headshot fallback state
  const [currentHeadshotIndex, setCurrentHeadshotIndex] = useState<number>(0)
  const [currentHeadshot, setCurrentHeadshot] = useState<string>('')
  
  // Generate headshot variations when player changes
  useEffect(() => {
    if (player) {
      // Priority 1: Use headshot from player object (comes from scraped data via roster API)
      if (player.headshot) {
        setCurrentHeadshot(player.headshot)
        return
      }
      
      // Priority 2: Try to fetch from scraped headshots API
      const fetchScrapedHeadshot = async () => {
        try {
          const response = await fetch('/api/roster/scrape-headshots')
          if (response.ok) {
            const result = await response.json()
            if (result.headshots) {
              // Normalize player name for matching
              const normalizedName = player.name
                .toLowerCase()
                .trim()
                .replace(/\s+/g, ' ')
                .replace(/[.,]/g, '')
              
              // Try exact match
              if (result.headshots[normalizedName]) {
                setCurrentHeadshot(result.headshots[normalizedName])
                return
              }
              
              // Try partial match
              const nameParts = normalizedName.split(' ')
              for (const [scrapedName, url] of Object.entries(result.headshots)) {
                const allPartsMatch = nameParts.every(part => 
                  part.length > 2 && scrapedName.includes(part)
                ) || scrapedName.split(' ').every(part => 
                  part.length > 2 && normalizedName.includes(part)
                )
                
                if (allPartsMatch) {
                  setCurrentHeadshot(url as string)
                  return
                }
              }
            }
          }
        } catch (error) {
          console.error('Error fetching scraped headshots:', error)
        }
        
        // Priority 3: Generate variations as fallback
        const nameParts = player.name.trim().split(/\s+/)
        const firstName = nameParts[0] || ''
        const lastName = nameParts[nameParts.length - 1] || ''
        const headshotVariations = nameParts.length >= 2 
          ? generateHeadshotVariations(firstName, lastName)
          : []
        
        if (headshotVariations.length > 0) {
          setCurrentHeadshotIndex(0)
          setCurrentHeadshot(headshotVariations[0])
        } else {
          setCurrentHeadshot('')
        }
      }
      
      fetchScrapedHeadshot()
    }
  }, [player])
  
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!player) return
    const target = e.target as HTMLImageElement
    const nameParts = player.name.trim().split(/\s+/)
    const firstName = nameParts[0] || ''
    const lastName = nameParts[nameParts.length - 1] || ''
    const headshotVariations = nameParts.length >= 2 
      ? generateHeadshotVariations(firstName, lastName)
      : []
    
    // Try next variation
    if (currentHeadshotIndex < headshotVariations.length - 1) {
      const nextIndex = currentHeadshotIndex + 1
      setCurrentHeadshotIndex(nextIndex)
      const nextHeadshot = headshotVariations[nextIndex]
      setCurrentHeadshot(nextHeadshot)
      // Reset the src to trigger a new load attempt
      target.src = nextHeadshot
    } else {
      // All variations failed, hide the image
      target.style.display = 'none'
    }
  }

  useEffect(() => {
    async function loadPlayer() {
      if (!playerName) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        let playerData = await getPlayerByName(playerName)
        
        // If player not found in roster, create a default player object
        if (!playerData && playerName) {
          playerData = {
            id: `unknown-${playerName.toLowerCase().replace(/\s+/g, '-')}`,
            name: playerName,
            position: 'OL' as const, // Default position
            status: 'good' as const,
            role: 'Practice Player' as const
          }
        }
        
        // Fetch multi-season stats for all players (even if not in roster)
        if (playerData) {
          try {
            // Use player ID if available (more reliable than name search)
            const queryParams = new URLSearchParams({
              startYear: '2020',
              endYear: new Date().getFullYear().toString()
            })
            
            if (playerData.id && !playerData.id.startsWith('unknown-')) {
              queryParams.append('playerId', playerData.id)
            }
            if (playerName) {
              queryParams.append('player', playerName)
            }
            
            const response = await fetch(
              `/api/cfbd-stats/seasons?${queryParams.toString()}`
            )
            if (response.ok) {
              const result = await response.json()
              console.log('Multi-season stats result:', result)
              if (result.data && Object.keys(result.data).length > 0) {
                // Transform the stats
                const { transformCFBDStatsBySeason } = await import('@/lib/cfbd-api')
                const seasonStats = transformCFBDStatsBySeason(result.data)
                console.log('Transformed season stats:', seasonStats)
                
                // Fetch advanced stats (usage and PPA) for each season
                if (playerData.id && !playerData.id.startsWith('unknown-') && seasonStats) {
                  const seasonYears = Object.keys(seasonStats).map(Number)
                  for (const year of seasonYears) {
                    try {
                      const advancedStatsResponse = await fetch(
                        `/api/cfbd-advanced-stats?playerId=${playerData.id}&year=${year}`
                      )
                      if (advancedStatsResponse.ok) {
                        const advancedStats = await advancedStatsResponse.json()
                        if (advancedStats.success && advancedStats.data) {
                          if (seasonStats[year]) {
                            seasonStats[year].usage = advancedStats.data.usage
                            seasonStats[year].ppa = advancedStats.data.ppa
                          }
                        }
                      }
                    } catch (error) {
                      console.error(`Error fetching advanced stats for ${year}:`, error)
                    }
                  }
                }
                
                playerData.seasonStats = seasonStats
                
                // Update position if we got it from stats
                if (result.player?.position) {
                  const positionMap: Record<string, Player['position']> = {
                    'QB': 'QB', 'RB': 'RB', 'WR': 'WR', 'TE': 'TE', 'OL': 'OL',
                    'DL': 'DL', 'LB': 'LB', 'CB': 'CB', 'S': 'S',
                    'K': 'K', 'P': 'P', 'LS': 'LS'
                  }
                  const mappedPosition = positionMap[result.player.position.toUpperCase()]
                  if (mappedPosition) {
                    playerData.position = mappedPosition
                  }
                }
              } else {
                console.log('No season stats data found for player:', playerName)
              }
            } else {
              console.log('Failed to fetch season stats, status:', response.status)
            }
          } catch (error) {
            console.error('Error loading multi-season stats:', error)
          }
          
          // Fetch game-by-game stats from CFBD
          if (playerData && playerData.id && !playerData.id.startsWith('unknown-')) {
            try {
              // Fetch game stats for a wide range of years (2020-2026) to get all available data
              // This ensures we get data even if seasonStats is incomplete
              const currentYear = new Date().getFullYear()
              const startYear = 2020
              const endYear = Math.max(currentYear, 2026) // Go up to 2026 to catch future seasons
              const yearsToFetch = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i)
              
              // Also include any years from seasonStats that might be outside this range
              if (playerData.seasonStats) {
                const seasonYears = Object.keys(playerData.seasonStats).map(Number)
                for (const year of seasonYears) {
                  if (!yearsToFetch.includes(year)) {
                    yearsToFetch.push(year)
                  }
                }
              }
              
              // Sort years descending (most recent first)
              yearsToFetch.sort((a, b) => b - a)
              
              const allGameStats: any[] = []
              
              for (const year of yearsToFetch) {
                try {
                  const gameStatsResponse = await fetch(
                    `/api/cfbd-game-stats?playerId=${playerData.id}&year=${year}`
                  )
                  if (gameStatsResponse.ok) {
                    const gameStatsResult = await gameStatsResponse.json()
                    if (gameStatsResult.success && gameStatsResult.data && gameStatsResult.data.length > 0) {
                      allGameStats.push(...gameStatsResult.data)
                    }
                  }
                } catch (error) {
                  console.error(`Error fetching game stats for ${year}:`, error)
                }
              }
              
              if (allGameStats.length > 0) {
                playerData.gameStats = allGameStats
              } else {
                // Fallback to mock data if no real data available
                playerData.gameStats = generateMockGameStats(playerData, 2024)
              }
            } catch (error) {
              console.error('Error loading game stats:', error)
              // Fallback to mock data on error
              if (!playerData.gameStats) {
                playerData.gameStats = generateMockGameStats(playerData, 2024)
              }
            }
          } else if (playerData && !playerData.gameStats) {
            // Fallback to mock data if player ID not available
            playerData.gameStats = generateMockGameStats(playerData, 2024)
          }
          
          // Generate mock high performance data if not present
          if (playerData) {
            if (!playerData.catapultData) {
              playerData.catapultData = generateMockCatapultData(playerData)
            }
            if (!playerData.forcePlateData) {
              playerData.forcePlateData = generateMockForcePlateData(playerData)
            }
            if (!playerData.bodyCompositionData) {
              playerData.bodyCompositionData = generateMockBodyCompositionData(playerData)
            }
            if (!playerData.playerDevelopment) {
              playerData.playerDevelopment = generateMockPlayerDevelopment(playerData)
            }
          }
        }
        
        setPlayer(playerData)
      } catch (error) {
        console.error('Error loading player:', error)
      } finally {
        setLoading(false)
      }
    }

    loadPlayer()
  }, [playerName])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavigationBar />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ou-crimson mx-auto mb-4"></div>
            <p className="text-gray-600">Loading player data...</p>
          </div>
        </div>
      </div>
    )
  }

  // If no player data at all, show a default empty state
  // But we should always have player data now since we create a default object
  if (!player) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavigationBar />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <p className="text-gray-600">Loading player profile...</p>
          </div>
        </div>
      </div>
    )
  }

  const tabs: ProfileTab[] = ['Analytics', 'High Performance', 'Player Development']

  const renderAnalyticsTab = () => {
    // Get sorted years for season stats
    const seasonYears = player.seasonStats 
      ? Object.keys(player.seasonStats).map(Number).sort((a, b) => b - a)
      : []
    
    const selectedGameData = selectedGame 
      ? player.gameStats?.find(g => g.gameId === selectedGame)
      : null
    
    return (
      <div className="space-y-6">
        {/* Season Statistics - Collapsible */}
        <div className="bg-gray-50 rounded-lg p-6">
          <button
            onClick={() => setSeasonStatsExpanded(!seasonStatsExpanded)}
            className="flex items-center justify-between w-full text-left mb-4"
          >
            <h2 className="text-2xl font-bold text-ou-crimson">Season Statistics</h2>
            <svg
              className={`w-5 h-5 transform transition-transform ${seasonStatsExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {seasonStatsExpanded && (
            <>
              {/* Position-Specific Multi-Season Stats Tables */}
              {seasonYears.length > 0 ? (
                <>
                  {/* QB Passing Stats Table */}
            {player.position === 'QB' && (
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Passing Statistics by Season</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white rounded-lg overflow-hidden">
                    <thead className="bg-ou-crimson text-white">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Season</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Team</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">CMP</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">ATT</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">CMP%</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">YDS</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">TD</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">INT</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Rush YDS</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Rush TD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {seasonYears.map((year) => {
                        const seasonData = player.seasonStats![year]
                        return (
                          <tr key={year} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{year}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {seasonData.team || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.completions ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.passingAttempts ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.completionPercentage !== undefined
                                ? `${seasonData.completionPercentage.toFixed(1)}%`
                                : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.passingYards?.toLocaleString() ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.passingTDs ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.interceptions ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.rushingYards?.toLocaleString() ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.rushingTDs ?? '-'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RB Rushing Stats Table */}
            {player.position === 'RB' && (
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Rushing Statistics by Season</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white rounded-lg overflow-hidden">
                    <thead className="bg-ou-crimson text-white">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Season</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Team</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">ATT</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">YDS</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">AVG</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">TD</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Rec</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Rec YDS</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Rec TD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {seasonYears.map((year) => {
                        const seasonData = player.seasonStats![year]
                        const avgYards = seasonData.rushingAttempts && seasonData.rushingYards
                          ? (seasonData.rushingYards / seasonData.rushingAttempts).toFixed(1)
                          : '-'
                        return (
                          <tr key={year} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{year}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {seasonData.team || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.rushingAttempts?.toLocaleString() ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.rushingYards?.toLocaleString() ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">{avgYards}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.rushingTDs ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.receptions ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.receivingYards?.toLocaleString() ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.receivingTDs ?? '-'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* WR/TE Receiving Stats Table */}
            {(player.position === 'WR' || player.position === 'TE') && (
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Receiving Statistics by Season</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white rounded-lg overflow-hidden">
                    <thead className="bg-ou-crimson text-white">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Season</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Team</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">REC</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">YDS</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">AVG</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">TD</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Rush ATT</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Rush YDS</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Rush TD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {seasonYears.map((year) => {
                        const seasonData = player.seasonStats![year]
                        const avgYards = seasonData.receptions && seasonData.receivingYards
                          ? (seasonData.receivingYards / seasonData.receptions).toFixed(1)
                          : '-'
                        return (
                          <tr key={year} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{year}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {seasonData.team || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.receptions?.toLocaleString() ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.receivingYards?.toLocaleString() ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">{avgYards}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.receivingTDs ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.rushingAttempts?.toLocaleString() ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.rushingYards?.toLocaleString() ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.rushingTDs ?? '-'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Defensive Stats Table (DL, LB, CB, S) */}
            {(player.position === 'DL' || player.position === 'LB' || player.position === 'CB' || player.position === 'S') && (
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Defensive Statistics by Season</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white rounded-lg overflow-hidden">
                    <thead className="bg-ou-crimson text-white">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Season</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Team</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Tackles</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Solo</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Sacks</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">TFL</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">INT</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">PD</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">QB Hur</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">TD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {seasonYears.map((year) => {
                        const seasonData = player.seasonStats![year]
                        return (
                          <tr key={year} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{year}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {seasonData.team || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.tackles ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.soloTackles ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.sacks ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.tacklesForLoss ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.interceptions ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.passesDefended ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.qbHurries ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.defensiveTDs ?? '-'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Kicking Stats Table */}
            {player.position === 'K' && (
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Kicking Statistics by Season</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white rounded-lg overflow-hidden">
                    <thead className="bg-ou-crimson text-white">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Season</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Team</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">FG Made</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">FG Att</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">FG%</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Long</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">XP Made</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">XP Att</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {seasonYears.map((year) => {
                        const seasonData = player.seasonStats![year]
                        const fgPct = seasonData.fieldGoalsAttempted && seasonData.fieldGoalsMade
                          ? ((seasonData.fieldGoalsMade / seasonData.fieldGoalsAttempted) * 100).toFixed(1)
                          : '-'
                        return (
                          <tr key={year} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{year}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {seasonData.team || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.fieldGoalsMade ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.fieldGoalsAttempted ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {fgPct !== '-' ? `${fgPct}%` : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.fieldGoalLong ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.extraPointsMade ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.extraPointsAttempted ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.kickingPoints ?? '-'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Punting Stats Table */}
            {player.position === 'P' && (
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Punting Statistics by Season</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white rounded-lg overflow-hidden">
                    <thead className="bg-ou-crimson text-white">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Season</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Team</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Punts</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">YDS</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">AVG</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Long</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">In 20</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">TB</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {seasonYears.map((year) => {
                        const seasonData = player.seasonStats![year]
                        const avgYards = seasonData.punts && seasonData.puntingYards
                          ? (seasonData.puntingYards / seasonData.punts).toFixed(1)
                          : '-'
                        return (
                          <tr key={year} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{year}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {seasonData.team || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.punts ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.puntingYards?.toLocaleString() ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">{avgYards}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.puntingLong ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.puntsInside20 ?? '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {seasonData.puntingTouchbacks ?? '-'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
                </>
              ) : (
                <div className="bg-gray-50 rounded-lg p-6">
                  <p className="text-gray-600 text-center">
                    No season statistics available for {player.name}. Stats will appear here once data is available from CFBD.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Game-to-Game Statistics */}
        {player.gameStats && player.gameStats.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-ou-crimson">Game-to-Game Statistics</h2>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Year:</label>
                <select
                  value={selectedGameYear}
                  onChange={(e) => setSelectedGameYear(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 hover:border-ou-crimson focus:outline-none focus:border-ou-crimson focus:ring-2 focus:ring-ou-crimson focus:ring-opacity-20"
                >
                  {(() => {
                    // Get all unique years from game stats, sorted descending
                    const gameStatsYears = Array.from(
                      new Set(
                        player.gameStats.map(game => new Date(game.date).getFullYear())
                      )
                    ).sort((a, b) => b - a)
                    
                    // If selected year is not in the list, add it
                    if (gameStatsYears.length > 0 && !gameStatsYears.includes(selectedGameYear)) {
                      gameStatsYears.push(selectedGameYear)
                      gameStatsYears.sort((a, b) => b - a)
                    }
                    
                    // If no game stats years, fallback to recent years
                    const yearsToShow = gameStatsYears.length > 0 
                      ? gameStatsYears 
                      : Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
                    
                    return yearsToShow.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))
                  })()}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg overflow-hidden">
                <thead className="bg-ou-crimson text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Opponent</th>
                    {player.position === 'QB' && (
                      <>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Pass Yds</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">TDs</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">INTs</th>
                      </>
                    )}
                    {(player.position === 'RB') && (
                      <>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Rush Yds</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">TDs</th>
                      </>
                    )}
                    {(player.position === 'WR' || player.position === 'TE') && (
                      <>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Rec Yds</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Receptions</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">TDs</th>
                      </>
                    )}
                    {['DL', 'LB', 'ILB', 'EDGE', 'IDL', 'CB', 'S'].includes(player.position) && (
                      <>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Tackles</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Sacks</th>
                      </>
                    )}
                    <th className="px-4 py-3 text-right text-sm font-semibold">Coach Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {player.gameStats
                    .filter(game => new Date(game.date).getFullYear() === selectedGameYear)
                    .map((game) => (
                    <tr 
                      key={game.gameId} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedGame(selectedGame === game.gameId ? null : game.gameId)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {new Date(game.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{game.opponent}</td>
                      {player.position === 'QB' && (
                        <>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {game.stats.passingYards?.toLocaleString() ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {game.stats.passingTDs ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {game.stats.interceptions ?? '-'}
                          </td>
                        </>
                      )}
                      {player.position === 'RB' && (
                        <>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {game.stats.rushingYards?.toLocaleString() ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {game.stats.rushingTDs ?? '-'}
                          </td>
                        </>
                      )}
                      {(player.position === 'WR' || player.position === 'TE') && (
                        <>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {game.stats.receivingYards?.toLocaleString() ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {game.stats.receptions ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {game.stats.receivingTDs ?? '-'}
                          </td>
                        </>
                      )}
                      {['DL', 'LB', 'ILB', 'EDGE', 'IDL', 'CB', 'S'].includes(player.position) && (
                        <>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {game.stats.tackles ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {game.stats.sacks ?? '-'}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 text-sm text-right text-gray-700">
                        {game.coachGrade !== undefined ? (
                          <span className={`font-semibold ${
                            game.coachGrade >= 90 ? 'text-green-600' :
                            game.coachGrade >= 80 ? 'text-blue-600' :
                            game.coachGrade >= 70 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {game.coachGrade}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Quarter Breakdown Modal */}
            {selectedGameData && (
              <div className="mt-6 bg-white rounded-lg p-6 border-2 border-ou-crimson">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-ou-crimson">
                    {new Date(selectedGameData.date).toLocaleDateString()} vs {selectedGameData.opponent}
                  </h3>
                  <button
                    onClick={() => setSelectedGame(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-semibold">Quarter</th>
                        {player.position === 'QB' && (
                          <>
                            <th className="px-4 py-2 text-right text-sm font-semibold">Pass Yds</th>
                            <th className="px-4 py-2 text-right text-sm font-semibold">TDs</th>
                            <th className="px-4 py-2 text-right text-sm font-semibold">CMP/ATT</th>
                          </>
                        )}
                        {player.position === 'RB' && (
                          <>
                            <th className="px-4 py-2 text-right text-sm font-semibold">Rush Yds</th>
                            <th className="px-4 py-2 text-right text-sm font-semibold">Attempts</th>
                          </>
                        )}
                        {(player.position === 'WR' || player.position === 'TE') && (
                          <>
                            <th className="px-4 py-2 text-right text-sm font-semibold">Rec Yds</th>
                            <th className="px-4 py-2 text-right text-sm font-semibold">Receptions</th>
                          </>
                        )}
                        {['DL', 'LB', 'ILB', 'EDGE', 'IDL', 'CB', 'S'].includes(player.position) && (
                          <>
                            <th className="px-4 py-2 text-right text-sm font-semibold">Tackles</th>
                            <th className="px-4 py-2 text-right text-sm font-semibold">Solo</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedGameData.quarters.map((quarter) => (
                        <tr key={quarter.quarter}>
                          <td className="px-4 py-2 text-sm font-medium">Q{quarter.quarter}</td>
                          {player.position === 'QB' && (
                            <>
                              <td className="px-4 py-2 text-sm text-right">
                                {quarter.stats.passingYards?.toLocaleString() ?? '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right">
                                {quarter.stats.passingTDs ?? '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right">
                                {quarter.stats.completions ?? '-'}/{quarter.stats.attempts ?? '-'}
                              </td>
                            </>
                          )}
                          {player.position === 'RB' && (
                            <>
                              <td className="px-4 py-2 text-sm text-right">
                                {quarter.stats.rushingYards?.toLocaleString() ?? '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right">
                                {quarter.stats.attempts ?? '-'}
                              </td>
                            </>
                          )}
                          {(player.position === 'WR' || player.position === 'TE') && (
                            <>
                              <td className="px-4 py-2 text-sm text-right">
                                {quarter.stats.receivingYards?.toLocaleString() ?? '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right">
                                {quarter.stats.receptions ?? '-'}
                              </td>
                            </>
                          )}
                          {['DL', 'LB', 'ILB', 'EDGE', 'IDL', 'CB', 'S'].includes(player.position) && (
                            <>
                              <td className="px-4 py-2 text-sm text-right">
                                {quarter.stats.tackles ?? '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right">
                                {quarter.stats.soloTackles ?? '-'}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Passing Stats (Single Season - Fallback) - Only show if no multi-season stats */}
        {player.stats?.passingYards !== undefined && (!player.seasonStats || Object.keys(player.seasonStats).length === 0) && (
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Passing</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg">
                <div className="text-sm text-gray-600">Passing Yards</div>
                <div className="text-2xl font-bold text-ou-crimson">{player.stats.passingYards}</div>
              </div>
              {player.stats.touchdowns !== undefined && (
                <div className="bg-white p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Passing TDs</div>
                  <div className="text-2xl font-bold text-ou-crimson">{player.stats.touchdowns}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rushing Stats (Single Season - Fallback) - Only show if no multi-season stats */}
        {player.stats?.rushingYards !== undefined && (!player.seasonStats || Object.keys(player.seasonStats).length === 0) && (
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Rushing</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg">
                <div className="text-sm text-gray-600">Rushing Yards</div>
                <div className="text-2xl font-bold text-ou-crimson">{player.stats.rushingYards}</div>
              </div>
              {player.stats.touchdowns !== undefined && (
                <div className="bg-white p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Rushing TDs</div>
                  <div className="text-2xl font-bold text-ou-crimson">{player.stats.touchdowns}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Receiving Stats (Single Season - Fallback) - Only show if no multi-season stats */}
        {player.stats?.receivingYards !== undefined && (!player.seasonStats || Object.keys(player.seasonStats).length === 0) && (
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Receiving</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg">
                <div className="text-sm text-gray-600">Receiving Yards</div>
                <div className="text-2xl font-bold text-ou-crimson">{player.stats.receivingYards}</div>
              </div>
              {player.stats.touchdowns !== undefined && (
                <div className="bg-white p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Receiving TDs</div>
                  <div className="text-2xl font-bold text-ou-crimson">{player.stats.touchdowns}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Defensive Stats (Single Season - Fallback) - Only show if no multi-season stats */}
        {(player.stats?.tackles !== undefined || player.stats?.sacks !== undefined || player.stats?.interceptions !== undefined) && 
         (!player.seasonStats || Object.keys(player.seasonStats).length === 0) && (
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Defensive</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {player.stats.tackles !== undefined && (
                <div className="bg-white p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Tackles</div>
                  <div className="text-2xl font-bold text-ou-crimson">{player.stats.tackles}</div>
                </div>
              )}
              {player.stats.sacks !== undefined && (
                <div className="bg-white p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Sacks</div>
                  <div className="text-2xl font-bold text-ou-crimson">{player.stats.sacks}</div>
                </div>
              )}
              {player.stats.interceptions !== undefined && (
                <div className="bg-white p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Interceptions</div>
                  <div className="text-2xl font-bold text-ou-crimson">{player.stats.interceptions}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {!player.stats && (
          <div className="text-center py-12 text-gray-500">
            <p>No statistics available for this player</p>
          </div>
        )}
      </div>
    )
  }

  const renderHighPerformanceTab = () => {
    return (
      <div className="space-y-6">
        {/* Sub-tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-4" aria-label="High Performance Sub Tabs">
            {(['Catapult', 'Force Plate', 'Body Composition'] as HighPerformanceSubTab[]).map((subTab) => (
              <button
                key={subTab}
                onClick={() => setActiveHPSubTab(subTab)}
                className={`py-3 px-4 border-b-2 font-medium text-sm ${
                  activeHPSubTab === subTab
                    ? 'border-ou-crimson text-ou-crimson'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {subTab}
              </button>
            ))}
          </nav>
        </div>

        {/* Catapult Sub-tab */}
        {activeHPSubTab === 'Catapult' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-ou-crimson mb-4">Catapult Data - Last 7 Days</h2>
            {player.catapultData && player.catapultData.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white rounded-lg overflow-hidden">
                    <thead className="bg-ou-crimson text-white">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Type</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Player Load</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">ACR</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Max Velocity (mph)</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Total Distance (yds)</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">High Speed Running (yds)</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">High Intensity Accels</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">High Intensity Decels</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {player.catapultData.map((session, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {new Date(session.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 capitalize">{session.type}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {session.playerLoad?.toLocaleString() ?? '-'}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-semibold ${
                            session.acr && session.acr > 1.2 ? 'text-red-600' : 'text-gray-700'
                          }`}>
                            {session.acr?.toFixed(2) ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {session.maxVelocity?.toFixed(1) ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {session.totalDistance?.toLocaleString() ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {session.highSpeedRunning?.toLocaleString() ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {session.highIntensityAccelerations ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {session.highIntensityDecelerations ?? '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Longitudinal View with dropdown */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">Longitudinal View</h3>
                    <select
                      value={selectedCatapultMetric}
                      onChange={(e) => setSelectedCatapultMetric(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 hover:border-ou-crimson focus:outline-none focus:border-ou-crimson focus:ring-2 focus:ring-ou-crimson focus:ring-opacity-20"
                    >
                      <option value="playerLoad">Player Load</option>
                      <option value="acr">ACR</option>
                      <option value="maxVelocity">Max Velocity</option>
                      <option value="totalDistance">Total Distance</option>
                      <option value="highSpeedRunning">High Speed Running</option>
                      <option value="highIntensityAccelerations">High Intensity Accelerations</option>
                      <option value="highIntensityDecelerations">High Intensity Decelerations</option>
                    </select>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={player.catapultData.map(session => {
                        let value = 0
                        switch (selectedCatapultMetric) {
                          case 'playerLoad':
                            value = session.playerLoad ?? 0
                            break
                          case 'acr':
                            value = session.acr ?? 0
                            break
                          case 'maxVelocity':
                            value = session.maxVelocity ?? 0
                            break
                          case 'totalDistance':
                            value = session.totalDistance ?? 0
                            break
                          case 'highSpeedRunning':
                            value = session.highSpeedRunning ?? 0
                            break
                          case 'highIntensityAccelerations':
                            value = session.highIntensityAccelerations ?? 0
                            break
                          case 'highIntensityDecelerations':
                            value = session.highIntensityDecelerations ?? 0
                            break
                        }
                        return {
                          date: new Date(session.date).toLocaleDateString(),
                          value
                        }
                      })}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="value" stroke="#841617" strokeWidth={2} name={selectedCatapultMetric} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>No Catapult data available</p>
              </div>
            )}
          </div>
        )}

        {/* Force Plate Sub-tab */}
        {activeHPSubTab === 'Force Plate' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-ou-crimson">Force Plate Data - Last 5-7 Tests</h2>
              {player.forcePlateData && player.forcePlateData.length > 0 && player.forcePlateData[0]?.metrics && (
                <select
                  value={selectedForcePlateMetric}
                  onChange={(e) => setSelectedForcePlateMetric(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 hover:border-ou-crimson focus:outline-none focus:border-ou-crimson focus:ring-2 focus:ring-ou-crimson focus:ring-opacity-20"
                >
                  {Object.keys(player.forcePlateData[0].metrics).map(metric => (
                    <option key={metric} value={metric}>{metric}</option>
                  ))}
                </select>
              )}
            </div>
            {player.forcePlateData && player.forcePlateData.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white rounded-lg overflow-hidden">
                    <thead className="bg-ou-crimson text-white">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">
                          Value {player.forcePlateData[0]?.metrics[selectedForcePlateMetric]?.unit && `(${player.forcePlateData[0].metrics[selectedForcePlateMetric].unit})`}
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">CoV</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">% Change</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {player.forcePlateData.map((test, index) => {
                        const metric = test.metrics[selectedForcePlateMetric]
                        if (!metric) return null
                        const isPositive = metric.percentChange && metric.percentChange > (metric.cov || 0) * 100
                        const isNegative = metric.percentChange && metric.percentChange < -(metric.cov || 0) * 100
                        const displayValue = metric.unit === 's' 
                          ? metric.value.toFixed(2)
                          : metric.unit === 'cm'
                          ? metric.value.toFixed(1)
                          : metric.value.toLocaleString()
                        return (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-700">{test.date}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {displayValue} {metric.unit && <span className="text-gray-500">{metric.unit}</span>}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {metric.cov ? `${(metric.cov * 100).toFixed(1)}%` : '-'}
                            </td>
                            <td className={`px-4 py-3 text-sm text-right font-semibold ${
                              isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-700'
                            }`}>
                              {metric.percentChange !== undefined 
                                ? `${metric.percentChange > 0 ? '+' : ''}${metric.percentChange.toFixed(1)}%`
                                : '-'
                              }
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Trend Line Chart */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">
                    Trend Line - {selectedForcePlateMetric} 
                    {player.forcePlateData[0]?.metrics[selectedForcePlateMetric]?.unit && ` (${player.forcePlateData[0].metrics[selectedForcePlateMetric].unit})`}
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      {(() => {
                        const chartData = player.forcePlateData.map(test => ({
                          date: test.date,
                          value: test.metrics[selectedForcePlateMetric]?.value ?? 0
                        }))
                        
                        // Calculate y-axis domain with small padding for better visualization
                        const values = chartData.map(d => d.value)
                        const minValue = Math.min(...values)
                        const maxValue = Math.max(...values)
                        const range = maxValue - minValue
                        const padding = range * 0.1 // 10% padding
                        const domainMin = Math.max(0, minValue - padding)
                        const domainMax = maxValue + padding
                        
                        // Calculate linear regression for trend line
                        const n = chartData.length
                        const sumX = chartData.reduce((sum, _, i) => sum + i, 0)
                        const sumY = values.reduce((sum, val) => sum + val, 0)
                        const sumXY = chartData.reduce((sum, d, i) => sum + i * d.value, 0)
                        const sumX2 = chartData.reduce((sum, _, i) => sum + i * i, 0)
                        
                        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
                        const intercept = (sumY - slope * sumX) / n
                        
                        // Add trend line values to data
                        const dataWithTrend = chartData.map((d, i) => ({
                          ...d,
                          trend: slope * i + intercept
                        }))
                        
                        const unit = player.forcePlateData[0]?.metrics[selectedForcePlateMetric]?.unit || ''
                        
                        return (
                          <LineChart data={dataWithTrend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis 
                              domain={[domainMin, domainMax]}
                              label={{ value: unit, angle: -90, position: 'insideLeft' }}
                            />
                            <Tooltip 
                              formatter={(value: number | undefined) => {
                                if (value === undefined) return ['-', selectedForcePlateMetric]
                                return [
                                  `${value.toFixed(unit === 's' ? 2 : unit === 'cm' ? 1 : 0)} ${unit}`,
                                  selectedForcePlateMetric
                                ]
                              }}
                            />
                            <Legend />
                            <Line 
                              type="monotone" 
                              dataKey="value" 
                              stroke="#841617" 
                              strokeWidth={2} 
                              name={selectedForcePlateMetric}
                              dot={{ r: 4 }}
                            />
                            <Line 
                              type="linear" 
                              dataKey="trend" 
                              stroke="#dc2626" 
                              strokeWidth={2} 
                              strokeDasharray="5 5"
                              name="Trend"
                              dot={false}
                            />
                          </LineChart>
                        )
                      })()}
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>No Force Plate data available</p>
              </div>
            )}
          </div>
        )}

        {/* Body Composition Sub-tab */}
        {activeHPSubTab === 'Body Composition' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-ou-crimson mb-4">Body Composition - Longitudinal View</h2>
            {player.bodyCompositionData && player.bodyCompositionData.length > 0 ? (
              <>
                {/* Latest Results Summary */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">Latest Test Results</h3>
                  {(() => {
                    const latest = player.bodyCompositionData[player.bodyCompositionData.length - 1]
                    return (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-lg">
                          <div className="text-sm text-gray-600">Weight</div>
                          <div className="text-2xl font-bold text-ou-crimson">{latest.weight} lbs</div>
                        </div>
                        <div className="bg-white p-4 rounded-lg">
                          <div className="text-sm text-gray-600">Body Fat %</div>
                          <div className="text-2xl font-bold text-ou-crimson">{latest.bodyFat}%</div>
                        </div>
                        <div className="bg-white p-4 rounded-lg">
                          <div className="text-sm text-gray-600">Muscle Mass</div>
                          <div className="text-2xl font-bold text-ou-crimson">{latest.muscleMass} lbs</div>
                        </div>
                        {latest.bmi && (
                          <div className="bg-white p-4 rounded-lg">
                            <div className="text-sm text-gray-600">BMI</div>
                            <div className="text-2xl font-bold text-ou-crimson">{latest.bmi}</div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
                {/* Test History Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white rounded-lg overflow-hidden">
                    <thead className="bg-ou-crimson text-white">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Weight (lbs)</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Body Fat (%)</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Muscle Mass (lbs)</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">BMI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {player.bodyCompositionData.map((test, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-700">{test.date}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">{test.weight}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">{test.bodyFat}%</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">{test.muscleMass}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">{test.bmi ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Longitudinal View */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">Longitudinal View</h3>
                    <select
                      value={selectedBodyCompMetric}
                      onChange={(e) => setSelectedBodyCompMetric(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 hover:border-ou-crimson focus:outline-none focus:border-ou-crimson focus:ring-2 focus:ring-ou-crimson focus:ring-opacity-20"
                    >
                      <option value="weight">Weight (lbs)</option>
                      <option value="bodyFat">Body Fat (%)</option>
                      <option value="muscleMass">Muscle Mass (lbs)</option>
                      <option value="bmi">BMI</option>
                    </select>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      {(() => {
                        const metricLabels: Record<string, { label: string; unit: string }> = {
                          weight: { label: 'Weight', unit: 'lbs' },
                          bodyFat: { label: 'Body Fat', unit: '%' },
                          muscleMass: { label: 'Muscle Mass', unit: 'lbs' },
                          bmi: { label: 'BMI', unit: '' }
                        }
                        
                        const metricInfo = metricLabels[selectedBodyCompMetric] || metricLabels.weight
                        
                        const chartData = player.bodyCompositionData.map(test => {
                          let value = 0
                          switch (selectedBodyCompMetric) {
                            case 'weight':
                              value = test.weight
                              break
                            case 'bodyFat':
                              value = test.bodyFat
                              break
                            case 'muscleMass':
                              value = test.muscleMass
                              break
                            case 'bmi':
                              value = test.bmi ?? 0
                              break
                          }
                          return {
                            date: test.date,
                            value
                          }
                        })
                        
                        // Calculate y-axis domain with padding
                        const values = chartData.map(d => d.value)
                        const minValue = Math.min(...values)
                        const maxValue = Math.max(...values)
                        const range = maxValue - minValue
                        const padding = range * 0.1 // 10% padding
                        const domainMin = Math.max(0, minValue - padding)
                        const domainMax = maxValue + padding
                        
                        // Calculate linear regression for trend line
                        const n = chartData.length
                        const sumX = chartData.reduce((sum, _, i) => sum + i, 0)
                        const sumY = values.reduce((sum, val) => sum + val, 0)
                        const sumXY = chartData.reduce((sum, d, i) => sum + i * d.value, 0)
                        const sumX2 = chartData.reduce((sum, _, i) => sum + i * i, 0)
                        
                        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
                        const intercept = (sumY - slope * sumX) / n
                        
                        // Add trend line values to data
                        const dataWithTrend = chartData.map((d, i) => ({
                          ...d,
                          trend: slope * i + intercept
                        }))
                        
                        return (
                          <LineChart data={dataWithTrend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis 
                              domain={[domainMin, domainMax]}
                              label={{ 
                                value: metricInfo.unit ? `${metricInfo.label} (${metricInfo.unit})` : metricInfo.label, 
                                angle: -90, 
                                position: 'insideLeft' 
                              }}
                            />
                            <Tooltip 
                              formatter={(value: number | undefined) => {
                                if (value === undefined) return ['-', metricInfo.label]
                                return [
                                  `${value.toFixed(selectedBodyCompMetric === 'bodyFat' || selectedBodyCompMetric === 'bmi' ? 1 : 0)} ${metricInfo.unit}`,
                                  metricInfo.label
                                ]
                              }}
                            />
                            <Legend />
                            <Line 
                              type="monotone" 
                              dataKey="value" 
                              stroke="#841617" 
                              strokeWidth={2} 
                              name={`${metricInfo.label}${metricInfo.unit ? ` (${metricInfo.unit})` : ''}`}
                              dot={{ r: 4 }}
                            />
                            <Line 
                              type="linear" 
                              dataKey="trend" 
                              stroke="#dc2626" 
                              strokeWidth={2} 
                              strokeDasharray="5 5"
                              name="Trend"
                              dot={false}
                            />
                          </LineChart>
                        )
                      })()}
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>No Body Composition data available</p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderPlayerDevelopmentTab = () => {
    const handleAddNote = () => {
      if (!newNote.trim()) return
      // In production, this would call an API to save the note
      const note = {
        id: `note-${Date.now()}`,
        playerName: player.name,
        note: newNote,
        createdAt: new Date().toISOString(),
        createdBy: newNoteAuthor || 'Coach'
      }
      setPlayer({
        ...player,
        notes: [...(player.notes || []), note]
      })
      setNewNote('')
      setNewNoteAuthor('')
    }
    
    const renderRatingBar = (label: string, value: number) => (
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="text-sm font-bold text-ou-crimson">{value}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              value >= 90 ? 'bg-green-500' :
              value >= 80 ? 'bg-blue-500' :
              value >= 70 ? 'bg-yellow-500' :
              'bg-red-500'
            }`}
            style={{ width: `${value}%` }}
          />
        </div>
      </div>
    )
    
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-ou-crimson mb-4">Player Development</h2>
        
        {/* Development Categories */}
        {player.playerDevelopment && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Physical */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Physical</h3>
              {renderRatingBar('Size', player.playerDevelopment.physical.size)}
              {renderRatingBar('Speed', player.playerDevelopment.physical.speed)}
              {renderRatingBar('Strength', player.playerDevelopment.physical.strength)}
              {renderRatingBar('Athleticism', player.playerDevelopment.physical.athleticism)}
              {renderRatingBar('Stamina', player.playerDevelopment.physical.stamina)}
            </div>
            
            {/* Tactical */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Tactical</h3>
              {renderRatingBar('Awareness', player.playerDevelopment.tactical.awareness)}
              {renderRatingBar('Instinct', player.playerDevelopment.tactical.instinct)}
              {renderRatingBar('Judgement', player.playerDevelopment.tactical.judgement)}
              {renderRatingBar('Football Intelligence', player.playerDevelopment.tactical.footballIntelligence)}
            </div>
            
            {/* Mental */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Mental</h3>
              {renderRatingBar('Confidence', player.playerDevelopment.mental.confidence)}
              {renderRatingBar('Toughness', player.playerDevelopment.mental.toughness)}
              {renderRatingBar('Personal Drive', player.playerDevelopment.mental.personalDrive)}
              {renderRatingBar('Commitment', player.playerDevelopment.mental.commitment)}
            </div>
            
            {/* Technical */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Technical (Position-Specific)</h3>
              {Object.entries(player.playerDevelopment.technical).map(([attr, value]) => (
                <div key={attr}>
                  {renderRatingBar(attr, value)}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Notes/Timeline */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Notes Timeline</h3>
          
          {/* Add Note Form */}
          <div className="mb-6 bg-white p-4 rounded-lg">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Add Note</label>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ou-crimson"
                  rows={3}
                  placeholder="Enter a note about this player..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
                <input
                  type="text"
                  value={newNoteAuthor}
                  onChange={(e) => setNewNoteAuthor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ou-crimson"
                  placeholder="Coach name (optional)"
                />
              </div>
              <button
                onClick={handleAddNote}
                className="px-4 py-2 bg-ou-crimson text-white rounded-md hover:bg-red-800 transition-colors"
              >
                Add Note
              </button>
            </div>
          </div>
          
          {/* Notes Timeline */}
          {player.notes && player.notes.length > 0 ? (
            <div className="space-y-4">
              {[...player.notes].reverse().map((note) => (
                <div
                  key={note.id}
                  className="bg-white p-4 rounded-lg border-l-4 border-blue-400 relative"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-full" />
                  <p className="text-gray-800 ml-4">{note.note}</p>
                  <div className="mt-2 ml-4 text-xs text-gray-500">
                    {new Date(note.createdAt).toLocaleString()}
                    {note.createdBy && ` • ${note.createdBy}`}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No notes yet. Add a note to start tracking development.</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationBar />
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          {/* Player Header with Rectangle Border */}
          <div className="border-4 border-ou-crimson rounded-xl p-6 mb-6 bg-gradient-to-br from-gray-50 to-white shadow-lg">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Left Side: Headshot and Basic Info */}
              <div className="flex items-start gap-6 flex-1">
                {currentHeadshot ? (
                  <div className="flex-shrink-0">
                    <img
                      src={currentHeadshot}
                      alt={player.name}
                      className="w-32 h-32 md:w-40 md:h-40 rounded-lg object-cover border-2 border-gray-300 shadow-md"
                      onError={handleImageError}
                    />
                  </div>
                ) : (
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-lg bg-ou-crimson text-white flex items-center justify-center font-bold text-3xl md:text-4xl border-2 border-gray-300 shadow-md">
                    {player.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    <h1 className="text-3xl md:text-4xl font-bold text-ou-crimson">
                      {player.name}
                    </h1>
                    {player.number && (
                      <span className="text-2xl md:text-3xl font-bold text-gray-700">#{player.number}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <p className="text-xl md:text-2xl font-semibold text-gray-700">
                      {player.position}
                    </p>
                    {player.class && (
                      <span className="text-lg text-gray-600">• {player.class}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-600">Sooner Score:</span>
                      <div className="relative inline-block">
                        <div className="flex items-center gap-1">
                          <div className="text-3xl font-bold text-ou-crimson">
                            {calculateMaddenGrade(player)}
                          </div>
                          <div className="relative group">
                            <div className="w-5 h-5 bg-gray-400 hover:bg-gray-500 text-white rounded-full flex items-center justify-center text-xs cursor-help transition-colors">
                              ?
                            </div>
                            {/* Tooltip */}
                            <div className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                              <div className="font-semibold mb-1 text-sm">Sooner Score</div>
                              <div className="text-gray-300 leading-relaxed">
                                This is a placeholder metric for future internal models. As we build our analytics system, we'll use this to understand the variables that contribute to player performance and develop our own proprietary scoring system.
                              </div>
                              {/* Arrow */}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                <div className="w-2 h-2 bg-gray-900 transform rotate-45"></div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-ou-crimson via-red-600 to-ou-crimson rounded-full opacity-50"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side: Advanced Stats */}
              {player.seasonStats && Object.keys(player.seasonStats).length > 0 && (
                <div className="flex-1">
                  <div className="flex gap-3">
                    {(() => {
                      const latestYear = Math.max(...Object.keys(player.seasonStats).map(Number))
                      const latestStats = player.seasonStats[latestYear]
                      const metrics = getPositionAdvancedMetrics(player, latestStats, latestYear)
                      
                      return metrics.map((metric) => (
                        <div 
                          key={metric.key}
                          className="bg-gray-100 rounded-lg p-4 border border-gray-200 flex-1 min-w-[150px]"
                          title={metric.description || metric.label}
                        >
                          <div className="text-xs font-medium text-gray-600 mb-1">{metric.label}</div>
                          <div className="text-2xl font-bold text-ou-crimson">
                            {typeof metric.value === 'number' 
                              ? metric.value.toLocaleString() 
                              : metric.value}
                            {metric.unit}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{latestYear}</div>
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="flex space-x-8" aria-label="Profile Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`
                    py-4 px-1 border-b-2 font-medium text-sm bg-transparent
                    ${
                      activeTab === tab
                        ? 'border-ou-crimson text-ou-crimson'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                  style={activeTab === tab ? { color: '#841617', backgroundColor: 'transparent' } : undefined}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="mt-6">
            {activeTab === 'Analytics' && renderAnalyticsTab()}
            {activeTab === 'High Performance' && renderHighPerformanceTab()}
            {activeTab === 'Player Development' && renderPlayerDevelopmentTab()}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PlayerProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50">
        <NavigationBar />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ou-crimson mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <PlayerProfileContent />
    </Suspense>
  )
}
