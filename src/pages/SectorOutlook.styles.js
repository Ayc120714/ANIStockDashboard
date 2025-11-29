import styled from 'styled-components';

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