#!/usr/bin/env python3
"""
Fetch Sportzfy data from external JSON and generate clean API JSON
"""

import urllib.request
import json
import os
import shutil
from datetime import datetime

# Configuration
EXTERNAL_JSON_URL = "https://dilzzy-all-sports.pages.dev/data/matches.json"
OUTPUT_DIR = "world-sports"
API_DIR = "api"
TEMPLATE_FILE = "template.html"
BASE_URL = "https://allrounderlive.pages.dev"

def fetch_data():
    """Fetch match data from external URL using urllib"""
    print(f"📡 Fetching data from: {EXTERNAL_JSON_URL}")
    try:
        req = urllib.request.Request(
            EXTERNAL_JSON_URL,
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req, timeout=15) as response:
            data = json.loads(response.read().decode('utf-8'))
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

def generate_clean_api_json(data):
    """Generate clean API JSON with essential fields only"""
    api_file = os.path.join(API_DIR, "world-sports.json")
    
    clean_matches = []
    for match in data.get('matches', []):
        # Determine status display
        status = match.get('status', 'unknown')
        status_display = {
            'live': 'LIVE',
            'upcoming': 'UPCOMING',
            'completed': 'COMPLETED'
        }.get(status, status.upper())
        
        # Get first server URL if available
        server_urls = match.get('server_urls', [])
        first_server = server_urls[0] if server_urls else None
        
        clean_match = {
            'match_id': match.get('match_id'),
            'title': match.get('title'),
            'teams': match.get('teams'),
            'sport': match.get('sport', 'cricket'),
            'sport_display': match.get('sport', 'Cricket').capitalize(),
            'status': status,
            'status_display': status_display,
            'thumbnail': match.get('thumbnail'),
            'league': match.get('league'),
            'viewers': match.get('viewers'),
            'viewers_type': match.get('viewers_type'),
            'date': match.get('date'),
            'time': match.get('time'),
            'page_url': f"{BASE_URL}/world-sports/player.html?id={match.get('match_id')}",
            'stream_url': first_server,
            'server_count': len(server_urls),
            'server_urls': server_urls if server_urls else []
        }
        clean_matches.append(clean_match)
    
    clean_data = {
        'timestamp': datetime.now().isoformat(),
        'total_matches': len(clean_matches),
        'live_count': sum(1 for m in clean_matches if m['status'] == 'live'),
        'upcoming_count': sum(1 for m in clean_matches if m['status'] == 'upcoming'),
        'completed_count': sum(1 for m in clean_matches if m['status'] == 'completed'),
        'matches': clean_matches
    }
    
    # Save clean API JSON
    with open(api_file, 'w', encoding='utf-8') as f:
        json.dump(clean_data, f, indent=2, ensure_ascii=False)
    print(f"💾 Clean API JSON saved to: {api_file}")
    
    return clean_data

def generate_world_sports_json(data):
    """Generate world-sports.json in the output directory (same as API)"""
    world_sports_file = os.path.join(OUTPUT_DIR, "world-sports.json")
    
    # Use the same clean data
    clean_data = generate_clean_api_json(data)
    
    # Also save to output directory
    with open(world_sports_file, 'w', encoding='utf-8') as f:
        json.dump(clean_data, f, indent=2, ensure_ascii=False)
    print(f"💾 World sports JSON saved to: {world_sports_file}")
    
    return clean_data

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
    
    # Generate clean API JSON
    clean_data = generate_clean_api_json(data)
    
    # Also save to world-sports folder
    world_sports_file = os.path.join(OUTPUT_DIR, "world-sports.json")
    with open(world_sports_file, 'w', encoding='utf-8') as f:
        json.dump(clean_data, f, indent=2, ensure_ascii=False)
    print(f"💾 World sports JSON saved to: {world_sports_file}")
    
    # Copy template
    if copy_template():
        print("\n✅ Pages generated successfully!")
    else:
        print("\n⚠️ Pages generated but template missing.")
    
    # Summary
    print("\n📊 Summary:")
    print(f"   Total matches: {clean_data['total_matches']}")
    print(f"   Live: {clean_data['live_count']}")
    print(f"   Upcoming: {clean_data['upcoming_count']}")
    print(f"   Completed: {clean_data['completed_count']}")

if __name__ == "__main__":
    main()
