import { act, renderHook } from '@testing-library/react';
import useDebouncedValue from './useDebouncedValue';
import { buildBrokerConsensusQueryParams } from '../utils/brokerConsensusDisplay';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('debounces search for 350ms and query params use only the committed value', () => {
    const onCommit = jest.fn();
    const { result, rerender } = renderHook(
      ({ search }) => useDebouncedValue(search, 350, onCommit),
      { initialProps: { search: '' } },
    );

    expect(jest.getTimerCount()).toBe(0);
    expect(buildBrokerConsensusQueryParams({ search: result.current }).search).toBeUndefined();

    rerender({ search: 'rel' });
    expect(result.current).toBe('');

    act(() => {
      jest.advanceTimersByTime(349);
    });
    expect(result.current).toBe('');
    expect(onCommit).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe('rel');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(buildBrokerConsensusQueryParams({ search: result.current }).search).toBe('rel');
  });

  test('cleans up a pending timer when the input changes or hook unmounts', () => {
    const onCommit = jest.fn();
    const { rerender, unmount } = renderHook(
      ({ search }) => useDebouncedValue(search, 350, onCommit),
      { initialProps: { search: '' } },
    );

    rerender({ search: 'r' });
    expect(jest.getTimerCount()).toBe(1);
    rerender({ search: 're' });
    expect(jest.getTimerCount()).toBe(1);
    unmount();
    expect(jest.getTimerCount()).toBe(0);

    act(() => {
      jest.advanceTimersByTime(350);
    });
    expect(onCommit).not.toHaveBeenCalled();
  });
});
