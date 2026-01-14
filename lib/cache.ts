import fs from 'fs'
import path from 'path'

const CACHE_DIR = path.join(process.cwd(), 'data', 'cache', 'player-stats')
const CACHE_EXPIRY_HOURS = 24 // Cache expires after 24 hours

// Ensure cache directory exists
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }
}

// Get cache file path for a player
function getCacheFilePath(playerId: string): string {
  ensureCacheDir()
  // Sanitize player ID for filename
  const safeId = playerId.replace(/[^a-zA-Z0-9-_]/g, '_')
  return path.join(CACHE_DIR, `${safeId}.json`)
}

// Cache data structure
interface CacheData {
  playerId: string
  playerName?: string
  data: Record<number, any[]>
  cachedAt: number // Unix timestamp
  expiresAt: number // Unix timestamp
}

/**
 * Get cached player stats if available and not expired
 */
export function getCachedPlayerStats(playerId: string): CacheData | null {
  try {
    const cacheFile = getCacheFilePath(playerId)
    
    if (!fs.existsSync(cacheFile)) {
      return null
    }

    const fileContent = fs.readFileSync(cacheFile, 'utf-8')
    const cacheData: CacheData = JSON.parse(fileContent)

    // Check if cache is expired
    const now = Date.now()
    if (now > cacheData.expiresAt) {
      // Cache expired, delete the file
      fs.unlinkSync(cacheFile)
      return null
    }

    return cacheData
  } catch (error) {
    console.error(`Error reading cache for player ${playerId}:`, error)
    return null
  }
}

/**
 * Save player stats to cache
 */
export function savePlayerStatsToCache(
  playerId: string,
  playerName: string | undefined,
  statsData: Record<number, any[]>
): void {
  try {
    ensureCacheDir()
    const cacheFile = getCacheFilePath(playerId)
    
    const now = Date.now()
    const cacheData: CacheData = {
      playerId,
      playerName,
      data: statsData,
      cachedAt: now,
      expiresAt: now + (CACHE_EXPIRY_HOURS * 60 * 60 * 1000) // 24 hours from now
    }

    fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2), 'utf-8')
    console.log(`Cached stats for player ${playerId} (${playerName || 'unknown'})`)
  } catch (error) {
    console.error(`Error saving cache for player ${playerId}:`, error)
    // Don't throw - caching failure shouldn't break the API
  }
}

/**
 * Clear cache for a specific player (useful for manual refresh)
 */
export function clearPlayerCache(playerId: string): void {
  try {
    const cacheFile = getCacheFilePath(playerId)
    if (fs.existsSync(cacheFile)) {
      fs.unlinkSync(cacheFile)
      console.log(`Cleared cache for player ${playerId}`)
    }
  } catch (error) {
    console.error(`Error clearing cache for player ${playerId}:`, error)
  }
}

/**
 * Clear all cached player stats
 */
export function clearAllCache(): { deleted: number; errors: number } {
  try {
    ensureCacheDir()
    const files = fs.readdirSync(CACHE_DIR)
    const jsonFiles = files.filter(f => f.endsWith('.json'))
    
    let deleted = 0
    let errors = 0
    
    jsonFiles.forEach(file => {
      try {
        const filePath = path.join(CACHE_DIR, file)
        fs.unlinkSync(filePath)
        deleted++
      } catch (error) {
        console.error(`Error deleting cache file ${file}:`, error)
        errors++
      }
    })

    console.log(`Cleared ${deleted} cache files${errors > 0 ? ` (${errors} errors)` : ''}`)
    return { deleted, errors }
  } catch (error) {
    console.error('Error clearing all cache:', error)
    return { deleted: 0, errors: 1 }
  }
}

/**
 * Get cache statistics (useful for debugging)
 */
export function getCacheStats(): { totalFiles: number; totalSize: number } {
  try {
    ensureCacheDir()
    const files = fs.readdirSync(CACHE_DIR)
    const jsonFiles = files.filter(f => f.endsWith('.json'))
    
    let totalSize = 0
    jsonFiles.forEach(file => {
      const filePath = path.join(CACHE_DIR, file)
      const stats = fs.statSync(filePath)
      totalSize += stats.size
    })

    return {
      totalFiles: jsonFiles.length,
      totalSize
    }
  } catch (error) {
    console.error('Error getting cache stats:', error)
    return { totalFiles: 0, totalSize: 0 }
  }
}
