import { useEffect, useRef, useState, useCallback } from 'preact/hooks';
import locationsData from '../../data/locations.geojson';

interface Station {
  id: number;
  address: string;
  town: string;
  county: string;
  lat: number;
  lng: number;
}

// Parse and sort stations once at module level
const allStations: Station[] = (locationsData as GeoJSON.FeatureCollection).features
  .filter(
    (f) =>
      f.geometry?.type === 'Point' &&
      f.properties != null
  )
  .map((f) => {
    const p = f.properties as Record<string, any>;
    const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
    return {
      id: p.ESITEID as number,
      address: String(p.PRIMARYADD ?? ''),
      town: String(p.TOWNNAME ?? ''),
      county: String(p.COUNTY ?? ''),
      lat,
      lng,
    };
  })
  .sort((a, b) => a.town.localeCompare(b.town) || a.address.localeCompare(b.address));

const TOTAL = allStations.length;

function matchesQuery(station: Station, lower: string): boolean {
  return (
    station.address.toLowerCase().includes(lower) ||
    station.town.toLowerCase().includes(lower) ||
    station.county.toLowerCase().includes(lower)
  );
}

export default function MapSidebar() {
  const [query, setQuery] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Derived state
  const lowerCommitted = committedQuery.toLowerCase();
  const filteredStations = committedQuery
    ? allStations.filter((s) => matchesQuery(s, lowerCommitted))
    : allStations;

  const lowerQuery = query.toLowerCase();
  const suggestions =
    query.length > 0
      ? allStations.filter((s) => matchesQuery(s, lowerQuery)).slice(0, 8)
      : [];

  // Scroll active card into view after activeId changes
  useEffect(() => {
    if (activeId === null || !listRef.current) return;
    const card = listRef.current.querySelector(`[data-id="${activeId}"]`);
    if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  // Listen for station:highlight from the map
  useEffect(() => {
    const handler = (e: Event) => {
      const { id } = (e as CustomEvent<{ id: number }>).detail;
      setActiveId(id);
    };
    window.addEventListener('station:highlight', handler);
    return () => window.removeEventListener('station:highlight', handler);
  }, []);

  // Close sidebar on Escape key (mobile) or close dropdown
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (dropdownOpen) {
          setDropdownOpen(false);
        } else {
          setSidebarOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dropdownOpen]);

  // Commit search: filter list + sync map
  const commit = useCallback((q: string, picked?: Station) => {
    const trimmed = q.trim();
    setCommittedQuery(trimmed);
    setDropdownOpen(false);
    setFocusedIndex(-1);

    if (picked) {
      setActiveId(picked.id);
      window.dispatchEvent(
        new CustomEvent('station:select', {
          detail: { id: picked.id, lat: picked.lat, lng: picked.lng },
        })
      );
      return;
    }

    const lower = trimmed.toLowerCase();
    const matches = trimmed
      ? allStations.filter((s) => matchesQuery(s, lower))
      : allStations;

    if (matches.length === 1) {
      const s = matches[0];
      setActiveId(s.id);
      window.dispatchEvent(
        new CustomEvent('station:select', {
          detail: { id: s.id, lat: s.lat, lng: s.lng },
        })
      );
    } else {
      setActiveId(null);
      // Empty ids → reset map to default bounds
      const ids = trimmed ? matches.map((s) => s.id) : [];
      window.dispatchEvent(
        new CustomEvent('station:fitbounds', { detail: { ids } })
      );
    }
  }, []);

  const handleInputChange = (e: Event) => {
    const val = (e.target as HTMLInputElement).value;
    setQuery(val);
    setDropdownOpen(val.length > 0);
    setFocusedIndex(-1);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      if (!dropdownOpen && query.length > 0) {
        setDropdownOpen(true);
      }
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (dropdownOpen && focusedIndex >= 0 && suggestions[focusedIndex]) {
        const s = suggestions[focusedIndex];
        setQuery(s.address);
        commit(s.address, s);
      } else {
        commit(query);
      }
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
  };

  const handleBackdropClick = () => setSidebarOpen(false);
  const handleToggle = () => setSidebarOpen((o) => !o);

  const handleDropdownItemClick = (s: Station) => {
    setQuery(s.address);
    commit(s.address, s);
  };

  const handleCardClick = (s: Station) => {
    setActiveId(s.id);
    window.dispatchEvent(
      new CustomEvent('station:select', {
        detail: { id: s.id, lat: s.lat, lng: s.lng },
      })
    );
  };

  return (
    <>
      {/* Mobile toggle */}
      <button
        class="sidebar-toggle"
        onClick={handleToggle}
        aria-label="Toggle station list"
        aria-expanded={sidebarOpen}
      >
        &#8801;
      </button>

      {/* Mobile backdrop */}
      <div
        class={sidebarOpen ? 'sidebar-backdrop open' : 'sidebar-backdrop'}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Sidebar panel */}
      <aside class={sidebarOpen ? 'sidebar open' : 'sidebar'} aria-label="Fire station search">
        {/* Search bar */}
        <div class="sidebar-search">
          <div class="sidebar-search-row">
            <input
              ref={inputRef}
              type="search"
              placeholder="Search stations…"
              value={query}
              onInput={handleInputChange}
              onKeyDown={handleKeyDown as any}
              aria-label="Search fire stations"
              aria-autocomplete="list"
              aria-expanded={dropdownOpen && suggestions.length > 0}
              autocomplete="off"
            />
            <button onClick={() => commit(query)} type="button">
              Search
            </button>
          </div>

          {/* Autocomplete dropdown */}
          {dropdownOpen && suggestions.length > 0 && (
            <div class="autocomplete-dropdown" role="listbox">
              {suggestions.map((s, i) => (
                <div
                  key={s.id}
                  class={focusedIndex === i ? 'autocomplete-item focused' : 'autocomplete-item'}
                  role="option"
                  aria-selected={focusedIndex === i}
                  onClick={() => handleDropdownItemClick(s)}
                >
                  <div class="ac-address">{s.address}</div>
                  <div class="ac-meta">
                    {s.town} &middot; {s.county} COUNTY
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Result count */}
        <div class="sidebar-count" aria-live="polite">
          Showing {filteredStations.length} of {TOTAL} stations
        </div>

        {/* Station list */}
        <div class="sidebar-list" ref={listRef} role="list">
          {filteredStations.map((s) => (
            <div
              key={s.id}
              data-id={s.id}
              class={activeId === s.id ? 'station-card active' : 'station-card'}
              role="listitem"
              onClick={() => handleCardClick(s)}
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e as KeyboardEvent).key === 'Enter') handleCardClick(s);
              }}
            >
              <div class="card-address">{s.address}</div>
              <div class="card-town">{s.town}</div>
              <div class="card-county">{s.county} COUNTY</div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
