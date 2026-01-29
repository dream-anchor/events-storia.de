/**
 * Event Package Pricing Utilities
 * 
 * Handles tiered pricing for the "Gesamte Location" package:
 * - Base price: €8,500 for up to 70 guests
 * - Extra guests (71+): €121.43 per additional person (8500/70)
 */

// Package ID for "Gesamte Location"
export const LOCATION_PACKAGE_ID = 'b147ea52-9907-445f-9f39-b7ddecbb0ddf';

// Pricing constants
export const LOCATION_BASE_PRICE = 8500;
export const LOCATION_BASE_GUESTS = 70;
export const PRICE_PER_EXTRA_GUEST = LOCATION_BASE_PRICE / LOCATION_BASE_GUESTS; // 121.428571...

/**
 * Calculate the total price for an event package based on guest count
 */
export function calculateEventPackagePrice(
  packageId: string,
  basePrice: number,
  guestCount: number,
  pricePerPerson: boolean
): number {
  // Standard per-person packages (Network-Aperitivo, Business Dinner)
  if (pricePerPerson) {
    return basePrice * guestCount;
  }
  
  // Special case: "Gesamte Location" with tiered pricing
  if (isLocationPackage(packageId, basePrice)) {
    const extraGuests = Math.max(0, guestCount - LOCATION_BASE_GUESTS);
    return LOCATION_BASE_PRICE + (extraGuests * PRICE_PER_EXTRA_GUEST);
  }
  
  // Other flat-rate packages: fixed price
  return basePrice;
}

/**
 * Check if a package is the "Gesamte Location" package
 */
export function isLocationPackage(packageId: string, price?: number): boolean {
  return packageId === LOCATION_PACKAGE_ID || price === LOCATION_BASE_PRICE;
}

/**
 * Get the effective price per unit for cart storage
 * For tiered pricing, we calculate the effective price that would produce the total
 */
export function getEffectiveUnitPrice(
  packageId: string,
  basePrice: number,
  guestCount: number,
  pricePerPerson: boolean
): number {
  const totalPrice = calculateEventPackagePrice(packageId, basePrice, guestCount, pricePerPerson);
  // For cart: store as total price / quantity (guest count)
  // This ensures the cart's simple multiplication works correctly
  return totalPrice / guestCount;
}

/**
 * Get pricing breakdown for display
 */
export function getLocationPricingBreakdown(guestCount: number): {
  basePrice: number;
  extraGuests: number;
  extraCost: number;
  total: number;
  pricePerExtraGuest: number;
} {
  const extraGuests = Math.max(0, guestCount - LOCATION_BASE_GUESTS);
  const extraCost = extraGuests * PRICE_PER_EXTRA_GUEST;
  const total = LOCATION_BASE_PRICE + extraCost;
  
  return {
    basePrice: LOCATION_BASE_PRICE,
    extraGuests,
    extraCost,
    total,
    pricePerExtraGuest: PRICE_PER_EXTRA_GUEST
  };
}
