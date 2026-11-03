
/* =========================================================
   WORLD SPORTS — MATCHDEKHO

   API:
   https://matchdekho.in/api/world-sports.json

   Same card layout as FanCode / Willow / Cricket.
   Two-line captions.
   Lazy loading within 200px of viewport.
   ========================================================= */

(function bootWorldSports() {
  'use strict';

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      bootWorldSports,
      { once: true }
    );
    return;
  }

  // ---------- CONFIGURATION ----------

  const API_URL =
    'https://matchdekho.in/api/world-sports.json';

  const SKELETON_COUNT = 6;
  const MAX_MATCHES = 20;

  // ---------- DOM ELEMENTS ----------

  const track = document.getElementById(
    'worldSportsTrack'
  );

  if (
    !track ||
    track.dataset.initialized === 'true'
  ) {
    return;
  }

  track.dataset.initialized = 'true';

  const section = document.getElementById(
    'worldSportsSection'
  );

  const rail = track.closest('.live-rail');

  const prevBtn = document.getElementById(
    'worldSportsArrowLeft'
  );

  const nextBtn = document.getElementById(
    'worldSportsArrowRight'
  );

  const reduced = matchMedia(
    '(prefers-reduced-motion: reduce)'
  );

  // ---------- STATE ----------

  let loading = false;
  let arrowFrame = 0;

  // ---------- HELPERS ----------

  function esc(value) {
    return String(value ?? '').replace(
      /[&<>"']/g,
      char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[char]
    );
  }

  function safeUrl(value) {
    if (typeof value !== 'string') {
      return '';
    }

    const text = value.trim();

    if (!text || text === '#') {
      return '';
    }

    try {
      const url = new URL(
        text,
        document.baseURI
      );

      return ['http:', 'https:'].includes(
        url.protocol
      ) ? url.href : '';

    } catch {
      return '';
    }
  }

  // ---------- MATCH TITLE ----------

  function getMatchTitle(match) {
    const teamA =
      match.team_1 ||
      match.team1 ||
      match.teamA;

    const teamB =
      match.team_2 ||
      match.team2 ||
      match.teamB;

    if (teamA && teamB) {
      return `${teamA} VS ${teamB}`;
    }

    const title = String(
      match.title ||
      match.teams ||
      'Sports Match'
    ).trim();

    return title.replace(
      /\s+(?:v(?:s)?\.?|versus)\s+/gi,
      ' VS '
    );
  }

  // ---------- SECOND CAPTION ----------

  function getMatchMeta(match) {
    const league = String(
      match.league ||
      match.tournament ||
      match.category ||
      'World Sports'
    );

    const date = String(
      match.date || ''
    );

    return [league, date]
      .filter(Boolean)
      .join(' · ');
  }

  // ---------- STATUS ----------

  function getStatus(match) {
    const status = String(
      match.status ||
      match.status_display ||
      ''
    ).toUpperCase();

    if (
      status.includes('LIVE') ||
      status.includes('IN PROGRESS')
    ) {
      return 'LIVE';
    }

    if (
      status.includes('UPCOMING') ||
      status.includes('SCHEDULED') ||
      status.includes('NOT STARTED')
    ) {
      return 'UPCOMING';
    }

    return 'OTHER';
  }

  // ---------- STATUS BADGE ----------

  function renderStatus(status) {
    if (status === 'LIVE') {
      return '<span class="badge">LIVE</span>';
    }

    if (status === 'UPCOMING') {
      return `
        <span
          class="ws-upcoming-icon"
          role="img"
          aria-label="Upcoming match"
          title="Upcoming match"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5-6.7V3a2 2 0 0 0-4 0v1.3A7 7 0 0 0 5 11v5l-2 2v1h18v-1z"/>
          </svg>
        </span>
      `;
    }

    return '';
  }

  // ---------- MATCH CARD ----------

  function renderCard(match) {
    const title = getMatchTitle(match);

    const meta = getMatchMeta(match);

    const status = getStatus(match);

    const imageUrl = safeUrl(
      match.thumbnail ||
      match.image ||
      match.poster ||
      match.cover_image ||
      ''
    );

    const href = safeUrl(
      match.page_url || ''
    );

    const matchId = String(
      match.match_id || ''
    );

    const posterHTML = imageUrl
      ? `
        <img
          src="${esc(imageUrl)}"
          alt="${esc(title)}"
          loading="lazy"
          decoding="async"
        >
      `
      : `
        <span class="ws-no-poster">
          Poster unavailable
        </span>
      `;

    // Use an anchor only when a real destination exists.

    const tag = href ? 'a' : 'div';

    const linkAttribute = href
      ? `href="${esc(href)}"`
      : '';

    return `
      <${tag}
        class="card world-sports-card"
        ${linkAttribute}
        data-match-id="${esc(matchId)}"
        aria-label="${esc(title)}"
      >
        <div class="thumb world-sports-thumb">

          ${posterHTML}

          ${renderStatus(status)}

        </div>

        <div class="caption">

          <span
            class="ws-match-title"
            title="${esc(title)}"
          >
            ${esc(title)}
          </span>

          <span
            class="ws-meta"
            title="${esc(meta)}"
          >
            ${esc(meta)}
          </span>

        </div>
      </${tag}>
    `;
  }

  // ---------- SKELETON LOADER ----------

  function showSkeleton() {
    track.innerHTML = Array.from(
      { length: SKELETON_COUNT },
      () => `
        <div
          class="card ws-skeleton-card"
          aria-hidden="true"
        >
          <div class="thumb ws-skeleton-thumb"></div>

          <div class="caption">
            <div class="ws-skeleton-line"></div>
            <div class="ws-skeleton-line"></div>
          </div>
        </div>
      `
    ).join('');

    scheduleArrows();
  }

  // ---------- ARROW POSITION ----------

  function updateArrows() {
    if (
      !rail ||
      !prevBtn
    ) {
      return;
    }

    const thumb = track.querySelector(
      '.thumb'
    );

    if (!thumb) {
      return;
    }

    const top =
      thumb.getBoundingClientRect().height / 2 -
      prevBtn.getBoundingClientRect().height / 2;

    rail.style.setProperty(
      '--ws-arrow-top',
      Math.max(0, top) + 'px'
    );
  }

  function scheduleArrows() {
    if (arrowFrame) {
      return;
    }

    arrowFrame = requestAnimationFrame(
      () => {
        arrowFrame = 0;
        updateArrows();
      }
    );
  }

  // ---------- FETCH WORLD SPORTS ----------

  async function fetchWorldSports() {
    if (loading) {
      return;
    }

    loading = true;

    track.setAttribute(
      'aria-busy',
      'true'
    );

    showSkeleton();

    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      15000
    );

    try {
      const response = await fetch(
        API_URL,
        {
          method: 'GET',
          cache: 'no-cache',
          headers: {
            Accept: 'application/json'
          },
          signal: controller.signal
        }
      );

      if (!response.ok) {
        throw new Error(
          'HTTP ' + response.status
        );
      }

      const data = await response.json();

      const matches = Array.isArray(data)
        ? data
        : data.matches;

      if (!Array.isArray(matches)) {
        throw new Error(
          'Invalid World Sports API response'
        );
      }

      const displayMatches = matches
        .filter(
          match =>
            match &&
            typeof match === 'object'
        )
        .slice(0, MAX_MATCHES);

      const html = displayMatches.length
        ? displayMatches.map(renderCard).join('')
        : `
          <div class="ws-empty">
            No World Sports matches available.
          </div>
        `;

      track.innerHTML = html;

      scheduleArrows();

    } catch (error) {
      console.error(
        '[WorldSports]',
        error
      );

      track.innerHTML = `
        <div class="ws-empty">
          Unable to load World Sports matches.

          <button
            type="button"
            class="ws-retry"
          >
            Retry
          </button>
        </div>
      `;

    } finally {
      clearTimeout(timeout);

      loading = false;

      track.setAttribute(
        'aria-busy',
        'false'
      );
    }
  }

  // ---------- CAROUSEL CONTROLS ----------

  function scrollByCard(direction) {
    const card = track.querySelector(
      '.card'
    );

    if (!card) {
      return;
    }

    const gap =
      parseFloat(
        getComputedStyle(track).columnGap
      ) || 0;

    track.scrollBy({
      left: direction * (
        card.offsetWidth + gap
      ),
      behavior: reduced.matches
        ? 'auto'
        : 'smooth'
    });
  }

  prevBtn?.addEventListener(
    'click',
    () => scrollByCard(-1)
  );

  nextBtn?.addEventListener(
    'click',
    () => scrollByCard(1)
  );

  // ---------- RETRY BUTTON ----------

  track.addEventListener(
    'click',
    event => {
      const retry = event.target.closest(
        '.ws-retry'
      );

      if (retry) {
        fetchWorldSports();
      }
    }
  );

  // ---------- BROKEN IMAGE FALLBACK ----------

  track.addEventListener(
    'error',
    event => {
      const image = event.target;

      if (
        !(image instanceof HTMLImageElement) ||
        !image.matches(
          '.world-sports-thumb img'
        )
      ) {
        return;
      }

      const fallback = document.createElement(
        'span'
      );

      fallback.className = 'ws-no-poster';

      fallback.textContent =
        'Poster unavailable';

      image.replaceWith(fallback);
    },
    true
  );

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

  if (
    'IntersectionObserver' in window &&
    section
  ) {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          observer.disconnect();

          fetchWorldSports();
        }
      },
      {
        rootMargin: '200px 0px',
        threshold: 0
      }
    );

    observer.observe(section);

  } else {
    fetchWorldSports();
  }

  // ---------- PUBLIC HELPER ----------

  window.WorldSports = {
    reload: fetchWorldSports
  };

})();
