import styled from 'styled-components';

const headerBackground = `
  radial-gradient(circle at 14% -25%, rgba(59, 130, 246, 0.28), rgba(15, 23, 42, 0) 42%),
  radial-gradient(circle at 74% 6%, rgba(125, 211, 252, 0.2), rgba(15, 23, 42, 0) 30%),
  linear-gradient(120deg, rgba(249, 252, 255, 0.98), rgba(241, 248, 255, 0.96));
`;

export const HeaderContainer = styled.div`
  position: sticky;
  top: 0;
  z-index: 35;
  padding: 12px 18px;
  border-bottom: 1px solid rgba(59, 130, 246, 0.28);
  background: ${headerBackground};
  box-shadow:
    0 6px 18px rgba(15, 23, 42, 0.12),
    0 1px 0 rgba(255, 255, 255, 0.9) inset;
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 64px;
  min-width: 0;

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

export const MobileHeaderShell = styled.div`
  position: sticky;
  top: 0;
  z-index: 35;
  border-bottom: 1px solid rgba(59, 130, 246, 0.28);
  background: ${headerBackground};
  box-shadow:
    0 6px 18px rgba(15, 23, 42, 0.12),
    0 1px 0 rgba(255, 255, 255, 0.9) inset;
  backdrop-filter: blur(6px);
  min-width: 0;
`;

export const MobileTopRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 6px;
  min-width: 0;
`;

export const MobileBrand = styled.div`
  flex: 1;
  min-width: 0;
  overflow: hidden;
`;

export const MobileBrandTitle = styled.div`
  font-size: 14px;
  font-weight: 800;
  color: #0d1b4b;
  letter-spacing: 0.04em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const MobileBrandTag = styled.div`
  font-size: 10px;
  color: #64748b;
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const MobileActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
`;

export const MobileUserStrip = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 10px;
  min-width: 0;
  background: rgba(255, 255, 255, 0.42);
  border-top: 1px solid rgba(148, 163, 184, 0.22);
`;

export const MobileUserName = styled.span`
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 700;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const MobilePlanBadge = styled.span`
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid;
  ${(p) => {
    if (p.$variant === 'Lifetime') {
      return 'color: #1565c0; border-color: rgba(21, 101, 192, 0.45); background: rgba(21, 101, 192, 0.08);';
    }
    if (p.$variant === 'Premium') {
      return 'color: #2e7d32; border-color: rgba(46, 125, 50, 0.45); background: rgba(46, 125, 50, 0.08);';
    }
    return 'color: #616161; border-color: rgba(97, 97, 97, 0.4); background: rgba(0, 0, 0, 0.04);';
  }}
`;