import { Product } from '../types';

export function calculateSubtotal(product: Product, quantity: number): number {
  if (!product.discountMode || product.discountMode === 'none' || !product.discountPrice) {
    return quantity * product.price;
  }

  const threshold = product.discountThreshold || 2;

  if (product.discountMode === 'pair') {
    const sets = Math.floor(quantity / threshold);
    const remainder = quantity % threshold;
    return (sets * product.discountPrice) + (remainder * product.price);
  }

  if (product.discountMode === 'bulk') {
    if (quantity >= threshold) {
      return quantity * product.discountPrice;
    }
    return quantity * product.price;
  }

  return quantity * product.price;
}
