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

// ====== RENDER MATCHES ======
function renderWillowMatches(streams) {
  if (!willowTrack) return;

  if (!streams || streams.length === 0) {
    willowTrack.innerHTML = '<div class="willow-loading">No live matches available</div>';
    return;
  }

  willowTrack.innerHTML = '';

  streams.forEach((stream) => {
    // Extract team names from title
    const teams = extractTeams(stream.title || stream.tvgName || 'Unknown Match');
    const tournament = extractTournament(stream.title || stream.tvgName || '');

    // Use tvgLogo or fallback
    const logo = stream.tvgLogo || 'https://via.placeholder.com/480x270/14181f/ffffff?text=Willow+Cricket';

    // FIX: use a safe id that always has a value, so the query string
    // is never "?id=undefined" and the player page can always find a match
    const safeId = getSafeStreamId(stream);

    if (!safeId) {
      console.warn('Skipping stream with no usable id/title:', stream);
      return; // skip cards we truly can't link anywhere
    }

    const card = document.createElement('a');
    card.className = 'willow-live-card';
    card.href = `willow-player.html?id=${encodeURIComponent(safeId)}`;
    card.dataset.tvgId = safeId;

    card.innerHTML = `
      <div class="willow-live-thumb">
        <img 
          src="${logo}" 
          alt="${stream.title || stream.tvgName || 'Willow Live'}"
          loading="lazy"
          onerror="this.src='https://via.placeholder.com/480x270/14181f/ffffff?text=Willow+Cricket'"
        />
        <div class="willow-live-badge">
          <span class="material-icons">fiber_manual_record</span>
          LIVE
        </div>
        <div class="willow-live-overlay">
          <span class="willow-live-play-icon">
            <span class="material-icons">play_arrow</span>
          </span>
        </div>
      </div>
      <div class="willow-live-info">
        <div class="willow-live-teams">${teams}</div>
        ${tournament ? `<div class="willow-live-tournament">${tournament}</div>` : ''}
      </div>
    `;

    willowTrack.appendChild(card);
  });

  // Reset scroll position
  willowTrack.scrollLeft = 0;
}

// ====== EXTRACT TEAMS FROM TITLE ======
function extractTeams(title) {
  // Try to extract from format "Tournament - Team1 vs Team2"
  const vsMatch = title.match(/(.+?)\s*(?:vs|Vs|VS|v.?)\s*(.+?)(?:\s*[-–]|$)/i);
  if (vsMatch) {
    let team1 = vsMatch[1].trim();
    let team2 = vsMatch[2].trim();

    // Clean up team names (remove tournament prefix)
    team1 = team1.split(' - ').pop() || team1;
    team2 = team2.split(' - ')[0] || team2;

    return `${team1} vs ${team2}`;
  }

  // Try to extract from format "Team1 vs Team2 - Tournament"
  const vsMatch2 = title.match(/(.+?)\s+vs\s+(.+?)(?:\s+[–-]|\s*$)/i);
  if (vsMatch2) {
    return `${vsMatch2[1].trim()} vs ${vsMatch2[2].trim()}`;
  }

  return title;
}

// ====== EXTRACT TOURNAMENT FROM TITLE ======
function extractTournament(title) {
  const tournamentMatch = title.match(/^([^,–-]+?(?:League|Series|Tournament|Cup|Tour|Championship|Trophy|Premier League|World Cup|Hundred))/i);
  if (tournamentMatch) {
    return tournamentMatch[1].trim();
  }

  const vsMatch = title.match(/^(.+?)\s*(?:vs|Vs|VS|v.?)/i);
  if (vsMatch) {
    const part = vsMatch[1].trim();
    const tournMatch = part.match(/(.+?)(?:\s*[-–]\s*)/);
    if (tournMatch) {
      return tournMatch[1].trim();
    }
  }

  return null;
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
