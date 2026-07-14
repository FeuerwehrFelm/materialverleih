import Link from 'next/link';
import { ArrowRight, CalendarDays, Package, ShieldCheck } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.16),_transparent_45%)] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[32px] border border-yellow-400/20 bg-[#081120]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-yellow-300">
                <ShieldCheck className="h-4 w-4" /> Feuerwehr Felm
              </span>
              <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">Materialverleih für die Feuerwehr</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
                Verleih von Material direkt, einfach und übersichtlich für die Kameradinnen und Kameraden der Feuerwehr Felm.
              </p>
            </div>
            <Link href="/materialverleih" className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-4 py-3 font-semibold text-[#081120] transition hover:bg-yellow-300">
              Zum Verleih <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-[24px] border border-yellow-400/15 bg-[#081120]/85 p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-400/10 text-yellow-300">
              <Package className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-white">Übersichtliche Ausleihen</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Aktuelle Ausleihen und Archiv geben schnell Auskunft, was gerade verfügbar ist.</p>
          </div>

          <div className="rounded-[24px] border border-yellow-400/15 bg-[#081120]/85 p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-400/10 text-yellow-300">
              <CalendarDays className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-white">Verfügbarkeit prüfen</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Die Buchung prüft automatisch, ob im gewählten Zeitraum noch genug Material vorhanden ist.</p>
          </div>

          <div className="rounded-[24px] border border-yellow-400/15 bg-[#081120]/85 p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-400/10 text-yellow-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-white">Nur für den eigenen Gebrauch</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Material wird nur für den eigenen Gebrauch oder für fördernde Mitglieder verliehen.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
