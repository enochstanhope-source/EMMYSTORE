// dynamic.js - render product details from localStorage (key: selectedProduct)
document.addEventListener('DOMContentLoaded', function() {
	// Simplified entry: no animations. Make product page visible immediately.
	try {
		const el = document.querySelector('.product-page');
		if (el) {
			el.style.opacity = '1';
			el.style.transform = 'none';
		}
	} catch (e) {}
	const raw = localStorage.getItem('selectedProduct');
	const data = raw ? JSON.parse(raw) : null;

	const titleEl = document.querySelector('.product-title');
	const priceEl = document.querySelector('.price-text');
	const mainImg = document.querySelector('.main-image');
	const descEl = document.querySelector('.product-desc');
	const ratingValEl = document.querySelector('.rating-value');
	const reviewsEl = document.querySelector('.reviews-count');
	const thumbsWrapper = document.querySelector('.thumbs');
	const sizesWrap = document.querySelector('.sizes');
	const colorsWrap = document.querySelector('.colors');
	const favBtn = document.querySelector('.fav-btn');
	const addCartBtn = document.querySelector('.add-cart-btn');
	const buyNowBtn = document.querySelector('.buy-now-btn');
	const closeBtn = document.querySelector('.close-btn');

	// Redirect to index if no product found
	if (!data) {
		// show fallback and wait for 500ms then go back
		if (titleEl) titleEl.textContent = 'No product selected';
		setTimeout(() => { window.location.href = 'EMMYSTORE-main/index.html'; }, 900);
		return;
	}

	// Fill main data
	document.title = (data.title ? data.title + ' — ' : '') + 'EMMY APPAREL';
	if (titleEl) titleEl.textContent = data.title || 'Product';
	if (priceEl) priceEl.textContent = data.priceText || '—';
	if (mainImg) {
		mainImg.src = data.image || 'EMMYSTORE-main/images/jackbrown.jpg';
		mainImg.alt = data.imageAlt || data.title || 'Product';
	}
	if (descEl) descEl.textContent = data.description || '—';
	if (ratingValEl) ratingValEl.textContent = data.rating || '';
	// Ensure stars element is present and styled
	try {
		const stars = document.querySelector('.stars');
		if (stars) {
			stars.textContent = '★★★★★';
			stars.classList.add('stars--active');
		}
	} catch (e) {}
	if (reviewsEl) reviewsEl.textContent = data.reviews || '';

	// Make thumbnail components
	const thumbs = data.images || [data.image];
	thumbsWrapper.innerHTML = '';
	thumbs.forEach((src, idx) => {
		const b = document.createElement('button');
		b.type = 'button';
		b.className = 'thumb';
		const img = document.createElement('img');
		img.src = src || data.image;
		img.alt = data.imageAlt || data.title || 'Thumb';
		b.appendChild(img);
		b.addEventListener('click', function() {
			document.querySelectorAll('.thumb.active').forEach(t => t.classList.remove('active'));
			this.classList.add('active');
			if (mainImg) mainImg.src = src || data.image;
			// Ensure stars are present and properly colored whenever image changes
			try { const stars = document.querySelector('.stars'); if (stars) stars.classList.add('stars--active'); } catch(e){}
		});
		if (idx === 0) b.classList.add('active');
		thumbsWrapper.appendChild(b);
	});

	// Sizes - make sure only one size selectable; default to first if none selected
	sizesWrap.innerHTML = '';
	const sizes = data.sizes || ['S','M','L','XL'];
	let selectedSize = null;
	sizes.forEach((s, idx) => {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'size-btn';
		btn.textContent = s;
		btn.addEventListener('click', function() {
			sizesWrap.querySelectorAll('button').forEach(b => b.classList.remove('active'));
			btn.classList.add('active');
			selectedSize = s;
		});
		if (idx === 0) { btn.classList.add('active'); selectedSize = s; }
		sizesWrap.appendChild(btn);
	});

	// Colors - single selection; default to first color
	colorsWrap.innerHTML = '';
	const colors = data.colors || ['#e9e3d7', '#f4d2a3', '#ddd'];
	let selectedColor = null;
	// If color count matches image count, map colors to images (optional)
	const colorImageMap = {};
	if (colors && thumbs && thumbs.length && colors.length === thumbs.length) {
		colors.forEach((c, idx) => { colorImageMap[c] = thumbs[idx]; });
	}
	colors.forEach((c, idx) => {
		const s = document.createElement('div');
		s.className = 'color-swatch';
		s.style.background = c;
		s.setAttribute('role','button');
		s.setAttribute('tabindex','0');
		s.setAttribute('aria-pressed', 'false');
		function selectColor() {
			colorsWrap.querySelectorAll('.color-swatch').forEach(el => { el.classList.remove('active'); el.setAttribute('aria-pressed','false'); });
			s.classList.add('active');
			s.setAttribute('aria-pressed','true');
			selectedColor = c;
			// If there is an image mapped to this color, use it as the main image
			try { if (colorImageMap[c] && mainImg) mainImg.src = colorImageMap[c]; } catch(e){}
		}
		s.addEventListener('click', selectColor);
		s.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectColor(); } });
		if (idx === 0) { s.classList.add('active'); selectedColor = c; s.setAttribute('aria-pressed','true'); }
		colorsWrap.appendChild(s);
	});

	// Favorite toggles
	if (favBtn) favBtn.addEventListener('click', function() { this.classList.toggle('active'); });

	function addToCartEvent() {
		try {
			const cartRaw = localStorage.getItem('cart') || '[]';
			const c = JSON.parse(cartRaw);
			const priceNum = parseFloat((data.priceText || '').replace(/[^0-9\.]/g, '')) || 0;
			// include selected size and color in the cart item key
			const itemKey = `${data.id}::${selectedSize || ''}::${selectedColor || ''}`;
			const found = c.find(i => i.key === itemKey);
			if (found) found.qty = (found.qty || 0) + 1;
			else c.push({ key: itemKey, id: data.id, title: data.title, price: priceNum, qty: 1, size: selectedSize, color: selectedColor, image: mainImg ? mainImg.src : data.image });
			localStorage.setItem('cart', JSON.stringify(c));
			// tiny UI feedback
			try {
				const toast = document.createElement('div');
				toast.className = 'cart-toast';
				// include title and a small image preview (3 copies) in the toast
				const imgWrap = document.createElement('div'); imgWrap.className = 'cart-toast-images';
				const imgSrc = mainImg ? mainImg.src : data.image;
				for (let i=0;i<3;i++){
					const ti = document.createElement('img'); ti.className = 'cart-toast-img'; ti.src = imgSrc; ti.alt = data.title; imgWrap.appendChild(ti);
				}
				const details = document.createElement('div'); details.className='cart-toast-details';
				const txt = document.createElement('div'); txt.className = 'cart-toast-text'; txt.textContent = `${data.title} added to cart`;
				// show selected size & color visually
				const meta = document.createElement('div'); meta.className = 'cart-toast-meta';
				if (selectedSize) { const sizeSpan = document.createElement('span'); sizeSpan.className='cart-toast-size'; sizeSpan.textContent = `Size: ${selectedSize}`; meta.appendChild(sizeSpan); }
				if (selectedColor) { const colorSw = document.createElement('span'); colorSw.className='cart-toast-color'; colorSw.setAttribute('role','img'); colorSw.setAttribute('aria-label', `Selected color ${selectedColor}`); colorSw.style.background = selectedColor; meta.appendChild(colorSw); }
				details.appendChild(txt); details.appendChild(meta);
				toast.appendChild(imgWrap);
				toast.appendChild(details);
				document.body.appendChild(toast);
				setTimeout(() => toast.classList.add('visible'), 10);
				setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 200); }, 2000);
			} catch (e) {}
		} catch (err) { console.warn('add to cart', err); }
	}
	if (addCartBtn) addCartBtn.addEventListener('click', addToCartEvent);
	if (buyNowBtn) buyNowBtn.addEventListener('click', function() { addToCartEvent(); alert(`Buy now: ${data.title} — ${data.priceText}`); });

	// Close -> immediate back navigation with no animations or delays
	if (closeBtn) closeBtn.addEventListener('click', function() {
		try { if (history.length > 1) history.back(); else window.location.href = 'EMMYSTORE-main/index.html'; } catch (e) { window.location.href = 'EMMYSTORE-main/index.html'; }
	});
});

