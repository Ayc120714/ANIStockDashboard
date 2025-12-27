import styled from 'styled-components';

export const Container = styled.div`
  display: flex;
  flex-direction: row;
  min-height: 100vh;
  background: #fafbfc;
  padding: 24px;
`; 

export const LeftContent = styled.div`
  flex: 1;
  margin-right: 32px;
`; 

export const HeaderBar = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 18px;
  padding: 4px 6px 10px 6px;
  border-bottom: 1px solid #e5e5e5;
`; 

export const Spacer = styled.div`
  flex: 1;
`; 

export const Chips = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  margin-left: 10px;
`; 

export const Chip = styled.div`
  background: ${({ active }) => (active ? '#f48a1d' : '#ffffff')};
  color: ${({ active }) => (active ? '#ffffff' : '#555555')};
  border: 1px solid #f48a1d;
  border-radius: 18px;
  padding: 6px 18px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  min-width: 72px;
  text-align: center;
`; 

export const SearchBar = styled.input`
  border-radius: 18px;
  border: 1px solid #d5d5d5;
  padding: 7px 14px;
  width: 210px;
  font-size: 14px;
  margin-right: 12px;
  outline: none;
  background: #ffffff;
`; 
export const LegendWrapper = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

export const LegendRow = styled.div`
  width: 580px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
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
  color: #835024;
  white-space: nowrap;
`;

export const UpdatedOnDate = styled.span`
  color: #007bff;
  text-decoration: underline;
  cursor: pointer;
`;

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
 
  overflow: hidden;

  thead {
     background-color: #8b6f47;
    color: white;

    th {
      padding: 14px 16px;
      text-align: center;
      font-size: 17px;
      font-weight: 700;
      border: none;
    }
  }

  tbody tr {
    border-bottom: 1px solid #f0f0f0;

    &:hover {
      background-color: #f9f9f9;
    }
  }
`; 

export const TableRow = styled.tr`
  border-bottom: 1px solid #eaeaea;
  background: ${({ sector }) => (sector ? '#f5e1c2' : '#ffffff')};
`; 

export const TableCell = styled.td`
  text-align: center;
  font-size: 15px;
  padding: 10px 6px;
  background: ${({ highlight }) =>
    highlight === 'red'
      ? 'hsl(5, 100%, 47.6%)'
      :highlight === 'yellow'
      ? 'hsl(48, 100.00%, 50.00%)'
      : highlight === 'green'
      ? 'hsl(138, 100%, 50%)'
      : 'inherit'};
  color: ${({ highlight }) => (highlight ? '#222222' : '#222222')};
  border-radius: ${({ highlight }) => (highlight ? '6px' : '0')};
`; 

export const HeaderRow = styled.tr`
  background: #8b6f47;    /* header color */
  color: white;
  border-bottom: none;
`;

export const HeaderCell = styled.th`
  text-align: center;
  font-size: 13px;
  font-weight: 500;
  padding: 10px 6px;
  background: #8b6f47;
  color: #ffffff;
  border: none;
`;
export const SectorHeader = styled.tr`
  background: #ffefd6;

  td {
    font-size: 14px;
    color: #a25d16;
    padding: 11px 16px;
    text-align: left;
    font-weight: 700;
  }
`; 

export const RightSidebar = styled.div`
  width: 340px;
  min-width: 285px;
  background: #ffffff;
  border-radius: 10px;
  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.06);
  padding: 18px 20px 24px 18px;
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  align-self: flex-start;
`; 

export const TopPerformerTabs = styled.div`
  display: flex;
  gap: 10px;
`;

export const TopPerformerHeader = styled.div`
  font-weight: 600;
  font-size: 17px;
  margin: 6px 0 4px;
  border-radius: 18px;
  padding: 8px 22px;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;

  background: ${({ active }) => (active ? '#835024' : '#f4ede1')};
  color: ${({ active }) => (active ? '#ffffff' : '#835024')};
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
  color: ${({ under }) => (under ? '#f00' : '#4b8a4b')};
`;

export const BestChip = styled.span`
  padding: 2px 10px;
  border-radius: 14px;
  font-weight: 600;
  background: #e8f4e8;
  color: ${({ under }) => (under ? '#f00' : '#4b8a4b')};
`;


export const TopPerformerCard = styled.div`
  font-weight: 500;
  color: #835024;
  background: #f4ede1;
  border-radius: 10px;
  margin: 18px 0;
  padding: 14px 22px;
  font-size: 15px;
  display: flex;
  align-items: center;
  user-select: none;
  justify-content: space-between;
`; 

export const TopPerformerValue = styled.span`
  color: #ec8200;
  font-weight: 700;
`; 
