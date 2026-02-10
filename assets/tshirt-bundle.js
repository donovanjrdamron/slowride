(function () {
  'use strict';

  /* ============================================================
   *  T-Shirt Bundle Builder
   *  Manages selection state, UI updates, and cart submission
   * ============================================================ */

  const wrapper = document.querySelector('.tshirt-bundle');
  if (!wrapper) return;

  // ---------- Config from data attributes ----------
  const BUNDLE_SIZE = parseInt(wrapper.dataset.bundleSize, 10) || 3;
  const BUNDLE_PRICE_DISPLAY = wrapper.dataset.bundlePrice || '$75';
  const BUNDLE_PRICE_CENTS = parseInt(wrapper.dataset.bundlePriceCents, 10) || 7500;
  const PER_ITEM_CENTS = Math.round(BUNDLE_PRICE_CENTS / BUNDLE_SIZE);

  // ---------- State ----------
  /** @type {Array<{variantId: string, productId: string, title: string, image: string, thumb: string, price: number, comparePrice: number}>} */
  let selectedItems = [];

  // ---------- DOM refs ----------
  const bundleCount = document.getElementById('BundleCount');
  const bundleTotal = document.getElementById('BundleTotal');
  const bundleCTA = document.getElementById('BundleCTA');
  const bundleSlots = document.getElementById('BundleSlots');
  const bundleProgress = document.getElementById('BundleProgress');

  // Mobile refs
  const mobileBar = document.getElementById('BundleMobileBar');
  const mobileToggle = document.getElementById('BundleMobileToggle');
  const mobileCTA = document.getElementById('BundleCTAMobile');
  const mobileProgressEl = document.getElementById('BundleProgressMobile');
  const mobileCountEls = document.querySelectorAll('.bundle-count-mobile');
  const mobileTotalEls = document.querySelectorAll('.bundle-total-mobile');
  const mobileSlotsContainer = document.getElementById('BundleMobileSlots');

  // Product cards
  const cards = document.querySelectorAll('.bundle-card');

  // ---------- Helpers ----------
  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  // ---------- Core: Add to Bundle ----------
  function addToBundle(card) {
    if (selectedItems.length >= BUNDLE_SIZE) return;

    const variantId = card.dataset.variantId;

    // Prevent duplicate
    if (selectedItems.find(item => item.variantId === variantId)) return;

    selectedItems.push({
      variantId: variantId,
      productId: card.dataset.productId,
      title: card.dataset.productTitle,
      image: card.dataset.productImage,
      thumb: card.dataset.productThumb,
      price: parseInt(card.dataset.productPrice, 10),
      comparePrice: parseInt(card.dataset.comparePrice, 10) || 0
    });

    updateUI();
  }

  // ---------- Core: Remove from Bundle ----------
  function removeFromBundle(index) {
    if (index < 0 || index >= selectedItems.length) return;
    selectedItems.splice(index, 1);
    updateUI();
  }

  // ---------- UI Update ----------
  function updateUI() {
    const count = selectedItems.length;
    const remaining = BUNDLE_SIZE - count;
    const isFull = count >= BUNDLE_SIZE;

    // --- Count text ---
    if (bundleCount) bundleCount.textContent = count;
    mobileCountEls.forEach(el => { el.textContent = count; });

    // --- Total ---
    const totalCents = isFull ? BUNDLE_PRICE_CENTS : count * PER_ITEM_CENTS;
    const totalStr = formatMoney(totalCents);
    if (bundleTotal) bundleTotal.textContent = totalStr;
    mobileTotalEls.forEach(el => { el.textContent = totalStr; });

    // --- CTA buttons ---
    updateCTAButton(bundleCTA, isFull, remaining);
    updateCTAButton(mobileCTA, isFull, remaining);

    // --- Progress bars ---
    updateProgress(bundleProgress, count);
    updateProgress(mobileProgressEl, count);

    // --- Selection slots ---
    updateSlots();

    // --- Card states ---
    cards.forEach(card => {
      const vid = card.dataset.variantId;
      const isSelected = selectedItems.some(item => item.variantId === vid);
      const addBtn = card.querySelector('.bundle-card__add-btn');
      const qtyWrap = card.querySelector('.bundle-card__qty-wrap');

      if (isSelected) {
        card.classList.add('bundle-card--selected');
        if (addBtn) addBtn.style.display = 'none';
        if (qtyWrap) qtyWrap.style.display = 'flex';
      } else {
        card.classList.remove('bundle-card--selected');
        if (addBtn) {
          addBtn.style.display = '';
          addBtn.disabled = isFull;
          addBtn.textContent = isFull ? 'Bundle Full' : 'Add to Bundle';
        }
        if (qtyWrap) qtyWrap.style.display = 'none';
      }
    });
  }

  function updateCTAButton(btn, isFull, remaining) {
    if (!btn) return;
    if (isFull) {
      btn.disabled = false;
      btn.textContent = 'Add to Cart';
      btn.classList.add('bundle-cta--ready');
    } else {
      btn.disabled = true;
      btn.textContent = remaining === BUNDLE_SIZE ? 'Add ' + BUNDLE_SIZE + ' more' : 'Add ' + remaining + ' more';
      btn.classList.remove('bundle-cta--ready');
    }
  }

  function updateProgress(container, count) {
    if (!container) return;

    // Steps
    const steps = container.querySelectorAll('.bundle-progress__step');
    steps.forEach((step, i) => {
      if (i < count) {
        step.classList.add('bundle-progress__step--active');
        step.classList.remove('bundle-progress__step--current');
      } else if (i === count) {
        step.classList.add('bundle-progress__step--current');
        step.classList.remove('bundle-progress__step--active');
      } else {
        step.classList.remove('bundle-progress__step--active', 'bundle-progress__step--current');
      }
    });

    // Bars: fill bars up to the current count
    const bars = container.querySelectorAll('.bundle-progress__bar-fill');
    bars.forEach((bar, i) => {
      bar.style.width = i < count ? '100%' : '0%';
    });
  }

  function updateSlotsInContainer(container) {
    if (!container) return;
    const slots = container.querySelectorAll('.bundle-slot');

    slots.forEach((slot, i) => {
      const emptyEl = slot.querySelector('.bundle-slot__empty');
      const filledEl = slot.querySelector('.bundle-slot__filled');

      if (i < selectedItems.length) {
        const item = selectedItems[i];
        emptyEl.style.display = 'none';
        filledEl.style.display = 'flex';

        const img = filledEl.querySelector('.bundle-slot__image');
        if (img) {
          img.src = item.thumb;
          img.alt = item.title;
        }

        const nameEl = filledEl.querySelector('.bundle-slot__name');
        if (nameEl) nameEl.textContent = item.title;

        const priceEl = filledEl.querySelector('.bundle-slot__price');
        if (priceEl) priceEl.textContent = formatMoney(PER_ITEM_CENTS);

        const compareEl = filledEl.querySelector('.bundle-slot__compare');
        if (compareEl && item.comparePrice > 0) {
          compareEl.textContent = formatMoney(item.comparePrice);
          compareEl.style.display = '';
        }
      } else {
        emptyEl.style.display = 'flex';
        filledEl.style.display = 'none';
      }
    });
  }

  function updateSlots() {
    updateSlotsInContainer(bundleSlots);
    updateSlotsInContainer(mobileSlotsContainer);
  }

  // ---------- Cart Submission ----------
  async function submitBundle() {
    if (selectedItems.length < BUNDLE_SIZE) return;

    const ctaButtons = [bundleCTA, mobileCTA].filter(Boolean);
    ctaButtons.forEach(btn => {
      btn.disabled = true;
      btn.textContent = 'Adding...';
    });

    try {
      const response = await fetch(
        (window.Theme ? Theme.routes.root : '/') + 'cart/add.js',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            items: selectedItems.map(item => ({
              id: parseInt(item.variantId, 10),
              quantity: 1,
              properties: {
                _bundle_id: 'tshirt-bundle'
              }
            }))
          })
        }
      );

      const data = await response.json();

      if (data.status && data.status === 422) {
        // Error from Shopify
        alert(data.message || 'Could not add items to cart. Please try again.');
        ctaButtons.forEach(btn => {
          btn.disabled = false;
          btn.textContent = 'Add to Cart';
        });
        return;
      }

      // Success - dispatch theme cart event to update cart icon / drawer
      try {
        window.dispatchEvent(new CustomEvent('cart:update', {
          bubbles: true,
          detail: {
            resource: data,
            sourceId: 'tshirt-bundle',
            data: {
              source: 'tshirt-bundle',
              itemCount: selectedItems.length
            }
          }
        }));
      } catch (e) {
        // Event dispatch is non-critical
      }

      // Show success state briefly then redirect to cart
      ctaButtons.forEach(btn => {
        btn.textContent = 'Added! Redirecting...';
      });

      setTimeout(function () {
        window.location.href = (window.Theme ? Theme.routes.cart_url : '/cart');
      }, 800);

    } catch (err) {
      console.error('Bundle add to cart error:', err);
      alert('Something went wrong. Please try again.');
      ctaButtons.forEach(btn => {
        btn.disabled = false;
        btn.textContent = 'Add to Cart';
      });
    }
  }

  // ---------- Event Listeners ----------

  // Product card "Add to Bundle" buttons
  cards.forEach(card => {
    const addBtn = card.querySelector('.bundle-card__add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        addToBundle(card);
      });
    }

    // Quantity minus button (removes from bundle)
    const minusBtn = card.querySelector('.bundle-card__qty-minus');
    if (minusBtn) {
      minusBtn.addEventListener('click', function () {
        const vid = card.dataset.variantId;
        const idx = selectedItems.findIndex(item => item.variantId === vid);
        if (idx !== -1) removeFromBundle(idx);
      });
    }

    // Quantity add button (currently acts same as add to bundle)
    const qtyAddBtn = card.querySelector('.bundle-card__qty-add');
    if (qtyAddBtn) {
      qtyAddBtn.addEventListener('click', function () {
        // Item is already added; this button is mostly visual
        // Could be extended for multi-quantity per item
      });
    }
  });

  // Slot remove buttons (desktop + mobile)
  [bundleSlots, mobileSlotsContainer].forEach(function (container) {
    if (!container) return;
    container.addEventListener('click', function (e) {
      const removeBtn = e.target.closest('.bundle-slot__remove');
      if (!removeBtn) return;
      const slotIndex = parseInt(removeBtn.dataset.slotIndex, 10) - 1;
      if (slotIndex >= 0 && slotIndex < selectedItems.length) {
        removeFromBundle(slotIndex);
      }
    });
  });

  // CTA buttons
  if (bundleCTA) {
    bundleCTA.addEventListener('click', function () {
      if (selectedItems.length >= BUNDLE_SIZE) submitBundle();
    });
  }
  if (mobileCTA) {
    mobileCTA.addEventListener('click', function () {
      if (selectedItems.length >= BUNDLE_SIZE) submitBundle();
    });
  }

  // Mobile toggle
  if (mobileToggle) {
    mobileToggle.addEventListener('click', function () {
      const expanded = mobileToggle.getAttribute('aria-expanded') === 'true';
      mobileToggle.setAttribute('aria-expanded', !expanded);
      if (mobileBar) mobileBar.classList.toggle('bundle-mobile-bar--expanded');
    });
  }

  // ---------- Initialize ----------
  updateUI();
})();
