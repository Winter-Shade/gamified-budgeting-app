import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('budgetquest_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // If we have a token but no user, we might want to decode token or fetch /dashboard to verify
    // For simplicity, we just rely on token existence for initial route guarding.
    // If an API request fails with 401 later, logout() will be called.
    setIsLoading(false);
  }, []);

  const loginState = (newToken, userData) => {
    localStorage.setItem('budgetquest_token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('budgetquest_token');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    login: loginState,
    logout,
    isAuthenticated: !!token,
    isLoading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
