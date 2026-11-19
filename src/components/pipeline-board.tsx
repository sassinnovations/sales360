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
  probability: number;
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
              <strong>{column.name} ({column.cards.length})</strong>
              <span>{money(column.cards.reduce((sum, card) => sum + Number(card.amount || 0), 0))}</span>
            </header>
            {column.cards.map((card) => {
              const heat = card.probability >= 60 ? "High" : card.probability >= 30 ? "Medium" : "Low";
              return (
                <article
                  key={card.id}
                  className="deal"
                  draggable
                  onDragStart={() => setDrag(card)}
                >
                  <Link href={`/opportunities/${card.id}`}><strong>{card.name}</strong></Link>
                  <p className="muted" style={{ margin: "4px 0 0" }}>{card.accountName}</p>
                  <div className="deal-row">
                    <strong>{money(card.amount, card.currency)}</strong>
                    <span className={`pill pill-${heat.toLowerCase()}`}>{heat}</span>
                  </div>
                  <p className="muted" style={{ margin: "8px 0 0" }}>{card.ownerName}</p>
                </article>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
