/**
 * Site footer shown on every screen.
 */
const FOOTER_LINKS = ['Editorial Guidelines', 'Risk Taxonomies', 'Security & Retention'];

export default function AppFooter() {
  return (
    <footer className="w-full border-t border-surface-dim bg-surface-container-low py-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 font-label-md text-label-md text-secondary sm:flex-row sm:px-6">
        <div>© 2024 ClearClause Analytical Systems. All rights reserved.</div>
        <nav aria-label="Legal">
          <ul className="flex flex-wrap items-center gap-6">
            {FOOTER_LINKS.map((label) => (
              <li key={label}>
                <a className="transition-colors hover:text-primary" href="#">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
