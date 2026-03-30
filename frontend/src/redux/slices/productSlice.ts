import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Product } from '../../../../shared/types';

/**
 * Slice de productos
 * Gestiona el estado de los productos en el inventario
 */
interface ProductState {
  products: Product[];
  currentProduct: Product | null;
  loading: boolean;
  error: string | null;
  totalCount: number;
  filters: {
    category?: string;
    isActive?: boolean;
  };
}

const initialState: ProductState = {
  products: [],
  currentProduct: null,
  loading: false,
  error: null,
  totalCount: 0,
  filters: {}
};

const productSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    fetchProductsStart: state => {
      state.loading = true;
      state.error = null;
    },
    fetchProductsSuccess: (state, action: PayloadAction<{ products: Product[]; totalCount: number }>) => {
      state.loading = false;
      state.products = action.payload.products;
      state.totalCount = action.payload.totalCount;
      state.error = null;
    },
    fetchProductsFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    fetchProductByIdSuccess: (state, action: PayloadAction<Product>) => {
      state.loading = false;
      state.currentProduct = action.payload;
      state.error = null;
    },
    createProductStart: state => {
      state.loading = true;
      state.error = null;
    },
    createProductSuccess: (state, action: PayloadAction<Product>) => {
      state.loading = false;
      state.products.push(action.payload);
      state.error = null;
    },
    createProductFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    updateProductSuccess: (state, action: PayloadAction<Product>) => {
      state.loading = false;
      const index = state.products.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.products[index] = action.payload;
      }
      if (state.currentProduct?.id === action.payload.id) {
        state.currentProduct = action.payload;
      }
      state.error = null;
    },
    updateProductFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    deleteProductSuccess: (state, action: PayloadAction<number>) => {
      state.loading = false;
      state.products = state.products.filter(p => p.id !== action.payload);
      state.error = null;
    },
    deleteProductFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    updateStockSuccess: (state, action: PayloadAction<{ id: number; stock: number }>) => {
      const product = state.products.find(p => p.id === action.payload.id);
      if (product) {
        product.stock = action.payload.stock;
      }
      if (state.currentProduct?.id === action.payload.id) {
        state.currentProduct.stock = action.payload.stock;
      }
    },
    setFilters: (state, action: PayloadAction<ProductState['filters']>) => {
      state.filters = action.payload;
    },
    clearError: state => {
      state.error = null;
    }
  }
});

export const {
  fetchProductsStart,
  fetchProductsSuccess,
  fetchProductsFailure,
  fetchProductByIdSuccess,
  createProductStart,
  createProductSuccess,
  createProductFailure,
  updateProductSuccess,
  updateProductFailure,
  deleteProductSuccess,
  deleteProductFailure,
  updateStockSuccess,
  setFilters,
  clearError
} = productSlice.actions;

export default productSlice.reducer;
