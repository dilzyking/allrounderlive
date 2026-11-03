
/* =========================================================
   WILLOW LIVE
   API: https://willow-api.sayanwork-studioo.workers.dev/
   Player: willow-player.html?id=...
   Same card layout as Football / Cricket. Poster images only.
   Lazy API load when section is within 300px of viewport.
   Refresh every 5 minutes while near viewport and tab is active.
   ========================================================= */

(function bootWillow() {
  'use strict';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootWillow, {
      once: true
    });
    return;
  }

  const API = 'https://willow-api.sayanwork-studioo.workers.dev/';
  const REFRESH_INTERVAL = 300000;
  const SKELETON_COUNT = 4;

  const track = document.getElementById('willowLiveTrack');

  if (!track || track.dataset.initialized === 'true') return;

  track.dataset.initialized = 'true';

  const section = track.closest('.willow-live-section');
  const rail = track.closest('.live-rail');
  const prevBtn = document.getElementById('willowLiveArrowLeft');
  const nextBtn = document.getElementById('willowLiveArrowRight');
  const countEl = document.getElementById('liveCountBadge');

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  let loaded = false;
  let loading = false;
  let visible = false;
  let refreshTimer = null;
  let renderedCards = null;
  let arrowFrame = 0;

  // ---------- HELPERS ----------

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
  }

  function safeUrl(value) {
    if (typeof value !== 'string') return '';

    const url = value.trim();

    return /^https?:\/\//i.test(url) ? url : '';
  }

  function safeId(match) {
    return String(
      match.tvgId ||
      match.match_id ||
      match.tvgName ||
      match.title ||
      ''
    ).trim();
  }

  function getStatus(match) {
    return String(match.status || '')
      .trim()
      .toUpperCase();
  }

  // ---------- TEAM TITLE ----------

  function extractTeams(title) {
    const clean = String(title || 'Live Match')
      .replace(/^(?:LIVE:|HD:|Willow\s*)/i, '')
      .trim();

    const finalSegment =
      clean.split(/\s+[-–—]\s+/).pop() || clean;

    const match = finalSegment.match(
      /^(.+?)\s+(?:vs?\.?|versus)\s+(.+)$/i
    );

    return match
      ? `${match[1].trim()} vs ${match[2].trim()}`
      : finalSegment;
  }

  function extractTournament(title) {
    const parts = String(title || '')
      .split(/\s+[-–—]\s+/);

    return parts.length > 1
      ? parts[0].trim()
      : '';
  }

  // ---------- STREAM AVAILABILITY ----------

  function hasStreamValue(value) {
    if (safeUrl(value)) return true;

    if (value && typeof value === 'object') {
      return Object.values(value).some(hasStreamValue);
    }

    return false;
  }

  function getStreamUrlWithFallback(match) {
    return (
      hasStreamValue(match.stream_url_alpha) ||
      hasStreamValue(match.stream_url_bravo)
    );
  }

  // ---------- POSTER IMAGES ----------

  function getPosterCandidates(match) {
    return [...new Set([
      match.cover_image,
      match.tvgLogo,
      match.poster,
      match.poster_url,
      match.thumbnail,
      match.image
    ].map(safeUrl).filter(Boolean))];
  }

  // ---------- STATUS BADGES ----------

  function renderStatus(status) {
    if (status === 'LIVE') {
      return '<span class="badge">LIVE</span>';
    }

    return `
      <span
        class="wl-upcoming-icon"
        role="img"
        aria-label="Upcoming match"
        title="Upcoming match"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5-6.7V3a2 2 0 0 0-4 0v1.3A7 7 0 0 0 5 11v5l-2 2v1h18v-1z"/>
        </svg>
      </span>
    `;
  }

  // ---------- RENDER MATCH CARD ----------

  function renderCard(match) {
    const title = String(
      match.title ||
      match.tvgName ||
      'Unknown Match'
    );

    const status = getStatus(match);
    const id = safeId(match);

    const isLive = status === 'LIVE';

    const playable =
      isLive &&
      !!id &&
      getStreamUrlWithFallback(match);

    const teams = extractTeams(title);
    const tournament = extractTournament(title);

    const time = String(
      match.time ||
      (isLive ? 'Live now' : 'Upcoming')
    );

    const meta = [tournament, time]
      .filter(Boolean)
      .join(' · ');

    const posters = getPosterCandidates(match);

    const imageHTML = posters.length
      ? `
        <img
          src="${esc(posters[0])}"
          alt="${esc(title)}"
          loading="lazy"
          decoding="async"
          data-posters="${esc(JSON.stringify(posters))}"
          data-poster-index="0"
        >
      `
      : '<span class="wl-no-poster">Poster unavailable</span>';

    const playHTML = playable
      ? `
        <span class="wl-play" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M8 5 20 12 8 19Z"/>
          </svg>
        </span>
      `
      : '';

    // Only playable LIVE matches link to the player.

    const open = playable
      ? `<a class="card willow-live-card"
           href="willow-player.html?id=${encodeURIComponent(id)}"`
      : `<button class="card willow-live-card"
           type="button"
           data-message="${esc(
             isLive
               ? 'Stream not yet available for this match'
               : `This match is upcoming: ${time}`
           )}"`;

    const close = playable ? '</a>' : '</button>';

    return `
      ${open}
        aria-label="${esc(
          teams + ' — ' + (isLive ? 'Live' : 'Upcoming')
        )}"
      >
        <div class="thumb willow-live-thumb">
          ${imageHTML}
          ${renderStatus(status)}
          ${playHTML}
        </div>

        <div class="caption">
          <span title="${esc(teams)}">
            ${esc(teams)}
          </span>

          <span class="wl-meta" title="${esc(meta)}">
            ${esc(meta)}
          </span>
        </div>
      ${close}
    `;
  }

  // ---------- SKELETON LOADER ----------

  function showSkeleton() {
    track.innerHTML = Array.from(
      { length: SKELETON_COUNT },
      () => `
        <div class="card wl-skeleton-card" aria-hidden="true">
          <div class="thumb wl-skeleton-thumb"></div>

          <div class="caption">
            <div class="wl-skeleton-line"></div>
            <div class="wl-skeleton-line"></div>
          </div>
        </div>
      `
    ).join('');

    scheduleArrows();
  }

  // ---------- ARROW POSITION ----------

  function updateArrows() {
    if (!rail || !prevBtn) return;

    const thumb = track.querySelector('.thumb');

    if (!thumb) return;

    const top =
      thumb.getBoundingClientRect().height / 2 -
      prevBtn.getBoundingClientRect().height / 2;

    rail.style.setProperty(
      '--wl-arrow-top',
      Math.max(0, top) + 'px'
    );
  }

  function scheduleArrows() {
    if (arrowFrame) return;

    arrowFrame = requestAnimationFrame(() => {
      arrowFrame = 0;
      updateArrows();
    });
  }

  // ---------- FETCH API ----------

  async function loadMatches() {
    if (loading) return;

    loading = true;
    track.setAttribute('aria-busy', 'true');

    if (!loaded) showSkeleton();

    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      15000
    );

    try {
      const response = await fetch(API, {
        method: 'GET',
        cache: 'no-cache',
        headers: {
          Accept: 'application/json'
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.message || 'API error');
      }

      const all = data.Matches ?? data.streams;

      if (!Array.isArray(all)) {
        throw new Error('Invalid Willow API response');
      }

      const matches = all.filter(
        m => m && typeof m === 'object'
      );

      const live = matches.filter(
        m => getStatus(m) === 'LIVE'
      );

      const upcoming = matches.filter(
        m => getStatus(m) === 'UPCOMING'
      );

      // LIVE matches appear first.

      const ordered = [...live, ...upcoming];

      // ---------- LIVE COUNT ----------

      if (countEl) {
        const apiCount = Number(
          data.Stats?.LiveCount ?? data.liveCount
        );

        const count = Number.isFinite(apiCount)
          ? apiCount
          : live.length;

        countEl.textContent = `${count} LIVE`;
        countEl.hidden = count === 0;
      }

      // ---------- RENDER ONLY IF CHANGED ----------

      const nextCards = ordered.length
        ? ordered.map(renderCard).join('')
        : '<div class="wl-empty">No Willow matches available.</div>';

      if (nextCards !== renderedCards) {
        const left = track.scrollLeft;

        track.innerHTML = nextCards;
        track.scrollLeft = left;

        renderedCards = nextCards;
        scheduleArrows();
      }

      loaded = true;

    } catch (error) {
      console.error('[WillowLive]', error);

      if (!loaded) {
        track.innerHTML = `
          <div class="wl-empty">
            Unable to load Willow matches.

            <button
              class="wl-retry"
              type="button"
            >
              Retry
            </button>
          </div>
        `;
      }

    } finally {
      clearTimeout(timeout);

      loading = false;
      track.setAttribute('aria-busy', 'false');
    }
  }

  // ---------- CAROUSEL CONTROLS ----------

  function scrollByCard(direction) {
    const card = track.querySelector('.card');

    if (!card) return;

    const gap =
      parseFloat(
        getComputedStyle(track).columnGap
      ) || 0;

    track.scrollBy({
      left: direction * (card.offsetWidth + gap),
      behavior: reduced.matches ? 'auto' : 'smooth'
    });
  }

  prevBtn?.addEventListener('click', () => {
    scrollByCard(-1);
  });

  nextBtn?.addEventListener('click', () => {
    scrollByCard(1);
  });

  // ---------- CLICK HANDLING ----------

  track.addEventListener('click', event => {
    const retry = event.target.closest('.wl-retry');

    if (retry) {
      loadMatches();
      return;
    }

    const info = event.target.closest(
      'button.willow-live-card[data-message]'
    );

    if (info) {
      alert(info.dataset.message);
    }
  });

  // ---------- POSTER IMAGE FALLBACK ----------

  track.addEventListener('error', event => {
    const img = event.target;

    if (
      !(img instanceof HTMLImageElement) ||
      !img.matches('.willow-live-thumb img')
    ) {
      return;
    }

    let posters = [];

    try {
      posters = JSON.parse(
        img.dataset.posters || '[]'
      );
    } catch (_) {}

    const next =
      Number(img.dataset.posterIndex || 0) + 1;

    if (next < posters.length) {
      img.dataset.posterIndex = String(next);
      img.src = posters[next];
    } else {
      img.replaceWith(
        Object.assign(
          document.createElement('span'),
          {
            className: 'wl-no-poster',
            textContent: 'Poster unavailable'
          }
        )
      );
    }
  }, true);

  // ---------- VISIBLE-ONLY REFRESH ----------

  function stopRefresh() {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  function startRefresh() {
    if (
      refreshTimer ||
      !visible ||
      document.hidden
    ) {
      return;
    }

    refreshTimer = setInterval(() => {
      if (visible && !document.hidden) {
        loadMatches();
      }
    }, REFRESH_INTERVAL);
  }

  function handleVisibility(isVisible) {
    visible = isVisible;

    if (visible && !document.hidden) {
      if (!loaded) {
        loadMatches();
      }

      startRefresh();
      scheduleArrows();
    } else {
      stopRefresh();
    }
  }

  // ---------- PUBLIC HELPER ----------

  window.WillowLive = {
    reload: loadMatches
  };

  // ---------- RESIZE ----------

  if ('ResizeObserver' in window) {
    new ResizeObserver(
      scheduleArrows
    ).observe(track);
  }

  window.addEventListener(
    'resize',
    scheduleArrows,
    { passive: true }
  );

  // ---------- LAZY LOADING ----------

  if ('IntersectionObserver' in window && section) {
    const observer = new IntersectionObserver(
      entries => {
        handleVisibility(entries[0].isIntersecting);
      },
      {
        rootMargin: '300px 0px',
        threshold: 0
      }
    );

    observer.observe(section);
  } else {
    handleVisibility(true);
  }

  // ---------- PAGE VISIBILITY ----------

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopRefresh();
    } else if (visible) {
      loadMatches();
      startRefresh();
    }
  });

})();
