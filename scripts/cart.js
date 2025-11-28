/* cart.js — dynamic cart page script
   - reads the cart info from localStorage using the keys the app uses
     ('cart' and/or 'emmystore_cart')
   - normalizes the data and renders an interactive cart UI
   - supports qty increment/decrement, remove, clear cart, and checkout button
   - persists changes to both storage keys for cross-page compatibility
*/

(function () {
  'use strict';

  const CART_KEY_OLD = 'cart';
  const CART_KEY = 'emmystore_cart';

  const elements = {
    list: document.getElementById('cart-list'),
    empty: document.getElementById('cart-empty'),
    subtotal: document.getElementById('subtotal'),
    total: document.getElementById('total'),
    checkoutBtn: document.getElementById('checkout-btn'),
    clearBtn: document.getElementById('clear-cart'),
  };
  const continueLink = document.getElementById('continue-shopping');
  const continueBtnWrap = document.getElementById('continue-shopping-wrap');
  const continueBtn = document.getElementById('continue-shopping-btn');

  function toNumber(v) {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    const raw = String(v).replace(/[^0-9\.-]+/g, '');
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  }

  function formatCurrency(num, decimals = 2) {
    // Show Naira-like symbol by default; format with decimals
    const n = Number(num || 0);
    try {
      return '₦' + n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    } catch (e) {
      return '₦' + n.toFixed(decimals);
    }
  }

  function readOldCart() {
    try {
      const raw = localStorage.getItem(CART_KEY_OLD) || '[]';
      const arr = JSON.parse(raw) || [];
      return arr.map(it => ({
        key: it.key || (it.id ? (it.id + '::' + (it.size || '') + '::' + (it.color || '')) : (it.title || '') ),
        id: it.id || (it.title || ''),
        title: it.title || it.name || 'Item',
        qty: Number(it.qty || 1),
        price: toNumber(it.price || it.priceNum || 0),
        priceText: it.priceText || (it.price ? String(it.price) : ''),
        size: it.size || null,
        color: it.color || null,
        image: it.image || '',
      }));
    } catch (e) { return []; }
  }

  function readEmmyCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (!raw) return { items: [], count: 0, totalUSD: 0 };
      const obj = JSON.parse(raw) || { items: [], count: 0, totalUSD: 0 };
      const items = (obj.items || []).map(it => ({
        key: it.key || (it.title || '') + '::' + (it.size || '') + '::' + (it.color || ''),
        id: it.id || it.title || '',
        title: it.title || 'Item',
        qty: Number(it.qty || 1),
        price: toNumber(it.usd || it.price || 0),
        priceText: typeof it.price === 'string' ? it.price : (it.priceText || ''),
        size: it.size || null,
        color: it.color || null,
        image: it.image || '',
      }));
      return { items, count: Number(obj.count || items.reduce((s,i) => s + (i.qty||0), 0)), totalUSD: Number(obj.totalUSD || items.reduce((s,i) => s + ((i.price||0)*(i.qty||0)), 0)) };
    } catch (e) { return { items: [], count: 0, totalUSD: 0 }; }
  }

  // Merge both carts into a normalized map keyed by 'key'. Combine quantities if keys match
  function getMergedCart() {
    const old = readOldCart();
    const emm = readEmmyCart();
    const map = new Map();
    (old || []).forEach(it => {
      if (!it.key) it.key = it.id + '::' + (it.size||'') + '::' + (it.color||'');
      if (map.has(it.key)) {
        map.get(it.key).qty += it.qty;
      } else map.set(it.key, { ...it });
    });
    (emm.items || []).forEach(it => {
      if (!it.key) it.key = it.id + '::' + (it.size||'') + '::' + (it.color||'');
      if (map.has(it.key)) {
        map.get(it.key).qty += it.qty;
      } else map.set(it.key, { ...it });
    });
    return Array.from(map.values());
  }

  function saveCart(items) {
    // Persist to the old cart format 'cart' as an array of items with price and qty
    const oldFormat = items.map(i => ({ key: i.key, id: i.id, title: i.title, price: i.price, qty: i.qty, size: i.size, color: i.color, image: i.image, priceText: i.priceText }));
    try { localStorage.setItem(CART_KEY_OLD, JSON.stringify(oldFormat)); } catch (e) { /* ignore */ }
    // Persist to new 'emmystore_cart' format
    // Create a structure compatible with `index.js` representation: { items: [{title, usd, qty, ...}], count, totalUSD }
    const formatData = {
      items: oldFormat.map(it => ({ title: it.title, usd: Number(it.price || 0), qty: Number(it.qty || 0), id: it.id || undefined, key: it.key || undefined, size: it.size, color: it.color, image: it.image })),
      count: items.reduce((s,i) => s + (i.qty||0), 0),
      totalUSD: items.reduce((s,i) => s + ((i.price||0)*(i.qty||0)), 0),
    };
    try { localStorage.setItem(CART_KEY, JSON.stringify(formatData)); } catch (e) { /* ignore */ }
    // Notify other windows/tabs via Storage by updating a last-change token
    try { localStorage.setItem('__cart_last_update', String(Date.now())); } catch (e) { /* ignore */ }
  }

  function updateBadge(totalQty) {
    const headerBadge = document.querySelector('.notif-btn .notif-badge');
    if (headerBadge) {
      headerBadge.textContent = String(totalQty);
      // Always show the header badge; display 0 when empty
      try { headerBadge.style.display = ''; } catch (e) {}
      try { headerBadge.removeAttribute('aria-hidden'); } catch (e) {}
    }
    // also update off-canvas nav (#cart-count badge) if present
    const badge = document.getElementById('cart-count');
    if (badge) {
      badge.textContent = String(totalQty);
      try { badge.style.display = ''; } catch (e) {}
      try { badge.removeAttribute('aria-hidden'); } catch (e) {}
    }
  }

  function renderCart(items) {
    if (!elements.list || !elements.empty) return;
    elements.list.innerHTML = '';
    if (!items || !items.length) {
      // show empty state
      try { elements.empty.hidden = false; } catch (e) {}
      try { elements.empty.style.display = ''; } catch (e) {}
      // hide list and checkout
      try { elements.list.hidden = true; } catch (e) {}
      try { elements.list.style.display = 'none'; } catch (e) {}
      elements.checkoutBtn.disabled = true;
      updateBadge(0);
      if (elements.subtotal) elements.subtotal.textContent = formatCurrency(0);
      elements.total.textContent = formatCurrency(0);
      if (continueLink) continueLink.style.display = 'none';
      if (continueBtnWrap) continueBtnWrap.style.display = 'none';
      if (continueBtn) try { continueBtn.hidden = true; } catch(e) {}
      return;
    }
    // hide empty state
    try { elements.empty.hidden = true; } catch (e) {}
    try { elements.empty.style.display = 'none'; } catch (e) {}
    // show list
    try { elements.list.hidden = false; } catch (e) {}
    try { elements.list.style.display = ''; } catch (e) {}
    if (continueLink) continueLink.style.display = 'none';
    if (continueBtnWrap) continueBtnWrap.style.display = '';
    if (continueBtn) try { continueBtn.hidden = false; } catch(e) {}

    let total = 0;
    let count = 0;
    items.forEach(it => {
      count += (it.qty || 0);
      const row = document.createElement('div'); row.className = 'cart-row';
      // Add a black shadow class so each rendered row receives a stronger, darker shadow
      row.classList.add('shadow-black');
      const imgWrap = document.createElement('div'); imgWrap.className = 'cart-image-wrap';
      const img = document.createElement('img'); img.src = it.image || 'images/jackbrown.jpg'; img.alt = it.title || 'Item'; img.width = 88; img.height = 88; imgWrap.appendChild(img);
      const details = document.createElement('div'); details.className = 'cart-item-details';
      const title = document.createElement('div'); title.className = 'cart-item-title'; title.textContent = it.title || 'Item';
      const meta = document.createElement('div'); meta.className = 'cart-item-meta';
      if (it.size) {
        const s = document.createElement('span'); s.className = 'meta-size'; s.textContent = 'Size: ' + it.size; meta.appendChild(s);
      }
      if (it.color) {
        const c = document.createElement('span'); c.className = 'meta-color'; c.setAttribute('title', it.color); c.style.background = it.color; meta.appendChild(c);
      }
      details.appendChild(title); details.appendChild(meta);
      // price per (left side small text)
      const pricePer = document.createElement('div'); pricePer.className = 'price-per'; pricePer.textContent = 'Price Per 1: ' + (it.priceText || formatCurrency(it.price || 0, 2));
      details.appendChild(pricePer);

      const qtyWrap = document.createElement('div'); qtyWrap.className = 'cart-item-qty';
      const dec = document.createElement('button'); dec.className = 'qty-btn dec'; dec.innerHTML = '−';
      const qtyVal = document.createElement('input'); qtyVal.type = 'number'; qtyVal.className = 'qty-input'; qtyVal.value = String(it.qty || 1); qtyVal.min = 1; qtyVal.step = 1;
      const inc = document.createElement('button'); inc.className = 'qty-btn inc'; inc.innerHTML = '+';
      qtyWrap.appendChild(dec); qtyWrap.appendChild(qtyVal); qtyWrap.appendChild(inc);

      const priceWrap = document.createElement('div'); priceWrap.className = 'cart-item-price';
      const p = document.createElement('div'); p.className = 'price';
      const priceTotal = document.createElement('div'); priceTotal.className = 'price-total'; priceTotal.textContent = formatCurrency((it.price || 0) * (it.qty || 1), 2);
      p.appendChild(priceTotal);
      priceWrap.appendChild(p);

      const rm = document.createElement('button'); rm.className = 'remove-btn'; rm.setAttribute('aria-label', 'Remove item');
      rm.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9 3L8 4H5v2h14V4h-3l-1-1h-6zM6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6z" fill="#c43" /></svg>';

      row.appendChild(imgWrap); row.appendChild(details); row.appendChild(qtyWrap); row.appendChild(priceWrap); row.appendChild(rm);
      elements.list.appendChild(row);

      total += (it.price || 0) * (it.qty || 0);

      // Event handlers
      inc.addEventListener('click', () => {
        it.qty = (it.qty || 0) + 1; qtyVal.value = String(it.qty); priceTotal.textContent = formatCurrency((it.price || 0) * it.qty, 2); recalc(); saveAndRender();
      });
      dec.addEventListener('click', () => {
        // Ensure minimum qty of 1; don't auto-remove via the dec button
        it.qty = Math.max(1, (it.qty || 0) - 1);
        qtyVal.value = String(it.qty);
        priceTotal.textContent = formatCurrency((it.price || 0) * it.qty, 2);
        recalc(); saveAndRender();
      });
      qtyVal.addEventListener('change', () => {
        const n = Math.max(1, Math.trunc(Number(qtyVal.value) || 1)); it.qty = n; priceTotal.textContent = formatCurrency((it.price || 0) * it.qty, 2); recalc(); saveAndRender();
      });
      rm.addEventListener('click', () => { const idx = items.indexOf(it); if (idx >= 0) items.splice(idx, 1); saveAndRender(); });
    });

    if (elements.subtotal) elements.subtotal.textContent = formatCurrency(total);
    // No tax applied — total equals sum of item prices
    const taxEl = document.getElementById('tax'); if (taxEl) taxEl.textContent = formatCurrency(0);
    elements.total.textContent = formatCurrency(total);
    elements.checkoutBtn.disabled = items.length === 0;
    const checkoutMobile = document.getElementById('checkout-btn-mobile');
    const checkoutTotalEl = document.getElementById('checkout-total-amt');
    const checkoutBar = document.getElementById('cart-checkout-bar');
    if (checkoutMobile) checkoutMobile.disabled = items.length === 0;
    if (checkoutTotalEl) checkoutTotalEl.textContent = elements.total.textContent;
    if (checkoutBar) checkoutBar.style.display = items.length === 0 ? 'none' : 'block';
    updateBadge(count);

    function recalc() {
      let t = 0; let c = 0; items.forEach(i => { t += (i.price||0) * (i.qty||0); c += (i.qty||0); });
      if (elements.subtotal) elements.subtotal.textContent = formatCurrency(t);
      const taxEl2 = document.getElementById('tax'); if (taxEl2) taxEl2.textContent = formatCurrency(0);
      elements.total.textContent = formatCurrency(t);
      updateBadge(c);
    }

    function saveAndRender() { saveCart(items); renderCart(items); }

    // wire clear button
    elements.clearBtn.onclick = () => {
      if (!confirm('Clear cart?')) return; items.length = 0; saveAndRender();
    };
  }

  // Intialize page
  function init() {
    const items = getMergedCart(); renderCart(items);
    // Keep listening for changes from other tabs or pages
    window.addEventListener('storage', (ev) => {
      if (ev.key === CART_KEY || ev.key === CART_KEY_OLD || ev.key === '__cart_last_update') {
        const items2 = getMergedCart(); renderCart(items2);
      }
    });
    // Checkout interaction: simple flow for demo
    const checkout = document.getElementById('checkout-btn');
    if (checkout) {
      checkout.addEventListener('click', function () {
        const items2 = getMergedCart();
        if (!items2 || !items2.length) return alert('Your cart is empty');
        const total = items2.reduce((s, it) => s + ((it.price || 0) * (it.qty || 0)), 0);
        alert(`Checkout — ${items2.length} item(s). Total: ${formatCurrency(total)}`);
      });
    }
    const checkoutMobileBtn = document.getElementById('checkout-btn-mobile');
    if (checkoutMobileBtn) checkoutMobileBtn.addEventListener('click', function () { checkout && checkout.click(); });
  }

  // Run init when ready
  document.addEventListener('DOMContentLoaded', () => init());

})();
