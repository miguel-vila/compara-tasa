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

      <main className="flex-1 py-12 px-4">
        <article className="max-w-3xl mx-auto prose prose-gray">
          <h1>Metodología y Transparencia</h1>

          <h2>Qué significa "mejor tasa"</h2>
          <p>
            Cuando mostramos la "mejor" tasa para una categoría, nos referimos a la tasa mínima
            publicada (<em>desde</em>) por los bancos para ese escenario específico. Esto significa:
          </p>
          <ul>
            <li>
              <strong>Para tasas en pesos (COP):</strong> La tasa E.A. (Efectiva Anual) más baja
              publicada.
            </li>
            <li>
              <strong>Para tasas en UVR:</strong> El spread más bajo sobre UVR (por ejemplo, "UVR +
              6.50%").
            </li>
          </ul>

          <h2>UVR vs Pesos: No son comparables directamente</h2>
          <p>
            Las tasas en UVR y en pesos no son directamente comparables sin hacer supuestos sobre la
            inflación futura. Por eso las presentamos en categorías separadas.
          </p>
          <p>
            UVR (Unidad de Valor Real) es una unidad de cuenta que se ajusta diariamente según la
            inflación. Un crédito en UVR tendrá cuotas que aumentan con la inflación.
          </p>

          <h2>VIS vs No VIS</h2>
          <p>
            <strong>VIS (Vivienda de Interés Social)</strong> aplica para viviendas con valor
            comercial hasta 150 SMLV (Salarios Mínimos Legales Mensuales Vigentes). Generalmente
            tienen tasas preferenciales.
          </p>
          <p>
            <strong>No VIS</strong> aplica para viviendas de mayor valor, sin el subsidio implícito
            de las tasas VIS.
          </p>

          <h2>Fuentes de información</h2>
          <p>
            Recopilamos información directamente de los documentos públicos de tasas y tarifas de
            cada banco:
          </p>
          <ul>
            <li>Bancolombia: Página web (HTML)</li>
            <li>BBVA Colombia: PDF de tasas de vivienda</li>
            <li>Scotiabank Colpatria: PDF de tasas y productos</li>
            <li>Banco Caja Social: PDF de tasas de crédito vivienda</li>
            <li>Banco AV Villas: PDF de tasas activas</li>
            <li>Banco Itaú: PDF de tasas vigentes</li>
          </ul>

          <h2>Frecuencia de actualización</h2>
          <p>
            Las tasas se actualizan diariamente de forma automática. Cada oferta muestra la fecha de
            "Recuperado el" que indica cuándo se capturó la información.
          </p>

          <h2>Limitaciones importantes</h2>
          <div className="bg-amber-50 border-l-4 border-amber-400 p-4 my-6">
            <p className="font-medium text-amber-800">Aviso importante</p>
            <ul className="text-amber-700 mt-2">
              <li>
                Las tasas mostradas son de referencia y pueden variar según el perfil de riesgo,
                LTV, plazo y características del solicitante.
              </li>
              <li>La tasa final se establece al momento del desembolso.</li>
              <li>
                No incluimos todos los bancos del mercado; algunos tienen protecciones que impiden
                la recopilación automatizada.
              </li>
              <li>
                No calculamos APR ni incluimos costos adicionales como estudio de crédito, avalúo o
                seguros.
              </li>
            </ul>
          </div>

          <h2>Contacto</h2>
          <p>
            Si encuentras información incorrecta o deseas reportar un problema, por favor
            contáctanos.
          </p>
        </article>
      </main>

      <Footer />
    </div>
  );
}
