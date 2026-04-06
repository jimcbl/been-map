'use client';

import { useState, type MouseEvent as ReactMouseEvent } from 'react';
import countriesTopology from 'world-atlas/countries-50m.json';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { continents, type ContinentData, type Country, visitedPalette } from '@/app/components/world-travel-map-data';

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

export default function WorldTravelMap() {
  const [hoveredCountry, setHoveredCountry] = useState<HoveredCountry | null>(null);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff9ea,_#f4efe4_40%,_#ece7de_100%)] px-5 py-8 text-stone-900 sm:px-8 lg:px-12">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 rounded-[32px] border border-white/70 bg-white/80 p-5 shadow-[0_24px_80px_rgba(78,58,21,0.12)] backdrop-blur md:p-8">
        <Header />

        <div className="flex flex-col gap-8">
          {continents.map((continent) => (
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

function Header() {
  return (
    <div className="flex flex-col gap-3 border-b border-stone-200 pb-6">
      <p className="text-sm font-semibold uppercase tracking-[0.32em] text-amber-700">Been There Done That</p>
      <div className="">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-stone-950 md:text-5xl">Jim's travel maps</h1>
          {/* <p className="mt-2 text-sm leading-6 text-stone-600 md:text-base">
            Europe stays first, and Asia now sits directly underneath it using the same
            <code className="mx-1 rounded bg-stone-100 px-1.5 py-0.5 text-[0.9em]">react-simple-maps</code>
            setup.
          </p> */}
        </div>
      </div>
    </div>
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
