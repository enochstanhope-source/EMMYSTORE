// Category button functionality
const categoryButtons = document.querySelectorAll('.category-btn');
categoryButtons.forEach(button => {
    // Set default aria-pressed for accessibility
    button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
    button.addEventListener('click', function() {
        categoryButtons.forEach(btn => { btn.classList.remove('active'); btn.setAttribute('aria-pressed', 'false'); });
        this.classList.add('active');
        this.setAttribute('aria-pressed', 'true');
    });

    // If this is the 'All' category, scroll to collections section when clicked
    if (button.classList.contains('category-all')) {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            try {
                const main = document.querySelector('.main-content');
                const collections = document.querySelector('.collections-section');
                if (!main || !collections) return;
                const mainRect = main.getBoundingClientRect();
                const sectionRect = collections.getBoundingClientRect();
                // Compute scroll top within the scrollable main element
                const top = Math.max(0, sectionRect.top - mainRect.top + main.scrollTop);
                if (main.scrollTo) main.scrollTo({ top: Math.round(top), behavior: 'smooth' });
                else main.scrollTop = Math.round(top);
                // Focus main for accessibility
                try { main.focus({ preventScroll: true }); } catch (err) { main.focus && main.focus(); }
            } catch (err) { /* ignore */ }
        });
    }
});

// WhatsApp subscribe: build wa.me link including entered name and open chat
(function() {
    const phone = '2349162919586'; // international format (no +)
    const nameInput = document.getElementById('whatsapp-name');
    const sendBtn = document.getElementById('whatsapp-send');
    if (!sendBtn) return;

    function setError(msg) {
        const err = document.getElementById('whatsapp-error');
        if (!err) return;
        // Clear any existing auto-hide timer whenever we update the error
        if (err._autoHideTimer) {
            clearTimeout(err._autoHideTimer);
            err._autoHideTimer = null;
        }
        if (msg) {
            err.textContent = msg;
            err.classList.add('visible');
            err.dataset.visible = 'true';
            // Auto-hide after 2.5 seconds
            err._autoHideTimer = setTimeout(() => {
                err.textContent = '';
                err.classList.remove('visible');
                err.dataset.visible = 'false';
                err._autoHideTimer = null;
            }, 2500);
        } else {
            err.textContent = '';
            err.classList.remove('visible');
            err.dataset.visible = 'false';
        }
    }

    function sendWhatsApp() {
        const name = nameInput ? nameInput.value.trim() : '';
        if (!name) {
            setError('Please enter your name before subscribing.');
            if (nameInput) {
                nameInput.setAttribute('aria-invalid', 'true');
                nameInput.focus();
            }
            return;
        }
        setError('');
        if (nameInput) nameInput.setAttribute('aria-invalid', 'false');
        const message = `Hi, my name is ${name}. Please subscribe me to offers and updates.`;
        const url = `https://wa.me/${phone}?text=` + encodeURIComponent(message);
        // Open in new tab where allowed
        try { window.open(url, '_blank'); }
        catch (err) { window.location.href = url; }
        // Clear the input after attempting to open WhatsApp so the UI resets for the next use
        try {
            if (nameInput) {
                nameInput.value = '';
                // remove invalid state and blur to show the input has been handled
                nameInput.setAttribute('aria-invalid', 'false');
                nameInput.blur && nameInput.blur();
            }
        } catch (err) { /* ignore */ }
    }

    sendBtn.addEventListener('click', function() {
        // If there's no name entered, toggle the error message: hide if visible, show if hidden
        const err = document.getElementById('whatsapp-error');
        const name = nameInput ? nameInput.value.trim() : '';
        if (!name && err) {
            // If error is currently visible, hide it immediately (toggle behavior)
            if (err.classList.contains('visible') || err.dataset.visible === 'true') {
                setError('');
                return;
            }
            // otherwise show the error (auto-hides after 2.5s)
            setError('Please enter your name before subscribing.');
            if (nameInput) {
                nameInput.setAttribute('aria-invalid', 'true');
                nameInput.focus();
            }
            return;
        }

        sendWhatsApp();
    });

    if (nameInput) {
        nameInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendWhatsApp();
            }
        });
    }
})();

