import fs from 'fs'
import path from 'path'
import { getCachedData, saveCachedData, deleteCachedData } from './redis-cache'

const CACHE_DIR = path.join(process.cwd(), 'data', 'cache', 'player-stats')
// Cache expires after 30 days - ensures player stats persist without daily script runs
const CACHE_EXPIRY_DAYS = 30
const CACHE_EXPIRY_SECONDS = CACHE_EXPIRY_DAYS * 24 * 60 * 60 // 30 days in seconds

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

// Get cache key for Redis
function getCacheKey(playerId: string): string {
  return `player-stats:${playerId}`
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
export async function getCachedPlayerStats(playerId: string): Promise<CacheData | null> {
  const cacheKey = getCacheKey(playerId)
  const cacheFile = getCacheFilePath(playerId)
  
  try {
    const cachedData = await getCachedData(cacheKey, cacheFile)
    
    if (cachedData) {
      // Ensure it has the CacheData structure
      if (cachedData.playerId && cachedData.data) {
        return cachedData as CacheData
      }
      // If it's just the data, wrap it
      return {
        playerId,
        data: cachedData,
        cachedAt: Date.now(),
        expiresAt: Date.now() + (CACHE_EXPIRY_SECONDS * 1000)
      } as CacheData
    }
    
    return null
  } catch (error) {
    console.error(`Error reading cache for player ${playerId}:`, error)
    return null
  }
}

/**
 * Save player stats to cache
 */
export async function savePlayerStatsToCache(
  playerId: string,
  playerName: string | undefined,
  statsData: Record<number, any[]>
): Promise<void> {
  const cacheKey = getCacheKey(playerId)
  const cacheFile = getCacheFilePath(playerId)
  
  try {
    const now = Date.now()
    const cacheData: CacheData = {
      playerId,
      playerName,
      data: statsData,
      cachedAt: now,
      expiresAt: now + (CACHE_EXPIRY_SECONDS * 1000) // 30 days from now
    }

    await saveCachedData(cacheKey, cacheData, CACHE_EXPIRY_SECONDS, cacheFile)
    console.log(`Cached stats for player ${playerId} (${playerName || 'unknown'})`)
  } catch (error) {
    console.error(`Error saving cache for player ${playerId}:`, error)
    // Don't throw - caching failure shouldn't break the API
  }
}

/**
 * Clear cache for a specific player (useful for manual refresh)
 */
export async function clearPlayerCache(playerId: string): Promise<void> {
  const cacheKey = getCacheKey(playerId)
  const cacheFile = getCacheFilePath(playerId)
  
  try {
    await deleteCachedData(cacheKey, cacheFile)
    console.log(`Cleared cache for player ${playerId}`)
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
