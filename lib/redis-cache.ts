/**
 * Shared Redis cache utility for all data types
 * Supports both Vercel KV and direct Redis connections
 */
import fs from 'fs'
import path from 'path'

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

// In-memory cache for fallback
const memoryCache = new Map<string, { data: any; expiresAt: number }>()

/**
 * Get cached data from Redis/KV, with fallback to memory and file cache
 */
export async function getCachedData(
  cacheKey: string,
  fileCachePath?: string
): Promise<any | null> {
  const now = Date.now()
  
  // METHOD 1: Try Vercel KV first
  if (kv && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const cachedData: any = await kv.get(cacheKey)
      if (cachedData) {
        if (cachedData.expiresAt && now < cachedData.expiresAt) {
          console.log(`[KV CACHE HIT] ${cacheKey}`)
          return cachedData.data
        } else if (cachedData.expiresAt) {
          // Expired, delete it
          await kv.del(cacheKey)
        } else {
          // No expiration, return it
          return cachedData
        }
      }
    } catch (error) {
      console.warn(`[KV] Error reading ${cacheKey}, falling back:`, error)
    }
  }
  
  // METHOD 2: Try direct Redis
  const redis = await getRedisClient()
  if (redis) {
    try {
      const cachedDataStr = await redis.get(cacheKey)
      if (cachedDataStr) {
        const cachedData = JSON.parse(cachedDataStr)
        if (cachedData.expiresAt && now < cachedData.expiresAt) {
          console.log(`[REDIS CACHE HIT] ${cacheKey}`)
          return cachedData.data
        } else if (cachedData.expiresAt) {
          // Expired, delete it
          await redis.del(cacheKey)
        } else {
          // No expiration, return it
          return cachedData
        }
      }
    } catch (error) {
      console.warn(`[REDIS] Error reading ${cacheKey}, falling back:`, error)
    }
  }
  
  // METHOD 3: Check in-memory cache
  const memCached = memoryCache.get(cacheKey)
  if (memCached && now < memCached.expiresAt) {
    console.log(`[MEMORY CACHE HIT] ${cacheKey}`)
    return memCached.data
  }
  
  // METHOD 4: Check file cache (if path provided)
  if (fileCachePath) {
    try {
      if (fs.existsSync(fileCachePath)) {
        const fileContent = fs.readFileSync(fileCachePath, 'utf-8')
        const cacheData = JSON.parse(fileContent)
        
        if (cacheData.expiresAt && now < cacheData.expiresAt) {
          // Update memory cache
          memoryCache.set(cacheKey, {
            data: cacheData.data,
            expiresAt: cacheData.expiresAt
          })
          console.log(`[FILE CACHE HIT] ${cacheKey}`)
          return cacheData.data
        } else if (cacheData.expiresAt) {
          // Expired, delete file
          fs.unlinkSync(fileCachePath)
        } else {
          return cacheData
        }
      }
    } catch (error) {
      console.warn(`Error reading file cache ${cacheKey}:`, error)
    }
  }
  
  return null
}

/**
 * Save data to Redis/KV cache, with fallback to memory and file cache
 */
export async function saveCachedData(
  cacheKey: string,
  data: any,
  ttlSeconds: number,
  fileCachePath?: string
): Promise<void> {
  const now = Date.now()
  const expiresAt = now + (ttlSeconds * 1000)
  
  const cacheData = {
    data,
    cachedAt: now,
    expiresAt
  }
  
  // METHOD 1: Save to Vercel KV
  if (kv && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      await kv.set(cacheKey, cacheData, { ex: ttlSeconds })
      console.log(`[KV CACHE SAVE] ${cacheKey} (expires in ${ttlSeconds}s)`)
    } catch (error) {
      console.warn(`[KV] Error saving ${cacheKey}, falling back:`, error)
    }
  }
  
  // METHOD 2: Save to direct Redis
  const redis = await getRedisClient()
  if (redis) {
    try {
      await redis.setEx(cacheKey, ttlSeconds, JSON.stringify(cacheData))
      console.log(`[REDIS CACHE SAVE] ${cacheKey} (expires in ${ttlSeconds}s)`)
    } catch (error) {
      console.warn(`[REDIS] Error saving ${cacheKey}, falling back:`, error)
    }
  }
  
  // METHOD 3: Update in-memory cache
  memoryCache.set(cacheKey, {
    data,
    expiresAt
  })
  
  // METHOD 4: Save to file cache (if path provided)
  if (fileCachePath) {
    try {
      const dir = path.dirname(fileCachePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(fileCachePath, JSON.stringify(cacheData, null, 2), 'utf-8')
      console.log(`[FILE CACHE SAVE] ${cacheKey}`)
    } catch (error) {
      console.warn(`Error saving file cache ${cacheKey}:`, error)
    }
  }
}

/**
 * Delete cached data from all cache layers
 */
export async function deleteCachedData(
  cacheKey: string,
  fileCachePath?: string
): Promise<void> {
  // Delete from Vercel KV
  if (kv && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      await kv.del(cacheKey)
    } catch (error) {
      console.warn(`[KV] Error deleting ${cacheKey}:`, error)
    }
  }
  
  // Delete from Redis
  const redis = await getRedisClient()
  if (redis) {
    try {
      await redis.del(cacheKey)
    } catch (error) {
      console.warn(`[REDIS] Error deleting ${cacheKey}:`, error)
    }
  }
  
  // Delete from memory
  memoryCache.delete(cacheKey)
  
  // Delete from file
  if (fileCachePath && fs.existsSync(fileCachePath)) {
    try {
      fs.unlinkSync(fileCachePath)
    } catch (error) {
      console.warn(`Error deleting file cache ${cacheKey}:`, error)
    }
  }
}
