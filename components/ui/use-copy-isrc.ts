"use client";

import { useState } from "react";

import { formatInstagramSearch } from "@/lib/domain/isrc";

export type CopyIsrcStatus = "idle" | "copied" | "failed";

export function useCopyIsrc(code: string) {
  const value = formatInstagramSearch(code);
  const [status, setStatus] = useState<CopyIsrcStatus>("idle");

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("CLIPBOARD_UNAVAILABLE");
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return { value, status, copy };
}
