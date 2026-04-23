import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface Customer {
  id: number;
  name: string;
  // 👉 puedes agregar más campos luego (address, phone, etc.)
}

interface CustomerState {
  customers: Customer[];
  loading: boolean;
  error: string | null;
}

const initialState: CustomerState = {
  customers: [],
  loading: false,
  error: null
};

const customerSlice = createSlice({
  name: 'customers',
  initialState,
  reducers: {
    fetchCustomersStart(state) {
      state.loading = true;
      state.error = null;
    },
    fetchCustomersSuccess(state, action: PayloadAction<Customer[]>) {
      state.loading = false;
      state.customers = action.payload;
    },
    fetchCustomersFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    }
  }
});

export const { fetchCustomersStart, fetchCustomersSuccess, fetchCustomersFailure } = customerSlice.actions;

export default customerSlice.reducer;
