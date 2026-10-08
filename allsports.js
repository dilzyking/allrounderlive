/* ===== All Sports Section Loader ===== */

// ⬇️ Replace with your deployed Worker URL
const ALLSPORTS_API = "https://all-sports.freedekholive-577.workers.dev/";

const SKELETON_COUNT = 8;   // how many placeholder cards to show

(function () {
  const grid = document.getElementById("allSportsGrid");
  if (!grid) return;

  /* ---------- Skeleton ---------- */
  function showSkeleton() {
    grid.innerHTML = Array.from({ length: SKELETON_COUNT }).map(() => `
      <div class="allsports-skel">
        <div class="skel-badge"></div>
        <div class="skel-name"></div>
        <div class="skel-name short"></div>
        <div class="skel-teams">
          <div class="skel-circle"></div>
          <div class="skel-vs"></div>
          <div class="skel-circle"></div>
        </div>
        <div class="skel-time"></div>
      </div>
    `).join("");
  }

  /* ---------- Load events ---------- */
  async function loadEvents() {
    // Only show skeleton on first load (empty grid)
    if (!grid.dataset.loaded) showSkeleton();

    try {
      const res = await fetch(ALLSPORTS_API);
      const events = await res.json();

      if (!Array.isArray(events) || events.length === 0) {
        grid.innerHTML = `<div class="allsports-empty">No events found.</div>`;
        return;
      }

      // sort: live → upcoming → ended
      const order = { live: 0, upcoming: 1, ended: 2, unknown: 3 };
      events.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));

      grid.innerHTML = events.map(renderCard).join("");
      grid.dataset.loaded = "1";
    } catch (err) {
      console.error("[AllSports] load failed:", err);
      grid.innerHTML = `<div class="allsports-empty">Failed to load events.</div>`;
    }
  }

  /* ---------- Card ---------- */
  function renderCard(ev) {
    const e = ev.event || {};
    const status = ev.status || "unknown";

    return `
      <div class="allsports-card" onclick="AllSports.open('${ev.slug}')">
        <span class="allsports-badge ${status}">${status}</span>

        <div class="allsports-name">${esc(e.name || ev.title || "")}</div>

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

        <div class="allsports-time">${esc(e.startTimeIST || "")}</div>
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

  /* ---------- Public namespace ---------- */
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
