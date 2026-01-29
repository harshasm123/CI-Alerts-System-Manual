import { createSlice } from '@reduxjs/toolkit';

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    messages: [],
    loading: false,
  },
  reducers: {
    addMessage: (state, action) => { state.messages.push(action.payload); },
    setLoading: (state, action) => { state.loading = action.payload; },
  },
});

export const { addMessage, setLoading } = chatSlice.actions;
export default chatSlice.reducer;