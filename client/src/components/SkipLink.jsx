/**
 * Skip link for keyboard users — jumps to #main-content on every screen.
 */
export default function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary focus:shadow-sm"
    >
      Skip to main content
    </a>
  );
}
