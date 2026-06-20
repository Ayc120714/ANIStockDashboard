import {useEffect, useState} from 'react';
import {PHONE_MAX_WIDTH_PX, buildDeviceViewContext, resolveViewMode} from '../utils/deviceView';

const MEDIA_QUERIES = [
  `(max-width: ${PHONE_MAX_WIDTH_PX}px)`,
  '(pointer: coarse)',
  '(hover: none)',
];

export default function useDeviceViewMode() {
  const [viewMode, setViewMode] = useState(() => resolveViewMode(buildDeviceViewContext()));

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      if (!cancelled) {
        setViewMode(resolveViewMode(buildDeviceViewContext()));
      }
    };

    sync();
    requestAnimationFrame(sync);

    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);

    const mediaListeners = MEDIA_QUERIES.map(query => {
      const mql = window.matchMedia(query);
      const onChange = () => sync();
      if (mql.addEventListener) {
        mql.addEventListener('change', onChange);
      } else {
        mql.addListener(onChange);
      }
      return {mql, onChange};
    });

    return () => {
      cancelled = true;
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      mediaListeners.forEach(({mql, onChange}) => {
        if (mql.removeEventListener) {
          mql.removeEventListener('change', onChange);
        } else {
          mql.removeListener(onChange);
        }
      });
    };
  }, []);

  return viewMode;
}
