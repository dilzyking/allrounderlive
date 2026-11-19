/* =========================================================
   SONY LIV LIVE
   API: https://raw.githubusercontent.com/drmlive/sliv-live-events/refs/heads/main/sonyliv.json
   Player: sonyliv-player.html?id=<contentId>
   Same card layout as Prime Video / Willow.
   Lazy load when section is within 300px of viewport.
   Refresh every 5 minutes while near viewport and tab is active.
   ========================================================= */

(function bootSonyLIV() {
  'use strict';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootSonyLIV, { once: true });
    return;
  }

  const API =
    'https://raw.githubusercontent.com/drmlive/sliv-live-events/refs/heads/main/sonyliv.json';
  const REFRESH_INTERVAL = 300000;
  const SKELETON_COUNT = 4;

  const track = document.getElementById('sonyLiveTrack');
  if (!track || track.dataset.initialized === 'true') return;
  track.dataset.initialized = 'true';

  const section = track.closest('.sonyliv-live-section');
  const rail = track.closest('.live-rail');
  const prevBtn = document.getElementById('sonyLiveArrowLeft');
  const nextBtn = document.getElementById('sonyLiveArrowRight');

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

  // ---------- TITLE CLEANING ----------

  const LANG_SUFFIX = /\s*\[(?:ENG|HIN|TAM|TEL|KAN|MAL|BEN|MAR|GUJ|PAN)+\]\s*$/i;
  const UPCOMING_PREFIX = /^Upcoming\s*[-–—:]\s*/i;
  const LIVE_PREFIX = /^LIVE\s*[-–—:]\s*/i;

  function cleanTitle(raw) {
    return String(raw || '')
      .replace(UPCOMING_PREFIX, '')
      .replace(LIVE_PREFIX, '')
      .replace(LANG_SUFFIX, '')
      .replace(/\s+-\s+\d{1,2}\s+\w+\s+\d{4}\s*$/i, '')
      .replace(/\s+[–—]\s+\d{1,2}\s+\w+\s+\d{4}\s*$/i, '')
      .trim();
  }

  function looksLikeMatch(text) {
    return /\s+(?:vs?\.?|versus)\s+/i.test(text);
  }

  function pickMatchTitle(candidates) {
    for (const raw of candidates) {
      const cleaned = cleanTitle(raw);
      if (!cleaned) continue;
      if (looksLikeMatch(cleaned)) return cleaned;
    }
    for (const raw of candidates) {
      const cleaned = cleanTitle(raw);
      if (cleaned) return cleaned;
    }
    return 'Live Match';
  }

  // ---------- NORMALISE ----------

  function getStreamUrl(match) {
    return (
      safeUrl(match?.video_url) ||
      safeUrl(match?.pub_url) ||
      safeUrl(match?.dai_url) ||
      ''
    );
  }

  function hasPlayback(match) {
    return !!getStreamUrl(match);
  }

  function normalise(data) {
    const raw = Array.isArray(data?.matches) ? data.matches : [];
    const all = raw.filter((m) => m && typeof m === 'object');

    const groups = new Map();

    for (const m of all) {
      const isLive = m.isLive === true;
      const status = isLive ? 'LIVE' : 'UPCOMING';

      // Language tag from audioLanguageName or from match_name suffix
      const lang = String(m.audioLanguageName || '').trim().toUpperCase();

      // Group by the same match — use the match_name (title) or event_name,
      // because contentId differs per language (e.g. 1090554805_ENG, 1090554805_HIN).
      const baseContentId = String(m.contentId || '').split('_')[0];
      const titleSource =
        m.match_name || m.event_name || `Event ${baseContentId || ''}`;

      const cleanMatch = cleanTitle(titleSource);
      const groupKey = looksLikeMatch(cleanMatch)
        ? cleanMatch.toLowerCase()
        : `event:${baseContentId || cleanMatch.toLowerCase()}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          status,
          title: pickMatchTitle([m.match_name, m.event_name]),
          eventName: cleanTitle(m.event_name || ''),
          category: m.event_category || '',
          channel: m.broadcast_channel || '',
          images: { coverImage: safeUrl(m.src) },
          languages: [],
          streams: {},
          allEntries: [],
          baseContentId,
        });
      }

      const g = groups.get(groupKey);
      g.allEntries.push(m);

      // Prefer LIVE over upcoming if any variant is live
      if (isLive) g.status = 'LIVE';

      // Prefer an entry with actual playback
      if (lang) {
        const existing = g.streams[lang];
        const existingHasPlayback = existing && hasPlayback(existing);
        if (!existing || (!existingHasPlayback && hasPlayback(m))) {
          g.streams[lang] = m;
        }
        if (!g.languages.includes(lang)) g.languages.push(lang);
      } else {
        // No language tag — keep the first playable entry under "_default"
        const existing = g.streams._default;
        if (!existing || (!hasPlayback(existing) && hasPlayback(m))) {
          g.streams._default = m;
        }
      }

      // Prefer non-empty title
      if (!g.title || g.title === 'Live Match') {
        g.title = pickMatchTitle([m.match_name, m.event_name]);
      }

      // Prefer real cover image
      if (!g.images.coverImage) g.images.coverImage = safeUrl(m.src);

      // Prefer a real broadcast channel (first non-empty)
      if (!g.channel) g.channel = m.broadcast_channel || '';
    }

    // Determine `key` from the primary playable entry's contentId so the
    // player link is stable: sonyliv-player.html?id=<contentId>
    for (const g of groups.values()) {
      const primaryLang = g.languages.includes('ENG')
        ? 'ENG'
        : g.languages[0] || '_default';
      const primary = g.streams[primaryLang] || g.streams._default;
      g.playerId = String(
        primary?.contentId ||
          g.allEntries.find((e) => hasPlayback(e))?.contentId ||
          g.baseContentId ||
          ''
      );
    }

    return [...groups.values()];
  }

  // ---------- POSTER ----------

  function getPosterCandidates(group) {
    return [...new Set([
      group.images.coverImage,
      ...group.allEntries.map((m) => safeUrl(m.src)),
    ].filter(Boolean))];
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

    const langLabel = group.languages.join(' / ');

    const meta = [
      group.eventName || group.category,
      langLabel,
      group.channel,
    ]
      .filter(Boolean)
      .join(' · ');

    const playable =
      isLive &&
      !!group.playerId &&
      group.allEntries.some((m) => hasPlayback(m));

    const open = playable
      ? `<a class="card sonyliv-live-card"
           href="sonyliv-player.html?id=${encodeURIComponent(group.playerId)}"`
      : `<button class="card sonyliv-live-card"
           type="button"
           data-message="${esc(
             isLive
               ? 'Stream not yet available for this match'
               : 'This match is upcoming'
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
        <div class="thumb sonyliv-live-thumb">
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
    rail.style.setProperty('--sl-arrow-top', Math.max(0, top) + 'px');
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

      // LIVE first, then upcoming.
      ordered.sort((a, b) => {
        if (a.status === 'LIVE' && b.status !== 'LIVE') return -1;
        if (b.status === 'LIVE' && a.status !== 'LIVE') return 1;
        return 0;
      });

      const nextCards = ordered.length
        ? ordered.map(renderCard).join('')
        : '<div class="wl-empty">No SonyLIV matches available.</div>';

      if (nextCards !== renderedCards) {
        const left = track.scrollLeft;
        track.innerHTML = nextCards;
        track.scrollLeft = left;
        renderedCards = nextCards;
        scheduleArrows();
      }

      loaded = true;
    } catch (error) {
      console.error('[SonyLIVLive]', error);
      if (!loaded) {
        track.innerHTML = `
          <div class="wl-empty">
            Unable to load SonyLIV matches.
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
      'button.sonyliv-live-card[data-message]'
    );
    if (info) alert(info.dataset.message);
  });

  // ---------- POSTER FALLBACK ----------

  track.addEventListener('error', (event) => {
    const img = event.target;
    if (
      !(img instanceof HTMLImageElement) ||
      !img.matches('.sonyliv-live-thumb img')
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

  window.SonyLIVLive = { reload: loadMatches };

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
