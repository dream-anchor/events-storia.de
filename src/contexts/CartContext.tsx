import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLanguage } from './LanguageContext';
import { toast } from 'sonner';
import { trackEvent } from '@/lib/analytics';
import { isGiftItem, nextGiftQuantity, giftMaxForLine, giftQuantityTotal } from '@/lib/gift/cartRules';
import { clampEventGuests, eventUnitPriceForGuests, type EventPriceBasis } from '@/lib/eventPricing';
import type { CartSync } from '@/lib/orderQuote';

export interface CartItem {
  id: string;
  name: string;
  name_en: string | null;
  price: number;
  quantity: number;
  image?: string;
  serving_info?: string;
  min_order?: number;
  category?: 'pizza' | 'buffet' | 'platter' | 'equipment' | 'dessert';
  // Event package specific fields
  isEventPackage?: boolean;
  baseGuestCount?: number; // For tiered pricing (e.g., 70 for Location package)
  packageId?: string; // Original package ID for price recalculation
  /** Preisgrundlage des Pakets (Grundpreis, pro Person?, Gästegrenzen): damit der Betrag bei jeder Gästezahl-Änderung neu gerechnet wird */
  eventPricing?: EventPriceBasis;
  // Geschenkkorb-Zeilen (ID `gift-<variantId>`): Preis = Anzeigepreis aus dem Katalog, maßgeblich ist der Server
  kind?: 'gift_basket';
  variantId?: string;
  basketSlug?: string;
  variantKey?: string;
  variantLabel?: string; // Wein-Variante (DE), nur Anzeige
  variantLabelEn?: string | null;
  vatSplit?: { rate: number; share_bp: number }[]; // nur Anzeige
}

export interface AddToCartOptions {
  /** 'add' (Standard) addiert zur vorhandenen Menge, 'set' setzt sie (Deep-Links). */
  mode?: 'add' | 'set';
}

