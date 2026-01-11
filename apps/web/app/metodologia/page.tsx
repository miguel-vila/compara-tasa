import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export const metadata = {
  title: "Metodología | Mejor Tasa",
  description:
    "Conoce cómo recopilamos y presentamos la información de tasas hipotecarias en Colombia.",
};

export default function MetodologiaPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-primary-50 to-white py-12 px-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Metodología y Transparencia</h1>
            <p className="text-lg text-gray-600">
              Conoce cómo recopilamos, procesamos y presentamos la información de tasas hipotecarias
              en Colombia.
            </p>
          </div>
        </section>

        {/* Content Section */}
        <section className="py-12 px-4">
          <div className="max-w-3xl mx-auto space-y-12">
            {/* Qué significa "mejor tasa" */}
            <div>
              <h2 className="text-2xl font-semibold text-gray-300 mb-4">
                Qué significa &quot;mejor tasa&quot;
              </h2>
              <p className="text-gray-400 mb-4">
                Cuando mostramos la &quot;mejor&quot; tasa para una categoría, nos referimos a la
                tasa mínima publicada (<em>desde</em>) por los bancos para ese escenario específico.
                Esto significa:
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <h3 className="font-medium text-gray-500 mb-2">Tasas en pesos (COP)</h3>
                  <p className="text-sm text-gray-600">
                    La tasa E.A. (Efectiva Anual) más baja publicada.
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <h3 className="font-medium text-gray-500 mb-2">Tasas en UVR</h3>
                  <p className="text-sm text-gray-600">
                    El spread más bajo sobre UVR (por ejemplo, &quot;UVR + 6.50%&quot;).
                  </p>
                </div>
              </div>
            </div>

            {/* UVR vs Pesos */}
            <div>
              <h2 className="text-2xl font-semibold text-gray-300 mb-4">
                UVR vs Pesos: No son comparables directamente
              </h2>
              <div className="bg-accent-50 border border-accent-200 rounded-lg p-5">
                <p className="text-gray-500 mb-3">
                  Las tasas en UVR y en pesos no son directamente comparables sin hacer supuestos
                  sobre la inflación futura. Por eso las presentamos en categorías separadas.
                </p>
                <p className="text-gray-600 text-sm">
                  <strong>UVR (Unidad de Valor Real)</strong> es una unidad de cuenta que se ajusta
                  diariamente según la inflación. Un crédito en UVR tendrá cuotas que aumentan con
                  la inflación.
                </p>
              </div>
            </div>

            {/* VIS vs No VIS */}
            <div>
              <h2 className="text-2xl font-semibold text-gray-300 mb-4">VIS vs No VIS</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                  <span className="inline-block bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded mb-3">
                    VIS
                  </span>
                  <h3 className="font-medium text-gray-500 mb-2">Vivienda de Interés Social</h3>
                  <p className="text-sm text-gray-600">
                    Aplica para viviendas con valor comercial hasta 150 SMLV (Salarios Mínimos
                    Legales Mensuales Vigentes). Generalmente tienen tasas preferenciales.
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                  <span className="inline-block bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded mb-3">
                    No VIS
                  </span>
                  <h3 className="font-medium text-gray-500 mb-2">Vivienda de Mayor Valor</h3>
                  <p className="text-sm text-gray-600">
                    Aplica para viviendas de mayor valor, sin el subsidio implícito de las tasas
                    VIS.
                  </p>
                </div>
              </div>
            </div>

            {/* Frecuencia de actualización */}
            <div>
              <h2 className="text-2xl font-semibold text-gray-300 mb-4">
                Frecuencia de actualización
              </h2>
              <div className="flex items-start gap-4 bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <div className="flex-shrink-0 w-10 h-10 bg-accent-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-accent-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mt-1">
                    Cada oferta muestra la fecha de &quot;Recuperado el&quot; que indica cuándo se
                    capturó la información.
                  </p>
                </div>
              </div>
            </div>

            {/* Limitaciones importantes */}
            <div>
              <h2 className="text-2xl font-semibold text-gray-300 mb-4">
                Limitaciones importantes
              </h2>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                  <svg
                    className="w-5 h-5 text-amber-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span className="font-medium text-amber-800">Aviso importante</span>
                </div>
                <ul className="space-y-3 text-amber-800">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 mt-1">•</span>
                    <span>
                      Las tasas mostradas son de referencia y pueden variar según el perfil de
                      riesgo, LTV, plazo y características del solicitante.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 mt-1">•</span>
                    <span>La tasa final se establece al momento del desembolso.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 mt-1">•</span>
                    <span>
                      No incluimos todos los bancos del mercado; algunos tienen protecciones que
                      impiden la recopilación automatizada.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 mt-1">•</span>
                    <span>
                      No calculamos APR ni incluimos costos adicionales como estudio de crédito,
                      avalúo o seguros.
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Contacto */}
            {/* <div>
              <h2 className="text-2xl font-semibold text-gray-300 mb-4">Contacto</h2>
              <p className="text-gray-600">
                Si encuentras información incorrecta o deseas reportar un problema, por favor
                contáctanos.
              </p>
            </div> */}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
