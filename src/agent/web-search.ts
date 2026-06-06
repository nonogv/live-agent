import https from 'node:https';

/** Descriptive User-Agent for Wikipedia and tab sites. */
const HTTP_USER_AGENT =
  'Mozilla/5.0 (compatible; Live-Agent/1.0; +https://github.com/nonogv/live-agent; music-production)';

/** Hosts whose tab pages expose ASCII tablature in static HTML. */
const TAB_CONTENT_HOSTS = [
  'bigbasstabs.com',
  'gotabs.com',
  'basstabz.com',
  'e-chords.com',
] as const;

/** Hosts whose articles/manual pages expose readable static HTML. */
const DOCS_CONTENT_HOSTS = ['ableton.com'] as const;

const INSTRUMENT_REFERENCE_URL = 'https://www.ableton.com/en/manual/live-instrument-reference/';
const AUDIO_EFFECT_REFERENCE_URL = 'https://www.ableton.com/en/manual/live-audio-effect-reference/';
const MIDI_EFFECT_REFERENCE_URL = 'https://www.ableton.com/en/manual/live-midi-effect-reference/';

/**
 * Maps built-in Live device names (lowercased) to their Ableton manual section URL.
 * Devices share three reference pages; anchors navigate to the specific section.
 * URL pattern confirmed: https://www.ableton.com/en/manual/live-{category}-reference/#<anchor>
 */
