/**
 * Persistent site footer. Renders the current copyright year, verified non-dead legal links, and a direct-download link to the sample lease PDF.
 */
import { Link } from 'react-router-dom';

const FOOTER_LINKS = [
  { label: 'Help & Support', to: '/issues' },
  { label: 'Security & Retention', to: '/issues' },
];

const currentYear = new Date().getFullYear();

export default function AppFooter() {
  return (
    <footer className="w-full border-t border-surface-dim bg-surface-container-low py-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 font-label-md text-label-md text-secondary sm:flex-row sm:px-6">
        <div>© {currentYear} ClearClause Analytical Systems. All rights reserved.</div>
        <nav aria-label="Site links">
          <ul className="flex flex-wrap items-center gap-6">
            {FOOTER_LINKS.map((link) => (
              <li key={link.label}>
                <Link className="transition-colors hover:text-primary" to={link.to}>
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                className="transition-colors hover:text-primary"
                href="/samples/12-Month-Apartment-Lease.pdf"
                download
              >
                Download Sample Lease
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
