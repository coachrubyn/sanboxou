import { Player, FootballPosition } from './types'

/**
 * Get status emoji for player
 */
export function getStatusEmoji(status: Player['status']): string {
  switch (status) {
    case 'good':
      return '✅'
    case 'warning':
      return '⚠️'
    case 'not-available':
      return '❌'
    case 'rehab':
      return '🏥'
    default:
      return '✅'
  }
}

/**
 * Get status label for player
 */
export function getStatusLabel(status: Player['status']): string {
  switch (status) {
    case 'good':
      return 'Healthy'
    case 'warning':
      return 'Warning'
    case 'not-available':
      return 'Out'
    case 'rehab':
      return 'Rehab'
    default:
      return 'Healthy'
  }
}

/**
 * Get position-specific advanced stats with mock percentiles
 */
export function getPositionAdvancedStats(player: Player): Array<{ label: string; value: string | number; percentile?: number }> {
  const stats: Array<{ label: string; value: string | number; percentile?: number }> = []
  
  // Mock percentile function (in production, this would use real data)
  const getPercentile = (value: number, position: FootballPosition): number => {
    // Mock: return a percentile between 50-95 for demo
    return Math.floor(Math.random() * 45) + 50
  }
  
  switch (player.position) {
    case 'QB':
      if (player.stats?.passingYards) {
        stats.push({
          label: 'Pass Yds',
          value: player.stats.passingYards,
          percentile: getPercentile(player.stats.passingYards, 'QB')
        })
      }
      if (player.stats?.touchdowns) {
        stats.push({
          label: 'TDs',
          value: player.stats.touchdowns,
          percentile: getPercentile(player.stats.touchdowns, 'QB')
        })
      }
      break
    case 'RB':
      if (player.stats?.rushingYards) {
        stats.push({
          label: 'Rush Yds',
          value: player.stats.rushingYards,
          percentile: getPercentile(player.stats.rushingYards, 'RB')
        })
      }
      if (player.stats?.touchdowns) {
        stats.push({
          label: 'TDs',
          value: player.stats.touchdowns,
          percentile: getPercentile(player.stats.touchdowns, 'RB')
        })
      }
      break
    case 'WR':
    case 'TE':
      if (player.stats?.receivingYards) {
        stats.push({
          label: 'Rec Yds',
          value: player.stats.receivingYards,
          percentile: getPercentile(player.stats.receivingYards, 'WR')
        })
      }
      if (player.stats?.touchdowns) {
        stats.push({
          label: 'TDs',
          value: player.stats.touchdowns,
          percentile: getPercentile(player.stats.touchdowns, 'WR')
        })
      }
      break
    case 'DL':
    case 'EDGE':
    case 'IDL':
    case 'LB':
    case 'ILB':
      if (player.stats?.tackles) {
        stats.push({
          label: 'Tackles',
          value: player.stats.tackles,
          percentile: getPercentile(player.stats.tackles, 'LB')
        })
      }
      if (player.stats?.sacks) {
        stats.push({
          label: 'Sacks',
          value: player.stats.sacks,
          percentile: getPercentile(player.stats.sacks, 'LB')
        })
      }
      break
    case 'CB':
    case 'S':
      if (player.stats?.tackles) {
        stats.push({
          label: 'Tackles',
          value: player.stats.tackles,
          percentile: getPercentile(player.stats.tackles, 'CB')
        })
      }
      if (player.stats?.interceptions) {
        stats.push({
          label: 'INTs',
          value: player.stats.interceptions,
          percentile: getPercentile(player.stats.interceptions, 'CB')
        })
      }
      break
  }
  
  return stats.slice(0, 5) // Limit to 5 stats
}

/**
 * Calculate Madden-like grade (0-100) from player stats and development
 * This is a mock calculation - in production, this would use internal models
 */
export function calculateMaddenGrade(player: Player): number {
  let grade = 50 // Base grade
  
  // Add points based on stats (mock calculation)
  if (player.stats) {
    if (player.stats.passingYards) grade += Math.min(player.stats.passingYards / 100, 20)
    if (player.stats.rushingYards) grade += Math.min(player.stats.rushingYards / 50, 20)
    if (player.stats.receivingYards) grade += Math.min(player.stats.receivingYards / 50, 20)
    if (player.stats.tackles) grade += Math.min(player.stats.tackles / 10, 15)
    if (player.stats.sacks) grade += Math.min(player.stats.sacks * 2, 15)
    if (player.stats.interceptions) grade += Math.min(player.stats.interceptions * 3, 15)
  }
  
  // Add points based on development ratings if available
  if (player.playerDevelopment) {
    const physical = Object.values(player.playerDevelopment.physical || {}).reduce((a, b) => a + b, 0) / 5
    const tactical = Object.values(player.playerDevelopment.tactical || {}).reduce((a, b) => a + b, 0) / 4
    const mental = Object.values(player.playerDevelopment.mental || {}).reduce((a, b) => a + b, 0) / 4
    const technical = Object.values(player.playerDevelopment.technical || {}).reduce((a, b) => a + b, 0) / (Object.keys(player.playerDevelopment.technical || {}).length || 1)
    
    grade += (physical + tactical + mental + technical) / 4 * 0.3
  }
  
  // Ensure grade is between 0-100
  return Math.round(Math.max(0, Math.min(100, grade)))
}
