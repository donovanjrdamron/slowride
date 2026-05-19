(function () {
  'use strict';

  const instances = Array.from(document.querySelectorAll('[data-bundle-progress]'));
  if (!instances.length) return;

  const BUNDLE_MAX = 3;

  function formatMoney(cents) {
    const fmt = (window.Shopify && Shopify.formatMoney) ? Shopify.formatMoney : null;
    if (fmt && window.Shopify.money_format) {
      try { return fmt(cents, Shopify.money_format); } catch (e) {}
    }
    return '$' + (cents / 100).toFixed(2);
  }

  function readConfig(el) {
    return {
      matchType: (el.dataset.matchType || '').toLowerCase(),
      discount2: parseFloat(el.dataset.discount2) || 0,
      discount3: parseFloat(el.dataset.discount3) || 0,
      headlines: [
        el.dataset.headline0 || '',
        el.dataset.headline1 || '',
        el.dataset.headline2 || '',
        el.dataset.headline3 || '',
      ],
    };
  }

  function countMatchingItems(cart, matchType) {
    if (!cart || !Array.isArray(cart.items)) return { count: 0, subtotal: 0 };
    let count = 0;
    let subtotal = 0;
    cart.items.forEach(function (item) {
      const type = (item.product_type || '').toLowerCase();
      if (type === matchType) {
        count += item.quantity;
        subtotal += (item.final_line_price || item.line_price || (item.price * item.quantity));
      }
    });
    return { count: count, subtotal: subtotal };
  }

  function render(el, count, subtotal) {
    const cfg = readConfig(el);
    const tier = count >= 3 ? 3 : count;

    const headline = cfg.headlines[tier] || cfg.headlines[0];
    let savingsCents = 0;
    if (count >= 2 && count < 3) {
      savingsCents = Math.round(subtotal * (cfg.discount2 / 100));
    } else if (count >= 3) {
      savingsCents = Math.round(subtotal * (cfg.discount3 / 100));
    }

    const headlineEl = el.querySelector('[data-bpb-headline]');
    if (headlineEl) {
      headlineEl.textContent = headline
        .replace('{savings}', formatMoney(savingsCents))
        .replace('{next}', String(Math.max(0, BUNDLE_MAX - count)));
    }

    const steps = el.querySelectorAll('.bpb__step');
    steps.forEach(function (step, i) {
      step.classList.remove('bpb__step--active', 'bpb__step--current');
      if (i < count) {
        step.classList.add('bpb__step--active');
      } else if (i === count) {
        step.classList.add('bpb__step--current');
      }
    });

    const bars = el.querySelectorAll('.bpb__bar-fill');
    bars.forEach(function (bar, i) {
      const stepIndex = i + 1;
      bar.style.width = count > stepIndex ? '100%' : (count === stepIndex ? '50%' : '0%');
    });

    const savingsEl = el.querySelector('[data-bpb-savings]');
    const savingsAmt = el.querySelector('[data-bpb-savings-amount]');
    if (savingsEl && savingsAmt) {
      if (count >= 2 && savingsCents > 0) {
        savingsAmt.textContent = formatMoney(savingsCents);
        savingsEl.hidden = false;
      } else {
        savingsEl.hidden = true;
      }
    }
  }

  let refreshing = false;
  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      const res = await fetch('/cart.js', { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const cart = await res.json();
      instances.forEach(function (el) {
        const cfg = readConfig(el);
        const { count, subtotal } = countMatchingItems(cart, cfg.matchType);
        render(el, count, subtotal);
      });
    } catch (e) {
      // network failures are non-critical — bar just stays at last known state
    } finally {
      refreshing = false;
    }
  }

  document.addEventListener('cart:update', refresh);
  refresh();

  window.addEventListener('pageshow', function (event) {
    if (event.persisted) refresh();
  });
})();
