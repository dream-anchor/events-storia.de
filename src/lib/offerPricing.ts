import { calculateEventPackagePrice } from "@/lib/eventPricing";

type PricingMode = 'per_person' | 'per_event';
type LinePriceMode = 'per_person' | 'flat' | null | undefined;

interface PricedCourse {
  itemName?: string | null;
  overridePrice?: number | null;
  quantity?: number | null;
  priceMode?: LinePriceMode;
}

interface PricedDrink {
  selectedChoice?: string | null;
  customDrink?: string | null;
  pricePerUnit?: number | null;
  quantity?: number | null;
  priceMode?: LinePriceMode;
}

interface DrinkEinzeln {
  name?: string | null;
  pricePerPerson?: number | null;
  quantity?: number | null;
  priceMode?: LinePriceMode;
}

interface ServiceItem {
  name?: string | null;
  pricePerUnit?: number | null;
  quantity?: number | null;
}

interface MenuSelectionLike {
  courses?: PricedCourse[];
  days?: Array<{ courses?: PricedCourse[] | null } | null> | null;
  drinks?: PricedDrink[];
  winePairingPrice?: number | null;
  drinksMode?: 'none' | 'pauschale' | 'weinbegleitung' | 'einzeln' | null;
  drinksPauschalePrice?: number | null;
  drinksEinzeln?: DrinkEinzeln[];
  equipment?: ServiceItem[];
  staff?: ServiceItem[];
  freeformProgram?: {
    totalsFromText?: { gross?: number | string | null } | null;
    discount?: { mode?: 'percent' | 'amount' | null; value?: number | string | null } | null;
  } | null;
}

interface OfferLike {
  offerMode?: string | null;
  packageId?: string | null;
  guestCount?: number | null;
  menuSelection: MenuSelectionLike;
  totalAmount?: number | null;
  budgetPerPerson?: number | null;
  pricingMode?: PricingMode | null;
  discountPercent?: number | null;
  discountAmount?: number | null;
}

interface PackageLike {
  id: string;
  price: number;
  price_per_person: boolean;
}

export interface SelectableOptionPricingParts {
  perPerson: number;
  fixed: number;
  total: number;
}

const toNumber = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

export function lineMultiplier(
  priceMode: LinePriceMode,
  pricingMode: PricingMode,
  guestCount: number,
): number {
  const mode = priceMode ?? (pricingMode === 'per_event' ? 'flat' : 'per_person');
  return mode === 'flat' ? 1 : Math.max(1, guestCount);
}

export function serviceItemsTotal(items: ServiceItem[] | null | undefined): number {
  return (items ?? [])
    .filter((item) => item.name && toNumber(item.pricePerUnit) > 0 && toNumber(item.quantity) > 0)
    .reduce((sum, item) => sum + toNumber(item.pricePerUnit) * toNumber(item.quantity), 0);
}

export function inlineDrinksTotal(
  drinks: PricedDrink[] | null | undefined,
  guestCount: number,
  pricingMode: PricingMode,
): number {
  return (drinks ?? []).reduce((sum, drink) => {
    const price = toNumber(drink.pricePerUnit);
    if (price <= 0) return sum;
    const quantity = drink.quantity == null ? 1 : Math.max(0, toNumber(drink.quantity));
    return sum + price * quantity * lineMultiplier(drink.priceMode, pricingMode, guestCount);
  }, 0);
}

export function drinksSectionTotal(
  menuSelection: MenuSelectionLike,
  guestCount: number,
  pricingMode: PricingMode,
): number {
  const guests = Math.max(1, guestCount);
  const mode = menuSelection.drinksMode ?? 'none';

  if (mode === 'weinbegleitung' || mode === 'none') {
    return toNumber(menuSelection.winePairingPrice) * guests;
  }

  if (mode === 'pauschale') {
    return toNumber(menuSelection.drinksPauschalePrice) * guests;
  }

  if (mode === 'einzeln') {
    return (menuSelection.drinksEinzeln ?? []).reduce((sum, drink) => {
      const price = toNumber(drink.pricePerPerson);
      if (price <= 0) return sum;
      const quantity = drink.quantity == null ? 1 : Math.max(0, toNumber(drink.quantity));
      return sum + price * quantity * lineMultiplier(drink.priceMode, pricingMode, guests);
    }, 0);
  }

  return 0;
}

