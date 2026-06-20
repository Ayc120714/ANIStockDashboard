import styled from 'styled-components';

export { Tab, TabContainer } from '../styles/scrollablePageTabs';

export const PageContainer = styled.div`
  padding: 20px;
  background-color: #f9f9f9;
  min-height: 100vh;

  @media (max-width: 767px) {
    padding: 12px;
  }
`;

export const PageTitle = styled.h1`
  font-size: 28px;
  font-weight: 800;
  color: #0b3d91;
  margin: 0 0 30px 0;

  @media (max-width: 767px) {
    font-size: 22px;
    margin-bottom: 16px;
  }
`;

export const TabContent = styled.div`
  display: ${(p) => (p.active ? 'block' : 'none')};
  background-color: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  animation: fadeIn 0.3s ease-in-out;

  @media (max-width: 767px) {
    padding: 16px;
  }

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