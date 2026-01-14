import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import type { Player } from '@/lib/types'
import { generateOUHeadshotUrl } from '@/lib/ou-headshots'
import { mapToGranularPosition } from '@/lib/types'
import { findPlayerInDepthChart } from '@/lib/depth-chart'
import { getCachedRoster, saveRosterToCache } from '@/lib/roster-cache'

const execAsync = promisify(exec)

// Load scraped headshots from cache
function loadScrapedHeadshots(): Record<string, string> {
  try {
    const headshotsFile = path.join(process.cwd(), 'data', 'cache', 'headshots.json')
    if (fs.existsSync(headshotsFile)) {
      const content = fs.readFileSync(headshotsFile, 'utf-8')
      return JSON.parse(content)
    }
  } catch (error) {
    console.error('Error loading scraped headshots:', error)
  }
  return {}
}

// Normalize player name for matching
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,]/g, '')
}

// Find headshot URL for a player from scraped data
function findScrapedHeadshot(playerName: string, scrapedHeadshots: Record<string, string>): string | null {
  const normalizedName = normalizeName(playerName)
  
  // Try exact match first
  if (scrapedHeadshots[normalizedName]) {
    return scrapedHeadshots[normalizedName]
  }
  
  // Try partial matches
  const nameParts = normalizedName.split(' ')
  for (const [scrapedName, url] of Object.entries(scrapedHeadshots)) {
    // Check if all name parts are in the scraped name or vice versa
    const allPartsMatch = nameParts.every(part => 
      part.length > 2 && scrapedName.includes(part)
    ) || scrapedName.split(' ').every(part => 
      part.length > 2 && normalizedName.includes(part)
    )
    
    if (allPartsMatch) {
      return url
    }
  }
  
  return null
}

// Map CFBD position to our FootballPosition type (using granular positions)
function mapPosition(cfbdPosition: string | null | undefined): Player['position'] {
  if (!cfbdPosition) return 'OL' // Default fallback
  return mapToGranularPosition(cfbdPosition)
}

// Determine class from year (1-4 represents year in school)
function getClassFromYear(year: number): string {
  if (year === 1) return 'Freshman'
  if (year === 2) return 'Sophomore'
  if (year === 3) return 'Junior'
  if (year === 4) return 'Senior'
  if (year >= 5) return 'Graduate'
  return 'Unknown'
}

interface CFBDRosterPlayer {
  id: string
  firstName: string
  lastName: string
  name: string
  team: string
  position: string | null
  jersey: number | null
  year: number
  height: number | null
  weight: number | null
  homeCity: string | null
  homeState: string | null
  homeCountry: string | null
}

// Process roster data into Player format (shared by both Python and HTTP paths)
function processRoster(cfbdRoster: CFBDRosterPlayer[]): Player[] {
  const scrapedHeadshots = loadScrapedHeadshots()

  return cfbdRoster
    .filter(player => player.position) // Only include players with positions
    .map(player => {
      const playerName = player.name || `${player.firstName} ${player.lastName}`
      
      // Check depth chart for role and position (pass firstName and lastName for better matching)
      const depthChartInfo = findPlayerInDepthChart(
        playerName, 
        player.jersey || undefined,
        player.firstName,
        player.lastName
      )
      const role: Player['role'] = depthChartInfo?.role || 'Practice Player'
      
      // Use position from depth chart if available, otherwise use mapped CFBD position
      // Only override position if depth chart provides a valid position
      let position = mapPosition(player.position)
      if (depthChartInfo?.position) {
        position = depthChartInfo.position as Player['position']
      }
      
      // Log matches for debugging (can be removed later)
      if (depthChartInfo) {
        console.log(`Depth chart match: ${playerName} (${player.jersey}) -> ${role}, position: ${position}`)
      }
      
      // Try to find scraped headshot first, fallback to generated URL
      let headshot = findScrapedHeadshot(playerName, scrapedHeadshots)
      if (!headshot) {
        headshot = generateOUHeadshotUrl(playerName)
      }
      
      return {
        id: player.id,
        name: playerName,
        position: position,
        number: player.jersey || undefined,
        class: getClassFromYear(player.year),
        status: 'good' as const, // Default status, can be enhanced later
        role: role,
        headshot
      }
    })
    .sort((a, b) => {
      // Sort by position group, then by number
      const positionOrder = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P', 'LS']
      const aPos = positionOrder.indexOf(a.position) !== -1 ? positionOrder.indexOf(a.position) : 999
      const bPos = positionOrder.indexOf(b.position) !== -1 ? positionOrder.indexOf(b.position) : 999
      
      if (aPos !== bPos) return aPos - bPos
      return (a.number || 999) - (b.number || 999)
    })
}

