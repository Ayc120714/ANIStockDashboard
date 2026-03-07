import styled from 'styled-components';

export const CardContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 24px;
  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
    gap: 12px;
  }
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
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 24px;
  grid-template-areas:
    "fii dii small"
    "fii dii small";
  grid-auto-rows: auto;
  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
    grid-template-areas: "fii" "dii" "small";
    gap: 12px;
  }
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
  grid-area: small;
  display: grid;
  grid-template-rows: auto auto;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  align-items: start;
  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
    gap: 12px;
  }
`;

/* utility cards to place correctly inside SmallCardContainer */
export const SmallFull = styled(Card)`
  grid-row: 1 / 2;
  grid-column: 1 / 3;
`;

export const SmallHalf = styled(Card)`
  grid-row: 2 / 3;
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
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .trend-badge.up {
    background-color: #d4edda;
    color: #155724;
  }
  .trend-badge.down {
    background-color: #f8d7da;
    color: #721c24;
  }
  .trend-badge.sideways {
    background-color: #e2e3e5;
    color: #495057;
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
  @media (max-width: 900px) {
    border-radius: 0;
    box-shadow: none;
    padding: 4px;
  }
`;

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  thead {
    background-color: #1a3c5e;
    color: white;
    th {
      padding: 8px 10px;
      text-align: left;
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
  tbody {
    tr {
      border-bottom: 1px solid #f0f0f0;
      transition: background-color 0.15s;
      &:hover {
        background-color: #f5f8fc;
      }
      &:nth-child(even) {
        background-color: #fafbfc;
        &:hover {
          background-color: #f0f4f8;
        }
      }
      td {
        padding: 6px 10px;
        font-size: 12px;
        color: #333;
        white-space: nowrap;
        caret-color: transparent;
      }
      .index {
        font-weight: 600;
        color: #888;
        caret-color: transparent;
      }
      .trend-up {
        background-color: #e8f5e9;
        color: #2e7d32;
        font-weight: 600;
        border-radius: 4px;
        padding: 2px 6px;
        caret-color: transparent;
      }
      .trend-down {
        background-color: #ffebee;
        color: #c62828;
        font-weight: 600;
        border-radius: 4px;
        padding: 2px 6px;
        caret-color: transparent;
      }
      .percentage {
        background-color: #fff3cd;
        padding: 2px 6px;
        border-radius: 3px;
        font-weight: 600;
        caret-color: transparent;
      }
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