export function flattenPricedCourses(menuSelection: MenuSelectionLike): PricedCourse[] {
  if (Array.isArray(menuSelection.days) && menuSelection.days.length > 0) {
    return menuSelection.days.flatMap((day) => day?.courses ?? []);
  }
  return menuSelection.courses ?? [];
}

export function coursesTotal(
  menuSelection: MenuSelectionLike,
  guestCount: number,
  pricingMode: PricingMode,
): number {
  const guests = Math.max(1, guestCount);
  return flattenPricedCourses(menuSelection).reduce((sum, course) => {
    const price = toNumber(course.overridePrice);
    if (price <= 0) return sum;
    const quantity = course.quantity == null ? 1 : Math.max(0, toNumber(course.quantity));
    return sum + price * quantity * lineMultiplier(course.priceMode, pricingMode, guests);
  }, 0);
}

export function computeDiscount(base: number, percent?: number | null, amount?: number | null): number {
  const discountPercent = Math.min(100, Math.max(0, toNumber(percent)));
  const discountAmount = Math.max(0, toNumber(amount));
  return discountAmount > 0 ? Math.min(discountAmount, base) : base * (discountPercent / 100);
}

export function calculateOfferTotal(
  option: OfferLike,
  packages?: PackageLike[] | null,
): number | null {
  const menuSelection = option.menuSelection ?? { courses: [], drinks: [] };
  const guestCount = Math.max(1, toNumber(option.guestCount));
  const pricingMode = option.pricingMode ?? 'per_person';

  if (option.offerMode === 'freeform' || menuSelection.freeformProgram) {
    const grossBase = toNumber(menuSelection.freeformProgram?.totalsFromText?.gross);
    if (grossBase <= 0) return toNumber(option.totalAmount);
    const freeformDiscount = menuSelection.freeformProgram?.discount;
    const discount = freeformDiscount?.mode === 'percent'
      ? (grossBase * toNumber(freeformDiscount.value)) / 100
      : freeformDiscount?.mode === 'amount'
        ? toNumber(freeformDiscount.value)
        : computeDiscount(grossBase, option.discountPercent, option.discountAmount);
    return Math.max(0, grossBase - discount);
  }

  const fixedTotal = serviceItemsTotal(menuSelection.equipment) + serviceItemsTotal(menuSelection.staff);
  const inlineDrinkTotal = inlineDrinksTotal(menuSelection.drinks, guestCount, pricingMode);

  if (option.offerMode === 'menu' || option.offerMode === 'full_menu' || option.offerMode === 'fest_menu' || option.offerMode === 'teil_menu' || option.offerMode === 'partial_menu') {
    const dishTotal = coursesTotal(menuSelection, guestCount, pricingMode);
    const configuredDrinksTotal = drinksSectionTotal(menuSelection, guestCount, pricingMode);
    const drinksTotal = configuredDrinksTotal + inlineDrinkTotal;
    const hasDishTotal = dishTotal > 0;
    const budget = toNumber(option.budgetPerPerson);

    const discountable = budget > 0 && !hasDishTotal
      ? (pricingMode === 'per_event' ? budget : budget * guestCount) + drinksTotal
      : dishTotal + drinksTotal;

    return Math.max(0, discountable - computeDiscount(discountable, option.discountPercent, option.discountAmount)) + fixedTotal;
  }

  if (option.offerMode === 'paket') {
    if (!option.packageId || !packages?.length) return null;
    const pkg = packages.find((p) => p.id === option.packageId);
    if (!pkg) return null;

    const budget = toNumber(option.budgetPerPerson);
    const packageBase = budget > 0
      ? pricingMode === 'per_event'
        ? budget
        : pkg.price_per_person
          ? budget * guestCount
          : budget
      : pkg.price_per_person
        ? calculateEventPackagePrice(pkg.id, toNumber(pkg.price), guestCount, true)
        : toNumber(pkg.price);

    const discountable = packageBase + inlineDrinkTotal;
    return Math.max(0, discountable - computeDiscount(discountable, option.discountPercent, option.discountAmount)) + fixedTotal;
  }

  return null;
}

