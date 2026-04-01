import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Order, OrderItem } from '../../../../shared/types';

/**
 * Slice de pedidos
 * Gestiona el estado de los pedidos de compra y venta
 */
interface OrderState {
  orders: Order[];
  currentOrder: Order | null;
  loading: boolean;
  error: string | null;
  totalCount: number;
  filters: {
    type?: Order['type'];
    status?: Order['status'];
  };
}

const initialState: OrderState = {
  orders: [],
  currentOrder: null,
  loading: false,
  error: null,
  totalCount: 0,
  filters: {}
};

const orderSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    fetchOrdersStart: state => {
      state.loading = true;
      state.error = null;
    },
    fetchOrdersSuccess: (state, action: PayloadAction<{ orders: Order[]; totalCount: number }>) => {
      state.loading = false;
      state.orders = action.payload.orders;
      state.totalCount = action.payload.totalCount;
      state.error = null;
    },
    fetchOrdersFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    fetchOrderByIdSuccess: (state, action: PayloadAction<Order>) => {
      state.loading = false;
      state.currentOrder = action.payload;
      state.error = null;
    },
    createOrderStart: state => {
      state.loading = true;
      state.error = null;
    },
    createOrderSuccess: (state, action: PayloadAction<Order>) => {
      state.loading = false;
      state.orders.unshift(action.payload);
      state.error = null;
    },
    createOrderFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    updateOrderItemStatusSuccess: (state, action: PayloadAction<{ orderId: number; item: OrderItem }>) => {
      const { orderId, item } = action.payload;
      const order = state.orders.find(o => o.id === orderId);
      if (order) {
        const itemIndex = order.items?.findIndex(i => i.id === item.id);
        if (itemIndex !== undefined && order.items) {
          order.items[itemIndex] = item;
        }
      }
      if (state.currentOrder?.id === orderId && state.currentOrder.items) {
        const itemIndex = state.currentOrder.items.findIndex(i => i.id === item.id);
        if (itemIndex !== -1) {
          state.currentOrder.items[itemIndex] = item;
        }
      }
    },
    cancelOrderSuccess: (state, action: PayloadAction<Order>) => {
      const index = state.orders.findIndex(o => o.id === action.payload.id);
      if (index !== -1) {
        state.orders[index] = action.payload;
      }
      if (state.currentOrder?.id === action.payload.id) {
        state.currentOrder = action.payload;
      }
    },
    setFilters: (state, action: PayloadAction<OrderState['filters']>) => {
      state.filters = action.payload;
    },
    clearError: state => {
      state.error = null;
    }
  }
});

export const { fetchOrdersStart, fetchOrdersSuccess, fetchOrdersFailure, fetchOrderByIdSuccess, createOrderStart, createOrderSuccess, createOrderFailure, updateOrderItemStatusSuccess, cancelOrderSuccess, setFilters, clearError } = orderSlice.actions;

export default orderSlice.reducer;
