// ====== WILLOW LIVE MATCHES SCRIPT ======

// API URL
const WILLOW_API_URL = 'https://willow-api.sayanwork-studioo.workers.dev/';

// DOM Elements
const willowTrack = document.getElementById('willowLiveTrack');
const willowArrowLeft = document.getElementById('willowLiveArrowLeft');
const willowArrowRight = document.getElementById('willowLiveArrowRight');
const liveCountBadge = document.getElementById('liveCountBadge');

// State
let willowMatches = [];

// ====== SAFE ID HELPER ======
// Some streams don't have a tvgId, so fall back to tvgName / title.
// This MUST match the same logic used on willow-player.html.
function getSafeStreamId(stream) {
  return stream.tvgId || stream.tvgName || stream.title || '';
}

// ====== FETCH MATCHES FROM API ======
async function fetchWillowMatches() {
  try {
    if (willowTrack) {
      willowTrack.innerHTML = '<div class="willow-loading">⏳ Loading live matches...</div>';
    }

    const response = await fetch(WILLOW_API_URL);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.message || 'Unknown error');
    }

    // Update live count badge
    if (liveCountBadge) {
      const liveCount = data.liveCount || data.streams?.length || 0;
      liveCountBadge.innerHTML = `
        <span class="material-icons">fiber_manual_record</span>
        ${liveCount} LIVE
      `;
    }

    // Store matches
    willowMatches = data.streams || [];

    renderWillowMatches(willowMatches);

  } catch (error) {
    console.error('Willow fetch error:', error);
    if (willowTrack) {
      willowTrack.innerHTML = `
        <div class="willow-error">
          ❌ Failed to load matches<br>
          <small>${error.message}</small><br>
          <button onclick="fetchWillowMatches()">Retry</button>
        </div>
      `;
    }
  }
}

// ====== EXTRACT TEAMS FROM TITLE ======
function extractTeams(title) {
  if (!title) return 'Live Match';
  
  // Clean up title - remove common prefixes
  let cleaned = title.replace(/^(Live:|LIVE:|HD:|Willow\s*)/i, '').trim();
  
  // Try to extract from format "Tournament - Team1 vs Team2"
  const vsMatch = cleaned.match(/(.+?)\s*(?:vs|Vs|VS|v\.?)\s*(.+?)(?:\s*[-–]|$)/i);
  if (vsMatch) {
    let team1 = vsMatch[1].trim();
    let team2 = vsMatch[2].trim();
    
    // Remove tournament prefix from team1 (e.g., "Afghanistan Tour of Australia - Afghanistan" -> "Afghanistan")
    const tournMatch = team1.match(/(?:Tour|Series|League|Cup|Trophy|Championship|Premier|World)\s+(?:of\s+)?(.+)$/i);
    if (tournMatch) {
      team1 = tournMatch[1].trim();
    }
    
    // Clean up team names
    team1 = team1.split(' - ').pop() || team1;
    team2 = team2.split(' - ')[0] || team2;
    
    // Remove extra words like "vs" from team names
    team1 = team1.replace(/\s*vs\s*.*$/i, '').trim();
    team2 = team2.replace(/^\s*vs\s*/, '').trim();
    
    return `${team1} vs ${team2}`;
  }
  
  // Try to extract from format "Team1 vs Team2 - Tournament"
  const vsMatch2 = cleaned.match(/(.+?)\s+vs\s+(.+?)(?:\s+[–-]|\s*$)/i);
  if (vsMatch2) {
    let team1 = vsMatch2[1].trim();
    let team2 = vsMatch2[2].trim();
    
    // Remove tournament prefix
    const tournMatch = team1.match(/(?:Tour|Series|League|Cup|Trophy|Championship|Premier|World)\s+(?:of\s+)?(.+)$/i);
    if (tournMatch) {
      team1 = tournMatch[1].trim();
    }
    
    return `${team1} vs ${team2}`;
  }
  
  // If no "vs" pattern found, try to extract team names from "Tournament - Team"
  const teamMatch = cleaned.match(/^(.+?)\s*[-–]\s*(.+?)$/);
  if (teamMatch) {
    return teamMatch[2].trim();
  }
  
  // Fallback: return cleaned title
  return cleaned;
}

