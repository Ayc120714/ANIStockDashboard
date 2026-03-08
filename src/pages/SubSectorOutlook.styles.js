import styled from 'styled-components';

export const Container = styled.div`
  display: flex;
  flex-direction: row;
  gap: 18px;
  min-width: 0;
  @media (max-width: 1200px) {
    flex-direction: column;
  }
`;

export const LeftContent = styled.div`
  flex: 1;
  min-width: 0;
  overflow-x: hidden;
`;

export const HeaderBar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 18px;
  padding: 4px 6px 10px 6px;
  border-bottom: 1px solid #e5e5e5;
  min-width: 0;

  @media (max-width: 1450px) {
    align-items: flex-start;
  }
`; 

export const Spacer = styled.div`
  flex: 1;
  min-width: 20px;
  @media (max-width: 1450px) {
    display: none;
  }
`; 

export const Chips = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  margin-left: 10px;
  flex-wrap: wrap;
  min-width: 0;
  @media (max-width: 1450px) {
    margin-left: 0;
  }
`; 

export const Chip = styled.div`
  background: ${({ active }) => (active ? '#1a3c5e' : '#ffffff')};
  color: ${({ active }) => (active ? '#ffffff' : '#555555')};
  border: 1px solid #1a3c5e;
  border-radius: 18px;
  padding: 6px 18px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  min-width: 72px;
  text-align: center;
  caret-color: transparent;
`; 

export const SearchBar = styled.input`
  border-radius: 18px;
  border: 1px solid #d5d5d5;
  padding: 7px 14px;
  width: 210px;
  max-width: 100%;
  font-size: 14px;
  margin-right: 12px;
  outline: none;
  background: #ffffff;

  @media (max-width: 1450px) {
    width: 180px;
    margin-right: 6px;
  }
`; 
export const LegendWrapper = styled.div`
  width: 100%;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1 1 320px;

  @media (max-width: 1450px) {
    order: 4;
    flex-basis: 100%;
    min-width: 0;
    align-items: stretch;
    margin-top: 4px;
  }
`;

export const LegendRow = styled.div`
  width: 100%;
  max-width: 580px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  caret-color: transparent;

  @media (max-width: 1450px) {
    max-width: none;
  }
`;

export const LegendBar = styled.div`
  width: 100%;
  display: flex;
  height: 8px;
  border-radius: 10px;
  overflow: hidden;
`;

export const LegendBlockWeak = styled.div`
  flex: 3;
  background: hsl(5, 100%, 47.6%);
`;

export const LegendBlockModerate = styled.div`
  flex: 3;
  background: hsl(48, 100.00%, 50.00%);
`;

export const LegendBlockStrong = styled.div`
  flex: 3;
  background: hsl(138, 100%, 50%);
`;

export const LegendLabelGroup = styled.div`
  flex: 1;
  display: flex;
`;

export const LegendLabelCol = styled.div`
  flex: ${({ flex }) => flex || 1};
  text-align: center;
`;

export const LegendText = styled.div`
  font-size: 15px;
  color: #8b8b8b;
`;

export const LegendTextStrong = styled.span`
  color: #379d5a;
  font-weight: 600;
`;

export const UpdatedOn = styled.div`
  font-size: 13px;
  color: #1a3c5e;
  white-space: nowrap;
`;

export const UpdatedOnDate = styled.span`
  color: #007bff;
  text-decoration: underline;
  cursor: pointer;
`;

export const Table = styled.table`
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
  overflow: hidden;
  font-size: 12px;
  font-family: 'Segoe UI', 'Inter', 'Roboto', Arial, sans-serif;
  caret-color: transparent;
  thead {
    background-color: #1a3c5e;
    color: white;
    th {
      padding: 8px 10px;
      text-align: center;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
      border: none;
      letter-spacing: 0.2px;
      caret-color: transparent;
      cursor: pointer;
      user-select: none;
      &:hover {
        background: rgba(255, 255, 255, 0.08);
      }
    }
  }
  tbody tr {
    border-bottom: 1px solid #f0f0f0;
    transition: background-color 0.15s;
    &:hover {
      background-color: #f5f8fc;
    }
  }
  @media (max-width: 900px) {
    font-size: 11px;
    thead th, tbody td {
      padding: 5px 6px;
      font-size: 11px;
    }
  }
`;

