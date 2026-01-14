import { Player, PlayerStatus } from './types'

/**
 * Determine player status based on metrics, alerts, and notes
 * Green (good) - Available, no issues
 * Yellow (warning) - Limited availability, high load, or minor concerns
 * Red (not-available) - Injured, suspended, or unavailable
 * Orange (rehab) - In rehabilitation
 */
export function determinePlayerStatus(player: Player): PlayerStatus {
  // Check for explicit status override (if manually set)
  if (player.status) {
    return player.status
  }

  // Check alerts first - high severity means not available
  const highSeverityAlerts = player.alerts?.filter(a => a.severity === 'high') || []
  if (highSeverityAlerts.length > 0) {
    return 'not-available'
  }

  // Check for rehab notes
  const rehabNotes = player.notes?.filter(note => {
    const noteText = note.note.toLowerCase()
    return noteText.includes('rehab') ||
           noteText.includes('rehabilitation') ||
           noteText.includes('injury') ||
           noteText.includes('surgery')
  }) || []
  
  if (rehabNotes.length > 0) {
    return 'rehab'
  }

  // Check ACR (Acute:Chronic Ratio) for workload monitoring
  if (player.metrics?.acr !== undefined) {
    const acr = player.metrics.acr
    // High ACR (>1.5) indicates high acute load - injury risk
    // Low ACR (<0.7) may indicate recent return from injury or low activity
    if (acr > 1.5 || acr < 0.7) {
      return 'warning'
    }
  }

  // Check for moderate severity alerts
  const moderateAlerts = player.alerts?.filter(a => a.severity === 'moderate') || []
  if (moderateAlerts.length > 0) {
    return 'warning'
  }

  // Check for expired notes (might indicate issues)
  const expiredNotes = player.notes?.filter(note => {
    if (!note.expiresAt) return false
    return new Date(note.expiresAt) < new Date()
  }) || []
  
  if (expiredNotes.length > 0) {
    return 'warning'
  }

  // Default to good if no issues detected
  return 'good'
}

/**
 * Get status color classes for styling
 */
export function getStatusColorClasses(status: PlayerStatus) {
  switch (status) {
    case 'good':
      return {
        bg: 'bg-green-50',
        border: 'border-green-300',
        text: 'text-green-800',
        dot: 'bg-green-500',
        badge: 'bg-green-100 text-green-800 border-green-300'
      }
    case 'warning':
      return {
        bg: 'bg-yellow-50',
        border: 'border-yellow-300',
        text: 'text-yellow-800',
        dot: 'bg-yellow-500',
        badge: 'bg-yellow-100 text-yellow-800 border-yellow-300'
      }
    case 'not-available':
      return {
        bg: 'bg-red-50',
        border: 'border-red-300',
        text: 'text-red-800',
        dot: 'bg-red-500',
        badge: 'bg-red-100 text-red-800 border-red-300'
      }
    case 'rehab':
      return {
        bg: 'bg-orange-50',
        border: 'border-orange-300',
        text: 'text-orange-800',
        dot: 'bg-orange-500',
        badge: 'bg-orange-100 text-orange-800 border-orange-300'
      }
    default:
      return {
        bg: 'bg-gray-50',
        border: 'border-gray-300',
        text: 'text-gray-800',
        dot: 'bg-gray-500',
        badge: 'bg-gray-100 text-gray-800 border-gray-300'
      }
  }
}

/**
 * Get status label for display
 */
export function getStatusLabel(status: PlayerStatus): string {
  const labels: Record<PlayerStatus, string> = {
    'good': 'Good',
    'warning': 'Warning',
    'not-available': 'Not Available',
    'rehab': 'Rehab'
  }
  return labels[status] || status
}
