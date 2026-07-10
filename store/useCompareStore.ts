import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Product {
  id: string;
  name: string;
  url: string;
  current_price: number;
  original_price?: number;
  image_url?: string;
  currency: string;
  rating?: number;
  reviews_count?: number;
  is_discounted?: boolean;
}

interface CompareStore {
  selectedProducts: Product[];
  addProduct: (product: Product) => void;
  removeProduct: (productId: string) => void;
  clearProducts: () => void;
}

export const useCompareStore = create<CompareStore>()(
  persist(
    (set) => ({
      selectedProducts: [],
      addProduct: (product) =>
        set((state) => {
          if (state.selectedProducts.find((p) => p.id === product.id)) {
            return state;
          }
          // Limit to 3 products max
          if (state.selectedProducts.length >= 3) {
            return { selectedProducts: [...state.selectedProducts.slice(1), product] };
          }
          return { selectedProducts: [...state.selectedProducts, product] };
        }),
      removeProduct: (productId) =>
        set((state) => ({
          selectedProducts: state.selectedProducts.filter((p) => p.id !== productId),
        })),
      clearProducts: () => set({ selectedProducts: [] }),
    }),
    {
      name: 'compare-storage',
    }
  )
);
