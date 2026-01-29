import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLanguage } from './LanguageContext';

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
}

export interface LastAddedItem {
  name: string;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  lastAddedItem: LastAddedItem | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'storia-catering-cart';

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

  const addToCart = (item: Omit<CartItem, 'quantity'>, quantity = 4) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => 
          i.id === item.id 
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, { ...item, quantity }];
    });
    
    // Set last added item for animation (no toast)
    const itemName = language === 'en' && item.name_en ? item.name_en : item.name;
    setLastAddedItem({ name: itemName, quantity });
    
    // Reset after 2.5 seconds
    setTimeout(() => setLastAddedItem(null), 2500);
  };

  const removeFromCart = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setItems(prev => prev.map(i => 
      i.id === id ? { ...i, quantity } : i
    ));
  };

  const clearCart = () => {
    setItems([]);
    localStorage.removeItem(CART_STORAGE_KEY);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      totalItems,
      totalPrice,
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
