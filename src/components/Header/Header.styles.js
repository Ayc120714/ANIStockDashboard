import styled from 'styled-components';

export const HeaderContainer = styled.div`
  position: sticky;
  top: 0;
  z-index: 35;
  padding: 12px 18px;
  border-bottom: 1px solid rgba(59, 130, 246, 0.28);
  background:
    radial-gradient(circle at 14% -25%, rgba(59, 130, 246, 0.28), rgba(15, 23, 42, 0) 42%),
    radial-gradient(circle at 74% 6%, rgba(125, 211, 252, 0.2), rgba(15, 23, 42, 0) 30%),
    linear-gradient(120deg, rgba(249, 252, 255, 0.98), rgba(241, 248, 255, 0.96));
  box-shadow:
    0 6px 18px rgba(15, 23, 42, 0.12),
    0 1px 0 rgba(255, 255, 255, 0.9) inset;
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 64px;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: -30%;
    width: 38%;
    height: 100%;
    background: linear-gradient(110deg, rgba(255, 255, 255, 0), rgba(186, 230, 253, 0.3), rgba(255, 255, 255, 0));
    transform: skewX(-22deg);
    animation: headerSpark 9s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes headerSpark {
    0% { left: -35%; opacity: 0; }
    12% { opacity: 1; }
    55% { left: 115%; opacity: 0.6; }
    100% { left: 115%; opacity: 0; }
  }

  h1 {
    margin: 0;
    font-size: 24px;
    color: #333;
  }
`;