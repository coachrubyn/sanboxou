"""
Comprehensive script to fetch all player data (stats, game stats, advanced stats)
and pre-populate Redis cache for the OU Football Dashboard.

This script can be run periodically (e.g., daily via cron) to keep the cache fresh.

Usage:
    python3 scripts/fetch_all_player_data.py [API_KEY] [YEAR] [TEAM] [PLAYER_ID] [--current-year-only]
    
Arguments:
    API_KEY (optional): CFBD API key. If not provided, uses CFBD_API_KEY env var.
    YEAR (optional): Season year (default: 2025)
    TEAM (optional): Team name (default: "Oklahoma")
    PLAYER_ID (optional): Process specific player only. If not provided, processes all players.
    --current-year-only: Only fetch current year data (skip historical seasons)

Examples:
    # Fetch all data for all players (2025, Oklahoma)
    python3 scripts/fetch_all_player_data.py
    
    # Fetch data for specific year
    python3 scripts/fetch_all_player_data.py "" 2024
    
    # Fetch data for specific player only
    python3 scripts/fetch_all_player_data.py "" 2025 "Oklahoma" "4683151"
    
    # Only fetch current year data (faster)
    python3 scripts/fetch_all_player_data.py "" 2025 "Oklahoma" "" --current-year-only

Environment Variables:
    CFBD_API_KEY: CFBD API key (required if not provided as argument)
    REDIS_URL: Redis connection URL (optional, but recommended for caching)

What it does:
    1. Fetches roster from Redis (if available) or CFBD API
    2. For each player, fetches:
       - Player stats across multiple seasons (2020-current year)
       - Game-by-game stats for current year
       - Advanced stats (usage and PPA) for current year
       - CFBD stats for current year
    3. Saves all data to Redis with appropriate TTLs matching TypeScript routes

Cache Keys (matching TypeScript routes):
    - player-stats:{playerId}
    - game-stats:{playerId}:{year}:{team}
    - advanced-stats:{playerId}:{year}:{team}
    - cfbd-stats:{playerName}:{year}:{team}

Cache TTLs:
    - Player stats: 24 hours
    - Game stats: 6 hours
    - Advanced stats: 6 hours
    - CFBD stats: 6 hours
"""
import sys
import os
import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Any

# Try to load environment variables from .env file (optional)
try:
    from dotenv import load_dotenv
    project_root = Path(__file__).parent.parent
    load_dotenv(project_root / ".env")
except ImportError:
    pass

# Add the cfbd-python directory to the path
project_root = Path(__file__).parent.parent
cfbd_path = project_root / "cfbd-python"
sys.path.insert(0, str(cfbd_path))

from cfbd import Configuration, ApiClient
from cfbd.api import TeamsApi, StatsApi, PlayersApi, GamesApi

# Try to import Redis (optional)
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    print("Warning: redis package not available. Install with: pip install redis", file=sys.stderr)

# Cache TTLs (in seconds) - matching TypeScript routes
CACHE_TTL = {
    'player_stats': 24 * 60 * 60,  # 24 hours
    'game_stats': 6 * 60 * 60,     # 6 hours
    'advanced_stats': 6 * 60 * 60,  # 6 hours
    'cfbd_stats': 6 * 60 * 60,      # 6 hours
}


def get_redis_client(redis_url: str):
    """Get Redis client"""
    if not REDIS_AVAILABLE:
        return None
    try:
        return redis.Redis.from_url(redis_url)
    except Exception as e:
        print(f"[REDIS] Error connecting to Redis: {str(e)}", file=sys.stderr)
        return None


def get_roster_from_redis(redis_client, year: int, team: str) -> Optional[List[Dict]]:
    """Get roster from Redis if available"""
    if not redis_client:
        return None
    
    try:
        cache_key = f"roster:{team}:{year}"
        cached_data_str = redis_client.get(cache_key)
        if cached_data_str:
            cached_data = json.loads(cached_data_str)
            if isinstance(cached_data, dict) and 'data' in cached_data:
                return cached_data['data']
            elif isinstance(cached_data, list):
                return cached_data
    except Exception as e:
        print(f"[REDIS] Error reading roster: {str(e)}", file=sys.stderr)
    
    return None


