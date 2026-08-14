/**
 * طبقة الحبيبات (noise) الثابتة فوق كل شيء — pointer-events-none.
 * الـmesh gradient نفسه متطبّق على body في styles.css.
 */
export function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="ambient-noise pointer-events-none fixed inset-0 z-50 mix-blend-soft-light"
    />
  );
}
