// ...existing code...
import styled from 'styled-components';
import { Link } from 'react-router-dom';

export const SidebarContainer = styled.div`
  width: ${(p) => (p.collapsed ? '72px' : '280px')};
  background-color: #0b3d91; /* dark blue */
  padding: ${(p) => (p.collapsed ? '16px 12px' : '24px 20px')};
  border-right: 1px solid rgba(0,0,0,0.2);
  height: 100vh;
  overflow-y: auto;
  box-sizing: border-box;
  transition: width 200ms ease, padding 200ms ease;

  h2 {
    margin: 0 0 28px 0;
    color: #ffffff;
    font-size: 24px;
    font-weight: 800;
    letter-spacing: 0.4px;
    line-height: 1.1;
    display: ${(p) => (p.collapsed ? 'none' : 'block')};
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
`;

export const Section = styled.div`
  margin-top: ${(p) => (p.collapsed ? '18px' : '34px')};
  padding-top: ${(p) => (p.collapsed ? '18px' : '34px')};
  border-top: 1px solid rgba(255, 255, 255, 0.2);
`;

export const SectionTitle = styled.h3`
  margin: 18px 0 14px 0;
  font-size: 15px;
  font-weight: 800;
  text-transform: uppercase;
  color: rgba(255,255,255,0.95);
  letter-spacing: 0.8px;
  display: ${(p) => (p.collapsed ? 'none' : 'block')};
`;

export const NavLink = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: ${(p) => (p.collapsed ? 'center' : 'flex-start')};
  gap: 18px;
  padding: ${(p) => (p.collapsed ? '12px' : '18px')} ;
  margin: 10px 0;
  text-decoration: none;
  color: rgba(255,255,255,0.98);
  border-radius: 10px;
  transition: background-color 0.15s, color 0.15s, transform 0.08s;
  font-size: ${(p) => (p.collapsed ? '0' : '20px')};
  font-weight: 700;
  width: 100%;
  box-sizing: border-box;
  line-height: 1.2;

  svg {
    font-size: ${(p) => (p.collapsed ? '24px' : '28px')};
    color: inherit;
    flex-shrink: 0;
  }

  .label {
    display: ${(p) => (p.collapsed ? 'none' : 'inline')};
    white-space: nowrap;
  }

  &:hover {
    background-color: rgba(255,255,255,0.07);
    transform: translateY(-1px);
  }

  &.active {
    background-color: rgba(255,255,255,0.12);
    color: #ffffff;
  }
`;
// ...existing code...