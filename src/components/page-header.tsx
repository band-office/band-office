import type { LucideIcon } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  icon: Icon,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <header className="content-header">
      <div className="title-block">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <div className="title-row">{Icon ? <Icon size={24} /> : null}<h1>{title}</h1></div>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="header-actions">{actions}</div> : null}
    </header>
  );
}
