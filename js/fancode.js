
/* =====================================================
   FANCODE LIVE — MATCHDEKHO
   NEW DOCTOR_STRANGE JSON API
   STRICT 1080P ONLY
   Same Cricket / Willow card UI.
   Two captions: Teams, Tournament.
   Language-specific stream selection.
   ===================================================== */

(function bootFancode() {
  'use strict';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootFancode, { once: true });
    return;
  }

  // ---------- CONFIG ----------

  const API_URL =
    'https://raw.githubusercontent.com/doctor-8trange/zyphx8/refs/heads/main/data/fancode.json';

  const SKELETON_COUNT = 6;
  const REFRESH_INTERVAL = 60000;

  // ---------- ELEMENTS ----------

  const track = document.getElementById('fancodeTrack');

  if (!track || track.dataset.initialized === 'true') return;

  track.dataset.initialized = 'true';

  const section = document.getElementById('fancodeSection');
  const rail = track.closest('.live-rail');

  const prevBtn = document.getElementById('fancodeArrowLeft');
  const nextBtn = document.getElementById('fancodeArrowRight');

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  // ---------- STATE ----------

  let loaded = false;
  let loading = false;
  let visible = false;
  let refreshTimer = null;
  let renderedCards = null;
  let arrowFrame = 0;
  let opening = false;

  // ---------- HELPERS ----------

  function esc(value) {
    return String(value ?? '').replace(
      /[&<>"']/g,
      character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[character]
    );
  }

  function safeUrl(value) {
    try {
      const url = new URL(value);

      return ['http:', 'https:'].includes(url.protocol)
        ? url.href
        : '';
    } catch {
      return '';
    }
  }

  function getBaseMatchId(value) {
    return String(value ?? '').split('_')[0].trim();
  }

  function extractMatches(data) {
    return Array.isArray(data?.matches)
      ? data.matches
      : [];
  }

  // ---------- STATUS ----------

  function getStatus(match) {
    const status = String(match.status || '').toUpperCase();

    if (status === 'LIVE' || status === 'STARTED') {
      return 'LIVE';
    }

    if (
      status === 'NOT_STARTED' ||
      status === 'UPCOMING' ||
      status === 'SCHEDULED'
    ) {
      return 'UPCOMING';
    }

    if (
      status === 'COMPLETED' ||
      status === 'ENDED' ||
      status === 'FINISHED'
    ) {
      return 'ENDED';
    }

    return status || 'UPCOMING';
  }

  function getStatusPriority(status) {
    if (status === 'LIVE') return 0;
    if (status === 'UPCOMING') return 1;
    return 2;
  }

  // ---------- TEAM CAPTION ----------

  function getTeamCaption(match) {
    const teams = Array.isArray(match.team)
      ? match.team
      : [];

    const teamA = teams[0]?.name;
    const teamB = teams[1]?.name;

    if (teamA && teamB) {
      return `${teamA} VS ${teamB}`;
    }

    const title = String(
      match.title || 'Live Match'
    ).trim();

    const segments = title.split(/\s+[-–—|]\s+/);

    const matchup = segments.find(part =>
      /\s+(?:vs?\.?|versus)\s+/i.test(part)
    );

    return (matchup || title).replace(
      /\s+(?:vs?\.?|versus)\s+/i,
      ' VS '
    );
  }

  // ---------- TOURNAMENT CAPTION ----------

  function getSeriesCaption(match) {
    const candidates = [
      match.tournament,
      match.category,
      match.short_name
    ];

    for (const value of candidates) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return 'Live Sports';
  }

  // ---------- STRICT 1080P STREAM ----------

  // New API:
  // auto_streams: [
  //   {
  //     auto: "#EXTM3U ... 1080p.m3u8 ..."
  //   }
  // ]

  function get1080pStream(match) {
    const streams = Array.isArray(match.auto_streams)
      ? match.auto_streams
      : [];

    for (const stream of streams) {
      const playlist = String(stream?.auto || '');

      if (!playlist) continue;

      // Find the direct 1080p playlist URL.
      const lines = playlist.split(/\r?\n/);

      for (const line of lines) {
        const value = line.trim();

        if (!value || value.startsWith('#')) continue;

        if (!/\/1080p\.m3u8(?:\?|$)/i.test(value)) {
          continue;
        }

        const validUrl = safeUrl(value);

        if (validUrl) return validUrl;
      }

      // Support an API entry containing a direct 1080p URL.
      const directMatch = playlist.match(
        /https?:\/\/[^\s"'<>]+\/1080p\.m3u8(?:\?[^\s"'<>]*)?/i
      );

      if (directMatch) {
        const validUrl = safeUrl(directMatch[0]);

        if (validUrl) return validUrl;
      }
    }

    return '';
  }

  // ---------- EXPIRY CHECK ----------

  // Example:
  // ?hdntl=Expires=1788511866~_GO=Generated~...

  function isExpired(streamUrl) {
    if (!streamUrl) return false;

    try {
      const url = new URL(streamUrl);

      let expiry = null;

      for (const [name, value] of url.searchParams) {
        if (/^(?:exp|expires)$/i.test(name)) {
          const numeric = Number(value);

          if (Number.isFinite(numeric) && numeric > 0) {
            expiry = numeric;
            break;
          }
        }

        const tokenExpiry = value.match(
          /(?:^|~)(?:exp|expires)=(\d+)(?:~|$)/i
        );

        if (tokenExpiry) {
          expiry = Number(tokenExpiry[1]);
          break;
        }
      }

      if (
        expiry == null ||
        !Number.isFinite(expiry) ||
        expiry <= 0
      ) {
        return false;
      }

      const expiryMs = expiry > 1e12
        ? expiry
        : expiry * 1000;

      return Date.now() >= expiryMs;

    } catch {
      return false;
    }
  }

  // ---------- POSTER ----------

  function getPosters(match) {
    const cdn = match.image_cdn || {};

    return [...new Set(
      [
        cdn.TATAPLAY,
        match.image,
        cdn.APP,
        cdn.BG_IMAGE,
        cdn.CLOUDFARE
      ]
        .map(safeUrl)
        .filter(Boolean)
    )];
  }

  // ---------- LANGUAGE ----------

  function getLanguage(match) {
    return String(match.language || 'DEFAULT')
      .trim()
      .toUpperCase();
  }

  // ---------- STATUS BADGE ----------

  function renderBadge(status) {
    if (status === 'LIVE') {
      return '<span class="badge">LIVE</span>';
    }

    if (status === 'UPCOMING') {
      return `
        <span
          class="fc-upcoming-icon"
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

    return '';
  }

  // ---------- RENDER CARD ----------

  function renderCard(match) {
    const matchId = String(match.match_id ?? '').trim();
    const language = getLanguage(match);

    const title = String(match.title || 'Live Match');
    const teams = getTeamCaption(match);
    const series = getSeriesCaption(match);
    const status = getStatus(match);
    const posters = getPosters(match);

    const posterHTML = posters.length
      ? `
        <img
          src="${esc(posters[0])}"
          alt="${esc(title)}"
          loading="lazy"
          decoding="async"
          data-posters="${esc(JSON.stringify(posters))}"
          data-index="0"
        >
      `
      : `
        <span class="fc-no-poster">
          Poster unavailable
        </span>
      `;

    return `
      <button
        type="button"
        class="card fancode-live-card"
        data-match-id="${esc(matchId)}"
        data-language="${esc(language)}"
        data-title="${esc(title)}"
        aria-label="${esc(teams + ' — ' + series + ' — ' + language)}"
      >
        <div class="thumb fancode-thumb">
          ${posterHTML}
          ${renderBadge(status)}
        </div>

        <div class="caption">
          <span
            class="fc-match-title"
            title="${esc(teams)}"
          >
            ${esc(teams)}
          </span>

          <span
            class="fc-series"
            title="${esc(series)}"
          >
            ${esc(series)}
          </span>
        </div>
      </button>
    `;
  }

  // ---------- SKELETON ----------

  function showSkeleton() {
    track.innerHTML = Array.from(
      { length: SKELETON_COUNT },
      () => `
        <div class="card fc-skeleton-card" aria-hidden="true">
          <div class="thumb fc-skeleton-thumb"></div>

          <div class="caption">
            <div class="fc-skeleton-line"></div>
            <div class="fc-skeleton-line"></div>
          </div>
        </div>
      `
    ).join('');

    scheduleArrows();
  }

  // ---------- SORT MATCHES ----------

  function sortMatches(data) {
    return data
      .filter(match =>
        match &&
        match.match_id != null &&
        (match.title || match.team?.[0]?.name)
      )
      .sort((a, b) => {
        const priority =
          getStatusPriority(getStatus(a)) -
          getStatusPriority(getStatus(b));

        if (priority) return priority;

        const aTime = Date.parse(a.startTime);
        const bTime = Date.parse(b.startTime);

        if (
          Number.isFinite(aTime) &&
          Number.isFinite(bTime)
        ) {
          return aTime - bTime;
        }

        return 0;
      });
  }

  // ---------- ARROW POSITION ----------

  function updateArrows() {
    const thumb = track.querySelector('.thumb');

    if (!thumb || !prevBtn || !rail) return;

    const top =
      thumb.getBoundingClientRect().height / 2 -
      prevBtn.getBoundingClientRect().height / 2;

    rail.style.setProperty(
      '--fc-arrow-top',
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

  // ---------- FETCH ----------

  async function fetchFancodeData() {
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
      const response = await fetch(API_URL, {
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }

      const data = await response.json();

      const matches = sortMatches(
        extractMatches(data)
      );

      const nextCards = matches.length
        ? matches.map(renderCard).join('')
        : `
          <div class="fc-empty">
            No FanCode matches available.
          </div>
        `;

      if (nextCards !== renderedCards) {
        const oldScroll = track.scrollLeft;

        track.innerHTML = nextCards;
        track.scrollLeft = oldScroll;

        renderedCards = nextCards;
        scheduleArrows();
      }

      loaded = true;

    } catch (error) {
      console.error('[FanCodeLive]', error);

      if (!loaded) {
        track.innerHTML = `
          <div class="fc-empty">
            Unable to load FanCode matches.

            <button type="button" class="fc-retry">
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

  // ---------- PLAY 1080P ----------

  async function playMatch(matchId, language, title) {
    if (opening) return;

    if (!matchId) {
      alert('Invalid match ID');
      return;
    }

    opening = true;

    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      15000
    );

    try {
      // Fetch fresh API data on every click.

      const response = await fetch(API_URL, {
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }

      const data = await response.json();

      const allMatches = extractMatches(data);

      // Match both ID and language.
      // This prevents selecting the wrong language entry.

      const match = allMatches.find(item =>
        String(item?.match_id ?? '').trim() === matchId &&
        getLanguage(item) === language
      );

      if (!match) {
        alert('Match not found. Please try again.');
        return;
      }

      const streamUrl = get1080pStream(match);

      if (!streamUrl) {
        alert(
          '1080p stream is not available for this match.'
        );
        return;
      }

      if (isExpired(streamUrl)) {
        alert(
          'Stream link expired. Please try again later.'
        );
        return;
      }

      const params = new URLSearchParams({
        url: streamUrl,
        title: title || match.title || 'Live Match',
        match_id: getBaseMatchId(match.match_id)
      });

      // Preserve original player route and parameters.

      window.location.href =
        'fc-play?' + params.toString();

    } catch (error) {
      console.error('[FanCodePlayback]', error);

      alert(
        'Failed to load 1080p stream. Please try again.'
      );

    } finally {
      clearTimeout(timeout);
      opening = false;
    }
  }

  // ---------- ARROW SCROLL ----------

  function scrollByCard(direction) {
    const card = track.querySelector('.card');

    if (!card) return;

    const gap =
      parseFloat(getComputedStyle(track).columnGap) || 0;

    track.scrollBy({
      left: direction * (card.offsetWidth + gap),
      behavior: reduced.matches ? 'auto' : 'smooth'
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

  // ---------- CLICK ----------

  track.addEventListener('click', event => {
    if (event.target.closest('.fc-retry')) {
      fetchFancodeData();
      return;
    }

    const card = event.target.closest(
      '.fancode-live-card'
    );

    if (!card) return;

    playMatch(
      card.dataset.matchId,
      card.dataset.language,
      card.dataset.title
    );
  });

  // ---------- IMAGE FALLBACK ----------

  track.addEventListener(
    'error',
    event => {
      const img = event.target;

      if (
        !(img instanceof HTMLImageElement) ||
        !img.matches('.fancode-thumb img')
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
        Number(img.dataset.index || 0) + 1;

      if (next < posters.length) {
        img.dataset.index = String(next);
        img.src = posters[next];
      } else {
        const fallback = document.createElement('span');

        fallback.className = 'fc-no-poster';
        fallback.textContent = 'Poster unavailable';

        img.replaceWith(fallback);
      }
    },
    true
  );

  // ---------- VISIBLE-ONLY REFRESH ----------

  function stopRefresh() {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  function startRefresh() {
    if (refreshTimer || !visible || document.hidden) {
      return;
    }

    refreshTimer = setInterval(() => {
      if (visible && !document.hidden) {
        fetchFancodeData();
      }
    }, REFRESH_INTERVAL);
  }

  function handleVisibility(isVisible) {
    visible = isVisible;

    if (visible && !document.hidden) {
      if (!loaded) fetchFancodeData();

      startRefresh();
      scheduleArrows();
    } else {
      stopRefresh();
    }
  }

  // ---------- RESIZE ----------

  if ('ResizeObserver' in window) {
    new ResizeObserver(scheduleArrows).observe(track);
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

  // ---------- VISIBILITY ----------

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopRefresh();
    } else if (visible) {
      fetchFancodeData();
      startRefresh();
    }
  });

  // ---------- PUBLIC HELPER ----------

  window.FanCodeLive = {
    reload: fetchFancodeData
  };

})();
