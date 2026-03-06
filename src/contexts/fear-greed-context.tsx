"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ExchangeType = "binance" | "upbit";

export type FearGreedItem = {
  value: number;
  classification: string;
  source: string;
  updatedAt?: string | null;
};

type FearGreedState = {
  binance: FearGreedItem | null;
  upbit: FearGreedItem | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const FearGreedContext = createContext<FearGreedState | null>(null);

export function FearGreedProvider({ children }: { children: React.ReactNode }) {
  const [binance, setBinance] = useState<FearGreedItem | null>(null);
  const [upbit, setUpbit] = useState<FearGreedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFearGreed = useCallback(async () => {
    try {
      setError(null);

      const res = await fetch("/api/fear-greed", {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("공포지수 데이터를 불러오지 못했습니다.");
      }

      const data = await res.json();

      setBinance(data.binance ?? null);
      setUpbit(data.upbit ?? null);
    } catch (err) {
      console.error(err);
      setError("공포지수 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFearGreed();

    const id = window.setInterval(() => {
      fetchFearGreed();
    }, 60_000); // 1분마다 갱신

    return () => window.clearInterval(id);
  }, [fetchFearGreed]);

  const value = useMemo(
    () => ({
      binance,
      upbit,
      loading,
      error,
      refresh: fetchFearGreed,
    }),
    [binance, upbit, loading, error, fetchFearGreed],
  );

  return (
    <FearGreedContext.Provider value={value}>
      {children}
    </FearGreedContext.Provider>
  );
}

export function useFearGreed() {
  const ctx = useContext(FearGreedContext);
  if (!ctx) {
    throw new Error("useFearGreed must be used within FearGreedProvider");
  }
  return ctx;
}

export function getFearGreedColor(value: number) {
  if (value <= 20) {
    return {
      dot: "bg-blue-500",
      text: "text-blue-400",
      badge: "bg-blue-500/10 border-blue-500/30 text-blue-300",
    };
  }

  if (value <= 40) {
    return {
      dot: "bg-sky-400",
      text: "text-sky-300",
      badge: "bg-sky-500/10 border-sky-500/30 text-sky-300",
    };
  }

  if (value <= 60) {
    return {
      dot: "bg-emerald-400",
      text: "text-emerald-300",
      badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    };
  }

  if (value <= 80) {
    return {
      dot: "bg-amber-400",
      text: "text-amber-300",
      badge: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    };
  }

  return {
    dot: "bg-orange-500",
    text: "text-orange-300",
    badge: "bg-orange-500/10 border-orange-500/30 text-orange-300",
  };
}

export function getFearGreedLabel(value: number) {
  if (value <= 20) return "Extreme Fear";
  if (value <= 40) return "Fear";
  if (value <= 60) return "Neutral";
  if (value <= 80) return "Greed";
  return "Extreme Greed";
}
