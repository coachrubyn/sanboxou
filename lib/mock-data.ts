import { Player, FootballPosition } from './types'

/**
 * Generate mock game-by-game statistics
 */
export function generateMockGameStats(player: Player, season: number = 2025): Player['gameStats'] {
  const games: Player['gameStats'] = []
  const opponents = ['Texas', 'Texas A&M', 'Baylor', 'TCU', 'Oklahoma State', 'Kansas State', 'Iowa State', 'West Virginia', 'Kansas', 'Texas Tech']
  
  // Generate 8-12 games
  const numGames = Math.floor(Math.random() * 5) + 8
  const startDate = new Date(season, 8, 1) // September 1st
  
  for (let i = 0; i < numGames; i++) {
    const gameDate = new Date(startDate)
    gameDate.setDate(startDate.getDate() + (i * 7)) // One game per week
    
    const opponent = opponents[Math.floor(Math.random() * opponents.length)]
    const gameId = `game-${season}-${i + 1}`
    
    // Generate position-specific stats
    const gameStats: any = {}
    const quarters: Array<{ quarter: number; stats: any }> = []
    
    if (player.position === 'QB') {
      gameStats.passingYards = Math.floor(Math.random() * 350) + 150
      gameStats.passingTDs = Math.floor(Math.random() * 4) + 1
      gameStats.interceptions = Math.random() > 0.7 ? Math.floor(Math.random() * 2) : 0
      gameStats.completions = Math.floor(Math.random() * 25) + 15
      gameStats.attempts = gameStats.completions + Math.floor(Math.random() * 10) + 5
      
      // Quarter breakdown
      for (let q = 1; q <= 4; q++) {
        quarters.push({
          quarter: q,
          stats: {
            passingYards: Math.floor(gameStats.passingYards / 4) + Math.floor(Math.random() * 50) - 25,
            passingTDs: q <= 2 ? Math.floor(Math.random() * 2) : 0,
            completions: Math.floor(gameStats.completions / 4) + Math.floor(Math.random() * 5) - 2,
            attempts: Math.floor(gameStats.attempts / 4) + Math.floor(Math.random() * 3) - 1
          }
        })
      }
    } else if (player.position === 'RB') {
      gameStats.rushingYards = Math.floor(Math.random() * 150) + 50
      gameStats.rushingTDs = Math.random() > 0.5 ? Math.floor(Math.random() * 2) + 1 : 0
      gameStats.attempts = Math.floor(Math.random() * 20) + 10
      gameStats.receivingYards = Math.random() > 0.6 ? Math.floor(Math.random() * 50) : 0
      
      for (let q = 1; q <= 4; q++) {
        quarters.push({
          quarter: q,
          stats: {
            rushingYards: Math.floor(gameStats.rushingYards / 4) + Math.floor(Math.random() * 20) - 10,
            attempts: Math.floor(gameStats.attempts / 4) + Math.floor(Math.random() * 2) - 1
          }
        })
      }
    } else if (player.position === 'WR' || player.position === 'TE') {
      gameStats.receivingYards = Math.floor(Math.random() * 120) + 30
      gameStats.receptions = Math.floor(Math.random() * 8) + 3
      gameStats.receivingTDs = Math.random() > 0.6 ? Math.floor(Math.random() * 2) + 1 : 0
      
      for (let q = 1; q <= 4; q++) {
        quarters.push({
          quarter: q,
          stats: {
            receivingYards: Math.floor(gameStats.receivingYards / 4) + Math.floor(Math.random() * 15) - 7,
            receptions: Math.floor(gameStats.receptions / 4) + (Math.random() > 0.5 ? 1 : 0)
          }
        })
      }
    } else if (['DL', 'LB', 'ILB', 'EDGE', 'IDL', 'CB', 'S'].includes(player.position)) {
      gameStats.tackles = Math.floor(Math.random() * 10) + 3
      gameStats.soloTackles = Math.floor(gameStats.tackles * 0.7)
      gameStats.sacks = Math.random() > 0.7 ? Math.floor(Math.random() * 2) + 1 : 0
      gameStats.tacklesForLoss = Math.random() > 0.5 ? Math.floor(Math.random() * 2) + 1 : 0
      if (['CB', 'S'].includes(player.position)) {
        gameStats.interceptions = Math.random() > 0.8 ? 1 : 0
        gameStats.passesDefended = Math.random() > 0.6 ? Math.floor(Math.random() * 2) + 1 : 0
      }
      
      for (let q = 1; q <= 4; q++) {
        quarters.push({
          quarter: q,
          stats: {
            tackles: Math.floor(gameStats.tackles / 4) + (Math.random() > 0.5 ? 1 : 0),
            soloTackles: Math.floor(gameStats.soloTackles / 4)
          }
        })
      }
    }
    
    // Coach grade (subjective score 0-100)
    const coachGrade = Math.floor(Math.random() * 30) + 70 // 70-100 range
    
    games.push({
      gameId,
      date: gameDate.toISOString().split('T')[0],
      opponent,
      stats: gameStats,
      quarters,
      coachGrade
    })
  }
  
  return games
}

