import { describe, expect, it } from 'vitest';
import { buildSnapshot, extractText, isPrivateAddress, normaliseWebsite } from '../site-fetch';

describe('normaliseWebsite', () => {
  it('adds a scheme to bare domains', () => {
    expect(normaliseWebsite('acme.com')?.toString()).toBe('https://acme.com/');
  });

  it('keeps an explicit scheme and path', () => {
    expect(normaliseWebsite('http://acme.com/about')?.toString()).toBe('http://acme.com/about');
  });

  it('trims surrounding whitespace', () => {
    expect(normaliseWebsite('  acme.com  ')?.toString()).toBe('https://acme.com/');
  });

  it('rejects empty input', () => {
    expect(normaliseWebsite('')).toBeUndefined();
    expect(normaliseWebsite('   ')).toBeUndefined();
  });

  it('rejects hostnames without a dot', () => {
    expect(normaliseWebsite('localhost')).toBeUndefined();
    expect(normaliseWebsite('http://intranet')).toBeUndefined();
  });

  it('rejects non-http schemes', () => {
    expect(normaliseWebsite('file:///etc/passwd')).toBeUndefined();
    expect(normaliseWebsite('ftp://acme.com')).toBeUndefined();
  });
});

describe('isPrivateAddress', () => {
  it('blocks loopback, private and link-local v4', () => {
    for (const address of [
      '127.0.0.1',
      '10.0.0.1',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254', // cloud metadata
      '100.64.0.1', // CGNAT
      '0.0.0.0',
      '255.255.255.255',
      '224.0.0.1',
    ]) {
      expect(isPrivateAddress(address), address).toBe(true);
    }
  });

  it('allows public v4', () => {
    for (const address of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '93.184.216.34']) {
      expect(isPrivateAddress(address), address).toBe(false);
    }
  });

  it('blocks loopback, link-local and ULA v6', () => {
    for (const address of ['::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:127.0.0.1']) {
      expect(isPrivateAddress(address), address).toBe(true);
    }
  });

  it('allows public v6', () => {
    expect(isPrivateAddress('2606:4700:4700::1111')).toBe(false);
  });

  it('refuses anything that is not an IP literal', () => {
    expect(isPrivateAddress('not-an-ip')).toBe(true);
  });
});

describe('extractText', () => {
  it('drops scripts and styles', () => {
    const html = '<style>.a{color:red}</style><script>alert("x")</script><p>Real copy</p>';
    expect(extractText(html)).toBe('Real copy');
  });

  it('keeps block boundaries as newlines', () => {
    expect(extractText('<h1>Title</h1><p>Body</p>')).toBe('Title\nBody');
  });

  it('decodes entities', () => {
    expect(extractText('<p>Tools &amp; Ops &mdash; 24&#47;7</p>')).toBe('Tools & Ops — 24/7');
  });

  it('strips comments', () => {
    expect(extractText('<!-- hidden --><p>Shown</p>')).toBe('Shown');
  });
});

describe('buildSnapshot', () => {
  it('pulls the title and meta description', () => {
    const html = `
      <html><head>
        <title>Acme &mdash; Logistics</title>
        <meta name="description" content="We move freight.">
      </head><body><p>About us</p></body></html>`;

    const snapshot = buildSnapshot('https://acme.com/', html);
    expect(snapshot.title).toBe('Acme — Logistics');
    expect(snapshot.description).toBe('We move freight.');
    expect(snapshot.text).toContain('About us');
  });

  it('falls back to og:description', () => {
    const html = '<meta property="og:description" content="Open graph copy."><p>Hi</p>';
    expect(buildSnapshot('https://acme.com/', html).description).toBe('Open graph copy.');
  });
});
