import styled from 'styled-components';

export const CardContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 24px;
`;

export const Card = styled.div`
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 18px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    transform: translateY(-2px);
  }
`;

export const CashCardContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1.2fr;
  gap: 20px;
  margin-bottom: 24px;
  grid-template-areas:
    "fii dii smallcap";
`;

export const CashCard = styled(Card)`
  background: #f8f9fa;
  min-height: 400px;
  display: flex;
  flex-direction: column;

  &:nth-child(1) {
    grid-area: fii;
  }

  &:nth-child(2) {
    grid-area: dii;
  }
`;

export const SmallCardContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  grid-area: smallcap;

  ${Card}:nth-child(1) {
    grid-column: 1 / -1;
  }

  ${Card}:nth-child(2) {
    grid-column: 1;
  }

  ${Card}:nth-child(3) {
    grid-column: 2;
  }
`;

export const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;

  h3 {
    font-size: 15px;
    font-weight: 700;
    color: #1a1a1a;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .trend-badge {
    background-color: #d4edda;
    color: #155724;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    white-space: nowrap;
  }
`;

export const CardValue = styled.div`
  font-size: 24px;
  font-weight: 800;
  color: #0b3d91;
  margin: 8px 0;
`;

export const CardChange = styled.div`
  font-size: 13px;
  color: #666;
  margin: 6px 0;
`;

export const CardStats = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #999;
  margin: 8px 0;
`;

export const CardChart = styled.div`
  width: 100%;
  height: 60px;
  margin-top: 12px;

  svg {
    width: 100%;
    height: 100%;
  }
`;

export const CashTitle = styled.h3`
  font-size: 15px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 4px 0;
`;

export const CashSubtitle = styled.p`
  font-size: 12px;
  color: #999;
  margin: 0 0 12px 0;
  font-weight: 500;
`;

export const CashValue = styled.div`
  font-size: 22px;
  font-weight: 800;
  color: #0b3d91;
  margin: 8px 0;
`;

export const BarChart = styled.div`
  width: 100%;
  height: 100px;
  margin-top: 16px;
  flex: 1;

  svg {
    width: 100%;
    height: 100%;
  }
`;

export const TableSection = styled.div`
  margin-top: 40px;
`;

export const TableTitle = styled.h3`
  font-size: 18px;
  font-weight: 700;
  color: #0b3d91;
  margin: 0 0 16px 0;
`;

export const TableWrapper = styled.div`
  overflow-x: auto;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
`;

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;

  thead {
    background-color: #8b6f47;
    color: white;

    th {
      padding: 14px 16px;
      text-align: left;
      font-size: 14px;
      font-weight: 700;
      border: none;
    }
  }

  tbody {
    tr {
      border-bottom: 1px solid #f0f0f0;
      transition: background-color 0.2s;

      &:hover {
        background-color: #f9f9f9;
      }

      td {
        padding: 14px 16px;
        font-size: 13px;
        color: #333;
      }

      .index {
        font-weight: 700;
        color: #0b3d91;
      }

      .trend-up {
        color: #28a745;
        font-weight: 700;
      }

      .trend-down {
        color: #dc3545;
        font-weight: 700;
      }

      .percentage {
        background-color: #fff3cd;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: 600;
      }
    }
  }
`;