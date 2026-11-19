import Link from "next/link";

export function BoardToggle({ current }: { current: "board" | "list" }) {
  return (
    <nav className="tabs">
      <Link className={current === "board" ? "on" : ""} href="/pipeline">Pipeline</Link>
      <Link className={current === "list" ? "on" : ""} href="/opportunities">List</Link>
    </nav>
  );
}
