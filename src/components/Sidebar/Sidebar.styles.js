// ...existing code...
import styled, { css } from 'styled-components';
import { Link } from 'react-router-dom';

const mobileBreakpoint = '768px';

export const SidebarContainer = styled.div`
  width: ${(p) => (p.collapsed ? '72px' : '260px')};
  background:
    radial-gradient(circle at 20% -10%, rgba(59, 130, 246, 0.35), rgba(59, 130, 246, 0) 36%),
    radial-gradient(circle at 80% 12%, rgba(125, 211, 252, 0.18), rgba(125, 211, 252, 0) 28%),
    linear-gradient(180deg, #0a2f73 0%, #0a295f 52%, #081e46 100%);
  padding: ${(p) => (p.collapsed ? '16px 12px' : '24px 20px')};
  border-right: 1px solid rgba(125, 211, 252, 0.25);
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
  transition: width 200ms ease, padding 200ms ease;
  position: sticky;
  top: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;

  &::after {
    content: '';
    position: absolute;
    top: -30%;
    right: -30%;
    width: 80%;
    height: 60%;
    background: radial-gradient(circle, rgba(186, 230, 253, 0.2) 0%, rgba(186, 230, 253, 0) 70%);
    pointer-events: none;
  }

  /* Mobile: always collapsed */
  @media (max-width: ${mobileBreakpoint}) {
    width: 72px;
    padding: 16px 8px;
  }

  @media (max-width: 1366px) {
    width: ${(p) => (p.collapsed ? '72px' : '236px')};
    padding: ${(p) => (p.collapsed ? '14px 10px' : '18px 14px')};
  }

  .brand-wrap {
    margin: 0 0 18px 0;
    min-height: 56px;
    display: flex;
    align-items: center;
    justify-content: ${(p) => (p.collapsed ? 'center' : 'flex-start')};
  }

  .brand-logo {
    width: 100%;
    max-width: 230px;
    height: auto;
    object-fit: contain;
    display: ${(p) => (p.collapsed ? 'none' : 'block')};
  }

  .brand-mini {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.16);
    color: #fff;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.8px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 255, 255, 0.25);
  }

  @media (max-width: ${mobileBreakpoint}) {
    .brand-logo {
      display: none;
    }
  }
`;

export const ToggleButton = styled.button`
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.95);
  cursor: pointer;
  padding: 6px;
  margin-bottom: ${(p) => (p.collapsed ? '12px' : '20px')};
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  @media (max-width: ${mobileBreakpoint}) {
    justify-content: center;
    width: 100%;
  }
`;

export const Section = styled.div`
  margin-top: ${(p) => (p.collapsed ? '18px' : '34px')};
  padding-top: ${(p) => (p.collapsed ? '18px' : '34px')};
  border-top: 1px solid rgba(255, 255, 255, 0.2);
   @media (max-width: ${mobileBreakpoint}) {
    margin-top: 18px;
    padding-top: 18px;
  }
`;

export const SectionTitle = styled.h3`
  margin: 18px 0 14px 0;
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  color: rgba(255,255,255,0.95);
  letter-spacing: 0.8px;
  display: ${(p) => (p.collapsed ? 'none' : 'block')};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  @media (max-width: ${mobileBreakpoint}) {
    display: none;
  }
`;

/** Same pill as inactive ``:hover`` — current page uses this at rest so it matches the hover highlighter. */
const navLinkHoverHighlight = css`
  background: rgba(147, 197, 253, 0.22);
  border-color: rgba(186, 230, 253, 0.38);
  border-left-color: rgba(191, 219, 254, 0.5);
  color: #ffffff;
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.22);
`;

const navLinkActive = css`
  ${navLinkHoverHighlight}
  font-weight: 800;

  svg {
    color: #ffffff;
  }

  &:hover {
    background: rgba(147, 197, 253, 0.28);
    border-color: rgba(186, 230, 253, 0.45);
    border-left-color: rgba(191, 219, 254, 0.6);
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.24);
  }
`;

/** ``$active`` is set from ``useLocation()`` so highlight tracks route changes without relying on RR NavLink + SC class merge. */
export const NavLink = styled(Link).withConfig({
  shouldForwardProp: (prop) => prop !== 'collapsed' && prop !== '$active',
})`
  display: flex;
  align-items: center;
  justify-content: ${(p) => (p.collapsed ? 'center' : 'flex-start')};
  gap: 12px;
  padding: ${(p) => (p.collapsed ? '10px' : '13px')} ;
  margin: 10px 0;
  text-decoration: none;
  color: rgba(255, 255, 255, 0.96);
  border-radius: 8px;
  border: 1px solid transparent;
  border-left: 4px solid transparent;
  transition:
    background 0.18s ease,
    color 0.15s ease,
    transform 0.12s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
  font-size: ${(p) => (p.collapsed ? '0' : '14px')};
  font-weight: 700;
  width: 100%;
  box-sizing: border-box;
  line-height: 1.2;
  @media (max-width: ${mobileBreakpoint}) {
    justify-content: center;
    padding: 12px;
    font-size: 0; /* hide label */
  }

  svg {
    font-size: ${(p) => (p.collapsed ? '21px' : '21px')};
    color: inherit;
    flex-shrink: 0;
    @media (max-width: ${mobileBreakpoint}) {
      font-size: 24px;
    }
  }

  .label {
    display: ${(p) => (p.collapsed ? 'none' : 'inline')};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 170px;
    @media (max-width: ${mobileBreakpoint}) {
      display: none;
    }
  }

  @media (max-width: 1366px) {
    font-size: ${(p) => (p.collapsed ? '0' : '13px')};
    .label {
      max-width: 145px;
    }
  }

  /* Inactive only: same pill as current page (active uses ``navLinkHoverHighlight`` at rest). */
  &:hover {
    ${(p) => (p.$active ? css`` : navLinkHoverHighlight)}
  }

  &:focus-visible {
    outline: 2px solid rgba(191, 219, 254, 0.95);
    outline-offset: 2px;
  }

  ${(p) => p.$active && navLinkActive}
`;
// ...existing code...