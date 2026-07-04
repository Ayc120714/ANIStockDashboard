import React from 'react';
import { render, screen } from '@testing-library/react';
import TradingViewLink, {
  SymbolWithTradingView,
  buildTradingViewSymbolsCsv,
  symbolCellTdStyle,
} from './TradingViewLink';

describe('buildTradingViewSymbolsCsv', () => {
  it('builds deduped NSE-prefixed comma list', () => {
    expect(buildTradingViewSymbolsCsv(['reliance', 'TCS', 'reliance', '', null])).toBe(
      'NSE:RELIANCE,NSE:TCS',
    );
  });

  it('returns empty string when no valid symbols', () => {
    expect(buildTradingViewSymbolsCsv([])).toBe('');
    expect(buildTradingViewSymbolsCsv(['', '  '])).toBe('');
  });
});

describe('TradingViewLink', () => {
  it('renders NSE chart link for equity symbol', () => {
    render(<TradingViewLink symbol="RELIANCE" />);
    const link = screen.getByTitle('View NSE:RELIANCE on TradingView');
    expect(link).toHaveAttribute(
      'href',
      'https://www.tradingview.com/chart/?symbol=NSE%3ARELIANCE',
    );
    expect(link).toHaveStyle({ flexShrink: 0 });
  });

  it('uses chartSymbol when provided', () => {
    render(<TradingViewLink chartSymbol="NSE:CNX500" />);
    const link = screen.getByTitle('View NSE:CNX500 on TradingView');
    expect(link).toHaveAttribute(
      'href',
      'https://www.tradingview.com/chart/?symbol=NSE%3ACNX500',
    );
  });

  it('returns null when symbol and chartSymbol are empty', () => {
    const { container } = render(<TradingViewLink symbol="" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('symbolCellTdStyle', () => {
  it('merges base styles with tablet overflow guards', () => {
    expect(symbolCellTdStyle({ fontWeight: 700 }, 128)).toEqual({
      fontWeight: 700,
      maxWidth: 128,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    });
  });

  it('defaults maxWidth to 140 for narrow table cells', () => {
    expect(symbolCellTdStyle()).toMatchObject({
      maxWidth: 140,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    });
  });
});

describe('SymbolWithTradingView', () => {
  it('renders symbol text after chart icon by default', () => {
    render(<SymbolWithTradingView symbol="TCS">TCS</SymbolWithTradingView>);
    expect(screen.getByText('TCS')).toBeInTheDocument();
    expect(screen.getByTitle('View NSE:TCS on TradingView')).toBeInTheDocument();
  });

  it('renders chart icon before label when iconFirst is set', () => {
    render(
      <SymbolWithTradingView chartSymbol="NSE:CNX500" iconFirst gap={6}>
        Nifty 500
      </SymbolWithTradingView>,
    );
    expect(screen.getByText('Nifty 500')).toBeInTheDocument();
    expect(screen.getByTitle('View NSE:CNX500 on TradingView')).toBeInTheDocument();
  });

  it('keeps trailing badges outside the ellipsed label (tablet overlap fix)', () => {
    render(
      <SymbolWithTradingView symbol="INFY" trailing={<span data-testid="fno-badge">F&amp;O</span>}>
        INFY
      </SymbolWithTradingView>,
    );
    expect(screen.getByText('INFY')).toHaveStyle({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      minWidth: 0,
    });
    expect(screen.getByTestId('fno-badge')).toBeInTheDocument();
  });

  it('wraps content in a width-constrained flex row for table cells', () => {
    const { container } = render(<SymbolWithTradingView symbol="AGARWALEYE">AGARWALEYE</SymbolWithTradingView>);
    const row = container.firstChild;
    expect(row).toHaveStyle({
      display: 'inline-flex',
      minWidth: 0,
      maxWidth: '100%',
      width: '100%',
    });
  });
});