const ABLETON_MANUAL_URLS: Record<string, string> = {
  // Instruments
  analog: `${INSTRUMENT_REFERENCE_URL}#analog`,
  collision: `${INSTRUMENT_REFERENCE_URL}#collision`,
  drift: `${INSTRUMENT_REFERENCE_URL}#drift`,
  electric: `${INSTRUMENT_REFERENCE_URL}#electric`,
  impulse: `${INSTRUMENT_REFERENCE_URL}#impulse`,
  meld: `${INSTRUMENT_REFERENCE_URL}#meld`,
  operator: `${INSTRUMENT_REFERENCE_URL}#operator`,
  sampler: `${INSTRUMENT_REFERENCE_URL}#sampler`,
  simpler: `${INSTRUMENT_REFERENCE_URL}#simpler`,
  tension: `${INSTRUMENT_REFERENCE_URL}#tension`,
  wavetable: `${INSTRUMENT_REFERENCE_URL}#wavetable`,
  'drum sampler': `${INSTRUMENT_REFERENCE_URL}#drum-sampler`,
  // Racks — no dedicated pages; point to the relevant reference page
  'instrument rack': INSTRUMENT_REFERENCE_URL,
  'audio effect rack': AUDIO_EFFECT_REFERENCE_URL,
  'midi effect rack': MIDI_EFFECT_REFERENCE_URL,
  'drum rack': INSTRUMENT_REFERENCE_URL,
  // Audio Effects
  amp: `${AUDIO_EFFECT_REFERENCE_URL}#amp`,
  'auto filter': `${AUDIO_EFFECT_REFERENCE_URL}#auto-filter`,
  'auto pan': `${AUDIO_EFFECT_REFERENCE_URL}#auto-pan-tremolo`,
  'beat repeat': `${AUDIO_EFFECT_REFERENCE_URL}#beat-repeat`,
  cabinet: `${AUDIO_EFFECT_REFERENCE_URL}#cabinet`,
  'channel eq': `${AUDIO_EFFECT_REFERENCE_URL}#channel-eq`,
  'chorus-ensemble': `${AUDIO_EFFECT_REFERENCE_URL}#chorus-ensemble`,
  compressor: `${AUDIO_EFFECT_REFERENCE_URL}#compressor`,
  corpus: `${AUDIO_EFFECT_REFERENCE_URL}#corpus`,
  delay: `${AUDIO_EFFECT_REFERENCE_URL}#delay`,
  'drum buss': `${AUDIO_EFFECT_REFERENCE_URL}#drum-buss`,
  'dynamic tube': `${AUDIO_EFFECT_REFERENCE_URL}#dynamic-tube`,
  echo: `${AUDIO_EFFECT_REFERENCE_URL}#echo`,
  'eq eight': `${AUDIO_EFFECT_REFERENCE_URL}#eq-eight`,
  'eq three': `${AUDIO_EFFECT_REFERENCE_URL}#eq-three`,
  erosion: `${AUDIO_EFFECT_REFERENCE_URL}#erosion`,
  'filter delay': `${AUDIO_EFFECT_REFERENCE_URL}#filter-delay`,
  // "Flanger" as a standalone name maps to the combined Phaser-Flanger section
  flanger: `${AUDIO_EFFECT_REFERENCE_URL}#phaser-flanger`,
  gate: `${AUDIO_EFFECT_REFERENCE_URL}#gate`,
  'glue compressor': `${AUDIO_EFFECT_REFERENCE_URL}#glue-compressor`,
  'grain delay': `${AUDIO_EFFECT_REFERENCE_URL}#grain-delay`,
  'hybrid reverb': `${AUDIO_EFFECT_REFERENCE_URL}#hybrid-reverb`,
  limiter: `${AUDIO_EFFECT_REFERENCE_URL}#limiter`,
  looper: `${AUDIO_EFFECT_REFERENCE_URL}#looper`,
  'multiband dynamics': `${AUDIO_EFFECT_REFERENCE_URL}#multiband-dynamics`,
  overdrive: `${AUDIO_EFFECT_REFERENCE_URL}#overdrive`,
  pedal: `${AUDIO_EFFECT_REFERENCE_URL}#pedal`,
  'phaser-flanger': `${AUDIO_EFFECT_REFERENCE_URL}#phaser-flanger`,
  redux: `${AUDIO_EFFECT_REFERENCE_URL}#redux`,
  resonators: `${AUDIO_EFFECT_REFERENCE_URL}#resonators`,
  reverb: `${AUDIO_EFFECT_REFERENCE_URL}#reverb`,
  roar: `${AUDIO_EFFECT_REFERENCE_URL}#roar`,
  saturator: `${AUDIO_EFFECT_REFERENCE_URL}#saturator`,
  // "Frequency Shifter" and "Shifter" both map to the same section
  'frequency shifter': `${AUDIO_EFFECT_REFERENCE_URL}#shifter`,
  shifter: `${AUDIO_EFFECT_REFERENCE_URL}#shifter`,
  // "Spectral Blur" was renamed to Spectral Resonator in Live 12
  'spectral blur': `${AUDIO_EFFECT_REFERENCE_URL}#spectral-resonator`,
  'spectral resonator': `${AUDIO_EFFECT_REFERENCE_URL}#spectral-resonator`,
  'spectral time': `${AUDIO_EFFECT_REFERENCE_URL}#spectral-time`,
  spectrum: `${AUDIO_EFFECT_REFERENCE_URL}#spectrum`,
  tuner: `${AUDIO_EFFECT_REFERENCE_URL}#tuner`,
  utility: `${AUDIO_EFFECT_REFERENCE_URL}#utility`,
  'vinyl distortion': `${AUDIO_EFFECT_REFERENCE_URL}#vinyl-distortion`,
  vocoder: `${AUDIO_EFFECT_REFERENCE_URL}#vocoder`,
  // MIDI Effects
  arpeggiator: `${MIDI_EFFECT_REFERENCE_URL}#arpeggiator`,
  'cc control': `${MIDI_EFFECT_REFERENCE_URL}#cc-control`,
  chord: `${MIDI_EFFECT_REFERENCE_URL}#chord`,
  'note length': `${MIDI_EFFECT_REFERENCE_URL}#note-length`,
  pitch: `${MIDI_EFFECT_REFERENCE_URL}#pitch`,
  random: `${MIDI_EFFECT_REFERENCE_URL}#random`,
  scale: `${MIDI_EFFECT_REFERENCE_URL}#scale`,
  velocity: `${MIDI_EFFECT_REFERENCE_URL}#velocity`,
};

