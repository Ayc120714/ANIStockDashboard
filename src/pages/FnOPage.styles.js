import styled, { css } from 'styled-components';

export const PageWrapper = styled.div`
  padding: 18px 24px 32px;
  max-width: 1500px;
  margin: 0 auto;
  font-family: 'Inter', -apple-system, sans-serif;
`;

export const PageHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 18px;
`;

export const Title = styled.h1`
  font-size: 22px;
  font-weight: 700;
  color: #1a3c5e;
  margin: 0;
`;

export const ControlRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;

export const TabBar = styled.div`
  display: flex;
  border-bottom: 2px solid #e0e6ed;
  margin-bottom: 18px;
  gap: 0;
`;

export const Tab = styled.button`
  padding: 10px 22px;
  font-size: 13px;
  font-weight: 600;
  border: none;
  background: transparent;
  color: ${p => p.$active ? '#1a3c5e' : '#8899a6'};
  border-bottom: 2px solid ${p => p.$active ? '#1a3c5e' : 'transparent'};
  margin-bottom: -2px;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { color: #1a3c5e; background: #f5f8fc; }
`;

export const SummaryCards = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 18px;
`;

export const SummaryCard = styled.div`
  background: #fff;
  border: 1px solid #e0e6ed;
  border-radius: 8px;
  padding: 14px 16px;
  .label { font-size: 11px; color: #8899a6; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
  .value { font-size: 18px; font-weight: 700; color: #1a3c5e; margin-top: 4px; }
  .sub { font-size: 11px; color: #8899a6; margin-top: 2px; }
`;

export const ExpiryBar = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 14px;
`;

export const ExpiryPill = styled.button`
  padding: 5px 14px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 16px;
  border: 1px solid ${p => p.$active ? '#1a3c5e' : '#d0d7de'};
  background: ${p => p.$active ? '#1a3c5e' : '#fff'};
  color: ${p => p.$active ? '#fff' : '#4a5568'};
  cursor: pointer;
  transition: all 0.15s;
  &:hover { border-color: #1a3c5e; }
`;

export const ChainTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  thead {
    background: #1a3c5e;
    th {
      color: #fff;
      padding: 7px 8px;
      font-weight: 600;
      font-size: 11px;
      text-align: right;
      white-space: nowrap;
      &:first-child { text-align: left; }
    }
  }
  tbody tr {
    border-bottom: 1px solid #eef1f5;
    transition: background 0.12s;
    &:hover { background: #f5f8fc; }
    &:nth-child(even) { background: #fafbfc; }
    &:nth-child(even):hover { background: #f0f4f8; }
  }
  td {
    padding: 5px 8px;
    text-align: right;
    font-size: 12px;
    color: #334155;
    &:first-child { text-align: left; }
  }
`;

export const StrikeCell = styled.td`
  font-weight: 700 !important;
  text-align: center !important;
  background: ${p => p.$atm ? '#e8edf2' : 'transparent'};
  color: #1a3c5e !important;
`;

const itmBg = css`background: rgba(46,125,50,0.06);`;
const otmBg = css`background: transparent;`;

export const CeCell = styled.td`
  ${p => p.$itm ? itmBg : otmBg}
`;

export const PeCell = styled.td`
  ${p => p.$itm ? itmBg : otmBg}
`;

export const OIBar = styled.div`
  background: ${p => p.$type === 'ce' ? '#ff9800' : '#7c4dff'};
  height: 14px;
  border-radius: 2px;
  min-width: 2px;
`;

export const MoverRow = styled.tr`
  cursor: default;
  td {
    padding: 6px 10px !important;
  }
`;

export const StrategySection = styled.div`
  margin-top: 24px;
`;

export const DirectionTabs = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
`;

export const DirectionTab = styled.button`
  padding: 7px 20px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid ${p => p.$active ? '#1a3c5e' : '#d0d7de'};
  background: ${p => p.$active ? '#1a3c5e' : '#fff'};
  color: ${p => p.$active ? '#fff' : '#4a5568'};
  cursor: pointer;
  transition: all 0.15s;
`;

export const StrategyGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
  margin-bottom: 20px;
`;

export const StrategyCardEl = styled.div`
  border: 1px solid ${p => p.$active ? '#1a3c5e' : '#e0e6ed'};
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  background: ${p => p.$active ? '#edf2f7' : '#fff'};
  transition: all 0.15s;
  &:hover { border-color: #1a3c5e; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
  .name { font-size: 12px; font-weight: 600; color: #1a3c5e; }
  .desc { font-size: 10px; color: #8899a6; margin-top: 2px; }
`;

export const LegBuilder = styled.div`
  background: #f7f9fc;
  border: 1px solid #e0e6ed;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
`;

export const LegRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
  select, input {
    padding: 6px 10px;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    font-size: 12px;
    background: #fff;
  }
  input { width: 80px; }
`;

export const ChartWrapper = styled.div`
  background: #fff;
  border: 1px solid #e0e6ed;
  border-radius: 8px;
  padding: 16px;
  margin-top: 12px;
`;

export const GreeksRow = styled.div`
  display: flex;
  gap: 24px;
  margin-top: 12px;
  flex-wrap: wrap;
  .greek {
    .label { font-size: 10px; color: #8899a6; font-weight: 600; text-transform: uppercase; }
    .val { font-size: 15px; font-weight: 700; color: #1a3c5e; }
  }
`;

export const RefreshBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #fff;
  color: #4a5568;
  cursor: pointer;
  &:hover { border-color: #1a3c5e; color: #1a3c5e; }
`;

export const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: #8899a6;
  font-size: 14px;
`;