export function selectableOptionPricingParts(option: {
  total_amount?: number | null;
  guest_count?: number | null;
  menu_selection?: (MenuSelectionLike & { budgetPerPerson?: number | null; pricingMode?: PricingMode | null }) | null;
}): SelectableOptionPricingParts {
  const menuSelection = option.menu_selection ?? null;
  const pricingMode = menuSelection?.pricingMode ?? 'per_person';
  const guestCount = Math.max(1, toNumber(option.guest_count));
  const total = toNumber(option.total_amount);

  if (!menuSelection || pricingMode === 'per_event' || menuSelection.freeformProgram) {
    return { perPerson: pricingMode === 'per_event' ? total : total / guestCount, fixed: 0, total };
  }

  const fixedServices = serviceItemsTotal(menuSelection.equipment) + serviceItemsTotal(menuSelection.staff);
  const fixedInlineDrinks = (menuSelection.drinks ?? []).reduce((sum, drink) => {
    const price = toNumber(drink.pricePerUnit);
    if (price <= 0) return sum;
    const quantity = drink.quantity == null ? 1 : Math.max(0, toNumber(drink.quantity));
    return (drink.priceMode ?? 'per_person') === 'flat' ? sum + price * quantity : sum;
  }, 0);
  const perPersonInlineDrinks = (menuSelection.drinks ?? []).reduce((sum, drink) => {
    const price = toNumber(drink.pricePerUnit);
    if (price <= 0) return sum;
    const quantity = drink.quantity == null ? 1 : Math.max(0, toNumber(drink.quantity));
    return (drink.priceMode ?? 'per_person') === 'flat' ? sum : sum + price * quantity;
  }, 0);

  const mode = menuSelection.drinksMode ?? 'none';
  let perPersonDrinkSection = 0;
  let fixedDrinkSection = 0;
  if (mode === 'pauschale') perPersonDrinkSection += toNumber(menuSelection.drinksPauschalePrice);
  if (mode === 'weinbegleitung' || mode === 'none') perPersonDrinkSection += toNumber(menuSelection.winePairingPrice);
  if (mode === 'einzeln') {
    for (const drink of menuSelection.drinksEinzeln ?? []) {
      const price = toNumber(drink.pricePerPerson);
      if (price <= 0) continue;
      const quantity = drink.quantity == null ? 1 : Math.max(0, toNumber(drink.quantity));
      if ((drink.priceMode ?? 'per_person') === 'flat') fixedDrinkSection += price * quantity;
      else perPersonDrinkSection += price * quantity;
    }
  }

  const fixed = fixedServices + fixedInlineDrinks + fixedDrinkSection;
  const fallbackBudget = toNumber(menuSelection.budgetPerPerson) + perPersonInlineDrinks + perPersonDrinkSection;
  const perPerson = total > 0 && guestCount > 0
    ? Math.max(0, total - fixed) / guestCount
    : fallbackBudget;

  return { perPerson, fixed, total };
}

export function selectableOptionAmount(
  option: Parameters<typeof selectableOptionPricingParts>[0],
  selectedQuantity: number,
): number {
  const parts = selectableOptionPricingParts(option);
  const pricingMode = option.menu_selection?.pricingMode ?? 'per_person';
  if (pricingMode === 'per_event' || option.menu_selection?.freeformProgram) return parts.total;
  return parts.perPerson * Math.max(0, selectedQuantity) + parts.fixed;
}