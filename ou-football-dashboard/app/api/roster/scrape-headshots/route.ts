import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import fs from 'fs'
import path from 'path'

const HEADSHOTS_CACHE_FILE = path.join(process.cwd(), 'data', 'cache', 'headshots.json')
const OU_ROSTER_URL = 'https://soonersports.com/sports/football/roster'

// Ensure cache directory exists
function ensureCacheDir() {
  const cacheDir = path.dirname(HEADSHOTS_CACHE_FILE)
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true })
  }
}

// Load cached headshots
function loadCachedHeadshots(): Record<string, string> {
  try {
    if (fs.existsSync(HEADSHOTS_CACHE_FILE)) {
      const content = fs.readFileSync(HEADSHOTS_CACHE_FILE, 'utf-8')
      return JSON.parse(content)
    }
  } catch (error) {
    console.error('Error loading cached headshots:', error)
  }
  return {}
}

// Save headshots to cache
function saveHeadshotsToCache(headshots: Record<string, string>) {
  try {
    ensureCacheDir()
    fs.writeFileSync(HEADSHOTS_CACHE_FILE, JSON.stringify(headshots, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error saving headshots to cache:', error)
  }
}

// Normalize player name for matching
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,]/g, '')
    .replace(/\s+football\s*$/i, '') // Remove "football" suffix
    .replace(/^\d+\s*/, '') // Remove leading numbers
    .trim()
}

// Scrape headshots from OU roster page
async function scrapeOUHeadshots(): Promise<Record<string, string>> {
  try {
    console.log('Fetching OU roster page...')
    const response = await fetch(OU_ROSTER_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch roster: ${response.status} ${response.statusText}`)
    }

    const html = await response.text()
    const $ = (cheerio as any).load(html)
    
    const headshots: Record<string, string> = {}
    
    // The OU roster uses s-person-card-standard with specific structure
    // Look for player cards (exclude coaches and staff)
    $('[data-test-id="s-person-card-standard__root"]').each((_: number, element: cheerio.Element) => {
      const $el = $(element)
      
      // Check if this is a player (has jersey number) vs coach/staff
      const hasJerseyNumber = $el.find('[data-test-id="s-stamp__root"]').length > 0
      if (!hasJerseyNumber) {
        return // Skip coaches and staff
      }
      
      // Get player name from h3 with specific class
      const $nameEl = $el.find('h3.s-person-card__header__person-details-personal__name span')
      let playerName = ''
      if ($nameEl.length) {
        playerName = $nameEl.first().text().trim()
      }
      
      // Fallback: try aria-label from the link
      if (!playerName) {
        const $link = $el.find('a[data-test-id="s-person-card-standard__header-link"]')
        const ariaLabel = $link.attr('aria-label') || ''
        // Extract name from aria-label like "Ace Hodges jersey number 93 full bio"
        const match = ariaLabel.match(/^([^j]+?)\s+jersey/i)
        if (match) {
          playerName = match[1].trim()
        }
      }
      
      // Get headshot image
      const $img = $el.find('img[data-test-id="s-image-resized__img"]')
      let headshotUrl = ''
      if ($img.length) {
        // Try src first, then srcset
        headshotUrl = $img.attr('src') || ''
        if (!headshotUrl) {
          const srcset = $img.attr('srcset') || ''
          if (srcset) {
            // Extract first URL from srcset
            const srcsetMatch = srcset.match(/^([^\s]+)/)
            if (srcsetMatch) {
              headshotUrl = srcsetMatch[1]
            }
          }
        }
        
        // Extract the actual image URL from the Sidearm crop URL
        if (headshotUrl) {
          // The URL is already a full Sidearm URL, but we might want to adjust dimensions
          // For now, use it as-is or adjust to our preferred size
          if (headshotUrl.includes('images.sidearmdev.com')) {
            // Adjust to our preferred dimensions (180x270)
            headshotUrl = headshotUrl.replace(/width=\d+/, 'width=180').replace(/height=\d+/, 'height=270')
          }
        }
      }
      
      if (playerName && headshotUrl) {
        const normalizedName = normalizeName(playerName)
        // Only add if it's a valid player name (not empty, not too short, doesn't contain "football" etc)
        if (normalizedName.length > 2 && !normalizedName.includes('football') && !normalizedName.match(/^\d/)) {
          headshots[normalizedName] = headshotUrl
        }
      }
    })
    
    console.log(`Scraped ${Object.keys(headshots).length} headshots from OU roster`)
    return headshots
    
  } catch (error) {
    console.error('Error scraping OU headshots:', error)
    throw error
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const forceRefresh = searchParams.get('refresh') === 'true'
  
  try {
    // Load cached headshots
    const cachedHeadshots = loadCachedHeadshots()
    
    // Return cached if available and not forcing refresh
    if (!forceRefresh && Object.keys(cachedHeadshots).length > 0) {
      return NextResponse.json({
        success: true,
        count: Object.keys(cachedHeadshots).length,
        headshots: cachedHeadshots,
        cached: true
      })
    }
    
    // Scrape fresh data
    const headshots = await scrapeOUHeadshots()
    
    // Merge with cached (keep any existing entries)
    const mergedHeadshots = { ...cachedHeadshots, ...headshots }
    
    // Save to cache
    saveHeadshotsToCache(mergedHeadshots)
    
    return NextResponse.json({
      success: true,
      count: Object.keys(mergedHeadshots).length,
      headshots: mergedHeadshots,
      cached: false,
      newlyScraped: Object.keys(headshots).length
    })
  } catch (error) {
    console.error('Error in scrape-headshots endpoint:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        headshots: loadCachedHeadshots() // Return cached data even on error
      },
      { status: 500 }
    )
  }
}
