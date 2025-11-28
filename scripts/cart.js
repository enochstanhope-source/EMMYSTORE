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
  // Optional merchant WhatsApp number (E.164 without +). Leave empty for no recipient.
  const MERCHANT_WA_NUMBER = '2349162919586';
  // When true and MERCHANT_DIRECT_NUMBER is present, checkout will open WhatsApp to this number directly.
  const FORCE_SEND_TO_MERCHANT_ON_CHECKOUT = true;
  // Merchant number to send directly on checkout when FORCE_SEND_TO_MERCHANT_ON_CHECKOUT is true.
  // Use the local format you provided (e.g. '09162919586'). We'll strip non-digits when building the wa.me link.
  const MERCHANT_DIRECT_NUMBER = '2349162919586';
  // Prevent forwarding to these raw blocked numbers (local formats)
  const MERCHANT_WA_BLOCKLIST = ['09162919586'];
  // Optional backend endpoint: POST generated invoice files to this server which will send via WhatsApp Cloud API
  // If empty, checkout will attempt to share via OS share/clipboard and/or download, but will not redirect to wa.me
  const WHATSAPP_SERVER_SEND_URL = '';

  function sanitizeMerchantNumber(raw) {
    try {
      if (!raw) return null;
      const s = String(raw).replace(/[^0-9]/g, '');
      if (!s) return null;
      // If the raw input starts with a leading zero (local format) ignore
      if (String(raw || '').trim().startsWith('0')) return null;
      // Blocklist check — compare against raw forms also stripped of non-digits
      const blockMatches = (MERCHANT_WA_BLOCKLIST || []).map(b => b.replace(/[^0-9]/g, ''));
      if (blockMatches.indexOf(s) !== -1) return null;
      // Basic length check for E.164-ish
      if (s.length < 7 || s.length > 15) return null;
      return s;
    } catch (e) { return null; }
  }

  const elements = {
    list: document.getElementById('cart-list'),
    empty: document.getElementById('cart-empty'),
    subtotal: document.getElementById('subtotal'),
    total: document.getElementById('total'),
    checkoutBtn: document.getElementById('checkout-btn'),
    clearBtn: document.getElementById('clear-cart'),
    message: document.getElementById('cart-message'),
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
      // If the value is a whole number (no kobo), show without decimals (e.g. "₦15,000")
      if (Number.isInteger(n)) {
        return '₦' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      }

      
      // Otherwise show decimals (kobo) with requested precision
      return '₦' + n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    } catch (e) {
      if (Number.isInteger(n)) return '₦' + Math.round(n).toString();
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

    // IndexedDB helpers to store invoice blobs temporarily on the client
    function openInvoiceDB() {
      return new Promise(function (resolve, reject) {
        try {
          const req = indexedDB.open('emmystore-db', 1);
          req.onupgradeneeded = function (ev) {
            const db = ev.target.result;
            if (!db.objectStoreNames.contains('invoices')) {
              db.createObjectStore('invoices', { keyPath: 'key' });
            }
          };
          req.onsuccess = function (ev) { resolve(ev.target.result); };
          req.onerror = function (ev) { reject(ev.target.error || ev); };
        } catch (e) { reject(e); }
      });
    }

    function saveBlobToInvoiceDB(key, blob) {
      return new Promise(async function (resolve, reject) {
        try {
          const db = await openInvoiceDB();
          const tx = db.transaction('invoices', 'readwrite');
          const store = tx.objectStore('invoices');
          store.put({ key: key, blob: blob, ts: Date.now() });
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function (ev) { reject(ev.target.error || ev); };
        } catch (err) { reject(err); }
      });
    }

    function getBlobFromInvoiceDB(key) {
      return new Promise(async function (resolve, reject) {
        try {
          const db = await openInvoiceDB();
          const tx = db.transaction('invoices', 'readonly');
          const store = tx.objectStore('invoices');
          const req = store.get(key);
          req.onsuccess = function (ev) { resolve(ev.target.result ? ev.target.result.blob : null); };
          req.onerror = function (ev) { reject(ev.target.error || ev); };
        } catch (err) { reject(err); }
      });
    }

    function deleteInvoiceFromDB(key) {
      return new Promise(async function (resolve, reject) {
        try {
          const db = await openInvoiceDB();
          const tx = db.transaction('invoices', 'readwrite');
          const store = tx.objectStore('invoices');
          store.delete(key);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function (ev) { reject(ev.target.error || ev); };
        } catch (err) { reject(err); }
      });
    }

    // Attempt to upload a blob to an optional server endpoint that will forward it to WhatsApp via the server-side API
    async function attemptSendViaServer(blob, filename, recipient) {
      try {
        if (!WHATSAPP_SERVER_SEND_URL) { console.warn('attemptSendViaServer: no server URL configured'); return false; }
        if (!blob) return false;
        const form = new FormData();
        form.append('file', blob, filename || 'invoice.pdf');
        if (recipient) form.append('recipient', recipient);
        // Optional caption and other metadata (caption left blank to avoid branded messaging)
        // form.append('caption', 'EMMY APPAREL — Invoice');
        const res = await fetch(WHATSAPP_SERVER_SEND_URL, { method: 'POST', body: form });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          console.error('attemptSendViaServer: server returned error', res.status, data);
          try { showCartMessage('Failed to send invoice via server: ' + (data && data.error ? data.error : res.statusText), 5000, 'error'); } catch (e) {}
          return false;
        }
        console.log('attemptSendViaServer: success', data);
        try { showCartMessage('Invoice sent to merchant via server'); } catch (e) {}
        return true;
      } catch (err) { console.error('attemptSendViaServer error', err); try { showCartMessage('Server send failed', 5000, 'error'); } catch (e) {} return false; }
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

    function saveAndRender() { saveCart(items); renderCart(items); if (window.__updateCheckoutState) try { window.__updateCheckoutState(); } catch(e){} }

    // wire clear button
    elements.clearBtn.onclick = () => {
      if (!confirm('Clear cart?')) return; items.length = 0; saveAndRender();
    };
  }

  // Intialize page
  function init() {
    const items = getMergedCart(); renderCart(items);
    // Message display helper
    function showCartMessage(msg, timeout, type) {
      try {
        if (!elements.message) { alert(msg); return; }
        // Reset visual type classes
        elements.message.classList.remove('cart-message--error', 'cart-message--warning');
        if (type === 'error') elements.message.classList.add('cart-message--error');
        else if (type === 'warning') elements.message.classList.add('cart-message--warning');
        elements.message.textContent = msg || '';
        elements.message.hidden = false;
        if (timeout === undefined) timeout = 4000;
        if (timeout > 0) setTimeout(function () { try { elements.message.hidden = true; elements.message.textContent = ''; elements.message.classList.remove('cart-message--error', 'cart-message--warning'); } catch (e) {} }, timeout);
      } catch (e) { try { alert(msg); } catch (err) {} }
    }

    // Return true if the user has typed any address (in the input) or a saved address exists.
    function hasAddress() {
      try {
        const addrInput = document.getElementById('address-field');
        const v = (addrInput && String(addrInput.value || '').trim()) || '';
        const stored = String(localStorage.getItem('emmystore_address') || '').trim();
        return Boolean((v && v.length > 0) || (stored && stored.length > 0));
      } catch (e) { return false; }
    }

    // Return true only if a saved address is present in localStorage.
    function hasSavedAddress() {
      try { return Boolean(String(localStorage.getItem('emmystore_address') || '').trim()); } catch (e) { return false; }
    }

    function hasSavedContact() {
      try {
        const raw = localStorage.getItem('emmystore_contact');
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return Boolean(parsed && (parsed.name || parsed.phone));
      } catch (e) { return false; }
    }

    function getSavedContact() {
      try {
        const raw = localStorage.getItem('emmystore_contact');
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) { return null; }
    }

    function getSavedAddress() {
      try { return String(localStorage.getItem('emmystore_address') || '').trim() || null; } catch (e) { return null; }
    }

    function showFieldError(input, message) {
      try {
        if (!input) return;
        const errId = input.id + '-error';
        const errEl = document.getElementById(errId);
        if (errEl) { errEl.textContent = message; errEl.classList.add('visible'); errEl.hidden = false; }
        input.classList.add('invalid');
        input.setAttribute('aria-invalid','true');
      } catch (e) {}
    }

    function clearFieldError(input) {
      try {
        if (!input) return;
        const errId = input.id + '-error';
        const errEl = document.getElementById(errId);
        if (errEl) { errEl.classList.remove('visible'); errEl.hidden = true; errEl.textContent = ''; }
        input.classList.remove('invalid');
        input.removeAttribute('aria-invalid');
      } catch (e) {}
    }

    function showContactRequiredError() {
      try {
        const el = document.getElementById('contact-required-error');
        if (el) { el.textContent = 'Name and phone number required'; el.classList.add('visible'); el.hidden = false; }
      } catch (e) {}
    }

    function clearContactRequiredError() {
      try {
        const el = document.getElementById('contact-required-error');
        if (el) { el.classList.remove('visible'); el.hidden = true; el.textContent = ''; }
      } catch (e) {}
    }

    function updateCheckoutState() {
      try {
        const items2 = getMergedCart();
        const hasItems = items2 && items2.length > 0;
        // Require a saved address and saved contact for checkout to be enabled.
        const addr = hasSavedAddress();
        const contactSaved = hasSavedContact();
        const enabled = hasItems && addr && contactSaved;
        if (elements.checkoutBtn) elements.checkoutBtn.disabled = !enabled;
        const checkoutMobile = document.getElementById('checkout-btn-mobile');
        if (checkoutMobile) checkoutMobile.disabled = !enabled;
      } catch (e) { /* ignore */ }
    }

    function buildWhatsAppInvoice(items, contact, address) {
      try {
        const lines = [];
        lines.push('');
        if (contact) {
          lines.push('Customer: ' + (contact.name || '').trim());
          lines.push('Phone: ' + (contact.phone || '').trim());
        }
        if (address) { lines.push('Address: ' + (address || '').trim()); }
        lines.push('');
        lines.push('Items:');
        let itemIndex = 1; let total = 0;
        (items || []).forEach(it => {
          const qty = Number(it.qty || 1);
          const price = Number(it.price || 0);
          const subtotal = qty * price;
          total += subtotal;
          lines.push(`${itemIndex}. ${it.title || it.id || 'Item'} — Qty: ${qty} — Unit: ${formatCurrency(price, 2)} — Subtotal: ${formatCurrency(subtotal, 2)}`);
          itemIndex += 1;
        });
        lines.push('');
        lines.push('Total: ' + formatCurrency(total, 2));
        // Note: Omitted closing footer message by request
        return lines.join('\n');
      } catch (e) { return '' + (items || []).length + ' items — Total: ' + (items || []).reduce((s,i) => s + ((i.price||0) * (i.qty||0)), 0); }
    }

    // Build an image (PNG) of the invoice using canvas and product images. Returns a Promise<Blob>
    function buildInvoiceImage(items, contact, address, options) {
      options = options || {};
      return new Promise(function (resolve) {
        try {
          const width = options.width || 1080;
          const padding = 28;
          const itemHeight = 120;
          const headerHeight = 180;
          const footerHeight = 120;
          const rows = (items && items.length) || 0;
          const height = headerHeight + (rows * itemHeight) + footerHeight + padding * 2;
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          // Background
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
          // Header (brand removed)
          ctx.fillStyle = '#222'; ctx.font = 'bold 36px Roboto, Arial, sans-serif'; ctx.fillText('Order Invoice', padding, 60);
          // Customer
          ctx.fillStyle = '#333'; ctx.font = '20px Roboto, Arial, sans-serif';
          if (contact && contact.name) ctx.fillText('Customer: ' + contact.name, padding, 100);
          if (contact && contact.phone) ctx.fillText('Phone: ' + contact.phone, padding, 128);
          if (address) ctx.fillText('Address: ' + address, padding, 156);
          // Items
          let y = headerHeight;
          let itemIndex = 1;
          const loadPromises = [];
          (items || []).forEach(function (it) {
            const imgSrc = it.image || '';
            const imgX = padding; const imgY = y + 10; const imgW = 100; const imgH = 100;
            // Draw placeholder background box for image
            ctx.fillStyle = '#f2f2f2'; ctx.fillRect(imgX, imgY, imgW, imgH);
            // Load images asynchronously
            if (imgSrc) {
              const p = new Promise(function (res) {
                const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = function () { try { ctx.drawImage(img, imgX, imgY, imgW, imgH); } catch (e) { } res(); }; img.onerror = function () { res(); }; img.src = imgSrc;
              });
              loadPromises.push(p);
            }
            // Text details
            ctx.fillStyle = '#111'; ctx.font = '20px Roboto, Arial, sans-serif';
            ctx.fillText((itemIndex) + '. ' + (it.title || it.id || 'Item'), padding + imgW + 16, y + 30);
            const qty = Number(it.qty || 1); const price = Number(it.price || 0); const subtotal = qty * price;
            ctx.fillStyle = '#555'; ctx.font = '18px Roboto, Arial, sans-serif';
            ctx.fillText('Qty: ' + qty + '  Unit: ' + formatCurrency(price, 2) + '  Subtotal: ' + formatCurrency(subtotal, 2), padding + imgW + 16, y + 64);
            y += itemHeight; itemIndex += 1;
          });
          // Final total
          const total = (items || []).reduce((s, it) => s + ((Number(it.price||0) * Number(it.qty||1)) || 0), 0);
          Promise.all(loadPromises).then(function () {
            ctx.font = 'bold 24px Roboto, Arial, sans-serif'; ctx.fillStyle = '#000'; ctx.fillText('Total: ' + formatCurrency(total, 2), padding, height - footerHeight + 60);
            // Convert to blob
              try { canvas.toBlob(function (blob) { resolve(blob); }, 'image/png'); } catch (e) { try { resolve(null); } catch (err) { resolve(null); } }
          }).catch(function () { try { canvas.toBlob(function (blob) { resolve(blob); }, 'image/png'); } catch (e) { resolve(null); } });
        } catch (e) { resolve(null); }
      });
    }

    // Build a PDF using jsPDF with item images and details. Returns Promise<Blob>
    function buildInvoicePDF(items, contact, address, options) {
      options = options || {};
      // Ensure jsPDF is available
      const jspdfLib = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : (window.jspdf ? window.jspdf : null);
      return new Promise(async function (resolve) {
        try {
          if (!window.jspdf || !window.jspdf.jsPDF) { resolve(null); return; }
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF({ unit: 'pt', format: 'a4' });
          const pageWidth = doc.internal.pageSize.getWidth();
          let cursorY = 40;
          const margin = 36;
          // Header
          doc.setFontSize(18); doc.setFont('Helvetica', 'bold'); doc.text('Order Invoice', margin, cursorY);
          cursorY += 28;
          doc.setFontSize(12); doc.setFont('Helvetica', 'normal');
          if (contact && contact.name) { doc.text('Customer: ' + contact.name, margin, cursorY); cursorY += 16; }
          if (contact && contact.phone) { doc.text('Phone: ' + contact.phone, margin, cursorY); cursorY += 16; }
          if (address) { doc.text('Address: ' + address, margin, cursorY); cursorY += 20; }
          cursorY += 6;
          // Items
          let total = 0;
          const imgPromises = [];
          for (let i = 0; i < (items || []).length; i++) {
            const it = items[i];
            const qty = Number(it.qty || 1), price = Number(it.price || 0), subtotal = qty * price; total += subtotal;
            // If item has image, fetch as dataURL via canvas (CORS errors are handled by resolving with null)
            if (it.image) {
              imgPromises.push(new Promise((res) => {
                const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = function () {
                  // draw the image to canvas to get dataURL sized
                  const cv = document.createElement('canvas'); const w = 80, h = 80; cv.width = w; cv.height = h; const ctx = cv.getContext('2d'); try { ctx.drawImage(img, 0, 0, w, h); } catch (e) {}
                  try { res({ dataUrl: cv.toDataURL('image/png'), title: it.title, qty, price, subtotal }); } catch (e) { res({ dataUrl: null, title: it.title, qty, price, subtotal }); }
                }; img.onerror = function () { res({ dataUrl: null, title: it.title, qty, price, subtotal }); }; img.src = it.image;
              }));
            } else {
              imgPromises.push(Promise.resolve({ dataUrl: null, title: it.title, qty, price, subtotal }));
            }
          }
          const imgResults = await Promise.all(imgPromises);
          for (let i = 0; i < imgResults.length; i++) {
            const r = imgResults[i];
            // Check for page break
            if (cursorY > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); cursorY = 40; }
            if (r.dataUrl) {
              try { doc.addImage(r.dataUrl, 'PNG', margin, cursorY, 80, 80); } catch (e) {}
            }
            const textX = margin + (r.dataUrl ? 96 : 0);
            doc.setFontSize(12); doc.text(`${i+1}. ${r.title || 'Item'}`, textX, cursorY + 16);
            doc.setFontSize(10); doc.text(`Qty: ${r.qty}  Unit: ${formatCurrency(r.price, 2)}  Subtotal: ${formatCurrency(r.subtotal, 2)}`, textX, cursorY + 36);
            cursorY += 96;
          }
          // Total
          if (cursorY > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); cursorY = 40; }
          doc.setFontSize(14); doc.setFont('Helvetica', 'bold'); doc.text('Total: ' + formatCurrency(total, 2), margin, cursorY + 12);
          // Footer note intentionally left blank (footer message removed)
          // Output blob
          try { const blob = doc.output('blob'); resolve(blob); } catch (e) { resolve(null); }
        } catch (e) { resolve(null); }
      });
    }
    // Expose for the renderCart saveAndRender hook
    try { window.__updateCheckoutState = updateCheckoutState; } catch (e) {}
    // Ensure the initial state is correct
    updateCheckoutState();

    // Helper: attempt to share a file using the Web Share API with files (if supported).
    // Returns a Promise<boolean> resolving to true if `navigator.share` succeeded, false otherwise.
    async function tryShareFile(file, text) {
      try {
        if (!file) return false;
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], text: text || '' });
            console.log('tryShareFile: shared', file.name);
            return true;
          } catch (e) { console.warn('tryShareFile: navigator.share failed', e); return false; }
        }
        return false;
      } catch (e) { console.error('tryShareFile error', e); return false; }
    }

    // Helper: attempt to copy a Blob (file) to the clipboard so the user can paste it into WhatsApp Web
    // Returns Promise<boolean> indicating success
    async function tryCopyBlobToClipboard(blob, mimeType) {
      try {
        if (!blob || !navigator.clipboard || !window.ClipboardItem) return false;
        const type = mimeType || blob.type || 'application/octet-stream';
        const clipboardItem = new ClipboardItem({ [type]: blob });
        await navigator.clipboard.write([clipboardItem]);
        console.log('tryCopyBlobToClipboard: success', type);
        return true;
      } catch (e) {
        console.warn('tryCopyBlobToClipboard: failed', e);
        return false;
      }
    }
    // Address save/delete behavior: multi-address list persisted to localStorage
    try {
      // Only a single saved address is stored
      const ADDR_SELECTED_KEY = 'emmystore_address'; // single selected address
      const addressField = document.getElementById('address-field');
      // No chips - keep input element in place
      const saveBtn = document.getElementById('address-save-btn');
      const clearBtn = document.getElementById('address-clear-btn');
      const deleteBtn = document.getElementById('address-delete-btn');
      // Small SVG variants to swap dynamically when delete becomes active/inactive
      // Use a PNG delete icon from the project's media icons folder. Directory name contains a space
      // so the path is encoded the same way it's used elsewhere in the project.
      const ICON_DELETE_IMG = '<img src="media%20icons/delete.png" alt="Delete address" width="16" height="16" aria-hidden="true">';
      // No saved-addresses container in DOM (single-address mode)

      // Only store a single selected address
      let selectedAddress = null;

      function renderAddressList() {
        // No saved list UI in single-address mode
      }

      function applyAddress(value) {
        if (!addressField) return;
        selectedAddress = String(value || '') || null;
        addressField.value = selectedAddress || '';
        try { if (selectedAddress) localStorage.setItem(ADDR_SELECTED_KEY, selectedAddress); else localStorage.removeItem(ADDR_SELECTED_KEY); } catch (e) {}
        updateButtons(); addressField.focus();
        updateAddressSavedState();
      }

      // No chips UI in single-address mode

      function updateButtons() {
        if (!addressField) return;
        const v = (addressField.value || '').trim();
        const stored = (selectedAddress || localStorage.getItem(ADDR_SELECTED_KEY) || '');
        // Clear button state
        if (clearBtn) clearBtn.disabled = !v;
        // Save button state: enabled when there is a non-empty value and it differs from stored
        if (saveBtn) {
          if (!v) { saveBtn.style.display = ''; saveBtn.disabled = true; }
          else if (stored && stored === v) { try { saveBtn.style.display = 'none'; } catch (e) {} saveBtn.disabled = true; }
          else { try { saveBtn.style.display = ''; } catch(e) {} saveBtn.disabled = false; }
        }
        // Delete button: visible when we have a stored address; enabled when there is something deletable
        if (deleteBtn) {
          if (!stored) { deleteBtn.style.display = 'none'; }
          else { deleteBtn.style.display = ''; deleteBtn.disabled = false; try { deleteBtn.innerHTML = ICON_DELETE_IMG; } catch (e) {} }
        }
      }

      // Update the input saved/visual state — when an address is actually saved, we
      // add a visual class `address-saved` which is used by CSS to highlight the input
      // with a light blue background. This keeps presentation concerns in CSS while
      // having JS toggle the state deterministically.
      function updateAddressSavedState() {
        if (!addressField) return;
        const stored = (selectedAddress || localStorage.getItem(ADDR_SELECTED_KEY) || '');
        // Add class when stored address exists and matches the input (or if selectedAddress is set)
        if (stored && stored === (addressField.value || '').trim()) {
          addressField.classList.add('address-saved');
        } else {
          addressField.classList.remove('address-saved');
        }
      }

      // Initialize
      if (addressField) {
        // load previous selection (if any) and populate the input
        const savedSelected = localStorage.getItem(ADDR_SELECTED_KEY);
        if (savedSelected) {
          selectedAddress = savedSelected; addressField.value = savedSelected;
        }
        updateButtons();
        addressField.addEventListener('input', function () { selectedAddress = null; clearFieldError(addressField); updateButtons(); updateAddressSavedState(); try { updateCheckoutState(); } catch(e){} });
      }

      // Save new address: single selected address only
      if (saveBtn && addressField) {
        saveBtn.addEventListener('click', function (e) {
          e.preventDefault(); const v = (addressField.value || '').trim(); if (!v) { alert('Please enter an address to save.'); addressField.focus(); return; }
          try { localStorage.setItem(ADDR_SELECTED_KEY, v); selectedAddress = v; } catch (err) {}
          updateButtons(); clearFieldError(addressField); try { alert('Address saved'); } catch (e) {}
          try { updateCheckoutState(); } catch(e){}
          updateAddressSavedState();
        });
      }

      // Clear input
      if (clearBtn && addressField) {
        clearBtn.addEventListener('click', function (e) { e.preventDefault(); addressField.value = ''; selectedAddress = null; updateButtons(); updateAddressSavedState(); addressField.focus(); try { updateCheckoutState(); } catch(e){} });
      }

      // Delete the single stored address
      if (deleteBtn && addressField) {
        deleteBtn.addEventListener('click', function (e) {
          e.preventDefault(); const v = (addressField.value || '').trim(); const stored = (localStorage.getItem(ADDR_SELECTED_KEY) || '');
          if (!stored && !v) { alert('No saved address selected'); return; }
          if (!confirm('Delete saved address?')) return;
          try { localStorage.removeItem(ADDR_SELECTED_KEY); } catch (err) {}
          if (addressField) addressField.value = ''; selectedAddress = null; updateButtons(); updateAddressSavedState(); clearFieldError(addressField); try { alert('Address removed'); } catch (e) {} try { updateCheckoutState(); } catch (e) {}
        });
      }

      // Keep selected address in sync across tabs
      window.addEventListener('storage', function (ev) {
        if (ev.key === ADDR_SELECTED_KEY) {
          selectedAddress = ev.newValue || null;
          try { if (addressField && selectedAddress) addressField.value = selectedAddress; } catch (e) {}
          selectedAddress = ev.newValue || null;
          try { if (addressField) addressField.value = selectedAddress || ''; } catch (e) {}
          updateAddressSavedState();
          updateButtons();
          try { updateCheckoutState(); } catch (e) {}
        }
      });

    } catch (err) { /* non-critical */ }
    // Keep listening for changes from other tabs or pages
    window.addEventListener('storage', (ev) => {
      if (ev.key === CART_KEY || ev.key === CART_KEY_OLD || ev.key === '__cart_last_update') {
        const items2 = getMergedCart(); renderCart(items2);
        try { updateCheckoutState(); } catch (e) {}
      }
    });

      // Contact (name + phone) save/delete behavior — persisted as a single contact object
      try {
        const CONTACT_KEY = 'emmystore_contact';
        const contactNameField = document.getElementById('contact-name-field');
        const contactPhoneField = document.getElementById('contact-phone-field');
        const contactSaveBtn = document.getElementById('contact-save-btn');
        const contactDeleteBtn = document.getElementById('contact-delete-btn');

        let selectedContact = null; // stored value as JSON string or null

        function updateContactButtons() {
          if (!contactNameField || !contactPhoneField) return;
          const name = (contactNameField.value || '').trim();
          const phone = (contactPhoneField.value || '').trim();
          const digitsOnly = (phone || '').replace(/\D/g, '');
          const validName = name.length > 0;
          const validPhone = digitsOnly.length >= 10 && digitsOnly.length <= 14;
          const stored = selectedContact || localStorage.getItem(CONTACT_KEY) || '';
          if (contactSaveBtn) {
            try {
              // Save button should be enabled only when both name and phone are valid
              if (!validName || !validPhone) {
                contactSaveBtn.style.display = '';
                contactSaveBtn.disabled = true;
              } else if (stored) {
                const raw = typeof stored === 'string' ? stored : JSON.stringify(stored);
                const parsed = raw ? JSON.parse(raw) : null;
                if (parsed && parsed.name === name && parsed.phone === phone) {
                  // Hide save button when the current inputs exactly match the stored contact
                  contactSaveBtn.style.display = 'none'; contactSaveBtn.disabled = true;
                } else {
                  contactSaveBtn.style.display = ''; contactSaveBtn.disabled = false;
                }
              } else { contactSaveBtn.style.display = ''; contactSaveBtn.disabled = false; }
            } catch (e) { try { contactSaveBtn.style.display = ''; } catch (err) {} contactSaveBtn.disabled = true; }
          }
          if (contactDeleteBtn) {
            if (!stored) { contactDeleteBtn.style.display = 'none'; contactDeleteBtn.disabled = true; }
            else { contactDeleteBtn.style.display = ''; contactDeleteBtn.disabled = false; }
          }
        }

        function updateContactSavedState() {
          if (!contactNameField || !contactPhoneField) return;
          const stored = selectedContact || localStorage.getItem(CONTACT_KEY) || '';
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              if (parsed && parsed.name === (contactNameField.value || '').trim() && parsed.phone === (contactPhoneField.value || '').trim()) {
                contactNameField.classList.add('contact-saved');
                contactPhoneField.classList.add('contact-saved');
              } else {
                contactNameField.classList.remove('contact-saved');
                contactPhoneField.classList.remove('contact-saved');
              }
            } catch (e) { contactNameField.classList.remove('contact-saved'); contactPhoneField.classList.remove('contact-saved'); }
          } else {
            contactNameField.classList.remove('contact-saved'); contactPhoneField.classList.remove('contact-saved');
          }
        }

        // Initialize
        if (contactNameField || contactPhoneField) {
          const raw = localStorage.getItem(CONTACT_KEY);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed) { selectedContact = raw; if (contactNameField) contactNameField.value = parsed.name || ''; if (contactPhoneField) contactPhoneField.value = parsed.phone || ''; }
            } catch (e) {}
          }
          updateContactButtons(); updateContactSavedState();
          if (contactNameField) contactNameField.addEventListener('input', function () { selectedContact = null; contactNameField.classList.remove('invalid'); contactNameField.removeAttribute('aria-invalid'); clearFieldError(contactNameField); clearContactRequiredError(); updateContactButtons(); updateContactSavedState(); });
          if (contactPhoneField) {
            contactPhoneField.addEventListener('input', function () {
              // Sanitize: keep digits only and trim to maxlength
              try {
                var v = (contactPhoneField.value || '').replace(/[^0-9+\-]/g, '');
                if (contactPhoneField.maxLength) v = v.slice(0, Number(contactPhoneField.maxLength));
                contactPhoneField.value = v;
              } catch (e) {}
              selectedContact = null; contactPhoneField.classList.remove('invalid'); contactPhoneField.removeAttribute('aria-invalid'); clearFieldError(contactPhoneField); clearContactRequiredError(); updateContactButtons(); updateContactSavedState();
            });
            // Prevent entering alphabetic characters (for key-based input)
            contactPhoneField.addEventListener('keydown', function (e) {
              try {
                // Allow control keys
                var allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab','Home','End'];
                if (allowed.indexOf(e.key) !== -1) return;
                // Allow numeric keys on main keyboard and numpad
                if (/^[0-9]$/.test(e.key)) return;
                // Allow plus and minus characters and common numpad key names
                if (e.key === '+' || e.key === '-' || e.key === 'Add' || e.key === 'Subtract') return;
                // Prevent all other keys
                e.preventDefault();
              } catch (err) {}
            });
            // Handle paste: sanitize and trim
            contactPhoneField.addEventListener('paste', function (e) {
              try {
                var text = (e.clipboardData || window.clipboardData).getData('text') || '';
                var sanitized = text.replace(/[^0-9+\-]/g, '');
                if (contactPhoneField.maxLength) sanitized = sanitized.slice(0, Number(contactPhoneField.maxLength));
                // Insert at caret—simplest approach is to replace entire value
                // Append sanitized string but ensure we respect maxlength
                contactPhoneField.value = ((contactPhoneField.value || '').replace(/[^0-9+\-]/g, '') + sanitized).slice(0, Number(contactPhoneField.maxLength || 18));
                e.preventDefault();
                selectedContact = null; updateContactButtons(); updateContactSavedState();
              } catch (err) {}
            });
          }
        }

        if (contactSaveBtn && (contactNameField || contactPhoneField)) {
          contactSaveBtn.addEventListener('click', function (e) {
            e.preventDefault();
            const name = (contactNameField && (contactNameField.value || '').trim()) || '';
            const phone = (contactPhoneField && (contactPhoneField.value || '').trim()) || '';
            if (!name && !phone) { try { showContactRequiredError(); if (contactPhoneField) contactPhoneField.focus(); else if (contactNameField) contactNameField.focus(); } catch (e) {} return; }
            // Validate phone: numeric-only and between 10 and 14 digits if provided
            if (phone) {
              var digitsOnly = phone.replace(/\D/g, '');
              if (digitsOnly.length < 10 || digitsOnly.length > 14) {
                try { showCartMessage('Phone number must be between 10 and 14 digits', 4000, 'error'); } catch (e) { alert('Phone number must be between 10 and 14 digits'); }
                try { contactPhoneField.classList.add('invalid'); contactPhoneField.setAttribute('aria-invalid','true'); contactPhoneField.focus(); } catch (err) {}
                return;
              }
            }
            const payload = { name: name, phone: phone };
            try { localStorage.setItem(CONTACT_KEY, JSON.stringify(payload)); selectedContact = JSON.stringify(payload); } catch (err) {}
            updateContactButtons(); clearFieldError(contactNameField); clearFieldError(contactPhoneField); clearContactRequiredError(); try { alert('Contact saved'); } catch (e) {}
            updateContactSavedState();
            try { updateCheckoutState(); } catch (e) {}
          });
        }

        if (contactDeleteBtn && (contactNameField || contactPhoneField)) {
          contactDeleteBtn.addEventListener('click', function (e) {
            e.preventDefault();
            const stored = (localStorage.getItem(CONTACT_KEY) || '');
            if (!stored) { alert('No saved contact'); return; }
            if (!confirm('Delete saved contact?')) return;
            try { localStorage.removeItem(CONTACT_KEY); } catch (err) {}
            if (contactNameField) contactNameField.value = ''; if (contactPhoneField) contactPhoneField.value = '';
            selectedContact = null; updateContactButtons(); updateContactSavedState(); clearFieldError(contactNameField); clearFieldError(contactPhoneField); clearContactRequiredError(); try { alert('Contact removed'); } catch (e) {}
            try { updateCheckoutState(); } catch (e) {}
          });
        }

        // Keep selected contact in sync across tabs
        window.addEventListener('storage', function (ev) {
          if (ev.key === CONTACT_KEY) {
            try { selectedContact = ev.newValue || null; const parsed = selectedContact ? JSON.parse(selectedContact) : null; if (contactNameField) contactNameField.value = parsed ? (parsed.name || '') : ''; if (contactPhoneField) contactPhoneField.value = parsed ? (parsed.phone || '') : ''; } catch (e) {}
            updateContactSavedState(); updateContactButtons();
            try { updateCheckoutState(); } catch (e) {}
          }
        });
      } catch (noncritical) { /* ignore */ }
    // Checkout interaction: simple flow for demo
    const checkout = document.getElementById('checkout-btn');
    if (checkout) {
      checkout.addEventListener('click', async function () {
        const items2 = getMergedCart();
        if (!items2 || !items2.length) { updateCheckoutState(); showCartMessage('Your cart is empty', 4000, 'warning'); return; }
        if (!hasSavedAddress() || !hasSavedContact()) {
          updateCheckoutState();
          const af = document.getElementById('address-field');
          const cn = document.getElementById('contact-name-field');
          const cp = document.getElementById('contact-phone-field');
          const sv = document.getElementById('address-save-btn');
          try { if (af) af.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }); } catch (e) {}
          // If the user typed an address but didn't save it, suggest saving by focusing the Save button
          if (hasAddress()) {
            if (sv) try { sv.focus({ preventScroll: false }); } catch (e) { try { sv.focus(); } catch (err) {} }
            showCartMessage('Please save your delivery address before proceeding.', 4000, 'error');
          } else {
            if (af) try { af.focus({ preventScroll: false }); } catch (e) { try { af.focus(); } catch (err) {} }
            showCartMessage('Please enter and save a delivery address below before proceeding.', 4000, 'error');
          }
          // Contact validation: if contact is missing or invalid, focus contact and show inline errors
          if (!hasSavedContact()) {
            // If a user typed something but hasn't saved, suggest saving; else focus name
            try {
              if ((cn && cn.value && cn.value.trim().length) || (cp && cp.value && cp.value.trim().length)) {
                // focus contact save button if present
                const csv = document.getElementById('contact-save-btn');
                if (csv) try { csv.focus({ preventScroll:false }); } catch (e) { try { csv.focus(); } catch (err) {} }
              } else {
                if (cn) try { cn.focus({ preventScroll:false }); } catch (e) { try { cn.focus(); } catch (err) {} }
              }
              // If both fields are empty, show a combined message under the phone field
              try {
                if (cn && cp && !(cn.value && cn.value.trim()) && !(cp.value && cp.value.trim())) {
                  showContactRequiredError();
                } else {
                  // set inline errors on individual empty/invalid fields
                  if (cn && !(cn.value && cn.value.trim())) showFieldError(cn, 'Full name is required');
                  if (cp) {
                    const digitsOnly = (cp.value || '').replace(/\D/g, '');
                    if (!digitsOnly || digitsOnly.length < 10 || digitsOnly.length > 14) showFieldError(cp, 'Phone number must be 10–14 digits');
                  }
                }
              } catch (err) {}
            } catch (err) {}
          }
          return;
        }
        const total = items2.reduce((s, it) => s + ((it.price || 0) * (it.qty || 0)), 0);
          try {
          // Build invoice file and share/download it — do NOT open WhatsApp or send any text message
          const contact = getSavedContact();
          const address = getSavedAddress();
          const invoice = buildWhatsAppInvoice(items2, contact, address); // kept for logging/preview but not used for sending
            // Build invoice PDF, save locally, and prefer server-side send (if configured).
            // If server isn't configured, provide share/clipboard/download fallbacks *without redirecting*.
            try {
              const pdfBlob = await buildInvoicePDF(items2, contact, address);
              const invoiceFileName = 'invoice-' + Date.now() + '.pdf';
              if (!pdfBlob) {
                console.warn('buildInvoicePDF: returned null blob (PDF generation failed)');
                try { showCartMessage('Could not generate invoice PDF. Trying image/text fallbacks...', 5000, 'warning'); } catch (e) {}
              } else {
                try { showCartMessage('Invoice PDF generated, saving locally...', 2000); } catch (e) {}
                try { await saveBlobToInvoiceDB(invoiceFileName, pdfBlob); } catch (e) { console.warn('saveBlobToInvoiceDB failed', e); }
                // If a WHATSAPP server endpoint is configured, upload the PDF and instruct server to send as a document
                if (WHATSAPP_SERVER_SEND_URL) {
                  try { showCartMessage('Uploading invoice to server and sending to merchant...', 0); } catch (e) {}
                  const uploaded = await attemptSendViaServer(pdfBlob, invoiceFileName, (contact && contact.phone) ? (contact.phone) : MERCHANT_DIRECT_NUMBER);
                  if (uploaded) {
                    try { await deleteInvoiceFromDB(invoiceFileName); } catch (e) {}
                    try { showCartMessage('Invoice sent successfully via server'); } catch (e) {}
                    return; // done — no redirect
                  } else {
                    try { showCartMessage('Failed to send via server — invoice saved locally for retry', 5000, 'error'); } catch (e) {}
                    // continue to local fallback (share/clipboard/download) without redirect
                  }
                }

                // Try OS share with files (mobile-focused) — does not redirect the page, but opens share sheet
                try {
                  const file = new File([pdfBlob], invoiceFileName, { type: 'application/pdf' });
                  if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    try { await navigator.share({ files: [file] }); try { showCartMessage('Shared invoice file via OS share'); } catch (e) {} return; } catch (e) { console.warn('navigator.share failed', e); }
                  }
                } catch (e) { console.warn('OS share file creation failed', e); }

                // Attempt to copy the PDF blob to the clipboard so desktop users can paste it in WhatsApp Web
                try {
                  if (await tryCopyBlobToClipboard(pdfBlob, 'application/pdf')) { try { showCartMessage('PDF copied — open WhatsApp web and paste to attach'); } catch (e) {} return; }
                } catch (e) { console.warn('Clipboard PDF copy failed', e); }

                // As a last resort, download the file so it can be attached manually (no redirect)
                try {
                  const blobUrl2 = URL.createObjectURL(pdfBlob); const a = document.createElement('a'); a.href = blobUrl2; a.download = invoiceFileName; a.style.display = 'none'; document.body.appendChild(a); a.click(); try { document.body.removeChild(a); } catch (e) {}
                  try { showCartMessage('Invoice saved to downloads — attach file manually in WhatsApp', 6000); } catch (e) {}
                } catch (ee) { try { showCartMessage('Invoice ready: check downloads to attach it manually', 6000); } catch (e) {} }
                return;
              }
            } catch (err) {
              console.error('buildInvoicePDF() invocation failed', err);
            }
          // No redirect: We avoid redirecting to WhatsApp. The flow above attempts to upload the generated
          // PDF to the configured server which will send to the merchant, otherwise the UI shows a local
          // share/clipboard/download fallback for manual sending.
        } catch (e) { try { alert(`Checkout — ${items2.length} item(s). Total: ${formatCurrency(total)}`); } catch (err) {} }
      });
    }
    const checkoutMobileBtn = document.getElementById('checkout-btn-mobile');
    if (checkoutMobileBtn) checkoutMobileBtn.addEventListener('click', function () { checkout && checkout.click(); });

    // Intercept pointerdown/click events on checkout buttons so we can show inline guidance when disabled
    function _disabledCheckoutInterceptor(e) {
      try {
        const clicked = (e.target && e.target.closest) ? e.target.closest('#checkout-btn, #checkout-btn-mobile') : null;
        if (!clicked) return;
        // If the button is not disabled, let the regular click handler run
        if (!clicked.disabled) return;
        e.preventDefault();
        const items2 = getMergedCart();
        if (!items2 || !items2.length) { updateCheckoutState(); showCartMessage('Your cart is empty', 4000, 'warning'); return; }

        // If either saved address or saved contact is missing, show inline guidance
        if (!hasSavedAddress() || !hasSavedContact()) {
          updateCheckoutState();
          // Address guidance (scroll/focus + message)
          const af = document.getElementById('address-field');
          const sv = document.getElementById('address-save-btn');
          try { if (af) af.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }); } catch (e) {}
          if (!hasSavedAddress()) {
            if (hasAddress()) {
              if (sv) try { sv.focus({ preventScroll: false }); } catch (e) { try { sv.focus(); } catch (err) {} }
              showCartMessage('Please save your delivery address before proceeding.', 4000, 'error');
            } else {
              if (af) try { af.focus({ preventScroll: false }); } catch (e) { try { af.focus(); } catch (err) {} }
              showCartMessage('Please enter and save a delivery address below before proceeding.', 4000, 'error');
            }
          }

          // Contact guidance: show inline errors and focus appropriate control
          if (!hasSavedContact()) {
            try {
              const cn = document.getElementById('contact-name-field');
              const cp = document.getElementById('contact-phone-field');
              const csv = document.getElementById('contact-save-btn');
              // If user has typed something, focus Save; otherwise focus name
              if ((cn && cn.value && cn.value.trim().length) || (cp && cp.value && cp.value.trim().length)) {
                if (csv) try { csv.focus({ preventScroll:false }); } catch (e) { try { csv.focus(); } catch (err) {} }
              } else {
                if (cn) try { cn.focus({ preventScroll:false }); } catch (e) { try { cn.focus(); } catch (err) {} }
              }
              // Inline errors for missing/invalid fields
              try {
                if (cn && cp && !(cn.value && cn.value.trim()) && !(cp.value && cp.value.trim())) {
                  showContactRequiredError();
                } else {
                  if (cn && !(cn.value && cn.value.trim())) showFieldError(cn, 'Full name is required');
                  if (cp) {
                    const digitsOnly = (cp.value || '').replace(/\D/g, '');
                    if (!digitsOnly || digitsOnly.length < 10 || digitsOnly.length > 14) showFieldError(cp, 'Phone number must be 10–14 digits');
                  }
                }
              } catch (err) {}
            } catch (err) {}
          }
          return;
        }
      } catch (err) { /* ignore errors */ }
    }
    document.addEventListener('pointerdown', _disabledCheckoutInterceptor, { passive: true });
    document.addEventListener('click', _disabledCheckoutInterceptor);
  }

  // Run init when ready
  document.addEventListener('DOMContentLoaded', () => init());

})();
