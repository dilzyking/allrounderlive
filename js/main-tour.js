/* =========================================================
   MAIN TOUR
   API: /main-tour.json
   Player: main-tour-player.html?id=CARD_ID

   JSON:
   {
     "title": "...",
     "subtitle": "...",
     "background_image": "...",
     "cards": [
       {
         "id": "228078",
         "title": "...",
         "thumbnail": "...",
         "badge": "HIGHLIGHTS",
         "duration": "20:55",
         "m3u8": null
       }
     ]
   }

   Lazy load within 300px of viewport.
   Refresh every 5 minutes while visible and tab active.
   ========================================================= */

(function bootMainTour() {
  'use strict';

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      bootMainTour,
      { once: true }
    );
    return;
  }

  const section = document.getElementById('main-tour');

  if (!section || section.dataset.initialized) return;

  section.dataset.initialized = 'true';

  const track = section.querySelector('#mainTourTrack');
  const banner = section.querySelector('.mt-banner');
  const title = section.querySelector('#mainTourTitle');
  const subtitle = section.querySelector('#mainTourSubtitle');
  const message = section.querySelector('.mt-message');
  const prev = section.querySelector('.mt-prev');
  const next = section.querySelector('.mt-next');

  const API = section.dataset.api || '/main-tour.json';

  const PLAYER_PAGE =
    section.dataset.player || 'main-tour-player.html';

  const REFRESH_INTERVAL = 300000;
  const SKELETON_COUNT = 6;

  const reduced = matchMedia(
    '(prefers-reduced-motion: reduce)'
  );

  let loaded = false;
  let loading = false;
  let visible = false;
  let refreshTimer = null;
  let renderedCards = '';
  let arrowFrame = 0;
  let lastFetch = 0;

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
    if (
      typeof value !== 'string' ||
      !value.trim()
    ) {
      return '';
    }

    try {
      const url = new URL(value, location.href);

      return ['http:', 'https:'].includes(url.protocol)
        ? url.href
        : '';
    } catch {
      return '';
    }
  }

  // ---------- ARROW POSITION / STATE ----------

  function updateArrows() {
    arrowFrame = 0;

    const thumb = track.querySelector('.mt-thumb');

    if (thumb) {
      const top =
        thumb.getBoundingClientRect().height / 2 - 19;

      section.style.setProperty(
        '--mt-arrow-top',
        `${Math.max(0, top)}px`
      );
    }

    prev.disabled = track.scrollLeft <= 2;

    next.disabled =
      track.scrollLeft >=
      track.scrollWidth - track.clientWidth - 2;
  }

  function scheduleArrows() {
    if (arrowFrame) return;

    arrowFrame = requestAnimationFrame(updateArrows);
  }

  // ---------- SKELETON LOADER ----------

  function showSkeleton() {
    track.innerHTML = Array.from(
      { length: SKELETON_COUNT },
      () => `
        <div
          class="mt-card mt-skeleton"
          aria-hidden="true"
        >
          <div class="mt-thumb"></div>
          <div class="mt-skeleton-line"></div>
          <div class="mt-skeleton-line"></div>
        </div>
      `
    ).join('');

    scheduleArrows();
  }

  // ---------- CARD RENDER ----------

  function renderCard(card) {
    const id = String(card.id ?? '').trim();

    const playable =
      !!id &&
      !!safeUrl(card.m3u8);

    const thumbnail = safeUrl(card.thumbnail);
    const name = String(card.title || 'Tour video');

    // Willow-style routing: only the ID goes to the player.
    const destination = new URL(
      PLAYER_PAGE,
      location.href
    );

    destination.searchParams.set('id', id);

    const open = playable
      ? `
        <a
          class="mt-card"
          href="${esc(destination.href)}"
          aria-label="${esc(name)}"
        >
      `
      : `
        <button
          class="mt-card"
          type="button"
          data-unavailable="true"
          aria-label="${esc(
            name + ' — stream unavailable'
          )}"
        >
      `;

    const close = playable ? '</a>' : '</button>';

    const imageHTML = thumbnail
      ? `
        <img
          src="${esc(thumbnail)}"
          alt="${esc(name)}"
          loading="lazy"
          decoding="async"
        >
      `
      : `
        <span class="mt-no-poster">
          Poster unavailable
        </span>
      `;

    const badgeHTML = card.badge
      ? `
        <span class="mt-badge">
          ${esc(card.badge)}
        </span>
      `
      : '';

    const durationHTML = card.duration
      ? `
        <span class="mt-duration">
          ▶ ${esc(card.duration)}
        </span>
      `
      : '';

    return `
      ${open}
        <span class="mt-thumb">
          ${imageHTML}

          <span class="mt-labels">
            ${badgeHTML}
            ${durationHTML}
          </span>
        </span>

        <span class="mt-caption">
          ${esc(name)}
        </span>
      ${close}
    `;
  }

  // ---------- FETCH JSON ----------

  async function loadTour() {
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
        cache: 'no-cache',
        headers: {
          Accept: 'application/json'
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data || !Array.isArray(data.cards)) {
        throw new Error('Expected a cards array');
      }

      const cards = data.cards.filter(
        card => card && typeof card === 'object'
      );

      // Section heading.
      title.textContent = data.title || 'Featured Tour';
      subtitle.textContent = data.subtitle || '';
      subtitle.hidden = !data.subtitle;

      // Background image.
      const background = safeUrl(data.background_image);

      banner.style.backgroundImage = background
        ? `url(${JSON.stringify(background)})`
        : 'none';

      const nextCards = cards.length
        ? cards.map(renderCard).join('')
        : `
          <div class="mt-empty">
            No tour videos available.
          </div>
        `;

      // Preserve scroll position when refreshed.
      if (nextCards !== renderedCards) {
        const left = track.scrollLeft;

        const focusedHref =
          track.contains(document.activeElement)
            ? document.activeElement.getAttribute('href')
            : null;

        track.innerHTML = nextCards;
        track.scrollLeft = left;

        if (focusedHref) {
          const sameLink = [
            ...track.querySelectorAll('a')
          ].find(
            link =>
              link.getAttribute('href') === focusedHref
          );

          sameLink?.focus({ preventScroll: true });
        }

        renderedCards = nextCards;
      }

      loaded = true;
      lastFetch = Date.now();
      message.hidden = true;

    } catch (error) {
      console.warn('[MainTour]', error);

      if (!loaded) {
        track.innerHTML = `
          <div class="mt-empty">
            Unable to load tour videos.

            <button
              class="mt-retry"
              type="button"
            >
              Retry
            </button>
          </div>
        `;
      }

      // Preserve existing cards if a refresh fails.

    } finally {
      clearTimeout(timeout);

      loading = false;

      track.setAttribute('aria-busy', 'false');

      scheduleArrows();
    }
  }

  // ---------- CAROUSEL CONTROLS ----------

  function scrollByPage(direction) {
    const card = track.querySelector('.mt-card');

    if (!card) return;

    const gap =
      parseFloat(
        getComputedStyle(track).columnGap
      ) || 0;

    const step =
      card.getBoundingClientRect().width + gap;

    const cardsPerPage = Math.max(
      1,
      Math.floor((track.clientWidth + 1) / step)
    );

    track.scrollBy({
      left: direction * step * cardsPerPage,
      behavior: reduced.matches ? 'auto' : 'smooth'
    });
  }

  prev.addEventListener('click', () => {
    scrollByPage(-1);
  });

  next.addEventListener('click', () => {
    scrollByPage(1);
  });

  track.addEventListener(
    'scroll',
    scheduleArrows,
    { passive: true }
  );

  // ---------- CLICK HANDLING ----------

  track.addEventListener('click', event => {
    if (event.target.closest('.mt-retry')) {
      loadTour();
      return;
    }

    if (event.target.closest('[data-unavailable]')) {
      message.textContent =
        'Stream not yet available for this video.';

      message.hidden = false;
    }
  });

  // ---------- IMAGE FALLBACK ----------

  track.addEventListener('error', event => {
    if (!(event.target instanceof HTMLImageElement)) {
      return;
    }

    const fallback = document.createElement('span');

    fallback.className = 'mt-no-poster';
    fallback.textContent = 'Poster unavailable';

    event.target.replaceWith(fallback);

  }, true);

  // ---------- VISIBLE-ONLY REFRESH ----------

  function stopRefresh() {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  function syncVisibility() {
    stopRefresh();

    if (!visible || document.hidden) return;

    if (
      !loaded ||
      Date.now() - lastFetch >= REFRESH_INTERVAL
    ) {
      loadTour();
    }

    refreshTimer = setInterval(
      loadTour,
      REFRESH_INTERVAL
    );

    scheduleArrows();
  }

  // Reserve layout space before the lazy API request.
  showSkeleton();

  // ---------- LAZY LOADING ----------

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      entries => {
        visible = entries[0].isIntersecting;
        syncVisibility();
      },
      {
        rootMargin: '300px 0px',
        threshold: 0
      }
    );

    observer.observe(section);

  } else {
    visible = true;
    syncVisibility();
  }

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

  // ---------- PAGE VISIBILITY ----------

  document.addEventListener(
    'visibilitychange',
    syncVisibility
  );

  window.addEventListener(
    'pagehide',
    stopRefresh
  );

  window.addEventListener(
    'pageshow',
    syncVisibility
  );

  // Optional manual refresh:
  // window.MainTour.reload();

  window.MainTour = {
    reload: loadTour
  };

})();
