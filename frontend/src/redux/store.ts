import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import productReducer from './slices/productSlice';
import invoiceReducer from './slices/invoiceSlice';
import orderReducer from './slices/orderSlice';
import syncReducer from './slices/syncSlice';
import suppliersReducer from './slices/suppliersSlice';

/**
 * Store de Redux
 * Configuración central del estado de la aplicación
 */
export const store = configureStore({
  reducer: {
    auth: authReducer,
    products: productReducer,
    invoices: invoiceReducer,
    orders: orderReducer,
    sync: syncReducer,
    suppliers: suppliersReducer
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignorar acciones de fechas en serialización
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE']
      }
    }),
  devTools: !import.meta.env.PROD
});

// Tipos para TypeScript
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