// ====== EXTRACT TOURNAMENT FROM TITLE ======
function extractTournament(title) {
  if (!title) return null;
  
  // Look for tournament name
  const patterns = [
    /^([^,–-]+?(?:League|Series|Tournament|Cup|Trophy|Championship|Premier League|World Cup|Hundred|Tour))/i,
    /^([^,–-]+?(?:Tour|Series|League|Cup|Trophy|Championship|Premier|World))\s+(?:of\s+)?/i
  ];
  
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}

// ====== RENDER MATCHES ======
function renderWillowMatches(streams) {
  if (!willowTrack) return;

  if (!streams || streams.length === 0) {
    willowTrack.innerHTML = '<div class="willow-loading">No live matches available</div>';
    return;
  }

  willowTrack.innerHTML = '';

  streams.forEach((stream) => {
    const title = stream.title || stream.tvgName || 'Unknown Match';
    
    // Extract team names
    const teamsDisplay = extractTeams(title);
    
    // Extract tournament
    const tournament = extractTournament(title);

    // Use tvgLogo or fallback
    const logo = stream.tvgLogo || 'https://via.placeholder.com/480x270/14181f/ffffff?text=Willow+Cricket';

    const safeId = getSafeStreamId(stream);

    if (!safeId) {
      console.warn('Skipping stream with no usable id/title:', stream);
      return;
    }

    const card = document.createElement('a');
    card.className = 'willow-live-card';
    card.href = `willow-player.html?id=${encodeURIComponent(safeId)}`;
    card.dataset.tvgId = safeId;

    // Split teams for display with proper styling
    const teamParts = teamsDisplay.split(' vs ');
    let teamsHTML = '';
    if (teamParts.length === 2) {
      teamsHTML = `
        <span class="willow-live-team">${teamParts[0].trim()}</span>
        <span class="willow-live-vs">vs</span>
        <span class="willow-live-team">${teamParts[1].trim()}</span>
      `;
    } else {
      teamsHTML = `<span class="willow-live-team">${teamsDisplay}</span>`;
    }

    card.innerHTML = `
      <div class="willow-live-thumb">
        <img 
          src="${logo}" 
          alt="${title}"
          loading="lazy"
          onerror="this.src='https://via.placeholder.com/480x270/14181f/ffffff?text=Willow+Cricket'"
        />
        <div class="willow-live-badge-live">
          <span class="material-icons" style="font-size: 10px;">fiber_manual_record</span>
          LIVE
        </div>
        <div class="willow-live-overlay">
          <span class="willow-live-play-icon">
            <span class="material-icons" style="font-size: 24px;">play_arrow</span>
          </span>
        </div>
      </div>
      <div class="willow-live-info">
        <div class="willow-live-match-title">
          ${teamsHTML}
        </div>
        ${tournament ? `<div class="willow-live-group">${tournament}</div>` : ''}
      </div>
    `;

    willowTrack.appendChild(card);
  });

  // Reset scroll position
  willowTrack.scrollLeft = 0;
}

// ====== CAROUSEL SCROLL CONTROLS ======
function getWillowScrollAmount() {
  if (!willowTrack) return 320;
  const card = willowTrack.querySelector('.willow-live-card');
  if (!card) return 320;
  const trackStyles = getComputedStyle(willowTrack);
  const gap = parseFloat(trackStyles.columnGap || trackStyles.gap || '20');
  return (card.getBoundingClientRect().width + gap) * 2;
}

if (willowArrowRight) {
  willowArrowRight.addEventListener('click', function(e) {
    e.stopPropagation();
    if (willowTrack) {
      willowTrack.scrollBy({ left: getWillowScrollAmount(), behavior: 'smooth' });
    }
  });
}

if (willowArrowLeft) {
  willowArrowLeft.addEventListener('click', function(e) {
    e.stopPropagation();
    if (willowTrack) {
      willowTrack.scrollBy({ left: -getWillowScrollAmount(), behavior: 'smooth' });
    }
  });
}

// ====== INIT ======
fetchWillowMatches();
setInterval(fetchWillowMatches, 300000);
