import { renderHook, act } from '@testing-library/react';
import { useScrollActiveTabIntoView } from './useScrollActiveTabIntoView';

describe('useScrollActiveTabIntoView', () => {
  it('scrolls horizontally within the tab bar without vertical page scroll', () => {
    const container = document.createElement('div');
    container.setAttribute('data-page-tabs', '');
    Object.defineProperty(container, 'clientWidth', { value: 200 });
    container.scrollTo = jest.fn();

    const tab = document.createElement('button');
    Object.defineProperty(tab, 'offsetLeft', { value: 120 });
    Object.defineProperty(tab, 'clientWidth', { value: 80 });
    container.appendChild(tab);
    document.body.appendChild(container);

    const { result, rerender } = renderHook(
      ({ activeKey }) => useScrollActiveTabIntoView(activeKey),
      { initialProps: { activeKey: 'market' } },
    );

    act(() => {
      result.current('sector')(tab);
    });
    rerender({ activeKey: 'sector' });

    expect(container.scrollTo).toHaveBeenCalledWith({
      left: 60,
      behavior: 'smooth',
    });

    document.body.removeChild(container);
  });
});
