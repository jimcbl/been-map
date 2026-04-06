'use client';

import {
  useEffect,
  useSyncExternalStore,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import countriesTopology from 'world-atlas/countries-50m.json';
import Modal from 'react-modal';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import {
  continents,
  type ContinentData,
  type Country,
  type TravelStatus,
  visitedPalette,
} from '@/app/components/world-travel-map-data';

type MapCountryFeature = {
  rsmKey: string;
  properties: {
    name: string;
  };
};

type GeographiesRenderProps = {
  geographies: MapCountryFeature[];
};

type HoveredCountry = {
  name: string;
  x: number;
  y: number;
  continent: string;
};

const DEFAULT_COUNTRY_FILL = '#d9dde3';
const HOVERED_VISITED_FILL = '#d9831f';
const HOVERED_DEFAULT_FILL = '#c7ced6';
const SESSION_STORAGE_KEY = 'travel-map:user';
const COUNTRY_STORAGE_PREFIX = 'travel-map:countries:';
const EMPTY_SAVED_STATUSES: Record<string, TravelStatus> = {};
let cachedStatusesKey: string | null = null;
let cachedStatusesRaw: string | null = null;
let cachedStatusesValue: Record<string, TravelStatus> = EMPTY_SAVED_STATUSES;
const MODAL_STYLES = {
  overlay: {
    backgroundColor: 'rgba(28, 25, 23, 0.45)',
    backdropFilter: 'blur(6px)',
    zIndex: 50,
    padding: '1.5rem 1rem',
  },
  content: {
    position: 'relative',
    inset: 'auto',
    border: '1px solid rgba(255,255,255,0.5)',
    borderRadius: '28px',
    padding: '0',
    maxWidth: '80rem',
    width: '100%',
    maxHeight: '92vh',
    overflow: 'hidden',
    margin: '0 auto',
    background: '#ffffff',
    boxShadow: '0 30px 120px rgba(28,25,23,0.3)',
  },
} satisfies ReactModal.Styles;

export default function WorldTravelMap() {
  const [hoveredCountry, setHoveredCountry] = useState<HoveredCountry | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [selectedContinentTitle, setSelectedContinentTitle] = useState(continents[0]?.title ?? '');
  const [countryInput, setCountryInput] = useState('');
  const [selectedCountryNames, setSelectedCountryNames] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<TravelStatus>('visited');
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const userName = useStoredUserName();
  const savedStatuses = useStoredStatuses(userName);
  const hasSavedCountries = Object.keys(savedStatuses).length > 0;

  useEffect(() => {
    Modal.setAppElement('body');
  }, []);

  const effectiveContinents = continents.map((continent) => ({
    ...continent,
    countries: continent.countries.map((country) => ({
      ...country,
      status: hasSavedCountries
        ? savedStatuses[getCountryStorageKey(continent.title, country.name)] ?? 'planned'
        : 'planned',
    })),
  }));

  const selectedContinent =
    effectiveContinents.find((continent) => continent.title === selectedContinentTitle) ?? effectiveContinents[0];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff9ea,_#f4efe4_40%,_#ece7de_100%)] px-5 py-8 text-stone-900 sm:px-8 lg:px-12">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 rounded-[32px] border border-white/70 bg-white/80 p-5 shadow-[0_24px_80px_rgba(78,58,21,0.12)] backdrop-blur md:p-8">
        <Header
          isEditorOpen={isEditorOpen}
          loginName={loginName}
          onEditorOpen={() => {
            setIsEditorOpen(true);
            setFormMessage(null);
          }}
          onLoginNameChange={setLoginName}
          onLogin={() => {
            const trimmedName = loginName.trim();

            if (!trimmedName) {
              setFormMessage('Enter a name before logging in.');
              return;
            }

            window.localStorage.setItem(SESSION_STORAGE_KEY, trimmedName);
            emitTravelMapStorageChange();
            setFormMessage(null);
          }}
          onLogout={() => {
            window.localStorage.removeItem(SESSION_STORAGE_KEY);
            setLoginName('');
            emitTravelMapStorageChange();
            setFormMessage(null);
          }}
          userName={userName}
        />

        <CountryEditorModal
          countryInput={countryInput}
          formMessage={formMessage}
          isLoggedIn={Boolean(userName)}
          isOpen={isEditorOpen}
          onClose={() => {
            setIsEditorOpen(false);
            setCountryInput('');
            setSelectedCountryNames([]);
            setFormMessage(null);
          }}
          onCountryInputChange={setCountryInput}
          onRemoveSavedCountry={(countryName) => {
            if (!userName || !selectedContinent) {
              return;
            }

            const nextStatuses = { ...savedStatuses };
            delete nextStatuses[getCountryStorageKey(selectedContinent.title, countryName)];
            window.localStorage.setItem(`${COUNTRY_STORAGE_PREFIX}${userName}`, JSON.stringify(nextStatuses));
            emitTravelMapStorageChange();
            setFormMessage(`${countryName} removed.`);
          }}
          onSubmit={(event) => {
            event.preventDefault();

            if (!userName || !selectedContinent) {
              setFormMessage('Log in first to save countries.');
              return;
            }

            if (selectedCountryNames.length === 0) {
              setFormMessage('Select at least one country from the list.');
              return;
            }

            const nextStatuses = { ...savedStatuses };

            for (const countryName of selectedCountryNames) {
              nextStatuses[getCountryStorageKey(selectedContinent.title, countryName)] = selectedStatus;
            }

            window.localStorage.setItem(`${COUNTRY_STORAGE_PREFIX}${userName}`, JSON.stringify(nextStatuses));
            emitTravelMapStorageChange();
            setCountryInput('');
            setSelectedCountryNames([]);
            setFormMessage(`${selectedCountryNames.length} countries saved as ${selectedStatus}.`);
          }}
          onStatusChange={setSelectedStatus}
          onContinentChange={(value) => {
            setSelectedContinentTitle(value);
            setCountryInput('');
            setSelectedCountryNames([]);
            setFormMessage(null);
          }}
          onToggleCountry={(countryName) => {
            setSelectedCountryNames((currentSelection) =>
              currentSelection.includes(countryName)
                ? currentSelection.filter((name) => name !== countryName)
                : [...currentSelection, countryName],
            );
          }}
          onUnselectCountry={(countryName) => {
            setSelectedCountryNames((currentSelection) =>
              currentSelection.filter((name) => name !== countryName),
            );
          }}
          savedStatuses={savedStatuses}
          selectedContinent={selectedContinent}
          selectedContinentTitle={selectedContinentTitle}
          selectedCountryNames={selectedCountryNames}
          selectedStatus={selectedStatus}
        />

        <div className="flex flex-col gap-8">
          {effectiveContinents.map((continent) => (
            <ContinentSection
              key={continent.title}
              continent={continent}
              hoveredCountry={hoveredCountry}
              onCountryHover={setHoveredCountry}
              onCountryLeave={() => setHoveredCountry(null)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function Header({
  isEditorOpen,
  loginName,
  onEditorOpen,
  onLogin,
  onLoginNameChange,
  onLogout,
  userName,
}: {
  isEditorOpen: boolean;
  loginName: string;
  onEditorOpen: () => void;
  onLogin: () => void;
  onLoginNameChange: (value: string) => void;
  onLogout: () => void;
  userName: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-stone-200 pb-6">
      <p className="text-sm font-semibold uppercase tracking-[0.32em] text-amber-700">Been There Done That</p>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-stone-950 md:text-5xl">Jim&apos;s travel maps</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600 md:text-base">
            Save your own visited countries per local profile, then keep them on this device with
            <code className="mx-1 rounded bg-stone-100 px-1.5 py-0.5 text-[0.9em]">localStorage</code>.
          </p>
          <button
            type="button"
            onClick={onEditorOpen}
            className="mt-4 rounded-full bg-stone-950 px-5 py-2.5 text-sm font-medium text-stone-50 transition hover:bg-stone-800"
          >
            {isEditorOpen ? 'Editor open' : 'Manage countries'}
          </button>
        </div>
        <div className="flex min-w-[280px] flex-col gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">Local Login</p>
          {userName ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-stone-500">Signed in as</p>
                <p className="font-semibold text-stone-950">{userName}</p>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              >
                Log out
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={loginName}
                onChange={(event) => onLoginNameChange(event.target.value)}
                placeholder="Your name"
                className="min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-950 outline-none transition focus:border-amber-500"
              />
              <button
                type="button"
                onClick={onLogin}
                className="rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-stone-50 transition hover:bg-stone-800"
              >
                Log in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CountryEditorModal({
  countryInput,
  formMessage,
  isLoggedIn,
  isOpen,
  onClose,
  onCountryInputChange,
  onContinentChange,
  onRemoveSavedCountry,
  onStatusChange,
  onSubmit,
  onToggleCountry,
  onUnselectCountry,
  savedStatuses,
  selectedContinent,
  selectedContinentTitle,
  selectedCountryNames,
  selectedStatus,
}: {
  countryInput: string;
  formMessage: string | null;
  isLoggedIn: boolean;
  isOpen: boolean;
  onClose: () => void;
  onCountryInputChange: (value: string) => void;
  onContinentChange: (value: string) => void;
  onRemoveSavedCountry: (countryName: string) => void;
  onStatusChange: (value: TravelStatus) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleCountry: (countryName: string) => void;
  onUnselectCountry: (countryName: string) => void;
  savedStatuses: Record<string, TravelStatus>;
  selectedContinent: ContinentData | undefined;
  selectedContinentTitle: string;
  selectedCountryNames: string[];
  selectedStatus: TravelStatus;
}) {
  if (!isOpen) {
    return null;
  }

  const filteredCountries =
    selectedContinent?.countries.filter((country) =>
      country.name.toLowerCase().includes(countryInput.trim().toLowerCase()),
    ) ?? [];
  const currentContinentTitle = selectedContinent?.title ?? selectedContinentTitle;
  const savedCountries =
    selectedContinent?.countries.filter(
      (country) => savedStatuses[getCountryStorageKey(currentContinentTitle, country.name)] !== undefined,
    ) ?? [];

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Manage countries"
      shouldCloseOnOverlayClick
      shouldCloseOnEsc
      style={MODAL_STYLES}
    >
      <section className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-[28px] bg-white">
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-5 md:px-6">
          <div>
            <h2 className="text-2xl font-semibold text-stone-950">Manage countries</h2>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              Select multiple countries, save them in one batch, or remove previously saved ones.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
          >
            Close
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 md:px-6">
          <div className="flex flex-col gap-5">
            <form className="grid gap-4 md:grid-cols-[1fr_1fr_180px_auto]" onSubmit={onSubmit}>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Continent</span>
                <select
                  value={selectedContinentTitle}
                  onChange={(event) => onContinentChange(event.target.value)}
                  className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-950 outline-none transition focus:border-amber-500"
                  disabled={!isLoggedIn}
                >
                  {continents.map((continent) => (
                    <option key={continent.title} value={continent.title}>
                      {continent.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Filter countries</span>
                <input
                  value={countryInput}
                  onChange={(event) => onCountryInputChange(event.target.value)}
                  placeholder={isLoggedIn ? 'Search countries' : 'Log in to edit'}
                  className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-950 outline-none transition focus:border-amber-500 disabled:bg-stone-100 disabled:text-stone-400"
                  disabled={!isLoggedIn}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Status</span>
                <select
                  value={selectedStatus}
                  onChange={(event) => onStatusChange(event.target.value as TravelStatus)}
                  className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-950 outline-none transition focus:border-amber-500"
                  disabled={!isLoggedIn}
                >
                  <option value="visited">Visited</option>
                  <option value="planned">Planned</option>
                </select>
              </label>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={!isLoggedIn}
                  className="w-full rounded-2xl bg-stone-950 px-5 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-800 disabled:bg-stone-300"
                >
                  Save countries
                </button>
              </div>
            </form>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px_280px]">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Choose multiple</p>
                <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
                  {filteredCountries.map((country) => {
                    const checked = selectedCountryNames.includes(country.name);

                    return (
                      <label
                        key={`${selectedContinentTitle}-${country.code}`}
                        className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 transition hover:border-amber-300"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleCountry(country.name)}
                          disabled={!isLoggedIn}
                          className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span>{country.name}</span>
                      </label>
                    );
                  })}
                  {filteredCountries.length === 0 ? (
                    <p className="px-2 py-4 text-sm text-stone-400">No countries match that filter.</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Selected ({selectedCountryNames.length})
                </p>
                <div className="flex max-h-72 flex-wrap gap-2 overflow-y-auto">
                  {selectedCountryNames.map((countryName) => (
                    <button
                      key={countryName}
                      type="button"
                      onClick={() => onUnselectCountry(countryName)}
                      className="rounded-full bg-amber-100 px-3 py-1.5 text-sm text-amber-900 transition hover:bg-amber-200"
                    >
                      {countryName}
                    </button>
                  ))}
                  {selectedCountryNames.length === 0 ? (
                    <p className="text-sm text-stone-400">No countries selected yet.</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Saved ({savedCountries.length})
                </p>
                <div className="grid max-h-72 gap-2 overflow-y-auto">
                  {savedCountries.map((country) => {
                    const savedStatus = savedStatuses[getCountryStorageKey(currentContinentTitle, country.name)];

                    return (
                      <div
                        key={`saved-${selectedContinentTitle}-${country.code}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700"
                      >
                        <div>
                          <p className="font-medium text-stone-900">{country.name}</p>
                          <p className="text-xs uppercase tracking-[0.16em] text-stone-400">{savedStatus}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveSavedCountry(country.name)}
                          className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-400 hover:text-rose-900"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                  {savedCountries.length === 0 ? (
                    <p className="text-sm text-stone-400">No saved countries in this continent yet.</p>
                  ) : null}
                </div>
              </div>
            </div>

            <p className="min-h-6 text-sm text-stone-500">
              {formMessage ?? 'Saved countries are kept in local storage on this device.'}
            </p>
          </div>
        </div>
      </section>
    </Modal>
  );
}

function ContinentSection({
  continent,
  hoveredCountry,
  onCountryHover,
  onCountryLeave,
}: {
  continent: ContinentData;
  hoveredCountry: HoveredCountry | null;
  onCountryHover: (country: HoveredCountry) => void;
  onCountryLeave: () => void;
}) {
  const stats = getContinentStats(continent.countries);
  const paletteLookup = getVisitedFillLookup(stats.visitedCountries);

  return (
    <section className="rounded-[28px] bg-[#fbf7ef] p-4 shadow-inner shadow-amber-100/50 md:p-6">
      <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-stone-900">{continent.title} overview</h2>
          <p className="text-sm text-stone-500">
            Warm colors are visited countries. Grey countries are still on the list.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-stone-500">
          <LegendSwatch color="#f2b347" label="Visited" />
          <LegendSwatch color={DEFAULT_COUNTRY_FILL} label="Not yet" />
          <StatCard label="Visited" value={`${stats.visitedCountries.length}/${continent.countries.length}`} />
          <StatCard label="Coverage" value={`${stats.coverage}%`} />
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,_#fffdf7_0%,_#f6f0e3_100%)] p-3">
        <MapTooltip hoveredCountry={hoveredCountry?.continent === continent.title ? hoveredCountry : null} />
        <ContinentMap
          continent={continent}
          paletteLookup={paletteLookup}
          onCountryHover={onCountryHover}
          onCountryLeave={onCountryLeave}
        />
      </div>
    </section>
  );
}

function ContinentMap({
  continent,
  paletteLookup,
  onCountryHover,
  onCountryLeave,
}: {
  continent: ContinentData;
  paletteLookup: Map<string, string>;
  onCountryHover: (country: HoveredCountry) => void;
  onCountryLeave: () => void;
}) {
  const countryLookup = new Map(continent.countries.map((country) => [country.name, country]));

  return (
    <ComposableMap projection="geoMercator" projectionConfig={continent.projection} className="h-auto w-full">
      <Geographies geography={countriesTopology}>
        {({ geographies }: GeographiesRenderProps) =>
          geographies
            .filter((feature) => continent.mapCountryNames.has(feature.properties.name))
            .map((feature) => {
              const countryName = feature.properties.name;
              const isVisited = countryLookup.get(countryName)?.status === 'visited';

              return (
                <Geography
                  key={feature.rsmKey}
                  geography={feature}
                  title={countryName}
                  onMouseEnter={(event) => {
                    onCountryHover(getHoveredCountry(event, countryName, continent.title));
                  }}
                  onMouseMove={(event) => {
                    onCountryHover(getHoveredCountry(event, countryName, continent.title));
                  }}
                  onMouseLeave={onCountryLeave}
                  stroke="#fffaf0"
                  strokeWidth={0.7}
                  style={getGeographyStyle(countryName, isVisited, paletteLookup)}
                />
              );
            })
        }
      </Geographies>
    </ComposableMap>
  );
}

function MapTooltip({ hoveredCountry }: { hoveredCountry: HoveredCountry | null }) {
  if (!hoveredCountry) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute z-10 rounded-full bg-stone-950/92 px-3 py-1.5 text-xs font-semibold tracking-[0.14em] text-stone-50 shadow-lg"
      style={{
        left: hoveredCountry.x,
        top: hoveredCountry.y,
        transform: 'translate(-50%, calc(-100% - 12px))',
      }}
    >
      {hoveredCountry.name}
    </div>
  );
}

function getContinentStats(countries: Country[]) {
  const visitedCountries = countries.filter((country) => country.status === 'visited');

  return {
    visitedCountries,
    coverage: Math.round((visitedCountries.length / countries.length) * 100),
  };
}

function getVisitedFillLookup(countries: Country[]) {
  return new Map(countries.map((country, index) => [country.name, visitedPalette[index % visitedPalette.length]]));
}

function getGeographyStyle(name: string, isVisited: boolean, paletteLookup: Map<string, string>) {
  return {
    default: {
      fill: paletteLookup.get(name) ?? DEFAULT_COUNTRY_FILL,
      outline: 'none',
    },
    hover: {
      fill: isVisited ? HOVERED_VISITED_FILL : HOVERED_DEFAULT_FILL,
      outline: 'none',
    },
    pressed: {
      fill: isVisited ? HOVERED_VISITED_FILL : HOVERED_DEFAULT_FILL,
      outline: 'none',
    },
  };
}

function getHoveredCountry(event: ReactMouseEvent<SVGPathElement>, name: string, continent: string): HoveredCountry {
  const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();

  return {
    name,
    continent,
    x: bounds ? event.clientX - bounds.left : 0,
    y: bounds ? event.clientY - bounds.top : 0,
  };
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[110px] rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-stone-950">{value}</p>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block h-3 w-3 rounded-full border border-black/5" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}

function getCountryStorageKey(continent: string, country: string) {
  return `${continent}::${country}`;
}

function getStoredUser() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(SESSION_STORAGE_KEY);
}

function getStoredStatuses(userName: string | null): Record<string, TravelStatus> {
  if (typeof window === 'undefined' || !userName) {
    return EMPTY_SAVED_STATUSES;
  }

  const storageKey = `${COUNTRY_STORAGE_PREFIX}${userName}`;
  const storedStatuses = window.localStorage.getItem(storageKey);

  if (!storedStatuses) {
    cachedStatusesKey = storageKey;
    cachedStatusesRaw = null;
    cachedStatusesValue = EMPTY_SAVED_STATUSES;
    return cachedStatusesValue;
  }

  if (cachedStatusesKey === storageKey && cachedStatusesRaw === storedStatuses) {
    return cachedStatusesValue;
  }

  try {
    cachedStatusesKey = storageKey;
    cachedStatusesRaw = storedStatuses;
    cachedStatusesValue = JSON.parse(storedStatuses) as Record<string, TravelStatus>;
    return cachedStatusesValue;
  } catch {
    cachedStatusesKey = storageKey;
    cachedStatusesRaw = storedStatuses;
    cachedStatusesValue = EMPTY_SAVED_STATUSES;
    return cachedStatusesValue;
  }
}

function useStoredUserName() {
  return useSyncExternalStore(subscribeToTravelMapStorage, getStoredUser, () => null);
}

function useStoredStatuses(userName: string | null): Record<string, TravelStatus> {
  return useSyncExternalStore(
    subscribeToTravelMapStorage,
    () => getStoredStatuses(userName),
    () => EMPTY_SAVED_STATUSES,
  );
}

function subscribeToTravelMapStorage(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorageChange = () => {
    onStoreChange();
  };

  window.addEventListener('storage', handleStorageChange);
  window.addEventListener('travel-map-storage', handleStorageChange);

  return () => {
    window.removeEventListener('storage', handleStorageChange);
    window.removeEventListener('travel-map-storage', handleStorageChange);
  };
}

function emitTravelMapStorageChange() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event('travel-map-storage'));
}
