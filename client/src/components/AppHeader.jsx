import { NavLink } from 'react-router-dom';
import Logo from './Logo.jsx';

const NAV_LINKS = [
  { to: '/', label: 'Analyze', dataPath: 'analyze', exact: true },
  { to: '/qa', label: 'Q&A', dataPath: 'qa' },
  { to: '/checklist', label: 'Lawyer Prep', dataPath: 'checklist' },
  { to: '/compare', label: 'Compare', dataPath: 'compare' },
  { to: '/issues', label: 'Help', dataPath: 'issues' },
];

function navClass({ isActive }) {
  return `px-3 py-1.5 font-label-md text-label-md font-semibold transition-colors ${
    isActive
      ? 'bg-primary text-on-primary'
      : 'text-secondary hover:bg-surface-container-high hover:text-primary'
  }`;
}

export default function AppHeader() {
  return (
    <header className="w-full border-b border-surface-dim bg-surface-container-lowest">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <NavLink to="/" aria-label="ClearClause home" className="shrink-0">
          <Logo className="h-6" />
        </NavLink>
        <nav aria-label="Primary">
          <ul className="flex flex-wrap items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  data-path={link.dataPath}
                  end={link.exact}
                  className={navClass}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
