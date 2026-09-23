#!/usr/bin/env node
// Run ETL and POST /api/calc/run first. No credentials, browser session or runtime dependency.
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, mkdtempSync, rmSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const USER_AGENT = 'AinalymSkuImages/1.0';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let lastRequest = 0;
let requestQueue = Promise.resolve();
const robots = new Map();
const cooldown = new Set();
export function parseRobots(text, agent = USER_AGENT) {
  const groups = []; let group; let hasRules = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim(); const i = line.indexOf(':'); if (i < 0) continue;
    const key = line.slice(0, i).toLowerCase(), value = line.slice(i + 1).trim();
    if (key === 'user-agent') {
      if (!group || hasRules) { group = { agents: [], rules: [], delay: 0 }; groups.push(group); hasRules = false; }
      group.agents.push(value.toLowerCase());
    } else if (group && ['allow', 'disallow', 'crawl-delay'].includes(key)) {
      hasRules = true;
      if (key === 'crawl-delay') group.delay = Math.max(group.delay, Number(value) * 1000 || 0);
      else if (value) group.rules.push({ allow: key === 'allow', pattern: value });
    }
  }
  const named = groups.filter(g => g.agents.some(a => a !== '*' && agent.toLowerCase().includes(a)));
  const selected = named.length ? named : groups.filter(g => g.agents.includes('*'));
  return { rules: selected.flatMap(g => g.rules), delay: Math.max(550, ...selected.map(g => g.delay)) };
}
export function robotsAllows(policy, url) {
  const u = new URL(url), target = u.pathname + u.search;
  const matches = policy.rules.filter(r => {
    const pattern = r.pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*').replace(/\\\$$/, '$');
    return new RegExp('^' + pattern).test(target);
  }).sort((a, b) => b.pattern.length - a.pattern.length || Number(b.allow) - Number(a.allow));
  return !matches.length || matches[0].allow;
}
async function rawFetch(url, delay = 550) {
  if (cooldown.has(new URL(url).origin)) throw new Error('host stopped after rate-limit/server failure');
  const turn = requestQueue.then(async () => { await sleep(Math.max(0, lastRequest + delay - Date.now())); lastRequest = Date.now(); });
  requestQueue = turn.catch(() => {}); await turn;
  if (cooldown.has(new URL(url).origin)) throw new Error('host stopped after rate-limit/server failure');
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'manual', signal: AbortSignal.timeout(12000) });
  if (response.status === 429 || response.status === 503) cooldown.add(new URL(url).origin);
  return response;
}
export async function politeFetch(url, redirects = 0) {
  if (redirects > 5) throw new Error('redirect limit');
  const u = new URL(url);
  if (u.protocol !== 'https:') throw new Error('HTTPS required');
  if (!robots.has(u.origin)) {
    const r = await rawFetch(u.origin + '/robots.txt');
    if (r.status === 404) robots.set(u.origin, parseRobots(''));
    else if (r.ok) {
      const body = await r.text();
      if (/<html/i.test(body)) throw new Error('robots returned HTML; refusing host');
      robots.set(u.origin, parseRobots(body));
    } else throw new Error(`robots unavailable: ${r.status}`);
  }
  const policy = robots.get(u.origin);
  if (!robotsAllows(policy, url)) throw new Error('robots disallow');
  const r = await rawFetch(url, policy.delay);
  if (r.status >= 300 && r.status < 400 && r.headers.get('location')) return politeFetch(new URL(r.headers.get('location'), url).href, redirects + 1);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r;
}
export function thumbnail(input, output) {
  const dir = mkdtempSync(join(tmpdir(), 'ainalym-sku-'));
  try {
    const scaled = join(dir, 'scaled.jpg');
    execFileSync('sips', ['-s', 'format', 'jpeg', '-Z', '96', input, '--out', scaled], { stdio: 'pipe' });
    for (const quality of [78, 60, 40, 25]) {
      const final = join(dir, 'final.jpg');
      execFileSync('sips', ['-p', '96', '96', '--padColor', 'F2F0EC', '-s', 'format', 'jpeg', '-s', 'formatOptions', String(quality), scaled, '--out', final], { stdio: 'pipe' });
      if (statSync(final).size <= 12000) { mkdirSync(join(output, '..'), { recursive: true }); renameSync(final, output); return; }
    }
    throw new Error('thumbnail exceeds 12000 bytes');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
export function saveJson(path, value) { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path + '.tmp', JSON.stringify(value, null, 2) + '\n'); renameSync(path + '.tmp', path); }
const decode = s => s.replaceAll('&amp;', '&').replaceAll('&quot;', '"');
export function iekMatch(html, article) {
  const data = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  if (!data) return null;
  return JSON.parse(data).props?.pageProps?.apiListing?.products?.find(p => p.article.toUpperCase() === article.toUpperCase()) || null;
}
async function official(sku) {
  if (!sku.article) throw new Error('missing supplier article');
  if (sku.supplier_id === 'IEK') {
    const source = `https://www.iek.ru/products/catalog/search?q=${encodeURIComponent(sku.article)}`;
    const match = iekMatch(await (await politeFetch(source)).text(), sku.article);
    if (!match?.imageVariants?.length) throw new Error('no exact article image');
    return { source, image: match.imageVariants[0].url, kind: 'official' };
  }
  const source = `https://systeme.ru/product/${encodeURIComponent(sku.article)}/`;
  const html = await (await politeFetch(source)).text();
  const product = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m => { try { const x = JSON.parse(m[1]); return x['@graph'] || [x]; } catch { return []; } }).find(x => x['@type'] === 'Product' && [x.sku,x.mpn].includes(sku.article));
  const image = Array.isArray(product?.image) ? product.image[0] : product?.image;
  if (typeof image !== 'string') throw new Error('no verified article image');
  return { source, image: new URL(image, source).href, kind: 'official' };
}
async function store(sku) {
  // EKT search/query URLs are robots-blocked. Public code permalinks may redirect to catalog pages.
  const source = `https://ekt.kz/products/${encodeURIComponent(sku.code_1c)}`;
  const response = await politeFetch(source); const html = await response.text();
  const product = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m => { try { const x = JSON.parse(m[1]); return x['@graph'] || [x]; } catch { return []; } }).find(x => x['@type'] === 'Product' && [x.sku,x.mpn,x.productID].some(id => id && [sku.article,sku.code_1c].includes(id)));
  if (!product) throw new Error('no structured exact article match');
  const image = Array.isArray(product.image) ? product.image[0] : product.image;
  if (typeof image !== 'string' || /no.?image|logo/i.test(image)) throw new Error('no product image');
  return { source: response.url, image: new URL(decode(image), source).href, kind: 'store' };
}
export async function priority(base) {
  const r = await (await fetch(base + '/api/recommendations')).json();
  if (!r.ok) throw new Error('recommendations unavailable');
  const all = [];
  for (let offset = 0;; offset += 500) {
    const page = await (await fetch(`${base}/api/skus?limit=500&offset=${offset}`)).json();
    if (!page.ok) throw new Error('SKU API unavailable');
    all.push(...page.items); if (all.length >= page.total) break;
  }
  const byCode = new Map(all.map(x => [x.code_1c, x]));
  return r.groups.flatMap(g => g.rows).filter(x => x.qty_recommended > 0).map(x => ({ ...x, ...byCode.get(x.code_1c) }))
    .sort((a, b) => a.supplier_id.localeCompare(b.supplier_id) || Number(b.unit_cost) - Number(a.unit_cost) || a.code_1c.localeCompare(b.code_1c));
}
async function main() {
  const rows = await priority(process.env.IMAGES_API || 'http://localhost:3410');
  const requested = Number(process.env.IMAGES_LIMIT || 400);
  if (!Number.isInteger(requested) || requested < 1 || requested > 400) throw new Error('IMAGES_LIMIT must be 1..400');
  const manifest = existsSync('fixtures/sku_images.json') ? JSON.parse(readFileSync('fixtures/sku_images.json', 'utf8')) : {};
  const report = existsSync('docs/evidence/images/fetch.json') ? JSON.parse(readFileSync('docs/evidence/images/fetch.json', 'utf8')) : { started_at: new Date().toISOString(), priority: 'positive recommended quantity; supplier ASC, unit cost DESC (unknown=0), code ASC', cap: requested, eligible: rows.length, selected: rows.slice(0,requested).map(x => x.code_1c), sources: {}, rows: [] };
  if (report.cap !== requested || JSON.stringify(report.selected) !== JSON.stringify(rows.slice(0, requested).map(x=>x.code_1c))) throw new Error('Priority changed: archive the previous fetch report before a new run');
  mkdirSync('data/images', { recursive: true });
  const attempted = new Set(report.rows.map(r => r.code_1c));
  const pending = rows.slice(0, requested).filter(r => !attempted.has(r.code_1c))[Symbol.iterator]();
  async function worker() {
  for (const sku of pending) {
    if (!/^[\w-]+$/.test(sku.code_1c)) throw new Error('unsafe SKU code');
    const result = { code_1c: sku.code_1c, attempts: [] };
    if (manifest[sku.code_1c] && existsSync('public' + manifest[sku.code_1c].path)) { result.cached = true; report.rows.push(result); continue; }
    for (const [name, resolve] of [[sku.supplier_id === 'IEK' ? 'iek.ru' : 'systeme.ru', official], ['ekt.kz', store]]) {
      const stat = report.sources[name] ||= { attempts: 0, hits: 0 }; stat.attempts++;
      try {
        const asset = await resolve(sku); const r = await politeFetch(asset.image);
        if (!r.headers.get('content-type')?.startsWith('image/')) throw new Error('not an image');
        const bytes = Buffer.from(await r.arrayBuffer()); if (bytes.length > 20_000_000) throw new Error('image too large');
        const tmp = `data/images/${sku.code_1c}.download`; writeFileSync(tmp, bytes);
        const path = `/sku/${sku.code_1c}.jpg`; thumbnail(tmp, 'public' + path); rmSync(tmp);
        manifest[sku.code_1c] = { path, source: asset.source, kind: asset.kind, fetched_at: new Date().toISOString() };
        stat.hits++; result.attempts.push({ source: name, status: 'hit', image_source: asset.image }); break;
      } catch (error) { result.attempts.push({ source: name, status: 'miss', reason: error.message }); }
    }
    report.rows.push(result); saveJson('fixtures/sku_images.json', manifest);
    saveJson('docs/evidence/images/fetch.json', report);
    if (report.rows.length % 25 === 0) console.log(JSON.stringify({ processed: report.rows.length, sources: report.sources }));
  }
  }
  await Promise.all(Array.from({length: 4}, () => worker()));
  report.rows.sort((a,b) => report.selected.indexOf(a.code_1c)-report.selected.indexOf(b.code_1c));
  report.finished_at = new Date().toISOString();
  for (const s of Object.values(report.sources)) s.hit_rate = s.hits / s.attempts;
  saveJson('docs/evidence/images/fetch.json', report); console.log(JSON.stringify(report.sources));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