/** Built-in Live device names — used to refine production/Live search queries. */
const LIVE_DEVICE_NAMES = [
  'Glue Compressor',
  'Instrument Rack',
  'Audio Effect Rack',
  'MIDI Effect Rack',
  'Drum Rack',
  'EQ Eight',
  'EQ Three',
  'Auto Filter',
  'Auto Pan',
  'Beat Repeat',
  'Chorus-Ensemble',
  'Dynamic Tube',
  'Filter Delay',
  'Frequency Shifter',
  'Grain Delay',
  'Multiband Dynamics',
  'Phaser-Flanger',
  'Spectral Blur',
  'Spectral Time',
  'Vinyl Distortion',
  'Compressor',
  'Operator',
  'Analog',
  'Sampler',
  'Simpler',
  'Drift',
  'Meld',
  'Corpus',
  'Delay',
  'Echo',
  'Erosion',
  'Flanger',
  'Gate',
  'Limiter',
  'Looper',
  'Overdrive',
  'Pedal',
  'Redux',
  'Resonators',
  'Reverb',
  'Saturator',
  'Shifter',
  'Spectrum',
  'Tuner',
  'Utility',
  'Vocoder',
] as const;

/** A single web search hit returned to the LLM. */
export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
  /** Where this hit came from — helps the model weigh tab text vs overview. */
  source?: 'web' | 'tab' | 'wikipedia' | 'docs';
}

/** Structured response from {@link webSearch}. */
export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
  ok: boolean;
  error?: string;
}

/**
 * Whether the query is asking for tablature or performance detail (note rhythm, how to play).
 */
export function isTabQuery(query: string): boolean {
  return (
    /\b(tab|tabs|tablature|bass\s*line|chord chart|how to play|ostinato|notation)\b/i.test(query) ||
    (/\b(rhythm|16th|sixteenth|quarter|eighth|semiquaver|pattern)\b/i.test(query) &&
      /\b(bass|guitar|play|notes?)\b/i.test(query))
  );
}

/**
 * Whether the query is about Ableton Live, built-in devices, or general production technique.
 */
export function isLiveOrProductionQuery(query: string): boolean {
  if (detectLiveDeviceName(query)) return true;
  return (
    /\b(ableton|live\s*(?:1[12]|[\d]+)?|max\s*for\s*live|push\s*[23]?)\b/i.test(query) ||
    /\b(mixing|mastering|sidechain(?:ing)?|compression|sound design|gain staging|music production|produc(?:e|ing|tion)|mix\b|master\b|bus\b|send\b|return track|automation|clip envelope|midi effect|audio effect|wavetable|sub bass|kick drum|snare|plugin|device tip|workflow)\b/i.test(
      query,
    ) ||
    /\b(eq\b|reverb|delay|synthesis|fm\b|limiter|saturator|overdrive)\b/i.test(query)
  );
}

/**
 * Whether the query is asking for performance detail (tabs, rhythm, tempo) vs song overview.
 */
export function isMusicalDetailQuery(query: string): boolean {
  return (
    isTabQuery(query) ||
    isLiveOrProductionQuery(query) ||
    /\b(tempo|bpm|key|chord|lesson)\b/i.test(query) ||
    /site:/i.test(query)
  );
}

/**
 * Returns a built-in Live device name mentioned in the query, if any.
 * @param query - Raw search query.
 */
