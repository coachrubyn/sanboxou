"""
Vercel serverless function to fetch OU roster data using CFBD Python library
"""
import json
import os
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler
from pathlib import Path

# Add the cfbd-python directory to the path
# In Vercel, the working directory is the project root
cfbd_path = Path(__file__).parent.parent / "cfbd-python"
sys.path.insert(0, str(cfbd_path))

from cfbd import Configuration, ApiClient
from cfbd.api import TeamsApi


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            # Get API key from environment variable
            api_key = os.getenv("CFBD_API_KEY")
            
            if not api_key:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "error": "CFBD API key not configured",
                    "message": "Please ensure CFBD_API_KEY is set in your environment variables."
                }).encode('utf-8'))
                return
            
            # Parse query parameters from path
            parsed_path = urllib.parse.urlparse(self.path)
            query_params = urllib.parse.parse_qs(parsed_path.query)
            
            year = int(query_params.get("year", ["2025"])[0])
            team = query_params.get("team", ["Oklahoma"])[0]
            
            # Validate year
            if year < 2000 or year > 2100:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "error": "Invalid year parameter",
                    "message": "Year must be between 2000 and 2100."
                }).encode('utf-8'))
                return
            
            # Configure API client
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
                    "id": str(player.id),
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
                roster_data.append(player_dict)
            
            # Send success response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
            self.wfile.write(json.dumps({
                "count": len(roster_data),
                "data": roster_data
            }).encode('utf-8'))
        
        except Exception as e:
            error_message = str(e)
            status_code = 500
            
            # Check for rate limit errors
            if "429" in error_message or "rate limit" in error_message.lower() or "quota" in error_message.lower():
                status_code = 429
            
            self.send_response(status_code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "error": "Failed to fetch roster data",
                "details": error_message,
                "rateLimitExceeded": status_code == 429
            }).encode('utf-8'))
    
    def do_OPTIONS(self):
        # Handle CORS preflight requests
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