// Fallback: ensure any 'Home' menu links always scroll to top and close the menu
(function() {
    const homeLinks = document.querySelectorAll('.menu-link[data-action="home"]');
    if (!homeLinks || !homeLinks.length) return;
    homeLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            // Close/hide the off-canvas menu and backdrop if present
            try {
                const hamburger = document.querySelector('.hamburger-btn');
                const menu = document.getElementById('main-menu');
                const backdrop = document.querySelector('.menu-backdrop');
                if (hamburger) {
                    hamburger.classList.remove('open');
                    hamburger.setAttribute('aria-expanded', 'false');
                }
                if (menu) {
                    menu.classList.remove('open');
                    try { menu.setAttribute('aria-hidden', 'true'); } catch (err) {}
                    try { menu.hidden = true; } catch (err) {}
                }
                if (backdrop) backdrop.classList.remove('visible');
            } catch (err) { /* ignore */ }

            // Set first nav button active for consistent state
            try {
                if (typeof navButtons !== 'undefined' && navButtons && navButtons.length) {
                    navButtons.forEach((btn, idx) => {
                        if (idx === 0) { btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true'); }
                        else { btn.classList.remove('active'); btn.setAttribute('aria-pressed', 'false'); }
                    });
                }
            } catch (err) {}

            // Scroll the main content (or window) to top and focus it for accessibility
            try {
                const main = document.querySelector('.main-content');
                if (main && main.scrollTo) main.scrollTo({ top: 0, behavior: 'smooth' });
                else window.scrollTo({ top: 0, behavior: 'smooth' });
                if (main && typeof main.focus === 'function') main.focus({ preventScroll: true });
            } catch (err) {
                try { const main = document.querySelector('.main-content'); if (main) main.scrollTop = 0; else document.documentElement.scrollTop = 0; } catch (e) {}
            }
        });
    });
})();

// Navigation button functionality
const navButtons = Array.from(document.querySelectorAll('.nav-btn'));
// maintain current active index for direction-based animation
let currentActiveIndex = navButtons.findIndex(b => b.classList.contains('active'));
if (currentActiveIndex === -1) currentActiveIndex = 0; // fallback
navButtons.forEach((button, index) => {
    // ensure aria-pressed is set correctly on initial load
    if (button.classList.contains('active')) button.setAttribute('aria-pressed', 'true');
    else button.setAttribute('aria-pressed', 'false');

    button.addEventListener('click', function() {
        // Add a subtle click-fade class to trigger the overlay fade-in
        this.classList.add('clicked');
        // ensure only one timer exists per element
        if (this._clickFadeTimer) clearTimeout(this._clickFadeTimer);
        this._clickFadeTimer = setTimeout(() => {
            this.classList.remove('clicked');
            this._clickFadeTimer = null;
        }, 520);

        if (index === currentActiveIndex) return; // nothing to do

        // Determine direction: clicking to the right of current means enter-right
        const directionClass = (index > currentActiveIndex) ? 'enter-right' : 'enter-left';

        // Remove active and any direction classes from others
        navButtons.forEach(btn => {
            btn.classList.remove('active', 'enter-left', 'enter-right');
            btn.setAttribute('aria-pressed', 'false');
        });

        // Add direction class to the clicked button so it animates from that side
        this.classList.add(directionClass);

        // Force reflow so the CSS transition triggers when we add 'active'
        // eslint-disable-next-line no-unused-expressions
        this.offsetWidth;

        this.classList.add('active');
        this.setAttribute('aria-pressed', 'true');

        // Remove direction class after transform/opacity transition completes or after a fallback timeout
        const cleanup = (e) => {
            // only act when transform or opacity transition ended — avoid multiple transitionend triggers
            if (e && e.propertyName && !/transform|opacity/.test(e.propertyName)) return;
            this.classList.remove(directionClass);
            clearTimeout(fallback);
            this.removeEventListener('transitionend', cleanup);
        };
        this.addEventListener('transitionend', cleanup);

        // safety fallback in case transitionend doesn't fire (reduced-motion, OS settings, or unexpected)
        const fallback = setTimeout(() => {
            this.classList.remove(directionClass);
            this.removeEventListener('transitionend', cleanup);
        }, 550);

        currentActiveIndex = index;
    });
});

// Don't clear the active state when clicking the page body — keep nav selection until another nav is clicked.

// Floating cart buttons were removed; keep code clean without card-btn listeners

// Small inline cart buttons removed - using `.card-add-btn` instead below images

// Add-to-cart buttons below images (none exist currently; price-add-btn used instead)

