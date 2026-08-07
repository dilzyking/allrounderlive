// ====== WILLOW LIVE MATCHES SCRIPT ======

// API URL - Replace with your worker URL
const WILLOW_API_URL = 'https://willow-api.sayanwork-studioo.workers.dev/';

// DOM Elements
const willowTrack = document.getElementById('willowLiveTrack');
const willowArrowLeft = document.getElementById('willowLiveArrowLeft');
const willowArrowRight = document.getElementById('willowLiveArrowRight');
const liveCountBadge = document.getElementById('liveCountBadge');

// State
let willowMatches = [];

// ====== FETCH MATCHES FROM API ======
async function fetchWillowMatches() {
  try {
    if (willowTrack) {
      willowTrack.innerHTML = '<div class="willow-loading">⏳ Loading Willow Live matches...</div>';
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
      liveCountBadge.textContent = `🔴 ${liveCount} Live`;
    }
    
    // Store matches
    willowMatches = data.streams || [];
    
    renderWillowMatches(willowMatches);
    
  } catch (error) {
    console.error('Willow fetch error:', error);
    if (willowTrack) {
      willowTrack.innerHTML = `
        <div class="willow-error">
          ❌ Failed to load Willow matches<br>
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
  
  streams.forEach((stream, index) => {
    // Extract team names from title
    const titleParts = stream.title || 'Unknown Match';
    const teams = extractTeams(titleParts);
    
    const card = document.createElement('a');
    card.className = 'willow-live-card';
    card.href = `#`;
    card.dataset.index = index;
    
    card.innerHTML = `
      <div class="willow-live-thumb">
        <img 
          src="${stream.tvgLogo || 'https://via.placeholder.com/480x270/14181f/ffffff?text=Willow+Cricket'}" 
          alt="${stream.title}"
          loading="lazy"
          onerror="this.src='https://via.placeholder.com/480x270/14181f/ffffff?text=Willow+Cricket'"
        />
        <span class="willow-live-badge-live">● LIVE</span>
        <div class="willow-live-overlay">
          <span class="willow-live-play-icon">▶</span>
        </div>
      </div>
      <div class="willow-live-info">
        <div class="willow-live-match-title">${stream.title || 'Unknown Match'}</div>
        <div class="willow-live-meta">
          <span class="willow-live-group">🏏 ${stream.groupTitle || 'Cricket'}</span>
          ${teams ? `<span class="willow-live-teams">• ${teams}</span>` : ''}
          <span class="willow-live-status">• LIVE</span>
        </div>
      </div>
    `;
    
    // Click handler to open player
    card.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      openWillowPlayer(index);
    });
    
    willowTrack.appendChild(card);
  });

  // Reset scroll position
  willowTrack.scrollLeft = 0;
}

// ====== EXTRACT TEAMS FROM TITLE ======
function extractTeams(title) {
  // Try to extract team names from various formats
  // Examples: "India vs Australia", "Chennai Falcons vs Bengaluru Badgers"
  const vsMatch = title.match(/(.+?)\s*(?:vs|Vs|VS|v\.?|–|-)\s*(.+?)(?:\s*[-–]|$)/);
  if (vsMatch) {
    const team1 = vsMatch[1].trim().split(' - ').pop() || vsMatch[1].trim();
    const team2 = vsMatch[2].trim().split(' - ')[0] || vsMatch[2].trim();
    return `${team1} vs ${team2}`;
  }
  
  // Try to extract from format "X vs Y"
  const vsMatch2 = title.match(/(.+?)\s+vs\s+(.+?)(?:\s+[–-]|\s*$)/i);
  if (vsMatch2) {
    return `${vsMatch2[1].trim()} vs ${vsMatch2[2].trim()}`;
  }
  
  return null;
}

// ====== OPEN WILLOW PLAYER ======
function openWillowPlayer(index) {
  const stream = willowMatches[index];
  if (!stream) {
    alert('Stream not found');
    return;
  }

  // Store stream data in localStorage to pass to player page
  localStorage.setItem('willowStreamData', JSON.stringify({
    title: stream.title || 'Willow Live',
    tvgLogo: stream.tvgLogo || '',
    groupTitle: stream.groupTitle || 'Cricket',
    streamUrl: stream.streamUrl || '',
    licenseKey: stream.properties?.license_key || '',
    properties: stream.properties || {}
  }));

  // Redirect to player page
  window.location.href = 'willow-player.html';
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
// Auto-refresh every 5 minutes
fetchWillowMatches();
setInterval(fetchWillowMatches, 300000);
