import { useEffect, useRef, useState } from 'react';

export default function useDebouncedValue(value, delayMs = 350, onCommit) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    if (Object.is(value, debouncedValue)) return undefined;

    const timer = setTimeout(() => {
      onCommitRef.current?.(value);
      setDebouncedValue(value);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [value, delayMs, debouncedValue]);

  return debouncedValue;
}
