import fs from 'fs'
import path from 'path'
import { PlayerRole } from './types'

interface DepthChartPlayer {
  name: string
  number: number
  role: PlayerRole
}

interface DepthChart {
  offense: Record<string, DepthChartPlayer[]>
  defense: Record<string, DepthChartPlayer[]>
  specialTeams: Record<string, DepthChartPlayer[]>
}

// Position mapping from depth chart positions to our FootballPosition types
const POSITION_MAP: Record<string, string[]> = {
  'WR-X': ['WR'],
  'WR-Z': ['WR'],
  'WR-H': ['WR'],
  'LT': ['T'],
  'LG': ['G'],
  'C': ['C'],
  'RG': ['G'],
  'RT': ['T'],
  'TE': ['TE'],
  'QB': ['QB'],
  'RB': ['RB'],
  'LDE': ['EDGE'],
  'RDE': ['EDGE'],
  'NT': ['IDL'],
  'DT': ['IDL'],
  'WLB': ['ILB'],
  'MLB': ['ILB'],
  'CHEET': ['S'],
  'LCB': ['CB'],
  'RCB': ['CB'],
  'SS': ['S'],
  'FS': ['S'],
  'PT': ['P'],
  'PK': ['K'],
  'KO': ['K'],
  'LS': ['LS'],
  'H': [], // Holder - usually QB/P/K, don't assign position
  'PR': [], // Punt Returner - usually WR/CB, don't assign position
  'KR': []  // Kick Returner - usually WR/CB, don't assign position
}

let cachedDepthChart: DepthChart | null = null

/**
 * Load depth chart from JSON file
 */
function loadDepthChart(): DepthChart | null {
  if (cachedDepthChart) {
    return cachedDepthChart
  }

  try {
    const depthChartFile = path.join(process.cwd(), 'data', 'depth-chart.json')
    if (fs.existsSync(depthChartFile)) {
      const content = fs.readFileSync(depthChartFile, 'utf-8')
      cachedDepthChart = JSON.parse(content)
      return cachedDepthChart
    }
  } catch (error) {
    console.error('Error loading depth chart:', error)
  }

  return null
}

/**
 * Normalize player name for matching
 */
function normalizeName(name: string): string {
  if (!name) return ''
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,]/g, '')
    .replace(/'/g, '') // Remove apostrophes (e.g., Jer'Michael -> Jermichael)
    .replace(/\s+(jr|sr|iii|ii|iv|rs|tr)$/i, '')
    .replace(/\s+(rs|tr)\s+/gi, ' ') // Remove RS/TR in middle
    .replace(/\s+/g, ' ') // Normalize whitespace
}

/**
 * Extract last name from full name
 */
function getLastName(name: string): string {
  const parts = name.trim().split(/\s+/)
  // Remove suffixes
  const lastPart = parts[parts.length - 1]
  if (['jr', 'sr', 'iii', 'ii', 'iv', 'rs', 'tr'].includes(lastPart.toLowerCase())) {
    return parts[parts.length - 2] || lastPart
  }
  return lastPart
}

/**
 * Check if two names match (handles variations)
 */
function namesMatch(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false
  
  const norm1 = normalizeName(name1)
  const norm2 = normalizeName(name2)
  
  // Exact match
  if (norm1 === norm2) return true
  
  // Check if one contains the other (for partial matches)
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    // Make sure it's not too short (avoid false matches)
    if (norm1.length >= 5 && norm2.length >= 5) {
      return true
    }
  }
  
  // Split into parts for more flexible matching
  const parts1 = norm1.split(/\s+/).filter(p => p.length > 1)
  const parts2 = norm2.split(/\s+/).filter(p => p.length > 1)
  
  // Check last name match (for cases like "J. Gibson" vs "Javonnie Gibson")
  const lastName1 = getLastName(name1).toLowerCase()
  const lastName2 = getLastName(name2).toLowerCase()
  
  if (lastName1 === lastName2 && lastName1.length > 2) {
    // Last names match, check first name/initial
    const first1 = parts1[0] || ''
    const first2 = parts2[0] || ''
    
    // If first initial matches or one contains the other
    if (first1[0] === first2[0] || 
        (first1.length > 1 && first2.length > 1 && (first1.includes(first2) || first2.includes(first1)))) {
      return true
    }
    
    // If both have same last name and at least one part matches, likely same person
    if (parts1.some(p => parts2.includes(p)) || parts2.some(p => parts1.includes(p))) {
      return true
    }
  }
  
  // Check if all significant parts match (handles middle names, etc.)
  if (parts1.length > 0 && parts2.length > 0) {
    const significantParts1 = parts1.filter(p => p.length > 2)
    const significantParts2 = parts2.filter(p => p.length > 2)
    
    if (significantParts1.length > 0 && significantParts2.length > 0) {
      // If all significant parts of one name are found in the other
      const allMatch1 = significantParts1.every(p => 
        significantParts2.some(p2 => p2.includes(p) || p.includes(p2))
      )
      const allMatch2 = significantParts2.every(p => 
        significantParts1.some(p1 => p1.includes(p) || p.includes(p1))
      )
      
      if (allMatch1 || allMatch2) {
        return true
      }
    }
  }
  
  return false
}

