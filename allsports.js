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

  let loaded = false;
  let loading = false;
  let events = [];

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function cleanUrl(url) {
    if (!url || typeof url !== "string") return "";

    const cleaned = url.split("|")[0].trim();

    if (!/^https?:\/\//i.test(cleaned)) return "";

    return cleaned;
  }

  function getInitials(name) {
    if (!name) return "FC";

    return String(name)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(word => word.charAt(0).toUpperCase())
      .join("");
  }

  function getImageCandidates(event, side) {
    const candidates = [];

    const add = value => {
      const url = cleanUrl(value);

      if (url && !candidates.includes(url)) {
        candidates.push(url);
      }
    };

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

    return candidates;
  }

  function getProxyUrl(url) {
    if (!url) return "";

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
    const firstImage = candidates[0] || "";
    const initials = getInitials(name);

    return `
      <div class="as-team-image-wrap"
           style="
             width:48px;
             height:48px;
             position:relative;
             display:flex;
             align-items:center;
             justify-content:center;
             flex-shrink:0;
           ">

        <div class="as-team-placeholder"
             style="
               position:absolute;
               inset:0;
               display:flex;
               align-items:center;
               justify-content:center;
               border-radius:50%;
               background:linear-gradient(
                 135deg,
                 rgba(255,255,255,.16),
                 rgba(255,255,255,.05)
               );
               border:1px solid rgba(255,255,255,.12);
               color:#fff;
               font-size:14px;
               font-weight:800;
               letter-spacing:.5px;
             ">
          ${esc(initials)}
        </div>

        ${
          firstImage
            ? `
              <img
                src="${esc(firstImage)}"
                alt="${esc(name)}"
                loading="lazy"
                decoding="async"
                referrerpolicy="no-referrer"
                data-candidates="${esc(JSON.stringify(candidates))}"
                data-index="0"
                data-proxy="0"
                onload="AllSports.imageLoaded(this)"
                onerror="AllSports.imageFallback(this)"
                style="
                  position:relative;
                  z-index:1;
                  width:100%;
                  height:100%;
                  object-fit:contain;
                  visibility:hidden;
                "
              >
            `
            : ""
        }

      </div>
    `;
  }

  function imageLoaded(img) {
    if (!img) return;

    if (img.naturalWidth > 0) {
      img.style.visibility = "visible";
    }
  }

  function imageFallback(img) {
    if (!img) return;

    let candidates = [];

    try {
      candidates = JSON.parse(
        img.getAttribute("data-candidates") || "[]"
      );
    } catch {
      candidates = [];
    }

    let index = Number(img.dataset.index || 0);
    const proxyTried = img.dataset.proxy === "1";
    const currentUrl = candidates[index];

    if (!proxyTried && currentUrl) {
      const proxyUrl = getProxyUrl(currentUrl);

      if (proxyUrl) {
        img.dataset.proxy = "1";
        img.src = proxyUrl;
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
    img.style.display = "none";
  }

  function showSkeleton() {
    track.innerHTML = Array.from({
      length: SKELETON_COUNT
    }).map(() => `
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
    `).join("");
  }

  function getStatus(event) {
    const status = String(
      event.status || "unknown"
    ).toLowerCase();

    if (["live", "upcoming", "ended"].includes(status)) {
      return status;
    }

    return "unknown";
  }

  function parseTime(value) {
    if (!value) return NaN;

    const normalized = String(value)
      .replace(/\//g, "-")
      .replace(/\s+\+0000$/, "Z")
      .replace(" ", "T");

    return Date.parse(normalized);
  }

  function sortEvents(data) {
    const order = {
      live: 0,
      upcoming: 1,
      ended: 2,
      unknown: 3
    };

    return [...data].sort((a, b) => {
      const aStatus = getStatus(a);
      const bStatus = getStatus(b);

      const statusDiff =
        (order[aStatus] ?? 3) -
        (order[bStatus] ?? 3);

      if (statusDiff !== 0) return statusDiff;

      const aTime = parseTime(a.event?.startTimeUTC);
      const bTime = parseTime(b.event?.startTimeUTC);

      if (Number.isFinite(aTime) && Number.isFinite(bTime)) {
        return aTime - bTime;
      }

      return 0;
    });
  }

  function renderCard(ev) {
    const e = ev.event || {};
    const status = getStatus(ev);
    const name = e.name || ev.title || "";
    const teamA = e.teamA || "Team A";
    const teamB = e.teamB || "Team B";
    const category = e.category || ev.cat || "";
    const startTime = e.startTimeIST || "";
    const slug = ev.slug || "";

    return `
      <div
        class="allsports-card"
        data-slug="${esc(slug)}"
        role="link"
        tabindex="0"
      >
        <div class="allsports-thumb">

          <span class="allsports-badge ${status}">
            ${esc(status)}
          </span>

          <div
            class="allsports-event-name"
            title="${esc(name)}"
          >
            ${esc(name)}
          </div>

          <div class="allsports-teams">

            <div class="allsports-team">
              ${renderTeamImage(teamA, e, "A")}
              <span>${esc(teamA)}</span>
            </div>

            <div class="allsports-vs">VS</div>

            <div class="allsports-team">
              ${renderTeamImage(teamB, e, "B")}
              <span>${esc(teamB)}</span>
            </div>

          </div>
        </div>

        <div class="allsports-info">
          <div class="allsports-meta">

            <span class="allsports-category">
              ${esc(category)}
            </span>

            <span class="allsports-time">
              ⏱ ${esc(startTime)}
            </span>

          </div>
        </div>
      </div>
    `;
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
        throw new Error("Invalid API response format");
      }

      events = sortEvents(data);

      if (events.length === 0) {
        track.innerHTML = `
          <div class="allsports-empty">
            No events found.
          </div>
        `;

        if (countEl) {
          countEl.textContent = "0 events";
        }

        loaded = true;
        return;
      }

      const previousScroll = loaded ? track.scrollLeft : 0;

      track.innerHTML = events.map(renderCard).join("");

      if (loaded) {
        track.scrollLeft = previousScroll;
      }

      if (countEl) {
        countEl.textContent = `${events.length} events`;
      }

      loaded = true;

    } catch (error) {
      console.error("[AllSports] Failed to load:", error);

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

    const step = card.offsetWidth + gap;

    track.scrollBy({
      left: direction * step,
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

  window.AllSports = {
    open: openPlayer,
    imageLoaded,
    imageFallback,
    reload: loadEvents
  };

  loadEvents();

  setInterval(loadEvents, REFRESH_INTERVAL);
})();
