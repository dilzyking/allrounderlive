/* ============================================================
   allsports.js - All Sports Section (FanCode-style carousel)
   ============================================================ */

// ⬇️ Replace with your deployed Worker URL
const ALLSPORTS_API = "https://all-sports.freedekholive-577.workers.dev/";

const SKELETON_COUNT = 6;

(function () {
  const track = document.getElementById("allsportsTrack");
  const prevBtn = document.getElementById("allsportsPrev");
  const nextBtn = document.getElementById("allsportsNext");
  const countEl = document.getElementById("allsportsCount");
  if (!track) return;

  let loaded = false;

  /* ---------- Skeleton ---------- */
  function showSkeleton() {
    track.innerHTML = Array.from({ length: SKELETON_COUNT }).map(() => `
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

  /* ---------- Load ---------- */
  async function loadEvents() {
    if (!loaded) showSkeleton();

    try {
      const res = await fetch(ALLSPORTS_API);
      const events = await res.json();

      if (!Array.isArray(events) || events.length === 0) {
        track.innerHTML = `<div class="allsports-empty">No events found.</div>`;
        if (countEl) countEl.textContent = "0";
        return;
      }

      // sort: live → upcoming → ended
      const order = { live: 0, upcoming: 1, ended: 2, unknown: 3 };
      events.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));

      track.innerHTML = events.map(renderCard).join("");
      if (countEl) countEl.textContent = `${events.length} events`;
      loaded = true;
    } catch (err) {
      console.error("[AllSports] load failed:", err);
      track.innerHTML = `<div class="allsports-empty">Failed to load events.</div>`;
    }
  }

  /* ---------- Card ---------- */
  function renderCard(ev) {
    const e = ev.event || {};
    const status = ev.status || "unknown";

    return `
      <div class="allsports-card" onclick="AllSports.open('${ev.slug}')">
        <div class="allsports-thumb">

          <span class="allsports-badge ${status}">${status}</span>

          <div class="allsports-event-name" title="${esc(e.name || ev.title || '')}">
            ${esc(e.name || ev.title || "")}
          </div>

          <div class="allsports-teams">
            <div class="allsports-team">
              <img src="${e.teamAFlag || ''}" alt="${esc(e.teamA || '')}" loading="lazy"
                   onerror="this.style.visibility='hidden'">
              <span>${esc(e.teamA || "")}</span>
            </div>
            <div class="allsports-vs">VS</div>
            <div class="allsports-team">
              <img src="${e.teamBFlag || ''}" alt="${esc(e.teamB || '')}" loading="lazy"
                   onerror="this.style.visibility='hidden'">
              <span>${esc(e.teamB || "")}</span>
            </div>
          </div>
        </div>

        <div class="allsports-info">
          <div class="allsports-meta">
            <span class="allsports-category">${esc(e.category || "")}</span>
            <span class="allsports-time">⏱ ${esc(e.startTimeIST || "")}</span>
          </div>
        </div>
      </div>
    `;
  }

  /* ---------- Utils ---------- */
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ---------- Arrows ---------- */
  function scrollByCard(dir) {
    const card = track.querySelector(".allsports-card, .as-skeleton-card");
    if (!card) return;
    const gap = parseInt(getComputedStyle(track).gap) || 20;
    const step = card.offsetWidth + gap;
    track.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  prevBtn?.addEventListener("click", () => scrollByCard(-1));
  nextBtn?.addEventListener("click", () => scrollByCard(1));

  /* ---------- Public ---------- */
  window.AllSports = {
    open(slug) {
      window.location.href = `player.html?slug=${encodeURIComponent(slug)}`;
    },
    reload: loadEvents
  };

  /* ---------- Boot ---------- */
  loadEvents();
  setInterval(loadEvents, 60_000);
})();
