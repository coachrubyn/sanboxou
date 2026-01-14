// Football position types
export type FootballPosition = 
  | 'QB' | 'RB' | 'WR' | 'TE' | 'OL' | 'T' | 'G' | 'C'  // Offense
  | 'DL' | 'LB' | 'ILB' | 'EDGE' | 'IDL' | 'CB' | 'S'   // Defense
  | 'K' | 'P' | 'LS'                                      // Special Teams

// Player status types with color coding
export type PlayerStatus = 'good' | 'warning' | 'not-available' | 'rehab'

// Player role types for depth chart
export type PlayerRole = 'Starter' | 'Back-Up' | 'Practice Player' | 'Rehab'

// Position groups for organization
export const POSITION_GROUPS: Record<string, FootballPosition[]> = {
  'Offense': ['QB', 'WR', 'RB', 'TE', 'T', 'G', 'C'],
  'Defense': ['ILB', 'EDGE', 'IDL', 'CB', 'S'],
  'Special Teams': ['K', 'P', 'LS']
}

// Map general positions to granular positions
// Based on CFBD position codes and depth chart mappings
export function mapToGranularPosition(position: string): FootballPosition {
  const positionUpper = position.toUpperCase()
  
  // OL positions - map specific positions when CFBD provides them
  if (positionUpper === 'OT' || positionUpper === 'LT' || positionUpper === 'RT') return 'T'
  if (positionUpper === 'OG' || positionUpper === 'LG' || positionUpper === 'RG') return 'G'
  if (positionUpper === 'C') return 'C'
  if (positionUpper === 'OL') {
    // If CFBD only provides 'OL', default to T (can be overridden by depth chart)
    return 'T'
  }
  
  // DL positions - map based on specific position codes
  if (positionUpper === 'LDE' || positionUpper === 'RDE') return 'EDGE'
  if (positionUpper === 'DE') return 'EDGE' // Generic DE maps to EDGE
  if (positionUpper === 'DT' || positionUpper === 'NT') return 'IDL'
  if (positionUpper === 'DL') {
    // Generic DL - default to IDL (can be overridden by depth chart)
    return 'IDL'
  }
  
  // LB positions
  if (positionUpper === 'WLB' || positionUpper === 'MLB' || positionUpper === 'ILB') return 'ILB'
  if (positionUpper === 'OLB') return 'EDGE' // OLB often plays edge
  if (positionUpper === 'LB') {
    // Generic LB - default to ILB
    return 'ILB'
  }
  
  // Defensive back positions
  if (positionUpper === 'LCB' || positionUpper === 'RCB' || positionUpper === 'CB') return 'CB'
  if (positionUpper === 'DB') return 'CB' // Generic DB maps to CB
  if (positionUpper === 'CHEET' || positionUpper === 'SS' || positionUpper === 'FS' || positionUpper === 'S') return 'S'
  
  // Map other positions
  const positionMap: Record<string, FootballPosition> = {
    'QB': 'QB',
    'RB': 'RB',
    'FB': 'RB',
    'WR': 'WR',
    'TE': 'TE',
    'K': 'K',
    'PK': 'K',
    'P': 'P',
    'PT': 'P',
    'LS': 'LS',
  }
  
  return positionMap[positionUpper] || 'OL'
}

// Player interface
export interface Player {
  id: string
  name: string
  position: FootballPosition
  number?: number
  class?: string // Freshman, Sophomore, Junior, Senior, etc.
  headshot?: string
  status: PlayerStatus
  role?: PlayerRole // Depth chart role: Starter, Back-Up, Reserve, Rehab
  depthChartOrder?: number // Order within the role column (for depth chart)
  alerts?: Array<{
    type: string
    message: string
    severity: 'low' | 'moderate' | 'high'
  }>
  notes?: PlayerNote[]
  // CFBD API stats
  stats?: {
    season?: number
    games?: number
    passingYards?: number
    rushingYards?: number
    receivingYards?: number
    touchdowns?: number
    tackles?: number
    sacks?: number
    interceptions?: number
  }
  // Multi-season stats organized by year
  seasonStats?: Record<number, {
    season: number
    team?: string // Team the player played for that season
    games?: number
    // Advanced metrics from CFBD
    usage?: number // Overall usage rate from CFBD
    ppa?: number // Average PPA (points per attempt) from CFBD
    // Passing stats
    passingYards?: number
    passingTDs?: number
    passingAttempts?: number
    completions?: number
    interceptions?: number
    completionPercentage?: number
    // Rushing stats
    rushingYards?: number
    rushingTDs?: number
    rushingAttempts?: number
    // Receiving stats
    receivingYards?: number
    receivingTDs?: number
    receptions?: number
    // Defensive stats
    tackles?: number
    soloTackles?: number
    sacks?: number
    tacklesForLoss?: number
    passesDefended?: number
    qbHurries?: number
    defensiveTDs?: number
    // Kicking stats
    fieldGoalsMade?: number
    fieldGoalsAttempted?: number
    fieldGoalLong?: number
    extraPointsMade?: number
    extraPointsAttempted?: number
    kickingPoints?: number
    // Punting stats
    punts?: number
    puntingYards?: number
    puntingLong?: number
    puntsInside20?: number
    puntingTouchbacks?: number
  }>
  // Performance metrics (GPS/Catapult, etc.)
  metrics?: {
    maxVelocity?: number
    totalDistance?: number
    playerLoad?: number
    acr?: number // Acute:Chronic Ratio
  }
  // Injury risk flags
  injuryFlags?: {
    playerLoad?: boolean  // Spike in player load
    acr?: boolean         // Spike in ACR
    medical?: boolean     // Medical injury flag
  }
  // Game-by-game statistics
  gameStats?: Array<{
    gameId: string
    date: string
    opponent: string
    stats: Record<string, number>
    quarters: Array<{
      quarter: number
      stats: Record<string, number>
    }>
    coachGrade?: number // Subjective grade from position coach (0-100)
  }>
  // Catapult data
  catapultData?: Array<{
    date: string
    type: 'practice' | 'game'
    playerLoad?: number
    acr?: number
    maxVelocity?: number
    totalDistance?: number
    highSpeedRunning?: number // High speed running distance in yards
    highIntensityAccelerations?: number // Number of high intensity accelerations
    highIntensityDecelerations?: number // Number of high intensity decelerations
  }>
  // Force plate data - now supports multiple metrics
  forcePlateData?: Array<{
    date: string
    metrics: Record<string, {
      value: number
      unit?: string // Unit for the metric (N, W, cm, s, etc.)
      cov?: number // Coefficient of Variation
      percentChange?: number // Percentage change from baseline
    }>
  }>
  // Body composition data
  bodyCompositionData?: Array<{
    date: string
    weight: number
    bodyFat: number
    muscleMass: number
    bmi?: number
  }>
  // Player development ratings
  playerDevelopment?: {
    physical: {
      size: number
      speed: number
      strength: number
      athleticism: number
      stamina: number
    }
    tactical: {
      awareness: number
      instinct: number
      judgement: number
      footballIntelligence: number
    }
    mental: {
      confidence: number
      toughness: number
      personalDrive: number
      commitment: number
    }
    technical: Record<string, number> // Position-specific
  }
}

// Player note interface
export interface PlayerNote {
  id: string
  playerName: string
  note: string
  createdAt: string
  expiresAt?: string
  createdBy?: string
}
