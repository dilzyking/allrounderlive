/* =========================================================
   CRICKET
   Same card layout as Football.
   API: https://allrounderlive.com/api/cricket.json
   Player: cricket?slug=...
   ========================================================= */

(function bootCricket() {
  'use strict';

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      bootCricket,
      { once: true }
    );
    return;
  }

  const API =
    'https://allrounderlive.com/api/cricket.json';

  const REFRESH_INTERVAL = 60000;
  const SKELETON_COUNT = 6;

  const track = document.getElementById(
    'cricketLiveTrack'
  );

  if (!track || track.dataset.initialized === 'true') {
    return;
  }

  track.dataset.initialized = 'true';

  const section = track.closest(
    '.cricket-live-section'
  );

  const rail = track.closest('.live-rail');
  const prevBtn = document.getElementById('cricketLivePrev');
  const nextBtn = document.getElementById('cricketLiveNext');

  const reduced = matchMedia(
    '(prefers-reduced-motion: reduce)'
  );

  let loaded = false;
  let loading = false;
  let visible = false;
  let refreshTimer = null;
  let renderedCards = null;
  let arrowFrame = 0;

  // ---------- HELPERS ----------

  function esc(value) {
    return String(value ?? '').replace(
      /[&<>"']/g,
      function (character) {
        return {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        }[character];
      }
    );
  }

  function cleanUrl(value) {
    if (typeof value !== 'string') {
      return '';
    }

    const url = value.split('|')[0].trim();

    return /^https?:\/\//i.test(url) ? url : '';
  }

  function getInitials(name) {
    return String(name || 'TEAM')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(function (part) {
        return part.charAt(0).toUpperCase();
      })
      .join('');
  }

  // ---------- TEAM IMAGES ----------

  function getImageCandidates(event, side) {
    return [
      ...new Set(
        [
          event['team' + side + 'Flag'],
          event['team' + side + 'Logo'],
          event['team' + side + 'Image'],
          event.logo,
          event.eventLogo
        ]
          .map(cleanUrl)
          .filter(Boolean)
      )
    ];
  }

  function imageLoaded(img) {
    if (!img || !img.naturalWidth) {
      return;
    }

    img.style.visibility = 'visible';
    img.parentElement.classList.add('has-image');
  }

  function imageFallback(img) {
    if (!img) {
      return;
    }

    let candidates;

    try {
      candidates = JSON.parse(
        img.dataset.candidates || '[]'
      );
    } catch {
      candidates = [];
    }

    let index = Number(img.dataset.index || 0);

    if (
      img.dataset.proxy !== '1' &&
      candidates[index]
    ) {
      img.dataset.proxy = '1';

      img.src =
        'https://wsrv.nl/?url=' +
        encodeURIComponent(candidates[index]) +
        '&w=240&h=240&fit=contain';

      return;
    }

    index++;

    if (index < candidates.length) {
      img.dataset.index = String(index);
      img.dataset.proxy = '0';
      img.src = candidates[index];
      return;
    }

    img.onerror = null;
    img.onload = null;
    img.remove();
  }

  function renderTeam(name, event, side) {
    const candidates = getImageCandidates(
      event,
      side
    );

    return `
      <div class="cl-team">
        <div class="cl-team-image-wrap">
          <div class="cl-team-placeholder">
            ${esc(getInitials(name))}
          </div>

          ${
            candidates.length
              ? `
                <img
                  src="${esc(candidates[0])}"
                  alt="${esc(name)}"
                  loading="lazy"
                  decoding="async"
                  referrerpolicy="no-referrer"
                  data-candidates="${esc(JSON.stringify(candidates))}"
                  data-index="0"
                  data-proxy="0"
                  onload="CricketLive.imageLoaded(this)"
                  onerror="CricketLive.imageFallback(this)"
                >
              `
              : ''
          }
        </div>

        <span
          class="cl-team-name"
          title="${esc(name)}"
        >
          ${esc(name)}
        </span>
      </div>
    `;
  }

  // ---------- STATUS AND TIME ----------

  function getStatus(event) {
    const status = String(
      event.status || ''
    ).trim().toLowerCase();

    return ['live', 'upcoming', 'ended'].includes(status)
      ? status
      : 'unknown';
  }

  function parseUTC(value) {
    if (!value) {
      return NaN;
    }

    let text = String(value)
      .trim()
      .replace(/\//g, '-')
      .replace(/\s+\+0000$/, 'Z')
      .replace(' ', 'T');

    if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
      text += 'Z';
    }

    return Date.parse(text);
  }

  function formatTime(event) {
    const timestamp = parseUTC(
      event.startTimeUTC
    );

    if (Number.isFinite(timestamp)) {
      const parts = new Intl.DateTimeFormat(
        'en-GB',
        {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: '2-digit',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }
      ).formatToParts(new Date(timestamp));

      const values = Object.fromEntries(
        parts.map(function (part) {
          return [part.type, part.value];
        })
      );

      return (
        values.day + '/' + values.month +
        ' · ' +
        Number(values.hour) + ':' + values.minute +
        ' ' + values.dayPeriod.toUpperCase() +
        ' IST'
      );
    }

    const text = String(
      event.startTimeIST || ''
    );

    const match = text.match(
      /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/
    );

    if (!match) {
      return text || 'Time TBA';
    }

    const hour = Number(match[4]);

    return (
      match[3] + '/' + match[2] +
      ' · ' +
      (hour % 12 || 12) + ':' + match[5] +
      ' ' + (hour >= 12 ? 'PM' : 'AM') +
      ' IST'
    );
  }

  function sortEvents(data) {
    const order = {
      live: 0,
      upcoming: 1,
      ended: 2,
      unknown: 3
    };

    return data
      .filter(function (event) {
        return event && typeof event === 'object';
      })
      .sort(function (a, b) {
        const difference =
          order[getStatus(a)] -
          order[getStatus(b)];

        if (difference) {
          return difference;
        }

        const aTime = parseUTC(
          a.event?.startTimeUTC
        );

        const bTime = parseUTC(
          b.event?.startTimeUTC
        );

        if (
          Number.isFinite(aTime) &&
          Number.isFinite(bTime)
        ) {
          return aTime - bTime;
        }

        return 0;
      });
  }

  // ---------- MATCH CARDS ----------

  function renderStatus(status) {
    if (status === 'live') {
      return '<span class="badge">LIVE</span>';
    }

    if (status === 'upcoming') {
      return `
        <span
          class="cl-upcoming-icon"
          role="img"
          aria-label="Upcoming match"
          title="Upcoming match"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5-6.7V3a2 2 0 0 0-4 0v1.3A7 7 0 0 0 5 11v5l-2 2v1h18v-1z"></path>
          </svg>
        </span>
      `;
    }

    return '';
  }

  function renderCard(event) {
    const details = event.event || {};
    const status = getStatus(event);

    const name =
      details.name ||
      event.title ||
      'Cricket Match';

    const teamA = details.teamA || 'Team A';
    const teamB = details.teamB || 'Team B';

    const category =
      details.category ||
      event.cat ||
      'Cricket';

    const slug = event.slug || '';

    const href =
      'cricket?slug=' + encodeURIComponent(slug);

    const metadata =
      category + ' · ' + formatTime(details);

    const statusText = {
      live: 'Live',
      upcoming: 'Upcoming',
      ended: 'Ended',
      unknown: 'Status unavailable'
    }[status];

    return `
      <a
        class="card cricket-live-card"
        href="${esc(href)}"
        data-slug="${esc(slug)}"
        aria-label="${esc(name + ' — ' + statusText)}"
      >
        <div class="thumb cricket-live-thumb">
          <div class="cl-poster-content">
            <div
              class="cl-event-name"
              title="${esc(name)}"
            >
              ${esc(name)}
            </div>

            <div class="cl-teams">
              ${renderTeam(teamA, details, 'A')}

              <div class="cl-vs">VS</div>

              ${renderTeam(teamB, details, 'B')}
            </div>
          </div>

          ${renderStatus(status)}
        </div>

        <div class="caption">
          <span title="${esc(name)}">${esc(name)}</span>
          <span class="cl-meta" title="${esc(metadata)}">${esc(metadata)}</span>
        </div>
      </a>
    `;
  }

  // ---------- SIDE ARROW POSITION ----------

  function updateArrows() {
    const thumb = track.querySelector('.thumb');

    if (!thumb || !prevBtn || !rail) {
      return;
    }

    const top =
      thumb.getBoundingClientRect().height / 2 -
      prevBtn.getBoundingClientRect().height / 2;

    rail.style.setProperty(
      '--cl-arrow-top',
      Math.max(0, top) + 'px'
    );
  }

  function scheduleArrows() {
    if (arrowFrame) {
      return;
    }

    arrowFrame = requestAnimationFrame(function () {
      arrowFrame = 0;
      updateArrows();
    });
  }

  // ---------- SKELETON ----------

  function showSkeleton() {
    track.innerHTML = Array.from(
      { length: SKELETON_COUNT },
      function () {
        return `
          <div
            class="card cl-skeleton-card"
            aria-hidden="true"
          >
            <div class="thumb cl-skeleton-thumb"></div>

            <div class="caption">
              <div class="cl-skeleton-line"></div>
              <div class="cl-skeleton-line"></div>
            </div>
          </div>
        `;
      }
    ).join('');

    scheduleArrows();
  }

  // ---------- FETCH AND REFRESH ----------

  async function loadEvents() {
    if (loading) {
      return;
    }

    loading = true;
    track.setAttribute('aria-busy', 'true');

    if (!loaded) {
      showSkeleton();
    }

    const controller = new AbortController();

    const timeout = setTimeout(function () {
      controller.abort();
    }, 15000);

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
        throw new Error(
          'API error: ' + response.status
        );
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error('Invalid API response');
      }

      const events = sortEvents(data);

      const nextCards = events.length
        ? events.map(renderCard).join('')
        : `
          <div class="cl-empty">
            No cricket matches available.
          </div>
        `;

      if (nextCards !== renderedCards) {
        const scrollPosition = track.scrollLeft;

        track.innerHTML = nextCards;
        track.scrollLeft = scrollPosition;
        renderedCards = nextCards;

        scheduleArrows();
      }

      loaded = true;
    } catch (error) {
      console.error('[CricketLive]', error);

      if (!loaded) {
        track.innerHTML = `
          <div class="cl-empty">
            Unable to load cricket matches.
            <button
              type="button"
              class="cl-retry"
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

    if (!card) {
      return;
    }

    const gap =
      parseFloat(
        getComputedStyle(track).columnGap
      ) || 0;

    track.scrollBy({
      left: direction * (card.offsetWidth + gap),
      behavior: reduced.matches ? 'auto' : 'smooth'
    });
  }

  prevBtn?.addEventListener('click', function () {
    scrollByCard(-1);
  });

  nextBtn?.addEventListener('click', function () {
    scrollByCard(1);
  });

  // Native card links preserve normal keyboard and new-tab behaviour.
  track.addEventListener('click', function (event) {
    if (event.target.closest('.cl-retry')) {
      loadEvents();
      return;
    }

    const card = event.target.closest(
      '.cricket-live-card'
    );

    if (card && !card.dataset.slug) {
      event.preventDefault();
    }
  });

  // ---------- VISIBLE-ONLY REFRESH ----------

  function stopRefresh() {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  function startRefresh() {
    if (
      refreshTimer ||
      document.hidden ||
      !visible
    ) {
      return;
    }

    refreshTimer = setInterval(function () {
      if (visible && !document.hidden) {
        loadEvents();
      }
    }, REFRESH_INTERVAL);
  }

  function handleVisibility(isVisible) {
    visible = isVisible;

    if (visible) {
      if (!loaded && !document.hidden) {
        loadEvents();
      }

      startRefresh();
      scheduleArrows();
    } else {
      stopRefresh();
    }
  }

  // ---------- PUBLIC HELPERS ----------

  window.CricketLive = {
    open: function (slug) {
      if (slug) {
        window.location.href =
          'cricket?slug=' + encodeURIComponent(slug);
      }
    },
    imageLoaded: imageLoaded,
    imageFallback: imageFallback,
    reload: loadEvents
  };

  // ---------- INITIALIZATION ----------

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

  if ('IntersectionObserver' in window && section) {
    const observer = new IntersectionObserver(
      function (entries) {
        handleVisibility(
          entries[0].isIntersecting
        );
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

  document.addEventListener(
    'visibilitychange',
    function () {
      if (document.hidden) {
        stopRefresh();
      } else if (visible) {
        loadEvents();
        startRefresh();
      }
    }
  );
})();
