import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { Rate, ScenarioKey } from "@compara-tasa/core";

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
  // Base scenarios (without payroll)
  best_uvr_vis_hipotecario: "Mejor UVR - VIS",
  best_uvr_no_vis_hipotecario: "Mejor UVR - No VIS",
  best_cop_vis_hipotecario: "Mejor Pesos - VIS",
  best_cop_no_vis_hipotecario: "Mejor Pesos - No VIS",
  // Payroll scenarios
  best_uvr_vis_payroll: "Mejor UVR - VIS (Nómina)",
  best_uvr_no_vis_payroll: "Mejor UVR - No VIS (Nómina)",
  best_cop_vis_payroll: "Mejor Pesos - VIS (Nómina)",
  best_cop_no_vis_payroll: "Mejor Pesos - No VIS (Nómina)",
  // Other
  best_digital_hipotecario: "Mejor Canal Digital",
};

export const SCENARIO_DESCRIPTIONS: Record<ScenarioKey, string> = {
  // Base scenarios (without payroll)
  best_uvr_vis_hipotecario: "Crédito hipotecario en UVR para vivienda de interés social",
  best_uvr_no_vis_hipotecario: "Crédito hipotecario en UVR para vivienda de mayor valor",
  best_cop_vis_hipotecario: "Crédito hipotecario en pesos para vivienda de interés social",
  best_cop_no_vis_hipotecario: "Crédito hipotecario en pesos para vivienda de mayor valor",
  // Payroll scenarios
  best_uvr_vis_payroll: "Crédito en UVR para VIS con descuento por nómina",
  best_uvr_no_vis_payroll: "Crédito en UVR para No VIS con descuento por nómina",
  best_cop_vis_payroll: "Crédito en pesos para VIS con descuento por nómina",
  best_cop_no_vis_payroll: "Crédito en pesos para No VIS con descuento por nómina",
  // Other
  best_digital_hipotecario: "Mejor tasa disponible por canales digitales",
};
