import fs from 'fs'
import path from 'path'

const CACHE_DIR = path.join(process.cwd(), 'data', 'cache')
const ROSTER_CACHE_FILE = path.join(CACHE_DIR, 'roster.json')
// Cache roster for 30 days (roster data is relatively static, but we want it to persist)
// This ensures names and headshots stay available without needing to run scripts daily
const CACHE_EXPIRY_MINUTES = 30 * 24 * 60 // 30 days in minutes

// Try to import Vercel KV (will be null if not available)
let kv: any = null
try {
  // @ts-ignore - dynamic import for optional dependency
  kv = require('@vercel/kv')
} catch (error) {
  // Vercel KV not available, will use fallback cache
  console.log('[CACHE] Vercel KV not available, using fallback cache')
}

// Try to import and initialize direct Redis client (will be null if not available)
let redisClient: any = null
let redisInitialized = false
async function getRedisClient() {
  if (redisInitialized) {
    return redisClient
  }
  
  redisInitialized = true
  
  // Only try Redis if REDIS_URL is set
  if (!process.env.REDIS_URL) {
    return null
  }
  
  try {
    const { createClient } = await import('redis')
    redisClient = createClient({ url: process.env.REDIS_URL })
    
    // Handle connection errors
    redisClient.on('error', (err: Error) => {
      console.warn('[REDIS] Redis client error:', err)
      redisClient = null
    })
    
    await redisClient.connect()
    console.log('[REDIS] Connected to Redis successfully')
    return redisClient
  } catch (error) {
    console.warn('[REDIS] Could not connect to Redis, using fallback cache:', error)
    redisClient = null
    return null
  }
}

// In-memory cache for fallback (when KV and filesystem aren't available)
let memoryCache: {
  data: any
  cachedAt: number
  expiresAt: number
} | null = null

// Ensure cache directory exists
function ensureCacheDir() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true })
    }
  } catch (error) {
    // On Vercel, filesystem might be read-only, that's okay
    console.warn('Could not create cache directory:', error)
  }
}

// Cache data structure
interface RosterCacheData {
  year: number
  team: string
  data: any
  cachedAt: number
  expiresAt: number
}

/**
 * Get cache key for Vercel KV
 */
function getCacheKey(year: number, team: string): string {
  return `roster:${team}:${year}`
}

/**
 * Get cached roster data if available and not expired
 */
