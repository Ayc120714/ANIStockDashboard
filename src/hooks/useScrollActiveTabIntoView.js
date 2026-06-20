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
    const container = element?.closest?.('[data-page-tabs]');
    if (!element || !container) return;

    const targetLeft = element.offsetLeft - container.clientWidth / 2 + element.clientWidth / 2;
    container.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: 'smooth',
    });
  }, [activeKey]);

  return setTabRef;
}