// Price add buttons (left of price)
const priceAddBtns = document.querySelectorAll('.price-add-btn');
// Lightweight cart model using product title and USD price from the DOM only.
const cart = {
    items: [], // { title, usd, qty }
    count: 0,
    totalUSD: 0
};

function updateCartUI() {
    const badge = document.getElementById('cart-count');
    if (badge) {
        badge.textContent = String(cart.count);
    }
}

function addItemToCart(title, usdPrice) {
    // Ensure we have numbers
    const usd = (typeof usdPrice === 'number') ? usdPrice : parseFloat(usdPrice) || 0;
    const found = cart.items.find(i => i.title === title);
    if (found) {
        found.qty += 1;
    } else {
        cart.items.push({ title, usd, qty: 1 });
    }
    cart.count += 1;
    cart.totalUSD = cart.items.reduce((s, it) => s + (it.usd * it.qty), 0);
    updateCartUI();
}
priceAddBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        this.classList.remove('spring-anim-small');
        void this.offsetWidth;
        this.classList.add('spring-anim-small');
        // add-to-cart from price pill — use USD price from DOM only
        const card = this.closest('.collection-card');
        if (!card) return;
        const titleEl = card.querySelector('.card-title');
        const priceEl = card.querySelector('.price-text, .price');
        const title = titleEl ? titleEl.textContent.trim() : 'Item';
        let usdValue = 0;
        if (priceEl) {
            // Parse USD from visible text (e.g. "$250.00")
            const txt = priceEl.textContent || priceEl.innerText || '';
            const m = txt.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
            usdValue = m ? parseFloat(m[0]) : 0;
        }
        addItemToCart(title, usdValue);
        // Optional: briefly flash a tiny confirmation (use title and price for UX)
        try {
            // Create a non-invasive toast that disappears
            const toast = document.createElement('div');
            toast.className = 'cart-toast';
            toast.textContent = `${title} added to cart`;
            document.body.appendChild(toast);
            setTimeout(() => { toast.classList.add('visible'); }, 10);
            setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 300); }, 2000);
        } catch (err) {
            // ignore
        }
    });
});

// Favorite toggles
const favButtons = document.querySelectorAll('.fav-btn');
favButtons.forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        this.classList.toggle('active');
        // toggled favorite - no-op in production
    });
});

