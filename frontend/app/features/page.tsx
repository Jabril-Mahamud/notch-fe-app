"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, session, type Feature } from "@/lib/api";

export default function Features() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [user, setUser] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", body: "", website: "" });

  const load = () =>
    api<Feature[]>("/features").then(setFeatures).catch((e) => setError(e.message));

  useEffect(() => {
    setUser(session.user());
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/features", { method: "POST", body: JSON.stringify(form) });
      setForm({ title: "", body: "", website: "" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function vote(id: number) {
    setError("");
    try {
      await api(`/features/${id}/vote`, { method: "POST" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <h1>Feature requests</h1>
      {error && <p className="error">{error}</p>}

      {user ? (
        <form onSubmit={submit}>
          <h2>Ask for something</h2>
          <input
            placeholder="Title"
            value={form.title}
            minLength={3}
            maxLength={200}
            required
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <textarea
            placeholder="What should it do, and why?"
            rows={4}
            value={form.body}
            minLength={3}
            required
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
          <div className="hp" aria-hidden="true">
            <label>
              Website
              <input
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </label>
          </div>
          <button className="primary" type="submit">
            Submit
          </button>
        </form>
      ) : (
        <p>
          <Link href="/login">Sign in</Link> to post a request or vote.
        </p>
      )}

      <h2>Open requests</h2>
      {features.length === 0 && <p>Nothing yet.</p>}
      {features.map((f) => (
        <div key={f.id} className="card row">
          <button
            className="vote"
            data-voted={f.voted}
            disabled={!user}
            onClick={() => vote(f.id)}
            title={user ? "Toggle your vote" : "Sign in to vote"}
          >
            ▲ {f.votes}
          </button>
          <div>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
            <p className="muted">
              {f.author} · {new Date(f.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      ))}
    </>
  );
}
