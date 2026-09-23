import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRobots, robotsAllows, iekMatch } from '../../scripts/images/fetch_sku_images.mjs';
test('robots wildcard, specificity, allow tie, terminal anchor and named agents', () => {
 const p = parseRobots('User-agent: *\nDisallow: /private/\nAllow: /private/photo.jpg\nDisallow: /*?*\nDisallow: /*.php$\nCrawl-delay: 2');
 assert.equal(robotsAllows(p,'https://example.com/private/a'),false);
 assert.equal(robotsAllows(p,'https://example.com/private/photo.jpg'),true);
 assert.equal(robotsAllows(p,'https://example.com/catalog?q=abc'),false);
 assert.equal(robotsAllows(p,'https://example.com/a.php'),false);
 assert.equal(robotsAllows(p,'https://example.com/a.php/photo.jpg'),true);
 assert.equal(p.delay,2000);
 const named=parseRobots('User-agent: *\nDisallow: /\nUser-agent: AinalymSkuImages\nAllow: /');
 assert.equal(robotsAllows(named,'https://example.com/a'),true);
});
test('IEK search never substitutes similar articles or unrelated products', () => {
 const html='<script id="__NEXT_DATA__" type="application/json">'+JSON.stringify({props:{pageProps:{apiListing:{products:[{article:'ABC-12',imageVariants:[{url:'a'}]},{article:'ABC-123',imageVariants:[{url:'b'}]}]}}}})+'</script>';
 assert.equal(iekMatch(html,'abc-12').imageVariants[0].url,'a');
 assert.equal(iekMatch(html,'ABC-1'),null);
 assert.equal(iekMatch('<html>login</html>','ABC-12'),null);
});