// Card click: store product and navigate to product detail page
const collectionCards = document.querySelectorAll('.collection-card');
collectionCards.forEach(card => {
    card.addEventListener('click', function(e) {
        // Ignore clicks that happen on interactive child elements (fav, add-to-cart buttons)
        if (e.target.closest('.price-add-btn, .fav-btn, button, a')) return;

        // Build product object from the card's DOM
        const titleEl = this.querySelector('.card-title');
        const priceEl = this.querySelector('.price-text, .price');
        const imgEl = this.querySelector('img');
        const descEl = this.querySelector('.product-desc');
        const ratingValEl = this.querySelector('.rating .rating-value');
        const reviewsCountEl = this.querySelector('.reviews-count');
        const badgeEl = this.querySelector('.badge');

        // Normalize image path so it works from dynamic.html (root) and from index.html location
        let imgSrc = imgEl ? imgEl.getAttribute('src') : '';
        if (imgSrc && !/^https?:|^\/|^EMMYSTORE-main\//.test(imgSrc)) imgSrc = 'EMMYSTORE-main/' + imgSrc.replace(/^\.\//, '');

        const product = {
            id: this.dataset.productId || (titleEl ? titleEl.textContent.trim().toLowerCase().replace(/\s+/g,'-') : 'item'),
            title: titleEl ? titleEl.textContent.trim() : '',
            priceText: priceEl ? priceEl.textContent.trim() : '',
            image: imgSrc || '',
            images: [(imgSrc || '')],
            imageAlt: imgEl ? imgEl.getAttribute('alt') : '',
            description: descEl ? descEl.textContent.trim() : '',
            rating: ratingValEl ? ratingValEl.textContent.trim() : '',
            reviews: reviewsCountEl ? reviewsCountEl.textContent.trim() : '',
            badge: badgeEl ? badgeEl.textContent.trim() : '',
            sizes: this.dataset.sizes ? this.dataset.sizes.split(',') : ['S','M','L','XL'],
            colors: this.dataset.colors ? this.dataset.colors.split(',') : ['#e9e3d7', '#F4D2A3', '#ddd']
        };

        try { localStorage.setItem('selectedProduct', JSON.stringify(product)); } catch (err) { console.warn('Unable to save selectedProduct', err); }
        // Instant switch: navigate immediately with no animations or delays.
        try { window.location.href = '../dynamic.html'; } catch (err) { window.location.href = '../dynamic.html'; }
    });
});

// Search functionality
const searchInput = document.querySelector('.search-input');
if (searchInput) {
    searchInput.addEventListener('input', function(e) {
        // search input change - no-op in production
    });
    
    // Keep focus styling in CSS rather than inline style so we avoid layout jank or overrides
    // Add/remove a class on focus to handle cases where JS manages focus programmatically
    searchInput.addEventListener('focus', function() {
        this.classList.add('is-focused');
    });
    searchInput.addEventListener('blur', function() {
        this.classList.remove('is-focused');
    });
}

// Buy Now button functionality
const buyNowBtn = document.querySelector('.buy-now-btn');
if (buyNowBtn) {
    buyNowBtn.addEventListener('click', function() {
        // buy now clicked — use the price shown in the first collection card (USD only)
        const firstCard = document.querySelector('.collections-row .collection-card');
        if (!firstCard) return;
        const titleEl = firstCard.querySelector('.card-title');
        const priceEl = firstCard.querySelector('.price-text, .price');
        const title = titleEl ? titleEl.textContent.trim() : 'Item';
        let usdValue = 0;
        if (priceEl) {
            const txt = priceEl.textContent || priceEl.innerText || '';
            const m = txt.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
            usdValue = m ? parseFloat(m[0]) : 0;
        }
        addItemToCart(title, usdValue);
        try {
            alert(`Buy now: ${title} — total (USD) $${usdValue}`);
        } catch (e) { console.log('buy now', title, usdValue); }
    });
}

// Hamburger menu functionality (replaces previous filter button)
const hamburgerBtn = document.querySelector('.hamburger-btn');
if (hamburgerBtn) {
    // Ensure aria-expanded starts as a boolean string
    if (!hamburgerBtn.hasAttribute('aria-expanded')) hamburgerBtn.setAttribute('aria-expanded', 'false');

    const menuId = hamburgerBtn.getAttribute('aria-controls');
    const menu = menuId ? document.getElementById(menuId) : null;

    // create backdrop for outside clicks (insert once)
    let backdrop = document.querySelector('.menu-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.className = 'menu-backdrop';
        document.body.appendChild(backdrop);
    }

    function openMenu() {
        hamburgerBtn.classList.add('open');
        hamburgerBtn.setAttribute('aria-expanded', 'true');
        if (menu) {
            // Make the element visible first so the transform/opacity transition can run.
            // Remove the hidden flag and mark aria-hidden=false, force a reflow, then add the
            // 'open' class to trigger the CSS transition. This avoids the jump caused when
            // adding classes while the element is display:none.
            try { menu.hidden = false; } catch (err) {}
            try { menu.setAttribute('aria-hidden', 'false'); } catch (err) {}
            // Force layout so that the subsequent class addition will animate
            // eslint-disable-next-line no-unused-expressions
            menu.offsetWidth;
            menu.classList.add('open');
            // focus the first link for keyboard users without causing page scroll
            const first = menu.querySelector('.menu-link');
            try {
                if (first && first.focus) first.focus({ preventScroll: true });
            } catch (err) {
                if (first && first.focus) first.focus();
            }
        }
        backdrop.classList.add('visible');
    }

    function closeMenu() {
        hamburgerBtn.classList.remove('open');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
        if (menu) {
            // Start closing animation by removing the open class, then set aria-hidden/hidden
            // after the transition completes so the slide-out animation remains smooth.
            menu.classList.remove('open');
            // Listen for transitionend on transform/opacity so we hide only after animation completes.
            const onTransitionEnd = (e) => {
                if (e && e.propertyName && !/transform|opacity/.test(e.propertyName)) return;
                try { menu.setAttribute('aria-hidden', 'true'); } catch (err) {}
                try { menu.hidden = true; } catch (err) {}
                menu.removeEventListener('transitionend', onTransitionEnd);
                clearTimeout(fallback);
            };
            menu.addEventListener('transitionend', onTransitionEnd);
            // Fallback in case transitionend doesn't fire (reduced-motion or other reasons)
                const fallback = setTimeout(() => {
                    try { menu.setAttribute('aria-hidden', 'true'); } catch (err) {}
                    try { menu.hidden = true; } catch (err) {}
                    menu.removeEventListener('transitionend', onTransitionEnd);
                }, 640);
        }
        backdrop.classList.remove('visible');
    }

    hamburgerBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        const willOpen = !this.classList.contains('open');
        if (willOpen) openMenu(); else closeMenu();
    });

    // Close when clicking the backdrop
    backdrop.addEventListener('click', function() { closeMenu(); });

    // Close on outside click also (covers clicks not on backdrop for small edge cases)
    document.addEventListener('click', function(event) {
        if (!hamburgerBtn.contains(event.target) && menu && !menu.contains(event.target) && hamburgerBtn.classList.contains('open')) {
            closeMenu();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && hamburgerBtn.classList.contains('open')) {
            closeMenu();
            hamburgerBtn.focus();
        }
    });

    // Logo click should act like 'Home' — navigate to top and set Home nav active
    const logo = document.querySelector('.logo');
    if (logo) {
        logo.addEventListener('click', function(e) {
            e.preventDefault();
            // Set Home/first nav as active
            if (navButtons && navButtons.length) {
                navButtons.forEach((btn, idx) => {
                    if (idx === 0) { btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true'); }
                    else { btn.classList.remove('active'); btn.setAttribute('aria-pressed', 'false'); }
                });
            }
            // Close the menu if open
            try { if (hamburgerBtn.classList.contains('open')) closeMenu(); } catch (err) {}
            // Smooth scroll to top of the main content or window
            const main = document.querySelector('.main-content');
            try {
                if (main && main.scrollTo) main.scrollTo({ top: 0, behavior: 'smooth' });
                else window.scrollTo({ top: 0, behavior: 'smooth' });
                // Move keyboard focus to the main content for better accessibility
                if (main && typeof main.focus === 'function') main.focus({ preventScroll: true });
            } catch (err) { if (main) { main.scrollTop = 0; try { main.focus(); } catch (er) {} } else document.documentElement.scrollTop = 0; }
            // Mark attached so we don't attach a duplicate handler later
            try { logo._homeClickHandlerAttached = true; } catch (e) {}
        });
    }

    // Menu links: close menu and, if Home was clicked, scroll to top and set Home active
    if (menu) {
        const menuLinks = menu.querySelectorAll('.menu-link');
        menuLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                // prevent default anchors (all links are '#') and handle behavior
                e.preventDefault();
                // close menu first
                try { closeMenu(); } catch (err) {}
                // If Home was clicked, set navButtons and scroll to top
                if (this.dataset && this.dataset.action === 'home') {
                    if (navButtons && navButtons.length) {
                        navButtons.forEach((btn, idx) => {
                            if (idx === 0) { btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true'); }
                            else { btn.classList.remove('active'); btn.setAttribute('aria-pressed', 'false'); }
                        });
                    }
                    const main = document.querySelector('.main-content');
                    try {
                        if (main && main.scrollTo) main.scrollTo({ top: 0, behavior: 'smooth' });
                        else window.scrollTo({ top: 0, behavior: 'smooth' });
                        if (main && typeof main.focus === 'function') main.focus({ preventScroll: true });
                    } catch (err) { if (main) { main.scrollTop = 0; try { main.focus(); } catch (er) {} } else document.documentElement.scrollTop = 0; }
                }
            });
        });
    }
}

