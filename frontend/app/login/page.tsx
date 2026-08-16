"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, session } from "@/lib/api";

type Auth = { token: string; username: string };

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ username: "", password: "", website: "" });
  const [user, setUser] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => setUser(session.user()), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await api<Auth>(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      session.save(res.token, res.username);
      router.push("/features");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (user) {
    return (
      <>
        <h1>Signed in as {user}</h1>
        <button
          onClick={() => {
            session.clear();
            setUser(null);
          }}
        >
          Sign out
        </button>
      </>
    );
  }

  return (
    <>
      <h1>{mode === "login" ? "Sign in" : "Create an account"}</h1>
      {error && <p className="error">{error}</p>}
      <form onSubmit={submit}>
        <input
          placeholder="Username"
          value={form.username}
          minLength={3}
          maxLength={64}
          pattern="[A-Za-z0-9_.\-]+"
          required
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <input
          type="password"
          placeholder="Password (8+ characters)"
          value={form.password}
          minLength={8}
          maxLength={128}
          required
          onChange={(e) => setForm({ ...form, password: e.target.value })}
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
          {mode === "login" ? "Sign in" : "Register"}
        </button>
      </form>
      <p>
        <button onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Need an account?" : "Already have one?"}
        </button>
      </p>
    </>
  );
}
