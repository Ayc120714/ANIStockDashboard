import React from 'react';
import { Link } from 'react-router-dom';
import styles from './SidebarNavLink.module.css';

export function SidebarNavLink({ to, collapsed, active, title, locked, children, ...rest }) {
  const className = [
    styles.navLink,
    collapsed ? styles.collapsed : styles.expanded,
    active ? styles.active : '',
    locked ? styles.locked : '',
  ]
    .filter(Boolean)
    .join(' ');

  const resolvedTitle =
    locked && title ? `${title} — Premium access required` : locked ? 'Premium access required' : title;

  return (
    <Link
      to={to}
      title={resolvedTitle}
      aria-current={active ? 'page' : undefined}
      className={className}
      {...rest}
    >
      {children}
    </Link>
  );
}
