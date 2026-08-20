// fancode.js - FanCode Section with Improved M3U8 Extraction

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

  // ---- EXTRACT M3U8 URL FROM MATCH DATA (IMPROVED) ----
  function extractM3U8Url(match) {
    console.log('Extracting M3U8 for match:', match.title, 'ID:', match.match_id);
    
    // METHOD 1: Check auto_streams (MOST RELIABLE)
    if (match.auto_streams && match.auto_streams.length > 0) {
      console.log('Found auto_streams, count:', match.auto_streams.length);
      
      // Try all streams (different languages)
      for (let streamIndex = 0; streamIndex < match.auto_streams.length; streamIndex++) {
        const stream = match.auto_streams[streamIndex];
        if (stream && stream.auto) {
          console.log(`Processing stream ${streamIndex}, language:`, stream.language || 'unknown');
          
          // Parse the m3u8 playlist
          const lines = stream.auto.split('\n');
          let highestQuality = '';
          let highestBandwidth = 0;
          let allUrls = [];
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('#EXT-X-STREAM-INF')) {
              // Extract bandwidth
              const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
              const resolutionMatch = line.match(/RESOLUTION=(\d+)x(\d+)/);
              
              if (bandwidthMatch) {
                const bandwidth = parseInt(bandwidthMatch[1]);
                
                // Check if next line is a URL (not a comment)
                if (i + 1 < lines.length && !lines[i + 1].startsWith('#')) {
                  const url = lines[i + 1];
                  allUrls.push({ bandwidth, resolution: resolutionMatch ? `${resolutionMatch[1]}x${resolutionMatch[2]}` : 'unknown', url });
                  
                  // Prefer 1080p or highest bandwidth
                  if (resolutionMatch && resolutionMatch[1] === '1920') {
                    highestQuality = url;
                    highestBandwidth = bandwidth;
                  } else if (!highestQuality || bandwidth > highestBandwidth) {
                    highestQuality = url;
                    highestBandwidth = bandwidth;
                  }
                }
              }
            }
          }
          
          console.log(`Found ${allUrls.length} quality options for stream ${streamIndex}`);
          console.log('Selected URL:', highestQuality);
          
          // If we found a URL, add cookie and return
          if (highestQuality) {
            let url = highestQuality;
            
            // If URL is relative, construct full URL
            if (url.startsWith('http')) {
              // Already full URL
            } else if (url.startsWith('/')) {
              // Relative path - use base URL from first line
              const baseUrl = lines.find(l => l.startsWith('http'));
              if (baseUrl) {
                const baseParts = baseUrl.split('/');
                baseParts.pop(); // Remove the last part (filename)
                url = baseParts.join('/') + '/' + url;
              }
            } else {
              // Could be relative, try to construct from the master URL
              // Look for a full URL in the playlist
              const fullUrl = lines.find(l => l.startsWith('http'));
              if (fullUrl) {
                const baseParts = fullUrl.split('/');
                baseParts.pop(); // Remove the last part
                url = baseParts.join('/') + '/' + url;
              }
            }
            
            // Add cookie parameters if available
            if (stream.cookie) {
              if (url.includes('?')) {
                url += '&' + stream.cookie;
              } else {
                url += '?' + stream.cookie;
              }
            }
            
            console.log('Final M3U8 URL:', url);
            return url;
          }
        }
      }
    }
    
    // METHOD 2: Check STREAMING_CDN
    if (match.STREAMING_CDN) {
      console.log('Checking STREAMING_CDN');
      
      // Try Primary_Playback_URL
      if (match.STREAMING_CDN.Primary_Playback_URL) {
        console.log('Found Primary_Playback_URL:', match.STREAMING_CDN.Primary_Playback_URL);
        return match.STREAMING_CDN.Primary_Playback_URL;
      }
      
      // Try fancode_cdn
      if (match.STREAMING_CDN.fancode_cdn) {
        console.log('Found fancode_cdn:', match.STREAMING_CDN.fancode_cdn);
        return match.STREAMING_CDN.fancode_cdn;
      }
      
      // Try backup CDN
      if (match.STREAMING_CDN.backup) {
        if (match.STREAMING_CDN.backup.fancode_cdn) {
          console.log('Found backup fancode_cdn:', match.STREAMING_CDN.backup.fancode_cdn);
          return match.STREAMING_CDN.backup.fancode_cdn;
        }
        if (match.STREAMING_CDN.backup.fancode_cdn_v1) {
          console.log('Found backup fancode_cdn_v1:', match.STREAMING_CDN.backup.fancode_cdn_v1);
          return match.STREAMING_CDN.backup.fancode_cdn_v1;
        }
      }
    }
    
    console.log('No M3U8 URL found for match:', match.title);
    return null;
  }

  // ---- FETCH FRESH DATA FOR A SPECIFIC MATCH ----
  async function fetchFreshMatchData(matchId) {
    try {
      console.log('Fetching fresh data for match ID:', matchId);
      const response = await fetch(FANCODE_API_URL);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      const allMatches = data.matches || data || [];
      
      // Find the specific match
      const match = allMatches.find(m => m.match_id == matchId);
      if (!match) {
        console.log('Match not found in fresh data');
        return null;
      }
      
      console.log('Found fresh match data:', match.title);
      return match;
    } catch (error) {
      console.error('Error fetching fresh match data:', error);
      return null;
    }
  }

  // ---- PLAY M3U8 STREAM WITH FRESH FETCH ----
  async function playM3U8Stream(matchId, matchTitle) {
    if (!matchId) {
      alert('No match ID available');
      return;
    }

    // Show loading indicator on the clicked card
    const card = document.querySelector(`.fancode-card[data-match-id="${matchId}"]`);
    let originalHTML = '';
    if (card) {
      originalHTML = card.innerHTML;
      card.style.opacity = '0.5';
      card.style.pointerEvents = 'none';
      card.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;padding:2rem;flex-direction:column;gap:0.5rem;min-height:200px;">
          <div style="width:30px;height:30px;border:3px solid rgba(255,255,255,0.1);border-top-color:#f5c518;border-radius:50%;animation:spin 1s ease-in-out infinite;"></div>
          <span style="color:rgba(255,255,255,0.6);font-size:0.8rem;">Loading stream...</span>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
    }

    try {
      // Fetch fresh data
      const match = await fetchFreshMatchData(matchId);
      
      if (!match) {
        alert('Match data not found. Please try again.');
        if (card) {
          card.style.opacity = '1';
          card.style.pointerEvents = 'auto';
          card.innerHTML = originalHTML;
        }
        return;
      }

      // Extract M3U8 URL from fresh data
      const m3u8Url = extractM3U8Url(match);
      
      if (!m3u8Url) {
        alert('No stream available for this match');
        if (card) {
          card.style.opacity = '1';
          card.style.pointerEvents = 'auto';
          card.innerHTML = originalHTML;
        }
        return;
      }

      // Encode and navigate
      const encodedUrl = encodeURIComponent(m3u8Url);
      const matchName = encodeURIComponent(matchTitle || match.title || match.tournament || 'Live Match');
      
      console.log('Navigating to player with URL:', m3u8Url);
      console.log('Match:', matchName);
      
      // Navigate to player
      window.location.href = `/fc-play?url=${encodedUrl}&title=${matchName}&match_id=${matchId}`;

    } catch (error) {
      console.error('Error playing stream:', error);
      alert('Failed to load stream. Please try again.');
      if (card) {
        card.style.opacity = '1';
        card.style.pointerEvents = 'auto';
        card.innerHTML = originalHTML;
      }
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
      // Get team info safely
      const team1 = match.team && match.team[0] ? match.team[0] : { name: 'Team 1', shortName: 'T1', flag: { src: '' } };
      const team2 = match.team && match.team[1] ? match.team[1] : { name: 'Team 2', shortName: 'T2', flag: { src: '' } };
      
      // Get image
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

      // Get team scores
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
      const hasStream = !!(match.auto_streams?.length > 0 || match.STREAMING_CDN?.Primary_Playback_URL);

      html += `
        <div class="fancode-card" data-match-id="${match.match_id || ''}" data-title="${match.title || match.tournament || 'Live Match'}">
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
      track.innerHTML = createSkeletonCards(SKELETON_COUNT);

      const response = await fetch(FANCODE_API_URL);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      
      matches = data.matches || data || [];
      matches = matches.filter(m => m.team && m.team.length >= 2);
      
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
    
    if (matchId) {
      e.preventDefault();
      e.stopPropagation();
      playM3U8Stream(matchId, title);
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
