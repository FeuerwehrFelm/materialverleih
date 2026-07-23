'use client';

import Link from 'next/link';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, ListChecks, ShieldCheck, Trash2, UserRound } from 'lucide-react';
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
    note: 'Insgesamt stehen 9 Sätze zur Verfügung.',
  },
  {
    id: 'kinder-bierzelte',
    name: 'Kinder-Bierzeltgarnitur',
    stock: 4,
    unit: 'Satz',
    note: 'Insgesamt stehen 4 Sätze zur Verfügung.',
  },
  {
    id: 'stehtisch',
    name: 'Stehtisch',
    stock: 4,
    unit: 'Stk.',
    note: 'Insgesamt stehen 4 Stehtische zur Verfügung.',
  },
  {
    id: 'pavillon',
    name: 'Pavillon',
    stock: 1,
    unit: 'Set',
    note: 'Insgesamt steht 1 Pavillon zur Verfügung.',
  },
];

const accessCode = process.env.NEXT_PUBLIC_BOOKING_ACCESS_CODE ?? '';
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
  beneficiaryName?: string;
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
  beneficiary_name?: string | null;
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

function formatDate(value: string) {
  const date = parseBookingDate(value);
  return date ? new Intl.DateTimeFormat('de-DE').format(date) : value;
}

function formatBookedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function isFutureBooking(booking: BookingEntry) {
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return booking.startDate !== 'ohne Datum' && booking.startDate > localToday;
}

function namesMatch(left: string, right: string) {
  return left.trim().localeCompare(right.trim(), 'de', { sensitivity: 'base' }) === 0;
}

function toLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
    beneficiary_name: booking.beneficiaryName || null,
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
    beneficiaryName: row.beneficiary_name ?? undefined,
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
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [message, setMessage] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [bookings, setBookings] = useState<BookingEntry[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingBookingId, setDeletingBookingId] = useState<string | null>(null);
  const [bookingsError, setBookingsError] = useState('');
  const [bookingsView, setBookingsView] = useState<'list' | 'calendar'>('calendar');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => toLocalDateKey(new Date()));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as StoredLogin;
        if (parsed.name && parsed.code?.toLowerCase() === accessCode.toLowerCase()) {
          setContactName(parsed.name);
          setLoginName(parsed.name);
          setIsLoggedIn(true);
        } else {
          window.localStorage.removeItem(storageKey);
        }
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }

    const localBookings = readStoredBookings();
    if (localBookings.length > 0) {
      setBookings(localBookings);
    }

    const loadBookings = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setIsLoadingBookings(false);
        return;
      }

      const { data, error } = await supabase.from(bookingsTable).select('*').order('booked_at', { ascending: false });
      if (error || !data) {
        setBookingsError('Die Ausleihen konnten gerade nicht geladen werden. Bitte lade die Seite erneut.');
        setIsLoadingBookings(false);
        return;
      }

      const remoteBookings = data.map(mapRowToBooking);
      setBookings(remoteBookings);
      window.localStorage.setItem(bookingsStorageKey, JSON.stringify(remoteBookings));
      setBookingsError('');
      setIsLoadingBookings(false);
    };

    void loadBookings();
  }, []);

  const selected = materials.find((item) => item.id === materialId) ?? materials[0];

  const { active: activeBookings, archive: archiveBookings } = useMemo(() => splitBookings(bookings), [bookings]);

  const calendarDays = useMemo(() => {
    const firstWeekday = (calendarMonth.getDay() + 6) % 7;
    const gridStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1 - firstWeekday);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const key = toLocalDateKey(date);
      const dayBookings = activeBookings.filter((booking) =>
        booking.startDate !== 'ohne Datum'
        && booking.endDate !== 'ohne Datum'
        && booking.startDate <= key
        && booking.endDate >= key);

      return {
        date,
        key,
        bookings: dayBookings,
        isCurrentMonth: date.getMonth() === calendarMonth.getMonth(),
      };
    });
  }, [activeBookings, calendarMonth]);

  const selectedDayBookings = useMemo(
    () => activeBookings.filter((booking) =>
      booking.startDate !== 'ohne Datum'
      && booking.endDate !== 'ohne Datum'
      && booking.startDate <= selectedCalendarDate
      && booking.endDate >= selectedCalendarDate),
    [activeBookings, selectedCalendarDate],
  );

  const availability = useMemo(() => {
    const hasCompleteRange = Boolean(startDate && endDate);
    const hasValidRange = hasCompleteRange && startDate <= endDate;
    const relevantBookings = hasValidRange
      ? bookings.filter((booking) =>
          booking.materialName === selected.name
          && booking.startDate !== 'ohne Datum'
          && booking.endDate !== 'ohne Datum'
          && booking.startDate <= endDate
          && booking.endDate >= startDate)
      : [];

    const candidateDates = new Set([startDate]);
    for (const booking of relevantBookings) {
      if (booking.startDate >= startDate && booking.startDate <= endDate) candidateDates.add(booking.startDate);
      if (booking.endDate >= startDate && booking.endDate <= endDate) candidateDates.add(booking.endDate);
    }

    let reserved = 0;
    for (const date of candidateDates) {
      const reservedOnDate = relevantBookings
        .filter((booking) => booking.startDate <= date && booking.endDate >= date)
        .reduce((sum, booking) => sum + booking.quantity, 0);
      reserved = Math.max(reserved, reservedOnDate);
    }

    const available = Math.max(0, selected.stock - reserved);

    return {
      available,
      canBook: hasValidRange && Number.isInteger(quantity) && quantity > 0 && quantity <= available,
      hasCompleteRange,
      hasValidRange,
      reserved,
    };
  }, [bookings, endDate, quantity, selected, startDate]);

  const maxQuantity = Math.max(1, availability.available);

  useEffect(() => {
    if (availability.available > 0 && quantity > availability.available) {
      setQuantity(availability.available);
    }
  }, [availability.available, quantity]);

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
      setMessage('Bitte melde dich zuerst an.');
      return;
    }

    if (!contactName.trim()) {
      setMessage('Bitte gib einen Namen an.');
      return;
    }

    if (!availability.hasCompleteRange) {
      setMessage('Bitte wähle ein Start- und ein Enddatum aus.');
      return;
    }

    if (!availability.hasValidRange) {
      setMessage('Das Enddatum darf nicht vor dem Startdatum liegen.');
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      setMessage('Bitte gib eine gültige Menge ein.');
      return;
    }

    if (!availability.canBook) {
      setMessage(`Im gewählten Zeitraum sind noch ${availability.available} ${selected.unit} verfügbar.`);
      return;
    }

    const bookingEntry: BookingEntry = {
      id: createBookingId(),
      name: contactName.trim(),
      beneficiaryName: beneficiaryName.trim() || undefined,
      materialName: selected.name,
      quantity,
      unit: selected.unit,
      startDate,
      endDate,
      bookedAt: new Date().toISOString(),
    };

    const persistBooking = (updatedBookings: BookingEntry[]) => {
      setBookings(updatedBookings);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(bookingsStorageKey, JSON.stringify(updatedBookings));
      }
    };

    setIsSaving(true);

    if (!isSupabaseConfigured || !supabase) {
      const updated = [bookingEntry, ...bookings].slice(0, 50);
      persistBooking(updated);
      setMessage('Die Ausleihe wurde nur auf diesem Gerät gespeichert, weil keine Datenbank verbunden ist.');
      setIsSaving(false);
      return;
    }

    const { error } = await supabase.from(bookingsTable).insert([mapBookingToRow(bookingEntry)]);
    if (error) {
      setMessage('Die Ausleihe konnte nicht gespeichert werden. Bitte versuche es erneut.');
      setIsSaving(false);
      return;
    }

    const updated = [bookingEntry, ...bookings].slice(0, 50);
    persistBooking(updated);
    setMessage(`${quantity} ${selected.unit} ${selected.name} erfolgreich reserviert. Für weiteres Material bleiben Name und Zeitraum ausgewählt.`);
    setQuantity(1);
    setIsSaving(false);
  };

  const handleDelete = async (booking: BookingEntry) => {
    if (!isLoggedIn || !namesMatch(booking.name, contactName) || !isFutureBooking(booking)) {
      setMessage('Diese Reservierung kann nicht gelöscht werden.');
      return;
    }

    if (!window.confirm(`${booking.materialName} vom ${formatDate(booking.startDate)} bis ${formatDate(booking.endDate)} wirklich löschen?`)) {
      return;
    }

    setDeletingBookingId(booking.id);

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from(bookingsTable)
        .delete()
        .eq('id', booking.id)
        .eq('name', booking.name);

      if (error) {
        setMessage('Die Reservierung konnte nicht gelöscht werden. Bitte versuche es erneut.');
        setDeletingBookingId(null);
        return;
      }
    }

    const updated = bookings.filter((entry) => entry.id !== booking.id);
    setBookings(updated);
    window.localStorage.setItem(bookingsStorageKey, JSON.stringify(updated));
    setMessage('Die Reservierung wurde gelöscht.');
    setDeletingBookingId(null);
  };

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[32px] border border-[#f4ff00]/25 bg-[#081120]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#f4ff00]/25 bg-[#f4ff00]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#f8ff80]">
                <ShieldCheck className="h-4 w-4" /> Materialverleih
              </span>
              <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">Material ausleihen</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
                Bierzeltgarnituren, Stehtische und Pavillons der Feuerwehr Felm einfach reservieren und den Überblick über alle Ausleihen behalten.
              </p>
            </div>
            <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold text-slate-100 transition hover:bg-white/10">
              Zurück
            </Link>
          </div>
        </section>

        {!isLoggedIn ? (
          <section className="rounded-[28px] border border-[#f4ff00]/20 bg-[#081120]/85 p-6 shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
            <h2 className="text-xl font-semibold text-white">Kurz anmelden</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Gib deinen Namen und den gemeinsamen Zugangscode ein.</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">Name</span>
                <input className="w-full rounded-2xl border border-[#f4ff00]/20 bg-[#0d1728] px-4 py-3 text-white outline-none" type="text" value={loginName} onChange={(event) => setLoginName(event.target.value)} placeholder="Vor- und Nachname" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">Code</span>
                <input className="w-full rounded-2xl border border-[#f4ff00]/20 bg-[#0d1728] px-4 py-3 text-white outline-none" type="password" value={loginCode} onChange={(event) => setLoginCode(event.target.value)} placeholder="Zugangscode" />
              </label>
            </div>

            {loginError ? <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-200">{loginError}</div> : null}

            <button className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[#f4ff00] px-4 py-3 font-semibold text-[#081120] transition hover:bg-[#fbff9a]" onClick={handleLogin}>
              Anmelden <ArrowRight className="h-4 w-4" />
            </button>
          </section>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[28px] border border-[#f4ff00]/20 bg-[#081120]/85 p-6 shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f4ff00]/12 text-[#f8ff80]">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Neue Ausleihe</h2>
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
                  <select className="w-full rounded-2xl border border-[#f4ff00]/20 bg-[#0d1728] px-4 py-3 text-white outline-none" value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
                    {materials.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-200">Menge</span>
                  <input className="w-full rounded-2xl border border-[#f4ff00]/20 bg-[#0d1728] px-4 py-3 text-white outline-none" type="number" min="1" max={maxQuantity} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
                  <p className="mt-2 text-xs text-slate-400">Maximal verfügbar: {maxQuantity} {selected.unit}</p>
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
                    <UserRound className="h-4 w-4 text-[#f8ff80]" /> Ausgeliehen von
                  </span>
                  <input className="w-full rounded-2xl border border-[#f4ff00]/20 bg-[#0d1728] px-4 py-3 text-white outline-none" type="text" value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Max Mustermann" />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-200">Ausgeliehen für förderndes Mitglied <span className="font-normal text-slate-500">(optional)</span></span>
                  <input className="w-full rounded-2xl border border-[#f4ff00]/20 bg-[#0d1728] px-4 py-3 text-white outline-none" type="text" value={beneficiaryName} onChange={(event) => setBeneficiaryName(event.target.value)} placeholder="Name des fördernden Mitglieds" />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-200">Von</span>
                    <input className="w-full rounded-2xl border border-[#f4ff00]/20 bg-[#0d1728] px-4 py-3 text-white outline-none" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-200">Bis</span>
                    <input className="w-full rounded-2xl border border-[#f4ff00]/20 bg-[#0d1728] px-4 py-3 text-white outline-none" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                  </label>
                </div>
              </div>

              <button disabled={isSaving} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#f4ff00] px-4 py-3 font-semibold text-[#081120] transition hover:bg-[#fbff9a] disabled:cursor-not-allowed disabled:opacity-60" onClick={handleSubmit}>
                {isSaving ? 'Wird gespeichert …' : 'Ausleihe reservieren'} <ArrowRight className="h-4 w-4" />
              </button>

              {message ? <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</div> : null}
            </div>

            <div className="rounded-[28px] border border-[#f4ff00]/20 bg-[#081120]/85 p-6 shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
              <h2 className="text-xl font-semibold text-[#f8ff80]">Verfügbarkeit</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">{selected.note}</p>

              <div className="mt-5 rounded-2xl border border-[#f4ff00]/15 bg-[#0d1728] p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#f8ff80]">Status</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {!availability.hasCompleteRange
                    ? 'Zeitraum auswählen'
                    : !availability.hasValidRange
                      ? 'Zeitraum prüfen'
                      : `${availability.available} ${selected.unit} verfügbar`}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {availability.hasValidRange
                    ? `${availability.reserved} ${selected.unit} sind in diesem Zeitraum bereits reserviert.`
                    : 'Danach siehst du, wie viel Material noch frei ist.'}
                </p>
              </div>

              <ul className="mt-6 space-y-3 text-sm text-slate-400">
                <li className="rounded-2xl border border-white/10 bg-white/5 p-3">• Bitte nur für den eigenen Gebrauch oder für fördernde Mitglieder ausleihen.</li>
                <li className="rounded-2xl border border-white/10 bg-white/5 p-3">• Bereits reserviertes Material wird automatisch berücksichtigt.</li>
                <li className="rounded-2xl border border-white/10 bg-white/5 p-3">• Die Ausgabe und Rückgabe bitte innerhalb der Feuerwehr abstimmen.</li>
              </ul>
            </div>
          </section>
        )}

        <section className="rounded-[28px] border border-[#f4ff00]/20 bg-[#081120]/85 p-6 shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f4ff00]/12 text-[#f8ff80]">
                {bookingsView === 'list' ? <ListChecks className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Aktuelle Ausleihen</h2>
                <p className="text-sm text-slate-400">Anstehende und kürzlich beendete Reservierungen</p>
              </div>
            </div>
            <div className="flex rounded-full border border-white/10 bg-[#0d1728] p-1">
              <button type="button" onClick={() => setBookingsView('list')} className={`rounded-full px-3 py-2 text-sm font-semibold transition ${bookingsView === 'list' ? 'bg-[#f4ff00] text-[#081120]' : 'text-slate-300 hover:text-white'}`}>
                Liste
              </button>
              <button type="button" onClick={() => setBookingsView('calendar')} className={`rounded-full px-3 py-2 text-sm font-semibold transition ${bookingsView === 'calendar' ? 'bg-[#f4ff00] text-[#081120]' : 'text-slate-300 hover:text-white'}`}>
                Kalender
              </button>
            </div>
          </div>

          {bookingsError ? (
            <p className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-200">{bookingsError}</p>
          ) : isLoadingBookings ? (
            <p className="mt-5 text-sm text-slate-400">Ausleihen werden geladen …</p>
          ) : activeBookings.length === 0 ? (
            <p className="mt-5 text-sm text-slate-400">Zurzeit gibt es keine offenen Ausleihen.</p>
          ) : bookingsView === 'list' ? (
            <div className="mt-5 space-y-3">
              {activeBookings.map((booking) => (
                <div key={booking.id} className="rounded-2xl border border-white/10 bg-[#0d1728] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-white">{booking.name}</p>
                    <p className="text-xs text-slate-400">Eingetragen am {formatBookedAt(booking.bookedAt)}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{booking.materialName} · {booking.quantity} {booking.unit}</p>
                  {booking.beneficiaryName ? <p className="mt-1 text-sm text-slate-400">Für förderndes Mitglied: {booking.beneficiaryName}</p> : null}
                  <p className="mt-1 text-sm text-slate-400">{formatDate(booking.startDate)} bis {formatDate(booking.endDate)}</p>
                  {isLoggedIn && namesMatch(booking.name, contactName) && isFutureBooking(booking) ? (
                    <button
                      type="button"
                      disabled={deletingBookingId === booking.id}
                      onClick={() => void handleDelete(booking)}
                      className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" /> {deletingBookingId === booking.id ? 'Wird gelöscht …' : 'Reservierung löschen'}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <div className="rounded-2xl border border-white/10 bg-[#0d1728] p-3 sm:p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    aria-label="Vorheriger Monat"
                    onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                    className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:bg-white/10"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <h3 className="text-base font-semibold capitalize text-white">
                    {new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(calendarMonth)}
                  </h3>
                  <button
                    type="button"
                    aria-label="Nächster Monat"
                    onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                    className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:bg-white/10"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:gap-2">
                  {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => <div key={day} className="py-1">{day}</div>)}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-2">
                  {calendarDays.map((day) => {
                    const isSelected = day.key === selectedCalendarDate;
                    const hasBookings = day.bookings.length > 0;

                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => {
                          setSelectedCalendarDate(day.key);
                          setStartDate(day.key);
                          if (endDate && endDate < day.key) {
                            setEndDate('');
                          }
                        }}
                        className={`relative flex aspect-square min-h-10 items-center justify-center rounded-xl border text-sm font-semibold transition ${
                          isSelected
                            ? 'border-[#f4ff00] bg-[#f4ff00] text-[#081120]'
                            : hasBookings
                              ? 'border-[#f4ff00]/35 bg-[#f4ff00]/12 text-[#f8ff80] hover:bg-[#f4ff00]/20'
                              : day.isCurrentMonth
                                ? 'border-white/5 bg-white/[0.03] text-slate-200 hover:bg-white/[0.07]'
                                : 'border-transparent text-slate-600'
                        }`}
                      >
                        {day.date.getDate()}
                        {hasBookings && !isSelected ? <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#f4ff00]" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4">
                <h3 className="font-semibold text-white">{formatDate(selectedCalendarDate)}</h3>
                {selectedDayBookings.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-400">An diesem Tag ist kein Material reserviert.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {selectedDayBookings.map((booking) => (
                      <div key={booking.id} className="rounded-2xl border border-white/10 bg-[#0d1728] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-white">{booking.name}</p>
                          <p className="text-xs text-slate-400">{formatDate(booking.startDate)} bis {formatDate(booking.endDate)}</p>
                        </div>
                        <p className="mt-2 text-sm text-slate-300">{booking.materialName} · {booking.quantity} {booking.unit}</p>
                        {booking.beneficiaryName ? <p className="mt-1 text-sm text-slate-400">Für förderndes Mitglied: {booking.beneficiaryName}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-8 border-t border-white/10 pt-6">
            <h3 className="text-lg font-semibold text-white">Archiv</h3>
            <p className="mt-1 text-sm text-slate-400">Ausleihen werden sieben Tage nach dem Rückgabedatum hier abgelegt.</p>

            {archiveBookings.length === 0 ? (
              <p className="mt-5 text-sm text-slate-400">Noch kein Archiv vorhanden.</p>
            ) : (
              <div className="mt-5 space-y-3">
                {archiveBookings.map((booking) => (
                  <div key={booking.id} className="rounded-2xl border border-white/10 bg-[#0d1728]/70 p-4 opacity-80">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-white">{booking.name}</p>
                      <p className="text-xs text-slate-400">Eingetragen am {formatBookedAt(booking.bookedAt)}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{booking.materialName} · {booking.quantity} {booking.unit}</p>
                    {booking.beneficiaryName ? <p className="mt-1 text-sm text-slate-400">Für förderndes Mitglied: {booking.beneficiaryName}</p> : null}
                    <p className="mt-1 text-sm text-slate-400">{formatDate(booking.startDate)} bis {formatDate(booking.endDate)}</p>
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
