import Link from "next/link";

export function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
      </div>
      {action}
    </header>
  );
}

export function Notice({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="banner">{text}</p>;
}

export function Pill({ value }: { value: string }) {
  return <span className={`pill pill-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{value}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="card muted">{children}</p>;
}

export function Tabs({ base, current, tabs }: { base: string; current: string; tabs: { id: string; label: string }[] }) {
  return (
    <nav className="tabs">
      {tabs.map((tab) => (
        <Link key={tab.id} className={current === tab.id ? "on" : ""} href={`${base}?tab=${tab.id}`}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
