import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  abledtonManualUrl,
  buildSearchQueries,
  detectLiveDeviceName,
  extractArticleSnippetFromHtml,
  extractTabSnippetFromHtml,
  isDocsContentHost,
  isLiveOrProductionQuery,
  isMusicalDetailQuery,
  isTabQuery,
  shouldUseWikipedia,
  webSearch,
} from './web-search.js';

describe('isTabQuery', () => {
  it('detects tab and rhythm queries', () => {
    expect(isTabQuery('bass tab 16th notes')).toBe(true);
    expect(isTabQuery('U2 song overview')).toBe(false);
  });
});

describe('isLiveOrProductionQuery', () => {
  it('detects Ableton and production technique queries', () => {
    expect(isLiveOrProductionQuery('how do I sidechain in Ableton')).toBe(true);
    expect(isLiveOrProductionQuery('glue compressor attack release')).toBe(true);
    expect(isLiveOrProductionQuery('U2 song overview')).toBe(false);
  });
});

describe('detectLiveDeviceName', () => {
  it('finds built-in device names in a query', () => {
    expect(detectLiveDeviceName('Operator FM bass tutorial')).toBe('Operator');
    expect(detectLiveDeviceName('random song title')).toBeNull();
  });
});

describe('shouldUseWikipedia', () => {
  it('skips Wikipedia for tabs and Live/production queries', () => {
    expect(shouldUseWikipedia('U2 bass tab')).toBe(false);
    expect(shouldUseWikipedia('Operator synthesis tips')).toBe(false);
    expect(shouldUseWikipedia('U2 band history')).toBe(true);
  });
});

describe('isMusicalDetailQuery', () => {
  it('covers tabs and production queries', () => {
    expect(isMusicalDetailQuery('bass tab 16th notes')).toBe(true);
    expect(isMusicalDetailQuery('mixing kick and bass')).toBe(true);
    expect(isMusicalDetailQuery('U2 song overview')).toBe(false);
  });
});

describe('buildSearchQueries', () => {
  it('prioritises bass tab variants for performance queries', () => {
    const queries = buildSearchQueries(
      "search the web for U2's 'With or Without You' main bass line 16th notes",
    );
    // Quoted song title → bass tab variant goes first; artist name stays in the focused query
    expect(queries[0]).toBe('With or Without You bass tab');
    expect(queries).toContain('With or Without You');
  });

  it('prioritises Ableton docs for Live and device queries', () => {
    const queries = buildSearchQueries('how to make sub bass with Operator in Live');
    expect(queries[0]).toBe('Ableton Live Operator tutorial site:ableton.com');
    expect(queries).toContain('site:ableton.com how to make sub bass with Operator in Live');
  });

  it('adds mixing/mastering fallback for mixing queries', () => {
    const queries = buildSearchQueries('sidechain compression Ableton Live tutorial');
    expect(queries).toContain('site:ableton.com sidechain compression Ableton Live tutorial');
    expect(queries).toContain('mixing mastering tutorial site:ableton.com');
  });

  it('adds sound design fallback for synthesis queries', () => {
    const queries = buildSearchQueries('sound design with Operator Ableton wavetable synthesis');
    expect(queries).toContain('sound design synthesis tutorial site:ableton.com');
  });
});

describe('isDocsContentHost', () => {
  it('matches ableton.com and all its subdomains', () => {
    expect(isDocsContentHost('https://www.ableton.com/en/manual/')).toBe(true);
    expect(isDocsContentHost('https://ableton.com/en/blog/')).toBe(true);
    expect(isDocsContentHost('https://learningmusic.ableton.com/')).toBe(true);
    expect(isDocsContentHost('https://makingmusic.ableton.com/active-listening')).toBe(true);
  });

  it('rejects non-ableton hosts', () => {
    expect(isDocsContentHost('https://www.bigbasstabs.com/tab.html')).toBe(false);
    expect(isDocsContentHost('https://en.wikipedia.org/wiki/Sidechain')).toBe(false);
    expect(isDocsContentHost('not-a-url')).toBe(false);
  });
});

describe('extractTabSnippetFromHtml', () => {
  it('pulls ASCII tab text from a pre block', () => {
    const snippet = extractTabSnippetFromHtml(
      '<pre>With or Without You<br/>A|—5—5—5—5—|<br/>E|—7—7—7—7—|</pre>',
    );
    expect(snippet).toContain('5—5—5—5');
  });
});

