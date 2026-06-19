import {useEffect, useState} from 'react';
import {resolveViewMode} from '../utils/deviceView';

export default function useDeviceViewMode() {
  const [viewMode, setViewMode] = useState(() => resolveViewMode());

  useEffect(() => {
    const sync = () => setViewMode(resolveViewMode({width: window.innerWidth}));
    sync();
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
    };
  }, []);

  return viewMode;
}
