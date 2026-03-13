import { ThemeEvents, VariantUpdateEvent } from '@theme/events';

/**
 * A custom element that displays a product price.
 * This component listens for variant update events and updates the price display accordingly.
 * It handles price updates from two different sources:
 * 1. Variant picker (in quick add modal or product page)
 * 2. Swatches variant picker (in product cards)
 */
class ProductPrice extends HTMLElement {
  connectedCallback() {
    const closestSection = this.closest('.shopify-section, dialog');
    if (!closestSection) return;
    closestSection.addEventListener(ThemeEvents.variantUpdate, this.updatePrice);
  }

  disconnectedCallback() {
    const closestSection = this.closest('.shopify-section, dialog');
    if (!closestSection) return;
    closestSection.removeEventListener(ThemeEvents.variantUpdate, this.updatePrice);
  }

  /**
   * Updates the price.
   * @param {VariantUpdateEvent} event - The variant update event.
   */
  updatePrice = (event) => {
    if (event.detail.data.newProduct) {
      this.dataset.productId = event.detail.data.newProduct.id;
    } else if (event.target instanceof HTMLElement && event.target.dataset.productId !== this.dataset.productId) {
      return;
    }

    const newPrice = event.detail.data.html.querySelector('product-price [ref="priceContainer"]');
    const currentPrice = this.querySelector('[ref="priceContainer"]');
    const newInstallments = event.detail.data.html.querySelector('product-price [ref="installmentsContainer"]');
    const currentInstallments = this.querySelector('[ref="installmentsContainer"]');

    if (!newPrice || !currentPrice) return;

    if (currentPrice.innerHTML !== newPrice.innerHTML) {
      currentPrice.replaceWith(newPrice);
    }

    // Keep Shopify payment terms in sync with variant changes.
    if (newInstallments && currentInstallments && currentInstallments.innerHTML !== newInstallments.innerHTML) {
      currentInstallments.replaceWith(newInstallments);
    } else if (newInstallments && !currentInstallments) {
      const latestPriceContainer = this.querySelector('[ref="priceContainer"]');
      latestPriceContainer?.insertAdjacentElement('afterend', newInstallments);
    } else if (!newInstallments && currentInstallments) {
      currentInstallments.remove();
    }
  };
}

if (!customElements.get('product-price')) {
  customElements.define('product-price', ProductPrice);
}