export async function getCachedRoster(year: number, team: string): Promise<any | null> {
  const now = Date.now()
  
  // METHOD 1: Try Vercel KV first (best for Vercel)
  if (kv && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const cacheKey = getCacheKey(year, team)
      const cachedData: RosterCacheData | null = await kv.get(cacheKey)
      
      if (cachedData) {
        // Check if cache matches year and team
        if (cachedData.year === year && cachedData.team === team) {
          // Check if cache is expired
          if (now < cachedData.expiresAt) {
            console.log(`[KV CACHE HIT] Returning Vercel KV cached roster for ${team} ${year}`)
            return cachedData.data
          } else {
            // Cache expired, but return stale data if it's less than 7 days old (grace period)
            const ageInDays = (now - cachedData.cachedAt) / (1000 * 60 * 60 * 24)
            if (ageInDays < 7) {
              console.log(`[KV] Cache expired but returning stale data (${ageInDays.toFixed(1)} days old) for ${team} ${year}`)
              // Return stale data but don't delete - let it refresh in background
              return cachedData.data
            } else {
              // Cache is very old, delete it
              console.log(`[KV] Cache very old (${ageInDays.toFixed(1)} days), deleting for ${team} ${year}`)
              await kv.del(cacheKey)
            }
          }
        }
      }
    } catch (error) {
      console.warn('[KV] Error reading from Vercel KV, falling back:', error)
    }
  }
  
  // METHOD 1b: Try direct Redis (if REDIS_URL is set)
  const redis = await getRedisClient()
  if (redis) {
    try {
      const cacheKey = getCacheKey(year, team)
      console.log(`[REDIS] Attempting to read cache key: ${cacheKey}`)
      const cachedDataStr = await redis.get(cacheKey)
      
      if (cachedDataStr) {
        console.log(`[REDIS] Found data in Redis for key: ${cacheKey}, length: ${cachedDataStr.length}`)
        let cachedData: RosterCacheData
        
        // Handle both string and already-parsed data
        if (typeof cachedDataStr === 'string') {
          cachedData = JSON.parse(cachedDataStr)
        } else {
          cachedData = cachedDataStr as RosterCacheData
        }
        
        console.log(`[REDIS] Parsed cache data - year: ${cachedData.year} (type: ${typeof cachedData.year}), team: "${cachedData.team}", has data: ${!!cachedData.data}, data type: ${Array.isArray(cachedData.data) ? 'array' : typeof cachedData.data}`)
        
        // Check if cache matches year and team (with type coercion for robustness)
        const yearMatch = Number(cachedData.year) === Number(year)
        const teamMatch = String(cachedData.team).trim() === String(team).trim()
        
        console.log(`[REDIS] Year match: ${yearMatch} (cached: ${cachedData.year}, requested: ${year}), Team match: ${teamMatch} (cached: "${cachedData.team}", requested: "${team}")`)
        
        if (yearMatch && teamMatch) {
          // Check if cache is expired
          if (now < cachedData.expiresAt) {
            console.log(`[REDIS CACHE HIT] Returning Redis cached roster for ${team} ${year}, data length: ${Array.isArray(cachedData.data) ? cachedData.data.length : 'not array'}`)
            
            // Ensure data is in the right format
            if (cachedData.data && Array.isArray(cachedData.data)) {
              // Log first player for debugging
              if (cachedData.data.length > 0) {
                const firstPlayer = cachedData.data[0]
                console.log(`[REDIS] First player sample: ${JSON.stringify({ name: firstPlayer?.name, headshot: firstPlayer?.headshot?.substring(0, 50) || 'none', hasName: !!firstPlayer?.name, hasHeadshot: !!firstPlayer?.headshot })}`)
              }
              return cachedData.data
            } else if (cachedData.data) {
              // If data exists but isn't an array, try to return it anyway
              console.warn(`[REDIS] Cache data is not an array, returning as-is`)
              return cachedData.data
            }
          } else {
            // Cache expired, but return stale data if it's less than 7 days old (grace period)
            const ageInDays = (now - cachedData.cachedAt) / (1000 * 60 * 60 * 24)
            if (ageInDays < 7) {
              console.log(`[REDIS] Cache expired but returning stale data (${ageInDays.toFixed(1)} days old) for ${team} ${year}`)
              // Return stale data but don't delete - let it refresh in background
              return cachedData.data
            } else {
              // Cache is very old, delete it
              console.log(`[REDIS] Cache very old (${ageInDays.toFixed(1)} days), deleting for ${team} ${year}`)
              await redis.del(cacheKey)
            }
          }
        } else {
          console.log(`[REDIS] Cache data doesn't match requested year/team`)
        }
      } else {
        console.log(`[REDIS] No data found in Redis for key: ${cacheKey}`)
      }
    } catch (error) {
      console.error('[REDIS] Error reading from Redis:', error)
      if (error instanceof Error) {
        console.error('[REDIS] Error details:', error.message, error.stack)
      }
    }
  } else {
    console.log('[REDIS] Redis client not available - REDIS_URL may not be set or connection failed')
  }
  
  // METHOD 2: Check in-memory cache (for quick fallback)
  if (memoryCache && now < memoryCache.expiresAt) {
    console.log(`[MEMORY CACHE HIT] Returning in-memory cached roster for ${team} ${year}`)
    return memoryCache.data
  }
  
  // METHOD 3: Check file cache (for local development)
  try {
    if (!fs.existsSync(ROSTER_CACHE_FILE)) {
      return null
    }

    const fileContent = fs.readFileSync(ROSTER_CACHE_FILE, 'utf-8')
    const cacheData: RosterCacheData = JSON.parse(fileContent)

    // Check if cache matches year and team
    if (cacheData.year !== year || cacheData.team !== team) {
      return null
    }

    // Check if cache is expired
    if (now > cacheData.expiresAt) {
      // Cache expired, delete the file
      try {
        fs.unlinkSync(ROSTER_CACHE_FILE)
      } catch (error) {
        // Ignore deletion errors (might be read-only on Vercel)
      }
      return null
    }

    // Update in-memory cache
    memoryCache = {
      data: cacheData.data,
      cachedAt: cacheData.cachedAt,
      expiresAt: cacheData.expiresAt
    }

    console.log(`[FILE CACHE HIT] Returning file cached roster for ${team} ${year}`)
    return cacheData.data
  } catch (error) {
    console.warn('Error reading roster cache:', error)
    return null
  }
}

