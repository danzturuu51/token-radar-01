// Token Radar's dashboard: search, filter, sort, detail and the model's audit trail.
// It reads window.RADAR from data.js (written by main.ts), never the network.
// It recomputes every row's implied value from the raw figures and says so:
// the page and board.json must agree, and the audit line proves it.

const root = document.querySelector('#board');
const data = window.RADAR;
if (!root) throw new Error('no #board element');
if (!data) {
  root.innerHTML = '<p class="empty">The dashboard data did not load. This page needs data.js next to it.</p>';
  throw new Error('window.RADAR missing');
}

/** A number the dashboard can say out loud: $2,750,000,000 or $578,123,456. */
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
const moneyShort = (n) => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
};
const pct = (n) => (n === null || n === undefined ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`);
const days = (n) => (n === null || n === undefined ? 'unknown' : `${n.toLocaleString('en-US')}d`);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** The model's growth multiplier, from the same constants data.js carries. */
function growthMultiplier(change7d) {
  const g = clamp(change7d ?? 0, data.model.growth_floor, data.model.growth_cap);
  return 1 + (g / 100) * data.model.growth_weight;
}
function maturityMultiplier(ageDays) {
  const age = ageDays ?? data.model.unknown_age_days;
  return data.model.maturity_floor + (clamp(age, 0, data.model.maturity_days) / data.model.maturity_days) * data.model.maturity_range;
}
function breadthMultiplier(chains) {
  return 1 + Math.min(Math.max(chains.length - 1, 0), data.model.breadth_max_chains) * data.model.breadth_per_chain;
}
/** A row's implied value, recomputed in the page from its raw figures. */
function computedImplied(row) {
  return Math.max(1, Math.round(row.tvl_usd * row.sector_multiple * growthMultiplier(row.change_7d) * maturityMultiplier(row.age_days) * breadthMultiplier(row.chains)));
}
const auditMismatches = data.rows.filter((r) => computedImplied(r) !== r.implied_value_usd).length;

/** The board's two tabs: pre-token (ranked) and live-token (for comparison). */
const state = { q: '', category: '', chain: '', watchlist: false, sort: 'implied', tab: 'pre', detail: '' };
const watchlist = new Set(data.watchlist_slugs ?? []);
const isWatchlist = (slug) => watchlist.has(slug);

function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  state.q = h.get('q') ?? '';
  state.category = h.get('category') ?? '';
  state.chain = h.get('chain') ?? '';
  state.watchlist = h.get('watchlist') === '1';
  state.sort = h.get('sort') ?? 'implied';
  state.tab = h.get('tab') === 'live' ? 'live' : 'pre';
  state.detail = h.get('p') ?? '';
}
function writeHash() {
  const h = new URLSearchParams();
  if (state.q) h.set('q', state.q);
  if (state.category) h.set('category', state.category);
  if (state.chain) h.set('chain', state.chain);
  if (state.watchlist) h.set('watchlist', '1');
  if (state.sort !== 'implied') h.set('sort', state.sort);
  if (state.tab === 'live') h.set('tab', 'live');
  if (state.detail) h.set('p', state.detail);
  history.replaceState(null, '', `#${h.toString()}`);
}

function filteredRows() {
  const q = state.q.trim().toLowerCase();
  let rows = data.rows.filter((r) => {
    if (state.watchlist && !isWatchlist(r.slug)) return false;
    if (state.category && r.category !== state.category) return false;
    if (state.chain && !r.chains.includes(state.chain)) return false;
    if (q && !(r.name + ' ' + r.slug + ' ' + (r.category ?? '') + ' ' + r.chains.join(' ')).toLowerCase().includes(q)) return false;
    return true;
  });
  const by = {
    implied: (a, b) => b.implied_value_usd - a.implied_value_usd,
    tvl: (a, b) => b.tvl_usd - a.tvl_usd,
    growth: (a, b) => (b.change_7d ?? -Infinity) - (a.change_7d ?? -Infinity),
    age: (a, b) => (b.age_days ?? -1) - (a.age_days ?? -1),
    name: (a, b) => a.name.localeCompare(b.name),
  }[state.sort] ?? ((a, b) => a.rank - b.rank);
  return [...rows].sort(by);
}

