import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { Rate, ScenarioKey } from "@mejor-tasa/core";

export function formatRate(rate: Rate): string {
  if (rate.kind === "COP_FIXED") {
    if (rate.ea_percent_to && rate.ea_percent_to !== rate.ea_percent_from) {
      return `${rate.ea_percent_from.toFixed(2)}% - ${rate.ea_percent_to.toFixed(2)}% E.A.`;
    }
    return `${rate.ea_percent_from.toFixed(2)}% E.A.`;
  } else {
    if (rate.spread_ea_to && rate.spread_ea_to !== rate.spread_ea_from) {
      return `UVR + ${rate.spread_ea_from.toFixed(2)}% - ${rate.spread_ea_to.toFixed(2)}%`;
    }
    return `UVR + ${rate.spread_ea_from.toFixed(2)}%`;
  }
}

export function formatDate(isoString: string): string {
  try {
    return format(parseISO(isoString), "d 'de' MMMM, yyyy", { locale: es });
  } catch {
    return isoString;
  }
}

export function formatDateTime(isoString: string): string {
  try {
    return format(parseISO(isoString), "d 'de' MMMM, yyyy 'a las' HH:mm", {
      locale: es,
    });
  } catch {
    return isoString;
  }
}

export const SCENARIO_LABELS: Record<ScenarioKey, string> = {
  best_uvr_vis_hipotecario: "Mejor UVR - VIS",
  best_uvr_no_vis_hipotecario: "Mejor UVR - No VIS",
  best_cop_vis_hipotecario: "Mejor Pesos - VIS",
  best_cop_no_vis_hipotecario: "Mejor Pesos - No VIS",
  best_payroll_benefit: "Mejor con Nómina",
  best_digital_hipotecario: "Mejor Canal Digital",
};

export const SCENARIO_DESCRIPTIONS: Record<ScenarioKey, string> = {
  best_uvr_vis_hipotecario: "Crédito hipotecario en UVR para vivienda de interés social",
  best_uvr_no_vis_hipotecario: "Crédito hipotecario en UVR para vivienda de mayor valor",
  best_cop_vis_hipotecario: "Crédito hipotecario en pesos para vivienda de interés social",
  best_cop_no_vis_hipotecario: "Crédito hipotecario en pesos para vivienda de mayor valor",
  best_payroll_benefit: "Mejor tasa para clientes con nómina en el banco",
  best_digital_hipotecario: "Mejor tasa disponible por canales digitales",
};
