"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import CopyButton from "./copy-button";
import PasswordInput from "./password-input";
import {
  bytesToBase64,
  generateContentKey,
  deriveKeyFromPassword,
  prepareFileForUpload,
} from "@/lib/client-crypto";
import { MAX_FILE_BYTES, MAX_FILES_PER_PASTE, MAX_PASTE_TOTAL_BYTES } from "@/lib/validation";

const EXPIRY_OPTIONS = [
  { value: "never", label: "Never expire" },
  { value: "1h", label: "1 hour" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
] as const;

type CreateResponse = { code: string; url: string };
type FileMeta = {
  pathname: string;
  filename: string;
  mime: string;
  size: number;
  iv: string;
  authTag: string;
  compression: "deflate" | "none";
};

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

export default function PasteEditor() {
  const [content, setContent] = useState("");
  const [password, setPassword] = useState("");
  const [burnAfterRead, setBurnAfterRead] = useState(false);
  const [expiresIn, setExpiresIn] = useState<string>("1h");
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<CreateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

  function onSelectFiles(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list);
    for (const f of next) {
      if (f.size > MAX_FILE_BYTES) {
        setError(`"${f.name}" exceeds the 50 MB per-file limit`);
        return;
      }
    }
    if (next.length + files.length > MAX_FILES_PER_PASTE) {
      setError(`At most ${MAX_FILES_PER_PASTE} files per paste`);
      return;
    }
    setError(null);
    setFiles((prev) => [...prev, ...next]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      if (burnAfterRead && files.length > 0) {
        setError("Burn-after-read pastes cannot have file attachments");
        setLoading(false);
        return;
      }
      if (totalBytes > MAX_PASTE_TOTAL_BYTES) {
        setError("Total file size exceeds the 100 MB per-paste limit");
        setLoading(false);
        return;
      }

      const trimmedPassword = password.trim();
      let key: Uint8Array<ArrayBuffer>;
      let keyForBody: string | undefined;
      let saltForBody: string | undefined;
      if (trimmedPassword) {
        const derived = await deriveKeyFromPassword(trimmedPassword);
        key = derived.key;
        saltForBody = bytesToBase64(derived.salt);
      } else {
        key = await generateContentKey();
        keyForBody = bytesToBase64(key);
      }

      const fileMeta: FileMeta[] = [];
      for (const file of files) {
        const { bytes, meta } = await prepareFileForUpload(key, file);
        const blob = await upload(
          `files/${crypto.randomUUID()}`,
          new Blob([bytes]),
          {
            access: "private",
            contentType: "application/octet-stream",
            handleUploadUrl: "/api/pastes/upload-token",
          }
        );
        fileMeta.push({
          pathname: blob.pathname,
          filename: meta.name,
          mime: meta.mime,
          size: meta.size,
          iv: meta.ivB64,
          authTag: meta.authTagB64,
          compression: meta.compression,
        });
      }

      const res = await fetch("/api/pastes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          password: trimmedPassword || undefined,
          burnAfterRead,
          expiresIn,
          contentKey: keyForBody,
          salt: saltForBody,
          files: fileMeta,
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
      setFiles([]);
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

      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
          <span className="font-medium">Attachments (optional)</span>
          <input
            type="file"
            multiple
            disabled={loading}
            onChange={(e) => onSelectFiles(e.target.files)}
            className="block w-full max-w-[220px] text-xs file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:hover:file:bg-zinc-700"
          />
        </label>
        {files.length > 0 && (
          <ul className="mt-1 flex flex-col gap-1">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center justify-between gap-2 rounded-md bg-zinc-50 px-2 py-1 text-xs dark:bg-zinc-800/60"
              >
                <span className="min-w-0 truncate font-mono">{f.name}</span>
                <span className="shrink-0 text-zinc-500 dark:text-zinc-400">
                  {formatBytes(f.size)}
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="shrink-0 text-zinc-400 hover:text-red-500"
                  aria-label={`Remove ${f.name}`}
                >
                  ×
                </button>
              </li>
            ))}
            <li className="pt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {files.length} file{files.length > 1 ? "s" : ""} ·{" "}
              {formatBytes(totalBytes)} total (max 50 MB/file, 100 MB total)
            </li>
          </ul>
        )}
      </div>

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
            disabled={files.length > 0}
            onChange={(e) => setBurnAfterRead(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          <span className="text-sm font-medium">Burn after reading</span>
        </label>
      </div>

      {burnAfterRead && files.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Remove attachments to enable burn-after-read.
        </p>
      )}

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