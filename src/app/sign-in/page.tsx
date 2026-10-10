"use client";

import { FormEvent, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const target = useMemo(() => {
    return callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";
  }, [callbackUrl]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
        callbackUrl: target,
      });
      if (!result || result.error) {
        setError("Username atau password salah.");
        return;
      }
      window.location.href = target;
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app app-login">
      <section className="login-card">
        <h1>ARMOR</h1>
        <p>Masuk untuk input data downtime shift.</p>
        <form className="form" onSubmit={onSubmit}>
          <label>
            Username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error ? <div className="error">{error}</div> : null}
          <button className="btn btn-primary" disabled={busy} type="submit">
            {busy ? "Memeriksa…" : "Masuk"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <main className="app app-login">
          <section className="login-card">Memuat…</section>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
