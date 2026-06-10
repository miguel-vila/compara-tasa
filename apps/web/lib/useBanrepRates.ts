"use client";

import { useEffect, useState } from "react";

export type BanrepRate = {
  effective_date: string;
  decision_date: string;
  label: string;
  rate_ea_percent: number;
};

export function useBanrepRates(): BanrepRate[] {
  const [rates, setRates] = useState<BanrepRate[]>([]);

  useEffect(() => {
    fetch("/data/banrep-rates.json")
      .then((res) => res.json())
      .then((data: BanrepRate[]) => setRates(data))
      .catch((err) => console.error("Failed to fetch BanRep rates:", err));
  }, []);

  return rates;
}
