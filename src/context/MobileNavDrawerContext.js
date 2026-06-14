import React, { createContext, useContext } from 'react';

const noop = () => {};
const MobileNavDrawerContext = createContext(noop);

export function MobileNavDrawerProvider({ children, onRequestClose = noop }) {
  const close = typeof onRequestClose === 'function' ? onRequestClose : noop;
  return <MobileNavDrawerContext.Provider value={close}>{children}</MobileNavDrawerContext.Provider>;
}

/** No-op when not under provider or when desktop rail is shown. */
export function useCloseMobileNavDrawer() {
  return useContext(MobileNavDrawerContext);
}