function rowHtml(r, maxImplied) {
  const wl = isWatchlist(r.slug);
  return `<tr data-slug="${esc(r.slug)}" data-selected="${state.detail === r.slug}">
    <td class="rank-num">${r.rank}</td>
    <td><span class="name"><b>${esc(r.name)}${wl ? '<span class="watch">watchlist</span>' : ''}</b><span class="sub">${esc(r.category ?? 'Uncategorised')} · ${esc(r.chains.slice(0, 3).join(', '))}${r.chains.length > 3 ? ` +${r.chains.length - 3}` : ''}</span></span></td>
    <td class="num">${moneyShort(r.tvl_usd)}</td>
    <td class="num ${r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'}">${pct(r.change_7d)}</td>
    <td class="num">${days(r.age_days)}</td>
    <td><span class="implied"><span class="bar"><i style="width:${Math.max(2, Math.round((r.implied_value_usd / maxImplied) * 100))}%"></i></span><span class="num">${moneyShort(r.implied_value_usd)}</span></span></td>
  </tr>`;
}

function liveRowHtml(r, maxMcap) {
  return `<tr>
    <td><span class="name"><b>${esc(r.name)}</b><span class="sub">${esc(r.category ?? 'Uncategorised')} · ${esc(r.chains.slice(0, 3).join(', '))}</span></span></td>
    <td class="num">${moneyShort(r.tvl_usd)}</td>
    <td class="num ${r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'}">${pct(r.change_7d)}</td>
    <td><span class="implied"><span class="bar"><i style="width:${Math.max(2, Math.round(((r.mcap_usd ?? 0) / maxMcap) * 100))}%"></i></span><span class="num">${r.mcap_usd ? moneyShort(r.mcap_usd) : '—'}</span></span></td>
    <td><span class="chip live">live token</span></td>
  </tr>`;
}

function detailHtml(r) {
  const computed = computedImplied(r);
  const growthPct = clamp(r.change_7d ?? 0, data.model.growth_floor, data.model.growth_cap);
  const steps = r.farm_steps.map((s, i) => {
    const m = s.match(/^(.*?) Cost: (.*?)\. Time: (.*?)\.?$/);
    if (!m) return `<li>${esc(s)}</li>`;
    return `<li><b>${esc(m[1])}</b><span class="cost">Cost: ${esc(m[2])} · Time: ${esc(m[3])}</span></li>`;
  }).join('');
  const ageNote = r.age_days === null ? 'its listing date is not in the snapshot, so the model counts it as 365 days' : `listed ${r.age_days.toLocaleString('en-US')} days ago`;
  return `
  <div class="detail-head">
    <div><span class="chip">rank ${r.rank} · pre-token</span><h2>${esc(r.name)}</h2>
    <p class="sub">${esc(r.category ?? 'Uncategorised')} · ${esc(r.chains.join(', '))} · listed ${r.listed_at ?? 'unknown'}</p></div>
    <button class="close" data-close aria-label="Close detail">Close</button>
  </div>
  <div class="detail-section">
    <h3>Implied value: ${money(r.implied_value_usd)}</h3>
    <p class="note">TVL ${money(r.tvl_usd)} · 7-day change ${pct(r.change_7d)} · sector multiple ×${r.sector_multiple}</p>
    <div class="equation" style="margin-top:12px">
      <div><span>TVL × sector multiple (${moneyShort(r.tvl_usd)} × ${r.sector_multiple})</span><b>${money(r.tvl_usd * r.sector_multiple)}</b></div>
      <div><span>× growth multiplier (${growthPct > 0 ? '+' : ''}${growthPct.toFixed(1)}% week → ×${r.growth_multiplier.toFixed(4)})</span><b>×${r.growth_multiplier.toFixed(4)}</b></div>
      <div><span>× maturity multiplier (${r.age_days ?? 365} days → ×${r.maturity_multiplier.toFixed(4)})</span><b>×${r.maturity_multiplier.toFixed(4)}</b></div>
      <div><span>× breadth multiplier (${r.chains.length} chain${r.chains.length === 1 ? '' : 's'} → ×${r.breadth_multiplier.toFixed(4)})</span><b>×${r.breadth_multiplier.toFixed(4)}</b></div>
      <div><span>implied value (rounded, recomputed in this page)</span><b>${money(computed)}</b></div>
    </div>
    <p class="why" style="margin-top:12px"><b>Why this rank:</b> ${esc(r.name)} sits at rank ${r.rank} because it holds ${money(r.tvl_usd)} of TVL, ${ageNote}, and its ${esc((r.category ?? 'uncategorised').toLowerCase())} sector earns a ×${r.sector_multiple} multiple. ${r.change_7d !== null && r.change_7d > 0 ? `A ${r.change_7d.toFixed(1)}% week lifts it further.` : r.change_7d !== null && r.change_7d < 0 ? `A ${r.change_7d.toFixed(1)}% week pulls it down.` : 'Its 7-day change is flat or missing, so momentum adds nothing.'}</p>
  </div>
  <div class="detail-section">
    <h3>Farm plan — 7 steps</h3>
    <ol class="steps">${steps}</ol>
    <p class="note" style="margin-top:12px">Farm with money you can afford to leave in the position. Claim only from the link the protocol itself publishes — never pay to claim, and never trust a link from a reply or a DM.</p>
  </div>`;
}

