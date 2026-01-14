"""
Script to fetch OU roster data using the CFBD Python library
Processes roster data, validates headshots, and saves to Redis
"""
import sys
import os
import json
import urllib.parse
from pathlib import Path

# Try to load environment variables from .env file (optional)
try:
    from dotenv import load_dotenv
    project_root = Path(__file__).parent.parent
    load_dotenv(project_root / ".env")
except ImportError:
    # dotenv not installed, that's okay - we'll use command line args or env vars
    pass

# Add the cfbd-python directory to the path
project_root = Path(__file__).parent.parent
cfbd_path = project_root / "cfbd-python"
sys.path.insert(0, str(cfbd_path))

from cfbd import Configuration, ApiClient
from cfbd.api import TeamsApi

# Try to import Redis (optional)
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    print("Warning: redis package not available. Install with: pip install redis", file=sys.stderr)

# Try to import requests for headshot validation (optional)
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    print("Warning: requests package not available. Install with: pip install requests", file=sys.stderr)


def generate_headshot_variations(first_name: str, last_name: str, width: int = 180, height: int = 270):
    """Generate headshot URL variations for a player"""
    base_url = 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/soonersports.com/images'
    
    date_paths = [
        '2025/7/14',
        '2025/3/4',
        '2025/1/1',
        '2024/12/1',
        '2024/8/1',
    ]
    
    filename_variations = [
        f"{last_name}__{first_name}_2025_web.jpg",
        f"{last_name}__{first_name}_2025_web.JPG",
        f"{first_name}_{last_name}_2025_web.jpg",
        f"{first_name}_{last_name}_2025_web.JPG",
        f"{first_name}_{last_name}_2025_SHcjw.JPG",
        f"{last_name}__{first_name}_2025_SHcjw.JPG",
        f"{last_name}__{first_name}_web.jpg",
        f"{first_name}_{last_name}_web.jpg",
        f"{last_name}_{first_name}_2025.jpg",
        f"{first_name}_{last_name}_2025.jpg",
    ]
    
    urls = []
    for date_path in date_paths:
        for filename in filename_variations:
            image_url = f"{base_url}/{date_path}/{filename}"
            encoded_url = urllib.parse.quote(image_url, safe='')
            sidearm_url = f"https://images.sidearmdev.com/crop?url={encoded_url}&width={width}&height={height}&type=webp"
            urls.append(sidearm_url)
    
    return urls


def check_image_exists(url: str, timeout: int = 2) -> bool:
    """Check if an image URL exists"""
    if not REQUESTS_AVAILABLE:
        return False
    
    try:
        response = requests.head(url, timeout=timeout, allow_redirects=True)
        return response.status_code == 200
    except Exception:
        return False


def find_working_headshot(first_name: str, last_name: str) -> str:
    """Find the first working headshot URL from variations"""
    variations = generate_headshot_variations(first_name, last_name)
    
    # Check first 10 variations for performance
    for url in variations[:10]:
        if check_image_exists(url):
            return url
    
    # If none found, return the first variation (most likely)
    return variations[0] if variations else ""


def get_scraped_headshots_from_redis(redis_url: str) -> dict:
    """Get scraped headshots from Redis cache"""
    if not REDIS_AVAILABLE or not redis_url:
        return {}
    
    try:
        r = redis.Redis.from_url(redis_url)
        # The headshots are stored with key 'headshots:ou' in Redis
        cached_data_str = r.get('headshots:ou')
        if cached_data_str:
            cached_data = json.loads(cached_data_str)
            # Handle both wrapped and unwrapped formats
            if isinstance(cached_data, dict):
                if 'data' in cached_data:
                    return cached_data['data']
                return cached_data
        print(f"[SCRAPED] No scraped headshots found in Redis", file=sys.stderr)
    except Exception as e:
        print(f"[SCRAPED] Error reading scraped headshots from Redis: {str(e)}", file=sys.stderr)
    
    return {}


