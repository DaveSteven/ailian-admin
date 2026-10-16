import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import type { MerchantRow, Stats, Status } from './types';

type State = { stats: Stats; merchants: MerchantRow[]; status: Status | 'all'; keyword: string; page: number; total: number };
const initialState: State = { stats: { total: 0, pending: 0, approved: 0, rejected: 0 }, merchants: [], status: 'all', keyword: '', page: 1, total: 0 };
const slice = createSlice({ name: 'dashboard', initialState, reducers: {
  setStats: (state, action: PayloadAction<Stats>) => { state.stats = action.payload; },
  setMerchants: (state, action: PayloadAction<{ items: MerchantRow[]; total: number }>) => { state.merchants = action.payload.items; state.total = action.payload.total; },
  setStatus: (state, action: PayloadAction<State['status']>) => { state.status = action.payload; state.page = 1; },
  setKeyword: (state, action: PayloadAction<string>) => { state.keyword = action.payload; state.page = 1; },
  setPage: (state, action: PayloadAction<number>) => { state.page = action.payload; },
} });
export const actions = slice.actions;
export const store = configureStore({ reducer: { dashboard: slice.reducer } });
export type RootState = ReturnType<typeof store.getState>; export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = useDispatch.withTypes<AppDispatch>(); export const useAppSelector = useSelector.withTypes<RootState>();
