import styled from 'styled-components';

export const TabContainer = styled.div`
  display: flex;
  flex-wrap: nowrap;
  align-items: stretch;
  gap: 0;
  margin-bottom: 30px;
  background-color: white;
  border-radius: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x proximity;
  scroll-behavior: smooth;
  scrollbar-width: thin;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  &::-webkit-scrollbar {
    height: 5px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(11, 61, 145, 0.35);
    border-radius: 999px;
  }
`;

export const Tab = styled.button`
  flex: 0 0 auto;
  scroll-snap-align: start;
  background: ${(p) => (p.active ? '#0b3d91' : '#ffffff')};
  border: none;
  padding: 20px 24px;
  font-size: 16px;
  font-weight: 700;
  color: ${(p) => (p.active ? '#ffffff' : '#0b3d91')};
  cursor: pointer;
  transition: background-color 0.3s ease, color 0.3s ease;
  white-space: nowrap;
  text-align: center;
  border-right: ${(p) => (p.last ? 'none' : '1px solid #e0e0e0')};

  @media (max-width: 767px) {
    padding: 14px 16px;
    font-size: 14px;
  }

  &:hover {
    background-color: ${(p) => (p.active ? '#0b3d91' : '#f0f6ff')};
    color: ${(p) => (p.active ? '#f0f6ff' : '#0b3d91')};
  }

  &:active {
    transform: scale(0.98);
  }
`;
