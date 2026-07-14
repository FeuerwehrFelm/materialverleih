'use client';

import Link from 'next/link';
import { ArrowRight, CalendarDays, ListChecks, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

type MaterialItem = {
  id: string;
  name: string;
  stock: number;
  unit: string;
  note: string;
};

const materials: MaterialItem[] = [
  {
    id: 'bierzelte',
    name: 'Bierzeltgarnitur',
    stock: 9,
    unit: 'Satz',
    note: '9 verfügbare Sätze für gemeinsame Anlässe.',
  },
  {
    id: 'kinder-bierzelte',
    name: 'Kinder-Bierzeltgarnitur',
    stock: 4,
    unit: 'Satz',
    note: '4 verfügbare Sätze für Familien- und Kinderanlässe.',
  },
  {
    id: 'stehtisch',
    name: 'Stehtisch',
    stock: 4,
    unit: 'Stk.',
    note: '4 verfügbare Stehtische für kurze Einsätze und Ausstellungen.',
  },
  {
    id: 'pavillon',
    name: 'Pavillon',
    stock: 1,
    unit: 'Set',
    note: '1 verfügbares Set für Schutz und temporäre Unterstände.',
  },
];

const accessCode = process.env.NEXT_PUBLIC_BOOKING_ACCESS_CODE ?? 'felm2026';
const storageKey = 'feuerwehr-felm-login';
const bookingsStorageKey = 'feuerwehr-felm-bookings';
const bookingsTable = 'material_bookings';

type StoredLogin = {
  name: string;
  code: string;
};

type BookingEntry = {
  id: string;
  name: string;
  materialName: string;
  quantity: number;
  unit: string;
  startDate: string;
  endDate: string;
  bookedAt: string;
};

type SupabaseBookingRow = {
  id: string;
  name: string;
  material_name: string;
  quantity: number;
  unit: string;
  start_date: string;
  end_date: string;
  booked_at: string;
};

function createBookingId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseBookingDate(value: string) {
  if (!value || value === 'ohne Datum') {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sortBookings(bookings: BookingEntry[]) {
  return [...bookings].sort((left, right) => {
    const leftDate = parseBookingDate(left.startDate) ?? parseBookingDate(left.endDate) ?? new Date(left.bookedAt);
    const rightDate = parseBookingDate(right.startDate) ?? parseBookingDate(right.endDate) ?? new Date(right.bookedAt);
    return leftDate.getTime() - rightDate.getTime();
  });
}

function splitBookings(bookings: BookingEntry[]) {
  const now = Date.now();
  const active: BookingEntry[] = [];
  const archive: BookingEntry[] = [];

  for (const booking of bookings) {
    const endDate = parseBookingDate(booking.endDate);
    if (!endDate) {
      active.push(booking);
      continue;
    }

    const archiveDate = new Date(endDate);
    archiveDate.setDate(archiveDate.getDate() + 7);

    if (now <= archiveDate.getTime()) {
      active.push(booking);
    } else {
      archive.push(booking);
    }
  }

  return {
    active: sortBookings(active),
    archive: sortBookings(archive),
  };
}

function mapBookingToRow(booking: BookingEntry): SupabaseBookingRow {
  return {
    id: booking.id,
    name: booking.name,
    material_name: booking.materialName,
    quantity: booking.quantity,
    unit: booking.unit,
    start_date: booking.startDate,
    end_date: booking.endDate,
    booked_at: booking.bookedAt,
  };
}

function mapRowToBooking(row: SupabaseBookingRow): BookingEntry {
  return {
    id: row.id,
    name: row.name,
    materialName: row.material_name,
    quantity: row.quantity,
    unit: row.unit,
    startDate: row.start_date,
    endDate: row.end_date,
    bookedAt: row.booked_at,
  };
}

function readStoredBookings() {
  if (typeof window === 'undefined') {
    return [] as BookingEntry[];
  }

  const bookingsRaw = window.localStorage.getItem(bookingsStorageKey);
  if (!bookingsRaw) {
    return [] as BookingEntry[];
  }

  try {
    return JSON.parse(bookingsRaw) as BookingEntry[];
  } catch {
    window.localStorage.removeItem(bookingsStorageKey);
    return [] as BookingEntry[];
  }
}

export default function MaterialBookingPage() {
  const [materialId, setMaterialId] = useState(materials[0].id);
  const [quantity, setQuantity] = useState(1);
  const [contactName, setContactName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [message, setMessage] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [bookings, setBookings] = useState<BookingEntry[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as StoredLogin;
      if (parsed.name && parsed.code) {
        setContactName(parsed.name);
        setLoginName(parsed.name);
        setIsLoggedIn(true);
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }

    const localBookings = readStoredBookings();
    if (localBookings.length > 0) {
      setBookings(localBookings);
    }

    const loadBookings = async () => {
      if (!isSupabaseConfigured || !supabase) {
        return;
      }

      const { data, error } = await supabase.from(bookingsTable).select('*').order('booked_at', { ascending: false });
      if (error || !data) {
        return;
      }

      const remoteBookings = data.map(mapRowToBooking);
      setBookings(remoteBookings);
      window.localStorage.setItem(bookingsStorageKey, JSON.stringify(remoteBookings));
    };

    void loadBookings();
  }, []);

  const selected = materials.find((item) => item.id === materialId) ?? materials[0];

  const maxQuantity = useMemo(() => {
    const days = startDate && endDate ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1) : 1;
    return Math.max(1, Math.floor(selected.stock / Math.max(1, days)));
  }, [endDate, selected, startDate]);

  const { active: activeBookings, archive: archiveBookings } = useMemo(() => splitBookings(bookings), [bookings]);

  const availability = useMemo(() => {
    const days = startDate && endDate ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1) : 1;
    const requiredUnits = quantity * Math.max(1, days);
    const available = Math.max(0, selected.stock - requiredUnits);

    return {
      available,
      canBook: requiredUnits <= selected.stock,
      requiredUnits,
      days,
    };
  }, [endDate, quantity, selected, startDate]);

  useEffect(() => {
    if (quantity > maxQuantity) {
      setQuantity(maxQuantity);
    }
  }, [maxQuantity, quantity]);

  const handleLogin = () => {
    const cleanedName = loginName.trim();
    const cleanedCode = loginCode.trim();

    if (!cleanedName || !cleanedCode) {
      setLoginError('Bitte Name und Code eingeben.');
      return;
    }

    if (cleanedCode.toLowerCase() !== accessCode.toLowerCase()) {
      setLoginError('Der eingegebene Code ist ungültig.');
      return;
    }

    const payload: StoredLogin = { name: cleanedName, code: cleanedCode };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
    setContactName(cleanedName);
    setIsLoggedIn(true);
    setLoginError('');
    setMessage('');
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey);
    }

    setIsLoggedIn(false);
    setLoginName('');
    setLoginCode('');
    setContactName('');
    setMessage('');
  };

  const handleSubmit = async () => {
    if (!isLoggedIn) {
      setMessage('Bitte zuerst mit Name und Code anmelden.');
      return;
    }

    if (!contactName.trim()) {
      setMessage('Bitte geben Sie einen Ansprechpartner an.');
      return;
    }

    if (!availability.canBook) {
      setMessage(`Für diesen Zeitraum sind nur noch ${availability.available} ${selected.unit} verfügbar.`);
      return;
    }

    const bookingEntry: BookingEntry = {
      id: createBookingId(),
      name: contactName.trim(),
      materialName: selected.name,
      quantity,
      unit: selected.unit,
      startDate: startDate || 'ohne Datum',
      endDate: endDate || 'ohne Datum',
      bookedAt: new Date().toLocaleString('de-DE'),
    };

    const persistBooking = (updatedBookings: BookingEntry[]) => {
      setBookings(updatedBookings);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(bookingsStorageKey, JSON.stringify(updatedBookings));
      }
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from(bookingsTable).insert([mapBookingToRow(bookingEntry)]);
      if (!error) {
        setBookings((prev) => {
          const updated = [bookingEntry, ...prev].slice(0, 50);
          persistBooking(updated);
          return updated;
        });
        setMessage(`${selected.name} wurde erfolgreich für ${quantity} ${selected.unit} gespeichert.`);
        return;
      }
    }

    setBookings((prev) => {
      const updated = [bookingEntry, ...prev].slice(0, 50);
      persistBooking(updated);
      return updated;
    });

    setMessage(`${selected.name} wurde erfolgreich für ${quantity} ${selected.unit} gebucht.`);
  };

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[32px] border border-yellow-400/20 bg-[#081120]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-yellow-300">
                <ShieldCheck className="h-4 w-4" /> Materialverleih
              </span>
              <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">Verleih von Material für Feuerwehr Felm</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
                Nur für Kameradinnen und Kameraden der Feuerwehr Felm. Material wird nur für den eigenen Gebrauch oder für fördernde Mitglieder verliehen.
              </p>
            </div>
            <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold text-slate-100 transition hover:bg-white/10">
              Zurück
            </Link>
          </div>
        </section>

        {!isLoggedIn ? (
          <section className="rounded-[28px] border border-yellow-400/15 bg-[#081120]/85 p-6 shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
            <h2 className="text-xl font-semibold text-white">Anmeldung</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Gib deinen Namen und den Code aus der Umgebungsdatei ein, um zu verleihen.</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">Name</span>
                <input className="w-full rounded-2xl border border-yellow-400/15 bg-[#0d1728] px-4 py-3 text-white outline-none" type="text" value={loginName} onChange={(event) => setLoginName(event.target.value)} placeholder="Vor- und Nachname" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">Code</span>
                <input className="w-full rounded-2xl border border-yellow-400/15 bg-[#0d1728] px-4 py-3 text-white outline-none" type="password" value={loginCode} onChange={(event) => setLoginCode(event.target.value)} placeholder="Code aus der .env-Datei" />
              </label>
            </div>

            {loginError ? <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-200">{loginError}</div> : null}

            <button className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-yellow-400 px-4 py-3 font-semibold text-[#081120] transition hover:bg-yellow-300" onClick={handleLogin}>
              Anmelden <ArrowRight className="h-4 w-4" />
            </button>
          </section>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[28px] border border-yellow-400/15 bg-[#081120]/85 p-6 shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-400/10 text-yellow-300">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Verleih anlegen</h2>
                    <p className="text-sm text-slate-400">Angemeldet als {contactName}</p>
                  </div>
                </div>
                <button className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100" onClick={handleLogout}>
                  Abmelden
                </button>
              </div>

              <div className="mt-6 grid gap-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-200">Material</span>
                  <select className="w-full rounded-2xl border border-yellow-400/15 bg-[#0d1728] px-4 py-3 text-white outline-none" value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
                    {materials.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-200">Menge</span>
                  <input className="w-full rounded-2xl border border-yellow-400/15 bg-[#0d1728] px-4 py-3 text-white outline-none" type="number" min="1" max={maxQuantity} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
                  <p className="mt-2 text-xs text-slate-400">Maximal verfügbar: {maxQuantity} {selected.unit}</p>
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
                    <UserRound className="h-4 w-4 text-yellow-300" /> Ansprechpartner
                  </span>
                  <input className="w-full rounded-2xl border border-yellow-400/15 bg-[#0d1728] px-4 py-3 text-white outline-none" type="text" value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Max Mustermann" />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-200">Von</span>
                    <input className="w-full rounded-2xl border border-yellow-400/15 bg-[#0d1728] px-4 py-3 text-white outline-none" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-200">Bis</span>
                    <input className="w-full rounded-2xl border border-yellow-400/15 bg-[#0d1728] px-4 py-3 text-white outline-none" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                  </label>
                </div>
              </div>

              <button className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-yellow-400 px-4 py-3 font-semibold text-[#081120] transition hover:bg-yellow-300" onClick={handleSubmit}>
                Verleih speichern <ArrowRight className="h-4 w-4" />
              </button>

              {message ? <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</div> : null}
            </div>

            <div className="rounded-[28px] border border-yellow-400/15 bg-[#081120]/85 p-6 shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
              <h2 className="text-xl font-semibold text-yellow-300">Verfügbarkeit</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">{selected.note}</p>

              <div className="mt-5 rounded-2xl border border-yellow-400/10 bg-[#0d1728] p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-yellow-300">Status</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {availability.canBook ? `Noch ${availability.available} ${selected.unit} verfügbar` : `Nur ${availability.available} ${selected.unit} verfügbar`}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Benötigt: {availability.requiredUnits} {selected.unit} für {availability.days} Tage
                </p>
              </div>

              <ul className="mt-6 space-y-3 text-sm text-slate-400">
                <li className="rounded-2xl border border-white/10 bg-white/5 p-3">• Verleih nur für den eigenen Gebrauch oder für fördernde Mitglieder</li>
                <li className="rounded-2xl border border-white/10 bg-white/5 p-3">• Automatische Prüfung der Verfügbarkeit im gewählten Zeitraum</li>
                <li className="rounded-2xl border border-white/10 bg-white/5 p-3">• Nur für Kameradinnen und Kameraden der Feuerwehr Felm</li>
              </ul>
            </div>
          </section>
        )}

        <section className="rounded-[28px] border border-yellow-400/15 bg-[#081120]/85 p-6 shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-400/10 text-yellow-300">
              <ListChecks className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Aktuelle Ausleihen</h2>
              <p className="text-sm text-slate-400">Wer hat gerade Material ausgeliehen?</p>
            </div>
          </div>

          {activeBookings.length === 0 ? (
            <p className="mt-5 text-sm text-slate-400">Aktuell keine offenen Ausleihen.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {activeBookings.map((booking) => (
                <div key={booking.id} className="rounded-2xl border border-white/10 bg-[#0d1728] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-white">{booking.name}</p>
                    <p className="text-xs text-slate-400">{booking.bookedAt}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{booking.materialName} · {booking.quantity} {booking.unit}</p>
                  <p className="mt-1 text-sm text-slate-400">Zeitraum: {booking.startDate} bis {booking.endDate}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 border-t border-white/10 pt-6">
            <h3 className="text-lg font-semibold text-white">Archiv</h3>
            <p className="mt-1 text-sm text-slate-400">Ältere Ausleihen bleiben hier sichtbar, damit man schnell erkennt, wenn etwas fehlt.</p>

            {archiveBookings.length === 0 ? (
              <p className="mt-5 text-sm text-slate-400">Noch kein Archiv vorhanden.</p>
            ) : (
              <div className="mt-5 space-y-3">
                {archiveBookings.map((booking) => (
                  <div key={booking.id} className="rounded-2xl border border-white/10 bg-[#0d1728]/70 p-4 opacity-80">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-white">{booking.name}</p>
                      <p className="text-xs text-slate-400">{booking.bookedAt}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{booking.materialName} · {booking.quantity} {booking.unit}</p>
                    <p className="mt-1 text-sm text-slate-400">Zeitraum: {booking.startDate} bis {booking.endDate}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