function render() {
  const rows = filteredRows();
  const maxImplied = Math.max(...data.rows.map((r) => r.implied_value_usd));
  const top3 = data.rows.slice(0, 3);
  const median = data.rows[Math.floor(data.rows.length / 2)].implied_value_usd;
  const categories = [...new Set(data.rows.map((r) => r.category).filter(Boolean))].sort();
  const chains = [...new Set(data.rows.flatMap((r) => r.chains))].sort();
  const detailRow = state.detail ? data.rows.find((r) => r.slug === state.detail) : null;

  const tableBody = state.tab === 'pre'
    ? rows.map((r) => rowHtml(r, maxImplied)).join('')
    : data.live.map((r) => liveRowHtml(r, Math.max(...data.live.map((x) => x.mcap_usd ?? 0)))).join('');

  root.innerHTML = `
  <div class="shell">
    <header class="top">
      <div class="brand"><span class="mark"></span><span class="brand-name">Token Radar</span></div>
      <div class="top-meta"><span>Snapshot <b>${esc(data.as_of)}</b></span><span>Source <b>${esc(data.source.split(' ')[0])}</b></span><span>Floor <b>${moneyShort(data.floor_usd)}</b></span><span>Model <b>${esc(data.model_version)}</b></span></div>
    </header>
    <section class="hero">
      <div>
        <h1>The token that has not launched yet, priced by what it already holds.</h1>
        <p>Token Radar ranks <b>${data.board_size} pre-token protocols</b> by implied value: TVL times a sector multiple, momentum, age and chain breadth. The <b>${data.watchlist_size} watchlist protocols</b> are all here, plus <b>${data.early_size} early finds</b> below the $${(data.floor_usd / 1e6).toFixed(0)}M floor. Every number below comes from the sealed snapshot — no names are hard-coded, no token is assumed.</p>
      </div>
      <div class="facts">
        <div class="fact"><span>Protocols ranked</span><b>${data.board_size}</b></div>
        <div class="fact"><span>Watchlist covered</span><b>${data.watchlist_size} / ${data.watchlist_size}</b></div>
        <div class="fact"><span>Top implied value</span><b>${moneyShort(data.rows[0].implied_value_usd)}</b></div>
        <div class="fact"><span>Median implied value</span><b>${moneyShort(median)}</b></div>
        <div class="fact"><span>Live tokens compared</span><b>${data.live_size}</b></div>
      </div>
    </section>
    <section class="spot" aria-label="Top three">
      ${top3.map((r, i) => `<button class="spot-card" data-open="${esc(r.slug)}"><span class="rank">Rank ${i + 1} · ${esc(r.category ?? 'Uncategorised')}</span><h3>${esc(r.name)}</h3><span class="val">${moneyShort(r.implied_value_usd)}</span><span class="sub">TVL ${moneyShort(r.tvl_usd)} · ${pct(r.change_7d)} this week · ${r.chains.length} chain${r.chains.length === 1 ? '' : 's'}</span></button>`).join('')}
    </section>
    <div class="controls">
      <div class="field"><label for="q">Search</label><input id="q" type="search" value="${esc(state.q)}" placeholder="Name, category or chain" autocomplete="off"></div>
      <div class="field"><label for="category">Category</label><select id="category"><option value="">All categories</option>${categories.map((c) => `<option ${c === state.category ? 'selected' : ''} value="${esc(c)}">${esc(c)}</option>`).join('')}</select></div>
      <div class="field"><label for="chain">Chain</label><select id="chain"><option value="">All chains</option>${chains.map((c) => `<option ${c === state.chain ? 'selected' : ''} value="${esc(c)}">${esc(c)}</option>`).join('')}</select></div>
      <div class="tabs" role="group" aria-label="Token status">
        <button type="button" data-tab="pre" aria-pressed="${state.tab === 'pre'}">Pre-token</button>
        <button type="button" data-tab="live" aria-pressed="${state.tab === 'live'}">Live token</button>
      </div>
      <label class="check"><input id="watchlist" type="checkbox" ${state.watchlist ? 'checked' : ''}> Watchlist only</label>
      <div class="field"><label for="sort">Sort by</label><select id="sort">
        <option value="implied" ${state.sort === 'implied' ? 'selected' : ''}>Implied value</option>
        <option value="tvl" ${state.sort === 'tvl' ? 'selected' : ''}>TVL</option>
        <option value="growth" ${state.sort === 'growth' ? 'selected' : ''}>7-day change</option>
        <option value="age" ${state.sort === 'age' ? 'selected' : ''}>Age</option>
        <option value="name" ${state.sort === 'name' ? 'selected' : ''}>Name</option>
      </select></div>
      <span class="count">${state.tab === 'pre' ? `${rows.length} of ${data.board_size} ranked` : `${data.live_size} live tokens`}</span>
    </div>
    <div class="panel"><div class="table-wrap">
      ${state.tab === 'pre'
        ? `<table><thead><tr><th>Rank</th><th>Protocol</th><th>TVL</th><th>7d</th><th>Age</th><th>Implied value</th></tr></thead><tbody>${tableBody}</tbody></table>`
        : `<table><thead><tr><th>Protocol</th><th>TVL</th><th>7d</th><th>Market cap</th><th>Status</th></tr></thead><tbody>${tableBody}</tbody></table>`}
      ${state.tab === 'pre' && rows.length === 0 ? `<div class="empty"><h2>Nothing matches</h2><p>Try a different search or clear the filters.</p><button class="button primary" data-clear>Clear all filters</button></div>` : ''}
    </div></div>
    ${state.tab === 'live' ? '<p class="note" style="margin-top:12px">Live tokens already trade, so the market has priced them: the board shows their market cap instead of an implied value. They are here for comparison — a pre-token protocol is worth watching when its implied value starts to rival these.</p>' : ''}
    <section class="panel model" aria-label="How the model works">
      <h2>How the model works — radar-2</h2>
      <p class="note">Implied value = <b>TVL × sector multiple × growth × maturity × breadth</b>. Every factor comes from the snapshot; no protocol is named in the model.</p>
      <p class="formula">implied = round(tvl_usd × sector_multiple(category)<br>× (1 + clamp(change_7d, −50, 150) / 100 × 0.6)<br>× (0.55 + 0.45 × min(age_days, 1460) / 1460)<br>× (1 + 0.03 × min(max(chains − 1, 0), 4)))</p>
      <table class="sectors"><thead><tr><th>Sector</th><th>Multiple</th><th>Why</th></tr></thead><tbody>
        ${data.model.sector_multiples.map((s) => `<tr><td>${esc(s.match)}</td><td class="num">×${s.multiple}</td><td>${esc(s.note)}</td></tr>`).join('')}
        <tr><td>anything else</td><td class="num">×${data.model.default_multiple ?? 0.24}</td><td>default, no sector match</td></tr>
      </tbody></table>
      <p class="note"><b>Audit:</b> this page recomputes every row's implied value from its raw figures. ${auditMismatches === 0 ? `All ${data.rows.length} rows recompute exactly to their stored value.` : `${auditMismatches} of ${data.rows.length} rows do not recompute to their stored value.`} A protocol with no listed date counts as 365 days old. Protocols that already have a token are set aside in the Live token tab, never ranked.</p>
    </section>
  </div>
  <dialog class="detail" id="detail">${detailRow ? detailHtml(detailRow) : ''}</dialog>`;

  root.setAttribute('aria-busy', 'false');
  const dialog = document.querySelector('#detail');
  if (detailRow && dialog && !dialog.open) dialog.showModal();
  if (!detailRow && dialog && dialog.open) dialog.close();

  const rerender = (patch) => { Object.assign(state, patch); writeHash(); render(); };
  const q = document.querySelector('#q');
  q?.addEventListener('input', () => rerender({ q: q.value }));
  document.querySelector('#category')?.addEventListener('change', (e) => rerender({ category: e.target.value }));
  document.querySelector('#chain')?.addEventListener('change', (e) => rerender({ chain: e.target.value }));
  document.querySelector('#sort')?.addEventListener('change', (e) => rerender({ sort: e.target.value }));
  document.querySelector('#watchlist')?.addEventListener('change', (e) => rerender({ watchlist: e.target.checked }));
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => rerender({ tab: b.dataset.tab })));
  document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => rerender({ detail: b.dataset.open })));
  document.querySelectorAll('tbody tr[data-slug]').forEach((tr) => tr.addEventListener('click', () => rerender({ detail: tr.dataset.slug })));
  document.querySelector('[data-clear]')?.addEventListener('click', () => rerender({ q: '', category: '', chain: '', watchlist: false }));
  document.querySelector('[data-close]')?.addEventListener('click', () => rerender({ detail: '' }));
  dialog?.addEventListener('close', () => { if (state.detail) rerender({ detail: '' }); });
}

readHash();
render();
window.addEventListener('hashchange', () => { readHash(); render(); });
