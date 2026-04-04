import styled from 'styled-components';

export const TableSection = styled.div`
  margin-top: 24px;
`;

export const TableTitle = styled.h3`
  font-size: 16px;
  font-weight: 700;
  color: #0b3d91;
  margin: 0 0 12px 0;
  caret-color: transparent;
`;

export const TableWrapper = styled.div`
  overflow-x: auto;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.07);
  @media (max-width: 900px) {
    border-radius: 4px;
    box-shadow: none;
  }
`;

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  font-family: 'Segoe UI', 'Inter', 'Roboto', Arial, sans-serif;
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
      &.row-up,
      &.row-up:nth-child(even) {
        background-color: #e8f5e9;
        &:hover {
          background-color: #dff1e3;
        }
      }
      &.row-down,
      &.row-down:nth-child(even) {
        background-color: #ffebee;
        &:hover {
          background-color: #fde1e5;
        }
      }
      &.row-sideways,
      &.row-sideways:nth-child(even) {
        background-color: #e8eef5;
        &:hover {
          background-color: #dde6f0;
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
        color: #2e7d32;
        font-weight: 600;
        caret-color: transparent;
      }
      .trend-down {
        color: #c62828;
        font-weight: 600;
        caret-color: transparent;
      }
      .trend-sideways {
        color: #1565c0;
        font-weight: 600;
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
