import { useState, useEffect, useRef, useCallback } from "react";
import { useHistory } from "react-router-dom";

// ─── Base URL ─────────────────────────────────────────────────────────────────
const API_BASE = "https://itservicesph.com/IT383/CORTEZ/Cortez/index.php/API_map";

// ─── API availability flag ────────────────────────────────────────────────────
const _api = { available: true };

async function _safeFetch(url: string, options?: RequestInit): Promise<any | null> {
  if (!_api.available) return null;
  try {
    const res         = await fetch(url, { credentials: "include", ...options });
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await res.text();
      if (text.trimStart().startsWith("<")) {
        _api.available = false;
        console.warn("[MapPage] API_map returned HTML — switching to Nominatim fallback.");
        return null;
      }
      try { return JSON.parse(text); } catch { return null; }
    }
    return await res.json();
  } catch (e) {
    console.error("[MapPage] fetch error:", e);
    return null;
  }
}

// ─── API helpers ──────────────────────────────────────────────────────────────
async function apiGetSpots(params?: { category?: string }) {
  const qs = new URLSearchParams();
  if (params?.category && params.category !== "all") qs.set("category", params.category);
  return _safeFetch(`${API_BASE}/spots?${qs.toString()}`);
}

async function apiGetSpot(id: number) {
  return _safeFetch(`${API_BASE}/spot/${id}`);
}

async function apiGeocode(address: string, spotId?: number) {
  const qs = new URLSearchParams({ address });
  if (spotId) qs.set("spot_id", String(spotId));
  const data = await _safeFetch(`${API_BASE}/geocode?${qs.toString()}`);
  if (data?.status === "ok" && data.result) return data.result as { lat: number; lng: number; display_name: string };
  return null;
}

async function apiGeocodeBatch(items: { spot_id: number; address: string }[]) {
  const data = await _safeFetch(`${API_BASE}/geocode_batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(items),
  });
  if (data?.status === "ok" && Array.isArray(data.results))
    return data.results as { spot_id: number; lat: number | null; lng: number | null; source: string }[];
  return null;
}

async function apiSearch(keyword: string) {
  return _safeFetch(`${API_BASE}/search?keyword=${encodeURIComponent(keyword)}`);
}

async function apiGetProfile() {
  return _safeFetch(`${API_BASE}/profile`);
}

async function apiGetCategories() {
  return _safeFetch(`${API_BASE}/categories`);
}

// ─── Nominatim fallback ───────────────────────────────────────────────────────
async function nominatimGeocode(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ", Philippines")}&limit=1&countrycodes=ph`,
      { headers: { "Accept-Language": "en" } }
    );
    const results = await res.json();
    if (results?.length) return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
  } catch (e) {
    console.error("[MapPage] Nominatim error:", e);
  }
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface TouristSpot {
  spot_id:      number;
  spot_name:    string;
  location:     string;
  category?:    string;
  description?: string;
  spot_image?:  string;
  image_url?:   string;
  lat?:         number | null;
  lng?:         number | null;
}

interface SearchResult {
  spot_id:   number;
  spot_name: string;
  location:  string;
  category:  string;
  image_url: string;
}

interface MapUserProps {
  spots?:         TouristSpot[];
  username?:      string;
  profile_photo?: string;
  onLogout?:      () => void;
}

