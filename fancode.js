// fancode.js - FanCode Section with M3U8 Playback

(function() {
  'use strict';

  // Configuration
  const FANCODE_API_URL = 'https://raw.githubusercontent.com/doctor-8trange/zyphx8/refs/heads/main/data/fancode.json';
  const SKELETON_COUNT = 6;

  // DOM elements
  const track = document.getElementById('fancodeTrack');
  const arrowLeft = document.getElementById('fancodeArrowLeft');
  const arrowRight = document.getElementById('fancodeArrowRight');
  const badge = document.querySelector('.fancode-badge');

  // State
  let isLoading = false;
  let matches = [];

  // ---- SKELETON GENERATOR (NO TEXT) ----
  function createSkeletonCards(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `
        <div class="skeleton-card">
          <div class="skeleton-thumb"></div>
          <div class="skeleton-info">
            <div class="skeleton-line short"></div>
            <div class="skeleton-line medium"></div>
            <div class="skeleton-teams">
              <div class="skeleton-team-block">
                <div class="skeleton-flag"></div>
                <div class="skeleton-name"></div>
              </div>
              <span class="skeleton-vs">VS</span>
              <div class="skeleton-team-block">
                <div class="skeleton-flag"></div>
                <div class="skeleton-name"></div>
              </div>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:0.3rem;">
              <div class="skeleton-line" style="width:30%;"></div>
              <div class="skeleton-line" style="width:25%;"></div>
            </div>
          </div>
        </div>
      `;
    }
    return html;
  }

  // ---- EXTRACT M3U8 URL FROM AUTO_STREAMS ----
  function extractM3U8Url(match) {
    // Check auto_streams first
    if (match.auto_streams && match.auto_streams.length > 0) {
      const stream = match.auto_streams[0];
      if (stream && stream.auto) {
        // Parse the m3u8 playlist to get the 1080p or highest quality stream
        const lines = stream.auto.split('\n');
        let highestQuality = '';
        let highestBandwidth = 0;
        
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('#EXT-X-STREAM-INF')) {
            // Extract bandwidth
            const bandwidthMatch = lines[i].match(/BANDWIDTH=(\d+)/);
            if (bandwidthMatch) {
              const bandwidth = parseInt(bandwidthMatch[1]);
              // Look for 1080p or highest bandwidth
              if (lines[i].includes('RESOLUTION=1920x1080') || bandwidth > highestBandwidth) {
                highestBandwidth = bandwidth;
                // Next line should be the URL
                if (i + 1 < lines.length && !lines[i + 1].startsWith('#')) {
                  highestQuality = lines[i + 1];
                }
              }
            }
          }
        }
        
        // If no 1080p found, use the last URL in the playlist
        if (!highestQuality) {
          for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i] && !lines[i].startsWith('#') && lines[i].includes('.m3u8')) {
              highestQuality = lines[i];
              break;
            }
          }
        }
        
        // Add cookies if available
        if (highestQuality) {
          let url = highestQuality;
          // If the URL doesn't have parameters, add the cookie
          if (!url.includes('?')) {
            url += '?' + (stream.cookie || '');
          }
          return url;
        }
      }
    }
    
    // Check STREAMING_CDN for Primary_Playback_URL
    if (match.STREAMING_CDN && match.STREAMING_CDN.Primary_Playback_URL) {
      return match.STREAMING_CDN.Primary_Playback_URL;
    }
    
    return null;
  }

  // ---- PLAY M3U8 STREAM ----
  function playM3U8Stream(url, matchTitle) {
    if (!url) {
      alert('No stream available for this match');
      return;
    }
    
    // Encode the URL and navigate to the player page
    const encodedUrl = encodeURIComponent(url);
    const matchName = encodeURIComponent(matchTitle || 'Live Match');
    
    // Navigate to the player page with the m3u8 URL
    window.location.href = `/fc-play?url=${encodedUrl}&title=${matchName}`;
  }

  // ---- RENDER MATCH CARDS ----
  function renderMatches(matchData) {
    if (!matchData || matchData.length === 0) {
      track.innerHTML = `
        <div style="color: rgba(255,255,255,0.3); padding: 2rem; text-align: center; width: 100%;">
          No matches available
        </div>
      `;
      return;
    }

    let html = '';
    matchData.forEach(match => {
      // Get team info safely
      const team1 = match.team && match.team[0] ? match.team[0] : { name: 'Team 1', shortName: 'T1', flag: { src: '' } };
      const team2 = match.team && match.team[1] ? match.team[1] : { name: 'Team 2', shortName: 'T2', flag: { src: '' } };
      
      // Get image (prefer APP image, fallback to image, then CDN)
      const imageUrl = match.image_cdn?.APP || match.image || match.image_cdn?.BG_IMAGE || '';
      
      // Format status
      let statusText = match.status || 'UPCOMING';
      const isLive = statusText === 'LIVE' || statusText === 'IN_PROGRESS';
      const isEnded = statusText === 'ENDED' || statusText === 'FINISHED' || statusText === 'COMPLETED';
      
      statusText = statusText.replace(/_/g, ' ').toLowerCase();
      statusText = statusText.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      
      // Get status class for styling
      let statusClass = 'upcoming';
      if (isLive) statusClass = 'live';
      if (isEnded) statusClass = 'ended';

      // Get team scores (for cricket)
      let team1Score = '';
      let team2Score = '';
      if (match.category === 'Cricket' && team1.cricketScore && team1.cricketScore.length > 0) {
        const score = team1.cricketScore[0];
        if (score.runs !== undefined && score.wickets !== undefined) {
          team1Score = `${score.runs}/${score.wickets}`;
          if (score.overs && score.overs !== '0') {
            team1Score += ` (${score.overs})`;
          }
        }
      }
      if (match.category === 'Cricket' && team2.cricketScore && team2.cricketScore.length > 0) {
        const score = team2.cricketScore[0];
        if (score.runs !== undefined && score.wickets !== undefined) {
          team2Score = `${score.runs}/${score.wickets}`;
          if (score.overs && score.overs !== '0') {
            team2Score += ` (${score.overs})`;
          }
        }
      }

      // Get M3U8 URL
      const m3u8Url = extractM3U8Url(match);
      const hasStream = !!m3u8Url;

      html += `
        <div class="fancode-card" data-match-id="${match.match_id || ''}" data-m3u8="${m3u8Url || ''}" data-title="${match.title || match.tournament || 'Live Match'}">
          <div class="fancode-thumb">
            <img 
              src="${imageUrl}" 
              alt="${team1.name} vs ${team2.name}"
              loading="lazy"
              onerror="this.src='https://via.placeholder.com/400x225/1a1c1e/555?text=No+Image'"
            />
            <span class="fancode-category-tag">${match.category || 'Sports'}</span>
            ${isLive ? '<span style="position:absolute;top:10px;right:10px;background:rgba(255,0,0,0.8);color:#fff;padding:0.15rem 0.5rem;border-radius:4px;font-size:0.6rem;font-weight:700;text-transform:uppercase;z-index:2;animation:pulse-live 1.5s ease-in-out infinite;">● LIVE</span>' : ''}
          </div>
          <div class="fancode-info">
            <div class="fancode-tournament">${match.tournament || 'Match'}</div>
            <div class="fancode-teams">
              <div class="fancode-team">
                <img src="${team1.flag?.src || ''}" alt="${team1.name}" onerror="this.style.display='none'" />
                <span>${team1.shortName || team1.name}</span>
                ${team1Score ? `<span style="font-size:0.7rem;color:#f5c518;margin-left:0.2rem;">${team1Score}</span>` : ''}
              </div>
              <span class="fancode-vs">VS</span>
              <div class="fancode-team">
                <img src="${team2.flag?.src || ''}" alt="${team2.name}" onerror="this.style.display='none'" />
                <span>${team2.shortName || team2.name}</span>
                ${team2Score ? `<span style="font-size:0.7rem;color:#f5c518;margin-left:0.2rem;">${team2Score}</span>` : ''}
              </div>
            </div>
            <div class="fancode-meta">
              <div class="fancode-meta-left">
                <span class="fancode-status ${statusClass}">${statusText}</span>
                ${match.language && match.language !== 'BLOODY_SWEET' ? `<span style="font-size:0.55rem;color:rgba(255,255,255,0.3);text-transform:uppercase;">${match.language}</span>` : ''}
              </div>
              <span class="fancode-time">${match.startTime || ''}</span>
            </div>
            ${hasStream ? '<div style="font-size:0.5rem;color:rgba(0,255,100,0.4);text-align:right;margin-top:0.2rem;letter-spacing:0.03em;">▶ STREAM AVAILABLE</div>' : ''}
          </div>
        </div>
      `;
    });

    track.innerHTML = html;
    updateBadge(matchData.length);
  }

  // ---- UPDATE BADGE ----
  function updateBadge(count) {
    if (badge) {
      const liveCount = matches.filter(m => m.status === 'LIVE' || m.status === 'IN_PROGRESS').length;
      const total = count || matches.length;
      badge.textContent = liveCount > 0 ? `🔴 ${liveCount} live · ${total} matches` : `🏏 ${total} matches`;
    }
  }

  // ---- FETCH DATA ----
  async function fetchFancodeData() {
    if (isLoading) return;
    isLoading = true;

    try {
      // Show skeletons
      track.innerHTML = createSkeletonCards(SKELETON_COUNT);

      const response = await fetch(FANCODE_API_URL);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      
      // Extract matches array
      matches = data.matches || data || [];
      
      // Filter matches that have team data
      matches = matches.filter(m => m.team && m.team.length >= 2);
      
      // Sort: LIVE first, then UPCOMING
      matches.sort((a, b) => {
        const aLive = a.status === 'LIVE' || a.status === 'IN_PROGRESS' ? 0 : 1;
        const bLive = b.status === 'LIVE' || b.status === 'IN_PROGRESS' ? 0 : 1;
        return aLive - bLive;
      });
      
      // Render cards
      renderMatches(matches);

    } catch (error) {
      console.error('FanCode fetch error:', error);
      track.innerHTML = `
        <div style="color: rgba(255,255,255,0.4); padding: 2rem; text-align: center; width: 100%;">
          ⚠️ Failed to load matches
        </div>
      `;
    } finally {
      isLoading = false;
    }
  }

  // ---- SCROLL FUNCTIONS ----
  function scrollAmount() {
    const card = track.querySelector('.fancode-card, .skeleton-card');
    if (!card) return 280;
    const cardWidth = card.getBoundingClientRect().width;
    const gap = 20;
    return (cardWidth + gap) * 2;
  }

  function scrollLeft() {
    track.scrollBy({ left: -scrollAmount(), behavior: 'smooth' });
  }

  function scrollRight() {
    track.scrollBy({ left: scrollAmount(), behavior: 'smooth' });
  }

  // ---- CARD CLICK HANDLER ----
  function handleCardClick(e) {
    const card = e.target.closest('.fancode-card');
    if (!card) return;
    
    const m3u8Url = card.dataset.m3u8;
    const title = card.dataset.title || 'Live Match';
    
    if (m3u8Url) {
      e.preventDefault();
      playM3U8Stream(m3u8Url, title);
    } else {
      e.preventDefault();
      alert('No stream available for this match');
    }
  }

  // ---- INTERSECTION OBSERVER (load on scroll) ----
  function initLazyLoad() {
    const section = document.getElementById('fancodeSection');
    if (!section) return;

    // Check if already visible
    const rect = section.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
      fetchFancodeData();
      return;
    }

    // Otherwise observe
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          fetchFancodeData();
          observer.disconnect();
        }
      });
    }, { rootMargin: '200px' });

    observer.observe(section);
  }

  // ---- KEYBOARD NAVIGATION ----
  function handleKeydown(e) {
    if (e.key === 'ArrowLeft') scrollLeft();
    if (e.key === 'ArrowRight') scrollRight();
  }

  // ---- INIT ----
  function init() {
    // Set up event listeners
    if (arrowLeft) arrowLeft.addEventListener('click', scrollLeft);
    if (arrowRight) arrowRight.addEventListener('click', scrollRight);
    if (track) {
      track.addEventListener('click', handleCardClick);
      track.addEventListener('keydown', handleKeydown);
      track.setAttribute('tabindex', '0');
    }

    // Start lazy load
    initLazyLoad();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
