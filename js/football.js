/* Football data loader: existing API and football?slug= player route. */
(function bootFootball() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootFootball, {once:true});
    return;
  }
  'use strict';
  const API = 'https://allrounderlive.com/api/football.json';
  const track = document.getElementById('allsportsTrack');
  if (!track) return;
  const section = track.closest('.allsports-section');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let loaded = false, loading = false, visible = false, timer = null, rendered = null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const statusOf = ev => {
    const s = String(ev.status || '').toLowerCase();
    return ['live', 'upcoming', 'ended'].includes(s) ? s : 'unknown';
  };
  function cleanUrl(value) {
    const u = typeof value === 'string' ? value.split('|')[0].trim() : '';
    return /^https?:\/\//i.test(u) ? u : '';
  }
  function imageCandidates(e, side) {
    return [...new Set([e['team'+side+'Flag'], e['team'+side+'Logo'],
      e['team'+side+'Image'], e.logo, e.eventLogo].map(cleanUrl).filter(Boolean))];
  }
  function imageLoaded(img) {
    if (img.naturalWidth) {
      img.style.visibility = 'visible';
      img.parentElement.classList.add('has-image');
    }
  }
  function imageFallback(img) {
    let urls;
    try { urls = JSON.parse(img.dataset.candidates || '[]'); } catch { urls = []; }
    let i = Number(img.dataset.index || 0);
    if (img.dataset.proxy !== '1' && urls[i]) {
      img.dataset.proxy = '1';
      img.src = 'https://wsrv.nl/?url=' + encodeURIComponent(urls[i]) + '&w=240&h=240&fit=contain';
      return;
    }
    if (++i < urls.length) {
      img.dataset.index = String(i);
      img.dataset.proxy = '0';
      img.src = urls[i];
    } else {
      img.onerror = img.onload = null;
      img.remove();
    }
  }
  function team(name, e, side) {
    const urls = imageCandidates(e, side);
    const initials = String(name).trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('');
    return '<div class="as-team"><div class="as-team-image-wrap">' +
      '<div class="as-team-placeholder">' + esc(initials) + '</div>' +
      (urls.length ? '<img src="'+esc(urls[0])+'" alt="'+esc(name)+'" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-candidates="'+esc(JSON.stringify(urls))+'" data-index="0" data-proxy="0" onload="AllSports.imageLoaded(this)" onerror="AllSports.imageFallback(this)">' : '') +
      '</div><span class="as-team-name" title="'+esc(name)+'">'+esc(name)+'</span></div>';
  }
  function utc(value) {
    if (!value) return NaN;
    let text = String(value).trim().replace(/\//g,'-').replace(/\s+\+0000$/, 'Z').replace(' ', 'T');
    if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) text += 'Z';
    return Date.parse(text);
  }
  function time(e) {
    const stamp = utc(e.startTimeUTC);
    if (Number.isFinite(stamp)) {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone:'Asia/Kolkata', day:'2-digit', month:'2-digit',
        hour:'numeric', minute:'2-digit', hour12:true
      }).formatToParts(new Date(stamp));
      const p = Object.fromEntries(parts.map(x=>[x.type,x.value]));
      return p.day+'/'+p.month+' · '+Number(p.hour)+':'+p.minute+' '+p.dayPeriod.toUpperCase()+' IST';
    }
    const m = String(e.startTimeIST || '').match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return e.startTimeIST || 'Time TBA';
    const h = Number(m[4]);
    return m[3]+'/'+m[2]+' · '+(h%12 || 12)+':'+m[5]+' '+(h>=12?'PM':'AM')+' IST';
  }
  function card(ev) {
    const e = ev.event || {}, state = statusOf(ev);
    const name = e.name || ev.title || 'Sports Event';
    const category = e.category || ev.cat || 'Football';
    const slug = ev.slug || '';
    const href = 'football?slug='+encodeURIComponent(slug);
    const stateText = {live:'Live',upcoming:'Upcoming',ended:'Ended',unknown:'Time TBA'}[state];
    return '<a class="card allsports-card" href="'+esc(href)+'" data-slug="'+esc(slug)+'" aria-label="'+esc(name+' — '+stateText)+'">' +
      '<div class="thumb allsports-thumb"><div class="as-poster-content">' +
      '<div class="as-event-name" title="'+esc(name)+'">'+esc(name)+'</div>' +
      '<div class="as-teams">'+team(e.teamA || 'Team A',e,'A')+'<div class="as-vs">VS</div>'+team(e.teamB || 'Team B',e,'B')+'</div></div>' +
      (state==='live'?'<span class="badge">LIVE</span>':state==='upcoming'?'<span class="as-upcoming-icon" role="img" aria-label="Upcoming match" title="Upcoming match"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5-6.7V3a2 2 0 0 0-4 0v1.3A7 7 0 0 0 5 11v5l-2 2v1h18v-1z"/></svg></span>':'')+'</div>' +
      '<div class="caption"><span title="'+esc(name)+'">'+esc(name)+'</span>' +
      '<span class="as-meta" title="'+esc(category+' · '+time(e))+'">'+esc(category+' · '+time(e))+'</span>' +
      '</div></a>';
  }
  function updateArrows() {
    const thumb = track.querySelector('.thumb');
    const button = document.getElementById('allsportsPrev');
    if (thumb && button) {
      track.parentElement.style.setProperty('--as-arrow-top',
        Math.max(0, (thumb.getBoundingClientRect().height - button.getBoundingClientRect().height) / 2) + 'px');
    }
  }
  if ('ResizeObserver' in window) new ResizeObserver(updateArrows).observe(track);
  window.addEventListener('resize', updateArrows, {passive:true});
  function skeleton() {
    track.innerHTML = Array.from({length:6},()=>'<div class="card as-skeleton-card" aria-hidden="true"><div class="thumb as-skeleton-thumb"></div><div class="caption"><div class="as-skeleton-line"></div><div class="as-skeleton-line"></div></div></div>').join('');
  }
  async function loadEvents() {
    if (loading) return;
    loading = true;
    if (!loaded) skeleton();
    track.setAttribute('aria-busy','true');
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(),15000);
    try {
      const response = await fetch(API,{cache:'no-cache',headers:{Accept:'application/json'},signal:controller.signal});
      if (!response.ok) throw new Error('API error: '+response.status);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid API response');
      const order = {live:0,upcoming:1,ended:2,unknown:3};
      const events = data.filter(x=>x && typeof x==='object').sort((a,b)=>{
        const diff = order[statusOf(a)]-order[statusOf(b)];
        if (diff) return diff;
        const ta=utc(a.event?.startTimeUTC), tb=utc(b.event?.startTimeUTC);
        return Number.isFinite(ta)&&Number.isFinite(tb)?ta-tb:0;
      });
      const html = events.length ? events.map(card).join('') : '<div class="allsports-empty">No events available.</div>';
      if (html !== rendered) {
        const left = track.scrollLeft;
        track.innerHTML = html;
        track.scrollLeft = left;
        rendered = html;
      }
      loaded = true;
      requestAnimationFrame(updateArrows);
    } catch (error) {
      console.error('[AllSports]',error);
      if (!loaded) {
        track.innerHTML='<div class="allsports-empty">Unable to load football events. <button type="button" class="as-retry">Retry</button></div>';
      }
    } finally {
      clearTimeout(timeout);
      loading=false;
      track.setAttribute('aria-busy','false');
    }
  }
  function scroll(direction) {
    const el=track.querySelector('.card');
    if (el) track.scrollBy({left:direction*(el.offsetWidth+(parseFloat(getComputedStyle(track).columnGap)||0)),behavior:reduced.matches?'auto':'smooth'});
  }
  document.getElementById('allsportsPrev').onclick=()=>scroll(-1);
  document.getElementById('allsportsNext').onclick=()=>scroll(1);
  track.addEventListener('click',e=>{
    if(e.target.closest('.as-retry')) loadEvents();
    const a=e.target.closest('.allsports-card');
    if(a && !a.dataset.slug) e.preventDefault();
  });
  function stop() { clearInterval(timer); timer=null; }
  function start() {
    if(timer || document.hidden || !visible) return;
    timer=setInterval(()=>{if(visible&&!document.hidden)loadEvents();},60000);
  }
  window.AllSports={
    open:slug=>{if(slug)location.href='football?slug='+encodeURIComponent(slug);},
    imageLoaded,imageFallback,reload:loadEvents
  };
  loadEvents();

  function visibility(value) {
    visible=value;
    if(value) { if(!loaded&&!document.hidden)loadEvents(); start(); } else stop();
  }
  if('IntersectionObserver' in window) {
    new IntersectionObserver(entries=>visibility(entries[0].isIntersecting),{rootMargin:'300px 0px',threshold:0}).observe(section);
  } else visibility(true);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)stop();
    else if(visible){loadEvents();start();}
  });
})();
