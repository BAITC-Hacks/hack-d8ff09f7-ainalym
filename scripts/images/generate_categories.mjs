#!/usr/bin/env node
// Owner-authorized Higgsfield Team generation. Resumable; reserves quoted credits before submission.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { saveJson, thumbnail } from './fetch_sku_images.mjs';
const cli = homedir() + '/.local/bin/higgsfield';
const call = args => JSON.parse(execFileSync(cli, [...args, '--json'], { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] }));
const ledgerPath = 'docs/evidence/images/generation.json';
const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : { model: 'nano_banana_flash', cap: 1200, calls: [] };
const cats = JSON.parse(readFileSync('docs/evidence/images/categories.json', 'utf8'));
const subjects = {
 'IEK:0302': 'a single European recessed square wall socket, brushed aluminum gray faceplate',
 'SE:1': 'a compact arrangement of a square wall socket, rocker switch and small white distribution enclosure, generic electrical installation category overview',
 'SE:2': 'a compact arrangement of a champagne square wall dimmer, double data socket and a small distribution enclosure, generic electrical installation category overview',
 'SE:3': 'a compact arrangement of a dark square wall USB outlet, white thermostat and rotary dimmer, generic electrical installation category overview',
 'IEK:1303': 'a compact arrangement of an insulated electrician screwdriver and cable crimping pliers with a small industrial pushbutton',
 'IEK:2801': 'a short length of white rectangular PVC cable trunking with its lid slightly lifted',
 'IEK:1302': 'a brass neutral busbar terminal strip on small blue insulating supports',
 'IEK:2803': 'a short galvanized perforated steel cable tray with a wall support bracket',
 'IEK:2703': 'a small gray metal step-down transformer enclosure with a hinged door',
 'IEK:0811': 'a frosted white LED light bulb with an E27 screw base',
 'IEK:1201': 'a compact three-pole industrial electromagnetic contactor, white and black molded housing with screw terminals',
 'IEK:0105': 'a single-pole DIN rail miniature circuit breaker, light gray housing and small yellow toggle',
 'IEK:2802': 'a white PVC right-angle external corner fitting for rectangular cable trunking',
 'IEK:2004': 'a plain white square single rocker recessed wall switch',
 'IEK:2401': 'three plain white nylon cable ties, one closed into a loop',
 'IEK:2502': 'a small closed gray steel electrical distribution cabinet with a simple hinged door',
 'IEK:2506': 'a compact white recessed plastic electrical distribution board with translucent smoke-gray door',
 'IEK:0107': 'a three-pole DIN rail circuit breaker with linked yellow toggle levers and gray housing',
 'IEK:0103': 'a two-pole residual current circuit breaker, gray housing with yellow levers and a small test button',
 'IEK:1306': 'a compact thermal overload relay with black housing, terminal screws and a small blue adjustment dial',
 'IEK:2514': 'a white plastic electrical distribution enclosure with a transparent dark hinged cover',
 'IEK:0201': 'a red and white industrial three-phase round power plug',
 'IEK:0108': 'a black three-pole molded-case circuit breaker with large central toggle',
 'IEK:2403': 'a few small blank yellow cylindrical electrical wire marker sleeves, no printed marks',
 'IEK:2901': 'a white three-socket extension power strip with a neatly coiled short cable',
 'IEK:0808': 'a green round panel-mount indicator light with a black threaded housing',
 'IEK:1309': 'a red mushroom-head emergency stop pushbutton with a black mounting collar',
 'IEK:1501': 'a compact arrangement of black heat-shrink tubing and a small black outdoor wall light, generic electrical supplies category overview',
 'IEK:2601': 'three silver tinned copper cable lugs with round bolt holes and tubular crimp ends',
 'IEK:0104': 'a gray DIN rail voltage monitoring relay with a blank dark display and two small buttons',
};
try {
 const workspace = call(['workspace','status']);
 if (workspace.plan_type !== 'team' || !workspace.is_selected) throw new Error('selected Team workspace required');
 ledger.workspace_type = 'team'; delete ledger.error;
 for (const cat of cats) {
  if (ledger.calls.some(x => x.key === cat.key)) continue;
  const subject = subjects[cat.supplier + ':' + cat.category]; if (!subject) throw new Error('missing curated subject: ' + cat.key);
  const prompt = `Understated realistic studio product photograph of ${subject}. Front three-quarter view, objects centered and fully visible with generous margins on a matte warm greige background, soft diffuse light, subtle shadow, muted low-saturation colors. Real electrical hardware proportions. No text, no lettering, no numbers, no brand logo, no decoration. A small category thumbnail, not an exact SKU photograph.`;
  const args = ['nano_banana_flash','--prompt',prompt,'--aspect-ratio','1:1','--resolution','1k'];
  const quoted = call(['generate','cost',...args]).credits;
  const reserved = ledger.calls.reduce((n,x) => n + x.reserved_credits,0);
  if (!Number.isFinite(quoted) || quoted < 0 || reserved + quoted > 1200) throw new Error('lane credit cap');
  const entry = { key: cat.key, slug: cat.supplier.toLowerCase() + '-' + cat.category, prompt, reserved_credits: quoted, status: 'reserved', submitted_at: new Date().toISOString() };
  ledger.calls.push(entry); saveJson(ledgerPath, ledger);
  { const ids = call(['generate','create',...args]); if (!Array.isArray(ids) || ids.length !== 1) throw new Error('unexpected job response'); entry.job_id = ids[0]; }
  entry.status = 'submitted'; saveJson(ledgerPath, ledger); console.log('submitted', cat.key, quoted);
 }
 for (let round = 0; round < 35; round++) {
  let pending = 0;
  for (const entry of ledger.calls) {
   if (['completed','failed'].includes(entry.status)) continue;
   if (!entry.job_id) throw new Error('ambiguous submission; inspect before retry');
   const job = call(['generate','get',entry.job_id]);
   entry.provider_created_at = job.created_at;
   if (job.status === 'completed' && job.result_url) {
    const r = await fetch(job.result_url, {signal:AbortSignal.timeout(30000)}); if (!r.ok) throw new Error('result download failed');
    const tmp = `data/images/${entry.slug}.generated`; writeFileSync(tmp, Buffer.from(await r.arrayBuffer()));
    thumbnail(tmp, `public/sku/category/${entry.slug}.jpg`); rmSync(tmp);
    entry.status = 'completed'; entry.source = `https://higgsfield.ai/?jobId=${entry.job_id}`; entry.fetched_at = new Date().toISOString();
    console.log('completed',entry.key);
   } else if (['failed','error','cancelled'].includes(job.status)) {entry.status='failed';entry.provider_status=job.status;}
   else { pending++; entry.provider_status=job.status; }
   saveJson(ledgerPath,ledger);
  }
  if (!pending) break;
  await new Promise(r => setTimeout(r,10000));
 }
 ledger.reserved_credits = ledger.calls.reduce((n,x)=>n+x.reserved_credits,0);saveJson(ledgerPath,ledger);
 const manifest = existsSync('fixtures/sku_images.json') ? JSON.parse(readFileSync('fixtures/sku_images.json','utf8')) : {};
 for (const entry of ledger.calls.filter(x=>x.status==='completed')) manifest[entry.key] = {path:`/sku/category/${entry.slug}.jpg`,source:entry.source,kind:'category',fetched_at:entry.fetched_at};
 saveJson('fixtures/sku_images.json',manifest);
} catch (e) { ledger.error = e.message; saveJson(ledgerPath,ledger); console.error(e.message); process.exitCode=1; }
