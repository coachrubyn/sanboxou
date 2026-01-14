#!/usr/bin/env python3
"""
Script to explore CFBD stats and advanced stats available for each position
"""
import sys
import os
import json
from pathlib import Path
from collections import defaultdict

# Load environment variables from .env file
from dotenv import load_dotenv
project_root = Path(__file__).parent.parent
load_dotenv(project_root / ".env")

from cfbd import Configuration, ApiClient
from cfbd.api import StatsApi, PlayersApi, MetricsApi, AdjustedMetricsApi

def explore_cfbd_stats(api_key: str):
    """
    Explore CFBD stats and advanced stats broken down by position
    """
    try:
        # Configure API client
        configuration = Configuration()
        configuration.access_token = api_key
        
        api_client = ApiClient(configuration)
        stats_api = StatsApi(api_client)
        players_api = PlayersApi(api_client)
        metrics_api = MetricsApi(api_client)
        adjusted_metrics_api = AdjustedMetricsApi(api_client)
        
        year = 2024
        team = "Oklahoma"
        
        print(f"=== Exploring Stats and Advanced Stats by Position ({team} {year}) ===\n")
        
        # Get all player stats for OU 2024
        print("Fetching player stats...")
        player_stats = stats_api.get_player_season_stats(
            year=year,
            team=team,
            category=None  # Get all categories
        )
        
        # Group by position -> category -> stat types
        position_stats = defaultdict(lambda: defaultdict(set))
        
        for stat in player_stats:
            position = stat.position or "Unknown"
            category = stat.category or "Unknown"
            stat_type = stat.stat_type or "Unknown"
            
            position_stats[position][category].add(stat_type)
        
        # Get player usage stats
        print("Fetching player usage stats...")
        usage_stats = players_api.get_player_usage(
            year=year,
            team=team
        )
        
        # Group usage stats by position
        position_usage = defaultdict(list)
        for usage in usage_stats:
            position = getattr(usage, 'position', None) or "Unknown"
            position_usage[position].append(usage)
        
        # Get PPA (Predicted Points Added) stats
        print("Fetching PPA stats...")
        ppa_stats = []
        try:
            ppa_stats = metrics_api.get_predicted_points_added_by_player_season(
                year=year,
                team=team
            )
        except Exception as e:
            print(f"  Note: Could not fetch PPA stats: {e}")
        
        # Group PPA stats by position
        position_ppa = defaultdict(list)
        for ppa in ppa_stats:
            position = getattr(ppa, 'position', None) or "Unknown"
            position_ppa[position].append(ppa)
        
        # Get adjusted passing stats
        print("Fetching adjusted passing stats...")
        adjusted_passing = []
        try:
            adjusted_passing = adjusted_metrics_api.get_adjusted_player_passing_stats(
                year=year,
                team=team
            )
        except Exception as e:
            print(f"  Note: Could not fetch adjusted passing stats: {e}")
        
        # Get adjusted rushing stats
        print("Fetching adjusted rushing stats...")
        adjusted_rushing = []
        try:
            adjusted_rushing = adjusted_metrics_api.get_adjusted_player_rushing_stats(
                year=year,
                team=team
            )
        except Exception as e:
            print(f"  Note: Could not fetch adjusted rushing stats: {e}")
        
        # Build output structure
        output = {}
        
        # Sort positions alphabetically
        for position in sorted(position_stats.keys()):
            position_data = {
                "regular_stats": {},
                "advanced_stats": {}
            }
            
            # Regular stats by category
            for category in sorted(position_stats[position].keys()):
                stat_types = sorted(list(position_stats[position][category]))
                position_data["regular_stats"][category] = stat_types
            
            # Advanced stats
            if position in position_usage and position_usage[position]:
                # Get sample usage to see available fields
                sample_usage = position_usage[position][0]
                usage_fields = []
                if hasattr(sample_usage, 'to_dict'):
                    usage_dict = sample_usage.to_dict()
                    usage_fields = list(usage_dict.keys())
                elif hasattr(sample_usage, '__dict__'):
                    usage_fields = [k for k in sample_usage.__dict__.keys() if not k.startswith('_')]
                position_data["advanced_stats"]["usage"] = {
                    "available": True,
                    "player_count": len(position_usage[position]),
                    "fields": usage_fields
                }
            
            if position in position_ppa and position_ppa[position]:
                # Get sample PPA to see available fields
                sample_ppa = position_ppa[position][0]
                ppa_fields = []
                if hasattr(sample_ppa, 'to_dict'):
                    ppa_dict = sample_ppa.to_dict()
                    ppa_fields = list(ppa_dict.keys())
                elif hasattr(sample_ppa, '__dict__'):
                    ppa_fields = [k for k in sample_ppa.__dict__.keys() if not k.startswith('_')]
                position_data["advanced_stats"]["ppa"] = {
                    "available": True,
                    "player_count": len(position_ppa[position]),
                    "fields": ppa_fields
                }
            
            # Check adjusted metrics
            if adjusted_passing:
                passing_positions = [getattr(p, 'position', None) for p in adjusted_passing]
                if position in passing_positions:
                    sample_adj = next((p for p in adjusted_passing if getattr(p, 'position', None) == position), None)
                    if sample_adj:
                        adj_fields = []
                        if hasattr(sample_adj, 'to_dict'):
                            adj_dict = sample_adj.to_dict()
                            adj_fields = list(adj_dict.keys())
                        elif hasattr(sample_adj, '__dict__'):
                            adj_fields = [k for k in sample_adj.__dict__.keys() if not k.startswith('_')]
                        position_data["advanced_stats"]["adjusted_passing"] = {
                            "available": True,
                            "fields": adj_fields
                        }
            
            if adjusted_rushing:
                rushing_positions = [getattr(p, 'position', None) for p in adjusted_rushing]
                if position in rushing_positions:
                    sample_adj = next((p for p in adjusted_rushing if getattr(p, 'position', None) == position), None)
                    if sample_adj:
                        adj_fields = []
                        if hasattr(sample_adj, 'to_dict'):
                            adj_dict = sample_adj.to_dict()
                            adj_fields = list(adj_dict.keys())
                        elif hasattr(sample_adj, '__dict__'):
                            adj_fields = [k for k in sample_adj.__dict__.keys() if not k.startswith('_')]
                        position_data["advanced_stats"]["adjusted_rushing"] = {
                            "available": True,
                            "fields": adj_fields
                        }
            
            output[position] = position_data
        
        # Print formatted output
        print("\n" + "="*80)
        print("STATS AND ADVANCED STATS BY POSITION")
        print("="*80 + "\n")
        
        for position, data in output.items():
            print(f"\n{'='*80}")
            print(f"POSITION: {position}")
            print(f"{'='*80}")
            
            # Regular Stats
            print(f"\n📊 REGULAR STATS:")
            if data["regular_stats"]:
                for category, stat_types in data["regular_stats"].items():
                    print(f"  • {category.upper()}:")
                    for stat_type in stat_types:
                        print(f"    - {stat_type}")
            else:
                print("  No regular stats available")
            
            # Advanced Stats
            print(f"\n🚀 ADVANCED STATS:")
            if data["advanced_stats"]:
                for adv_stat_name, adv_stat_data in data["advanced_stats"].items():
                    if adv_stat_data.get("available"):
                        print(f"  • {adv_stat_name.upper()}:")
                        if "player_count" in adv_stat_data:
                            print(f"    Players with data: {adv_stat_data['player_count']}")
                        if "fields" in adv_stat_data and adv_stat_data["fields"]:
                            print(f"    Available fields: {', '.join(adv_stat_data['fields'][:10])}")
                            if len(adv_stat_data["fields"]) > 10:
                                print(f"    ... and {len(adv_stat_data['fields']) - 10} more")
            else:
                print("  No advanced stats available")
        
        print("\n" + "="*80)
        print("SUMMARY")
        print("="*80)
        print(f"\nTotal positions found: {len(output)}")
        print(f"Total regular stat categories: {sum(len(data['regular_stats']) for data in output.values())}")
        print(f"Total advanced stat types: {sum(len(data['advanced_stats']) for data in output.values())}")
        
        # Optionally save to JSON file
        output_file = project_root / "data" / "position-stats-breakdown.json"
        output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, 'w') as f:
            json.dump(output, f, indent=2)
        print(f"\nFull breakdown saved to: {output_file}")
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    api_key = os.getenv("CFBD_API_KEY")
    
    if len(sys.argv) > 1:
        api_key = sys.argv[1]
    
    if not api_key:
        print("Error: CFBD_API_KEY environment variable or API key argument required", file=sys.stderr)
        sys.exit(1)
    
    explore_cfbd_stats(api_key)