export function detectLiveDeviceName(query: string): string | null {
  for (const deviceName of LIVE_DEVICE_NAMES) {
    const pattern = new RegExp(`\\b${deviceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (pattern.test(query)) return deviceName;
  }
  return null;
}

/**
 * Whether Wikipedia is a useful fallback for this query (song/artist overview, not tabs or Live docs).
 */
export function shouldUseWikipedia(query: string): boolean {
  if (isTabQuery(query)) return false;
  if (isLiveOrProductionQuery(query)) return false;
  return true;
}

/**
 * Whether the query is primarily about mixing, mastering, or dynamics processing.
 * Used to add a targeted `site:ableton.com` fallback query.
 */
function isMixingMasteringQuery(query: string): boolean {
  return /\b(mix(?:ing)?|master(?:ing)?|sidechain(?:ing)?|compression|compressor|gain\s+staging|parallel\s+compression)\b/i.test(
    query,
  );
}

/**
 * Whether the query is primarily about sound design or synthesis technique.
 * Used to add a targeted `site:ableton.com` fallback query.
 */
function isSoundDesignQuery(query: string): boolean {
  return /\b(sound\s+design|synthesis|fm\b|wavetable|oscillat(?:or|e|ing)?|timbre|patch\b|lfo\b)\b/i.test(
    query,
  );
}

/**
 * Builds progressively simpler search strings when the model passes a long instruction.
 * @param query - Raw query from the LLM tool call.
 */
export function buildSearchQueries(query: string): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const add = (value: string) => {
    const trimmed = value.replace(/\s+/g, ' ').trim();
    if (trimmed.length < 3 || seen.has(trimmed)) return;
    seen.add(trimmed);
    ordered.push(trimmed);
  };

  const tabQuery = isTabQuery(query);
  const productionQuery = isLiveOrProductionQuery(query);

  const withoutInstructions = query
    .replace(
      /\b(search the web(?: for)?|look up|look it up|find info about|info about|use the web search|accurate info|accurate tab|correct tab)\b/gi,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim();
  const focused = withoutInstructions || query;

  // Quoted titles in the query get prioritised tab searches.
  const quotedTitles = [...query.matchAll(/["']([^"']{3,}?)["']/g)].map((m) => m[1]);

  if (productionQuery) {
    const deviceName = detectLiveDeviceName(query);
    if (deviceName) {
      add(`Ableton Live ${deviceName} tutorial site:ableton.com`);
      add(`${deviceName} Ableton tips`);
    }
    add(`site:ableton.com ${focused}`);
    // Topic-specific fallbacks surface blog posts and manual pages on ableton.com
    // when the focused site: query returns sparse results.
    if (isMixingMasteringQuery(query)) {
      add(`mixing mastering tutorial site:ableton.com`);
    }
    if (isSoundDesignQuery(query)) {
      add(`sound design synthesis tutorial site:ableton.com`);
    }
    add(`${focused} Ableton Live`);
    add(`${focused} music production`);
  }

  for (const title of quotedTitles) {
    if (tabQuery) add(`${title} bass tab`);
    add(title);
  }

  add(focused);

  if (tabQuery && !/\btab\b/i.test(query)) {
    add(`${focused} bass tab`);
  }

  add(query);

  return ordered;
}

/**
 * Fetches a URL and returns the body as a string.
 * @param url - HTTPS URL to request.
 */
export function fetchHttpsText(
  url: string,
  accept = 'application/json, text/html;q=0.9, */*;q=0.8',
): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      { headers: { 'User-Agent': HTTP_USER_AGENT, Accept: accept } },
      (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          fetchHttpsText(response.headers.location, accept).then(resolve, reject);
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode ?? 'unknown'} for ${url}`));
          response.resume();
          return;
        }
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        response.on('error', reject);
      },
    );
    request.on('error', reject);
    request.setTimeout(15_000, () => {
      request.destroy(new Error(`Timeout fetching ${url}`));
    });
  });
}

/**
 * POSTs form data over HTTPS and returns the response body.
 */
export function fetchHttpsPost(hostname: string, path: string, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname,
        path,
        method: 'POST',
        headers: {
          'User-Agent': HTTP_USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
          Accept: 'text/html, */*',
        },
      },
      (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          fetchHttpsText(response.headers.location).then(resolve, reject);
          return;
        }
        if (response.statusCode !== 200) {
          reject(
            new Error(`HTTP ${response.statusCode ?? 'unknown'} for https://${hostname}${path}`),
          );
          response.resume();
          return;
        }
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        response.on('error', reject);
      },
    );
    request.on('error', reject);
    request.setTimeout(15_000, () => {
      request.destroy(new Error(`Timeout posting to https://${hostname}${path}`));
    });
    request.write(body);
    request.end();
  });
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ');
}