// spring animation keyframes moved to CSS for better performance

// No scroll/resize listeners to keep runtime cost low

// Initial setup: Ensure Home nav is active and first card is visible
document.addEventListener('DOMContentLoaded', function() {
    if (navButtons && navButtons.length) {
        navButtons.forEach((btn, idx) => {
            if (idx === 0) {
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
            } else {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            }
        });
    }
    // Ensure the first collection card is visible on initial load
    const collectionsRow = document.querySelector('.collections-row');
    if (collectionsRow) {
        try {
            collectionsRow.scrollTo({ left: 0, behavior: 'auto' });
        } catch (e) {
            collectionsRow.scrollLeft = 0;
        }
        const firstCard = collectionsRow.querySelector('.collection-card');
        if (firstCard && firstCard.scrollIntoView) {
            firstCard.scrollIntoView({ behavior: 'auto', inline: 'start', block: 'nearest' });
        }
    }
    // Ensure `#main-menu` hidden state matches `aria-hidden` on load
    try {
        const menuEl = document.getElementById('main-menu');
        if (menuEl) {
            const attr = menuEl.getAttribute('aria-hidden');
            menuEl.hidden = attr !== 'false';
        }
    } catch (e) {}
    // Set header height CSS variable
    function setHeaderHeightVar() {
        try {
            const header = document.querySelector('.header');
            const root = document.documentElement;
            if (header && root) {
                const h = header.getBoundingClientRect().height;
                root.style.setProperty('--header-height', Math.round(h) + 'px');
            }
        } catch (e) {}
    }
    setHeaderHeightVar();
    window.addEventListener('resize', setHeaderHeightVar);
    // Ensure main content starts at the same position as a logo click when page loads
    try {
        const main = document.querySelector('.main-content');
        if (main) {
            if (main.scrollTo) main.scrollTo({ top: 0, behavior: 'auto' });
            else main.scrollTop = 0;
            try { if (typeof main.focus === 'function') main.focus({ preventScroll: true }); } catch (err) {}
        }
    } catch (err) {}
    // Ensure clicking the logo always navigates Home/scrolls to top (even if hamburger absent)
    try {
        const logoCatch = document.querySelector('.logo');
        if (logoCatch && !logoCatch._homeClickHandlerAttached) {
            logoCatch.addEventListener('click', function(e) {
                e.preventDefault();
                // Set first nav active
                if (navButtons && navButtons.length) {
                    navButtons.forEach((btn, idx) => {
                        if (idx === 0) { btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true'); }
                        else { btn.classList.remove('active'); btn.setAttribute('aria-pressed', 'false'); }
                    });
                }
                const main = document.querySelector('.main-content');
                try {
                    if (main && main.scrollTo) main.scrollTo({ top: 0, behavior: 'smooth' });
                    else window.scrollTo({ top: 0, behavior: 'smooth' });
                    if (main && typeof main.focus === 'function') main.focus({ preventScroll: true });
                } catch (err) { if (main) main.scrollTop = 0; else document.documentElement.scrollTop = 0; }
            });
            logoCatch._homeClickHandlerAttached = true;
        }
    } catch (err) {}

    // Universal Home handler: ensure any element with `data-action="home"`
    // scrolls the main content into view, focuses it, and sets the first
    // nav button as active. This covers cases where the menu/handlers
    // might not have been attached directly to the element.
    document.addEventListener('click', function (e) {
        try {
            const el = e.target && e.target.closest && e.target.closest('[data-action="home"]');
            if (!el) return;
            e.preventDefault();

            // Set first nav active
            if (navButtons && navButtons.length) {
                navButtons.forEach((btn, idx) => {
                    if (idx === 0) { btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true'); }
                    else { btn.classList.remove('active'); btn.setAttribute('aria-pressed', 'false'); }
                });
            }

            // Smooth-scroll main content (or window) to top and focus it
            const main = document.querySelector('.main-content');
            try {
                if (main && main.scrollTo) main.scrollTo({ top: 0, behavior: 'smooth' });
                else window.scrollTo({ top: 0, behavior: 'smooth' });
                if (main && typeof main.focus === 'function') main.focus({ preventScroll: true });
            } catch (err) {
                try { if (main) main.scrollTop = 0; else document.documentElement.scrollTop = 0; } catch (e) {}
            }

            // Close menu/backdrop if open
            try {
                const hamburger = document.querySelector('.hamburger-btn');
                const menu = document.getElementById('main-menu');
                const backdrop = document.querySelector('.menu-backdrop');
                if (hamburger && hamburger.classList.contains('open')) {
                    hamburger.classList.remove('open');
                    hamburger.setAttribute('aria-expanded', 'false');
                }
                if (menu) {
                    menu.classList.remove('open');
                    try { menu.setAttribute('aria-hidden', 'true'); } catch (err) {}
                    try { menu.hidden = true; } catch (err) {}
                }
                if (backdrop) backdrop.classList.remove('visible');
            } catch (err) { /* ignore */ }
        } catch (err) { /* ignore */ }
    });
    // Page entry animation for a smooth transition on load
    try {
        document.body.classList.add('page-enter');
        document.body.classList.remove('page-exit');
        // remove disabled clicks flag if present
        document.body.classList.remove('body-disabled-clicks');
        requestAnimationFrame(() => {
            // Removing the class triggers the CSS transition animation to show the page
            document.body.classList.remove('page-enter');
            // ensure we don't keep pointer-events disabled
            setTimeout(() => { document.body.classList.remove('body-disabled-clicks'); }, 500);
        });
    } catch (err) {}
});

