import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Invoice } from '../../../../shared/types';

/**
 * Slice de facturas
 * Gestiona el estado de las facturas del sistema
 */
interface InvoiceState {
  invoices: Invoice[];
  currentInvoice: Invoice | null;
  loading: boolean;
  error: string | null;
  totalCount: number;
  filters: {
    status?: Invoice['status'];
  };
}

const initialState: InvoiceState = {
  invoices: [],
  currentInvoice: null,
  loading: false,
  error: null,
  totalCount: 0,
  filters: {}
};

const invoiceSlice = createSlice({
  name: 'invoices',
  initialState,
  reducers: {
    fetchInvoicesStart: state => {
      state.loading = true;
      state.error = null;
    },
    fetchInvoicesSuccess: (state, action: PayloadAction<{ invoices: Invoice[]; totalCount: number }>) => {
      state.loading = false;
      state.invoices = action.payload.invoices;
      state.totalCount = action.payload.totalCount;
      state.error = null;
    },
    fetchInvoicesFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    fetchInvoiceByIdSuccess: (state, action: PayloadAction<Invoice>) => {
      state.loading = false;
      state.currentInvoice = action.payload;
      state.error = null;
    },
    createInvoiceStart: state => {
      state.loading = true;
      state.error = null;
    },
    createInvoiceSuccess: (state, action: PayloadAction<Invoice>) => {
      state.loading = false;
      state.invoices.unshift(action.payload); // Agregar al inicio
      state.error = null;
    },
    createInvoiceFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    updateInvoiceSuccess: (state, action: PayloadAction<Invoice>) => {
      state.loading = false;
      const index = state.invoices.findIndex(i => i.id === action.payload.id);
      if (index !== -1) {
        state.invoices[index] = action.payload;
      }
      if (state.currentInvoice?.id === action.payload.id) {
        state.currentInvoice = action.payload;
      }
      state.error = null;
    },
    deleteInvoiceSuccess: (state, action: PayloadAction<number>) => {
      state.loading = false;
      state.invoices = state.invoices.filter(i => i.id !== action.payload);
      if (state.currentInvoice?.id === action.payload) {
        state.currentInvoice = null;
      }
      state.error = null;
    },
    updateInvoiceStatusSuccess: (state, action: PayloadAction<Invoice>) => {
      state.loading = false;
      const index = state.invoices.findIndex(i => i.id === action.payload.id);
      if (index !== -1) {
        state.invoices[index] = action.payload;
      }
      if (state.currentInvoice?.id === action.payload.id) {
        state.currentInvoice = action.payload;
      }
      state.error = null;
    },
    updateInvoiceStatusFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    cancelInvoiceSuccess: (state, action: PayloadAction<Invoice>) => {
      state.loading = false;
      const index = state.invoices.findIndex(i => i.id === action.payload.id);
      if (index !== -1) {
        state.invoices[index] = action.payload;
      }
      if (state.currentInvoice?.id === action.payload.id) {
        state.currentInvoice = action.payload;
      }
      state.error = null;
    },
    cancelInvoiceFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    setFilters: (state, action: PayloadAction<InvoiceState['filters']>) => {
      state.filters = action.payload;
    },
    clearError: state => {
      state.error = null;
    }
  }
});

export const {
  fetchInvoicesStart,
  fetchInvoicesSuccess,
  fetchInvoicesFailure,
  fetchInvoiceByIdSuccess,
  createInvoiceStart,
  createInvoiceSuccess,
  createInvoiceFailure,
  updateInvoiceSuccess,
  deleteInvoiceSuccess,
  updateInvoiceStatusSuccess,
  updateInvoiceStatusFailure,
  cancelInvoiceSuccess,
  cancelInvoiceFailure,
  setFilters,
  clearError
} = invoiceSlice.actions;

export default invoiceSlice.reducer;
