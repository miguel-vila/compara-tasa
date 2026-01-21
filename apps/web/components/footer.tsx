import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">ComparaTasa</h3>
            <p className="text-sm text-gray-600">
              Comparador de tasas bancarias en Colombia. Información pública recopilada de los
              bancos.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Enlaces</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/hipotecario" className="text-gray-600 hover:text-gray-900">
                  Tasas Hipotecarias
                </Link>
              </li>
              <li>
                <Link href="/metodologia" className="text-gray-600 hover:text-gray-900">
                  Metodología
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Aviso Legal</h3>
            <p className="text-sm text-gray-600">
              Las tasas mostradas son de referencia. La tasa final depende del análisis de crédito
              de cada banco.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
          <p>
            © {new Date().getFullYear()} ComparaTasa. La información proviene de fuentes públicas de
            cada entidad financiera.
          </p>
        </div>
      </div>
    </footer>
  );
}
