// Category button functionality
const categoryButtons = document.querySelectorAll('.category-btn');
categoryButtons.forEach(button => {
    button.addEventListener('click', function() {
        categoryButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
    });
});

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

// Cart button functionality with spring animation
const cartButtons = document.querySelectorAll('.card-btn');
cartButtons.forEach(button => {
    button.addEventListener('click', function(e) {
        e.stopPropagation();
        // toggle animation class to run CSS-based spring animation
        this.classList.remove('spring-anim');
        // Force reflow to restart the animation
        void this.offsetWidth;
        this.classList.add('spring-anim');
        // cart added - no-op in production
    });
});

// Small cart button inside price pill
const cartSmallBtns = document.querySelectorAll('.cart-small-btn');
cartSmallBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        // toggle smaller spring animation class
        this.classList.remove('spring-anim-small');
        void this.offsetWidth;
        this.classList.add('spring-anim-small');
        // small add to cart - no-op in production
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

// Scroll card into center when clicked
const collectionCards = document.querySelectorAll('.collection-card');
collectionCards.forEach(card => {
    card.addEventListener('click', function() {
        if (this.scrollIntoView) {
            this.scrollIntoView({behavior: 'smooth', inline: 'center', block: 'nearest'});
        }
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
        // buy now clicked - no-op in production
    });
}

// Filter button functionality
const filterBtn = document.querySelector('.filter-btn');
if (filterBtn) {
    filterBtn.addEventListener('click', function() {
        // filter clicked - no-op in production
    });
}

// spring animation keyframes moved to CSS for better performance

// No scroll/resize listeners to keep runtime cost low

// Initial setup
document.addEventListener('DOMContentLoaded', function() {
    // Ensure Home (first nav button) is active by default on page load/refresh
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
    // Fashion Store loaded
    // Convert USD prices to NGN at a fixed rate (300 NGN per 1 USD)
    const USD_TO_NGN = 300;
    const ngnFormatter = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

    function parseUsdFromString(text) {
        if (!text) return null;
        // remove commas and non-dot/digits (support decimals), then parse
        const cleaned = text.replace(/,/g, '').replace(/[^(\d|\.)-]/g, '');
        const matched = cleaned.match(/-?\d+(?:\.\d+)?/);
        return matched ? parseFloat(matched[0]) : null;
    }

    function convertToNgn(usdAmount) {
        if (typeof usdAmount !== 'number' || isNaN(usdAmount)) return null;
        return Math.round(usdAmount * USD_TO_NGN);
    }

    function convertAllPrices(rate = USD_TO_NGN) {
        const priceEls = document.querySelectorAll('.price-text, .price');
        priceEls.forEach(el => {
            // Preserve original USD if not already stored
            if (!el.dataset.usd) {
                const usd = parseUsdFromString(el.textContent || el.innerText);
                if (usd === null) return; // skip if cannot parse
                el.dataset.usd = usd;
            }
            const usdVal = parseFloat(el.dataset.usd);
            if (isNaN(usdVal)) return;
            const ngn = Math.round(usdVal * rate);
            el.dataset.ngn = ngn;
            // Format as NGN currency for display
            el.textContent = ngnFormatter.format(ngn);
        });
    }

    // Run conversion on load
    convertAllPrices(USD_TO_NGN);

    // Ensure the first collection card is visible on initial load (not sticky — all cards scroll naturally)
    const collectionsRow = document.querySelector('.collections-row');
    if (collectionsRow) {
        // Set scroll to leftmost content — keep the first card visible
        try {
            collectionsRow.scrollTo({ left: 0, behavior: 'auto' });
        } catch (e) {
            // fallback for older browsers
            collectionsRow.scrollLeft = 0;
        }
        const firstCard = collectionsRow.querySelector('.collection-card');
        if (firstCard && firstCard.scrollIntoView) {
            firstCard.scrollIntoView({ behavior: 'auto', inline: 'start', block: 'nearest' });
        }
    }
});

