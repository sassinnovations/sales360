import Link from "next/link";

export function StaffingTabs({ current }: { current: string }) {
  const tabs = [
    ["/requirements", "Requirements"],
    ["/candidates", "Candidates"],
    ["/submissions", "Submissions"],
    ["/placements", "Placements"],
  ];
  return (
    <nav className="tabs">
      {tabs.map(([href, label]) => (
        <Link key={href} className={current === href ? "on" : ""} href={href}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function BoardToggle({ current }: { current: "board" | "list" }) {
  return (
    <nav className="tabs">
      <Link className={current === "board" ? "on" : ""} href="/pipeline">Pipeline</Link>
      <Link className={current === "list" ? "on" : ""} href="/opportunities">List</Link>
    </nav>
  );
}