export interface LastAddedItem {
  name: string;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'>, quantity?: number, options?: AddToCartOptions) => void;
  /** Entfernt alle Geschenkkorb-Zeilen (nach erfolgreicher Korb-Bestellung). */
  removeGiftItems: () => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  /** Checkout: Warenkorb mit dem Server-Angebot abgleichen (Preise/Namen aktualisieren, Artikel entfernen, Gästezahl begrenzen). */
  syncFromServer: (sync: CartSync) => void;
  totalItems: number;
  totalPrice: number;
  /** Summe ohne Geschenkkörbe (Mindestbestellwert/Aufschlag gelten nur für den Catering-Anteil). */
  cateringSubtotal: number;
  giftItemCount: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  lastAddedItem: LastAddedItem | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'storia-catering-cart';

/** Event-Paket-Zeile: Gästezahl in die Grenzen setzen und den Stückpreis (Gesamt/Gäste) für diese Gästezahl neu rechnen. */
const repriceEventLine = (item: CartItem, guests: number): CartItem => {
  if (!item.eventPricing) return { ...item, quantity: guests };
  const packageId = item.packageId || item.id.replace('event-', '');
  const quantity = clampEventGuests(guests, item.eventPricing);
  return { ...item, quantity, price: eventUnitPriceForGuests(packageId, item.eventPricing, quantity) };
};
const isEventLine = (item: CartItem) => item.id.startsWith('event-') || !!item.isEventPackage;

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { language } = useLanguage();
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  });
  const [isOpen, setIsOpen] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState<LastAddedItem | null>(null);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addToCart = (item: Omit<CartItem, 'quantity'>, requestedQuantity?: number, options?: AddToCartOptions) => {
    const isEventItem = item.id.startsWith('event-') || item.isEventPackage;
    const isGift = isGiftItem(item);
    // Standardmenge: Catering 4, Geschenkkorb 1
    const quantity = requestedQuantity ?? (isGift ? 1 : 4);
    const mode = options?.mode ?? 'add';
    let addedQuantity = quantity;

    setItems(prev => {
      // Check for mixed cart scenarios
      const hasEventItems = prev.some(i => i.id.startsWith('event-') || i.isEventPackage);
      const hasCateringItems = prev.some(i => !i.id.startsWith('event-') && !i.isEventPackage);

      // Geschenkkörbe + Event-Pakete: nie gemischt (gleiches Muster wie Catering vs. Event)
      const hasGiftItems = prev.some(isGiftItem);
      if ((isGift && hasEventItems) || (isEventItem && hasGiftItems)) {
        toast.info(
          language === 'de'
            ? 'Geschenkkörbe und Event-Pakete müssen separat bestellt werden. Ihr Warenkorb wurde geleert.'
            : 'Gift baskets and event packages must be ordered separately. Your cart has been cleared.',
          { duration: 4000 }
        );
        const first = isGift ? nextGiftQuantity([], item.id, quantity, 'set').quantity : quantity;
        addedQuantity = first;
        return first > 0 ? [{ ...item, quantity: first }] : [];
      }

      // If adding event item to cart with catering items, clear cart first
      if (isEventItem && hasCateringItems) {
        toast.info(
          language === 'de'
            ? 'Event-Pakete müssen separat bestellt werden. Ihr Warenkorb wurde geleert.'
            : 'Event packages must be ordered separately. Your cart has been cleared.',
          { duration: 4000 }
        );
        return [{ ...item, quantity }];
      }

      // If adding catering item to cart with event items, clear cart first
      if (!isEventItem && hasEventItems) {
        toast.info(
          language === 'de'
            ? 'Catering-Artikel müssen separat von Event-Paketen bestellt werden. Ihr Warenkorb wurde geleert.'
            : 'Catering items must be ordered separately from event packages. Your cart has been cleared.',
          { duration: 4000 }
        );
        return [{ ...item, quantity }];
      }

      if (isGift) {
        const next = nextGiftQuantity(prev, item.id, quantity, mode);
        addedQuantity = Math.max(0, next.quantity - (mode === 'set' ? 0 : (prev.find(i => i.id === item.id)?.quantity ?? 0)));
        if (next.capped) {
          toast.info(
            language === 'de'
              ? 'Pro Bestellung sind höchstens 10 Geschenkkörbe möglich.'
              : 'A maximum of 10 gift baskets per order is possible.',
            { id: 'gift-cart-cap', duration: 4000 }
          );
        }
        if (next.quantity <= 0) return prev.filter(i => i.id !== item.id);
        const has = prev.some(i => i.id === item.id);
        return has
          ? prev.map(i => (i.id === item.id ? { ...i, ...item, quantity: next.quantity } : i))
          : [...prev, { ...item, quantity: next.quantity }];
      }

      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i =>
          i.id === item.id
            ? (isEventLine(i) ? repriceEventLine(i, i.quantity + quantity) : { ...i, quantity: i.quantity + quantity })
            : i
        );
      }
      return [...prev, { ...item, quantity }];
    });

    // Set last added item for animation (no toast)
    const itemName = language === 'en' && item.name_en ? item.name_en : item.name;
    setLastAddedItem({ name: itemName, quantity: addedQuantity });
    setTimeout(() => setLastAddedItem(null), 2500);

    // Korb-Zeilen: tatsächlich hinzugefügte Menge (nach Deckel) melden
    let trackedQuantity = quantity;
    if (isGift) {
      const pre = nextGiftQuantity(items, item.id, quantity, mode);
      trackedQuantity = mode === 'set' ? pre.quantity : pre.quantity - (items.find(i => i.id === item.id)?.quantity ?? 0);
    }
    trackEvent("add_to_cart", {
      item_id: item.id,
      item_name: item.name,
      price: item.price,
      quantity: trackedQuantity,
    });
  };

  const removeFromCart = (id: string) => {
    const item = items.find(i => i.id === id);
    if (item) {
      trackEvent("remove_from_cart", {
        item_id: item.id,
        item_name: item.name,
        price: item.price,
        quantity: item.quantity,
      });
    }
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setItems(prev => {
      const target = prev.find(i => i.id === id);
      if (target && isGiftItem(target)) {
        // Korb-Zeilen: je Zeile und je Bestellung gedeckelt
        const capped = Math.min(quantity, giftMaxForLine(prev, id));
        return capped <= 0 ? prev.filter(i => i.id !== id) : prev.map(i => (i.id === id ? { ...i, quantity: capped } : i));
      }
      // Event-Pakete: Betrag hängt von der Gästezahl ab (Pauschale, Location gestaffelt) -> immer neu rechnen, nie nur Menge ändern
      return prev.map(i =>
        i.id === id ? (isEventLine(i) ? repriceEventLine(i, quantity) : { ...i, quantity }) : i
      );
    });
  };

  const syncFromServer = (sync: CartSync) => {
    if (sync.updates.length + sync.removals.length + sync.clamps.length === 0) return;
    setItems(prev => prev
      .filter(i => !sync.removals.includes(i.id))
      .map(i => {
        const u = sync.updates.find(x => x.id === i.id);
        let next: CartItem = u
          ? { ...i, name: u.name, name_en: u.name_en, price: u.price, ...(u.eventPricing ? { eventPricing: u.eventPricing } : {}) }
          : i;
        const clamp = sync.clamps.find(x => x.id === i.id);
        if (clamp) next = isEventLine(next) ? repriceEventLine(next, clamp.quantity) : { ...next, quantity: clamp.quantity };
        return next;
      }));
  };

  const removeGiftItems = () => {
    setItems(prev => (prev.some(isGiftItem) ? prev.filter(i => !isGiftItem(i)) : prev));
  };

  const clearCart = () => {
    setItems([]);
    localStorage.removeItem(CART_STORAGE_KEY);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cateringSubtotal = items.reduce((sum, item) => (isGiftItem(item) ? sum : sum + (item.price * item.quantity)), 0);
  const giftItemCount = giftQuantityTotal(items);

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      syncFromServer,
      removeGiftItems,
      totalItems,
      totalPrice,
      cateringSubtotal,
      giftItemCount,
      isOpen,
      setIsOpen,
      lastAddedItem
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
