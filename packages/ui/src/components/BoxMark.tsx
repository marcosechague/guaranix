/** The box's initials on the accent color until boxes upload their logo. */
export function BoxMark({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent font-display font-bold text-on-accent"
    >
      {initials}
    </span>
  );
}
