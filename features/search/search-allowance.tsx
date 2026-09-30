"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { DAILY_SEARCH_LIMIT, formatSearchAllowance } from "@/lib/domain/search-allowance";
import { searchAllowanceApiResponseSchema } from "@/lib/domain/search-contract";

import styles from "./search-allowance.module.css";

type SearchAllowanceContextValue = {
  message: string;
  searchesRemaining: number | null;
  setSearchesRemaining: (remaining: number) => void;
};

const SearchAllowanceContext = createContext<SearchAllowanceContextValue | null>(null);
const noopSetSearchesRemaining = (_remaining: number) => undefined;

export function SearchAllowanceProvider({ children }: { children: ReactNode }) {
  const [searchesRemaining, setRemainingState] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/v1/search-allowance", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload: unknown = await response.json().catch(() => null);
        const parsed = searchAllowanceApiResponseSchema.safeParse(payload);
        if (!parsed.success) return;
        setRemainingState(parsed.data.data.searchesRemaining);
      })
      .catch(() => {
        // Keep the default full-allowance copy until a search returns a count.
      });
    return () => controller.abort();
  }, []);

  const setSearchesRemaining = useCallback((remaining: number) => {
    setRemainingState(remaining);
  }, []);

  const message = useMemo(
    () => formatSearchAllowance(searchesRemaining ?? DAILY_SEARCH_LIMIT),
    [searchesRemaining],
  );

  const value = useMemo(
    () => ({ message, searchesRemaining, setSearchesRemaining }),
    [message, searchesRemaining, setSearchesRemaining],
  );

  return <SearchAllowanceContext.Provider value={value}>{children}</SearchAllowanceContext.Provider>;
}

export function useSearchAllowance(): SearchAllowanceContextValue {
  const value = useContext(SearchAllowanceContext);
  if (!value) {
    return {
      message: formatSearchAllowance(DAILY_SEARCH_LIMIT),
      searchesRemaining: null,
      setSearchesRemaining: noopSetSearchesRemaining,
    };
  }
  return value;
}

export function SearchAllowanceLine() {
  const { message } = useSearchAllowance();
  return (
    <p className={styles.allowance} role="status" aria-live="polite">
      {message}
    </p>
  );
}
