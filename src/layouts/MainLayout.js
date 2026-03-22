import React from 'react';
import { Outlet } from 'react-router';
import Sidebar from '../components/Sidebar/Sidebar';
import Header from '../components/Header/Header';
import styled from 'styled-components';

const LayoutContainer = styled.div`
  display: flex;
  height: 100dvh;
  width: 100%;
  overflow: hidden;
`;

const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const ContentArea = styled.div`
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: 18px;
  background:
    radial-gradient(circle at 10% 8%, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0) 34%),
    radial-gradient(circle at 92% 20%, rgba(125, 211, 252, 0.1), rgba(125, 211, 252, 0) 32%),
    linear-gradient(180deg, #f8faff 0%, #f2f7ff 45%, #f9fbff 100%);

  /* Global "rich highlight" look for cards/panels across pages */
  .MuiPaper-root,
  .MuiCard-root {
    border: 1px solid rgba(148, 163, 184, 0.22);
    box-shadow:
      0 8px 22px rgba(15, 23, 42, 0.08),
      0 1px 0 rgba(255, 255, 255, 0.85) inset;
    background:
      linear-gradient(165deg, rgba(255, 255, 255, 0.97), rgba(246, 250, 255, 0.95));
    position: relative;
    overflow: hidden;
  }

  .MuiPaper-root::after,
  .MuiCard-root::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -40%;
    width: 60%;
    height: 180%;
    background: linear-gradient(115deg, rgba(255, 255, 255, 0), rgba(186, 230, 253, 0.2), rgba(255, 255, 255, 0));
    transform: rotate(12deg);
    animation: cardSparkle 10s ease-in-out infinite;
    pointer-events: none;
  }

  .MuiTableHead-root .MuiTableCell-root {
    background: linear-gradient(180deg, rgba(226, 238, 255, 0.82), rgba(243, 248, 255, 0.78));
    color: #1e3a8a;
    font-weight: 700;
  }

  .MuiTabs-root {
    border-radius: 12px;
    background: linear-gradient(110deg, rgba(239, 246, 255, 0.92), rgba(226, 238, 255, 0.88));
    border: 1px solid rgba(59, 130, 246, 0.22);
    overflow: hidden;
  }

  .MuiTab-root {
    color: #1e3a8a;
    font-weight: 700;
    text-transform: none;
  }

  .MuiTab-root.Mui-selected {
    color: #ffffff !important;
    background: linear-gradient(100deg, #2563eb, #0ea5e9);
  }

  @keyframes cardSparkle {
    0% { left: -45%; opacity: 0; }
    10% { opacity: 0.8; }
    50% { left: 120%; opacity: 0.35; }
    100% { left: 120%; opacity: 0; }
  }
`;

function MainLayout() {
  return (
    <LayoutContainer>
      <Sidebar />
      <MainContent>
        <Header />
        <ContentArea>
          <Outlet />
        </ContentArea>
      </MainContent>
    </LayoutContainer>
  );
}

export default MainLayout;