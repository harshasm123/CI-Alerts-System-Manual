import { createSlice } from '@reduxjs/toolkit';

const alertsSlice = createSlice({
  name: 'alerts',
  initialState: {
    alerts: [],
    loading: false,
  },
  reducers: {
    setAlerts: (state, action) => { state.alerts = action.payload; },
    setLoading: (state, action) => { state.loading = action.payload; },
  },
});

export const { setAlerts, setLoading } = alertsSlice.actions;
export default alertsSlice.reducer;