def fetch_roster(api_client: ApiClient, year: int, team: str) -> List[Dict]:
    """Fetch roster from CFBD API"""
    teams_api = TeamsApi(api_client)
    roster = teams_api.get_roster(team=team, year=year)
    
    roster_data = []
    for player in roster:
        roster_data.append({
            "id": str(player.id),
            "firstName": player.first_name or "",
            "lastName": player.last_name or "",
            "name": f"{player.first_name or ''} {player.last_name or ''}".strip(),
            "team": player.team or team,
            "position": player.position,
            "jersey": player.jersey,
            "year": player.year or 1,
        })
    
    return roster_data


def save_to_redis(redis_client, cache_key: str, data: Any, ttl_seconds: int):
    """Save data to Redis"""
    if not redis_client:
        return False
    
    try:
        import time
        now = int(time.time() * 1000)  # milliseconds
        expires_at = now + (ttl_seconds * 1000)
        
        cache_data = {
            'data': data,
            'cachedAt': now,
            'expiresAt': expires_at
        }
        
        redis_client.setex(cache_key, ttl_seconds, json.dumps(cache_data))
        return True
    except Exception as e:
        print(f"[REDIS] Error saving {cache_key}: {str(e)}", file=sys.stderr)
        return False


def fetch_player_stats(api_client: ApiClient, player_id: str, player_name: str, 
                       start_year: int = 2020, end_year: int = 2025) -> Dict[int, List[Any]]:
    """Fetch player stats across multiple seasons"""
    stats_api = StatsApi(api_client)
    seasons_stats = {}
    
    for year in range(start_year, end_year + 1):
        try:
            # Fetch stats for the year (without team filter to get all teams)
            # Note: get_player_season_stats requires year as required parameter
            stats = stats_api.get_player_season_stats(year=year)
            
            # Filter for specific player
            player_stats = []
            for stat in stats:
                stat_player_id = getattr(stat, 'player_id', None)
                stat_player = getattr(stat, 'player', None)
                
                # Match by player ID (most reliable)
                if stat_player_id and str(stat_player_id) == str(player_id):
                    player_stats.append(stat)
                # Match by player name as fallback
                elif stat_player and player_name.lower() in stat_player.lower():
                    player_stats.append(stat)
            
            if player_stats:
                # Convert to dict format matching TypeScript route
                seasons_stats[year] = [
                    {
                        'playerId': getattr(stat, 'player_id', None),
                        'player': getattr(stat, 'player', None),
                        'firstName': getattr(stat, 'first_name', None),
                        'lastName': getattr(stat, 'last_name', None),
                        'team': getattr(stat, 'team', None),
                        'year': year,
                        'category': getattr(stat, 'category', None),
                        'statType': getattr(stat, 'stat_type', None),
                        'stat': getattr(stat, 'stat', None),
                    }
                    for stat in player_stats
                ]
            
            # Rate limiting - be nice to the API
            time.sleep(0.1)
            
        except Exception as e:
            print(f"[ERROR] Error fetching stats for {player_name} ({player_id}) year {year}: {str(e)}", file=sys.stderr)
            continue
    
    return seasons_stats


