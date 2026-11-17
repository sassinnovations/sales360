import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { searchAll } from "@/lib/queries";
import { q } from "@/lib/search";

export const instant = false;

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  const term = q((await searchParams).q);
  const results = term ? searchAll(user, term) : [];
  return (
    <div className="stack">
      <PageHeader eyebrow="Workspace" title="Search" />
      <form className="card" action="/search">
        <input name="q" defaultValue={term} aria-label="Search" placeholder="Try Meridian, Java, or Helen" />
        <button className="btn-primary">Search</button>
      </form>
      {term && results.length === 0 ? <p className="muted">No permitted records match.</p> : null}
      {results.map((result) => (
        <article key={`${result.type}-${result.id}`} className="card">
          <p className="eyebrow">{result.type}</p>
          <h2><Link href={result.href}>{result.title}</Link></h2>
          <p className="muted">{result.meta}</p>
        </article>
      ))}
    </div>
  );
}