function htmlToPlainText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );
}

/** Extracts ASCII tablature from a static tab page, when present. */
export function extractTabSnippetFromHtml(html: string): string | null {
  const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  if (!preMatch?.[1]) return null;
  const text = htmlToPlainText(preMatch[1]);
  return text.length >= 20 ? text.slice(0, 2000) : null;
}

/** Extracts readable article text from Ableton help/blog pages, when present. */
export function extractArticleSnippetFromHtml(html: string): string | null {
  const chunk =
    html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html.match(/<main[\s\S]*?<\/main>/i)?.[0];
  if (!chunk) return null;
  const text = htmlToPlainText(
    chunk.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, ''),
  );
  return text.length >= 80 ? text.slice(0, 2000) : null;
}

/**
 * Extracts the HTML section for a specific anchor ID (e.g. "operator") from a large manual page.
 * Looks for an h2 element carrying that id, then collects content until the next h2.
 */
function extractDeviceSectionFromHtml(html: string, anchorId: string): string | null {
  const anchorPattern = new RegExp(`id=["']${anchorId}["']`);
  const anchorIdx = html.search(anchorPattern);
  if (anchorIdx === -1) return null;
  const h2Start = html.lastIndexOf('<h2', anchorIdx);
  if (h2Start === -1) return null;
  const nextH2 = html.indexOf('<h2', h2Start + 4);
  const sectionHtml = nextH2 === -1 ? html.slice(h2Start) : html.slice(h2Start, nextH2);
  const text = htmlToPlainText(
    sectionHtml.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, ''),
  );
  return text.length >= 80 ? text.slice(0, 2000) : null;
}

/**
 * Returns the Ableton Live manual section URL for a built-in device name, or null if unknown.
 * The lookup is case-insensitive. URLs point to the specific anchor within the reference page.
 * @param deviceName - The device name as displayed in Live (e.g. "Operator", "Glue Compressor").
 */
export function abledtonManualUrl(deviceName: string): string | null {
  return ABLETON_MANUAL_URLS[deviceName.toLowerCase()] ?? null;
}

function wikiPageUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

function wikiTitleParam(title: string): string {
  return encodeURIComponent(title.replace(/ /g, '_'));
}

async function fetchPageSummary(
  title: string,
  fetchText: (url: string) => Promise<string>,
): Promise<WebSearchResult | null> {
  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${wikiTitleParam(title)}`;
  const summaryRaw = await fetchText(summaryUrl);
  const summary = JSON.parse(summaryRaw) as { extract?: string; description?: string };
  const snippet = summary.extract ?? summary.description;
  if (!snippet) return null;
  return { title, snippet, url: wikiPageUrl(title), source: 'wikipedia' };
}

async function searchWikipedia(
  queries: string[],
  fetchText: (url: string) => Promise<string>,
): Promise<WebSearchResult[]> {
  for (const searchQuery of queries) {
    const searchUrl =
      `https://en.wikipedia.org/w/api.php?action=query&list=search` +
      `&srsearch=${encodeURIComponent(searchQuery)}&format=json&srlimit=2&origin=*`;
    const raw = await fetchText(searchUrl);
    const parsed = JSON.parse(raw) as {
      query?: { search?: Array<{ title: string; snippet: string }> };
    };
    const hits = parsed.query?.search ?? [];
    if (hits.length === 0) continue;

    const results: WebSearchResult[] = [];
    for (const hit of hits.slice(0, 2)) {
      try {
        const summary = await fetchPageSummary(hit.title, fetchText);
        results.push(
          summary ?? {
            title: hit.title,
            snippet: hit.snippet.replace(/<[^>]+>/g, ''),
            url: wikiPageUrl(hit.title),
            source: 'wikipedia',
          },
        );
      } catch (err) {
        console.error(`[Live Agent] Wikipedia summary for "${hit.title}" failed:`, err);
        results.push({
          title: hit.title,
          snippet: hit.snippet.replace(/<[^>]+>/g, ''),
          url: wikiPageUrl(hit.title),
          source: 'wikipedia',
        });
      }
    }
    return results;
  }

  return [];
}

