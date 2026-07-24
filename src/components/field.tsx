export function Field({ label, children, hint, wide = false }: { label: string; children: React.ReactNode; hint?: string; wide?: boolean }) {
  return <label className={wide ? "field field-wide" : "field"}><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}