def normalize_name(name: str) -> str:
    """Normalize player name for matching (matching TypeScript logic)"""
    import re
    normalized = name.lower().strip()
    normalized = re.sub(r'\s+', ' ', normalized)  # Replace multiple spaces with single space
    normalized = re.sub(r'[.,]', '', normalized)  # Remove periods and commas
    normalized = re.sub(r'\s+football\s*$', '', normalized, flags=re.IGNORECASE)  # Remove "football" suffix
    normalized = re.sub(r'^\d+\s*', '', normalized)  # Remove leading numbers
    return normalized.strip()


def find_scraped_headshot(player_name: str, scraped_headshots: dict) -> str:
    """Find headshot URL from scraped data"""
    if not scraped_headshots:
        return ""
    
    normalized_name = normalize_name(player_name)
    
    # Try exact match first
    if normalized_name in scraped_headshots:
        return scraped_headshots[normalized_name]
    
    # Try partial matches
    name_parts = normalized_name.split()
    for scraped_name, url in scraped_headshots.items():
        # Check if all name parts are in the scraped name or vice versa
        all_parts_match = all(
            part in scraped_name for part in name_parts if len(part) > 2
        ) or all(
            part in normalized_name for part in scraped_name.split() if len(part) > 2
        )
        
        if all_parts_match:
            return url
    
    return ""


def get_class_from_year(year: int) -> str:
    """Determine class from year (1-4 represents year in school)"""
    if year == 1:
        return 'Freshman'
    elif year == 2:
        return 'Sophomore'
    elif year == 3:
        return 'Junior'
    elif year == 4:
        return 'Senior'
    elif year >= 5:
        return 'Graduate'
    return 'Unknown'


def map_position(cfbd_position: str) -> str:
    """Map CFBD position to our position format"""
    if not cfbd_position:
        return 'OL'
    
    # Basic position mapping (can be enhanced)
    position_map = {
        'QB': 'QB',
        'RB': 'RB',
        'FB': 'RB',
        'WR': 'WR',
        'TE': 'TE',
        'OL': 'OL',
        'C': 'OL',
        'G': 'OL',
        'T': 'OL',
        'DL': 'DL',
        'DE': 'DL',
        'DT': 'DL',
        'NT': 'DL',
        'LB': 'LB',
        'ILB': 'LB',
        'OLB': 'LB',
        'CB': 'CB',
        'S': 'S',
        'FS': 'S',
        'SS': 'S',
        'K': 'K',
        'P': 'P',
        'LS': 'LS',
    }
    
    return position_map.get(cfbd_position.upper(), 'OL')


def process_roster(roster_data: list, team: str = "Oklahoma", redis_url: str = None) -> list:
    """Process raw CFBD roster data into our Player format with validated headshots"""
    processed_players = []
    
    # Get scraped headshots from Redis first (these are the correct ones from web scraping)
    scraped_headshots = {}
    if redis_url and REDIS_AVAILABLE:
        scraped_headshots = get_scraped_headshots_from_redis(redis_url)
        if scraped_headshots:
            print(f"[SCRAPED] Loaded {len(scraped_headshots)} scraped headshots from Redis", file=sys.stderr)
    
    for player in roster_data:
        if not player.get('position'):
            continue  # Skip players without positions
        
        first_name = player.get('firstName', '').strip()
        last_name = player.get('lastName', '').strip()
        player_name = player.get('name', f"{first_name} {last_name}").strip()
        
        # Priority 1: Try to find scraped headshot (most reliable)
        headshot = find_scraped_headshot(player_name, scraped_headshots)
        
        # Priority 2: If no scraped headshot found, generate and validate
        if not headshot:
            headshot = find_working_headshot(first_name, last_name)
            if not headshot:
                # Last resort: generate URL without validation
                variations = generate_headshot_variations(first_name, last_name)
                headshot = variations[0] if variations else ""
        
        # Create processed player object
        processed_player = {
            'id': str(player.get('id', f"{player_name}_{player.get('jersey', 'no-number')}")),
            'name': player_name,
            'position': map_position(player.get('position')),
            'number': player.get('jersey'),
            'class': get_class_from_year(player.get('year', 1)),
            'status': 'good',
            'role': 'Practice Player',  # Default role, can be enhanced with depth chart
            'headshot': headshot
        }
        
        processed_players.append(processed_player)
    
    # Sort by position group, then by number
    position_order = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P', 'LS']
    
    def sort_key(p):
        pos_idx = position_order.index(p['position']) if p['position'] in position_order else 999
        number = p.get('number') or 999
        return (pos_idx, number)
    
    processed_players.sort(key=sort_key)
    
    return processed_players


