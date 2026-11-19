/* =========================================================
   PRIME VIDEO LIVE
   API: https://raw.githubusercontent.com/doctor-8trange/tekzya9/refs/heads/main/data/primevideoindia.json
   Player: prime-player.html?id=...&lang=...
   Same card layout as Willow. Poster images only.
   Lazy load when section is within 300px of viewport.
   Refresh every 5 minutes while near viewport and tab active.
   No live counter badge (per request).
   ========================================================= */

(function bootPrimeVideo() {
  'use strict';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootPrimeVideo, { once: true });
    return;
  }

  const API =
    'https://raw.githubusercontent.com/doctor-8trange/tekzya9/refs/heads/main/data/primevideoindia.json';
  const REFRESH_INTERVAL = 300000;
  const SKELETON_COUNT = 4;

  const track = document.getElementById('primeLiveTrack');
  if (!track || track.dataset.initialized === 'true') return;
  track.dataset.initialized = 'true';

  const section = track.closest('.prime-live-section');
  const rail = track.closest('.live-rail');
  const prevBtn = document.getElementById('primeLiveArrowLeft');
  const nextBtn = document.getElementById('primeLiveArrowRight');

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  let loaded = false;
  let loading = false;
  let visible = false;
  let refreshTimer = null;
  let renderedCards = null;
  let arrowFrame = 0;

  // ---------- HELPERS ----------

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[char]);
  }

  function safeUrl(value) {
    if (typeof value !== 'string') return '';
    const url = value.trim();
    return /^https?:\/\//i.test(url) ? url : '';
  }

  function getStatus(match) {
    const s = match?.liveSchedule?.status;
    if (s) return String(s).trim().toUpperCase();
    return 'UPCOMING';
  }

  // ---------- NORMALISE (dedupe languages) ----------

  /**
   * Prime API returns one entry per language for the same event.
   * Group by eventId so each match appears once, but keep the
   * per-language streamIds so the player can pick a language.
   */
  function normalise(data) {
    const live = Array.isArray(data?.live) ? data.live : [];
    const upcoming = Array.isArray(data?.upcoming) ? data.upcoming : [];
    const all = [...live, ...upcoming].filter(
      (m) => m && typeof m === 'object'
    );

    const groups = new Map();

    for (const m of all) {
      const cat = m.catalogMetadata?.catalog || {};
      const key =
        cat.eventId ||
        m.titleId ||
        m.streamId ||
        m.title ||
        Math.random().toString(36);

      const lang =
        cat.originalLanguages?.[0] ||
        cat.primarySpokenLanguages?.[0] ||
        '';

      const status = getStatus(m);

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          status,
          title: cat.eventTitle || cat.title || m.title || 'Live Match',
          series:
            m.providerLogoInfo?.name ||
            (m.entityClassifications || []).join(', ') ||
            '',
          startTimeIST:
            m.catalogMetadata?.liveEventDateTime?.startTimeIST || '',
          startTimeMillis:
            m.catalogMetadata?.liveEventDateTime?.startTimeMillis || 0,
          images:
            m.catalogMetadata?.images || {},
          languages: [],
          streams: {}, // lang -> full raw match object
          venue: m.liveSchedule?.venue || '',
        });
      }

      const g = groups.get(key);
      if (lang && !g.languages.includes(lang)) g.languages.push(lang);
      if (lang) g.streams[lang] = m;
      if (m.liveSchedule?.venue) g.venue = m.liveSchedule.venue;
    }

    return [...groups.values()];
  }

  // ---------- POSTER CANDIDATES ----------

  function getPosterCandidates(group) {
    return [...new Set([
      group.images.coverImage,
      group.images.boxartImage,
      group.images.heroImage,
      ...Object.values(group.streams).flatMap((m) => [
        m.images?.coverImageFragments?.mediaCentralUrl,
        m.images?.boxArtImageFragments?.mediaCentralUrl,
        m.images?.heroImageFragments?.mediaCentralUrl,
      ]),
    ].map(safeUrl).filter(Boolean))];
  }

  // ---------- STATUS BADGE ----------

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

  // ---------- RENDER CARD ----------

  function renderCard(group) {
    const isLive = group.status === 'LIVE';
    const posters = getPosterCandidates(group);

    const imageHTML = posters.length
      ? `
        <img
          src="${esc(posters[0])}"
          alt="${esc(group.title)}"
          loading="lazy"
          decoding="async"
          data-posters="${esc(JSON.stringify(posters))}"
          data-poster-index="0"
        >
      `
      : '<span class="wl-no-poster">Poster unavailable</span>';

    const langs = group.languages.join(' / ');

    const meta = [
      group.series,
      langs,
      isLive ? (group.startTimeIST || 'Live now') : group.startTimeIST,
    ]
      .filter(Boolean)
      .join(' · ');

    // LIVE with at least one playable stream -> link to player.
    // Others -> button with message.
    const playable =
      isLive &&
      Object.values(group.streams).some(
        (m) =>
          m?.playback_details?.playback_url?.length ||
          m?.playback_details?.clearkey_pairs?.length
      );

    const open = playable
      ? `<a class="card prime-live-card"
           href="prime-player.html?id=${encodeURIComponent(group.key)}"`
      : `<button class="card prime-live-card"
           type="button"
           data-message="${esc(
             isLive
               ? 'Stream not yet available for this match'
               : `This match is upcoming: ${group.startTimeIST || 'soon'}`
           )}"`;

    const close = playable ? '</a>' : '</button>';

    const playHTML = playable
      ? `
        <span class="wl-play" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M8 5 20 12 8 19Z"/>
          </svg>
        </span>
      `
      : '';

    return `
      ${open}
        aria-label="${esc(group.title + ' — ' + (isLive ? 'Live' : 'Upcoming'))}"
      >
        <div class="thumb prime-live-thumb">
          ${imageHTML}
          ${renderStatus(group.status)}
          ${playHTML}
        </div>

        <div class="caption">
          <span title="${esc(group.title)}">
            ${esc(group.title)}
          </span>

          <span class="wl-meta" title="${esc(meta)}">
            ${esc(meta)}
          </span>
        </div>
      ${close}
    `;
  }

  // ---------- SKELETON ----------

  function showSkeleton() {
    track.innerHTML = Array.from({ length: SKELETON_COUNT }, () => `
      <div class="card wl-skeleton-card" aria-hidden="true">
        <div class="thumb wl-skeleton-thumb"></div>
        <div class="caption">
          <div class="wl-skeleton-line"></div>
          <div class="wl-skeleton-line"></div>
        </div>
      </div>
    `).join('');
    scheduleArrows();
  }

  // ---------- ARROWS ----------

  function updateArrows() {
    if (!rail || !prevBtn) return;
    const thumb = track.querySelector('.thumb');
    if (!thumb) return;
    const top =
      thumb.getBoundingClientRect().height / 2 -
      prevBtn.getBoundingClientRect().height / 2;
    rail.style.setProperty('--pv-arrow-top', Math.max(0, top) + 'px');
  }

  function scheduleArrows() {
    if (arrowFrame) return;
    arrowFrame = requestAnimationFrame(() => {
      arrowFrame = 0;
      updateArrows();
    });
  }

  // ---------- FETCH ----------

  async function loadMatches() {
    if (loading) return;
    loading = true;
    track.setAttribute('aria-busy', 'true');

    if (!loaded) showSkeleton();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(API, {
        method: 'GET',
        cache: 'no-cache',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();

      const ordered = normalise(data);

      // LIVE first, then upcoming sorted by start time.
      ordered.sort((a, b) => {
        if (a.status === 'LIVE' && b.status !== 'LIVE') return -1;
        if (b.status === 'LIVE' && a.status !== 'LIVE') return 1;
        return (a.startTimeMillis || 0) - (b.startTimeMillis || 0);
      });

      const nextCards = ordered.length
        ? ordered.map(renderCard).join('')
        : '<div class="wl-empty">No Prime Video matches available.</div>';

      if (nextCards !== renderedCards) {
        const left = track.scrollLeft;
        track.innerHTML = nextCards;
        track.scrollLeft = left;
        renderedCards = nextCards;
        scheduleArrows();
      }

      loaded = true;
    } catch (error) {
      console.error('[PrimeVideoLive]', error);
      if (!loaded) {
        track.innerHTML = `
          <div class="wl-empty">
            Unable to load Prime Video matches.
            <button class="wl-retry" type="button">Retry</button>
          </div>
        `;
      }
    } finally {
      clearTimeout(timeout);
      loading = false;
      track.setAttribute('aria-busy', 'false');
    }
  }

  // ---------- CAROUSEL ----------

  function scrollByCard(direction) {
    const card = track.querySelector('.card');
    if (!card) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    track.scrollBy({
      left: direction * (card.offsetWidth + gap),
      behavior: reduced.matches ? 'auto' : 'smooth',
    });
  }

  prevBtn?.addEventListener('click', () => scrollByCard(-1));
  nextBtn?.addEventListener('click', () => scrollByCard(1));

  // ---------- CLICK ----------

  track.addEventListener('click', (event) => {
    const retry = event.target.closest('.wl-retry');
    if (retry) {
      loadMatches();
      return;
    }
    const info = event.target.closest(
      'button.prime-live-card[data-message]'
    );
    if (info) alert(info.dataset.message);
  });

  // ---------- POSTER FALLBACK ----------

  track.addEventListener('error', (event) => {
    const img = event.target;
    if (
      !(img instanceof HTMLImageElement) ||
      !img.matches('.prime-live-thumb img')
    ) return;

    let posters = [];
    try { posters = JSON.parse(img.dataset.posters || '[]'); } catch (_) {}

    const next = Number(img.dataset.posterIndex || 0) + 1;
    if (next < posters.length) {
      img.dataset.posterIndex = String(next);
      img.src = posters[next];
    } else {
      img.replaceWith(
        Object.assign(document.createElement('span'), {
          className: 'wl-no-poster',
          textContent: 'Poster unavailable',
        })
      );
    }
  }, true);

  // ---------- REFRESH ----------

  function stopRefresh() {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  function startRefresh() {
    if (refreshTimer || !visible || document.hidden) return;
    refreshTimer = setInterval(() => {
      if (visible && !document.hidden) loadMatches();
    }, REFRESH_INTERVAL);
  }

  function handleVisibility(isVisible) {
    visible = isVisible;
    if (visible && !document.hidden) {
      if (!loaded) loadMatches();
      startRefresh();
      scheduleArrows();
    } else {
      stopRefresh();
    }
  }

  window.PrimeVideoLive = { reload: loadMatches };

  // ---------- RESIZE ----------

  if ('ResizeObserver' in window) {
    new ResizeObserver(scheduleArrows).observe(track);
  }
  window.addEventListener('resize', scheduleArrows, { passive: true });

  // ---------- LAZY LOAD ----------

  if ('IntersectionObserver' in window && section) {
    const observer = new IntersectionObserver(
      (entries) => handleVisibility(entries[0].isIntersecting),
      { rootMargin: '300px 0px', threshold: 0 }
    );
    observer.observe(section);
  } else {
    handleVisibility(true);
  }

  // ---------- PAGE VISIBILITY ----------

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopRefresh();
    else if (visible) {
      loadMatches();
      startRefresh();
    }
  });
})();