def fetch_game_stats(api_client: ApiClient, player_id: str, year: int, team: str = "Oklahoma") -> List[Dict]:
    """Fetch game-by-game stats for a player"""
    games_api = GamesApi(api_client)
    game_stats_data = []
    
    try:
        # Fetch game player stats - requires year and team
        game_player_stats = games_api.get_game_player_stats(year=year, team=team)
        
        # Also fetch games list to get opponent info
        games = games_api.get_games(year=year, team=team)
        games_dict = {g.id: g for g in games}
        
        # Filter for specific player and transform
        for game_stat in game_player_stats:
            game_id = getattr(game_stat, 'id', None)
            if not game_id:
                continue
                
            # Check if player is in this game
            player_found = False
            player_stats = {}
            player_team = None
            
            teams = getattr(game_stat, 'teams', [])
            for team_data in teams:
                team_name = getattr(team_data, 'team', None)
                categories = getattr(team_data, 'categories', [])
                
                for category in categories:
                    category_name = getattr(category, 'name', '')
                    types = getattr(category, 'types', [])
                    
                    for stat_type in types:
                        type_name = getattr(stat_type, 'name', '')
                        athletes = getattr(stat_type, 'athletes', [])
                        
                        for athlete in athletes:
                            athlete_id = getattr(athlete, 'id', None)
                            athlete_player_id = getattr(athlete, 'player_id', None)
                            
                            if str(athlete_id) == str(player_id) or str(athlete_player_id) == str(player_id):
                                player_found = True
                                player_team = team_name
                                stat_value = getattr(athlete, 'stat', None)
                                if stat_value is not None:
                                    # Map stat name similar to TypeScript route
                                    stat_key = map_stat_name(category_name, type_name)
                                    if stat_key:
                                        player_stats[stat_key] = (player_stats.get(stat_key, 0) or 0) + float(stat_value)
            
            if player_found:
                # Get game info
                game = games_dict.get(game_id)
                opponent = None
                if game:
                    home_team = getattr(game, 'home_team', None)
                    away_team = getattr(game, 'away_team', None)
                    if player_team:
                        opponent = away_team if home_team == player_team else home_team
                
                game_info = {
                    'gameId': str(game_id),
                    'date': getattr(game_stat, 'start_date', None) or (getattr(game, 'start_date', None) if game else None),
                    'opponent': opponent or 'Unknown',
                    'stats': player_stats
                }
                game_stats_data.append(game_info)
        
        time.sleep(0.1)  # Rate limiting
        
    except Exception as e:
        print(f"[ERROR] Error fetching game stats for player {player_id} year {year}: {str(e)}", file=sys.stderr)
    
    return game_stats_data


def map_stat_name(category: str, stat: str) -> Optional[str]:
    """Map CFBD stat names to our internal format (matching TypeScript route)"""
    category_lower = category.lower()
    stat_lower = stat.lower()
    
    # Passing stats
    if 'pass' in category_lower or 'pass' in stat_lower:
        if 'yard' in stat_lower or 'yds' in stat_lower:
            return 'passingYards'
        if 'touchdown' in stat_lower or 'td' in stat_lower:
            return 'passingTDs'
        if 'attempt' in stat_lower:
            return 'passingAttempts'
        if 'completion' in stat_lower:
            return 'completions'
        if 'interception' in stat_lower or 'int' in stat_lower:
            return 'interceptions'
    
    # Rushing stats
    if 'rush' in category_lower or 'rush' in stat_lower:
        if 'yard' in stat_lower or 'yds' in stat_lower:
            return 'rushingYards'
        if 'touchdown' in stat_lower or 'td' in stat_lower:
            return 'rushingTDs'
        if 'attempt' in stat_lower or 'carry' in stat_lower:
            return 'rushingAttempts'
    
    # Receiving stats
    if 'receiv' in category_lower or 'receiv' in stat_lower:
        if 'yard' in stat_lower or 'yds' in stat_lower:
            return 'receivingYards'
        if 'touchdown' in stat_lower or 'td' in stat_lower:
            return 'receivingTDs'
        if 'reception' in stat_lower or 'catch' in stat_lower:
            return 'receptions'
    
    # Return the original stat name if no mapping found
    return stat_lower.replace(' ', '')


