import React from 'react';
import { Link } from 'react-router-dom';
import styles from './SidebarNavLink.module.css';

export function SidebarNavLink({ to, collapsed, active, title, children, ...rest }) {
  const className = [
    styles.navLink,
    collapsed ? styles.collapsed : styles.expanded,
    active ? styles.active : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Link
      to={to}
      title={title}
      aria-current={active ? 'page' : undefined}
      className={className}
      {...rest}
    >
      {children}
    </Link>
  );
}
