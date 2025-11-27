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
        this.style.animation = 'none';
        setTimeout(() => {
            this.style.animation = 'springAnimation 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
        }, 10);
        console.log('Added to cart!');
    });
});

// Small cart button inside price pill
const cartSmallBtns = document.querySelectorAll('.cart-small-btn');
cartSmallBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        this.style.animation = 'none';
        setTimeout(() => {
            this.style.animation = 'springAnimation 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        }, 10);
        console.log('Small add to cart');
    });
});

// Favorite toggles
const favButtons = document.querySelectorAll('.fav-btn');
favButtons.forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        this.classList.toggle('active');
        console.log('Toggled favorite');
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
        console.log('Searching for:', e.target.value);
    });
    
    searchInput.addEventListener('focus', function() {
        this.style.boxShadow = '0 0 0 3px rgba(45, 134, 89, 0.15)';
    });
    
    searchInput.addEventListener('blur', function() {
        this.style.boxShadow = 'none';
    });
}

// Buy Now button functionality
const buyNowBtn = document.querySelector('.buy-now-btn');
if (buyNowBtn) {
    buyNowBtn.addEventListener('click', function() {
        console.log('Buy now clicked!');
    });
}

// Filter button functionality
const filterBtn = document.querySelector('.filter-btn');
if (filterBtn) {
    filterBtn.addEventListener('click', function() {
        console.log('Filter clicked!');
    });
}

// Add spring animation keyframes dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes springAnimation {
        0% {
            transform: scale(1);
        }
        50% {
            transform: scale(0.9);
        }
        100% {
            transform: scale(1);
        }
    }
`;
document.head.appendChild(style);

// Enhance scroll behavior
const mainContent = document.querySelector('.main-content');
if (mainContent) {
    mainContent.addEventListener('scroll', function() {
        // Add subtle effects on scroll if needed
    });
}

// Responsive adjustments
window.addEventListener('resize', function() {
    // Handle responsive changes
});

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
    console.log('Fashion Store loaded successfully!');
});

