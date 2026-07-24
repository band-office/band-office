export function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase().replaceAll("_", "-");
  return <span className={`pill pill-${normalized}`}>{value.replaceAll("_", " ").toLowerCase()}</span>;
}
