// app/components/lab/tour/GoldDivider.js
//
// The "gold line drawing itself" flourish between a tour step's title and
// body. Parent re-keys the whole step on transition, which remounts this
// too — that's what makes the draw animation replay on every step.

export default function GoldDivider() {
  return (
    <svg className="tour-divider" width="80" height="2" viewBox="0 0 80 2" aria-hidden="true">
      <line x1="0" y1="1" x2="80" y2="1" />
    </svg>
  );
}
