"use client";

import { useState } from "react";
import CopyButton from "./copy-button";
import PasswordInput from "./password-input";

const EXPIRY_OPTIONS = [
  { value: "never", label: "Never expire" },
  { value: "1h", label: "1 hour" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
] as const;

type CreateResponse = { code: string; url: string };

export default function PasteEditor() {
  const [content, setContent] = useState("");
  const [password, setPassword] = useState("");
  const [burnAfterRead, setBurnAfterRead] = useState(false);
  const [expiresIn, setExpiresIn] = useState<string>("1h");
  const [result, setResult] = useState<CreateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/pastes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          password: password || undefined,
          burnAfterRead,
          expiresIn,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create paste");
        setLoading(false);
        return;
      }
      setResult(data);
      setContent("");
      setPassword("");
      setBurnAfterRead(false);
      setExpiresIn("1h");
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  if (result) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Your paste is ready!</h2>
        <div className="flex flex-col items-stretch gap-2 rounded-md border border-zinc-300 bg-zinc-50 p-3 sm:flex-row sm:items-center dark:border-zinc-700 dark:bg-zinc-800">
          <span className="min-w-0 flex-1 break-all font-mono text-sm sm:truncate">
            {result.url}
          </span>
          <div className="shrink-0">
            <CopyButton text={result.url} />
          </div>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Share this link. Once someone opens it, they can read the content.
        </p>
        <button
          type="button"
          onClick={() => setResult(null)}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Create another paste
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      autoComplete="off"
      className="flex w-full max-w-3xl flex-col gap-4"
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Paste or type your text here..."
        className="min-h-[240px] w-full resize-y rounded-xl border border-zinc-300 bg-white p-4 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 sm:min-h-[320px] dark:border-zinc-700 dark:bg-zinc-900"
        required
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Expiration</span>
          <select
            value={expiresIn}
            onChange={(e) => setExpiresIn(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {EXPIRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Password (optional)</span>
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder="Protect with a password"
          />
        </label>

        <label className="mt-auto flex items-center gap-2 pb-2">
          <input
            type="checkbox"
            checked={burnAfterRead}
            onChange={(e) => setBurnAfterRead(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          <span className="text-sm font-medium">Burn after reading</span>
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || !content.trim()}
        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 sm:w-auto w-full"
      >
        {loading ? "Creating..." : "Create paste"}
      </button>
    </form>
  );
}
