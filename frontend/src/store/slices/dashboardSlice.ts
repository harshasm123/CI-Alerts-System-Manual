import { createSlice } from '@reduxjs/toolkit';

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: {
    kpis: { brandsTracked: 15, competitorsMonitored: 47, criticalAlerts: 8, regulatoryEvents: 12 },
    loading: false,
  },
  reducers: {
    setLoading: (state, action) => { state.loading = action.payload; },
  },
});

export const { setLoading } = dashboardSlice.actions;
export default dashboardSlice.reducer;