def fetch_advanced_stats(api_client: ApiClient, api_key: str, player_id: str, year: int, team: str = "Oklahoma") -> Dict:
    """Fetch advanced stats (usage and PPA) for a player"""
    players_api = PlayersApi(api_client)
    
    result = {
        'usage': None,
        'ppa': None,
        'year': year
    }
    
    try:
        # Fetch player usage - can filter by player_id
        usage_data = players_api.get_player_usage(year=year, team=team, player_id=int(player_id) if player_id.isdigit() else None)
        
        # Find player usage
        player_usage = None
        for usage in usage_data:
            usage_id = getattr(usage, 'id', None)
            usage_player_id = getattr(usage, 'player_id', None)
            if str(usage_id) == str(player_id) or str(usage_player_id) == str(player_id):
                player_usage = usage
                break
        
        if player_usage:
            usage_obj = getattr(player_usage, 'usage', None)
            if usage_obj:
                result['usage'] = getattr(usage_obj, 'overall', None)
        
        # Fetch PPA using HTTP (matching TypeScript route)
        try:
            import requests
            ppa_url = f"https://api.collegefootballdata.com/ppa/players/season?year={year}&team={team}&player_id={player_id}"
            ppa_response = requests.get(
                ppa_url,
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Accept': 'application/json'
                },
                timeout=10
            )
            
            if ppa_response.ok:
                ppa_results = ppa_response.json()
                player_ppa = next(
                    (p for p in ppa_results if str(p.get('id', '')) == str(player_id) or str(p.get('id', '')) == str(player_id)),
                    None
                )
                if player_ppa and player_ppa.get('averagePPA'):
                    result['ppa'] = player_ppa['averagePPA'].get('all', None)
        except Exception as ppa_error:
            print(f"[WARNING] Could not fetch PPA for player {player_id}: {str(ppa_error)}", file=sys.stderr)
        
        time.sleep(0.1)  # Rate limiting
        
    except Exception as e:
        print(f"[ERROR] Error fetching advanced stats for player {player_id} year {year}: {str(e)}", file=sys.stderr)
    
    return result


def fetch_cfbd_stats(api_client: ApiClient, player_name: str, season: int, team: str = "Oklahoma") -> List[Dict]:
    """Fetch CFBD stats for a player"""
    stats_api = StatsApi(api_client)
    
    try:
        # Fetch player season stats
        stats = stats_api.get_player_season_stats(year=season, team=team)
        
        # Filter for specific player by name
        player_stats = [
            {
                'playerId': stat.player_id,
                'player': getattr(stat, 'player', None),
                'team': getattr(stat, 'team', None),
                'year': season,
                'category': getattr(stat, 'category', None),
                'statType': getattr(stat, 'stat_type', None),
                'stat': getattr(stat, 'stat', None),
            }
            for stat in stats
            if hasattr(stat, 'player') and stat.player and 
               player_name.lower() in stat.player.lower()
        ]
        
        time.sleep(0.1)  # Rate limiting
        
        return player_stats
        
    except Exception as e:
        print(f"[ERROR] Error fetching CFBD stats for {player_name} season {season}: {str(e)}", file=sys.stderr)
        return []


def process_player(api_client: ApiClient, api_key: str, redis_client, player: Dict, year: int, team: str, 
                  fetch_all_seasons: bool = True, current_year_only: bool = False):
    """Process a single player - fetch all their data and save to Redis"""
    player_id = str(player.get('id', ''))
    player_name = player.get('name', '')
    
    if not player_id or not player_name:
        print(f"[SKIP] Skipping player with missing ID or name: {player}", file=sys.stderr)
        return
    
    print(f"[PROCESSING] {player_name} (ID: {player_id})", file=sys.stderr)
    
    # 1. Fetch player stats across seasons
    if fetch_all_seasons:
        print(f"  → Fetching player stats across seasons...", file=sys.stderr)
        seasons_stats = fetch_player_stats(api_client, player_id, player_name, start_year=2020, end_year=year)
        
        if seasons_stats:
            # Save to Redis with same format as TypeScript route expects
            cache_data = {
                'playerId': player_id,
                'playerName': player_name,
                'data': seasons_stats,
                'cachedAt': int(time.time() * 1000),
                'expiresAt': int(time.time() * 1000) + (CACHE_TTL['player_stats'] * 1000)
            }
            cache_key = f"player-stats:{player_id}"
            save_to_redis(redis_client, cache_key, cache_data, CACHE_TTL['player_stats'])
            print(f"  ✓ Saved player stats for {len(seasons_stats)} seasons", file=sys.stderr)
    
    # 2. Fetch game stats (current year only for now, can be extended)
    if current_year_only or fetch_all_seasons:
        print(f"  → Fetching game stats for {year}...", file=sys.stderr)
        game_stats = fetch_game_stats(api_client, player_id, year, team)
        
        if game_stats:
            cache_key = f"game-stats:{player_id}:{year}:{team}"
            save_to_redis(redis_client, cache_key, game_stats, CACHE_TTL['game_stats'])
            print(f"  ✓ Saved {len(game_stats)} game stats", file=sys.stderr)
    
    # 3. Fetch advanced stats (current year)
    print(f"  → Fetching advanced stats for {year}...", file=sys.stderr)
    advanced_stats = fetch_advanced_stats(api_client, api_key, player_id, year, team)
    
    if advanced_stats.get('usage') or advanced_stats.get('ppa'):
        cache_key = f"advanced-stats:{player_id}:{year}:{team}"
        save_to_redis(redis_client, cache_key, advanced_stats, CACHE_TTL['advanced_stats'])
        print(f"  ✓ Saved advanced stats", file=sys.stderr)
    
    # 4. Fetch CFBD stats (current year)
    print(f"  → Fetching CFBD stats for {year}...", file=sys.stderr)
    cfbd_stats = fetch_cfbd_stats(api_client, player_name, year, team)
    
    if cfbd_stats:
        cache_key = f"cfbd-stats:{player_name.lower()}:{year}:{team}"
        result = {
            'count': len(cfbd_stats),
            'data': cfbd_stats,
            'player': {'id': player_id, 'name': player_name}
        }
        save_to_redis(redis_client, cache_key, result, CACHE_TTL['cfbd_stats'])
        print(f"  ✓ Saved CFBD stats", file=sys.stderr)
    
    print(f"[COMPLETE] Finished processing {player_name}\n", file=sys.stderr)


