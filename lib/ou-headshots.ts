/**
 * Generate OU headshot URL from player name
 * Pattern: https://images.sidearmdev.com/crop?url=https%3A%2F%2Fdxbhsrqyrr690.cloudfront.net%2Fsidearm.nextgen.sites%2Fsoonersports.com%2Fimages%2F2025%2F7%2F14%2F{LastName}__{FirstName}_2025_web.jpg&width=180&height=270&type=webp
 */

/**
 * Generate multiple headshot URL variations for a player
 * @param firstName - Player's first name
 * @param lastName - Player's last name
 * @param width - Image width (default: 180)
 * @param height - Image height (default: 270)
 * @returns Array of headshot URLs in order of likelihood
 */
function generateHeadshotVariations(
  firstName: string,
  lastName: string,
  width: number = 180,
  height: number = 270
): string[] {
  const baseUrl = 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/soonersports.com/images'
  
  // Common date paths (most recent first)
  const datePaths = [
    '2025/7/14',
    '2025/3/4',
    '2025/1/1',
    '2024/12/1',
    '2024/8/1',
  ]
  
  // Filename variations
  const filenameVariations = [
    // Standard pattern: LastName__FirstName_2025_web.jpg
    `${lastName}__${firstName}_2025_web.jpg`,
    `${lastName}__${firstName}_2025_web.JPG`,
    // Underscore pattern: FirstName_LastName_2025_web.jpg
    `${firstName}_${lastName}_2025_web.jpg`,
    `${firstName}_${lastName}_2025_web.JPG`,
    // With suffix variations (like SHcjw)
    `${firstName}_${lastName}_2025_SHcjw.JPG`,
    `${lastName}__${firstName}_2025_SHcjw.JPG`,
    // Without year
    `${lastName}__${firstName}_web.jpg`,
    `${firstName}_${lastName}_web.jpg`,
    // Simple patterns
    `${lastName}_${firstName}_2025.jpg`,
    `${firstName}_${lastName}_2025.jpg`,
  ]
  
  const urls: string[] = []
  
  // Generate all combinations
  for (const datePath of datePaths) {
    for (const filename of filenameVariations) {
      const imageUrl = `${baseUrl}/${datePath}/${filename}`
      const encodedUrl = encodeURIComponent(imageUrl)
      const sidearmUrl = `https://images.sidearmdev.com/crop?url=${encodedUrl}&width=${width}&height=${height}&type=webp`
      urls.push(sidearmUrl)
    }
  }
  
  return urls
}

/**
 * Check if an image URL exists (server-side only)
 * @param url - Image URL to check
 * @returns Promise that resolves to true if image exists, false otherwise
 */
export async function checkImageExists(url: string): Promise<boolean> {
  try {
    // Extract the actual image URL from the Sidearm crop URL
    const urlMatch = url.match(/url=([^&]+)/)
    if (!urlMatch) return false
    
    const imageUrl = decodeURIComponent(urlMatch[1])
    
    const response = await fetch(imageUrl, { method: 'HEAD' })
    return response.ok
  } catch (error) {
    return false
  }
}

/**
 * Find the first working headshot URL from variations
 * @param firstName - Player's first name
 * @param lastName - Player's last name
 * @param width - Image width (default: 180)
 * @param height - Image height (default: 270)
 * @returns Promise that resolves to the first working URL, or empty string if none found
 */
export async function findWorkingHeadshotUrl(
  firstName: string,
  lastName: string,
  width: number = 180,
  height: number = 270
): Promise<string> {
  const variations = generateHeadshotVariations(firstName, lastName, width, height)
  
  // Check each variation (limit to first 10 for performance)
  for (const url of variations.slice(0, 10)) {
    const exists = await checkImageExists(url)
    if (exists) {
      return url
    }
  }
  
  // If none found, return the first variation (most likely)
  return variations[0] || ''
}

/**
 * Generate OU headshot URL from player name
 * @param playerName - Full player name (e.g., "Dillon Gabriel")
 * @param width - Image width (default: 180)
 * @param height - Image height (default: 270)
 * @returns Headshot URL or empty string if name format is invalid
 */
export function generateOUHeadshotUrl(
  playerName: string,
  width: number = 180,
  height: number = 270
): string {
  if (!playerName || !playerName.trim()) {
    return ''
  }

  // Parse name: "Dillon Gabriel" -> "Gabriel__Dillon"
  const nameParts = playerName.trim().split(/\s+/)
  
  if (nameParts.length < 2) {
    // Fallback for single name - can't generate URL
    return ''
  }
  
  const lastName = nameParts[nameParts.length - 1]
  const firstName = nameParts[0]
  
  // Return the first (most likely) variation
  const variations = generateHeadshotVariations(firstName, lastName, width, height)
  return variations[0] || ''
}

/**
 * Get headshot URL from roster data if available, otherwise generate it
 * @param playerName - Full player name
 * @param rosterData - Optional roster data with headshot URLs
 * @returns Headshot URL
 */
export function getHeadshotFromRoster(
  playerName: string, 
  rosterData?: Array<{ player?: string; firstName?: string; lastName?: string; headshotUrl?: string }>
): string {
  if (!rosterData) {
    return generateOUHeadshotUrl(playerName)
  }
  
  const player = rosterData.find(p => {
    const fullName = p.player || `${p.firstName || ''} ${p.lastName || ''}`.trim()
    return fullName.toLowerCase() === playerName.toLowerCase() ||
           fullName.toLowerCase().includes(playerName.toLowerCase()) ||
           playerName.toLowerCase().includes(fullName.toLowerCase())
  })
  
  if (player?.headshotUrl) {
    return player.headshotUrl
  }
  
  return generateOUHeadshotUrl(playerName)
}
