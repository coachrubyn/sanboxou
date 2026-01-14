import { FootballPosition, Player } from './types'

export interface AdvancedMetric {
  key: string
  label: string
  value: number | string
  unit?: string
  description?: string
}

/**
 * Get position-specific advanced metrics
 * Returns 1-4 metrics based on position and available data
 */
export function getPositionAdvancedMetrics(
  player: Player,
  latestStats: any,
  latestYear: number
): AdvancedMetric[] {
  const position = player.position
  const metrics: AdvancedMetric[] = []
  const games = latestStats?.games || 0

  switch (position) {
    case 'QB':
      // QB: PPA, Usage, Completion %, Success Rate
      if (latestStats?.ppa !== undefined && latestStats.ppa !== null) {
        metrics.push({
          key: 'ppa',
          label: 'PPA',
          value: parseFloat(latestStats.ppa.toFixed(2)),
          unit: '',
          description: 'Points Per Attempt'
        })
      }
      
      if (latestStats?.usage !== undefined && latestStats.usage !== null) {
        metrics.push({
          key: 'usage',
          label: 'Usage Rate',
          value: (latestStats.usage * 100).toFixed(1),
          unit: '%',
          description: 'Percentage of team plays'
        })
      }
      
      if (latestStats?.completionPercentage !== undefined && latestStats.completionPercentage !== null) {
        metrics.push({
          key: 'completion',
          label: 'Completion %',
          value: latestStats.completionPercentage.toFixed(1),
          unit: '%'
        })
      }
      
      // Calculate TD:INT ratio if available
      if (latestStats?.passingTDs && latestStats?.interceptions) {
        const ratio = (latestStats.passingTDs / latestStats.interceptions).toFixed(1)
        metrics.push({
          key: 'tdIntRatio',
          label: 'TD:INT',
          value: ratio,
          unit: '',
          description: 'Touchdown to Interception Ratio'
        })
      }
      break

    case 'RB':
      // RB: PPA, Usage, YPC, Success Rate
      if (latestStats?.ppa !== undefined && latestStats.ppa !== null) {
        metrics.push({
          key: 'ppa',
          label: 'PPA',
          value: parseFloat(latestStats.ppa.toFixed(2)),
          unit: '',
          description: 'Points Per Attempt'
        })
      }
      
      if (latestStats?.usage !== undefined && latestStats.usage !== null) {
        metrics.push({
          key: 'usage',
          label: 'Usage Rate',
          value: (latestStats.usage * 100).toFixed(1),
          unit: '%',
          description: 'Percentage of team plays'
        })
      }
      
      if (latestStats?.rushingYards && latestStats?.rushingAttempts) {
        const ypc = (latestStats.rushingYards / latestStats.rushingAttempts).toFixed(1)
        metrics.push({
          key: 'ypc',
          label: 'YPC',
          value: ypc,
          unit: '',
          description: 'Yards Per Carry'
        })
      }
      
      if (latestStats?.rushingTDs && games > 0) {
        const tdsPerGame = (latestStats.rushingTDs / games).toFixed(1)
        metrics.push({
          key: 'tdsPerGame',
          label: 'TDs/Game',
          value: tdsPerGame,
          unit: ''
        })
      }
      break

    case 'WR':
    case 'TE':
      // WR/TE: PPA, Usage, YPR, Catch Rate
      if (latestStats?.ppa !== undefined && latestStats.ppa !== null) {
        metrics.push({
          key: 'ppa',
          label: 'PPA',
          value: parseFloat(latestStats.ppa.toFixed(2)),
          unit: '',
          description: 'Points Per Attempt'
        })
      }
      
      if (latestStats?.usage !== undefined && latestStats.usage !== null) {
        metrics.push({
          key: 'usage',
          label: 'Usage Rate',
          value: (latestStats.usage * 100).toFixed(1),
          unit: '%',
          description: 'Percentage of team plays'
        })
      }
      
      if (latestStats?.receivingYards && latestStats?.receptions) {
        const ypr = (latestStats.receivingYards / latestStats.receptions).toFixed(1)
        metrics.push({
          key: 'ypr',
          label: 'YPR',
          value: ypr,
          unit: '',
          description: 'Yards Per Reception'
        })
      }
      
      // Calculate catch rate if targets available (would need to be added to stats)
      if (latestStats?.receptions && latestStats?.receivingTargets) {
        const catchRate = ((latestStats.receptions / latestStats.receivingTargets) * 100).toFixed(1)
        metrics.push({
          key: 'catchRate',
          label: 'Catch Rate',
          value: catchRate,
          unit: '%'
        })
      }
      break

    case 'DL':
    case 'EDGE':
    case 'IDL':
      // DL/EDGE/IDL: PPA, Havoc, Sacks, TFL
      if (latestStats?.ppa !== undefined && latestStats.ppa !== null) {
        metrics.push({
          key: 'ppa',
          label: 'PPA',
          value: parseFloat(latestStats.ppa.toFixed(2)),
          unit: '',
          description: 'Points Per Attempt'
        })
      }
      
      // Calculate Havoc: TFL + Sacks + Forced Fumbles + Interceptions + Passes Defended
      // Note: Forced fumbles may not be available in all stat sets, so we'll calculate with available stats
      const havoc = 
        (latestStats?.tacklesForLoss || 0) +
        (latestStats?.sacks || 0) +
        (latestStats?.fumblesForced || latestStats?.forcedFumbles || 0) +
        (latestStats?.interceptions || 0) +
        (latestStats?.passesDefended || 0)
      
      if (havoc > 0) {
        metrics.push({
          key: 'havoc',
          label: 'Havoc',
          value: havoc,
          unit: '',
          description: 'TFL + Sacks + FF + INT + PD'
        })
      }
      
      if (latestStats?.sacks !== undefined && latestStats.sacks !== null) {
        metrics.push({
          key: 'sacks',
          label: 'Sacks',
          value: latestStats.sacks,
          unit: ''
        })
      }
      
      if (latestStats?.tacklesForLoss !== undefined && latestStats.tacklesForLoss !== null) {
        metrics.push({
          key: 'tfl',
          label: 'TFL',
          value: latestStats.tacklesForLoss,
          unit: '',
          description: 'Tackles For Loss'
        })
      }
      break

    case 'LB':
    case 'ILB':
      // LB/ILB: PPA, Tackles, TFL, Passes Defended
      if (latestStats?.ppa !== undefined && latestStats.ppa !== null) {
        metrics.push({
          key: 'ppa',
          label: 'PPA',
          value: parseFloat(latestStats.ppa.toFixed(2)),
          unit: '',
          description: 'Points Per Attempt'
        })
      }
      
      if (latestStats?.tackles !== undefined && latestStats.tackles !== null) {
        const tacklesPerGame = games > 0 ? (latestStats.tackles / games).toFixed(1) : '0.0'
        metrics.push({
          key: 'tacklesPerGame',
          label: 'Tackles/Game',
          value: tacklesPerGame,
          unit: ''
        })
      }
      
      if (latestStats?.tacklesForLoss !== undefined && latestStats.tacklesForLoss !== null) {
        metrics.push({
          key: 'tfl',
          label: 'TFL',
          value: latestStats.tacklesForLoss,
          unit: '',
          description: 'Tackles For Loss'
        })
      }
      
      if (latestStats?.passesDefended !== undefined && latestStats.passesDefended !== null) {
        metrics.push({
          key: 'pd',
          label: 'Passes Defended',
          value: latestStats.passesDefended,
          unit: ''
        })
      }
      break

    case 'CB':
    case 'S':
      // CB/S: PPA, Passes Defended, Interceptions, Tackles
      if (latestStats?.ppa !== undefined && latestStats.ppa !== null) {
        metrics.push({
          key: 'ppa',
          label: 'PPA',
          value: parseFloat(latestStats.ppa.toFixed(2)),
          unit: '',
          description: 'Points Per Attempt'
        })
      }
      
      if (latestStats?.passesDefended !== undefined && latestStats.passesDefended !== null) {
        metrics.push({
          key: 'pd',
          label: 'Passes Defended',
          value: latestStats.passesDefended,
          unit: ''
        })
      }
      
      if (latestStats?.interceptions !== undefined && latestStats.interceptions !== null) {
        metrics.push({
          key: 'ints',
          label: 'Interceptions',
          value: latestStats.interceptions,
          unit: ''
        })
      }
      
      if (latestStats?.tackles !== undefined && latestStats.tackles !== null && games > 0) {
        const tacklesPerGame = (latestStats.tackles / games).toFixed(1)
        metrics.push({
          key: 'tacklesPerGame',
          label: 'Tackles/Game',
          value: tacklesPerGame,
          unit: ''
        })
      }
      break

    case 'K':
      // K: PAAR, FG%, Long, Points
      if (latestStats?.fieldGoalsMade && latestStats?.fieldGoalsAttempted) {
        const fgPct = ((latestStats.fieldGoalsMade / latestStats.fieldGoalsAttempted) * 100).toFixed(1)
        metrics.push({
          key: 'fgPct',
          label: 'FG%',
          value: fgPct,
          unit: '%',
          description: 'Field Goal Percentage'
        })
      }
      
      if (latestStats?.fieldGoalLong !== undefined && latestStats.fieldGoalLong !== null) {
        metrics.push({
          key: 'long',
          label: 'Long',
          value: latestStats.fieldGoalLong,
          unit: ' yds',
          description: 'Longest Field Goal'
        })
      }
      
      if (latestStats?.kickingPoints !== undefined && latestStats.kickingPoints !== null) {
        metrics.push({
          key: 'points',
          label: 'Points',
          value: latestStats.kickingPoints,
          unit: ''
        })
      }
      break

    case 'P':
      // P: Avg, Long, Inside 20, Touchbacks
      if (latestStats?.puntingYards && latestStats?.punts) {
        const avg = (latestStats.puntingYards / latestStats.punts).toFixed(1)
        metrics.push({
          key: 'avg',
          label: 'Avg',
          value: avg,
          unit: ' yds',
          description: 'Average Punt Distance'
        })
      }
      
      if (latestStats?.puntingLong !== undefined && latestStats.puntingLong !== null) {
        metrics.push({
          key: 'long',
          label: 'Long',
          value: latestStats.puntingLong,
          unit: ' yds',
          description: 'Longest Punt'
        })
      }
      
      if (latestStats?.puntsInside20 !== undefined && latestStats.puntsInside20 !== null) {
        metrics.push({
          key: 'inside20',
          label: 'Inside 20',
          value: latestStats.puntsInside20,
          unit: ''
        })
      }
      break

    case 'OL':
    case 'T':
    case 'G':
    case 'C':
      // OL: Games Played (not many advanced metrics available for OL)
      if (games > 0) {
        metrics.push({
          key: 'games',
          label: 'Games',
          value: games,
          unit: '',
          description: 'Games Played'
        })
      }
      break

    case 'LS':
      // LS: Games Played
      if (games > 0) {
        metrics.push({
          key: 'games',
          label: 'Games',
          value: games,
          unit: '',
          description: 'Games Played'
        })
      }
      break

    default:
      // Default: show games played
      if (games > 0) {
        metrics.push({
          key: 'games',
          label: 'Games',
          value: games,
          unit: '',
          description: 'Games Played'
        })
      }
  }

  // Ensure we have at least one metric (fallback to games)
  if (metrics.length === 0 && games > 0) {
    metrics.push({
      key: 'games',
      label: 'Games',
      value: games,
      unit: '',
      description: 'Games Played'
    })
  }

  return metrics.slice(0, 4) // Return max 4 metrics
}