def main():
    """Main function"""
    # Get API key
    api_key = os.getenv("CFBD_API_KEY")
    if len(sys.argv) > 1:
        api_key = sys.argv[1].strip()
    
    if not api_key:
        print("Error: CFBD_API_KEY environment variable or API key argument required", file=sys.stderr)
        sys.exit(1)
    
    # Get parameters
    year = int(sys.argv[2]) if len(sys.argv) > 2 else 2025
    team = sys.argv[3] if len(sys.argv) > 3 else "Oklahoma"
    player_id = sys.argv[4] if len(sys.argv) > 4 else None  # Optional: process specific player only
    current_year_only = '--current-year-only' in sys.argv
    
    # Get Redis URL
    redis_url = os.getenv("REDIS_URL")
    redis_client = get_redis_client(redis_url) if redis_url and REDIS_AVAILABLE else None
    
    if not redis_client:
        print("Warning: Redis not available. Data will not be cached.", file=sys.stderr)
    
    # Configure CFBD API client
    configuration = Configuration()
    configuration.access_token = api_key
    api_client = ApiClient(configuration)
    
    # Get roster
    print(f"[FETCHING] Roster for {team} {year}...", file=sys.stderr)
    roster = None
    
    # Try to get from Redis first
    if redis_client:
        roster = get_roster_from_redis(redis_client, year, team)
        if roster:
            print(f"[CACHE] Found roster in Redis ({len(roster)} players)", file=sys.stderr)
    
    # If not in Redis, fetch from API
    if not roster:
        print(f"[API] Fetching roster from CFBD API...", file=sys.stderr)
        roster = fetch_roster(api_client, year, team)
        print(f"[API] Fetched {len(roster)} players", file=sys.stderr)
    
    if not roster:
        print("Error: Could not get roster data", file=sys.stderr)
        sys.exit(1)
    
    # Filter to specific player if requested
    if player_id:
        roster = [p for p in roster if str(p.get('id', '')) == str(player_id)]
        if not roster:
            print(f"Error: Player ID {player_id} not found in roster", file=sys.stderr)
            sys.exit(1)
    
    # Process each player
    print(f"\n[PROCESSING] {len(roster)} players...\n", file=sys.stderr)
    
    for i, player in enumerate(roster, 1):
        print(f"[{i}/{len(roster)}] ", end='', file=sys.stderr)
        try:
            process_player(
                api_client,
                api_key,
                redis_client, 
                player, 
                year, 
                team,
                fetch_all_seasons=not current_year_only,
                current_year_only=current_year_only
            )
        except Exception as e:
            print(f"[ERROR] Error processing {player.get('name', 'Unknown')}: {str(e)}", file=sys.stderr)
            continue
        
        # Rate limiting between players
        if i < len(roster):
            time.sleep(0.5)
    
    print(f"\n[COMPLETE] Processed {len(roster)} players", file=sys.stderr)


if __name__ == "__main__":
    main()
