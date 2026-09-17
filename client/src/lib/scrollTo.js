/**
 * Scroll the margin/citation rail to a tagged clause anchor.
 */
export function scrollToClause(id) {
  const element = document.getElementById(`clause-${id}`);
  if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
