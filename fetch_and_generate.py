#!/usr/bin/env python3
"""
Fetch Sportzfy data from external JSON and generate player pages
"""

import requests
import json
import os
import shutil
from datetime import datetime

# Configuration
EXTERNAL_JSON_URL = "https://dilzzy-all-sports.pages.dev/data/matches.json"
OUTPUT_DIR = "world-sports"
API_DIR = "api"
TEMPLATE_FILE = "template.html"

def fetch_data():
    """Fetch match data from external URL"""
    print(f"📡 Fetching data from: {EXTERNAL_JSON_URL}")
    try:
        response = requests.get(EXTERNAL_JSON_URL, timeout=15)
        response.raise_for_status()
        data = response.json()
        print(f"✅ Successfully fetched {data.get('total_matches', 0)} matches")
        return data
    except Exception as e:
        print(f"❌ Error fetching data: {e}")
        return None

def prepare_directories():
    """Create required directories"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(API_DIR, exist_ok=True)
    print(f"📁 Directories ready: {OUTPUT_DIR}, {API_DIR}")

def save_api_json(data):
    """Save API JSON file"""
    api_file = os.path.join(API_DIR, "world-sports.json")
    with open(api_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"💾 API JSON saved to: {api_file}")

def generate_world_sports_json(data):
    """Generate world-sports.json in the output directory"""
    world_sports_file = os.path.join(OUTPUT_DIR, "world-sports.json")
    
    # Create a simplified version with only needed fields
    simplified_data = {
        'timestamp': data.get('timestamp', datetime.now().isoformat()),
        'total_matches': data.get('total_matches', 0),
        'live_count': data.get('live_count', 0),
        'upcoming_count': data.get('upcoming_count', 0),
        'completed_count': data.get('completed_count', 0),
        'matches': []
    }
    
    for match in data.get('matches', []):
        simplified_match = {
            'match_id': match.get('match_id'),
            'title': match.get('title'),
            'teams': match.get('teams'),
            'league': match.get('league'),
            'sport': match.get('sport'),
            'status': match.get('status'),
            'runtime': match.get('runtime'),
            'viewers': match.get('viewers'),
            'viewers_type': match.get('viewers_type'),
            'servers': match.get('servers'),
            'date': match.get('date'),
            'time': match.get('time'),
            'thumbnail': match.get('thumbnail'),
            'match_url': match.get('match_url'),
            'server_urls': match.get('server_urls', []),
            'last_updated': match.get('last_updated')
        }
        simplified_data['matches'].append(simplified_match)
    
    with open(world_sports_file, 'w', encoding='utf-8') as f:
        json.dump(simplified_data, f, indent=2, ensure_ascii=False)
    print(f"💾 World sports JSON saved to: {world_sports_file}")
    
    return simplified_data

def copy_template():
    """Copy template.html to player.html if exists"""
    if os.path.exists(TEMPLATE_FILE):
        player_file = os.path.join(OUTPUT_DIR, "player.html")
        shutil.copy(TEMPLATE_FILE, player_file)
        print(f"✅ Template copied to: {player_file}")
        return True
    else:
        print(f"⚠️ Template file '{TEMPLATE_FILE}' not found")
        return False

def generate_match_pages(data):
    """Generate individual match pages"""
    # We'll use a single player.html with URL parameters
    # No need to generate separate files
    print("✅ Using player.html with URL parameters for all matches")

def main():
    print("\n" + "="*60)
    print("🏏 SPORTZFY PAGE GENERATOR")
    print("="*60 + "\n")
    
    # Prepare directories
    prepare_directories()
    
    # Fetch data
    data = fetch_data()
    if not data:
        print("❌ Failed to fetch data. Exiting.")
        return
    
    # Save API JSON
    save_api_json(data)
    
    # Generate world-sports.json
    world_sports_data = generate_world_sports_json(data)
    
    # Copy template
    if copy_template():
        print("\n✅ Pages generated successfully!")
        print(f"📁 Output directory: {OUTPUT_DIR}/")
        print(f"📄 Player page: {OUTPUT_DIR}/player.html?id={{match_id}}")
        print(f"📊 Data file: {OUTPUT_DIR}/world-sports.json")
    else:
        print("\n⚠️ Pages generated but template missing.")
        print("📁 Output directory: {OUTPUT_DIR}/")
        print(f"📊 Data file: {OUTPUT_DIR}/world-sports.json")
    
    # Summary
    print("\n📊 Summary:")
    print(f"   Total matches: {data.get('total_matches', 0)}")
    print(f"   Live: {data.get('live_count', 0)}")
    print(f"   Upcoming: {data.get('upcoming_count', 0)}")
    print(f"   Completed: {data.get('completed_count', 0)}")

if __name__ == "__main__":
    main()