export const TableScroll = styled.div`
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
`;

export const TableRow = styled.tr`
  border-bottom: 1px solid #f0f0f0;
  background: ${({ sector }) => (sector ? '#e8edf2' : '#ffffff')};
  &:hover {
    background-color: ${({ sector }) => (sector ? '#dce3eb' : '#f5f8fc')};
  }
  &.row-up {
    background-color: #e8f5e9;
    &:hover {
      background-color: #dff1e3;
    }
  }
  &.row-down {
    background-color: #ffebee;
    &:hover {
      background-color: #fde1e5;
    }
  }
`; 

export const TableCell = styled.td`
  text-align: center;
  font-size: 12px;
  padding: 6px 8px;
  background: ${({ highlight }) => highlight || 'inherit'};
  color: #333;
  border-radius: ${({ highlight }) => (highlight ? '4px' : '0')};
  white-space: nowrap;
  caret-color: transparent;
  &.trend-up {
    color: #2e7d32;
    font-weight: 600;
  }
  &.trend-down {
    color: #c62828;
    font-weight: 600;
  }
`; 

export const HeaderRow = styled.tr`
  background: #1a3c5e;
  color: white;
  border-bottom: none;
  caret-color: transparent;
`;

export const HeaderCell = styled.th`
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  padding: 8px 10px;
  background: #1a3c5e;
  color: #ffffff;
  border: none;
  letter-spacing: 0.2px;
  white-space: nowrap;
  caret-color: transparent;
`;
export const SectorHeader = styled.tr`
  background: #e3eaf2;

  td {
    font-size: 12px;
    color: #1a3c5e;
    padding: 8px 12px;
    text-align: left;
    font-weight: 700;
  }
`; 

export const RightSidebar = styled.div`
  width: 300px;
  min-width: 280px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.07);
  padding: 16px 18px 20px 16px;
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  align-self: flex-start;
  @media (max-width: 1200px) {
    width: 100%;
    min-width: 0;
    margin-top: 24px;
    padding: 12px 8px;
    box-shadow: none;
  }

  @media (max-width: 1450px) and (min-width: 1201px) {
    width: 280px;
    min-width: 260px;
    padding: 12px 12px 16px 12px;
  }
`;

export const TopPerformerTabs = styled.div`
  display: flex;
  gap: 10px;
`;

export const TopPerformerHeader = styled.div`
  font-weight: 600;
  font-size: 14px;
  margin: 6px 0 4px;
  border-radius: 18px;
  padding: 8px 16px;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;

  background: ${({ active }) => (active ? '#1a3c5e' : '#e8edf2')};
  color: ${({ active }) => (active ? '#ffffff' : '#1a3c5e')};
`;

export const BestLabelRow = styled.div`
  margin-top: 14px;
  margin-bottom: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  user-select: none;
`;

export const BestLabel = styled.span`
  font-weight: 600;
  color: ${({ under }) => (under ? '#c62828' : '#2e7d32')};
`;

export const BestChip = styled.span`
  padding: 2px 10px;
  border-radius: 14px;
  font-weight: 600;
  background: ${({ under }) => (under ? '#fce4ec' : '#e8f5e9')};
  color: ${({ under }) => (under ? '#c62828' : '#2e7d32')};
`;


export const TopPerformerCard = styled.div`
  font-weight: 500;
  color: #1a3c5e;
  background: #e8edf2;
  border-radius: 8px;
  margin: 12px 0;
  padding: 12px 18px;
  font-size: 13px;
  display: flex;
  align-items: center;
  user-select: none;
  justify-content: space-between;
`; 

export const TopPerformerValue = styled.span`
  color: #0b3d91;
  font-weight: 700;
`; 
