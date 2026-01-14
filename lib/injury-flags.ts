import { Player } from './types'

/**
 * Generate mock injury flags based on player metrics
 * Logic: flag if playerLoad > threshold or acr > 1.5 or < 0.7
 */
export function generateInjuryFlags(player: Player): Player['injuryFlags'] {
  const flags: Player['injuryFlags'] = {}
  
  if (player.metrics) {
    // Flag for high player load (threshold: 800)
    if (player.metrics.playerLoad && player.metrics.playerLoad > 800) {
      flags.playerLoad = true
    }
    
    // Flag for ACR spikes (ACR > 1.5 or < 0.7)
    if (player.metrics.acr) {
      if (player.metrics.acr > 1.5 || player.metrics.acr < 0.7) {
        flags.acr = true
      }
    }
  }
  
  // Randomly assign medical flag for demo (10% chance)
  // In production, this would come from actual medical records
  if (Math.random() < 0.1) {
    flags.medical = true
  }
  
  // Return flags only if at least one is set
  return Object.keys(flags).length > 0 ? flags : undefined
}
