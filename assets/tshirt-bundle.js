(function () {
  'use strict';

  /* ============================================================
   *  T-Shirt Bundle Builder
   *  Manages selection state, UI updates, variant picker modal,
   *  and cart submission
   * ============================================================ */

  const wrapper = document.querySelector('.tshirt-bundle');
  if (!wrapper) return;

  // ---------- Config from data attributes ----------
  const BUNDLE_SIZE = parseInt(wrapper.dataset.bundleSize, 10) || 3;
  const BUNDLE_PRICE_DISPLAY = wrapper.dataset.bundlePrice || '$75';
  const BUNDLE_PRICE_CENTS = parseInt(wrapper.dataset.bundlePriceCents, 10) || 7500;
  const PER_ITEM_CENTS = Math.round(BUNDLE_PRICE_CENTS / BUNDLE_SIZE);

  // ---------- State ----------
  /** @type {Array<{variantId: string, productId: string, title: string, image: string, thumb: string, price: number, comparePrice: number, variantTitle: string}>} */
  let selectedItems = [];

  // ---------- DOM refs ----------
  const bundleCount = document.getElementById('BundleCount');
  const bundleTotal = document.getElementById('BundleTotal');
  const bundleTotalCompare = document.getElementById('BundleTotalCompare');
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
  const mobileTotalCompareEls = document.querySelectorAll('.bundle-total-compare-mobile');
  const mobileSlotsContainer = document.getElementById('BundleMobileSlots');

  // Variant modal refs
  const variantModal = document.getElementById('BundleVariantModal');
  const variantBackdrop = document.getElementById('BundleVariantBackdrop');
  const variantCloseBtn = document.getElementById('BundleVariantClose');
  const variantImage = document.getElementById('BundleVariantImage');
  const variantTitle = document.getElementById('BundleVariantTitle');
  const variantPriceEl = document.getElementById('BundleVariantPrice');
  const variantOptionsContainer = document.getElementById('BundleVariantOptions');
  const variantConfirmBtn = document.getElementById('BundleVariantConfirm');
  const variantErrorEl = document.getElementById('BundleVariantError');

  // Product cards
  const cards = document.querySelectorAll('.bundle-card');

  // ---------- Helpers ----------
  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  // ============================================================
  //  VARIANT PICKER MODAL
  // ============================================================

  /** @type {HTMLElement|null} */
  let currentModalCard = null;
  /** @type {Array} */
  let currentVariants = [];
  /** @type {Array} */
  let currentOptions = [];
  /** @type {Object} */
  let currentSelections = {};

  function openVariantModal(card) {
    currentModalCard = card;

    // Parse product data
    try {
      currentVariants = JSON.parse('[' + card.dataset.productVariants + ']');
    } catch (e) {
      currentVariants = [];
    }
    try {
      currentOptions = JSON.parse(card.dataset.productOptions);
    } catch (e) {
      currentOptions = [];
    }

    // Reset selections
    currentSelections = {};

    // Populate modal
    if (variantImage) {
      variantImage.src = card.dataset.productImage;
      variantImage.alt = card.dataset.productTitle;
    }
    if (variantTitle) variantTitle.textContent = card.dataset.productTitle;
    if (variantPriceEl) variantPriceEl.textContent = formatMoney(parseInt(card.dataset.productPrice, 10));
    if (variantErrorEl) { variantErrorEl.style.display = 'none'; variantErrorEl.textContent = ''; }
    if (variantConfirmBtn) { variantConfirmBtn.disabled = true; variantConfirmBtn.textContent = 'Select options'; }

    // Build option groups
    renderOptionGroups();

    // Show modal
    if (variantModal) {
      variantModal.setAttribute('aria-hidden', 'false');
      variantModal.classList.add('bundle-variant-modal--open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeVariantModal() {
    if (variantModal) {
      variantModal.classList.remove('bundle-variant-modal--open');
      variantModal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
    currentModalCard = null;
    currentVariants = [];
    currentOptions = [];
    currentSelections = {};
  }

  function renderOptionGroups() {
    if (!variantOptionsContainer) return;
    variantOptionsContainer.innerHTML = '';

    currentOptions.forEach(function (optionName, optionIndex) {
      // Collect unique values for this option
      var values = [];
      var valueKey = 'option' + (optionIndex + 1);
      currentVariants.forEach(function (v) {
        var val = v[valueKey];
        if (val && values.indexOf(val) === -1) {
          values.push(val);
        }
      });

      // Skip "Default Title" option
      if (values.length === 1 && values[0] === 'Default Title') return;

      var group = document.createElement('div');
      group.className = 'bundle-variant-modal__option-group';

      var label = document.createElement('div');
      label.className = 'bundle-variant-modal__option-label';
      label.textContent = optionName;
      group.appendChild(label);

      var btnsWrap = document.createElement('div');
      btnsWrap.className = 'bundle-variant-modal__option-buttons';

      values.forEach(function (val) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bundle-variant-modal__option-btn';
        btn.textContent = val;
        btn.dataset.optionName = optionName;
        btn.dataset.optionValue = val;
        btn.dataset.optionIndex = optionIndex;

        // Check if any variant with this value is available
        var anyAvailable = currentVariants.some(function (v) {
          return v[valueKey] === val && v.available;
        });
        if (!anyAvailable) {
          btn.classList.add('bundle-variant-modal__option-btn--unavailable');
        }

        btn.addEventListener('click', function () {
          handleOptionClick(optionName, val, optionIndex, btnsWrap);
        });

        btnsWrap.appendChild(btn);
      });

      group.appendChild(btnsWrap);
      variantOptionsContainer.appendChild(group);

      // Auto-select the first available value
      var firstAvailableBtn = btnsWrap.querySelector('.bundle-variant-modal__option-btn:not(.bundle-variant-modal__option-btn--unavailable)');
      if (firstAvailableBtn) {
        firstAvailableBtn.click();
      }
    });
  }

  function handleOptionClick(optionName, value, optionIndex, btnsWrap) {
    // Update selection
    currentSelections[optionName] = value;

    // Update button active states in this group
    var buttons = btnsWrap.querySelectorAll('.bundle-variant-modal__option-btn');
    buttons.forEach(function (btn) {
      if (btn.dataset.optionValue === value) {
        btn.classList.add('bundle-variant-modal__option-btn--selected');
      } else {
        btn.classList.remove('bundle-variant-modal__option-btn--selected');
      }
    });

    // Immediately update image based on the option just clicked
    // (even if not all options are selected yet)
    var optionKey = 'option' + (optionIndex + 1);
    var matchForImage = currentVariants.find(function (v) {
      return v[optionKey] === value && v.image;
    });
    if (matchForImage && matchForImage.image && variantImage) {
      variantImage.src = matchForImage.image;
    }

    // Try to find matching variant
    var matchedVariant = findMatchingVariant();

    if (matchedVariant) {
      // Update image if variant has its own
      if (matchedVariant.image && variantImage) {
        variantImage.src = matchedVariant.image;
      }
      // Update price
      if (variantPriceEl) {
        variantPriceEl.textContent = formatMoney(matchedVariant.price);
      }

      if (!matchedVariant.available) {
        if (variantConfirmBtn) { variantConfirmBtn.disabled = true; variantConfirmBtn.textContent = 'Sold Out'; }
        if (variantErrorEl) { variantErrorEl.textContent = 'This combination is sold out.'; variantErrorEl.style.display = ''; }
      } else {
        // Check if already in bundle
        var alreadyInBundle = selectedItems.some(function (item) { return item.variantId === String(matchedVariant.id); });
        if (alreadyInBundle) {
          if (variantConfirmBtn) { variantConfirmBtn.disabled = true; variantConfirmBtn.textContent = 'Already in Bundle'; }
          if (variantErrorEl) { variantErrorEl.textContent = 'This item is already in your bundle.'; variantErrorEl.style.display = ''; }
        } else {
          if (variantConfirmBtn) { variantConfirmBtn.disabled = false; variantConfirmBtn.textContent = 'Add to Bundle'; variantConfirmBtn.classList.add('bundle-cta--ready'); }
          if (variantErrorEl) { variantErrorEl.style.display = 'none'; variantErrorEl.textContent = ''; }
        }
      }
    } else {
      // Not all options selected yet
      var totalOptions = currentOptions.filter(function (o, i) {
        // Skip Default Title options
        var key = 'option' + (i + 1);
        var vals = currentVariants.map(function (v) { return v[key]; });
        var unique = vals.filter(function (val, idx) { return vals.indexOf(val) === idx; });
        return !(unique.length === 1 && unique[0] === 'Default Title');
      });
      var selectedCount = Object.keys(currentSelections).length;
      if (selectedCount < totalOptions.length) {
        if (variantConfirmBtn) { variantConfirmBtn.disabled = true; variantConfirmBtn.textContent = 'Select options'; variantConfirmBtn.classList.remove('bundle-cta--ready'); }
      }
      if (variantErrorEl) { variantErrorEl.style.display = 'none'; }
    }
  }

  function findMatchingVariant() {
    // Need all non-default options to be selected
    var requiredOptions = [];
    currentOptions.forEach(function (optionName, i) {
      var key = 'option' + (i + 1);
      var vals = currentVariants.map(function (v) { return v[key]; });
      var unique = vals.filter(function (val, idx) { return vals.indexOf(val) === idx; });
      if (!(unique.length === 1 && unique[0] === 'Default Title')) {
        requiredOptions.push({ name: optionName, key: key });
      }
    });

    // Check all required options are selected
    for (var r = 0; r < requiredOptions.length; r++) {
      if (!currentSelections[requiredOptions[r].name]) return null;
    }

    // Find variant matching all selections
    return currentVariants.find(function (v) {
      return requiredOptions.every(function (opt) {
        return v[opt.key] === currentSelections[opt.name];
      });
    }) || null;
  }

  function confirmVariantSelection() {
    var matchedVariant = findMatchingVariant();
    if (!matchedVariant || !matchedVariant.available) return;
    if (selectedItems.length >= BUNDLE_SIZE) return;

    // Check duplicate
    if (selectedItems.some(function (item) { return item.variantId === String(matchedVariant.id); })) return;

    var card = currentModalCard;
    var variantTitleText = matchedVariant.title || '';
    var displayTitle = card.dataset.productTitle;
    if (variantTitleText && variantTitleText !== 'Default Title') {
      displayTitle = card.dataset.productTitle + ' - ' + variantTitleText;
    }

    // Use variant image if available, otherwise fall back to product image
    var itemImage = matchedVariant.image || card.dataset.productImage;
    var itemThumb = matchedVariant.thumb || card.dataset.productThumb;

    selectedItems.push({
      variantId: String(matchedVariant.id),
      productId: card.dataset.productId,
      title: displayTitle,
      image: itemImage,
      thumb: itemThumb,
      price: matchedVariant.price,
      comparePrice: matchedVariant.compare_at_price || 0,
      variantTitle: variantTitleText
    });

    closeVariantModal();
    updateUI();
  }

  // ---------- Core: Add to Bundle (updated for variants) ----------
  function addToBundle(card) {
    if (selectedItems.length >= BUNDLE_SIZE) return;

    var variantCount = parseInt(card.dataset.variantCount, 10) || 1;

    if (variantCount > 1) {
      // Multi-variant product: show the variant picker modal
      openVariantModal(card);
    } else {
      // Single variant: add directly
      var variantId = card.dataset.variantId;

      // Prevent duplicate
      if (selectedItems.find(function (item) { return item.variantId === variantId; })) return;

      selectedItems.push({
        variantId: variantId,
        productId: card.dataset.productId,
        title: card.dataset.productTitle,
        image: card.dataset.productImage,
        thumb: card.dataset.productThumb,
        price: parseInt(card.dataset.productPrice, 10),
        comparePrice: parseInt(card.dataset.comparePrice, 10) || 0,
        variantTitle: ''
      });

      updateUI();
    }
  }

  // ---------- Core: Remove from Bundle ----------
  function removeFromBundle(index) {
    if (index < 0 || index >= selectedItems.length) return;
    selectedItems.splice(index, 1);
    updateUI();
  }

  // ---------- UI Update ----------
  function updateUI() {
    var count = selectedItems.length;
    var remaining = BUNDLE_SIZE - count;
    var isFull = count >= BUNDLE_SIZE;

    // --- Count text ---
    if (bundleCount) bundleCount.textContent = count;
    mobileCountEls.forEach(function (el) { el.textContent = count; });

    // --- Total ---
    var totalCents = isFull ? BUNDLE_PRICE_CENTS : count * PER_ITEM_CENTS;
    var totalStr = formatMoney(totalCents);
    if (bundleTotal) bundleTotal.textContent = totalStr;
    mobileTotalEls.forEach(function (el) { el.textContent = totalStr; });

    // --- Compare-at total (sum of original prices) ---
    var compareTotalCents = selectedItems.reduce(function (sum, item) {
      return sum + (item.comparePrice > 0 ? item.comparePrice : item.price);
    }, 0);
    var compareStr = count > 0 ? formatMoney(compareTotalCents) : '';
    var showCompare = count > 0 && compareTotalCents > totalCents;
    if (bundleTotalCompare) {
      bundleTotalCompare.textContent = showCompare ? compareStr : '';
    }
    mobileTotalCompareEls.forEach(function (el) {
      el.textContent = showCompare ? compareStr : '';
    });

    // --- CTA buttons ---
    updateCTAButton(bundleCTA, isFull, remaining);
    updateCTAButton(mobileCTA, isFull, remaining);

    // --- Progress bars ---
    updateProgress(bundleProgress, count);
    updateProgress(mobileProgressEl, count);

    // --- Selection slots ---
    updateSlots();

    // --- Card states ---
    cards.forEach(function (card) {
      var productId = card.dataset.productId;
      // A card is "selected" if any variant of that product is in the bundle
      var isSelected = selectedItems.some(function (item) { return item.productId === productId; });
      var addBtn = card.querySelector('.bundle-card__add-btn');
      var qtyWrap = card.querySelector('.bundle-card__qty-wrap');

      if (isSelected) {
        card.classList.add('bundle-card--selected');
        if (addBtn) addBtn.style.display = 'none';
        if (qtyWrap) qtyWrap.style.display = 'flex';
        // Disable the "Add" qty button when bundle is full
        var qtyAddBtn = card.querySelector('.bundle-card__qty-add');
        if (qtyAddBtn) {
          qtyAddBtn.disabled = isFull;
          qtyAddBtn.textContent = isFull ? 'Full' : 'Add';
        }
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

    var steps = container.querySelectorAll('.bundle-progress__step');
    steps.forEach(function (step, i) {
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

    var bars = container.querySelectorAll('.bundle-progress__bar-fill');
    bars.forEach(function (bar, i) {
      bar.style.width = i < count ? '100%' : '0%';
    });
  }

  function updateSlotsInContainer(container) {
    if (!container) return;
    var slots = container.querySelectorAll('.bundle-slot');

    slots.forEach(function (slot, i) {
      var emptyEl = slot.querySelector('.bundle-slot__empty');
      var filledEl = slot.querySelector('.bundle-slot__filled');

      if (i < selectedItems.length) {
        var item = selectedItems[i];
        emptyEl.style.display = 'none';
        filledEl.style.display = 'flex';

        var img = filledEl.querySelector('.bundle-slot__image');
        if (img) {
          img.src = item.thumb;
          img.alt = item.title;
        }

        var nameEl = filledEl.querySelector('.bundle-slot__name');
        if (nameEl) nameEl.textContent = item.title;

        var priceEl = filledEl.querySelector('.bundle-slot__price');
        if (priceEl) priceEl.textContent = formatMoney(PER_ITEM_CENTS);

        var compareEl = filledEl.querySelector('.bundle-slot__compare');
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

    var ctaButtons = [bundleCTA, mobileCTA].filter(Boolean);
    ctaButtons.forEach(function (btn) {
      btn.disabled = true;
      btn.textContent = 'Adding...';
    });

    try {
      var response = await fetch(
        (window.Theme ? Theme.routes.root : '/') + 'cart/add.js',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            items: selectedItems.map(function (item) {
              return {
                id: parseInt(item.variantId, 10),
                quantity: 1,
                properties: {
                  _bundle_id: 'tshirt-bundle'
                }
              };
            })
          })
        }
      );

      var data = await response.json();

      if (data.status && data.status === 422) {
        alert(data.message || 'Could not add items to cart. Please try again.');
        ctaButtons.forEach(function (btn) {
          btn.disabled = false;
          btn.textContent = 'Add to Cart';
        });
        return;
      }

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

      ctaButtons.forEach(function (btn) {
        btn.textContent = 'Added! Redirecting...';
      });

      setTimeout(function () {
        window.location.href = (window.Theme ? Theme.routes.cart_url : '/cart');
      }, 800);

    } catch (err) {
      console.error('Bundle add to cart error:', err);
      alert('Something went wrong. Please try again.');
      ctaButtons.forEach(function (btn) {
        btn.disabled = false;
        btn.textContent = 'Add to Cart';
      });
    }
  }

  // ---------- Event Listeners ----------

  // Product card "Add to Bundle" buttons
  cards.forEach(function (card) {
    var addBtn = card.querySelector('.bundle-card__add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        addToBundle(card);
      });
    }

    // Quantity minus button (removes from bundle)
    var minusBtn = card.querySelector('.bundle-card__qty-minus');
    if (minusBtn) {
      minusBtn.addEventListener('click', function () {
        var productId = card.dataset.productId;
        var idx = selectedItems.findIndex(function (item) { return item.productId === productId; });
        if (idx !== -1) removeFromBundle(idx);
      });
    }

    // Quantity add button
    var qtyAddBtn = card.querySelector('.bundle-card__qty-add');
    if (qtyAddBtn) {
      qtyAddBtn.addEventListener('click', function () {
        // Could be extended for multi-quantity per item
      });
    }
  });

  // Slot remove buttons (desktop + mobile)
  [bundleSlots, mobileSlotsContainer].forEach(function (container) {
    if (!container) return;
    container.addEventListener('click', function (e) {
      var removeBtn = e.target.closest('.bundle-slot__remove');
      if (!removeBtn) return;
      var slotIndex = parseInt(removeBtn.dataset.slotIndex, 10) - 1;
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
      var expanded = mobileToggle.getAttribute('aria-expanded') === 'true';
      mobileToggle.setAttribute('aria-expanded', !expanded);
      if (mobileBar) mobileBar.classList.toggle('bundle-mobile-bar--expanded');
    });
  }

  // Variant modal events
  if (variantBackdrop) {
    variantBackdrop.addEventListener('click', closeVariantModal);
  }
  if (variantCloseBtn) {
    variantCloseBtn.addEventListener('click', closeVariantModal);
  }
  if (variantConfirmBtn) {
    variantConfirmBtn.addEventListener('click', confirmVariantSelection);
  }
  // Close on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && variantModal && variantModal.classList.contains('bundle-variant-modal--open')) {
      closeVariantModal();
    }
  });

  // ---------- Initialize ----------
  updateUI();
})();
