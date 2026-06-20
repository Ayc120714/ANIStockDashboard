import { useCallback, useEffect, useRef } from 'react';

export function useScrollActiveTabIntoView(activeKey) {
  const tabRefs = useRef({});

  const setTabRef = useCallback(
    (key) => (element) => {
      tabRefs.current[key] = element;
    },
    [],
  );

  useEffect(() => {
    const element = tabRefs.current[activeKey];
    element?.scrollIntoView?.({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }, [activeKey]);

  return setTabRef;
}
