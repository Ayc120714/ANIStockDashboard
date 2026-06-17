import React, {createContext, useContext} from 'react';
import {useMarketSetupAlerts} from '@hooks/useMarketSetupAlerts';

const SetupAlertsContext = createContext(null);

export function SetupAlertsProvider({enabled = true, children}) {
  const value = useMarketSetupAlerts({enabled});
  return <SetupAlertsContext.Provider value={value}>{children}</SetupAlertsContext.Provider>;
}

export function useSetupAlerts() {
  const ctx = useContext(SetupAlertsContext);
  if (!ctx) {
    return {
      entryHint: '',
      entryNavTarget: null,
      signalsBadge: undefined,
      clearEntryHint: () => {},
      clearSignalsBadge: () => {},
      refreshSetupAlerts: async () => {},
    };
  }
  return ctx;
}
