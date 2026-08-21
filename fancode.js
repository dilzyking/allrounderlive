// fancode.js - FanCode Section with Dual JSON Fetch

(function() {
  'use strict';

  // Configuration
  const PREVIOUS_API_URL = 'https://raw.githubusercontent.com/doctor-8trange/zyphx8/refs/heads/main/data/fancode.json';
  const NEW_API_URL = 'https://raw.githubusercontent.com/drmlive/fancode-live-events/refs/heads/main/fancode.json';
  const SKELETON_COUNT = 6;

  // DOM elements
  const track = document.getElementById('fancodeTrack');
  const arrowLeft = document.getElementById('fancodeArrowLeft');
  const arrowRight = document.getElementById('fancodeArrowRight');

  // State
  let isLoading = false;
  let matches = [];
  let streamUrls = {}; // Store M3U8 URLs by match_id

  // ---- SKELETON GENERATOR ----
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

  // ---- FETCH BOTH JSONS AND MERGE ----
  async function fetchFancodeData() {
    if (isLoading) return;
    isLoading = true;

    try {
      track.innerHTML = createSkeletonCards(SKELETON_COUNT);

      // Fetch both JSONs in parallel
      const [prevResponse, newResponse] = await Promise.all([
        fetch(PREVIOUS_API_URL),
        fetch(NEW_API_URL)
      ]);

      if (!prevResponse.ok) throw new Error('Failed to fetch previous data');
      if (!newResponse.ok) throw new Error('Failed to fetch stream data');

      const prevData = await prevResponse.json();
      const newData = await newResponse.json();

      // Extract matches from previous JSON
      const prevMatches = prevData.matches || prevData || [];
      
      // Extract matches from new JSON and build stream URL map
      const newMatches = newData.matches || newData || [];
      
      // Build a map of match_id -> M3U8 URL from new JSON
      const streamMap = {};
      newMatches.forEach(match => {
        if (match.match_id) {
          // Prefer dai_url, fallback to adfree_url
          const url = match.dai_url || match.adfree_url || null;
          if (url) {
            streamMap[match.match_id] = url;
            console.log(`Found stream for match ${match.match_id}:`, url);
          }
        }
      });

      console.log(`Found ${Object.keys(streamMap).length} streams from new JSON`);
      console.log(`Found ${prevMatches.length} matches from previous JSON`);

      // Merge: Add stream URL to previous matches
      const mergedMatches = prevMatches
        .filter(m => m.team && m.team.length >= 2) // Only matches with teams
        .map(m => {
          const matchId = m.match_id;
          // Add stream URL if available
          if (streamMap[matchId]) {
            m._streamUrl = streamMap[matchId];
          } else {
            // Try to find by title match if match_id doesn't match
            const matchTitle = m.title || '';
            const newMatch = newMatches.find(nm => {
              const nmTitle = nm.match_name || nm.title || '';
              return nmTitle.includes(matchTitle) || matchTitle.includes(nmTitle);
            });
            if (newMatch) {
              m._streamUrl = newMatch.dai_url || newMatch.adfree_url || null;
            }
          }
          return m;
        });

      matches = mergedMatches;

      // Sort: LIVE first
      matches.sort((a, b) => {
        const aLive = a.status === 'LIVE' || a.status === 'IN_PROGRESS' ? 0 : 1;
        const bLive = b.status === 'LIVE' || b.status === 'IN_PROGRESS' ? 0 : 1;
        return aLive - bLive;
      });

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
      // Get team info from previous JSON structure
      const team1 = match.team && match.team[0] ? match.team[0] : { name: 'Team 1', shortName: 'T1', flag: { src: '' } };
      const team2 = match.team && match.team[1] ? match.team[1] : { name: 'Team 2', shortName: 'T2', flag: { src: '' } };
      
      // Get image from previous JSON
      const imageUrl = match.image_cdn?.APP || match.image || match.image_cdn?.BG_IMAGE || '';
      
      // Format status
      let statusText = match.status || 'UPCOMING';
      const isLive = statusText === 'LIVE' || statusText === 'IN_PROGRESS';
      const isEnded = statusText === 'ENDED' || statusText === 'FINISHED' || statusText === 'COMPLETED';
      
      statusText = statusText.replace(/_/g, ' ').toLowerCase();
      statusText = statusText.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      
      let statusClass = 'upcoming';
      if (isLive) statusClass = 'live';
      if (isEnded) statusClass = 'ended';

      // Get team scores from previous JSON
      let team1Score = '';
      let team2Score = '';
      if (match.category === 'Cricket') {
        if (team1.cricketScore && team1.cricketScore.length > 0) {
          const score = team1.cricketScore[0];
          if (score.runs !== undefined && score.wickets !== undefined) {
            team1Score = `${score.runs}/${score.wickets}`;
            if (score.overs && score.overs !== '0') {
              team1Score += ` (${score.overs})`;
            }
          }
        }
        if (team2.cricketScore && team2.cricketScore.length > 0) {
          const score = team2.cricketScore[0];
          if (score.runs !== undefined && score.wickets !== undefined) {
            team2Score = `${score.runs}/${score.wickets}`;
            if (score.overs && score.overs !== '0') {
              team2Score += ` (${score.overs})`;
            }
          }
        }
      }

      // Check if stream exists (from new JSON)
      const hasStream = !!(match._streamUrl);

      html += `
        <div class="fancode-card" data-match-id="${match.match_id || ''}" data-stream-url="${match._streamUrl || ''}" data-title="${match.title || match.tournament || 'Live Match'}">
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
            ${hasStream ? '<div style="font-size:0.5rem;color:rgba(0,255,100,0.4);text-align:right;margin-top:0.2rem;letter-spacing:0.03em;">▶ CLICK TO PLAY</div>' : '<div style="font-size:0.5rem;color:rgba(255,0,0,0.2);text-align:right;margin-top:0.2rem;">NO STREAM</div>'}
          </div>
        </div>
      `;
    });

    track.innerHTML = html;
  }

  // ---- PLAY M3U8 STREAM ----
  async function playM3U8Stream(matchId, matchTitle, streamUrl) {
    if (!matchId) {
      alert('No match ID available');
      return;
    }

    // If we already have the stream URL, use it directly
    if (streamUrl) {
      console.log('Using cached stream URL:', streamUrl);
      const encodedUrl = encodeURIComponent(streamUrl);
      const matchName = encodeURIComponent(matchTitle || 'Live Match');
      window.location.href = `/fc-play?url=${encodedUrl}&title=${matchName}&match_id=${matchId}`;
      return;
    }

    // Otherwise, fetch fresh from new JSON
    try {
      const response = await fetch(NEW_API_URL);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      const allMatches = data.matches || data || [];
      const match = allMatches.find(m => m.match_id == matchId);
      
      if (!match) {
        alert('Match data not found. Please try again.');
        return;
      }

      const m3u8Url = match.dai_url || match.adfree_url || null;
      
      if (!m3u8Url) {
        alert('No stream available for this match');
        return;
      }

      const encodedUrl = encodeURIComponent(m3u8Url);
      const matchName = encodeURIComponent(matchTitle || match.match_name || 'Live Match');
      
      console.log('Navigating to player with URL:', m3u8Url);
      window.location.href = `/fc-play?url=${encodedUrl}&title=${matchName}&match_id=${matchId}`;

    } catch (error) {
      console.error('Error playing stream:', error);
      alert('Failed to load stream. Please try again.');
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
    
    const matchId = card.dataset.matchId;
    const title = card.dataset.title || 'Live Match';
    const streamUrl = card.dataset.streamUrl || '';
    
    if (matchId) {
      e.preventDefault();
      e.stopPropagation();
      playM3U8Stream(matchId, title, streamUrl);
    } else {
      e.preventDefault();
      alert('Invalid match');
    }
  }

  // ---- INTERSECTION OBSERVER ----
  function initLazyLoad() {
    const section = document.getElementById('fancodeSection');
    if (!section) return;

    const rect = section.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
      fetchFancodeData();
      return;
    }

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
    if (arrowLeft) arrowLeft.addEventListener('click', scrollLeft);
    if (arrowRight) arrowRight.addEventListener('click', scrollRight);
    if (track) {
      track.addEventListener('click', handleCardClick);
      track.addEventListener('keydown', handleKeydown);
      track.setAttribute('tabindex', '0');
    }

    initLazyLoad();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
