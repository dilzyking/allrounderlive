// fancode.js - FanCode Section with Skeleton Loading

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
      statusText = statusText.replace(/_/g, ' ').toLowerCase();
      statusText = statusText.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

      html += `
        <a href="#" class="fancode-card" data-match-id="${match.match_id || ''}">
          <div class="fancode-thumb">
            <img 
              src="${imageUrl}" 
              alt="${team1.name} vs ${team2.name}"
              loading="lazy"
              onerror="this.src='https://via.placeholder.com/400x225/1a1c1e/555?text=No+Image'"
            />
            <span class="fancode-category-tag">${match.category || 'Sports'}</span>
          </div>
          <div class="fancode-info">
            <div class="fancode-tournament">${match.tournament || 'Match'}</div>
            <div class="fancode-teams">
              <div class="fancode-team">
                <img src="${team1.flag?.src || ''}" alt="${team1.name}" onerror="this.style.display='none'" />
                <span>${team1.shortName || team1.name}</span>
              </div>
              <span class="fancode-vs">VS</span>
              <div class="fancode-team">
                <img src="${team2.flag?.src || ''}" alt="${team2.name}" onerror="this.style.display='none'" />
                <span>${team2.shortName || team2.name}</span>
              </div>
            </div>
            <div class="fancode-meta">
              <span class="fancode-status">${statusText}</span>
              <span class="fancode-time">${match.startTime || ''}</span>
            </div>
          </div>
        </a>
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
      
      // Extract matches array (could be in data.matches or data directly)
      matches = data.matches || data || [];
      
      // Filter matches that have team data
      matches = matches.filter(m => m.team && m.team.length >= 2);
      
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
    const gap = 20; // gap from CSS
    return (cardWidth + gap) * 2;
  }

  function scrollLeft() {
    track.scrollBy({ left: -scrollAmount(), behavior: 'smooth' });
  }

  function scrollRight() {
    track.scrollBy({ left: scrollAmount(), behavior: 'smooth' });
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

  // ---- CARD CLICK HANDLER ----
  function handleCardClick(e) {
    const card = e.target.closest('.fancode-card');
    if (!card) return;
    e.preventDefault();
    const matchId = card.dataset.matchId;
    if (matchId) {
      console.log(`FanCode: Match ${matchId} clicked`);
      // Replace with actual navigation
      window.location.href = `/live/match-${matchId}.html`;
    }
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
    if (track) track.addEventListener('click', handleCardClick);
    
    // Keyboard navigation (only when track is focused)
    if (track) track.addEventListener('keydown', handleKeydown);
    if (track) track.setAttribute('tabindex', '0');

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