// ─── Nav Items ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { icon: "fa-tachometer-alt", label: "Dashboard", path: "/userdashboard" },
  { icon: "fa-heart",          label: "Favorites",  path: "/favorite"      },
  { icon: "fa-user",           label: "Profile",    path: "/profilepage"   },
  { icon: "fa-map",            label: "Map",        path: "/mappage"       },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div id="sidebar">
      <a className="sidebar-brand" href="#" onClick={e => { e.preventDefault(); onNavigate("/userdashboard"); }}>
        <span className="sidebar-brand-icon"><i className="fas fa-laugh-wink" /></span>
        <span style={{ fontSize: 17, fontWeight: 700 }}><em><b>TOUR_</b></em>ISTA</span>
      </a>
      <hr className="sidebar-divider" />
      <ul className="sidebar-nav">
        {NAV_ITEMS.map(({ icon, label, path }) => (
          <li key={label} className={path === "/mappage" ? "active" : ""}>
            <a href="#" onClick={e => { e.preventDefault(); onNavigate(path); }}>
              <i className={`fas fa-fw ${icon}`} />
              <span>{label}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── MapPage ──────────────────────────────────────────────────────────────────
export default function MapPage({
  spots:         propSpots,
  username:      propUsername,
  profile_photo: propPhoto,
  onLogout,
}: MapUserProps) {
  const history        = useHistory();
  const handleNavigate = (path: string) => history.push(path);
  const handleLogout   = onLogout ?? (() => history.push("/login"));

  // ── State ──────────────────────────────────────────────────────────────────
  const [spots,          setSpots]          = useState<TouristSpot[]>(propSpots ?? []);
  const [username,       setUsername]       = useState(propUsername ?? "");
  const [profilePhoto,   setProfilePhoto]   = useState(propPhoto ?? "");
  const [userDropOpen,   setUserDropOpen]   = useState(false);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [searchResults,  setSearchResults]  = useState<SearchResult[]>([]);
  const [showSearchDrop, setShowSearchDrop] = useState(false);
  const [spotsTotal,     setSpotsTotal]     = useState(propSpots?.length ?? 0);
  const [loadingSpots,   setLoadingSpots]   = useState(!propSpots);
  const [mapReady,       setMapReady]       = useState(false);
  const [apiStatus,      setApiStatus]      = useState<"checking" | "live" | "offline">("checking");

  const mapRef         = useRef<HTMLDivElement>(null);
  const leafletMapRef  = useRef<any>(null);
  const markersRef     = useRef<any[]>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spotsRef       = useRef<TouristSpot[]>(propSpots ?? []);

  useEffect(() => { spotsRef.current = spots; }, [spots]);

  // ── Boot: fetch profile + spots ────────────────────────────────────────────
  useEffect(() => {
    if (!propUsername) {
      apiGetProfile().then(data => {
        if (data?.status === "success") {
          setUsername(data.user?.username ?? "");
          setProfilePhoto(data.user?.profile_photo ?? "");
          setApiStatus("live");
        } else {
          setApiStatus("offline");
        }
      });
    }
    if (!propSpots) {
      setLoadingSpots(true);
      apiGetSpots().then(data => {
        if (data?.status === "success" && Array.isArray(data.spots)) {
          setSpots(data.spots);
          setSpotsTotal(data.count ?? data.spots.length);
          setApiStatus("live");
        } else {
          setApiStatus("offline");
          setSpots([]);
        }
      }).finally(() => setLoadingSpots(false));
    } else {
      setSpotsTotal(propSpots.length);
      setLoadingSpots(false);
      setApiStatus(propSpots.length ? "live" : "checking");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load Leaflet ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id   = "leaflet-css";
      link.rel  = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    if ((window as any).L) {
      setMapReady(true);
    } else {
      const script  = document.createElement("script");
      script.src    = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => setMapReady(true);
      document.head.appendChild(script);
    }
    return () => {
      if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null; }
    };
  }, []);

  // ── Initialise Leaflet map ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || leafletMapRef.current || loadingSpots) return;
    const L   = (window as any).L;
    const map = L.map(mapRef.current).setView([11.0, 122.0], 8);
    leafletMapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
  }, [mapReady, loadingSpots]);

  // ── Place / refresh markers ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !leafletMapRef.current || spots.length === 0) return;
    const L   = (window as any).L;
    const map = leafletMapRef.current;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    const blueIcon = L.icon({
      iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
    });
    function buildPopup(spot: TouristSpot) {
      const imgSrc = spot.image_url || spot.spot_image || "";
      const imgTag = imgSrc ? `<img src="${imgSrc}" alt="${spot.spot_name}" style="width:100%;height:90px;object-fit:cover;border-radius:8px;margin-bottom:6px;display:block;">` : "";
      return `<div style="font-family:'DM Sans',sans-serif;min-width:180px;max-width:220px;">${imgTag}<strong style="color:#1e3a8a;font-size:14px;">${spot.spot_name}</strong><br><span style="color:#6b8ab8;font-size:12px;">📍 ${spot.location}</span>${spot.category ? `<br><span style="font-size:11px;color:#94a3b8;">${spot.category}</span>` : ""}</div>`;
    }
    function addMarker(spot: TouristSpot, lat: number, lng: number) {
      const marker = L.marker([lat, lng], { icon: blueIcon }).addTo(map).bindPopup(buildPopup(spot));
      markersRef.current.push(marker);
      (marker as any)._spot_id = spot.spot_id;
    }
    const needsGeocode: TouristSpot[] = [];
    spots.forEach(spot => {
      const lat = spot.lat;
      const lng = spot.lng ?? (spot as any).lon;
      if (lat != null && lng != null) addMarker(spot, lat, lng);
      else needsGeocode.push(spot);
    });
    if (needsGeocode.length === 0) return;
    if (_api.available) {
      apiGeocodeBatch(needsGeocode.map(s => ({ spot_id: s.spot_id, address: s.location }))).then(results => {
        if (results) {
          results.forEach(r => {
            if (r.lat == null || r.lng == null) return;
            const spot = needsGeocode.find(s => s.spot_id === r.spot_id);
            if (!spot) return;
            addMarker(spot, r.lat, r.lng);
            setSpots(prev => prev.map(s => s.spot_id === r.spot_id ? { ...s, lat: r.lat, lng: r.lng } : s));
          });
        } else {
          _geocodeDirectly(needsGeocode, addMarker);
        }
      });
    } else {
      _geocodeDirectly(needsGeocode, addMarker);
    }
  }, [spots, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  function _geocodeDirectly(list: TouristSpot[], addMarker: (spot: TouristSpot, lat: number, lng: number) => void) {
    list.reduce((chain, spot, index) => chain.then(() => new Promise<void>(resolve => {
      setTimeout(async () => {
        const geo = await nominatimGeocode(spot.location);
        if (geo) {
          addMarker(spot, geo.lat, geo.lng);
          setSpots(prev => prev.map(s => s.spot_id === spot.spot_id ? { ...s, lat: geo.lat, lng: geo.lng } : s));
        }
        resolve();
      }, index * 1200);
    })), Promise.resolve());
  }

  // ── Live search ────────────────────────────────────────────────────────────
  const handleSearchInput = useCallback((val: string) => {
    setSearchQuery(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!val.trim()) { setSearchResults([]); setShowSearchDrop(false); return; }
    searchTimerRef.current = setTimeout(async () => {
      let results: SearchResult[] = [];
      if (_api.available) {
        const data = await apiSearch(val);
        if (data?.status === "success" && Array.isArray(data.spots)) {
          results = data.spots.map((s: any) => ({
            spot_id:   s.spot_id,
            spot_name: s.spot_name,
            location:  s.location,
            category:  typeof s.category === "object" ? s.category?.value ?? "Other" : (s.category ?? "Other"),
            image_url: s.image_url ?? s.spot_image ?? "",
          }));
        }
      }
      if (!results.length) {
        const kw = val.toLowerCase();
        results = spotsRef.current
          .filter(s => s.spot_name.toLowerCase().includes(kw) || s.location.toLowerCase().includes(kw))
          .map(s => ({ spot_id: s.spot_id, spot_name: s.spot_name, location: s.location, category: s.category ?? "Other", image_url: s.image_url ?? s.spot_image ?? "" }));
      }
      setSearchResults(results);
      setShowSearchDrop(true);
    }, 300);
  }, []);

  // ── Fly to spot ────────────────────────────────────────────────────────────
  const handlePickResult = useCallback(async (result: SearchResult) => {
    setSearchQuery(result.spot_name);
    setShowSearchDrop(false);
    const map = leafletMapRef.current;
    if (!map) return;
    const spot = spotsRef.current.find(s => s.spot_id === result.spot_id);
    if (spot?.lat != null && spot.lng != null) {
      map.flyTo([spot.lat, spot.lng], 14, { animate: true, duration: 1.2 });
      const marker = markersRef.current.find(m => (m as any)._spot_id === spot.spot_id);
      if (marker) setTimeout(() => marker.openPopup(), 900);
      return;
    }
    if (_api.available) {
      const data = await apiGetSpot(result.spot_id);
      if (data?.status === "success" && data.data?.lat != null) {
        map.flyTo([data.data.lat, data.data.lng], 14, { animate: true, duration: 1.2 });
        return;
      }
    }
    const geo = _api.available ? await apiGeocode(result.location, result.spot_id) : await nominatimGeocode(result.location);
    if (geo) map.flyTo([geo.lat, geo.lng], 14, { animate: true, duration: 1.2 });
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@400;500&display=swap');

        *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }

        /* ── Match ProfileAdmin: lock html/body/root to viewport ── */
        html,body,#root { height:100%; overflow:hidden; }
        body { font-family:'DM Sans',sans-serif; background:#f8f9fc; }

        /* ── Layout shell ── */
        #wrapper { display:flex; height:100vh; overflow:hidden; }

        /* ── Sidebar: fixed, full height, never scrolls ── */
        #sidebar {
          width:225px; min-width:225px;
          background:linear-gradient(180deg,#4e73df 10%,#224abe 100%);
          display:flex; flex-direction:column;
          height:100vh; position:fixed; top:0; left:0;
          flex-shrink:0; z-index:100;
        }
        .sidebar-brand { display:flex; align-items:center; gap:10px; padding:1.25rem 1rem; color:#fff; text-decoration:none; }
        .sidebar-brand-icon { font-size:22px; transform:rotate(-15deg); display:inline-block; }
        hr.sidebar-divider { border:none; border-top:1px solid rgba(255,255,255,0.15); margin:0 1rem; }
        .sidebar-nav { list-style:none; padding:0; flex:1; }
        .sidebar-nav li a {
          display:flex; align-items:center; gap:10px; padding:12px 20px;
          color:rgba(255,255,255,0.75); font-size:13.5px; font-weight:500;
          text-decoration:none; transition:background .15s,color .15s;
        }
        .sidebar-nav li a:hover,.sidebar-nav li.active a { background:rgba(255,255,255,0.12); color:#fff; }
        .sidebar-nav li a i { width:18px; text-align:center; font-size:14px; }

        /* ── Content wrapper: offset sidebar, fills height, scrolls ── */
        #content-wrapper {
          margin-left:225px;
          flex:1;
          display:flex;
          flex-direction:column;
          height:100vh;
          overflow-y:auto;
          overflow-x:hidden;

          /* Blue scrollbar — same as ProfileAdmin */
          scrollbar-width:thin;
          scrollbar-color:#bfdbfe #f1f5f9;
        }

        /* Webkit blue scrollbar */
        #content-wrapper::-webkit-scrollbar { width:8px; }
        #content-wrapper::-webkit-scrollbar-track { background:#f1f5f9; }
        #content-wrapper::-webkit-scrollbar-thumb { background:#bfdbfe; border-radius:4px; }
        #content-wrapper::-webkit-scrollbar-thumb:hover { background:#93c5fd; }

        /* ── Topbar: sticky at top of content-wrapper ── */
        #topbar {
          height:65px; flex-shrink:0;
          background:#fff; box-shadow:0 2px 4px rgba(0,0,0,.08);
          display:flex; align-items:center; padding:0 1.5rem; gap:1rem;
          position:sticky; top:0; z-index:99;
        }
        .topbar-search-wrap { position:relative; display:flex; }
        .topbar-search-wrap input {
          border:1px solid #d1d3e2; border-right:none; border-radius:5px 0 0 5px;
          padding:7px 14px; font-size:13px; font-family:'DM Sans',sans-serif;
          background:#f8f9fc; color:#333; width:280px; outline:none;
        }
        .topbar-search-wrap button { background:#4e73df; border:none; border-radius:0 5px 5px 0; padding:7px 14px; color:#fff; cursor:pointer; }

        /* ── Search dropdown ── */
        .search-dropdown {
          position:absolute; top:100%; left:0; background:#fff;
          width:340px; z-index:1000; border:1px solid #ddd; border-radius:5px;
          max-height:300px; overflow-y:auto; box-shadow:0 4px 12px rgba(0,0,0,.1);
        }
        .search-item { display:flex; align-items:center; padding:10px; border-bottom:1px solid #eee; cursor:pointer; }
        .search-item:hover { background:#f5f5f5; }
        .search-item img { width:45px; height:45px; border-radius:5px; margin-right:10px; object-fit:cover; flex-shrink:0; }
        .search-item-no-img { width:45px; height:45px; border-radius:5px; margin-right:10px; background:#eff6ff; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .search-item-no-img i { color:#1a56db; font-size:18px; }
        .search-text { line-height:1.2; }
        .search-name { font-weight:bold; font-size:13px; color:#1e3a8a; }
        .search-location { font-size:12px; color:gray; }
        .search-no-result { padding:12px 16px; font-size:13px; color:#94a3b8; text-align:center; }

        /* ── Topbar right ── */
        .topbar-right { display:flex; align-items:center; gap:1rem; margin-left:auto; }
        .topbar-divider { border-left:1px solid #e3e6f0; height:36px; }
        .user-area { display:flex; align-items:center; gap:8px; cursor:pointer; position:relative; }
        .user-area span { font-size:13px; font-weight:600; color:#333; }
        .user-area img { width:32px; height:32px; border-radius:50%; object-fit:cover; }
        .user-dropdown {
          position:absolute; top:calc(100% + 10px); right:0; background:#fff;
          border:1px solid #e3e6f0; border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,.1);
          min-width:160px; z-index:200;
        }
        .user-dropdown a { display:flex; align-items:center; gap:8px; padding:10px 16px; font-size:13px; color:#555; text-decoration:none; }
        .user-dropdown a:hover { background:#f8f9fc; }

        /* ── Page content ── */
        #page-content { padding:1.5rem; flex:1; }
        .ta-card-section { background:#fff; border-radius:16px; border:1.5px solid #bfdbfe; box-shadow:0 2px 8px rgba(26,86,219,.07); overflow:hidden; }
        .ta-card-header { background:#fff; border-bottom:1.5px solid #bfdbfe; padding:1rem 1.25rem; display:flex; align-items:center; gap:10px; }
        .ta-section-title { font-family:'Playfair Display',serif; font-size:18px; color:#1a56db; margin:0; border-left:4px solid #1a56db; padding-left:12px; }
        .ta-card-body { padding:1.25rem; background:#fff; }
        .ta-badge { background:#eff6ff; border:1px solid #bfdbfe; color:#1a56db; border-radius:20px; padding:3px 12px; font-size:12px; font-weight:500; margin-left:auto; }

        /* ── Map ── */
        #map { height:600px; width:100%; border-radius:12px; border:1.5px solid #bfdbfe; overflow:hidden; }
        .map-loading-overlay { height:600px; width:100%; border-radius:12px; border:1.5px solid #bfdbfe; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; background:#f8faff; color:#6b8ab8; font-size:14px; }
        .map-loading-overlay i { font-size:28px; color:#bfdbfe; animation:spin 1.2s linear infinite; }
        @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }

        /* ── API status badge ── */
        .api-badge { position:fixed; bottom:14px; left:240px; z-index:999; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:600; display:flex; align-items:center; gap:5px; }
        .api-badge.live     { background:#dcfce7; color:#166534; border:1px solid #86efac; }
        .api-badge.offline  { background:#fef9c3; color:#854d0e; border:1px solid #fde047; }
        .api-badge.checking { background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1; }
      `}</style>

      {/* API status badge */}
      <div className={`api-badge ${apiStatus}`}>
        <i className="fas fa-circle" style={{ fontSize: 7 }} />
        {apiStatus === "live"     && "API connected"}
        {apiStatus === "offline"  && "API offline — Nominatim fallback"}
        {apiStatus === "checking" && "Connecting…"}
      </div>

      <div id="wrapper">
        <Sidebar onNavigate={handleNavigate} />

        {/* ── CONTENT WRAPPER (scrollable, blue scrollbar) ── */}
        <div id="content-wrapper">

          {/* ── Topbar ── */}
          <div id="topbar">
            <div className="topbar-search-wrap">
              <input
                type="text"
                placeholder="Search tourist spot..."
                value={searchQuery}
                onChange={e => handleSearchInput(e.target.value)}
                onBlur={() => setTimeout(() => setShowSearchDrop(false), 150)}
                autoComplete="off"
              />
              <button onClick={() => { if (searchQuery.trim()) handleSearchInput(searchQuery); }}>
                <i className="fas fa-search fa-sm" />
              </button>
              {showSearchDrop && (
                <div className="search-dropdown">
                  {searchResults.length === 0
                    ? <div className="search-no-result">No spots found.</div>
                    : searchResults.map(result => (
                        <div key={result.spot_id} className="search-item" onMouseDown={() => handlePickResult(result)}>
                          {result.image_url
                            ? <img src={result.image_url} alt={result.spot_name} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                            : <div className="search-item-no-img"><i className="fas fa-map-marker-alt" /></div>
                          }
                          <div className="search-text">
                            <div className="search-name">{result.spot_name}</div>
                            <div className="search-location">{result.location}</div>
                          </div>
                        </div>
                      ))
                  }
                </div>
              )}
            </div>

            <div className="topbar-right">
              <div className="topbar-divider" />
              <div className="user-area" onClick={() => setUserDropOpen(o => !o)}>
                <span><b>{username}</b></span>
                {profilePhoto
                  ? <img src={profilePhoto} alt="avatar" />
                  : (
                    <div style={{ width:32, height:32, borderRadius:"50%", background:"#eff6ff", border:"2px solid #bfdbfe", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <i className="fas fa-user" style={{ color:"#1a56db", fontSize:14 }} />
                    </div>
                  )
                }
                {userDropOpen && (
                  <div className="user-dropdown">
                    <a href="#" onClick={e => { e.preventDefault(); handleLogout(); }}>
                      <i className="fas fa-sign-out-alt fa-sm fa-fw" style={{ color:"#aaa" }} /> Logout
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Page Content ── */}
          <div id="page-content">
            <div className="ta-card-section">
              <div className="ta-card-header">
                <h6 className="ta-section-title">All Tourist Spots</h6>
                <span className="ta-badge">
                  <i className="fas fa-map-marker-alt" style={{ marginRight: 4 }} />
                  {spotsTotal} spots
                </span>
              </div>
              <div className="ta-card-body">
                {loadingSpots
                  ? (
                    <div className="map-loading-overlay">
                      <i className="fas fa-spinner" />
                      <span>Loading spots…</span>
                    </div>
                  )
                  : <div id="map" ref={mapRef} />
                }
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

// ─── Named exports ─────────────────────────────────────────────────────────────
export {
  apiGetSpots,
  apiGetSpot,
  apiGeocode,
  apiGeocodeBatch,
  apiSearch,
  apiGetProfile,
  apiGetCategories,
};