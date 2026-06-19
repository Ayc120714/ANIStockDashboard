import styled from 'styled-components';

export const AppRoot = styled.div`
  display: flex;
  flex-direction: column;
  height: 100dvh;
  width: 100%;
  overflow: hidden;
  background: #f2f7ff;
`;

export const MainColumn = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

export const AppContent = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px 12px 8px;
  background:
    radial-gradient(circle at 10% 8%, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0) 34%),
    linear-gradient(180deg, #f8faff 0%, #f2f7ff 45%, #f9fbff 100%);
`;

export const BottomNav = styled.nav`
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 2px;
  padding: 6px 4px calc(6px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid rgba(148, 163, 184, 0.35);
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 -4px 18px rgba(15, 23, 42, 0.08);
`;

export const BottomNavButton = styled.button`
  appearance: none;
  border: 0;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 52px;
  padding: 4px 2px;
  border-radius: 10px;
  cursor: pointer;
  color: ${p => (p.$active ? '#0d1b4b' : '#64748b')};
  background: ${p => (p.$active ? 'rgba(37, 99, 235, 0.08)' : 'transparent')};
`;

export const BottomNavIcon = styled.span`
  font-size: 18px;
  line-height: 1;
  opacity: ${p => (p.$active ? 1 : 0.62)};
`;

export const BottomNavLabel = styled.span`
  font-size: 10px;
  font-weight: ${p => (p.$active ? 800 : 700)};
  line-height: 1.1;
  text-align: center;
`;
