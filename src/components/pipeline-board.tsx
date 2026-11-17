"use client";

import Link from "next/link";
import { useState } from "react";
import { moveStage } from "@/lib/actions/crm";
import { money } from "@/lib/format";

type Card = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  closeDate: string | null;
  accountName: string | null;
  ownerName: string | null;
  version: number;
};

export function PipelineBoard({
  columns,
}: {
  columns: { id: string; name: string; total: number; cards: Card[] }[];
}) {
  const [error, setError] = useState("");
  const [drag, setDrag] = useState<Card | null>(null);

  async function drop(stageId: string) {
    if (!drag) return;
    const data = new FormData();
    data.set("id", drag.id);
    data.set("stageId", stageId);
    data.set("version", String(drag.version));
    const result = await moveStage(null, data);
    if (result?.error) setError(result.error);
    setDrag(null);
  }

  return (
    <div className="stack">
      {error ? <p className="warn">{error}</p> : null}
      <div className="board">
        {columns.map((column) => (
          <section
            key={column.id}
            className="column"
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => drop(column.id)}
          >
            <header>
              <strong>{column.name}</strong>
              <p className="muted">{money(column.total)} weighted</p>
            </header>
            {column.cards.map((card) => (
              <article
                key={card.id}
                className="deal"
                draggable
                onDragStart={() => setDrag(card)}
              >
                <Link href={`/opportunities/${card.id}`}>{card.name}</Link>
                <p className="muted">
                  {card.accountName} · {money(card.amount, card.currency)}
                </p>
                <p className="muted">{card.ownerName} · {card.closeDate?.slice(0, 10)}</p>
              </article>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