export async function GET(request: NextRequest) {
  // Extract parameters outside try block for error handling
  const url = new URL(request.url)
  const year = url.searchParams.get('year') || '2025'
  const team = url.searchParams.get('team') || 'Oklahoma'
  const yearNum = parseInt(year, 10)

  try {
    // Get API key from .env file and trim any whitespace/newlines
    const apiKey = (process.env.CFBD_API_KEY || process.env.NEXT_PUBLIC_CFBD_API_KEY || '').trim()

    if (!apiKey) {
      console.error('CFBD API key not configured. Make sure CFBD_API_KEY is set in your .env file.')
      return NextResponse.json(
        { error: 'CFBD API key not configured. Please ensure CFBD_API_KEY is set in your .env file.' },
        { status: 500 }
      )
    }

    // Validate year is a number
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      return NextResponse.json(
        { error: 'Invalid year parameter. Must be a valid year between 2000 and 2100.' },
        { status: 400 }
      )
    }

    // Check for force refresh parameter
    const forceRefresh = url.searchParams.get('refresh') === 'true'

    // Check cache first (unless force refresh) - this includes Redis with fully processed roster
    if (!forceRefresh) {
      console.log(`[ROSTER API] Checking cache for ${team} ${yearNum}`)
      const cachedRoster = await getCachedRoster(yearNum, team)
      console.log(`[ROSTER API] Cache result: ${cachedRoster ? 'found' : 'not found'}, type: ${typeof cachedRoster}, isArray: ${Array.isArray(cachedRoster)}, length: ${Array.isArray(cachedRoster) ? cachedRoster.length : 'N/A'}`)
      
      if (cachedRoster && Array.isArray(cachedRoster) && cachedRoster.length > 0) {
        // Log first player for debugging
        const firstPlayer = cachedRoster[0]
        console.log(`[ROSTER API] First player in cache:`, {
          hasName: !!firstPlayer?.name,
          name: firstPlayer?.name,
          hasHeadshot: !!firstPlayer?.headshot,
          headshotPreview: firstPlayer?.headshot?.substring(0, 50) || 'none',
          hasRole: !!firstPlayer?.role,
          role: firstPlayer?.role,
          keys: firstPlayer ? Object.keys(firstPlayer) : []
        })
        
        // Check if this is a fully processed roster from Python (has headshot, role, etc.)
        const isProcessedRoster = cachedRoster[0] && 
          typeof cachedRoster[0] === 'object' && 
          'headshot' in cachedRoster[0] &&
          'role' in cachedRoster[0]
        
        console.log(`[ROSTER API] Is processed roster: ${isProcessedRoster}`)
        
        if (isProcessedRoster) {
          // Log sample of actual data being returned
          const samplePlayers = cachedRoster.slice(0, 3).map((p: any) => ({
            name: p?.name || 'NO NAME',
            headshot: p?.headshot ? p.headshot.substring(0, 60) + '...' : 'NO HEADSHOT',
            position: p?.position || 'NO POSITION',
            number: p?.number || 'NO NUMBER'
          }))
          console.log(`[CACHE] Returning fully processed roster from Redis/Python for ${team} ${yearNum} (${cachedRoster.length} players)`)
          console.log(`[CACHE] Sample players:`, JSON.stringify(samplePlayers, null, 2))
          
          // Validate that players have required fields
          const playersWithNames = cachedRoster.filter((p: any) => p?.name)
          const playersWithHeadshots = cachedRoster.filter((p: any) => p?.headshot)
          console.log(`[CACHE] Players with names: ${playersWithNames.length}/${cachedRoster.length}, Players with headshots: ${playersWithHeadshots.length}/${cachedRoster.length}`)
          
          return NextResponse.json({
            count: cachedRoster.length,
            data: cachedRoster,
            cached: true,
            source: 'redis-python'
          }, {
            headers: {
              'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
            }
          })
        } else {
          // Legacy cache format, still return it but log
          console.log(`[CACHE] Returning cached roster (legacy format) for ${team} ${yearNum} (${cachedRoster.length} players)`)
          // Try to add missing fields if they're not present
          const processedRoster = cachedRoster.map((player: any) => {
            if (!player.headshot && player.name) {
              // Try to generate headshot if missing
              const nameParts = player.name.split(' ')
              if (nameParts.length >= 2) {
                player.headshot = generateOUHeadshotUrl(player.name)
              }
            }
            if (!player.role) {
              player.role = 'Practice Player'
            }
            return player
          })
          return NextResponse.json({
            count: processedRoster.length,
            data: processedRoster,
            cached: true
          }, {
            headers: {
              'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
            }
          })
        }
      } else if (cachedRoster) {
        // Data exists but isn't in expected format
        console.warn(`[ROSTER API] Cache data exists but isn't in expected format:`, {
          type: typeof cachedRoster,
          isArray: Array.isArray(cachedRoster),
          keys: typeof cachedRoster === 'object' ? Object.keys(cachedRoster) : []
        })
      }
    }

    // Cache miss or force refresh - fetch from API
    console.log(`[CACHE MISS] Fetching fresh roster for ${team} ${yearNum}`)

    // Detect if we're on Vercel (Python not available in Vercel serverless functions)
    const isVercel = !!process.env.VERCEL
    let cfbdRoster: CFBDRosterPlayer[] = []

    // METHOD 1: Try Python script (only if NOT on Vercel)
    if (!isVercel) {
      try {
        const scriptPath = path.join(process.cwd(), 'scripts', 'fetch_ou_roster.py')
        console.log('[LOCAL] Attempting to use Python script')
        
        const result = await execAsync(
          `python3 "${scriptPath}" "${apiKey}" ${yearNum} "${team}"`,
          { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer for large responses
        )
        
        const stdout = result.stdout.trim()
        const stderr = result.stderr || ''
        
        if (stderr && !stderr.includes('Warning') && !stderr.includes('urllib3')) {
          console.warn('Python script stderr:', stderr)
        }
        
        // Check for rate limit in stderr
        if (stderr.includes('429') || stderr.includes('Too Many Requests') || stderr.includes('quota exceeded')) {
          return NextResponse.json(
            { 
              error: 'CFBD API rate limit exceeded',
              message: 'Monthly call quota exceeded. Please wait for the quota to reset or upgrade your CFBD API plan.',
              rateLimitExceeded: true
            },
            { status: 429 }
          )
        }
        
        if (stdout) {
          try {
            const rosterResponse = JSON.parse(stdout)
            if (rosterResponse.data && Array.isArray(rosterResponse.data) && rosterResponse.data.length > 0) {
              console.log(`[LOCAL] Python script returned ${rosterResponse.data.length} players`)
              
              // Check if this is already processed roster (has headshot, role, etc.)
              const firstPlayer = rosterResponse.data[0]
              const isProcessedRoster = firstPlayer && 
                typeof firstPlayer === 'object' && 
                'headshot' in firstPlayer &&
                'role' in firstPlayer &&
                'class' in firstPlayer
              
              if (isProcessedRoster) {
                // Python script already processed the roster with validated headshots
                console.log('[LOCAL] Python returned fully processed roster with validated headshots')
                
                // Save to cache and return directly
                const processedRoster = rosterResponse.data as Player[]
                await saveRosterToCache(yearNum, team, processedRoster)
                
                return NextResponse.json({
                  count: processedRoster.length,
                  data: processedRoster,
                  source: 'python-processed'
                }, {
                  headers: {
                    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
                  }
                })
              } else {
                // Legacy format - convert to CFBDRosterPlayer format for processing
                cfbdRoster = rosterResponse.data.map((player: any) => ({
                  id: String(player.id || ''),
                  firstName: player.firstName || '',
                  lastName: player.lastName || '',
                  name: player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim(),
                  team: player.team || team,
                  position: player.position || null,
                  jersey: player.jersey || null,
                  year: player.year || 1,
                  height: player.height || null,
                  weight: player.weight || null,
                  homeCity: player.homeCity || null,
                  homeState: player.homeState || null,
                  homeCountry: player.homeCountry || null
                }))
              }
            }
          } catch (parseError) {
            console.warn('[LOCAL] Failed to parse Python script output, falling back to HTTP API')
          }
        }
      } catch (execError: any) {
        // Check if it's a rate limit error
        const errorMessage = execError.stderr || execError.message || ''
        if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests') || errorMessage.includes('quota exceeded')) {
          return NextResponse.json(
            { 
              error: 'CFBD API rate limit exceeded',
              message: 'Monthly call quota exceeded. Please wait for the quota to reset or upgrade your CFBD API plan.',
              rateLimitExceeded: true
            },
            { status: 429 }
          )
        }
        console.warn('[LOCAL] Python script failed, falling back to HTTP API:', errorMessage.substring(0, 200))
      }
    } else {
      console.log('[VERCEL] Using HTTP API (Python not available in serverless functions)')
    }

    // METHOD 2: Fallback to HTTP API (works on Vercel and as fallback)
    if (cfbdRoster.length === 0) {
      const rosterUrl = `https://api.collegefootballdata.com/roster?team=${encodeURIComponent(team)}&year=${yearNum}`
      
      console.log(`[${isVercel ? 'VERCEL' : 'FALLBACK'}] Using HTTP API to fetch roster`)
      
      const rosterResponse = await fetch(rosterUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        }
      })

      if (!rosterResponse.ok) {
        if (rosterResponse.status === 401) {
          return NextResponse.json(
            { 
              error: 'CFBD API authentication failed',
              message: 'Invalid or expired API key. Please check your CFBD_API_KEY environment variable.',
            },
            { status: 401 }
          )
        }
        if (rosterResponse.status === 429) {
          return NextResponse.json(
            { 
              error: 'CFBD API rate limit exceeded',
              message: 'Monthly call quota exceeded. Please wait for the quota to reset or upgrade your CFBD API plan.',
              rateLimitExceeded: true
            },
            { status: 429 }
          )
        }
        
        const errorText = await rosterResponse.text()
        console.error(`CFBD API error: ${rosterResponse.status} ${rosterResponse.statusText}`, errorText.substring(0, 500))
        throw new Error(`CFBD API error: ${rosterResponse.status} ${rosterResponse.statusText}`)
      }

      const contentType = rosterResponse.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        const errorText = await rosterResponse.text()
        console.error('CFBD API returned non-JSON response:', errorText.substring(0, 500))
        throw new Error(`CFBD API returned HTML instead of JSON`)
      }

      const cfbdRosterRaw: any[] = await rosterResponse.json()
      
      if (!Array.isArray(cfbdRosterRaw)) {
        console.error('CFBD API response is not an array:', typeof cfbdRosterRaw)
        throw new Error('CFBD API response is not an array')
      }
      
      console.log(`[${isVercel ? 'VERCEL' : 'FALLBACK'}] HTTP API returned ${cfbdRosterRaw.length} players`)
      
      // Transform HTTP API response to match Python script format
      cfbdRoster = cfbdRosterRaw.map((player: any) => ({
        id: String(player.id || ''),
        firstName: player.first_name || '',
        lastName: player.last_name || '',
        name: `${player.first_name || ''} ${player.last_name || ''}`.trim(),
        team: player.team || team,
        position: player.position || null,
        jersey: player.jersey || null,
        year: player.year || 1,
        height: player.height || null,
        weight: player.weight || null,
        homeCity: player.home_city || null,
        homeState: player.home_state || null,
        homeCountry: player.home_country || null
      }))
    }

    if (cfbdRoster.length === 0) {
      return NextResponse.json(
        { 
          error: 'No roster data found',
          message: 'Failed to fetch roster data from all available methods.'
        },
        { status: 500 }
      )
    }

    // Process the roster data (same logic for both Python and HTTP)
    const roster = processRoster(cfbdRoster)

    console.log(`Successfully processed ${roster.length} players`)

    // Save to cache for future requests
    await saveRosterToCache(yearNum, team, roster)

    return NextResponse.json({
      count: roster.length,
      data: roster,
      cached: false
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    })
  } catch (error) {
    console.error('Error fetching roster:', error)
    
    // Check if it's a rate limit error
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests') || errorMessage.includes('quota exceeded')) {
      // Try to return cached data if available
      const cachedRoster = await getCachedRoster(yearNum, team)
      if (cachedRoster) {
        console.log('[ERROR FALLBACK] Returning cached roster due to rate limit')
        return NextResponse.json({
          count: cachedRoster.length,
          data: cachedRoster,
          cached: true,
          warning: 'Rate limit exceeded, returning cached data'
        }, {
          status: 200,
          headers: {
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
          }
        })
      }
      
      return NextResponse.json(
        { 
          error: 'CFBD API rate limit exceeded',
          message: 'Monthly call quota exceeded. Please wait for the quota to reset or upgrade your CFBD API plan.',
          rateLimitExceeded: true
        },
        { status: 429 }
      )
    }
    
    // For other errors, try to return cached data if available
    const cachedRoster = await getCachedRoster(yearNum, team)
    if (cachedRoster) {
      console.log('[ERROR FALLBACK] Returning cached roster due to API error')
      return NextResponse.json({
        count: cachedRoster.length,
        data: cachedRoster,
        cached: true,
        warning: 'API error occurred, returning cached data'
      }, {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
        }
      })
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch roster data',
        details: errorMessage
      },
      { status: 500 }
    )
  }
}
