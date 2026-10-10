const ALLSPORTS_API = "https://all-sports.freedekholive-577.workers.dev/football.json";
const SKELETON_COUNT = 6;
const REFRESH_INTERVAL = 60000;

(function () {
  "use strict";

  const track = document.getElementById("allsportsTrack");
  const prevBtn = document.getElementById("allsportsPrev");
  const nextBtn = document.getElementById("allsportsNext");
  const countEl = document.getElementById("allsportsCount");

  if (!track) return;

  const section = track.closest(".allsports-section");

  let loaded = false;
  let loading = false;
  let initialized = false;
  let sectionVisible = false;
  let refreshTimer = null;
  let events = [];

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function cleanUrl(value) {
    if (!value || typeof value !== "string") return "";

    const url = value.split("|")[0].trim();

    return /^https?:\/\//i.test(url) ? url : "";
  }

  function getInitials(name) {
    return String(name || "TEAM")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join("");
  }

  function getImageCandidates(event, side) {
    const urls = [];

    function add(value) {
      const url = cleanUrl(value);

      if (url && !urls.includes(url)) {
        urls.push(url);
      }
    }

    if (side === "A") {
      add(event.teamAFlag);
      add(event.teamALogo);
      add(event.teamAImage);
    } else {
      add(event.teamBFlag);
      add(event.teamBLogo);
      add(event.teamBImage);
    }

    add(event.logo);
    add(event.eventLogo);

    return urls;
  }

  function getProxyUrl(url) {
    try {
      const parsed = new URL(url);

      if (!["http:", "https:"].includes(parsed.protocol)) {
        return "";
      }

      return (
        "https://wsrv.nl/?url=" +
        encodeURIComponent(url) +
        "&w=240&h=240&fit=contain"
      );
    } catch {
      return "";
    }
  }

  function renderTeamImage(name, event, side) {
    const candidates = getImageCandidates(event, side);

    return `
      <div class="as-team-image-wrap">
        <div class="as-team-placeholder">
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
                onload="AllSports.imageLoaded(this)"
                onerror="AllSports.imageFallback(this)"
              >
            `
            : ""
        }
      </div>
    `;
  }

  function imageLoaded(img) {
    if (img && img.naturalWidth > 0) {
      img.style.visibility = "visible";
    }
  }

  function imageFallback(img) {
    if (!img) return;

    let candidates = [];

    try {
      candidates = JSON.parse(
        img.dataset.candidates || "[]"
      );
    } catch {
      candidates = [];
    }

    let index = Number(img.dataset.index || 0);
    const proxyTried = img.dataset.proxy === "1";

    if (!proxyTried && candidates[index]) {
      const proxy = getProxyUrl(candidates[index]);

      if (proxy) {
        img.dataset.proxy = "1";
        img.src = proxy;
        return;
      }
    }

    index++;

    if (index < candidates.length) {
      img.dataset.index = String(index);
      img.dataset.proxy = "0";
      img.src = candidates[index];
      return;
    }

    img.onerror = null;
    img.onload = null;
    img.remove();
  }

  function getStatus(event) {
    const status = String(
      event.status || "unknown"
    ).toLowerCase();

    return ["live", "upcoming", "ended"].includes(status)
      ? status
      : "unknown";
  }

  function parseTime(value) {
    if (!value) return NaN;

    return Date.parse(
      String(value)
        .replace(/\//g, "-")
        .replace(/\s+\+0000$/, "Z")
        .replace(" ", "T")
    );
  }

  function sortEvents(data) {
    const order = {
      live: 0,
      upcoming: 1,
      ended: 2,
      unknown: 3
    };

    return [...data].sort((a, b) => {
      const statusDiff =
        (order[getStatus(a)] ?? 3) -
        (order[getStatus(b)] ?? 3);

      if (statusDiff !== 0) return statusDiff;

      const aTime = parseTime(a.event?.startTimeUTC);
      const bTime = parseTime(b.event?.startTimeUTC);

      if (
        Number.isFinite(aTime) &&
        Number.isFinite(bTime)
      ) {
        return aTime - bTime;
      }

      return 0;
    });
  }

  function formatTime(value) {
    if (!value) return "Time TBA";

    const text = String(value);

    const match = text.match(
      /(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/
    );

    if (!match) return text;

    const [, year, month, day, hour, minute] = match;

    const hours = Number(hour);
    const displayHour = hours % 12 || 12;
    const period = hours >= 12 ? "PM" : "AM";

    return `${day}/${month} · ${displayHour}:${minute} ${period} IST`;
  }

  function getButtonLabel(status) {
    return status === "live" ? "Watch Live" : "Watch Now";
  }

  function renderCard(ev) {
    const e = ev.event || {};
    const status = getStatus(ev);

    const name = e.name || ev.title || "Sports Event";
    const teamA = e.teamA || "Team A";
    const teamB = e.teamB || "Team B";
    const category = e.category || ev.cat || "Sports";
    const slug = ev.slug || "";

    const buttonLabel = getButtonLabel(status);

    const playIcon = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 5.5v13l10-6.5z"></path>
      </svg>
    `;

    return `
      <article
        class="allsports-card"
        data-slug="${esc(slug)}"
        role="link"
        tabindex="0"
        aria-label="${esc(name)}"
      >
        <div class="allsports-thumb">

          <div class="allsports-glass-orb one"></div>
          <div class="allsports-glass-orb two"></div>

          <div class="allsports-topbar">
            <span class="allsports-sport-tag">
              ${esc(category)}
            </span>

            <span class="allsports-badge ${status}">
              ${esc(status)}
            </span>
          </div>

          <div class="allsports-match-content">

            <div
              class="allsports-event-name"
              title="${esc(name)}"
            >
              ${esc(name)}
            </div>

            <div class="allsports-teams">

              <div class="allsports-team">
                ${renderTeamImage(teamA, e, "A")}

                <span class="allsports-team-name">
                  ${esc(teamA)}
                </span>
              </div>

              <div class="allsports-vs">
                VS
              </div>

              <div class="allsports-team">
                ${renderTeamImage(teamB, e, "B")}

                <span class="allsports-team-name">
                  ${esc(teamB)}
                </span>
              </div>

            </div>

          </div>

        </div>

        <div class="allsports-info">

          <div
            class="allsports-info-title"
            title="${esc(name)}"
          >
            ${esc(name)}
          </div>

          <div class="allsports-meta">

            <div class="allsports-meta-left">

              <span class="allsports-category">
                ${esc(category)}
              </span>

              <span class="allsports-time">
                ${esc(formatTime(e.startTimeIST))}
              </span>

            </div>

            <button
              type="button"
              class="allsports-watch-btn ${status}"
              data-slug="${esc(slug)}"
              aria-label="${esc(buttonLabel + " - " + name)}"
            >
              ${playIcon}
              <span>${esc(buttonLabel)}</span>
            </button>

          </div>

        </div>

      </article>
    `;
  }

  function showSkeleton() {
    track.innerHTML = Array.from(
      { length: SKELETON_COUNT },
      () => `
        <div class="as-skeleton-card">

          <div class="as-skeleton-thumb">
            <div class="as-skeleton-badge"></div>
            <div class="as-skeleton-name"></div>

            <div class="as-skeleton-teams">
              <div class="as-skeleton-circle"></div>
              <div class="as-skeleton-vs"></div>
              <div class="as-skeleton-circle"></div>
            </div>
          </div>

          <div class="as-skeleton-info">
            <div class="as-skeleton-line short"></div>
            <div class="as-skeleton-line medium"></div>
          </div>

        </div>
      `
    ).join("");
  }

  async function loadEvents() {
    if (loading) return;

    loading = true;

    if (!loaded) {
      showSkeleton();
    }

    try {
      const response = await fetch(ALLSPORTS_API, {
        method: "GET",
        cache: "no-cache",
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Invalid API response");
      }

      events = sortEvents(data);

      if (!events.length) {
        track.innerHTML = `
          <div class="allsports-empty">
            No events available.
          </div>
        `;

        if (countEl) {
          countEl.textContent = "0 events";
        }

        loaded = true;
        return;
      }

      const scrollPosition = loaded
        ? track.scrollLeft
        : 0;

      track.innerHTML = events.map(renderCard).join("");

      if (loaded) {
        track.scrollLeft = scrollPosition;
      }

      if (countEl) {
        countEl.textContent = `${events.length} events`;
      }

      loaded = true;

    } catch (error) {
      console.error("[AllSports]", error);

      if (!loaded) {
        track.innerHTML = `
          <div class="allsports-empty">
            Failed to load events.
          </div>
        `;
      }
    } finally {
      loading = false;
    }
  }

  function scrollByCard(direction) {
    const card = track.querySelector(
      ".allsports-card, .as-skeleton-card"
    );

    if (!card) return;

    const styles = getComputedStyle(track);

    const gap =
      parseFloat(styles.columnGap) ||
      parseFloat(styles.gap) ||
      20;

    track.scrollBy({
      left: direction * (card.offsetWidth + gap),
      behavior: "smooth"
    });
  }

  function openPlayer(slug) {
    if (!slug) return;

    window.location.href =
      `player.html?slug=${encodeURIComponent(slug)}`;
  }

  prevBtn?.addEventListener("click", () => {
    scrollByCard(-1);
  });

  nextBtn?.addEventListener("click", () => {
    scrollByCard(1);
  });

  track.addEventListener("click", event => {
    const card = event.target.closest(".allsports-card");

    if (!card) return;

    openPlayer(card.dataset.slug);
  });

  track.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const card = event.target.closest(".allsports-card");

    if (!card) return;

    event.preventDefault();
    openPlayer(card.dataset.slug);
  });

  function startRefresh() {
    if (refreshTimer || document.hidden) return;

    refreshTimer = setInterval(() => {
      if (sectionVisible && !document.hidden) {
        loadEvents();
      }
    }, REFRESH_INTERVAL);
  }

  function stopRefresh() {
    if (!refreshTimer) return;

    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  function initializeSection() {
    if (initialized) return;

    initialized = true;
    loadEvents();
  }

  function handleVisibility(isVisible) {
    sectionVisible = isVisible;

    if (isVisible) {
      initializeSection();
      startRefresh();
    } else {
      stopRefresh();
    }
  }

  window.AllSports = {
    open: openPlayer,
    imageLoaded,
    imageFallback,
    reload: loadEvents
  };

  if ("IntersectionObserver" in window && section) {
    const observer = new IntersectionObserver(
      entries => {
        handleVisibility(entries[0].isIntersecting);
      },
      {
        rootMargin: "300px 0px",
        threshold: 0
      }
    );

    observer.observe(section);
  } else {
    handleVisibility(true);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopRefresh();
    } else if (sectionVisible) {
      if (initialized) {
        loadEvents();
      }

      startRefresh();
    }
  });
})();
