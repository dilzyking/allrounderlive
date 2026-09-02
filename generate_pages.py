#!/usr/bin/env python3
"""
Generate player pages for all matches
"""

import json
import os
import shutil
from datetime import datetime

def generate_pages():
    """Generate player pages for all matches"""
    
    # Create world-sports folder
    os.makedirs('world-sports', exist_ok=True)
    
    # Copy template.html as player.html
    if os.path.exists('template.html'):
        shutil.copy('template.html', 'world-sports/player.html')
        print("✅ Copied template.html to world-sports/player.html")
    else:
        print("❌ template.html not found")
        return
    
    # Copy api/world-sports.json to world-sports/
    if os.path.exists('api/world-sports.json'):
        shutil.copy('api/world-sports.json', 'world-sports/world-sports.json')
        print("✅ Copied api/world-sports.json to world-sports/")
    else:
        print("❌ api/world-sports.json not found")
        return
    
    print("✅ Player pages generated successfully")

if __name__ == '__main__':
    generate_pages()