const DDG_LITE_RESULT_RE =
  /href="(https?:\/\/[^"]+)"[^>]*class='result-link'[^>]*>([^<]+)<\/a>[\s\S]*?class='result-snippet'[^>]*>([\s\S]*?)<\/td>/g;

async function searchDuckDuckGoLite(
  query: string,
  fetchPost: (hostname: string, path: string, body: string) => Promise<string>,
): Promise<WebSearchResult[]> {
  const html = await fetchPost('lite.duckduckgo.com', '/lite/', `q=${encodeURIComponent(query)}`);
  const results: WebSearchResult[] = [];

  for (const match of html.matchAll(DDG_LITE_RESULT_RE)) {
    const url = match[1];
    const title = decodeHtmlEntities(match[2].trim());
    const snippet = htmlToPlainText(match[3]).slice(0, 400);
    if (!url || !title) continue;
    results.push({ title, snippet, url, source: 'web' });
    if (results.length >= 6) break;
  }

  return results;
}

function isTabContentHost(url: string): boolean {
  return matchesContentHost(url, TAB_CONTENT_HOSTS);
}

/**
 * Whether a URL belongs to a host whose HTML exposes readable article content.
 * Matches `ableton.com` and all its subdomains (e.g. `makingmusic.ableton.com`).
 */
export function isDocsContentHost(url: string): boolean {
  return matchesContentHost(url, DOCS_CONTENT_HOSTS);
}

function matchesContentHost(url: string, hosts: readonly string[]): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return hosts.some((contentHost) => host === contentHost || host.endsWith(`.${contentHost}`));
  } catch {
    return false;
  }
}

async function fetchTabPageContent(
  result: WebSearchResult,
  fetchText: (url: string) => Promise<string>,
): Promise<WebSearchResult | null> {
  if (!isTabContentHost(result.url)) return null;
  const html = await fetchText(result.url);
  const tabText = extractTabSnippetFromHtml(html);
  if (!tabText) return null;
  return {
    title: `${result.title} (tab excerpt)`,
    snippet: tabText,
    url: result.url,
    source: 'tab',
  };
}

async function fetchDocsPageContent(
  result: WebSearchResult,
  fetchText: (url: string) => Promise<string>,
): Promise<WebSearchResult | null> {
  if (!isDocsContentHost(result.url)) return null;
  const html = await fetchText(result.url);
  const articleText = extractArticleSnippetFromHtml(html);
  if (!articleText) return null;
  return {
    title: `${result.title} (article excerpt)`,
    snippet: articleText,
    url: result.url,
    source: 'docs',
  };
}

/**
 * Fetches the Ableton manual page for a device and extracts its section.
 * Returns a `docs` result on success, or a `web` fallback result when the page is unreachable
 * (bot detection, network error, etc.) — the URL alone is still valuable context for the model.
 */
async function fetchAbletonManualResult(
  deviceName: string,
  manualUrl: string,
  fetchText: (url: string) => Promise<string>,
): Promise<WebSearchResult> {
  const anchorIdx = manualUrl.indexOf('#');
  const fetchUrl = anchorIdx === -1 ? manualUrl : manualUrl.slice(0, anchorIdx);
  const anchorId = anchorIdx === -1 ? null : manualUrl.slice(anchorIdx + 1);

  try {
    const html = await fetchText(fetchUrl);
    const snippet = anchorId
      ? extractDeviceSectionFromHtml(html, anchorId)
      : extractArticleSnippetFromHtml(html);

    if (snippet) {
      return {
        title: `${deviceName} — Ableton Live Manual`,
        snippet,
        url: manualUrl,
        source: 'docs',
      };
    }
  } catch (err) {
    console.error(`[Live Agent] Ableton manual fetch for "${deviceName}" failed:`, err);
  }

  return {
    title: `${deviceName} — Ableton Live Manual`,
    snippet: `Official Ableton Live manual page for ${deviceName}. See ${manualUrl} for full documentation.`,
    url: manualUrl,
    source: 'web',
  };
}

