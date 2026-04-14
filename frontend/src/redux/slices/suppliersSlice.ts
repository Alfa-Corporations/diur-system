import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface Supplier {
  id: number;
  name: string;
}

interface SupplierState {
  suppliers: Supplier[];
  loading: boolean;
  error: string | null;
}

const initialState: SupplierState = {
  suppliers: [],
  loading: false,
  error: null
};

const supplierSlice = createSlice({
  name: 'suppliers',
  initialState,
  reducers: {
    fetchSuppliersStart(state) {
      state.loading = true;
      state.error = null;
    },
    fetchSuppliersSuccess(state, action: PayloadAction<Supplier[]>) {
      state.loading = false;
      state.suppliers = action.payload;
    },
    fetchSuppliersFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    }
  }
});

export const { fetchSuppliersStart, fetchSuppliersSuccess, fetchSuppliersFailure } = supplierSlice.actions;

export default supplierSlice.reducer;
