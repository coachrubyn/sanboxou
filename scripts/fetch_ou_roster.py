"""
Script to fetch OU roster data using the CFBD Python library
"""
import sys
import os
import json
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

def fetch_ou_roster(api_key: str, year: int = 2024, team: str = "Oklahoma"):
    """
    Fetch OU roster data from CFBD API
    
    Args:
        api_key: CFBD API key
        year: Season year (default: 2024)
        team: Team name (default: "Oklahoma")
    
    Returns:
        List of roster players as dictionaries
    """
    try:
        # Configure API client with API key
        # The CFBD API uses Bearer token authentication
        configuration = Configuration()
        configuration.access_token = api_key
        
        # Create API client and teams API instance
        api_client = ApiClient(configuration)
        teams_api = TeamsApi(api_client)
        
        # Fetch roster
        roster = teams_api.get_roster(team=team, year=year)
        
        # Convert to list of dictionaries
        roster_data = []
        for player in roster:
            player_dict = {
                "id": player.id,
                "firstName": player.first_name,
                "lastName": player.last_name,
                "name": f"{player.first_name} {player.last_name}",
                "team": player.team,
                "position": player.position,
                "jersey": player.jersey,
                "year": player.year,
                "height": player.height,
                "weight": player.weight,
                "homeCity": player.home_city,
                "homeState": player.home_state,
                "homeCountry": player.home_country,
            }
            roster_data.append(player_dict)
        
        return roster_data
    
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
    
    # Fetch roster
    roster = fetch_ou_roster(api_key, year, team)
    
    # Output as JSON
    print(json.dumps({
        "count": len(roster),
        "data": roster
    }, indent=2))
