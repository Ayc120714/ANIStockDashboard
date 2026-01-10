import styled from 'styled-components';

export const PageContainer = styled.div`
  padding: 20px;
  background-color: #f9f9f9;
  min-height: 100vh;
`;

export const PageTitle = styled.h1`
  font-size: 28px;
  font-weight: 800;
  color: #0b3d91;
  margin: 0 0 30px 0;
`;

export const TabContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0;
  margin-bottom: 30px;
  background-color: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

export const Tab = styled.button`
  background: ${(p) => (p.active ? '#0b3d91' : '#ffffff')};
  border: none;
  padding: 20px 24px;
  font-size: 16px;
  font-weight: 700;
  color: ${(p) => (p.active ? '#ffffff' : '#0b3d91')};
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
  text-align: center;
  border-right: ${(p) => (p.last ? 'none' : '1px solid #e0e0e0')};

  &:hover {
    background-color: ${(p) => (p.active ? '#0b3d91' : '#f0f6ff')};
    color: ${(p) => (p.active ? '#f0f6ff' : '#0b3d91')};
  }

  &:active {
    transform: scale(0.98);
  }
`;

export const TabContent = styled.div`
  display: ${(p) => (p.active ? 'block' : 'none')};
  background-color: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  animation: fadeIn 0.3s ease-in-out;

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  h2 {
    font-size: 24px;
    font-weight: 800;
    color: #0b3d91;
    margin: 0 0 20px 0;
  }

  p {
    font-size: 15px;
    color: #555;
    line-height: 1.7;
  }
`;