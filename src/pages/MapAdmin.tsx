import { useState, useEffect, useRef, useCallback } from "react";
import { useHistory } from "react-router-dom";

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE_URL      = "https://itservicesph.com/IT383/CORTEZ/Cortez/index.php";
const BASE_UPLOADS  = "https://itservicesph.com/IT383/CORTEZ/Cortez/uploads/profile/";
const API_ADMIN     = "https://itservicesph.com/IT383/CORTEZ/Cortez/index.php/API_mapadmin";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Spot {
  id?:          number;
  spot_id?:     number;
  spot_name:    string;
  location:     string;
  description?: string;
  category?:    string;
  photo?:       string | null;
  image_url?:   string | null;
  lat?:         number | null;
  lng?:         number | null;
  status?:      string;
  created_at?:  string | null;
  [key: string]: unknown;
}

interface SearchResult {
  spot_id:   number;
  spot_name: string;
  location:  string;
  image_url: string | null;
}

interface MapAdminProps {
  spots?:         Spot[];
  username?:      string;
  profile_photo?: string;
}

// ─── Nominatim direct geocode ─────────────────────────────────────────────────
async function nominatimGeocode(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res     = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ", Philippines")}&limit=1&countrycodes=ph`,
      { headers: { "Accept-Language": "en" } }
    );
    const results = await res.json();
    if (results?.length) return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
  } catch {}
  return null;
}

// ─── Leaflet Map ──────────────────────────────────────────────────────────────
function LeafletMap({
  spots,
  flyToRef,
}: {
  spots: Spot[];
  flyToRef: React.MutableRefObject<((lat: number, lng: number) => void) | null>;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstRef      = useRef<any>(null);
  const markersRef      = useRef<any[]>([]);
  const spotCoordsRef   = useRef<Map<number, { lat: number; lng: number }>>(new Map());

  // ── Init map once ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapInstRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const map = L.map(mapContainerRef.current).setView([11.0, 122.0], 8);
    mapInstRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    // Expose flyTo for search pick
    flyToRef.current = (lat: number, lng: number) => {
      map.flyTo([lat, lng], 14, { animate: true, duration: 1.2 });
      // Open popup for marker at those coords
      setTimeout(() => {
        markersRef.current.forEach(m => {
          const ll = m.getLatLng();
          if (Math.abs(ll.lat - lat) < 0.0001 && Math.abs(ll.lng - lng) < 0.0001) {
            m.openPopup();
          }
        });
      }, 900);
    };

    return () => {
      map.remove();
      mapInstRef.current = null;
      flyToRef.current   = null;
    };
  }, []);

  // ── Place markers when spots change ───────────────────────────────────────
  useEffect(() => {
    const map = mapInstRef.current;
    const L   = (window as any).L;
    if (!map || !L || spots.length === 0) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const blueIcon = L.icon({
      iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
    });

    function buildPopup(spot: Spot): string {
      const imgSrc = spot.image_url || spot.photo || "";
      const imgTag = imgSrc
        ? `<img src="${imgSrc}" alt="${spot.spot_name}" style="width:100%;height:90px;object-fit:cover;border-radius:8px;margin-bottom:6px;display:block;">`
        : "";
      return (
        `<div style="font-family:'DM Sans',sans-serif;min-width:180px;max-width:220px;">` +
        imgTag +
        `<strong style="color:#1e3a8a;font-size:14px;">${spot.spot_name}</strong>` +
        `<br><span style="color:#6b8ab8;font-size:12px;">📍 ${spot.location}</span>` +
        (spot.category ? `<br><span style="font-size:11px;color:#94a3b8;">${spot.category}</span>` : "") +
        `</div>`
      );
    }

    function addMarker(spot: Spot, lat: number, lng: number) {
      const marker = L.marker([lat, lng], { icon: blueIcon })
        .addTo(map)
        .bindPopup(buildPopup(spot));
      (marker as any)._spot_id = spot.spot_id ?? spot.id;
      markersRef.current.push(marker);
      const sid = spot.spot_id ?? spot.id;
      if (sid) spotCoordsRef.current.set(sid, { lat, lng });
    }

    // Spots with coords already — place immediately
    const needsGeocode: Spot[] = [];
    spots.forEach(spot => {
      if (spot.lat != null && spot.lng != null) {
        addMarker(spot, spot.lat, spot.lng);
      } else {
        needsGeocode.push(spot);
      }
    });

    // Geocode the rest via server proxy then Nominatim fallback
    needsGeocode.forEach(spot => {
      const query = encodeURIComponent(spot.location + ", Philippines");
      fetch(`${API_ADMIN}/nominatim_proxy?q=${query}`, { credentials: "include" })
        .then(r => r.json())
        .then((data: any[]) => {
          if (data?.[0]) {
            addMarker(spot, parseFloat(data[0].lat), parseFloat(data[0].lon));
          }
        })
        .catch(() => {
          // Fallback: direct Nominatim
          nominatimGeocode(spot.location).then(geo => {
            if (geo) addMarker(spot, geo.lat, geo.lng);
          });
        });
    });
  }, [spots]);

  return (
    <div
      ref={mapContainerRef}
      id="map"
      style={{
        height: 600, width: "100%",
        borderRadius: 12, border: "1.5px solid #bfdbfe", overflow: "hidden",
      }}
    />
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────
const cleanPhoto = (p: string | null | undefined): string | null => {
  if (!p) return null;
  return p.includes("http") ? p.split("/").pop() ?? null : p;
};

// ─── MapAdmin Page ────────────────────────────────────────────────────────────
export default function MapAdmin({
  spots:         initialSpots = [],
  username:      propUsername,
  profile_photo: propPhoto,
}: MapAdminProps) {
  const history = useHistory();

  const username   = propUsername ?? localStorage.getItem("username")      ?? "Admin";
  const savedPhoto = propPhoto    ?? localStorage.getItem("profile_photo") ?? null;

  const [spots,          setSpots]         = useState<Spot[]>(initialSpots);
  const [loading,        setLoading]       = useState(true);
  const [leafletReady,   setLeafletReady]  = useState(false);
  const [error,          setError]         = useState<string | null>(null);
  const [searchQuery,    setSearchQuery]   = useState("");
  const [searchResults,  setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchDrop, setShowSearchDrop]= useState(false);
  const [userDropOpen,   setUserDropOpen]  = useState(false);

  const searchRef    = useRef<HTMLDivElement>(null);
  const userAreaRef  = useRef<HTMLDivElement>(null);
  const searchTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spotsRef     = useRef<Spot[]>(initialSpots);
  const flyToRef     = useRef<((lat: number, lng: number) => void) | null>(null);

  useEffect(() => { spotsRef.current = spots; }, [spots]);

  // ── Load Leaflet JS once ───────────────────────────────────────────────────
  useEffect(() => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css"; link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    if ((window as any).L) {
      setLeafletReady(true);
    } else {
      const script = document.createElement("script");
      script.src   = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => setLeafletReady(true);
      document.head.appendChild(script);
    }
  }, []);

  // ── Fetch spots from API_mapadmin/spots ────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_ADMIN}/spots`, { method: "GET", credentials: "include" })
      .then(r => {
        if (!r.ok) throw new Error(`Failed to load spots (${r.status})`);
        return r.json();
      })
      .then((data: Spot[]) => {
        setSpots(data);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  // ── Live search — calls GET /api_mapadmin/search_json?keyword=… ───────────
  // Mirrors MapPage.tsx search: debounced 300ms, JSON response, image thumbnail
  const handleSearchInput = useCallback((val: string) => {
    setSearchQuery(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (!val.trim()) {
      setSearchResults([]);
      setShowSearchDrop(false);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      let results: SearchResult[] = [];

      // ── Try API JSON search first ──────────────────────────────────────
      try {
        const res  = await fetch(`${API_ADMIN}/search_json?keyword=${encodeURIComponent(val)}`, {
          credentials: "include",
        });
        const text = await res.text();
        if (!text.trimStart().startsWith("<")) {
          const data = JSON.parse(text);
          if (data?.status === "ok" && Array.isArray(data.results)) {
            results = data.results;
          }
        }
      } catch {}

      // ── Client-side fallback if API not yet deployed ───────────────────
      if (!results.length) {
        const kw = val.toLowerCase();
        results = spotsRef.current
          .filter(s =>
            s.spot_name.toLowerCase().includes(kw) ||
            s.location.toLowerCase().includes(kw)
          )
          .map(s => ({
            spot_id:   (s.spot_id ?? s.id) as number,
            spot_name: s.spot_name,
            location:  s.location,
            image_url: s.image_url ?? s.photo ?? null,
          }));
      }

      setSearchResults(results);
      setShowSearchDrop(true);
    }, 300);
  }, []);

  // ── Pick search result → fly map to that spot (same as MapPage) ───────────
  const handlePickResult = useCallback(async (result: SearchResult) => {
    setSearchQuery(result.spot_name);
    setShowSearchDrop(false);

    // Check if we already have coords
    const spot = spotsRef.current.find(
      s => (s.spot_id ?? s.id) === result.spot_id
    );
    if (spot?.lat != null && spot.lng != null && flyToRef.current) {
      flyToRef.current(spot.lat, spot.lng);
      return;
    }

    // Geocode via server proxy then fly
    try {
      const q   = encodeURIComponent(result.location + ", Philippines");
      const res = await fetch(`${API_ADMIN}/nominatim_proxy?q=${q}`, { credentials: "include" });
      const data: any[] = await res.json();
      if (data?.[0] && flyToRef.current) {
        flyToRef.current(parseFloat(data[0].lat), parseFloat(data[0].lon));
        return;
      }
    } catch {}

    // Direct Nominatim fallback
    const geo = await nominatimGeocode(result.location);
    if (geo && flyToRef.current) flyToRef.current(geo.lat, geo.lng);
  }, []);

  // ── Close dropdowns on outside click ──────────────────────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDrop(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (userAreaRef.current && !userAreaRef.current.contains(e.target as Node)) {
        setUserDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentAvatar = cleanPhoto(savedPhoto)
    ? `${BASE_UPLOADS}${cleanPhoto(savedPhoto)}`
    : null;

  const topbarAvatar =
    currentAvatar ??
    `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=1a56db&color=fff`;

  const NAV_ITEMS = [
    { icon: "fa-tachometer-alt", label: "Dashboard", path: "/dashboard"   },
    { icon: "fa-users",          label: "Users",     path: "/users"        },
    { icon: "fa-user",           label: "Profile",   path: "/profileadmin" },
    { icon: "fa-map",            label: "Map",       path: "/mapadmin"     },
    { icon: "fa-archive",        label: "Archived",  path: "/archived"     },
  ];

  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@400;500&display=swap');
        *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
        html,body,#root { height:100%; overflow:hidden; }
        body { font-family:'DM Sans',sans-serif; background:#f8f9fc; }
        #wrapper { display:flex; height:100vh; overflow:hidden; }

        /* ── Sidebar ── */
        #sidebar {
          width:225px; min-width:225px;
          background:linear-gradient(180deg,#4e73df 10%,#224abe 100%);
          display:flex; flex-direction:column;
          height:100vh; flex-shrink:0; z-index:100;
        }
        .sidebar-brand { display:flex; align-items:center; gap:10px; padding:1.25rem 1rem; color:#fff; text-decoration:none; }
        .sidebar-brand-icon { font-size:22px; transform:rotate(-15deg); display:inline-block; }
        .sidebar-brand-text { font-size:17px; font-weight:700; }
        hr.sidebar-divider { border:none; border-top:1px solid rgba(255,255,255,0.15); margin:0 1rem; }
        .sidebar-nav { list-style:none; padding:0; flex:1; }
        .sidebar-nav li a {
          display:flex; align-items:center; gap:10px; padding:12px 20px;
          color:rgba(255,255,255,0.75); font-size:13.5px; font-weight:500;
          text-decoration:none; transition:background 0.15s,color 0.15s;
        }
        .sidebar-nav li a:hover,
        .sidebar-nav li.active a { background:rgba(255,255,255,0.12); color:#fff; }
        .sidebar-nav li a i { width:18px; text-align:center; font-size:14px; }

        /* ── Content wrapper ── */
        #content-wrapper {
          flex:1; display:flex; flex-direction:column;
          height:100vh; overflow-y:auto; overflow-x:hidden;
          scrollbar-width:thin; scrollbar-color:#bfdbfe #f1f5f9;
        }
        #content-wrapper::-webkit-scrollbar { width:8px; }
        #content-wrapper::-webkit-scrollbar-track { background:#f1f5f9; }
        #content-wrapper::-webkit-scrollbar-thumb { background:#bfdbfe; border-radius:4px; }
        #content-wrapper::-webkit-scrollbar-thumb:hover { background:#93c5fd; }

        /* ── Topbar ── */
        #topbar {
          height:65px; flex-shrink:0; background:#fff;
          box-shadow:0 2px 4px rgba(0,0,0,0.08);
          display:flex; align-items:center; padding:0 1.5rem; gap:1rem;
          position:sticky; top:0; z-index:99;
        }
        .topbar-search { display:flex; position:relative; }
        .topbar-search input {
          border:1px solid #d1d3e2; border-right:none;
          border-radius:5px 0 0 5px; padding:7px 14px;
          font-size:13px; font-family:'DM Sans',sans-serif;
          background:#f8f9fc; color:#333; width:280px; outline:none;
        }
        .topbar-search button {
          background:#4e73df; border:none; border-radius:0 5px 5px 0;
          padding:7px 14px; color:#fff; cursor:pointer;
        }

        /* ── Search dropdown — mirrors MapPage style ── */
        .search-dropdown {
          position:absolute; top:100%; left:0; background:#fff; width:340px;
          z-index:1000; border:1px solid #ddd; border-radius:5px;
          max-height:300px; overflow-y:auto; box-shadow:0 4px 12px rgba(0,0,0,0.10);
        }
        .search-item {
          display:flex; align-items:center; padding:10px;
          border-bottom:1px solid #eee; cursor:pointer;
          text-decoration:none; color:inherit;
        }
        .search-item:hover { background:#f5f5f5; }
        .search-item img {
          width:45px; height:45px; border-radius:5px;
          margin-right:10px; object-fit:cover; flex-shrink:0;
        }
        .search-item-no-img {
          width:45px; height:45px; border-radius:5px; margin-right:10px;
          background:#eff6ff; border:1px solid #bfdbfe;
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
        }
        .search-item-no-img i { color:#93c5fd; font-size:18px; }
        .search-text    { line-height:1.2; }
        .search-name    { font-weight:bold; font-size:13px; color:#1e3a8a; }
        .search-location{ font-size:12px; color:gray; }
        .search-no-result { padding:12px 16px; font-size:13px; color:#94a3b8; text-align:center; }

        .topbar-right { display:flex; align-items:center; gap:1rem; margin-left:auto; }
        .topbar-divider { border-left:1px solid #e3e6f0; height:36px; }
        .user-area { display:flex; align-items:center; gap:8px; cursor:pointer; position:relative; }
        .user-area > span { font-size:13px; font-weight:600; color:#333; }
        .user-area img { width:32px; height:32px; border-radius:50%; object-fit:cover; }
        .user-dropdown {
          position:absolute; top:calc(100% + 10px); right:0; background:#fff;
          border:1px solid #e3e6f0; border-radius:8px;
          box-shadow:0 4px 16px rgba(0,0,0,0.10); min-width:160px; z-index:200;
        }
        .user-dropdown a {
          display:flex; align-items:center; gap:8px;
          padding:10px 16px; font-size:13px; color:#555; text-decoration:none;
        }
        .user-dropdown a:hover { background:#f8f9fc; }

        /* ── Page content ── */
        #page-content { flex:1; padding:1.5rem; }
        .ta-card { background:#fff; border-radius:14px; border:1.5px solid #bfdbfe; box-shadow:0 2px 8px rgba(26,86,219,0.07); overflow:hidden; }
        .ta-card-header { padding:1rem 1.25rem; border-bottom:1.5px solid #bfdbfe; display:flex; align-items:center; gap:10px; }
        .ta-section-title { font-family:'Playfair Display',serif; font-size:17px; color:#1a56db; margin:0; border-left:4px solid #1a56db; padding-left:12px; }
        .ta-badge { display:inline-flex; align-items:center; gap:5px; background:#eff6ff; border:1px solid #bfdbfe; color:#1a56db; border-radius:20px; padding:3px 12px; font-size:12px; font-weight:500; margin-left:auto; }
        .ta-card-body { padding:1.25rem; }

        .map-loading { height:200px; display:flex; align-items:center; justify-content:center; color:#6b8ab8; font-size:14px; gap:8px; }
        .map-error { background:#fef2f2; border:1px solid #fca5a5; color:#b91c1c; border-radius:8px; padding:12px 16px; font-size:13px; margin-bottom:1rem; }

        @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
      `}</style>

      <div id="wrapper">

        {/* ── SIDEBAR ── */}
        <div id="sidebar">
          <a className="sidebar-brand" href="/dashboard">
            <span className="sidebar-brand-icon"><i className="fas fa-laugh-wink" /></span>
            <span className="sidebar-brand-text"><em><b>TOUR_</b></em>ISTA</span>
          </a>
          <hr className="sidebar-divider" />
          <ul className="sidebar-nav">
            {NAV_ITEMS.map(({ icon, label, path }) => (
              <li key={label} className={path === "/mapadmin" ? "active" : ""}>
                <a href="#" onClick={e => { e.preventDefault(); history.push(path); }}>
                  <i className={`fas fa-fw ${icon}`} />
                  <span>{label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* ── CONTENT WRAPPER ── */}
        <div id="content-wrapper">

          {/* ── TOPBAR ── */}
          <div id="topbar">

            {/* Search — same UX as MapPage.tsx */}
            <div className="topbar-search" ref={searchRef}>
              <input
                type="text"
                placeholder="Search tourist spots..."
                value={searchQuery}
                onChange={e => handleSearchInput(e.target.value)}
                onBlur={() => setTimeout(() => setShowSearchDrop(false), 150)}
                autoComplete="off"
              />
              <button type="button">
                <i className="fas fa-search fa-sm" />
              </button>

              {showSearchDrop && (
                <div className="search-dropdown">
                  {searchResults.length === 0 ? (
                    <div className="search-no-result">No spots found.</div>
                  ) : (
                    searchResults.map(result => (
                      <div
                        key={result.spot_id}
                        className="search-item"
                        onMouseDown={() => handlePickResult(result)}
                      >
                        {result.image_url ? (
                          <img
                            src={result.image_url}
                            alt={result.spot_name}
                            onError={e => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                          />
                        ) : (
                          <div className="search-item-no-img">
                            <i className="fas fa-map-marker-alt" />
                          </div>
                        )}
                        <div className="search-text">
                          <div className="search-name">{result.spot_name}</div>
                          <div className="search-location">{result.location}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="topbar-right">
              <div className="topbar-divider" />
              <div className="user-area" ref={userAreaRef} onClick={() => setUserDropOpen(o => !o)}>
                <span>{username}</span>
                <img src={topbarAvatar} alt="avatar" />
                {userDropOpen && (
                  <div className="user-dropdown">
                    <a href="#" onClick={e => {
                      e.preventDefault();
                      window.location.href = `${BASE_URL}/user/logout`;
                    }}>
                      <i className="fas fa-sign-out-alt fa-sm fa-fw" style={{ color: "#aaa" }} /> Logout
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── PAGE CONTENT ── */}
          <div id="page-content">
            <div className="ta-card">
              <div className="ta-card-header">
                <h6 className="ta-section-title">All Tourist Spots</h6>
                <span className="ta-badge">
                  <i className="fas fa-map-marker-alt" />
                  {spots.length} spots
                </span>
              </div>
              <div className="ta-card-body">

                {error && (
                  <div className="map-error">
                    <i className="fas fa-exclamation-circle" style={{ marginRight: 6 }} />
                    {error}
                  </div>
                )}

                {loading || !leafletReady ? (
                  <div className="map-loading">
                    <i className="fas fa-spinner" style={{ animation: "spin 1.2s linear infinite" }} />
                    Loading spots…
                  </div>
                ) : (
                  <LeafletMap spots={spots} flyToRef={flyToRef} />
                )}

              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}