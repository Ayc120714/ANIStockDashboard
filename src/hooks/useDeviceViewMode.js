import {useEffect, useState} from 'react';
import {PHONE_MAX_WIDTH_PX, buildDeviceViewContext, resolveViewMode} from '../utils/deviceView';

export default function useDeviceViewMode() {
  const [viewMode, setViewMode] = useState(() => resolveViewMode(buildDeviceViewContext()));

  useEffect(() => {
    const sync = () => setViewMode(resolveViewMode(buildDeviceViewContext()));
    sync();

    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    window.visualViewport?.addEventListener('resize', sync);

    const phoneQuery = window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH_PX}px)`);
    const onPhoneQueryChange = () => sync();
    if (phoneQuery.addEventListener) {
      phoneQuery.addEventListener('change', onPhoneQueryChange);
    } else {
      phoneQuery.addListener(onPhoneQueryChange);
    }

    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      window.visualViewport?.removeEventListener('resize', sync);
      if (phoneQuery.removeEventListener) {
        phoneQuery.removeEventListener('change', onPhoneQueryChange);
      } else {
        phoneQuery.removeListener(onPhoneQueryChange);
      }
    };
  }, []);

  return viewMode;
}