export interface WebSearchDeps {
  fetchText: (url: string) => Promise<string>;
  fetchPost: (hostname: string, path: string, body: string) => Promise<string>;
}

const defaultDeps: WebSearchDeps = {
  fetchText: fetchHttpsText,
  fetchPost: fetchHttpsPost,
};

/**
 * Searches the web for musical and production reference: tab sites and Ableton docs via
 * DuckDuckGo Lite, ASCII tab and article excerpts from fetchable hosts, and Wikipedia for song overview.
 */
export async function webSearch(
  query: string,
  deps: WebSearchDeps = defaultDeps,
): Promise<WebSearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('web_search requires a non-empty query.');
  }

  const searchQueries = buildSearchQueries(trimmed);
  const learningQuery = isMusicalDetailQuery(trimmed);
  const results: WebSearchResult[] = [];

  for (const searchQuery of searchQueries) {
    try {
      const webHits = await searchDuckDuckGoLite(searchQuery, deps.fetchPost);
      if (webHits.length === 0) continue;

      for (const hit of webHits) {
        results.push(hit);
      }

      for (const hit of webHits) {
        if (!isTabContentHost(hit.url)) continue;
        try {
          const tabHit = await fetchTabPageContent(hit, deps.fetchText);
          if (tabHit) {
            results.unshift(tabHit);
            break;
          }
        } catch (err) {
          console.error(`[Live Agent] Tab fetch for "${hit.url}" failed:`, err);
        }
      }

      for (const hit of webHits) {
        if (!isDocsContentHost(hit.url)) continue;
        try {
          const docsHit = await fetchDocsPageContent(hit, deps.fetchText);
          if (docsHit) {
            results.unshift(docsHit);
            break;
          }
        } catch (err) {
          console.error(`[Live Agent] Docs fetch for "${hit.url}" failed:`, err);
        }
      }

      if (results.length > 0) break;
    } catch (err) {
      console.error('[Live Agent] DuckDuckGo Lite search failed:', err);
    }
  }

  const detectedDevice = detectLiveDeviceName(trimmed);
  if (detectedDevice) {
    const manualUrl = abledtonManualUrl(detectedDevice);
    if (manualUrl) {
      const docsResult = await fetchAbletonManualResult(detectedDevice, manualUrl, deps.fetchText);
      if (docsResult.source === 'docs') {
        results.unshift(docsResult);
      } else {
        results.push(docsResult);
      }
    }
  }

  if (shouldUseWikipedia(trimmed)) {
    try {
      const wikiHits = await searchWikipedia(searchQueries, deps.fetchText);
      results.push(...wikiHits);
    } catch (err) {
      console.error('[Live Agent] Wikipedia search failed:', err);
    }
  }

  const deduped = dedupeResults(results);
  if (deduped.length === 0) {
    return {
      query: trimmed,
      results: [],
      ok: false,
      error: `No web results for ${JSON.stringify(trimmed)}. Tried: ${searchQueries.map((q) => JSON.stringify(q)).join(', ')}`,
    };
  }

  const resultLimit = learningQuery ? 8 : 6;
  return { query: trimmed, results: deduped.slice(0, resultLimit), ok: true };
}

function dedupeResults(results: WebSearchResult[]): WebSearchResult[] {
  const seen = new Set<string>();
  const out: WebSearchResult[] = [];
  for (const result of results) {
    const key = `${result.url}:${result.snippet.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(result);
  }
  return out;
}
