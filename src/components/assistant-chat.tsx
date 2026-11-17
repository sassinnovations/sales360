"use client";

import { useState } from "react";
import Link from "next/link";
import { askAssistant, recordDraft } from "@/lib/actions/assistant";
import type { AssistantReply } from "@/lib/types";

type Turn = { role: "user" | "assistant"; text: string; reply?: AssistantReply };

const PROMPTS = ["My tasks", "Pipeline", "Summarize Lumen Health", "Hot leads", "Draft a follow-up to Helen Cho"];

export function AssistantChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, { subject: string; body: string }>>({});

  async function ask(question: string) {
    const text = question.trim();
    if (!text) return;
    setPending(true);
    setTurns((current) => [...current, { role: "user", text }]);
    const reply = await askAssistant(text);
    setTurns((current) => [...current, { role: "assistant", text: reply.text, reply }]);
    setPending(false);
  }

  return (
    <div className="stack">
      <div className="demo">
        {PROMPTS.map((prompt) => (
          <button key={prompt} className="btn-ghost" type="button" onClick={() => ask(prompt)}>
            {prompt}
          </button>
        ))}
      </div>
      <form
        className="card stack"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void ask(String(data.get("q") ?? ""));
          event.currentTarget.reset();
        }}
      >
        <label className="field">
          <span>Ask about records you can access</span>
          <input name="q" placeholder="Summarize Meridian Bank" />
        </label>
        <button className="btn-primary" disabled={pending}>
          {pending ? "Looking through your records…" : "Ask"}
        </button>
      </form>
      <div className="chat">
        {turns.map((turn, index) => (
          <article key={`${turn.role}-${index}`} className={`bubble ${turn.role === "user" ? "user" : "bot"}`}>
            <p style={{ margin: 0 }}>{turn.text}</p>
            {turn.reply?.sources?.length ? (
              <p>
                Sources:{" "}
                {turn.reply.sources.map((source) => (
                  <Link key={source.href} href={source.href}>
                    {source.label}{" "}
                  </Link>
                ))}
              </p>
            ) : null}
            {turn.reply?.draft ? (
              <form action={recordDraft} className="stack">
                <input type="hidden" name="relatedType" value={turn.reply.draft.relatedType} />
                <input type="hidden" name="relatedId" value={turn.reply.draft.relatedId} />
                <input type="hidden" name="confirm" value="yes" />
                <label className="field">
                  Subject
                  <input
                    name="subject"
                    value={drafts[index]?.subject ?? turn.reply.draft.subject}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [index]: { subject: event.target.value, body: current[index]?.body ?? turn.reply!.draft!.body },
                      }))
                    }
                  />
                </label>
                <label className="field">
                  Message
                  <textarea
                    name="body"
                    value={drafts[index]?.body ?? turn.reply.draft.body}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [index]: { body: event.target.value, subject: current[index]?.subject ?? turn.reply!.draft!.subject },
                      }))
                    }
                  />
                </label>
                <button className="btn-primary">Record on timeline</button>
                <p className="muted">This does not send email. It saves the draft you approved against the contact.</p>
              </form>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
