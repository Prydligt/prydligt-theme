// Bygger colors.json: serier av samma produkt i olika färger, grupperade på engelska namnet utan färgord.
// Körs varje natt av .github/workflows/colors.yml. Kräver Node 18+ (inbyggd fetch), inga beroenden.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const API = 'https://www.prydligt.se/backend/jsonrpc/v1?webshop=89339';
const SKIP_GROUPS = new Set([9477981]); // armband/straps till smartklockor
const SKIP_NAME = /\b(strap|warranty|garanti|tool|toolkit|charger|cable|gift ?card)\b/i;
const COL = /\b(18k|14k|silver|silvery|gold|golden|rose|rosé|black|blue|green|white|brown|grey|gray|red|steel|stainless|pink|purple|teal|yellow|orange|navy|champagne|pine|lavender|forest|cream|beige|bronze|copper|titanium|gunmetal|case|dial|oro|argento|arento|nero|blu|rosa|verde|bianco|marrone|grigio|giallo|azzurro|madreperlaceo|marmo|light|dark|matte|mesh|leather|rubber|tone|two|and)\b/gi;
const norm = n => String(n || '').toLowerCase().replace(/[\/&,()+\-]/g, ' ').replace(COL, ' ').replace(/\s+/g, ' ').trim();

const rows = [];
for (let off = 0; off < 20000; off += 500) {
  const r = await fetch(API, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'Article.list', params: [{ articleNumber: true, name: 'en', articlegroup: true }, { limit: 500, offset: off }] })
  });
  const j = await r.json();
  if (!j.result) throw new Error('API-fel: ' + JSON.stringify(j.error || j).slice(0, 300));
  rows.push(...j.result);
  if (j.result.length < 500) break;
}
if (rows.length < 500) throw new Error('För få artiklar (' + rows.length + '), avbryter utan att skriva över.');

const g = {};
for (const r of rows) {
  const nr = String(r.articleNumber || '').trim(), name = r.name && r.name.en;
  if (!nr || !name || SKIP_GROUPS.has(r.articlegroup) || SKIP_NAME.test(name)) continue;
  const k = norm(name);
  if (k.split(' ').length < 2) continue;
  (g[k] = g[k] || []).push(nr);
}
const groups = Object.keys(g).sort().map(k => g[k].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))).filter(l => l.length >= 2 && l.length <= 24);

const out = JSON.stringify({ articles: rows.length, groups });
const prev = existsSync('colors.json') ? readFileSync('colors.json', 'utf8') : '';
if (prev !== out) writeFileSync('colors.json', out);
console.log(`${rows.length} artiklar, ${groups.length} serier, ${groups.flat().length} artiklar i serier${prev === out ? ' (oförändrat)' : ''}`);