/**
 * Generate mock catapult data (last 7 days - week pattern: 5 practices + game)
 */
export function generateMockCatapultData(player: Player): Player['catapultData'] {
  const data: Player['catapultData'] = []
  const today = new Date()
  
  // Generate a week pattern: 5 practices followed by a game
  // Assuming we're looking at the last 7 days, we'll have 5 practices and 1 game
  const practiceDays = [6, 5, 4, 3, 2] // Last 5 days are practices
  const gameDay = 0 // Most recent day is game day
  
  // Add practices
  for (const dayOffset of practiceDays) {
    const date = new Date(today)
    date.setDate(today.getDate() - dayOffset)
    date.setHours(14, 0, 0) // Afternoon practice
    
    data.push({
      date: date.toISOString(),
      type: 'practice',
      playerLoad: Math.floor(Math.random() * 400) + 200, // 200-600 for practice
      acr: Math.random() * 1.0 + 0.7, // 0.7 to 1.7 for practice
      maxVelocity: Math.random() * 3 + 16, // 16-19 mph
      totalDistance: Math.floor(Math.random() * 4000) + 2000, // 2000-6000 yards
      highSpeedRunning: Math.floor(Math.random() * 500) + 200, // 200-700 yards
      highIntensityAccelerations: Math.floor(Math.random() * 15) + 5, // 5-20
      highIntensityDecelerations: Math.floor(Math.random() * 15) + 5 // 5-20
    })
  }
  
  // Add game
  const gameDate = new Date(today)
  gameDate.setHours(19, 0, 0) // Evening game
  
  data.push({
    date: gameDate.toISOString(),
    type: 'game',
    playerLoad: Math.floor(Math.random() * 500) + 400, // 400-900 for game
    acr: Math.random() * 1.2 + 0.8, // 0.8 to 2.0 for game
    maxVelocity: Math.random() * 4 + 17, // 17-21 mph
    totalDistance: Math.floor(Math.random() * 6000) + 4000, // 4000-10000 yards
    highSpeedRunning: Math.floor(Math.random() * 800) + 400, // 400-1200 yards
    highIntensityAccelerations: Math.floor(Math.random() * 25) + 15, // 15-40
    highIntensityDecelerations: Math.floor(Math.random() * 25) + 15 // 15-40
  })
  
  return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

/**
 * Generate mock force plate data with multiple metrics (last 5-7 tests)
 * Uses realistic values and units for each metric
 */
export function generateMockForcePlateData(player: Player): Player['forcePlateData'] {
  const data: Player['forcePlateData'] = []
  const today = new Date()
  const numTests = Math.floor(Math.random() * 3) + 5 // 5-7 tests
  
  // Define metrics with realistic baseline ranges and units
  const metricConfigs: Record<string, { baseline: number; unit: string; variation: number }> = {
    'Peak Force': { baseline: Math.random() * 1000 + 2500, unit: 'N', variation: 50 }, // 2500-3500 N, ±50 N variation
    'Mean Force': { baseline: Math.random() * 500 + 2000, unit: 'N', variation: 40 }, // 2000-2500 N, ±40 N
    'Rate of Force Development': { baseline: Math.random() * 3000 + 8000, unit: 'N/s', variation: 200 }, // 8000-11000 N/s, ±200
    'Jump Height': { baseline: Math.random() * 15 + 45, unit: 'cm', variation: 1.5 }, // 45-60 cm, ±1.5 cm
    'Power Output': { baseline: Math.random() * 1500 + 3500, unit: 'W', variation: 100 }, // 3500-5000 W, ±100 W
    'Eccentric Rate': { baseline: Math.random() * 1000 + 3000, unit: 'N/s', variation: 150 }, // 3000-4000 N/s, ±150
    'Concentric Rate': { baseline: Math.random() * 2000 + 5000, unit: 'N/s', variation: 200 }, // 5000-7000 N/s, ±200
    'Time to Peak Force': { baseline: Math.random() * 0.15 + 0.25, unit: 's', variation: 0.02 }, // 0.25-0.4 s, ±0.02 s
    'Impulse': { baseline: Math.random() * 100 + 300, unit: 'N·s', variation: 10 }, // 300-400 N·s, ±10
    'Stiffness': { baseline: Math.random() * 4000 + 12000, unit: 'N/m', variation: 300 } // 12000-16000 N/m, ±300
  }
  
  // Store initial baselines for percent change calculation
  const initialBaselines: Record<string, number> = {}
  Object.keys(metricConfigs).forEach(metric => {
    initialBaselines[metric] = metricConfigs[metric].baseline
  })
  
  for (let i = numTests - 1; i >= 0; i--) {
    const testDate = new Date(today)
    testDate.setDate(today.getDate() - (i * 14)) // Tests every 2 weeks
    
    const metrics: Record<string, { value: number; unit: string; cov?: number; percentChange?: number }> = {}
    
    Object.entries(metricConfigs).forEach(([metric, config]) => {
      // Small variation between tests (2-5% typically)
      const variation = (Math.random() - 0.5) * config.variation
      const currentValue = config.baseline + variation
      const cov = Math.random() * 0.03 + 0.02 // 2-5% CoV (smaller for force plate)
      const percentChange = ((currentValue - initialBaselines[metric]) / initialBaselines[metric]) * 100
      
      // Round based on unit
      let roundedValue: number
      if (config.unit === 's') {
        roundedValue = Math.round(currentValue * 100) / 100 // 2 decimal places for seconds
      } else if (config.unit === 'cm') {
        roundedValue = Math.round(currentValue * 10) / 10 // 1 decimal for cm
      } else {
        roundedValue = Math.round(currentValue) // Whole numbers for others
      }
      
      metrics[metric] = {
        value: roundedValue,
        unit: config.unit,
        cov: Math.round(cov * 100) / 100,
        percentChange: Math.round(percentChange * 10) / 10
      }
      
      // Update baseline for next iteration (small drift)
      config.baseline = currentValue
    })
    
    data.push({
      date: testDate.toISOString().split('T')[0],
      metrics
    })
  }
  
  return data
}

/**
 * Generate mock body composition data
 */
export function generateMockBodyCompositionData(player: Player): Player['bodyCompositionData'] {
  const data: Player['bodyCompositionData'] = []
  const today = new Date()
  const numTests = Math.floor(Math.random() * 8) + 4 // 4-12 tests over time
  
  let weight = Math.random() * 50 + 200 // 200-250 lbs
  let bodyFat = Math.random() * 10 + 8 // 8-18%
  let muscleMass = weight * (1 - bodyFat / 100)
  
  for (let i = numTests - 1; i >= 0; i--) {
    const testDate = new Date(today)
    testDate.setDate(today.getDate() - (i * 30)) // Monthly tests
    
    // Simulate changes over time
    weight += (Math.random() - 0.5) * 5
    bodyFat += (Math.random() - 0.5) * 1
    bodyFat = Math.max(5, Math.min(25, bodyFat)) // Clamp between 5-25%
    muscleMass = weight * (1 - bodyFat / 100)
    
    data.push({
      date: testDate.toISOString().split('T')[0],
      weight: Math.round(weight * 10) / 10,
      bodyFat: Math.round(bodyFat * 10) / 10,
      muscleMass: Math.round(muscleMass * 10) / 10,
      bmi: Math.round((weight / (70 * 70 / 703)) * 10) / 10 // Approximate BMI
    })
  }
  
  return data
}

/**
 * Generate mock player development ratings
 */
export function generateMockPlayerDevelopment(player: Player): Player['playerDevelopment'] {
  const generateRating = () => Math.floor(Math.random() * 40) + 60 // 60-100 range
  
  const development: Player['playerDevelopment'] = {
    physical: {
      size: generateRating(),
      speed: generateRating(),
      strength: generateRating(),
      athleticism: generateRating(),
      stamina: generateRating()
    },
    tactical: {
      awareness: generateRating(),
      instinct: generateRating(),
      judgement: generateRating(),
      footballIntelligence: generateRating()
    },
    mental: {
      confidence: generateRating(),
      toughness: generateRating(),
      personalDrive: generateRating(),
      commitment: generateRating()
    },
    technical: {}
  }
  
  // Add position-specific technical attributes
  const technicalAttrs = getTechnicalAttributesForPosition(player.position)
  technicalAttrs.forEach(attr => {
    development.technical[attr] = generateRating()
  })
  
  return development
}

/**
 * Get technical attributes for a position
 */
function getTechnicalAttributesForPosition(position: FootballPosition): string[] {
  const attributes: Record<FootballPosition, string[]> = {
    'QB': ['Footwork', 'Mechanics', 'Long-pass accuracy', 'Short-pass accuracy', 'Passing touch'],
    'RB': ['Footwork', 'Ball carrying mechanics', 'Ball security', 'Pass catching', 'Pass blocking'],
    'WR': ['Footwork', 'Ball tracking skills', 'Ball security', 'Catching skills', 'Reliable soft hands', 'Blocking', 'Route running', 'Run after the catch'],
    'TE': ['Footwork', 'Ball tracking skills', 'Ball security', 'Catching skills', 'Blocking', 'Route running'],
    'OL': ['Footwork', 'Blocking mechanics: run', 'Blocking mechanics: pass', 'Blocking mechanics: power and anchor', 'Blocking mechanics: hands', 'Blocking mechanics: 2nd level/space play', 'Range'],
    'T': ['Footwork', 'Blocking mechanics: run', 'Blocking mechanics: pass', 'Blocking mechanics: power and anchor', 'Blocking mechanics: hands', 'Blocking mechanics: 2nd level/space play', 'Range'],
    'G': ['Footwork', 'Blocking mechanics: run', 'Blocking mechanics: pass', 'Blocking mechanics: power and anchor', 'Blocking mechanics: hands', 'Blocking mechanics: 2nd level/space play', 'Range'],
    'C': ['Footwork', 'Blocking mechanics: run', 'Blocking mechanics: pass', 'Blocking mechanics: power and anchor', 'Blocking mechanics: hands', 'Blocking mechanics: 2nd level/space play', 'Range'],
    'DL': ['Line skills: disruptiveness', 'Line skills: tackling / production', 'Line skills: shed', 'Line skills: gap integrity', 'Line skills: range', 'First step explosion', 'Pass rush skills'],
    'EDGE': ['Line skills: disruptiveness', 'Line skills: tackling / production', 'Line skills: shed', 'Line skills: gap integrity', 'Line skills: range', 'First step explosion', 'Pass rush skills'],
    'IDL': ['Line skills: disruptiveness', 'Line skills: tackling / production', 'Line skills: shed', 'Line skills: gap integrity', 'Line skills: range', 'First step explosion', 'Pass rush skills'],
    'LB': ['Tackling / production', 'Shed', 'Navigate trash', 'Range', 'Man coverage', 'Zone coverage', 'Reroute ability', 'Blitz'],
    'ILB': ['Tackling / production', 'Shed', 'Navigate trash', 'Range', 'Man coverage', 'Zone coverage', 'Reroute ability', 'Blitz'],
    'CB': ['Tackling', 'Catching skills', 'Cover technique: M/M press', 'Cover technique: M/M off', 'Cover technique: zone coverage', 'Footwork and mechanics'],
    'S': ['Tackling', 'Catching skills', 'Cover technique: M/M press', 'Cover technique: M/M off', 'Cover technique: zone coverage', 'Footwork and mechanics'],
    'K': ['Kicking accuracy', 'Kicking power', 'Kicking consistency'],
    'P': ['Punting distance', 'Punting accuracy', 'Punting hang time'],
    'LS': ['Snapping accuracy', 'Snapping consistency']
  }
  
  return attributes[position] || []
}
