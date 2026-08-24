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
  let newMatchesCache = []; // Cache the new JSON data

  function createSkeletonCards(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `
        <div class="fancode-card fc-skeleton-card">
          <div class="fc-skeleton-thumb"></div>
          <div class="fc-skeleton-info">
            <div class="fc-skeleton-line short"></div>
            <div class="fc-skeleton-line medium"></div>
            <div class="fc-skeleton-teams">
              <div class="fc-skeleton-team-block">
                <div class="fc-skeleton-flag"></div>
                <div class="fc-skeleton-name"></div>
              </div>
              <span class="fc-skeleton-vs">VS</span>
              <div class="fc-skeleton-team-block">
                <div class="fc-skeleton-flag"></div>
                <div class="fc-skeleton-name"></div>
              </div>
            </div>
            <div class="fc-skeleton-meta">
              <div class="fc-skeleton-badge"></div>
              <div class="fc-skeleton-time"></div>
            </div>
          </div>
        </div>
      `;
    }
    return html;
  }

  // Helper function to extract base match ID (remove language suffix)
  function getBaseMatchId(matchId) {
    if (!matchId) return '';
    let baseId = String(matchId);
    // If contains underscore, take the part before it
    if (baseId.includes('_')) {
      baseId = baseId.split('_')[0];
    }
    return baseId;
  }

  // Helper to check if two match titles match
  function titlesMatch(title1, title2) {
    if (!title1 || !title2) return false;
    const t1 = title1.toLowerCase().trim();
    const t2 = title2.toLowerCase().trim();
    // Check if one contains the other
    if (t1.includes(t2) || t2.includes(t1)) return true;
    // Check if they share significant words (at least 2 words)
    const words1 = t1.split(' ').filter(w => w.length > 3);
    const words2 = t2.split(' ').filter(w => w.length > 3);
    let matchCount = 0;
    for (const w1 of words1) {
      for (const w2 of words2) {
        if (w1 === w2 || w1.includes(w2) || w2.includes(w1)) {
          matchCount++;
          if (matchCount >= 2) return true;
        }
      }
    }
    return false;
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

      // Store new matches in cache for later use
      newMatchesCache = newData.matches || newData || [];
      
      // Extract matches from previous JSON
      const prevMatches = prevData.matches || prevData || [];
      
      // Build a map of match_id -> M3U8 URL from new JSON
      const streamMap = {};
      newMatchesCache.forEach(match => {
        if (match.match_id) {
          const matchIdStr = String(match.match_id);
          const url = match.dai_url || match.adfree_url || null;
          if (url) {
            streamMap[matchIdStr] = url;
            console.log(`Found stream for match ID: ${matchIdStr}`);
          }
        }
      });

      console.log(`Found ${Object.keys(streamMap).length} streams from new JSON`);
      console.log(`Found ${prevMatches.length} matches from previous JSON`);

      // Merge: Add stream URL to previous matches
      const mergedMatches = prevMatches
        .filter(m => m.team && m.team.length >= 2)
        .map(m => {
          const fullMatchId = String(m.match_id || '');
          const baseMatchId = getBaseMatchId(fullMatchId);
          
          // Try to find stream using base match ID
          let foundStream = null;
          
          // Method 1: Direct match by base ID
          if (streamMap[baseMatchId]) {
            foundStream = streamMap[baseMatchId];
            console.log(`✅ Matched by ID: ${fullMatchId} -> ${baseMatchId}`);
          } else {
            // Method 2: Try to find by title match
            const matchTitle = m.title || m.match_name || '';
            const matchTeams = m.team.map(t => t.name || '').join(' ');
            const searchText = (matchTitle + ' ' + matchTeams).toLowerCase();
            
            for (const nm of newMatchesCache) {
              const nmTitle = (nm.match_name || nm.title || '').toLowerCase();
              const nmTeams = (nm.team_1 + ' ' + nm.team_2 || '').toLowerCase();
              const nmSearchText = nmTitle + ' ' + nmTeams;
              
              // Check if titles match
              if (titlesMatch(searchText, nmSearchText)) {
                foundStream = nm.dai_url || nm.adfree_url || null;
                if (foundStream) {
                  console.log(`✅ Matched by title: "${matchTitle}" -> "${nm.match_name || nm.title}"`);
                  break;
                }
              }
            }
          }
          
          if (foundStream) {
            m._streamUrl = foundStream;
          } else {
            console.log(`❌ No stream found for: ${fullMatchId} - ${m.title || ''}`);
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
          ⚠️ Failed to load matches: ${error.message}
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

      // Check if stream exists
      const hasStream = !!(match._streamUrl);

      // Get the base match ID for the data attribute
      const baseMatchId = getBaseMatchId(match.match_id);

      html += `
        <div class="fancode-card" data-match-id="${baseMatchId}" data-full-match-id="${match.match_id || ''}" data-stream-url="${match._streamUrl || ''}" data-title="${match.title || match.tournament || 'Live Match'}">
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
            <div class="fancode-tournament">${match.tournament || match.event_name || 'Match'}</div>
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
    console.log('🔍 Playing stream for:', { matchId, matchTitle, streamUrl });
    
    if (!matchId) {
      alert('No match ID available');
      return;
    }

    // If we already have the stream URL, use it directly
    if (streamUrl && streamUrl.includes('m3u8')) {
      console.log('✅ Using cached stream URL:', streamUrl);
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
      
      // Extract base match ID
      const baseMatchId = getBaseMatchId(matchId);
      console.log(`🔍 Looking for match with base ID: ${baseMatchId}`);
      
      // Method 1: Try to find match by base ID
      let match = allMatches.find(m => String(m.match_id) === baseMatchId);
      
      if (match) {
        console.log(`✅ Found match by ID: ${match.match_id}`);
      } else {
        // Method 2: Try to find by title
        console.log(`🔍 Trying to find by title: "${matchTitle}"`);
        match = allMatches.find(m => {
          const mTitle = (m.match_name || m.title || '').toLowerCase();
          const searchTitle = (matchTitle || '').toLowerCase();
          return mTitle.includes(searchTitle) || searchTitle.includes(mTitle);
        });
        if (match) {
          console.log(`✅ Found match by title: ${match.match_name || match.title}`);
        }
      }

      if (!match) {
        console.error('❌ Match not found in new JSON');
        alert('Match data not found. Please try again.');
        return;
      }

      const m3u8Url = match.dai_url || match.adfree_url || null;
      
      if (!m3u8Url) {
        console.error('❌ No stream URL found for match');
        alert('No stream available for this match');
        return;
      }

      console.log('✅ Found stream URL:', m3u8Url);
      const encodedUrl = encodeURIComponent(m3u8Url);
      const matchName = encodeURIComponent(matchTitle || match.match_name || 'Live Match');
      
      window.location.href = `/fc-play?url=${encodedUrl}&title=${matchName}&match_id=${matchId}`;

    } catch (error) {
      console.error('❌ Error playing stream:', error);
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
    
    const matchId = card.dataset.matchId || card.dataset.fullMatchId;
    const title = card.dataset.title || 'Live Match';
    const streamUrl = card.dataset.streamUrl || '';
    
    console.log('🖱️ Card clicked:', { matchId, title, streamUrl });
    
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