describe('extractArticleSnippetFromHtml', () => {
  it('pulls article text from main or article blocks', () => {
    const snippet = extractArticleSnippetFromHtml(
      '<main><h1>Sub Bass</h1><p>Use Operator with a sine wave, filter the highs, and boost the fundamental slightly for a clean sub that sits under the kick.</p></main>',
    );
    expect(snippet).toContain('Operator');
    expect(snippet).toContain('sine wave');
  });
});

describe('webSearch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws on empty query', async () => {
    await expect(webSearch('  ')).rejects.toThrow('non-empty query');
  });

  it('returns tab excerpts and web links for bass tab queries', async () => {
    const fetchPost = vi.fn().mockResolvedValue(`
      <a href="https://www.bigbasstabs.com/u2_bass_tabs/with_or_without_you_bass_tab.html" class='result-link'>BigBassTabs</a>
      <td class='result-snippet'>Bass tab</td>
    `);
    const fetchText = vi.fn(async (url: string) => {
      if (url.includes('bigbasstabs.com')) {
        return '<pre>A|—5—5—5—5—|<br/>E|—7—7—7—7—|</pre>';
      }
      if (url.includes('wikipedia.org')) {
        return JSON.stringify({
          query: { search: [{ title: 'With or Without You', snippet: 'U2 song' }] },
        });
      }
      if (url.includes('page/summary')) {
        return JSON.stringify({ extract: 'A song by U2.' });
      }
      throw new Error(`unexpected ${url}`);
    });

    const result = await webSearch('U2 with or without you bass tab', { fetchText, fetchPost });

    expect(result.ok).toBe(true);
    expect(result.results.some((hit) => hit.source === 'tab' && hit.snippet.includes('5—5'))).toBe(
      true,
    );
    expect(result.results.some((hit) => hit.source === 'web')).toBe(true);
  });

  it('returns Ableton article excerpts for production queries', async () => {
    const fetchPost = vi.fn().mockResolvedValue(`
      <a href="https://www.ableton.com/en/blog/get-deep-make-sub-bass-operator/" class='result-link'>Sub bass with Operator</a>
      <td class='result-snippet'>Tutorial</td>
    `);
    const fetchText = vi.fn(async (url: string) => {
      if (url.includes('ableton.com')) {
        return '<article><p>Route Operator through a low-pass filter and boost the fundamental for sub bass.</p></article>';
      }
      throw new Error(`unexpected ${url}`);
    });

    const result = await webSearch('Operator sub bass tutorial Ableton', { fetchText, fetchPost });

    expect(result.ok).toBe(true);
    expect(
      result.results.some((hit) => hit.source === 'docs' && hit.snippet.includes('low-pass')),
    ).toBe(true);
    expect(result.results.some((hit) => hit.source === 'wikipedia')).toBe(false);
  });

  it('returns ok:false when all providers fail', async () => {
    const result = await webSearch('obscure query xyz', {
      fetchText: vi.fn().mockRejectedValue(new Error('offline')),
      fetchPost: vi.fn().mockRejectedValue(new Error('offline')),
    });
    expect(result.ok).toBe(false);
    expect(result.results).toEqual([]);
  });

  it('returns a docs result from the Ableton manual when the page is fetchable', async () => {
    const manualHtml =
      '<html><body><main>' +
      '<h2 id="operator"><span>30.9</span> Operator</h2>' +
      '<p>Operator is a powerful FM synthesizer with four oscillators, envelopes, and an LFO.</p>' +
      '</main></body></html>';
    const fetchPost = vi.fn().mockResolvedValue('');
    const fetchText = vi.fn(async (url: string) => {
      if (url.includes('ableton.com')) return manualHtml;
      throw new Error(`unexpected ${url}`);
    });

    const result = await webSearch('Operator FM synthesis tips', { fetchText, fetchPost });

    expect(result.ok).toBe(true);
    expect(result.results[0].source).toBe('docs');
    expect(result.results[0].url).toContain('#operator');
    expect(result.results[0].snippet).toContain('Operator');
  });
});

describe('abledtonManualUrl', () => {
  it('returns a non-null ableton.com URL for known devices', () => {
    const url = abledtonManualUrl('Operator');
    expect(url).not.toBeNull();
    expect(url).toContain('ableton.com');
    expect(url).toContain('#operator');
  });

  it('is case-insensitive', () => {
    expect(abledtonManualUrl('glue compressor')).toBe(abledtonManualUrl('Glue Compressor'));
  });

  it('returns null for unknown device names', () => {
    expect(abledtonManualUrl('nonexistent')).toBeNull();
    expect(abledtonManualUrl('')).toBeNull();
  });
});
