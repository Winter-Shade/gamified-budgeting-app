import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { getWallet } from '../api/api';
import { useAuth } from './AuthContext';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [wallet, setWallet] = useState({
    xp: 0, gold: 0, level: 1,
    level_progress_pct: 0,
    next_level_xp: 100,
    current_level_min_xp: 0,
  });
  const fetchedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await getWallet();
      setWallet(data);
    } catch (_) {}
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && !fetchedRef.current) {
      fetchedRef.current = true;
      refresh();
    }
    if (!isAuthenticated) fetchedRef.current = false;
  }, [isAuthenticated, refresh]);

  return (
    <WalletContext.Provider value={{ wallet, refresh }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
