import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { isNavItemActive } from './navUtils';

/**
 * Horizontally scrollable section nav shown under the header on small
 * screens, where the desktop header links are hidden.
 */
const MobileNavStrip = ({ items, accent = 'var(--brand-green)', label = 'Sections' }) => {
  const { pathname } = useLocation();

  return (
    <nav className="mobile-nav-strip" aria-label={label}>
      {items.map(item => {
        const active = isNavItemActive(pathname, item.path);
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`mobile-nav-link ${active ? 'is-active' : ''}`}
            style={active ? { color: accent, borderColor: accent } : undefined}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
};

export default MobileNavStrip;