def save_to_redis(redis_url: str, year: int, team: str, roster_data: list, ttl_seconds: int = 3600):
    """Save processed roster data to Redis"""
    if not REDIS_AVAILABLE:
        return False
    
    try:
        import time
        r = redis.Redis.from_url(redis_url)
        cache_key = f"roster:{team}:{year}"
        now = int(time.time() * 1000)  # milliseconds
        expires_at = now + (ttl_seconds * 1000)  # milliseconds
        cache_data = {
            'year': year,
            'team': team,
            'data': roster_data,
            'cachedAt': now,
            'expiresAt': expires_at
        }
        r.setex(cache_key, ttl_seconds, json.dumps(cache_data))
        print(f"[REDIS] Saved processed roster for {team} {year} to Redis (expires in {ttl_seconds}s)", file=sys.stderr)
        return True
    except Exception as e:
        print(f"[REDIS] Error saving to Redis: {str(e)}", file=sys.stderr)
        return False


def fetch_ou_roster(api_key: str, year: int = 2024, team: str = "Oklahoma"):
    """
    Fetch OU roster data from CFBD API, process it, and optionally save to Redis
    
    Args:
        api_key: CFBD API key
        year: Season year (default: 2024)
        team: Team name (default: "Oklahoma")
    
    Returns:
        Processed roster players as list of dictionaries
    """
    try:
        # Configure API client with API key
        configuration = Configuration()
        configuration.access_token = api_key
        
        # Create API client and teams API instance
        api_client = ApiClient(configuration)
        teams_api = TeamsApi(api_client)
        
        # Fetch roster
        roster = teams_api.get_roster(team=team, year=year)
        
        # Convert to list of dictionaries
        raw_roster_data = []
        for player in roster:
            player_dict = {
                "id": player.id,
                "firstName": player.first_name or "",
                "lastName": player.last_name or "",
                "name": f"{player.first_name or ''} {player.last_name or ''}".strip(),
                "team": player.team or team,
                "position": player.position,
                "jersey": player.jersey,
                "year": player.year or 1,
                "height": player.height,
                "weight": player.weight,
                "homeCity": player.home_city,
                "homeState": player.home_state,
                "homeCountry": player.home_country,
            }
            raw_roster_data.append(player_dict)
        
        # Get Redis URL for scraped headshots
        redis_url = os.getenv("REDIS_URL")
        
        # Process roster (use scraped headshots from Redis, validate others)
        processed_roster = process_roster(raw_roster_data, team, redis_url)
        
        # Save to Redis if available
        if redis_url and REDIS_AVAILABLE:
            save_to_redis(redis_url, year, team, processed_roster, ttl_seconds=3600)
        
        return processed_roster
    
    except Exception as e:
        print(f"Error fetching roster: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    # Get API key from environment variable or command line argument
    api_key = os.getenv("CFBD_API_KEY")
    
    if len(sys.argv) > 1:
        api_key = sys.argv[1]
    
    # Trim whitespace and newlines from API key
    if api_key:
        api_key = api_key.strip()
    
    if not api_key:
        print("Error: CFBD_API_KEY environment variable or API key argument required", file=sys.stderr)
        sys.exit(1)
    
    # Get optional year and team from command line
    year = int(sys.argv[2]) if len(sys.argv) > 2 else 2024
    team = sys.argv[3] if len(sys.argv) > 3 else "Oklahoma"
    
    # Fetch and process roster
    roster = fetch_ou_roster(api_key, year, team)
    
    # Output as JSON
    print(json.dumps({
        "count": len(roster),
        "data": roster
    }, indent=2))