/**
 * Find player in depth chart by name and/or number
 */
export function findPlayerInDepthChart(
  playerName: string,
  playerNumber?: number,
  firstName?: string,
  lastName?: string
): { role: PlayerRole; position?: string } | null {
  const depthChart = loadDepthChart()
  if (!depthChart) {
    return null
  }

  // Try multiple name formats
  const nameVariations: string[] = [playerName]
  if (firstName && lastName) {
    nameVariations.push(`${firstName} ${lastName}`)
    nameVariations.push(`${firstName} ${lastName}`.trim())
  }

  // Try to match by name first (more reliable when there are duplicate numbers)
  const sections = [depthChart.offense, depthChart.defense, depthChart.specialTeams]
  
  for (const section of sections) {
    for (const [position, players] of Object.entries(section)) {
      for (const player of players) {
        // Try matching with all name variations
        for (const nameVar of nameVariations) {
          if (namesMatch(nameVar, player.name)) {
            // If number is provided, verify it matches (but don't require it)
            if (playerNumber === undefined || player.number === playerNumber) {
              return {
                role: player.role as PlayerRole,
                position: POSITION_MAP[position]?.[0] // Return first mapped position
              }
            }
          }
        }
      }
    }
  }

  // If name matching failed, try to match by number only (fallback)
  // But be careful - there can be duplicate numbers across positions
  if (playerNumber !== undefined) {
    // Try to find by number, but prefer matches where name also partially matches
    for (const section of sections) {
      for (const [position, players] of Object.entries(section)) {
        const numberMatches = players.filter(p => p.number === playerNumber)
        if (numberMatches.length > 0) {
          // If multiple players have same number, try to match by name
          if (numberMatches.length === 1) {
            // Only one match, use it
            return {
              role: numberMatches[0].role as PlayerRole,
              position: POSITION_MAP[position]?.[0]
            }
          } else {
            // Multiple players with same number - try to match by name
            for (const match of numberMatches) {
              for (const nameVar of nameVariations) {
                if (namesMatch(nameVar, match.name)) {
                  return {
                    role: match.role as PlayerRole,
                    position: POSITION_MAP[position]?.[0]
                  }
                }
              }
            }
            // If no name match, use first one (but log warning)
            console.warn(`Multiple players with number ${playerNumber}, using first match: ${numberMatches[0].name}`)
            return {
              role: numberMatches[0].role as PlayerRole,
              position: POSITION_MAP[position]?.[0]
            }
          }
        }
      }
    }
  }

  return null
}

/**
 * Get all players from depth chart
 */
export function getAllDepthChartPlayers(): Map<string, { role: PlayerRole; position?: string }> {
  const depthChart = loadDepthChart()
  const playerMap = new Map<string, { role: PlayerRole; position?: string }>()
  
  if (!depthChart) {
    return playerMap
  }

  const sections = [depthChart.offense, depthChart.defense, depthChart.specialTeams]
  
  for (const section of sections) {
    for (const [position, players] of Object.entries(section)) {
      for (const player of players) {
        const normalizedName = normalizeName(player.name)
        const key = `${normalizedName}-${player.number}`
        
        if (!playerMap.has(key)) {
          playerMap.set(key, {
            role: player.role as PlayerRole,
            position: POSITION_MAP[position]?.[0]
          })
        }
      }
    }
  }

  return playerMap
}
