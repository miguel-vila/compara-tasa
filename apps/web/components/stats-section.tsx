import Link from "next/link";
import { fetchOffers, fetchSavingsOffers } from "@/lib/data";

export async function StatsSection() {
  const [{ offers: mortgageOffers }, { offers: savingsOffers }] = await Promise.all([
    fetchOffers(),
    fetchSavingsOffers(),
  ]);

  const mortgageBankCount = new Set(mortgageOffers.map((o) => o.bank_id)).size;
  const mortgageOfferCount = mortgageOffers.length;

  const savingsBankCount = new Set(savingsOffers.map((o) => o.bank_id)).size;
  const savingsOfferCount = savingsOffers.length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <ProductCard
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        }
        title="Créditos Hipotecarios"
        bankCount={mortgageBankCount}
        offerCount={mortgageOfferCount}
        anchorHref="#hipotecas"
        theme="teal"
      />
      <ProductCard
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        }
        title="Cuentas de Ahorro"
        bankCount={savingsBankCount}
        offerCount={savingsOfferCount}
        anchorHref="#ahorros"
        theme="amber"
      />
    </div>
  );
}

function ProductCard({
  icon,
  title,
  bankCount,
  offerCount,
  anchorHref,
  theme,
}: {
  icon: React.ReactNode;
  title: string;
  bankCount: number;
  offerCount: number;
  anchorHref: string;
  theme: "teal" | "amber";
}) {
  const themeStyles = {
    teal: {
      border: "border-teal-200",
      iconBg: "bg-teal-100",
      iconText: "text-teal-600",
      statValue: "text-teal-700",
      link: "text-teal-600 hover:text-teal-700",
    },
    amber: {
      border: "border-amber-200",
      iconBg: "bg-amber-100",
      iconText: "text-amber-600",
      statValue: "text-amber-700",
      link: "text-amber-600 hover:text-amber-700",
    },
  };

  const styles = themeStyles[theme];

  return (
    <div className={`bg-white rounded-xl border-2 ${styles.border} p-6 shadow-sm`}>
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-12 h-12 ${styles.iconBg} ${styles.iconText} rounded-xl flex items-center justify-center`}
        >
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>

      <div className="flex gap-6 mb-4">
        <div>
          <p className={`text-3xl font-bold ${styles.statValue}`}>{bankCount}</p>
          <p className="text-sm text-gray-500">Bancos</p>
        </div>
        <div>
          <p className={`text-3xl font-bold ${styles.statValue}`}>{offerCount}</p>
          <p className="text-sm text-gray-500">Ofertas</p>
        </div>
      </div>

      <Link
        href={anchorHref}
        className={`inline-flex items-center gap-1 text-sm font-medium ${styles.link} transition-colors`}
      >
        Ver mejores
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Link>
    </div>
  );
}
