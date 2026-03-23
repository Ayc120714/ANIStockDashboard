import React, { createContext, useContext } from 'react';
import { useBootstrapReady } from '../hooks/useBootstrapReady';

const BootstrapReadyContext = createContext(null);

/**
 * Single poll of /api/system/status + /api/system/readiness for the whole authenticated app.
 */
export function BootstrapReadyProvider({ children, pollMs = 3000, maxWaitForApiMs = 60000 }) {
  const state = useBootstrapReady(pollMs, maxWaitForApiMs);
  return (
    <BootstrapReadyContext.Provider value={state}>
      {children}
    </BootstrapReadyContext.Provider>
  );
}

export function useBootstrapReadyState() {
  const ctx = useContext(BootstrapReadyContext);
  if (!ctx) {
    throw new Error('useBootstrapReadyState must be used within BootstrapReadyProvider');
  }
  return ctx;
}
