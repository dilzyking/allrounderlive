
const FOOTFY_URL = 'https://footfytv.pro/api/matches';
const FOOTFY_API_KEY = '435JH345G345G34U5345434J5434535HG';
const CACHE_SECONDS = 30;

const IST_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});

function validText(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const str = value.trim();
  return str && !/^(null|undefined|n\/a|none)$/i.test(str) ? str : null;
}

function firstText(...values) {
  for (const value of values) {
    const result = validText(value);
    if (result !== null) return result;
  }
  return null;
}

function teamName(value) {
  if (value && typeof value === 'object') {
    return firstText(value.name, value.shortName, value.title);
  }
  return validText(value);
}

function teamLogo(value) {
  return value && typeof value === 'object'
    ? firstText(value.logo, value.image, value.flag)
    : null;
}

function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value < 1e12 ? value * 1000 : value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  let text = validText(value);
  if (!text) return null;
  if (/^\d{10,13}$/.test(text)) return toDate(Number(text));

  text = text.replace(/^(\d{4})\/(\d{2})\/(\d{2})/, '$1-$2-$3');
  text = text.replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T');
  text = text.replace(/\s+IST$/i, '+05:30');
  text = text.replace(/\s+UTC$/i, 'Z');
  text = text.replace(/\s+([+-]\d{2})(\d{2})$/, '$1:$2');
  text = text.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text) &&
      !/(Z|[+-]\d{2}:\d{2})$/i.test(text)) {
    text += 'Z';
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function firstDate(...values) {
  for (const value of values) {
    const date = toDate(value);
    if (date) return date;
  }
  return null;
}

function utcTime(date) {
  if (!date) return null;
  return date.toISOString().slice(0, 19).replace(/-/g, '/').replace('T', ' ') + ' +0000';
}

function istTime(date) {
  if (!date) return null;
  const parts = Object.fromEntries(
    IST_FORMATTER.formatToParts(date).map(part => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} IST`;
}

function normalizedId(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = validText(value);
  if (!text) return null;

  if (/^\d+$/.test(text)) {
    const asNumber = Number(text);
    if (Number.isSafeInteger(asNumber)) return asNumber;
  }
  return text;
}

function slugify(value) {
  const text = validText(value);
  if (!text) return null;

  return text.toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || null;
}

function versions(match) {
  return [
    match,
    match?.mergedData,
    match?.apiData,
    match?.mergedData?.apiData
  ].filter(value => value && typeof value === 'object' && !Array.isArray(value));
}

function sportOf(match) {
  const candidates = versions(match).flatMap(item => [
    item.category,
    item.sport,
    item.cat,
    item.event?.category,
    item.eventInfo?.category,
    item.overrides?.category
  ]);

  for (const value of candidates) {
    const sport = validText(value)?.toLowerCase();
    if (!sport) continue;

    if (sport.includes('football') || sport === 'soccer') return 'Football';
    if (sport.includes('cricket')) return 'Cricket';
  }

  return null;
}

function getMatchDates(records) {
  const start = firstDate(...records.flatMap(item => [
    item.startTime,
    item.time,
    item.startTimeUTC,
    item.event?.startTimeUTC,
    item.event?.startTime,
    item.eventInfo?.startTime,
    item.overrides?.time,
    item.event?.startTimeIST,
    item.startTimeIST
  ]));

  const end = firstDate(...records.flatMap(item => [
    item.endTime,
    item.endTimeUTC,
    item.event?.endTimeUTC,
    item.event?.endTime,
    item.eventInfo?.endTime,
    item.overrides?.endTime,
    item.event?.endTimeIST,
    item.endTimeIST
  ]));

  return { start, end };
}

function matchStatus(records, start, end) {
  const now = Date.now();

  if (end && now >= end.getTime()) return 'ended';
  if (start && now < start.getTime()) return 'upcoming';
  if (start && end && now >= start.getTime() && now < end.getTime()) return 'live';

  const original = firstText(...records.flatMap(item => [
    item.overrides?.status,
    item.status,
    item.eventInfo?.Status,
    item.eventInfo?.status,
    item.event?.status
  ]))?.toLowerCase();

  if (original) {
    if (/^(live|ongoing|in progress|in_progress)$/.test(original)) return 'live';
    if (/^(upcoming|scheduled|not started|not_started)$/.test(original)) return 'upcoming';
    if (/^(ended|finished|finish|completed|complete|final|ft)$/.test(original)) return 'ended';
  }

  if (records.some(item => item.isFinished === true)) return 'ended';
  if (records.some(item => item.isLive === true)) return 'live';
  if (records.some(item => item.isUpcoming === true)) return 'upcoming';

  return null;
}

function cleanStreamUrl(value) {
  const raw = validText(value);
  if (!raw) return null;

  const url = raw.split('|', 1)[0].trim();
  if (!/^https?:\/\//i.test(url)) return null;

  try {
    const parsed = new URL(url);

    if (['no.link', 'example.com', 'example.org', 'localhost']
      .includes(parsed.hostname.toLowerCase())) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function streamType(stream, url) {
  if (/\.mpd(?:$|[?#])/i.test(url)) return 'dash';
  if (/\.m3u8(?:$|[?#])/i.test(url)) return 'hls';

  const type = firstText(
    stream.type,
    stream.streamType,
    stream.format
  )?.toLowerCase();

  if (type && /^(dash|mpd|mpeg-dash)$/.test(type)) return 'dash';
  if (type && /^(hls|m3u8)$/.test(type)) return 'hls';

  return null;
}

function streamKey(stream) {
  const drm = stream?.drm;
  const candidate = firstText(stream?.drmKey, stream?.api);

  if (candidate && /^[0-9a-f]{32}:[0-9a-f]{32}$/i.test(candidate)) {
    return candidate;
  }

  const kid = firstText(drm?.kid, drm?.keyId);
  const key = firstText(drm?.key);

  if (kid && key) return `${kid}:${key}`;

  if (drm?.clearKeys && typeof drm.clearKeys === 'object') {
    const [firstEntry] = Object.entries(drm.clearKeys);

    if (firstEntry && firstEntry[0] && firstEntry[1]) {
      return `${firstEntry[0]}:${firstEntry[1]}`;
    }
  }

  return null;
}

function gatherStreams(records) {
  const output = [];
  const seen = new Map();

  for (const item of records) {
    for (const field of [
      'servers',
      'streams',
      'channels',
      'dashStreams',
      'channels_data'
    ]) {
      if (!Array.isArray(item[field])) continue;

      for (const raw of item[field]) {
        const stream = typeof raw === 'string' ? { url: raw } : raw;

        if (!stream || typeof stream !== 'object') continue;
        if (stream.active === false || stream.enabled === false) continue;

        const url = cleanStreamUrl(firstText(
          stream.url,
          stream.streamUrl,
          stream.link,
          stream.externalUrl,
          stream.src
        ));

        if (!url) continue;

        const type = streamType(stream, url);
        if (!type) continue;

        const title = firstText(
          stream.title,
          stream.label,
          stream.name
        );

        const keyValue = streamKey(stream);

        if (seen.has(url)) {
          const existing = output[seen.get(url)];

          if (!existing.title && title) existing.title = title;
          if (!existing.key && keyValue) existing.key = keyValue;

          continue;
        }

        seen.set(url, output.length);

        output.push({
          title,
          type,
          url,
          key: keyValue
        });
      }
    }
  }

  return output;
}

function mapMatch(match, category) {
  const records = versions(match);

  const a = firstText(...records.flatMap(item => [
    item.teamA,
    teamName(item.homeTeam),
    item.eventInfo?.teamA,
    item.event?.teamA,
    teamName(item.overrides?.homeTeam)
  ]));

  const b = firstText(...records.flatMap(item => [
    item.teamB,
    teamName(item.awayTeam),
    item.eventInfo?.teamB,
    item.event?.teamB,
    teamName(item.overrides?.awayTeam)
  ]));

  const aFlag = firstText(...records.flatMap(item => [
    item.teamAFlag,
    item.homeLogo,
    teamLogo(item.homeTeam),
    item.eventInfo?.teamAFlag,
    item.event?.teamAFlag,
    teamLogo(item.overrides?.homeTeam)
  ]));

  const bFlag = firstText(...records.flatMap(item => [
    item.teamBFlag,
    item.awayLogo,
    teamLogo(item.awayTeam),
    item.eventInfo?.teamBFlag,
    item.event?.teamBFlag,
    teamLogo(item.overrides?.awayTeam)
  ]));

  const eventName = firstText(...records.flatMap(item => [
    item.eventName,
    item.league,
    item.event?.name,
    item.event?.title,
    item.eventInfo?.eventName,
    item.overrides?.league
  ]));

  const eventLogo = firstText(...records.flatMap(item => [
    item.leagueLogo,
    item.event?.logo,
    item.image,
    item.event?.image
  ]));

  const id = normalizedId(firstText(
    match.id,
    match.apiId,
    match.apiData?.id,
    match.mergedData?.id,
    match._id,
    match.overrideId
  ));

  const matchupTitle = a && b ? `${a} vs ${b}` : null;

  const title = firstText(
    match.title,
    match.overrides?.title,
    matchupTitle,
    match.mergedData?.title,
    match.apiData?.title
  );

  const slug = firstText(
    match.slug,
    match.seoSlug,
    match.mergedData?.slug,
    match.mergedData?.seoSlug,
    match.apiData?.seoSlug
  ) || slugify(matchupTitle || title || `${category}-${id ?? 'match'}`);

  const { start, end } = getMatchDates(records);

  return {
    id,
    title,
    slug,
    cat: 'Live Events',
    status: matchStatus(records, start, end),
    event: {
      name: eventName,
      category,
      teamA: a,
      teamAFlag: aFlag,
      teamB: b,
      teamBFlag: bFlag,
      logo: eventLogo,
      startTimeIST: istTime(start),
      endTimeIST: istTime(end),
      startTimeUTC: utcTime(start),
      endTimeUTC: utcTime(end)
    },
    dashStreams: gatherStreams(records)
  };
}

function extractMatches(payload, depth = 0) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object' || depth > 5) return [];

  for (const key of [
    'matches',
    'events',
    'data',
    'results',
    'items',
    'fixtures',
    'list',
    'response'
  ]) {
    const result = extractMatches(payload[key], depth + 1);
    if (result.length) return result;
  }

  const grouped = [
    'football',
    'Football',
    'cricket',
    'Cricket'
  ].flatMap(key => extractMatches(payload[key], depth + 1));

  if (grouped.length) return grouped;

  if (
    payload.id !== undefined ||
    payload.apiId !== undefined ||
    payload._id !== undefined
  ) {
    return [payload];
  }

  return [];
}

function mapAll(payload, category) {
  const unique = new Map();
  const matches = extractMatches(payload);

  for (const match of matches) {
    if (!match || typeof match !== 'object') continue;
    if (sportOf(match) !== category) continue;

    const converted = mapMatch(match, category);

    const uniqueId = converted.id !== null
      ? `id:${converted.id}`
      : `slug:${converted.slug ?? JSON.stringify(converted.event)}`;

    const existing = unique.get(uniqueId);

    if (!existing || converted.dashStreams.length > existing.dashStreams.length) {
      unique.set(uniqueId, converted);
    }
  }

  return [...unique.values()];
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': status === 200
        ? `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`
        : 'no-store',
      ...extraHeaders
    }
  });
}

async function handleRequest(request, env = {}, ctx = null) {
  const { pathname } = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  if (!['GET', 'HEAD'].includes(request.method)) {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (pathname !== '/football.json' && pathname !== '/cricket.json') {
    return jsonResponse({
      error: 'Use /football.json or /cricket.json'
    }, 404);
  }

  const category = pathname === '/football.json'
    ? 'Football'
    : 'Cricket';

  const cache = typeof caches !== 'undefined'
    ? caches.default
    : null;

  if (request.method === 'GET' && cache) {
    const cached = await cache.match(request);
    if (cached) return cached;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    let upstream;

    try {
      upstream = await fetch(FOOTFY_URL, {
        headers: {
          'x-footfy-key': FOOTFY_API_KEY,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!upstream.ok) {
      return jsonResponse({
        error: 'Footfy API request failed',
        upstreamStatus: upstream.status
      }, 502);
    }

    const payload = await upstream.json();
    const data = mapAll(payload, category);
    const response = jsonResponse(data);

    if (request.method === 'GET' && cache && ctx?.waitUntil) {
      ctx.waitUntil(cache.put(request, response.clone()));
    }

    if (request.method === 'HEAD') {
      return new Response(null, {
        status: 200,
        headers: response.headers
      });
    }

    return response;
  } catch (error) {
    return jsonResponse({
      error: 'Unable to retrieve or parse Footfy API data'
    }, 502);
  }
}

// Cloudflare Workers
export default {
  fetch: handleRequest
};

// Cloudflare Pages Functions
export async function onRequest(context) {
  return handleRequest(context.request, context.env, context);
}
