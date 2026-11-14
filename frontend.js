/**
 * Universal AI Sales Assistant Widget & Raw Shopify Ingestion Engine
 * Designed for direct script injection. Stores raw Shopify data dynamically with zero hardcoding.
 */
(function () {
  'use strict';
  if (window.__aiSalesAssistant) return;
  window.__aiSalesAssistant = true;

  /* ---------- Configuration from Script Tag ---------- */
  const tag = document.currentScript;
  const CFG = {
    backend: (tag && tag.dataset.backend) || 'https://sales-ecom-assistant.onrender.com',
    vendor: (tag && tag.dataset.vendor) || 'default-store',
  };
  const KEY = 'aisa:' + CFG.vendor;
  const BOT = '<span class="ip-body"></span><span class="ip-eyes"><b class="ip-eye"></b><b class="ip-eye"></b></span>';
  const KEEP = 30, SEND_LAST = 10, TTL = 24 * 3600 * 1000;
  const ERR_TEXT = "I couldn't reach the store just now. Please try again in a moment.";
let starters = [
  "How can I contact you?",
  "What are your shipping options?"
];
  /* ---------- Raw IndexedDB Engine (Zero Transformation) ---------- */
// --- DYNAMICALLY NAMESPACED BY VENDOR ---
  const DB_NAME = 'ShopifyRawCatalogCache_' + CFG.vendor;
  const STORE_NAME = 'products';
  const META_STORE_NAME = 'metadata';
  const DB_VERSION = 1;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function openCatalogDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(META_STORE_NAME)) db.createObjectStore(META_STORE_NAME, { keyPath: 'key' });
      };
    });
  }

  // Dynamic property scanner using Object.keys() to inspect raw structures safely
  function scanObjectProperties(obj) {
    if (!obj || typeof obj !== 'object') return [];
    return Object.keys(obj);
  }

  /* ---------- Dynamic Local Catalog Search (Zero Hardcoding) ---------- */
  async function searchLocalCatalog(criteria) {
    const db = await openCatalogDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const products = req.result || [];
        const query = (criteria.query || '').toLowerCase();
        const maxPrice = criteria.maxPrice ? Number(criteria.maxPrice) : null;
        const matched = [];

        for (const product of products) {
          // Dynamically check keys of the raw product object
          const productKeys = scanObjectProperties(product);
          
          // Extract text fields dynamically based on common Shopify keys or Object.keys inspection
          const title = String(product.title || product.name || '');
          const tags = Array.isArray(product.tags) ? product.tags.map(t => String(t).toLowerCase()) : [];
          const bodyHtml = String(product.body_html || product.description || '');

          const matchesQuery = !query || 
            title.toLowerCase().includes(query) || 
            tags.some(t => t.includes(query)) ||
            bodyHtml.toLowerCase().includes(query);

          if (!matchesQuery) continue;

          // Inspect variants dynamically
          const variants = Array.isArray(product.variants) ? product.variants : [];
          for (const variant of variants) {
            // Check stock status dynamically from raw Shopify variant property
            const isAvailable = variant.available === true || variant.available === 'true';
            if (!isAvailable) continue; // Skip out-of-stock items if filtering active

            const price = Number(variant.price || 0);
            if (maxPrice !== null && price > maxPrice) continue;

            // Extract images dynamically
            const images = Array.isArray(product.images) ? product.images : [];
            const firstImg = images[0] || {};
            const imageUrl = firstImg.src || firstImg.url || '';

            matched.push({
              id: product.id,
              title: title,
              price: price,
              imageUrl: imageUrl,
              url: `/products/${product.handle || ''}?variant=${variant.id || ''}`,
              inStock: isAvailable,
              rawAttributes: variant // Preserves all raw options, weight, SKUs dynamically
            });
            break; // Grab first valid matching variant per product
          }
        }
        resolve(matched.slice(0, 6));
      };
      req.onerror = () => resolve([]);
    });
  }

  /* ---------- Network & State Helpers ---------- */
  async function api(path, init) {
    init = init || {};
    const baseUrl = CFG.backend.replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    const res = await fetch(baseUrl + cleanPath, Object.assign({
      method: init.method || 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json', 'Accept': 'application/json' }, init.headers || {}),
      body: init.body
    }, init));
    let data = {};
    try { data = await res.json(); } catch (e) {}
    return { ok: res.ok, status: res.status, json: async () => data };
  }

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 's' + Math.random().toString(36).slice(2));
  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.sid && Date.now() - s.t < TTL) return s;
    } catch (e) {}
    return { sid: uid(), items: [], strikes: 0, t: Date.now() };
  }
  const state = loadState();
  function saveState() {
    state.t = Date.now();
    state.items = state.items.slice(-KEEP);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  function track(name, data) {
    try { window.umami && window.umami.track && window.umami.track(name, Object.assign({ vendor: CFG.vendor }, data || {})); } catch (e) {}
  }

  /* ---------- Fully Isolated Shadow DOM Styles ---------- */
  const CSS = `
:host{all:initial}
*{box-sizing:border-box;margin:0;padding:0}
.root{--a:#a8a0ff;--b:#9d7bff;--c:#ff8fb1;--ink:#1b1d24;--mute:#6b7280;--line:#e9ebf2;--soft:#f4f5fa;--ease:cubic-bezier(.32,.72,0,1);
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);-webkit-font-smoothing:antialiased}
button{font:inherit;color:inherit;border:0;background:none;cursor:pointer}
:focus-visible{outline:2px solid var(--b);outline-offset:2px}

.ip-wrap{position:relative;width:56px;height:56px;flex:none;display:block;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,#c9a3ff 0%,#cbe7ff 55.2885%,#67e0ff 100%);box-shadow:inset 0 -6px 12px rgba(90,110,180,.22),inset 0 2px 4px rgba(255,255,255,.8)}
.ip{position:absolute;inset:0;outline:none;user-select:none}
.ip-body{position:absolute;inset:0;border-radius:50%}
.ip-eyes{
  position:absolute;top:37%;left:32%;z-index:1;display:flex;width:36%;height:11%;justify-content:space-between;
  transform:translate(calc(var(--ex,0)*3px),calc(var(--ey,0)*2px));
  transition:transform 120ms ease-out;
}
.ip:not(.hovering) .ip-eye{animation:blink-cycle 4.6s linear infinite}
.ip-eye{width:25%;height:100%;background:#1a1b22;border-radius:50%;transform-origin:center}
.ip-wrap.xs{width:22px;height:22px;box-shadow:inset 0 -2px 5px rgba(90,110,180,.22),inset 0 1px 2px rgba(255,255,255,.8)}
.ip-wrap.lg{width:44px;height:44px}

@keyframes blink-cycle{
  0%,6.5217%,13.0435%,100%{transform:scaleY(1)}
  3.2609%,9.7826%{transform:scaleY(0.1)}
}
@keyframes bob{50%{transform:translateY(-3px)}}

.orb{
  position:fixed;right:24px;bottom:24px;width:56px;height:56px;border-radius:50%;padding:0;
  display:grid;place-items:center;transition:transform .45s var(--ease),opacity .3s;
  filter:drop-shadow(0 10px 22px rgba(130,115,245,.28));z-index:2147483647;
}
.orb::before{
  content:"";position:absolute;inset:0;border-radius:50%;z-index:-1;filter:blur(12px);opacity:.45;
  background:linear-gradient(135deg,#c9a3ff,#67e0ff,#ffc7e1);transition:opacity .3s,transform .3s;
}
.orb .ip-wrap{animation:bob 4.5s ease-in-out infinite}
.orb:hover{transform:scale(1.07)}.orb:hover::before{opacity:.75;transform:scale(1.1)}
.orb:active{transform:scale(.94)}

.teaser{position:fixed;right:90px;bottom:24px;height:56px;max-width:240px;display:flex;align-items:center;pointer-events:none;z-index:2147483647}
.tb{position:relative;background:#fff;border-radius:18px;padding:10px 14px;font-size:13.5px;line-height:1.4;
  box-shadow:0 12px 32px -10px rgba(30,40,110,.28),0 0 0 1px rgba(20,20,60,.06);
  opacity:0;transform:translateX(14px) scale(.85);transform-origin:right center;transition:opacity .3s,transform .5s var(--ease)}
.tb::after{content:"";position:absolute;right:-5px;top:50%;width:11px;height:11px;margin-top:-5px;background:#fff;transform:rotate(45deg);border-radius:2px}
.teaser.show .tb{opacity:1;transform:none;pointer-events:auto;cursor:pointer}

.panel{position:fixed;right:24px;bottom:94px;width:392px;height:min(640px,calc(100dvh - 118px));display:flex;flex-direction:column;
  background:#fff;border-radius:28px;overflow:hidden;box-shadow:0 30px 70px -14px rgba(30,30,90,.35),0 0 0 1px rgba(20,20,60,.06);
  transform-origin:bottom right;opacity:0;visibility:hidden;transform:translateY(14px) scale(.9);
  transition:transform .5s var(--ease),opacity .25s,visibility 0s .5s;z-index:2147483647}
.root.open .panel{opacity:1;visibility:visible;transform:none;transition:transform .5s var(--ease),opacity .3s,visibility 0s}
.head{display:flex;align-items:center;gap:10px;padding:16px 16px 12px 20px}
.head .t{flex:1;min-width:0}
.head b{display:block;font-size:15px;font-weight:600;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.head span{font-size:12px;color:var(--mute)}
.x{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:var(--mute);transition:background .2s}
.x:hover{background:var(--soft)}

.feed{flex:1;overflow-y:auto;padding:6px 20px 14px;display:flex;flex-direction:column;gap:16px;scrollbar-width:thin;scrollbar-color:#d6d9e4 transparent;overscroll-behavior:contain}
.hello{margin:auto 0;padding:10px 0 0;display:flex;flex-direction:column;gap:10px}
.hello .ip-wrap{margin-bottom:4px}
.hello h2{font-size:30px;line-height:1.1;font-weight:600;letter-spacing:-.8px;width:fit-content;
  background:linear-gradient(100deg,#7c6bff,var(--b) 55%,var(--c));-webkit-background-clip:text;background-clip:text;color:transparent}
.hello p{font-size:15px;color:var(--mute);line-height:1.45;max-width:30ch}
.me{align-self:flex-end;max-width:84%;background:#edf1fe;padding:10px 15px;border-radius:20px 20px 6px 20px;font-size:14.5px;line-height:1.45;overflow-wrap:anywhere;animation:rise .35s var(--ease)}
.bot{display:flex;gap:10px;align-items:flex-start;animation:rise .35s var(--ease)}
.bot .ip-wrap{margin-top:2px}
.bot .txt{font-size:14.5px;line-height:1.55;overflow-wrap:anywhere;white-space:pre-wrap;min-width:0}
.bot .txt a{color:#2f6df0;text-decoration:underline;font-weight:500;transition:color 0.2s}
.bot .txt a:hover{color:#1a3fb8}
.bot .txt strong{font-weight:650}
@keyframes rise{from{opacity:0;transform:translateY(8px)}}

.glimmer-box{display:flex;align-items:center;gap:8px;padding:4px 0}
.glimmertxt{font-size:13.5px;font-weight:500;color:var(--mute);background:linear-gradient(90deg,var(--mute) 0%,var(--b) 50%,var(--mute) 100%);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shine 2s linear infinite}
@keyframes shine{to{background-position:200% center}}

.rail-wrap{position:relative;margin:2px -20px 0}
.rail{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding-left:20px;padding:4px 20px 8px 34px;scrollbar-width:none}
.rail::-webkit-scrollbar{display:none}
.card{flex:0 0 158px;scroll-snap-align:start;display:flex;flex-direction:column;text-decoration:none;color:inherit;background:#fff;border-radius:18px;overflow:hidden;
  box-shadow:0 0 0 1px var(--line);transition:transform .3s var(--ease),box-shadow .3s}
.card:hover{transform:translateY(-3px);box-shadow:0 0 0 1px #cfd3e6,0 12px 24px -10px rgba(40,40,110,.25)}
.pic{aspect-ratio:1;background:linear-gradient(135deg,#eef0fa,#f7f1fa);display:grid;place-items:center}
.pic img{width:100%;height:100%;object-fit:cover;display:block}
.info{padding:10px 12px 12px;display:flex;flex-direction:column;gap:6px;flex:1}
.nm{font-size:13px;font-weight:550;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:34px}
.pr{font-size:15px;font-weight:650;letter-spacing:-.2px}
.pr small{font-size:11px;font-weight:500;color:#b4472f;margin-left:6px}
.go{margin-top:auto;text-align:center;font-size:12.5px;font-weight:600;padding:8px;border-radius:12px;color:#fff;background:linear-gradient(100deg,#7c6bff,var(--b))}
.arrow{position:absolute;top:38%;width:32px;height:32px;border-radius:50%;background:#fff;box-shadow:0 4px 14px rgba(30,30,90,.2);display:none;place-items:center;z-index:2;transition:opacity .2s}
.arrow.l{left:38px}.arrow.r{right:12px}
@media (hover:hover){.rail-wrap:hover .arrow{display:grid}}

.single-card-wrap{margin-top:6px;padding-left:34px;max-width:220px}
.single-card-wrap .card{width:100%}
.comparison-wrap{display:flex;gap:10px;margin-top:6px;padding-left:34px;overflow-x:auto;scrollbar-width:none}
.comparison-wrap::-webkit-scrollbar{display:none}
.comparison-item{flex:0 0 160px;display:flex;flex-direction:column;gap:4px}
.comparison-badge{font-size:11px;font-weight:600;color:var(--b);background:var(--soft);padding:2px 6px;border-radius:6px;width:fit-content}

.chips{display:flex;flex-wrap:wrap;gap:8px;animation:rise .35s var(--ease)}
.bot+.chips,.rail-wrap+.chips,.single-card-wrap+.chips,.comparison-wrap+.chips{padding-left:34px}
.chip{padding:8px 14px;border-radius:18px;font-size:13px;background:#fff;box-shadow:0 0 0 1px var(--line);transition:background .2s,transform .2s var(--ease)}
.chip:hover{background:var(--soft);transform:translateY(-1px)}

.foot{padding:8px 16px calc(10px + env(safe-area-inset-bottom,0px))}
.box{display:flex;align-items:center;gap:6px;background:var(--soft);border-radius:26px;padding:5px 5px 5px 18px;box-shadow:0 0 0 1px transparent;transition:box-shadow .25s,background .25s}
.box:focus-within{background:#fff;box-shadow:0 0 0 1.5px var(--b),0 6px 20px -8px rgba(110,90,240,.4)}
.box input{flex:1;min-width:0;border:0;outline:0;background:none;font:inherit;font-size:16px;padding:9px 0;color:var(--ink)}
.box input::placeholder{color:#9aa0b0}
.send{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#7c6bff,var(--b));transition:transform .25s var(--ease),opacity .2s}
.send:hover{transform:scale(1.07)}.send:disabled{opacity:.3;transform:none;cursor:default}
.note{font-size:11px;color:#9aa0b0;text-align:center;padding-top:7px}

@media (min-width:481px) and (max-width:1024px){
  .panel{width:min(560px,82vw);height:min(780px,calc(100dvh - 118px));right:20px}
}
@media (max-width:480px){
  .panel{inset:0;width:100%;height:100dvh;border-radius:0;transform:translateY(40px)}
  .head{padding-top:calc(14px + env(safe-area-inset-top,0px))}
  .root.open .orb,.root.open .teaser{opacity:0;pointer-events:none;transform:scale(.6)}
  .orb{right:16px;bottom:16px}.teaser{right:82px;bottom:16px;max-width:calc(100vw - 104px)}
}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition-duration:.01ms!important}}
`;

  /* ---------- DOM & Shadow Root Initialization ---------- */
  const host = document.createElement('div');
  host.id = 'ai-sales-root';
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>${CSS}</style>
<div class="root" id="root">
  <div class="teaser" id="teaser"><div class="tb" id="tb"></div></div>
  <button class="orb" id="orb" aria-label="Open shopping assistant" aria-expanded="false">
    <span class="ip-wrap lg"><span class="ip" id="orb-ip">${BOT}</span></span>
  </button>
  <section class="panel" id="panel" role="dialog" aria-label="Shopping assistant">
    <header class="head">
      <div class="t"><b id="title">Shopping assistant</b><span>AI shopping assistant</span></div>
      <button class="x" id="clear-chat" aria-label="Clear conversation" title="Start over">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
      </button>
      <button class="x" id="close" aria-label="Close chat"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </header>
    <div class="feed" id="feed" aria-live="polite"></div>
    <footer class="foot">
      <div class="box">
        <input id="input" type="text" placeholder="Ask about any product" autocomplete="off" maxlength="500" aria-label="Message">
        <button class="send" id="send" aria-label="Send" disabled><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
      </div>
      <p class="note">AI can make mistakes. Check details on the product page.</p>
    </footer>
  </section>
</div>`;

  // UI state & helpers
  const $ = (id) => shadow.getElementById(id);
  const rootEl = $('root'), feed = $('feed'), input = $('input'), sendBtn = $('send'), orbIp = $('orb-ip');
  let busy = false, welcomeText = "Ask me about products, prices, or help choosing.";

  const el = (tagName, cls, text) => {
    const n = document.createElement(tagName);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const safeUrl = (u) => { try { const x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : null; } catch (e) { return null; } };
  function money(p) {
    const n = Number(p.price);
    if (!Number.isFinite(n)) return '';
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currency || 'USD' }).format(n); }
    catch (e) { return n.toFixed(2); }
  }
// --- ADD THIS CLEAR CHAT HANDLER ---
  $('clear-chat').addEventListener('click', () => {
    state.items = [];
    state.strikes = 0;
    saveState();
    renderAll();
    track('chat_cleared');
  });
  const staticMascotEl = (cls) => {
    const wrap = el('span', 'ip-wrap' + (cls ? ' ' + cls : ''));
    const ip = el('span', 'ip');
    ip.innerHTML = BOT;
    wrap.appendChild(ip);
    return wrap;
  };

  const toEnd = () => requestAnimationFrame(() => { feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' }); });
  const mobile = () => matchMedia('(max-width:480px)').matches;

  /* ---------- Clean Markdown Parser & Renderers ---------- */
  function renderMarkdown(rawText) {
    let text = String(rawText || '');
    
    // 1. Convert Markdown links [Text](Url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
      const cleanU = safeUrl(url);
      return cleanU ? `<a href="${cleanU}" target="_blank" rel="noopener noreferrer">${linkText}</a>` : linkText;
    });
    
    // 2. Convert raw URLs into proper clickable anchor tags (with the closing </a> tag fixed!)
    text = text.replace(/(https?:\/\/[^\s<"]+)/g, (url) => {
      const cleanUrl = url.replace(/[.,)]+$/, '');
      const cleanU = safeUrl(cleanUrl);
      return cleanU ? `<a href="${cleanU}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>` : url;
    });
    
    // 3. Convert bold text **text**
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    return text;
  }

  function chipsEl(list) {
    const wrap = el('div', 'chips');
    list.forEach((t) => {
      const b = el('button', 'chip', t);
      b.addEventListener('click', () => send(t));
      wrap.appendChild(b);
    });
    return wrap;
  }

  function buildCardNode(p) {
    const href = safeUrl(p.url);
    const a = el('a', 'card');
    if (href) { a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    a.addEventListener('click', () => track('product_clicked', { product: String(p.id || p.title).slice(0, 80) }));

    const pic = el('div', 'pic');
    const img = safeUrl(p.imageUrl);
    if (img) {
      const i = el('img'); i.src = img; i.alt = ''; i.loading = 'lazy';
      i.addEventListener('error', () => i.remove());
      pic.appendChild(i);
    }
    const info = el('div', 'info');
    info.appendChild(el('div', 'nm', p.title || 'Product'));
    const pr = el('div', 'pr', money(p));
    if (p.inStock === false) pr.appendChild(el('small', '', 'Sold out'));
    info.appendChild(pr);
    info.appendChild(el('span', 'go', 'View item'));
    a.append(pic, info);
    return a;
  }

  function rail(products) {
    const wrap = el('div', 'rail-wrap');
    const r = el('div', 'rail');
    products.forEach((p) => r.appendChild(buildCardNode(p)));
    const mk = (cls, d) => {
      const b = el('button', 'arrow ' + cls);
      b.setAttribute('aria-label', d < 0 ? 'Previous' : 'Next');
      b.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${d < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}"/></svg>`;
      b.addEventListener('click', () => r.scrollBy({ left: d * 340, behavior: 'smooth' }));
      return b;
    };
    wrap.append(r);
    if (products.length > 2) wrap.append(mk('l', -1), mk('r', 1));
    return wrap;
  }

  function singleCardView(p) {
    const wrap = el('div', 'single-card-wrap');
    wrap.appendChild(buildCardNode(p));
    return wrap;
  }

  function comparisonView(products) {
    const wrap = el('div', 'comparison-wrap');
    products.forEach((p, idx) => {
      const itemNode = el('div', 'comparison-item');
      const badge = el('span', 'comparison-badge', `Option ${idx === 0 ? 'A' : idx === 1 ? 'B' : idx + 1}`);
      itemNode.append(badge, buildCardNode(p));
      wrap.appendChild(itemNode);
    });
    return wrap;
  }

  function drawItem(it) {
    if (it.role === 'user') { feed.appendChild(el('div', 'me', it.text)); return {}; }
    const row = el('div', 'bot');
    const txtEl = el('div', 'txt');
    txtEl.innerHTML = renderMarkdown(it.text);
    row.append(staticMascotEl('xs'), txtEl);
    feed.appendChild(row);

    const prods = it.products || [];
    if (prods.length > 0) {
      if (it.intent === 'comparison' || (prods.length === 2 && it.intent !== 'purchase')) {
        feed.appendChild(comparisonView(prods));
        track('comparison_shown', { count: prods.length });
      } else if (prods.length === 1 || it.intent === 'purchase_single') {
        feed.appendChild(singleCardView(prods[0]));
        track('single_product_shown', { product: String(prods[0].title || '') });
      } else {
        feed.appendChild(rail(prods));
        track('products_shown', { count: prods.length });
      }
    }
    return { row, txtEl };
  }

  function drawWelcome() {
    const h = el('div', 'hello');
    h.id = 'hello';
    h.append(staticMascotEl('lg'), el('h2', '', 'Hi there'), el('p', '', welcomeText), chipsEl(starters));
    feed.appendChild(h);
  }

  function renderAll() {
    feed.textContent = '';
    if (!state.items.length) { drawWelcome(); return; }
    state.items.forEach(drawItem);
    const last = state.items[state.items.length - 1];
    if (last.role === 'assistant' && last.chips && last.chips.length) feed.appendChild(chipsEl(last.chips));
    feed.scrollTop = feed.scrollHeight;
  }

  function startRealtimeLoader() {
    const row = el('div', 'bot'); row.id = 'typing';
    const col = el('div', 'glimmer-box');
    const txt = el('div', 'glimmertxt', 'Thinking...');
    col.appendChild(txt);
    row.append(staticMascotEl('xs'), col);
    feed.appendChild(row);
    toEnd();
    return { stop() { row.remove(); }, updateText(msg) { txt.textContent = msg; } };
  }

 /**
   * ==========================================================================
   * MASTER CONTROL PLAN: SUBORDINATE MESSAGING & HANDSHAKE ENGINE
   * ==========================================================================
   * Executes under strict backend master control in a synchronized two-phase loop:
   * Phase 1: Sends message to backend master and listens for search directive (intent) or direct text deltas.
   * Phase 2: Queries local IndexedDB locally as instructed, reports results back to master.
   * Phase 3: Receives text deltas and master's explicit product rendering directive,
   *          mounting cards/carousels strictly on backend command.
   */
  async function send(raw) {
    const text = String(raw || '').trim();
    if (!text || busy) return;
    busy = true; sendBtn.disabled = true; input.value = '';
    shadow.getElementById('hello')?.remove();
    feed.querySelectorAll('.chips').forEach((c) => c.remove());

    const userItem = { role: 'user', text };
    state.items.push(userItem); saveState(); drawItem(userItem);

    const loader = startRealtimeLoader();
    const baseUrl = CFG.backend.replace(/\/+$/, '');

    try {
      // --- MASTER PHASE 1: Send user message to receive master search directives or direct deltas ---
      const res1 = await fetch(baseUrl + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/octet-stream' },
        body: JSON.stringify({
          vendorId: CFG.vendor,
          sessionId: state.sid,
          pageUrl: location.href,
          messages: state.items.filter((i) => !i.err).slice(-SEND_LAST).map((i) => ({ role: i.role, content: i.text || i.content })),
        }),
      });
      if (!res1.ok) throw new Error(`HTTP error! status: ${res1.status}`);

      let reader1 = res1.body.getReader();
      let decoder = new TextDecoder();
      let buffer = '';
      let intentFilters = null;
      let finalIntent = 'inquiry';
      let finalReply = '';
      let botRow = null;
      let txtEl = null;

      while (true) {
        const { value, done } = await reader1.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const frame = JSON.parse(line.trim());
            if (frame.event === 'status' && loader) loader.updateText(frame.data.text);
            if (frame.event === 'intent') {
              intentFilters = frame.data.filters;
              finalIntent = frame.data.state || 'purchase';
            }
            // CRITICAL FIX: Handle immediate text deltas streamed during Phase 1 (used by get_store_info & greetings)
            if (frame.event === 'delta' && frame.data.text) {
              if (!botRow) {
                loader.stop();
                const resNode = drawItem({ role: 'assistant', text: '', intent: finalIntent, products: [] });
                botRow = resNode.row;
                txtEl = resNode.txtEl;
              }
              finalReply += frame.data.text;
              if (txtEl) txtEl.innerHTML = renderMarkdown(finalReply);
              toEnd();
            }
          } catch {}
        }
      }

      // --- CRITICAL FIX: If no intentFilters were issued (e.g. store info or general chat), finalize and exit cleanly ---
      if (!intentFilters) {
        loader.stop();
        if (finalReply) {
          const replyItem = { role: 'assistant', text: finalReply, intent: finalIntent, products: [] };
          state.items.push(replyItem);
          saveState();
        } else {
          drawItem({ role: 'assistant', text: "I'm having a little trouble connecting right now. Please try again!" });
        }
        busy = false;
        sendBtn.disabled = !input.value.trim();
        return;
      }

      // --- SUBORDINATE EXECUTION: Query local IndexedDB based on master directive ---
      let localProducts = [];
      if (loader) loader.updateText('Searching local catalog...');
      localProducts = await searchLocalCatalog(intentFilters);
      const currentIntent = finalIntent; // Use state captured from intent frame

      // --- MASTER PHASE 2: Report local search results back to backend master ---
      const res2 = await fetch(baseUrl + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/octet-stream' },
        body: JSON.stringify({
          vendorId: CFG.vendor,
          sessionId: state.sid,
          pageUrl: location.href,
          messages: state.items.filter((i) => !i.err).slice(-SEND_LAST).map((i) => ({ role: i.role, content: i.text || i.content })),
          localProducts: intentFilters ? localProducts : undefined, // Send local truth to master
          intentType: currentIntent
        }),
      });

      if (!res2.ok) throw new Error(`HTTP error! status: ${res2.status}`);

      let reader2 = res2.body.getReader();
      buffer = '';
      let masterProductsDirective = [];

      while (true) {
        const { value, done } = await reader2.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const frame = JSON.parse(line.trim());
            if (frame.event === 'status' && loader) loader.updateText(frame.data.text);
            if (frame.event === 'delta' && frame.data.text) {
              if (!botRow) {
                loader.stop();
                const resNode = drawItem({ role: 'assistant', text: '', intent: finalIntent, products: [] });
                botRow = resNode.row;
                txtEl = resNode.txtEl;
              }
              finalReply += frame.data.text;
              if (txtEl) txtEl.innerHTML = renderMarkdown(finalReply);
              toEnd();
            }
            // Capture master product rendering directive
            if (frame.event === 'products') {
              masterProductsDirective = frame.data.items || [];
              if (frame.data.intent) finalIntent = frame.data.intent;
            }
          } catch {}
        }
      }

      loader.stop();
      if (!finalReply) finalReply = "I couldn't find anything matching that description. Can I help you with another item?";

      if (!botRow) {
        const resNode = drawItem({ role: 'assistant', text: finalReply, intent: finalIntent, products: [] });
        botRow = resNode.row;
        txtEl = resNode.txtEl;
      } else {
        txtEl.innerHTML = renderMarkdown(finalReply);
      }

      // --- MASTER-DIRECTED RENDERING: Mount UI cards strictly upon backend command ---
      const limitedProducts = masterProductsDirective.slice(0, 8);
      if (limitedProducts.length > 0) {
        if (finalIntent === 'comparison' || limitedProducts.length === 2) {
          feed.appendChild(comparisonView(limitedProducts));
        } else if (limitedProducts.length === 1) {
          feed.appendChild(singleCardView(limitedProducts[0]));
        } else {
          feed.appendChild(rail(limitedProducts));
        }
      }

      const replyItem = { role: 'assistant', text: finalReply, intent: finalIntent, products: limitedProducts };
      state.items.push(replyItem);
      saveState();
      toEnd();

    } catch (e) {
      console.warn('[ai-sales] error:', e);
      loader.stop();
      drawItem({ role: 'assistant', text: "I'm having a little trouble connecting right now. Please try again!" });
    }

    busy = false;
    sendBtn.disabled = !input.value.trim();
  }

  /* ---------- Panel Open/Close & Event Listeners ---------- */
  let prevOverflow = '';
  function setOpen(open) {
    rootEl.classList.toggle('open', open);
    $('orb').setAttribute('aria-expanded', String(open));
    $('teaser').classList.remove('show');
    if (open) {
      track('chat_opened');
      if (mobile()) { prevOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden'; }
      else setTimeout(() => input.focus(), 350);
      feed.scrollTop = feed.scrollHeight;
    } else {
      document.documentElement.style.overflow = prevOverflow;
    }
  }
  const isOpen = () => rootEl.classList.contains('open');
  $('orb').addEventListener('click', () => setOpen(!isOpen()));
  $('close').addEventListener('click', () => setOpen(false));
  $('teaser').addEventListener('click', () => setOpen(true));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) setOpen(false); });
  input.addEventListener('input', () => { sendBtn.disabled = busy || !input.value.trim(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) send(input.value); });
  sendBtn.addEventListener('click', () => send(input.value));
  $('orb').addEventListener('pointerenter', () => orbIp.classList.add('hovering'));
  $('orb').addEventListener('pointerleave', () => orbIp.classList.remove('hovering'));

  /* ---------- Instant UI Mount & Background Raw Sync Boot Sequence ---------- */
  document.body.appendChild(host);
  renderAll();

  // 1. Fetch store config for UI branding asynchronously
  api('/config/' + encodeURIComponent(CFG.vendor))
    .then((r) => r.json())
    .then((c) => {
      if (c.name) $('title').textContent = c.name;
      const w = c.widgetConfig || {};
      if (w.welcomeMessage) welcomeText = w.welcomeMessage;
      if (Array.isArray(w.starters) && w.starters.length) starters = w.starters.slice(0, 4);
      if (w.colors) ['a', 'b', 'c'].forEach((k) => w.colors[k] && rootEl.style.setProperty('--' + k, w.colors[k]));
      if (!state.items.length) renderAll();
    })
    .catch((e) => console.warn('[ai-sales] /config failed:', e));

  // 2. Background Store Verification via meta.json & Raw Paginated Ingestion (Zero 429s)
  (async function initStoreAndBackgroundSync() {
    const storeOrigin = window.location.origin;
    try {
      const metaRes = await fetch(`${storeOrigin}/meta.json`, { headers: { 'Accept': 'application/json' } });
      if (!metaRes.ok) return;
      const metaData = await metaRes.json();
      
      const isShopify = Boolean(metaData && typeof metaData.myshopify_domain === 'string' && metaData.myshopify_domain.includes('.myshopify.com'));
      if (!isShopify) return;

      const db = await openCatalogDB();

      let page = 1;
      let hasMore = true;

      while (hasMore) {
        await sleep(400);
        const res = await fetch(`${storeOrigin}/products.json?limit=250&page=${page}`);
        if (!res.ok) { 
          if (res.status === 429) { await sleep(2000); continue; } 
          break; 
        }
        
        const data = await res.json();
        if (!data.products || data.products.length === 0) {
          hasMore = false;
          break;
        }

        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        for (const rawProduct of data.products) {
          if (rawProduct && rawProduct.id) {
            rawProduct.id = String(rawProduct.id);
            store.put(rawProduct);
          }
        }

        page++;
        if (page > 60) hasMore = false;
      }
      console.log('[Catalog Sync] Raw background catalog ingestion complete.');
    } catch (err) {
      console.warn('[Catalog Sync] Background synchronization error:', err);
    }
  })();

  /* ---------- Floating Orb Eyes Motion Tracking & Teaser Greetings ---------- */
  let lastMove = 0, raf = 0;
  const look = (x, y) => { rootEl.style.setProperty('--ex', x.toFixed(2)); rootEl.style.setProperty('--ey', y.toFixed(2)); };
  addEventListener('pointermove', (e) => {
    lastMove = Date.now();
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const r = $('orb').getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      look(Math.max(-1, Math.min(1, dx / 280)), Math.max(-1, Math.min(1, dy / 280)));
    });
  }, { passive: true });
  setInterval(() => {
    if (document.hidden || Date.now() - lastMove < 3000) return;
    const center = Math.random() < 0.3;
    look(center ? 0 : Math.random() * 2 - 1, center ? 0 : Math.random() * 1.2 - 0.6);
  }, 2200);

  let greetings = ["Hi! Is there anything you're looking for?", 'I can help you find the right product.', "Ask me about prices, sizes or what's in stock."];
  let gi = 0, greets = 0;
  try { greets = +sessionStorage.getItem('aisa:greets') || 0; } catch (e) {}
  const teaser = $('teaser'), tb = $('tb');
  function greet() {
    if (isOpen() || greets >= 3 || state.items.length) return;
    greets++;
    try { sessionStorage.setItem('aisa:greets', String(greets)); } catch (e) {}
    tb.textContent = greetings[gi++ % greetings.length];
    teaser.classList.add('show');
    look(-0.9, -0.1);
    setTimeout(() => teaser.classList.remove('show'), 8000);
    setTimeout(greet, 26000);
  }
  setTimeout(greet, 3500);
})();