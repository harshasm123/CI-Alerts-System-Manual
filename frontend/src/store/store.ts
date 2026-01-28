import { configureStore } from '@reduxjs/toolkit';
import dashboardSlice from './slices/dashboardSlice';
import alertsSlice from './slices/alertsSlice';
import chatSlice from './slices/chatSlice';

export const store = configureStore({
  reducer: {
    dashboard: dashboardSlice,
    alerts: alertsSlice,
    chat: chatSlice,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;