/**
 * Save roster data to cache
 */
export async function saveRosterToCache(
  year: number,
  team: string,
  rosterData: any
): Promise<void> {
  const now = Date.now()
  const expiresAt = now + (CACHE_EXPIRY_MINUTES * 60 * 1000) // 30 days from now
  
  const cacheData: RosterCacheData = {
    year,
    team,
    data: rosterData,
    cachedAt: now,
    expiresAt
  }

  // METHOD 1: Save to Vercel KV (best for Vercel)
  if (kv && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const cacheKey = getCacheKey(year, team)
      // Set with expiration (in seconds)
      const ttlSeconds = CACHE_EXPIRY_MINUTES * 60
      const days = CACHE_EXPIRY_MINUTES / (24 * 60)
      await kv.set(cacheKey, cacheData, { ex: ttlSeconds })
      console.log(`[KV CACHE SAVE] Cached roster for ${team} ${year} in Vercel KV (expires in ${days.toFixed(1)} days)`)
    } catch (error) {
      console.warn('[KV] Error saving to Vercel KV, falling back:', error)
    }
  }
  
  // METHOD 1b: Save to direct Redis (if REDIS_URL is set)
  const redis = await getRedisClient()
  if (redis) {
    try {
      const cacheKey = getCacheKey(year, team)
      const ttlSeconds = CACHE_EXPIRY_MINUTES * 60
      const days = CACHE_EXPIRY_MINUTES / (24 * 60)
      await redis.setEx(cacheKey, ttlSeconds, JSON.stringify(cacheData))
      console.log(`[REDIS CACHE SAVE] Cached roster for ${team} ${year} in Redis (expires in ${days.toFixed(1)} days)`)
    } catch (error) {
      console.warn('[REDIS] Error saving to Redis, falling back:', error)
    }
  }

  // METHOD 2: Update in-memory cache (works everywhere)
  memoryCache = {
    data: rosterData,
    cachedAt: now,
    expiresAt
  }

  // METHOD 3: Try to save to file (works locally, might fail on Vercel)
  try {
    ensureCacheDir()
          fs.writeFileSync(ROSTER_CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf-8')
          const days = CACHE_EXPIRY_MINUTES / (24 * 60)
          console.log(`[FILE CACHE SAVE] Cached roster for ${team} ${year} to file (expires in ${days.toFixed(1)} days)`)
  } catch (error) {
    // On Vercel, filesystem might be read-only, that's okay - we have KV and in-memory cache
    console.warn('Could not save roster to file cache:', error)
  }
}

/**
 * Clear roster cache
 */
export async function clearRosterCache(year?: number, team?: string): Promise<void> {
  memoryCache = null
  
  // Clear Vercel KV cache
  if (kv && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      if (year && team) {
        const cacheKey = getCacheKey(year, team)
        await kv.del(cacheKey)
        console.log(`[KV] Cleared Vercel KV cache for ${team} ${year}`)
      } else {
        // Note: We'd need to know the keys to delete them all
        console.log('[KV] Vercel KV cache will expire naturally')
      }
    } catch (error) {
      console.warn('[KV] Error clearing Vercel KV cache:', error)
    }
  }
  
  // Clear Redis cache
  const redis = await getRedisClient()
  if (redis) {
    try {
      if (year && team) {
        const cacheKey = getCacheKey(year, team)
        await redis.del(cacheKey)
        console.log(`[REDIS] Cleared Redis cache for ${team} ${year}`)
      } else {
        // Note: We'd need to know the keys to delete them all
        console.log('[REDIS] Redis cache will expire naturally')
      }
    } catch (error) {
      console.warn('[REDIS] Error clearing Redis cache:', error)
    }
  }
  
  // Clear file cache
  try {
    if (fs.existsSync(ROSTER_CACHE_FILE)) {
      fs.unlinkSync(ROSTER_CACHE_FILE)
      console.log('[CACHE CLEAR] Cleared roster cache file')
    }
  } catch (error) {
    console.warn('Error clearing roster cache:', error)
  }
}
