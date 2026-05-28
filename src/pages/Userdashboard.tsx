import { useState, useRef, useEffect, useCallback } from "react";
import { useHistory } from "react-router-dom";
import { CapacitorHttp } from "@capacitor/core";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CategoryInfo {
  value: string;
  label: string;
  badge_class: string;
}

interface TouristSpot {
  spot_id: number;
  spot_name: string;
  category: CategoryInfo | string;  // API returns object
  description: string;
  location: string;
  spot_image?: string;   // API returns spot_image, not image_url
  image_url?: string;
  badge_class?: string;
  is_archived?: boolean;
}

interface UserInfo {
  username: string;
  email?: string;
  profile_photo?: string;   // API returns full URL or null
}

// ─── API Base URL ─────────────────────────────────────────────────────────────
const API_BASE = "https://itservicesph.com/IT383/CORTEZ/Cortez/index.php/API_main";

// ─── API helpers ──────────────────────────────────────────────────────────────
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;

  // ✅ Use CapacitorHttp on mobile, regular fetch on browser
  if (Capacitor.isNativePlatform()) {
    let data: any = undefined;
    if (opts?.body) {
      try { data = JSON.parse(opts.body as string); } catch { data = opts.body; }
    }
    const response = await CapacitorHttp.request({
      url,
      method: opts?.method || "GET",
      headers: {
        "Accept": "application/json",
        ...(opts?.headers as Record<string, string> ?? {}),
      },
      data,
    });
    if (response.status >= 400) {
      throw new Error(response.data?.message ?? "Request failed");
    }
    return response.data as T;
  }

  // Browser — regular fetch
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Accept": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? res.statusText);
  }
  return res.json();
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  "all",
  "Beach",
  "Mountain",
  "Historical / Heritage",
  "Park / Nature",
  "Museum",
  "Festival / Event",
  "Other",
] as const;

type Category = (typeof CATEGORIES)[number];

const NAV_ITEMS = [
  { icon: "fa-tachometer-alt", label: "Dashboard", path: "/userdashboard" },
  { icon: "fa-heart",          label: "Favorites",  path: "/favorite"      },
  { icon: "fa-user",           label: "Profile",    path: "/profilepage"   },
  { icon: "fa-map",            label: "Map",        path: "/mappage"       },
];

const CATEGORY_LABEL_MAP: Record<string, string> = {
  "Beach":                 "Beach",
  "Mountain":              "Mountain",
  "Historical / Heritage": "Historical / Heritage",
  "Park / Nature":         "Park / Nature",
  "Museum":                "Museum",
  "Festival / Event":      "Festival / Event",
  "Other":                 "Other",
};

// Navigator constants
const DEFAULT_CENTER      = { lng: 123.8854, lat: 10.3157 };
const GEO_BIAS_LAT        = 10.32;
const GEO_BIAS_LNG        = 123.89;
const ARRIVAL_THRESHOLD_M = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getBadgeClass(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("beach"))                                 return "badge-beach";
  if (c.includes("mountain"))                              return "badge-mountain";
  if (c.includes("historical") || c.includes("heritage")) return "badge-historical";
  if (c.includes("park"))                                  return "badge-park";
  if (c.includes("museum"))                                return "badge-museum";
  if (c.includes("festival") || c.includes("event"))      return "badge-festival";
  return "badge-other";
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({
  activePath,
  onNavigate,
}: {
  activePath: string;
  onNavigate: (path: string) => void;
}) {
  return (
    <div
      style={{
        width: 225,
        minWidth: 225,
        background: "linear-gradient(180deg,#4e73df 10%,#224abe 100%)",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        left: 0,
        height: "100vh",
        zIndex: 100,
      }}
    >
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onNavigate("/userdashboard");
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "1.25rem 1rem",
          color: "#fff",
          textDecoration: "none",
        }}
      >
        <span
          style={{
            fontSize: 22,
            display: "inline-block",
            transform: "rotate(-15deg)",
          }}
        >
          <i className="fas fa-laugh-wink" />
        </span>
        <span style={{ fontSize: 17, fontWeight: 700 }}>
          <em>
            <b>TOUR_</b>
          </em>
          ISTA
        </span>
      </a>
      <hr
        style={{
          border: "none",
          borderTop: "1px solid rgba(255,255,255,0.15)",
          margin: "0 1rem",
        }}
      />
      <ul style={{ listStyle: "none", padding: 0, flex: 1 }}>
        {NAV_ITEMS.map(({ icon, label, path }) => {
          const isActive = activePath === path;
          return (
            <li key={label}>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(path);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 20px",
                  color: isActive ? "#fff" : "rgba(255,255,255,0.75)",
                  fontSize: 13.5,
                  fontWeight: 500,
                  textDecoration: "none",
                  background: isActive
                    ? "rgba(255,255,255,0.12)"
                    : "transparent",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                <i
                  className={`fas fa-fw ${icon}`}
                  style={{ width: 18, textAlign: "center", fontSize: 14 }}
                />
                <span>{label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Topbar ───────────────────────────────────────────────────────────────────
function Topbar({
  username,
  profilePhoto,
  onLogout,
  searchValue,
  onSearchChange,
  onSearchSubmit,
}: {
  username: string;
  profilePhoto?: string;
  onLogout: () => void;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onSearchSubmit: () => void;
}) {
  const [dropOpen, setDropOpen] = useState(false);

  return (
    <nav
      style={{
        height: 65,
        flexShrink: 0,
        background: "#fff",
        boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
        display: "flex",
        alignItems: "center",
        padding: "0 1.5rem",
        gap: "1rem",
        position: "sticky",
        top: 0,
        zIndex: 99,
      }}
    >
      <div style={{ display: "flex" }}>
        <input
          type="text"
          placeholder="Search tourist spot..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearchSubmit();
            if (e.key === "Escape") onSearchChange("");
          }}
          style={{
            border: "1px solid #d1d3e2",
            borderRight: "none",
            borderRadius: "5px 0 0 5px",
            padding: "7px 14px",
            fontSize: 13,
            fontFamily: "'DM Sans', sans-serif",
            background: "#f8f9fc",
            color: "#333",
            width: 280,
            outline: "none",
          }}
        />
        <button
          onClick={onSearchSubmit}
          style={{
            background: "#4e73df",
            border: "none",
            borderRadius: "0 5px 5px 0",
            padding: "7px 14px",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          <i className="fas fa-search fa-sm" />
        </button>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          marginLeft: "auto",
        }}
      >
        <div style={{ borderLeft: "1px solid #e3e6f0", height: 36 }} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            position: "relative",
          }}
          onClick={() => setDropOpen((o) => !o)}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: "#6e707e" }}>
            <b>{username}</b>
          </span>
          {profilePhoto ? (
            <img
              src={profilePhoto}
              alt="avatar"
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#eff6ff",
                border: "2px solid #bfdbfe",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i
                className="fas fa-user"
                style={{ color: "#1a56db", fontSize: 14 }}
              />
            </div>
          )}
          {dropOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                right: 0,
                background: "#fff",
                border: "1px solid #e3e6f0",
                borderRadius: 8,
                boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                minWidth: 160,
                zIndex: 200,
              }}
            >
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onLogout();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 16px",
                  fontSize: 13,
                  color: "#555",
                  textDecoration: "none",
                }}
              >
                <i
                  className="fas fa-sign-out-alt fa-sm fa-fw"
                  style={{ color: "#aaa" }}
                />
                &nbsp;Logout
              </a>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

// ─── Fav Toast ────────────────────────────────────────────────────────────────
function FavToast({
  visible,
  spotName,
  state,
  onClose,
}: {
  visible: boolean;
  spotName: string;
  state: "added" | "exists";
  onClose: () => void;
}) {
  const isExists = state === "exists";
  return (
    <div
      style={{
        position: "fixed",
        bottom: 30,
        right: 30,
        zIndex: 9999,
        minWidth: 300,
        background: "#fff",
        border: "1.5px solid #bfdbfe",
        borderRadius: 14,
        boxShadow: "0 8px 32px rgba(26,86,219,0.16)",
        padding: "14px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: "'DM Sans', sans-serif",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.3s ease, transform 0.3s ease",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: isExists ? "#fefce8" : "#eff6ff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <i
          className={isExists ? "fas fa-exclamation-circle" : "fas fa-heart"}
          style={{ color: isExists ? "#ca8a04" : "#1a56db", fontSize: 17 }}
        />
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 14,
            color: "#1e3a8a",
            marginBottom: 2,
          }}
        >
          {isExists ? "Already in your favorites." : "Added to Favorites!"}
        </div>
        <div style={{ fontSize: 12, color: "#6b8ab8" }}>
          {isExists
            ? `${spotName} is already saved.`
            : `${spotName} has been added to your favorites.`}
        </div>
      </div>
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          color: "#6b8ab8",
          fontSize: 16,
          cursor: "pointer",
          padding: 0,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

// ─── Description Modal ────────────────────────────────────────────────────────
function DescModal({
  spot,
  onClose,
}: {
  spot: TouristSpot | null;
  onClose: () => void;
}) {
  if (!spot) return null;
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 1040,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          zIndex: 1050,
          width: "min(92vw,500px)",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1.5px solid #bfdbfe",
            boxShadow: "0 8px 32px rgba(26,86,219,0.12)",
            fontFamily: "'DM Sans', sans-serif",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1rem 1.25rem",
              borderBottom: "1.5px solid #bfdbfe",
            }}
          >
            <h5
              style={{
                margin: 0,
                fontFamily: "'Playfair Display', serif",
                color: "#1a56db",
                fontSize: 20,
              }}
            >
              {spot.spot_name}
            </h5>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                fontSize: 20,
                color: "#6b8ab8",
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
          <div style={{ padding: "1.25rem" }}>
            {spot.image_url && (
              <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                <img
                  src={spot.image_url}
                  alt={spot.spot_name}
                  style={{
                    maxWidth: "70%",
                    borderRadius: 12,
                    display: "block",
                    margin: "0 auto",
                  }}
                />
              </div>
            )}
            <p
              style={{
                color: "#475569",
                fontSize: 14,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {spot.description}
            </p>
          </div>
          <div
            style={{
              padding: "0.75rem 1.25rem",
              borderTop: "1.5px solid #bfdbfe",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              onClick={onClose}
              style={{
                background: "#6b7280",
                border: "none",
                color: "#fff",
                borderRadius: 8,
                padding: "8px 18px",
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Navigator Modal ──────────────────────────────────────────────────────────
function NavModal({
  spot,
  onClose,
}: {
  spot: TouristSpot | null;
  onClose: () => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<any>(null);
  const mapReadyRef     = useRef(false);
  const stateRef        = useRef<any>({
    mode: "street",
    gpsReady: false,
    gpsRequested: false,
    userLocation: null,
    prevLocation: null,
    heading: 0,
    watchId: null,
    selectedDest: null,
    currentRoute: null,
    routeCoords: [],
    currentStep: 0,
    isNavigating: false,
    isSimulating: false,
    mapMoved: false,
    arrivedFired: false,
    userMarker: null,
    destMarker: null,
    startMarker: null,
    simInterval: null,
    simIndex: 0,
  });

  const [gpsChip, setGpsChip] = useState<{
    state: "acquiring" | "got" | "denied";
    text: string;
  }>({ state: "acquiring", text: "Getting your location…" });
  const [searchVal, setSearchVal]           = useState("");
  const [searchResults, setSearchRes]       = useState<any[]>([]);
  const [showDropdown, setShowDropdown]     = useState(false);
  const [startLabel, setStartLabel]         = useState("Select a destination first");
  const [startDisabled, setStartDisabled]   = useState(true);
  const [idleSub, setIdleSub]               = useState("Navigate to the selected tourist spot");
  const [isNavigating, setIsNavigating]     = useState(false);
  const [hudKm, setHudKm]                   = useState("0");
  const [hudDist, setHudDist]               = useState("-");
  const [hudRoad, setHudRoad]               = useState("-");
  const [hudInstr, setHudInstr]             = useState("-");
  const [hudDir, setHudDir]                 = useState("straight");
  const [destLabel, setDestLabel]           = useState("-");
  const [engineBadge, setEngineBadge]       = useState("via OSRM");
  const [isSimulating, setIsSimulating]     = useState(false);
  const [isSatellite, setIsSatellite]       = useState(false);
  const [mapMoved, setMapMoved]             = useState(false);
  const [isBannerArriving, setIsBannerArriving] = useState(false);
  const searchTimerRef = useRef<any>(null);
  const S = stateRef.current;

  const DIR_ICONS: Record<string, string> = {
    arrive:         "fa-solid fa-flag-checkered",
    depart:         "fa-solid fa-circle-play",
    roundabout:     "fa-solid fa-rotate-right",
    "sharp right":  "fa-solid fa-turn-right",
    right:          "fa-solid fa-arrow-right",
    "slight right": "fa-solid fa-arrow-up-right",
    "sharp left":   "fa-solid fa-turn-left",
    left:           "fa-solid fa-arrow-left",
    "slight left":  "fa-solid fa-arrow-up-left",
    uturn:          "fa-solid fa-arrow-rotate-left",
    straight:       "fa-solid fa-arrow-up",
    default:        "fa-solid fa-arrow-up",
  };
  const DIR_SHORT: Record<string, string> = {
    arrive:         "Arrive",
    depart:         "Start",
    roundabout:     "Round<br>about",
    "sharp right":  "Sharp<br>Right",
    right:          "Right",
    "slight right": "Slight<br>Right",
    "sharp left":   "Sharp<br>Left",
    left:           "Left",
    "slight left":  "Slight<br>Left",
    uturn:          "U-Turn",
    straight:       "Straight",
    default:        "Straight",
  };
  const DIR_LABELS: Record<string, string> = {
    arrive:         "You have arrived",
    depart:         "Head out",
    roundabout:     "Enter the roundabout",
    "sharp right":  "Sharp right turn",
    right:          "Turn right",
    "slight right": "Keep slight right",
    "sharp left":   "Sharp left turn",
    left:           "Turn left",
    "slight left":  "Keep slight left",
    uturn:          "Make a U-turn",
    straight:       "Continue straight",
    default:        "Continue straight",
  };

  function bearingDiffToDir(delta: number): string {
    let d = ((delta % 360) + 360) % 360;
    if (d > 180) d -= 360;
    if (d >= -15 && d <= 15)  return "straight";
    if (d > 15  && d <= 45)   return "slight right";
    if (d > 45  && d <= 120)  return "right";
    if (d > 120)              return "sharp right";
    if (d < -15 && d >= -45)  return "slight left";
    if (d < -45 && d >= -120) return "left";
    return "sharp left";
  }

  function setupRouteLayers(map: any) {
    if (!map.isStyleLoaded()) return;
    if (!map.getSource("route")) {
      map.addSource("route", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }
    [
      { id: "route-glow",   paint: { "line-color": "#60a5fa", "line-width": 18, "line-opacity": 0.15 } },
      { id: "route-casing", paint: { "line-color": "#1d4ed8", "line-width": 8,  "line-opacity": 1    } },
      { id: "route-fill",   paint: { "line-color": "#38bdf8", "line-width": 4,  "line-opacity": 1    } },
    ].forEach((def) => {
      if (!map.getLayer(def.id)) {
        map.addLayer({
          id: def.id,
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: def.paint,
        });
      }
    });
  }

  function drawRoute(geometry: any) {
    const src = mapRef.current?.getSource("route");
    if (src)
      src.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry }],
      });
  }

  function getStep(idx: number) {
    if (!S.currentRoute) return null;
    let c = 0;
    for (const leg of S.currentRoute.legs)
      for (const step of leg.steps) if (c++ === idx) return step;
    return null;
  }

  function resolveDir(
    step: any,
    prevB: number | null,
    currB: number | null
  ): string {
    const type = (step.maneuver.type || "").toLowerCase();
    const mod  = (step.maneuver.modifier || "").toLowerCase();
    if (type === "arrive")     return "arrive";
    if (type === "depart")     return "depart";
    if (type === "roundabout") return "roundabout";
    if (mod.includes("uturn")) return "uturn";
    if (prevB !== null && currB !== null) return bearingDiffToDir(currB - prevB);
    if (mod.includes("sharp right"))  return "sharp right";
    if (mod.includes("slight right")) return "slight right";
    if (mod.includes("right"))        return "right";
    if (mod.includes("sharp left"))   return "sharp left";
    if (mod.includes("slight left"))  return "slight left";
    if (mod.includes("left"))         return "left";
    return "straight";
  }

  function stepBearing(idx: number): number | null {
    if (!S.currentRoute) return null;
    let c = 0, acc = 0;
    for (const leg of S.currentRoute.legs) {
      for (const step of leg.steps) {
        if (c === idx) {
          try {
            const turf = (window as any).turf;
            if (!turf) return null;
            const line = turf.lineString(S.routeCoords);
            const p1   = turf.along(line, acc / 1000,                                       { units: "kilometers" });
            const p2   = turf.along(line, (acc + Math.min(step.distance, 50)) / 1000, { units: "kilometers" });
            return turf.bearing(p1, p2);
          } catch { return null; }
        }
        acc += step.distance || 0;
        c++;
      }
    }
    return null;
  }

  function updateTurnHUD() {
    const step = getStep(S.currentStep);
    if (!step) return;
    const pB  = stepBearing(Math.max(0, S.currentStep - 1));
    const cB  = stepBearing(S.currentStep);
    const dir = resolveDir(step, pB, cB);
    setHudDist(step.distance < 1000 ? Math.round(step.distance) + " m" : (step.distance / 1000).toFixed(1) + " km");
    setHudRoad(step.name || "Unnamed road");
    setHudInstr(step.maneuver.instruction?.trim() || DIR_LABELS[dir] || DIR_LABELS.default);
    setHudDir(dir);
    setIsBannerArriving(dir === "arrive");
  }

  function placeUserMarker(lng: number, lat: number, heading: number) {
    const map = mapRef.current;
    if (!map) return;
    const win = window as any;
    if (S.userMarker) {
      S.userMarker.setLngLat([lng, lat]);
      S.userMarker.setRotation(heading || 0);
    } else {
      const el = document.createElement("div");
      el.className = "nav-user-marker";
      el.innerHTML = `<div class="nav-user-pulse"></div><div class="nav-user-icon"><i class="fa-solid fa-car-side"></i></div><div class="nav-user-chevron"><i class="fa-solid fa-chevron-up"></i></div>`;
      S.userMarker = new win.maplibregl.Marker({
        element: el,
        anchor: "center",
        rotationAlignment: "map",
        pitchAlignment: "viewport",
      })
        .setLngLat([lng, lat])
        .addTo(map);
      S.userMarker.setRotation(heading || 0);
    }
  }

  function placeDestMarker(lng: number, lat: number) {
    const map = mapRef.current;
    if (!map) return;
    const win = window as any;
    if (S.destMarker) { S.destMarker.remove(); S.destMarker = null; }
    const el = document.createElement("div");
    el.className = "nav-dest-marker";
    el.innerHTML = `<div class="nav-dest-pin"><i class="fa-solid fa-location-dot"></i></div><div class="nav-dest-stem"></div>`;
    S.destMarker = new win.maplibregl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([lng, lat])
      .addTo(map);
  }

  function placeStartMarker(lng: number, lat: number) {
    const map = mapRef.current;
    if (!map) return;
    const win = window as any;
    if (S.startMarker) { S.startMarker.remove(); S.startMarker = null; }
    const el = document.createElement("div");
    el.className = "nav-start-marker";
    el.innerHTML = `<div class="nav-start-pin"><i class="fa-solid fa-circle-play"></i></div><div class="nav-start-stem"></div>`;
    S.startMarker = new win.maplibregl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([lng, lat])
      .addTo(map);
  }

  async function geocodeAddress(address: string, name: string) {
    setStartLabel("Resolving destination…");
    setStartDisabled(true);

    // Use the server-side geocode proxy if available, fall back to Nominatim directly
    try {
      const res = await apiFetch<{
        status: string;
        lat?: number;
        lng?: number;
        display_name?: string;
        message?: string;
      }>(`/geocode?address=${encodeURIComponent(address)}&name=${encodeURIComponent(name)}`);

      if (res.status === "success" && res.lat && res.lng) {
        S.selectedDest = { lat: res.lat, lng: res.lng, name };
        placeDestMarker(res.lng, res.lat);
        mapRef.current?.flyTo({ center: [res.lng, res.lat], zoom: 14, pitch: 45, speed: 1.2 });
        setStartLabel("Navigate to " + name);
        setStartDisabled(false);
        return;
      }
    } catch {
      // fall through to direct Nominatim
    }

    // Direct Nominatim fallback (mirrors original JS logic)
    const queries = [
      `${name}, ${address}, Philippines`,
      `${address}, Philippines`,
      `${name}, Cebu, Philippines`,
      `${name}, Philippines`,
    ];
    let best: any = null;
    for (const q of queries) {
      try {
        const r       = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=ph`,
          { headers: { "Accept-Language": "en" } }
        );
        const results = await r.json();
        if (!results?.length) continue;
        results.sort((a: any, b: any) => {
          const dA = Math.abs(parseFloat(a.lat) - GEO_BIAS_LAT) + Math.abs(parseFloat(a.lon) - GEO_BIAS_LNG);
          const dB = Math.abs(parseFloat(b.lat) - GEO_BIAS_LAT) + Math.abs(parseFloat(b.lon) - GEO_BIAS_LNG);
          return dA - dB;
        });
        best = results[0];
        break;
      } catch { continue; }
    }

    if (!best) {
      setStartLabel("Location not found — search manually");
      setStartDisabled(false);
      return;
    }
    const lat = parseFloat(best.lat);
    const lng = parseFloat(best.lon);
    S.selectedDest = { lat, lng, name };
    placeDestMarker(lng, lat);
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 14, pitch: 45, speed: 1.2 });
    setStartLabel("Navigate to " + name);
    setStartDisabled(false);
  }

  function processRoute(route: any, engine: string) {
    S.currentRoute = route;
    S.routeCoords  = route.geometry.coordinates;
    drawRoute(route.geometry);
    setHudKm((route.distance / 1000).toFixed(1));
    S.currentStep = 0;
    updateTurnHUD();
    fitRoute(route.geometry);
    setEngineBadge(engine);
  }

  function fitRoute(geometry: any) {
    try {
      const turf = (window as any).turf;
      const bbox = turf.bbox(geometry);
      mapRef.current?.fitBounds(
        [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
        { padding: { top: 170, bottom: 90, left: 30, right: 30 }, duration: 900, maxZoom: 16 }
      );
    } catch {}
  }

  async function fetchRoute(sLng: number, sLat: number, eLng: number, eLat: number) {
    setEngineBadge("Routing…");
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${sLng},${sLat};${eLng},${eLat}?steps=true&geometries=geojson&overview=full&radiuses=unlimited;unlimited`;
      const d   = await fetch(url).then((r) => r.json());
      if (d.routes?.length) { processRoute(d.routes[0], "via OSRM"); return; }
    } catch {}
    try {
      const url = `https://graphhopper.com/api/1/route?point=${sLat},${sLng}&point=${eLat},${eLng}&vehicle=car&locale=en&instructions=true&calc_points=true&points_encoded=false&key=LijBPDQGfu7Iiq80ebFCtWMuznIlApHx`;
      const d   = await fetch(url).then((r) => r.json());
      if (d.paths?.length) {
        const path  = d.paths[0];
        const steps = (path.instructions || []).map((i: any) => ({
          distance: i.distance,
          name: i.street_name || "",
          maneuver: {
            type:        i.sign === 4 ? "arrive" : i.sign === -7 ? "depart" : "turn",
            modifier:    ghSign(i.sign),
            instruction: i.text || "",
          },
        }));
        processRoute(
          { geometry: path.points, distance: path.distance, duration: path.time / 1000, legs: [{ steps }] },
          "via GraphHopper"
        );
        return;
      }
    } catch {}
    // Straight-line fallback
    const turf  = (window as any).turf;
    const distM = turf.distance(turf.point([sLng, sLat]), turf.point([eLng, eLat]), { units: "meters" });
    const geometry = { type: "LineString", coordinates: [[sLng, sLat], [eLng, eLat]] };
    processRoute(
      {
        geometry,
        distance: distM,
        duration: distM / 8,
        legs: [{
          steps: [
            { distance: distM * 0.95, name: "Head toward destination", maneuver: { type: "depart", modifier: "straight", instruction: "Head toward your destination" } },
            { distance: 0, name: S.selectedDest?.name || "Destination",  maneuver: { type: "arrive", modifier: "",         instruction: "You have arrived"            } },
          ],
        }],
      },
      "Direct line"
    );
  }

  function ghSign(sign: number): string {
    const map: Record<string, string> = {
      "-3": "sharp left", "-2": "left", "-1": "slight left",
      "0": "straight", "1": "slight right", "2": "right",
      "3": "sharp right", "4": "arrive", "-7": "depart", "6": "uturn",
    };
    return map[String(sign)] || "straight";
  }

  function onGPSUpdate(pos: any) {
    const { latitude, longitude } = pos.coords;
    const rawH = pos.coords.heading;
    let bearing = S.heading;
    if (S.prevLocation) {
      try {
        const turf = (window as any).turf;
        const d    = turf.distance(
          turf.point([S.prevLocation.lng, S.prevLocation.lat]),
          turf.point([longitude, latitude]),
          { units: "meters" }
        );
        if (d > 2)
          bearing = turf.bearing(
            turf.point([S.prevLocation.lng, S.prevLocation.lat]),
            turf.point([longitude, latitude])
          );
      } catch {}
    }
    const finalH   = rawH !== null && rawH >= 0 ? rawH : bearing;
    S.prevLocation = { lat: S.userLocation?.lat ?? latitude, lng: S.userLocation?.lng ?? longitude };
    S.userLocation = { lat: latitude, lng: longitude };
    S.heading      = finalH;
    if (!S.mapMoved) {
      mapRef.current?.setCenter([longitude, latitude]);
      mapRef.current?.setBearing(finalH);
    }
    placeUserMarker(longitude, latitude, finalH);
    updateProgress(latitude, longitude);
    checkArrival(latitude, longitude);
  }

  function updateProgress(lat: number, lng: number) {
    if (!S.currentRoute || !S.routeCoords.length) return;
    try {
      const turf   = (window as any).turf;
      const walked = turf.nearestPointOnLine(turf.lineString(S.routeCoords), [lng, lat]).properties.location;
      let dist = 0, idx = 0;
      for (const leg of S.currentRoute.legs) {
        for (const step of leg.steps) {
          dist += step.distance / 1000;
          if (dist >= walked) {
            if (idx !== S.currentStep) { S.currentStep = idx; updateTurnHUD(); }
            return;
          }
          idx++;
        }
      }
    } catch {}
  }

  function checkArrival(lat: number, lng: number) {
    if (!S.selectedDest || S.arrivedFired) return;
    try {
      const turf = (window as any).turf;
      const d    = turf.distance(
        turf.point([lng, lat]),
        turf.point([S.selectedDest.lng, S.selectedDest.lat]),
        { units: "meters" }
      );
      if (d <= ARRIVAL_THRESHOLD_M) {
        S.arrivedFired = true;
        alert("You have reached your destination!");
      }
    } catch {}
  }

  async function requestGPS() {
    S.gpsRequested = true;
    setGpsChip({ state: "acquiring", text: "Getting your location…" });

    try {
      const perm = await Geolocation.requestPermissions();
      if (perm.location !== "granted") throw new Error("denied");

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      S.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      S.gpsReady = true;
      setGpsChip({ state: "got", text: "Location acquired" });
      mapRef.current?.flyTo({
        center: [S.userLocation.lng, S.userLocation.lat],
        zoom: 14, pitch: 45, speed: 1.2,
      });
    } catch {
      S.userLocation = { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng };
      setGpsChip({ state: "denied", text: "Location denied — using default area" });
    }
  }

  function beginNavigation() {
    if (!S.selectedDest) return;
    S.isNavigating = true;
    S.currentStep  = 0;
    S.mapMoved     = false;
    S.prevLocation = null;
    S.arrivedFired = false;
    setIsNavigating(true);
    setDestLabel(S.selectedDest.name);
    const origin = S.userLocation || DEFAULT_CENTER;
    placeUserMarker(origin.lng, origin.lat, 0);
    placeStartMarker(origin.lng, origin.lat);
    Geolocation.watchPosition(
      { enableHighAccuracy: true },
      (pos, err) => {
        if (err || !pos) return;
        if (!S.isSimulating) onGPSUpdate(pos);
      }
    ).then((id) => { S.watchId = id; });
    mapRef.current?.flyTo({ center: [origin.lng, origin.lat], zoom: 16, pitch: 45, bearing: S.heading || 0, speed: 1.3 });
    fetchRoute(origin.lng, origin.lat, S.selectedDest.lng, S.selectedDest.lat);
  }

  function stopSim() {
    if (S.simInterval) { clearInterval(S.simInterval); S.simInterval = null; }
    S.isSimulating = false;
    setIsSimulating(false);
  }

  function startSim() {
    if (!S.routeCoords.length) return;
    S.isSimulating = true;
    S.simIndex     = 0;
    S.mapMoved     = false;
    S.arrivedFired = false;
    setIsSimulating(true);
    setMapMoved(false);
    S.simInterval = setInterval(() => {
      if (S.simIndex >= S.routeCoords.length) {
        stopSim();
        if (!S.arrivedFired) { S.arrivedFired = true; alert("You have reached your destination!"); }
        return;
      }
      const turf = (window as any).turf;
      const c    = S.routeCoords[S.simIndex];
      const n    = S.routeCoords[Math.min(S.simIndex + 1, S.routeCoords.length - 1)];
      let b = 0;
      try { if (S.simIndex < S.routeCoords.length - 1) b = turf.bearing(turf.point(c), turf.point(n)); } catch {}
      onGPSUpdate({ coords: { longitude: c[0], latitude: c[1], heading: b, speed: 10, accuracy: 5 } });
      mapRef.current?.setCenter([c[0], c[1]]);
      mapRef.current?.setBearing(b);
      S.simIndex++;
    }, 100);
  }

  function navEnd() {
    stopSim();
    S.isNavigating = false;
    if (S.watchId !== null) { Geolocation.clearWatch({ id: S.watchId }); S.watchId = null; }
    [S.userMarker, S.destMarker, S.startMarker].forEach((m: any) => { if (m) m.remove(); });
    S.userMarker = S.destMarker = S.startMarker = null;
    const src = mapRef.current?.getSource("route");
    if (src) src.setData({ type: "FeatureCollection", features: [] });
    S.currentRoute = null; S.routeCoords = []; S.selectedDest = null;
    S.currentStep  = 0;   S.mapMoved    = false; S.prevLocation = null; S.arrivedFired = false;
    setIsNavigating(false);
    setMapMoved(false);
    setSearchVal("");
    setStartDisabled(true);
    setStartLabel("Select a destination first");
    setIdleSub("Navigate to the selected tourist spot");
    setGpsChip(S.gpsReady
      ? { state: "got",    text: "Location acquired"    }
      : { state: "denied", text: "Location unavailable" }
    );
    const center = S.userLocation || DEFAULT_CENTER;
    mapRef.current?.setMaxZoom(19);
    mapRef.current?.flyTo({ center: [center.lng, center.lat], zoom: 13, pitch: 45, bearing: 0, speed: 1.2 });
  }

  function toggleSatellite() {
    const map = mapRef.current;
    if (!map) return;
    if (!isSatellite) {
      map.setStyle({
        version: 8,
        sources: { sat: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256 } },
        layers:  [{ id: "sat-layer", type: "raster", source: "sat" }],
      });
      map.setMaxZoom(17);
      setIsSatellite(true);
    } else {
      map.setStyle("https://tiles.openfreemap.org/styles/liberty");
      map.setMaxZoom(19);
      setIsSatellite(false);
    }
  }

  function recenter() {
    if (!S.userLocation) return;
    S.mapMoved = false;
    setMapMoved(false);
    mapRef.current?.flyTo({ center: [S.userLocation.lng, S.userLocation.lat], zoom: 16, pitch: 45, bearing: S.heading || 0, speed: 1.4 });
  }

  // ── Init map when modal opens ──
  useEffect(() => {
    if (!spot) return;
    const win = window as any;

    const initMap = () => {
      if (mapRef.current || !mapContainerRef.current) return;
      const map = new win.maplibregl.Map({
        container: mapContainerRef.current,
        style:     "https://tiles.openfreemap.org/styles/liberty",
        center:    [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat],
        zoom: 13, maxZoom: 19, pitch: 45, bearing: 0,
      });
      map.scrollZoom.setWheelZoomRate(1 / 200);
      map.addControl(new win.maplibregl.NavigationControl({ showCompass: true }), "top-right");
      map.on("load", () => {
        setupRouteLayers(map);
        mapReadyRef.current = true;
        if (!S.gpsRequested) requestGPS();
        if (spot) {
          setIdleSub("Navigating to: " + spot.spot_name);
          setSearchVal(spot.spot_name + " — " + spot.location);
          setStartLabel("Resolving destination…");
          geocodeAddress(spot.location, spot.spot_name);
        }
      });
      map.on("styledata", () => {
        setupRouteLayers(map);
        if (S.currentRoute) drawRoute(S.currentRoute.geometry);
      });
      map.on("dragstart", () => {
        if (S.isNavigating && !S.isSimulating) { S.mapMoved = true; setMapMoved(true); }
      });
      mapRef.current = map;
    };

    if (win.maplibregl) {
      setTimeout(initMap, 80);
    } else {
      const link  = document.createElement("link");
      link.rel    = "stylesheet";
      link.href   = "https://unpkg.com/maplibre-gl/dist/maplibre-gl.css";
      document.head.appendChild(link);
      const script   = document.createElement("script");
      script.src     = "https://unpkg.com/maplibre-gl/dist/maplibre-gl.js";
      script.onload  = () => setTimeout(initMap, 80);
      document.head.appendChild(script);
    }
  }, [spot]);

  // ── Update destination when spot changes ──
  useEffect(() => {
    if (!spot || !mapReadyRef.current) return;
    setIdleSub("Navigating to: " + spot.spot_name);
    setSearchVal(spot.spot_name + " — " + spot.location);
    setStartLabel("Resolving destination…");
    setStartDisabled(true);
    if (S.destMarker) { S.destMarker.remove(); S.destMarker = null; }
    S.selectedDest = null;
    geocodeAddress(spot.location, spot.spot_name);
  }, [spot?.spot_id]);

  useEffect(() => {
    if (spot && mapRef.current) setTimeout(() => mapRef.current?.resize(), 80);
  }, [spot]);

  useEffect(() => {
    if (!spot && S.isNavigating) navEnd();
  }, [spot]);

  if (!spot) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1040 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 1050, width: "min(96vw,860px)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #bfdbfe", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", borderBottom: "1.5px solid #bfdbfe", background: "#fff" }}>
            <h5 style={{ margin: 0, fontFamily: "'Playfair Display', serif", color: "#1a56db", fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}>
              <i className="fa-solid fa-location-arrow" style={{ color: "#6366f1", fontSize: 14 }} />
              Navigate to Spot
            </h5>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "#6b8ab8", cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>

          {/* Map + HUD */}
          <div style={{ position: "relative", width: "100%", height: 520, overflow: "hidden" }}>
            <div ref={mapContainerRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 }} />

            {/* HUD */}
            {isNavigating && (
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 50 }}>
                <div style={{ background: isBannerArriving ? "#f0fdf4" : "#fff", color: "#0f172a", display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", boxShadow: "0 2px 16px rgba(0,0,0,0.1)", borderBottom: `3px solid ${isBannerArriving ? "#22c55e" : "#6366f1"}` }}>
                  <div style={{ width: 48, height: 48, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isBannerArriving ? "#22c55e" : "#6366f1", borderRadius: 14 }}>
                    <i className={DIR_ICONS[hudDir] || DIR_ICONS.default} style={{ fontSize: 22, color: "#fff" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: "#0f172a", letterSpacing: -0.5 }}>{hudDist}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hudRoad}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>{hudInstr}</div>
                  </div>
                  <div style={{ width: 64, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: isBannerArriving ? "#dcfce7" : "#f1f5f9", borderRadius: 14, border: `2px solid ${isBannerArriving ? "#86efac" : "#e2e8f0"}`, padding: "10px 6px" }}>
                    <i className={DIR_ICONS[hudDir] || DIR_ICONS.default} style={{ fontSize: 24, color: isBannerArriving ? "#16a34a" : "#6366f1" }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: isBannerArriving ? "#16a34a" : "#6366f1", textAlign: "center", lineHeight: 1.2, letterSpacing: "0.02em", textTransform: "uppercase" }} dangerouslySetInnerHTML={{ __html: DIR_SHORT[hudDir] || DIR_SHORT.default }} />
                  </div>
                </div>
                <div style={{ background: "#f8fafc", borderBottom: "1px solid #e5e7eb", padding: "10px 18px", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{destLabel}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "#6366f1" }}>
                    <i className="fa-solid fa-road" /> {hudKm} km
                  </div>
                </div>
                <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "12px 18px", display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button onClick={() => (isSimulating ? stopSim() : startSim())} style={{ padding: "10px 18px", borderRadius: 12, border: `1.5px solid ${isSimulating ? "#6366f1" : "#e2e8f0"}`, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, background: isSimulating ? "#6366f1" : "#f8fafc", color: isSimulating ? "#fff" : "#1e293b" }}>
                    <i className={`fa-solid ${isSimulating ? "fa-stop" : "fa-play"}`} style={{ color: isSimulating ? "#fff" : "#6366f1", fontSize: 13 }} />
                    {isSimulating ? "Stop" : "Simulate"}
                  </button>
                  <button onClick={toggleSatellite} style={{ padding: "10px 18px", borderRadius: 12, border: `1.5px solid ${isSatellite ? "#6366f1" : "#e2e8f0"}`, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, background: isSatellite ? "#6366f1" : "#f8fafc", color: isSatellite ? "#fff" : "#1e293b" }}>
                    <i className={`fa-solid ${isSatellite ? "fa-satellite" : "fa-map"}`} style={{ color: isSatellite ? "#fff" : "#6366f1", fontSize: 13 }} />
                    {isSatellite ? "Satellite" : "Street"}
                  </button>
                  <button onClick={navEnd} style={{ padding: "10px 18px", borderRadius: 12, border: "1.5px solid #fecaca", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, background: "#fff5f5", color: "#dc2626" }}>
                    <i className="fa-solid fa-xmark" style={{ color: "#dc2626", fontSize: 13 }} /> End
                  </button>
                </div>
              </div>
            )}

            {isNavigating && mapMoved && (
              <button onClick={recenter} style={{ position: "absolute", bottom: 24, right: 14, width: 44, height: 44, background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: "50%", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, color: "#6366f1", zIndex: 55 }}>
                <i className="fa-solid fa-location-crosshairs" />
              </button>
            )}

            {isNavigating && (
              <div style={{ position: "absolute", bottom: 24, left: 14, zIndex: 55, background: "rgba(255,255,255,0.95)", border: "1px solid #e5e7eb", borderRadius: 20, padding: "5px 12px", fontSize: 10, fontWeight: 600, color: "#6b7280", letterSpacing: "0.03em", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
                {engineBadge}
              </div>
            )}

            {/* Idle Overlay */}
            {!isNavigating && (
              <div style={{ position: "absolute", inset: 0, zIndex: 80, background: "rgba(15,23,42,0.3)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(3px)" }}>
                <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 440, padding: "24px 20px 20px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                    <i className="fa-solid fa-location-arrow" style={{ color: "#6366f1", fontSize: 15 }} /> Navigator
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: -4 }}>{idleSub}</div>

                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, width: "fit-content", background: gpsChip.state === "acquiring" ? "#fef9c3" : gpsChip.state === "got" ? "#dcfce7" : "#fee2e2", color: gpsChip.state === "acquiring" ? "#854d0e" : gpsChip.state === "got" ? "#166534" : "#991b1b", border: `1px solid ${gpsChip.state === "acquiring" ? "#fde047" : gpsChip.state === "got" ? "#86efac" : "#fca5a5"}` }}>
                    <i className={`fa-solid ${gpsChip.state === "acquiring" ? "fa-spinner fa-spin" : gpsChip.state === "got" ? "fa-check" : "fa-triangle-exclamation"}`} />
                    {gpsChip.text}
                  </div>

                  <div style={{ position: "relative" }}>
                    <i className="fa-solid fa-magnifying-glass" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 13, pointerEvents: "none" }} />
                    <input
                      type="text"
                      value={searchVal}
                      onChange={(e) => {
                        setSearchVal(e.target.value);
                        clearTimeout(searchTimerRef.current);
                        const q = e.target.value.trim();
                        if (q.length < 3) { setShowDropdown(false); return; }
                        searchTimerRef.current = setTimeout(async () => {
                          try {
                            const r       = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q + " Philippines")}&limit=5&countrycodes=ph`, { headers: { "Accept-Language": "en" } });
                            const results = await r.json();
                            setSearchRes(results);
                            setShowDropdown(true);
                          } catch { setShowDropdown(false); }
                        }, 400);
                      }}
                      placeholder="Or type a location..."
                      style={{ width: "100%", padding: "11px 14px 11px 36px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#0f172a", background: "#f8fafc", outline: "none", boxSizing: "border-box" }}
                    />
                    {showDropdown && searchResults.length > 0 && (
                      <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, maxHeight: 180, overflowY: "auto", zIndex: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }}>
                        {searchResults.map((r: any) => (
                          <div
                            key={r.place_id}
                            onClick={() => {
                              const name = r.display_name.split(",")[0];
                              setSearchVal(name);
                              setShowDropdown(false);
                              S.selectedDest = { lat: parseFloat(r.lat), lng: parseFloat(r.lon), name };
                              placeDestMarker(parseFloat(r.lon), parseFloat(r.lat));
                              mapRef.current?.flyTo({ center: [parseFloat(r.lon), parseFloat(r.lat)], zoom: 14, pitch: 45 });
                              setStartLabel("Navigate to " + name);
                              setStartDisabled(false);
                              setIdleSub("Navigating to: " + name);
                            }}
                            style={{ padding: "10px 14px", borderBottom: "1px solid #f1f5f9", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
                          >
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#1a56db", flexShrink: 0 }}>
                              <i className="fa-solid fa-location-dot" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", display: "block" }}>{r.display_name.split(",")[0]}</span>
                              <span style={{ fontSize: 11, color: "#64748b", display: "block", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.display_name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={beginNavigation}
                    disabled={startDisabled}
                    style={{ width: "100%", padding: 13, background: startDisabled ? "#e2e8f0" : "#6366f1", color: startDisabled ? "#94a3b8" : "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: startDisabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  >
                    <i className="fa-solid fa-location-dot" /> {startLabel}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "0.75rem 1.25rem", borderTop: "1.5px solid #bfdbfe", background: "#fff", display: "flex", justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ background: "#6b7280", border: "none", color: "#fff", borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Close</button>
          </div>
        </div>
      </div>
    </>
  );
}

function SpotCard({
  spot,
  onSeeMore,
  onNavigate,
  onFavorite,
}: {
  spot: TouristSpot;
  onSeeMore: (spot: TouristSpot) => void;
  onNavigate: (spot: TouristSpot) => void;
  onFavorite: (spot: TouristSpot) => void;
}) {
  const MAX       = 100;
  const truncated = spot.description.length > MAX;
  const shortDesc = truncated ? spot.description.slice(0, MAX) + "..." : spot.description;

  // ✅ Handle category as object or string
  const catLabel   = typeof spot.category === "string" ? spot.category : spot.category.label;
  const badgeClass = typeof spot.category === "string"
    ? getBadgeClass(spot.category)
    : spot.category.badge_class;

  // ✅ Handle both image field names
  const imageUrl = spot.spot_image || spot.image_url;

  return (
    <div
      style={{ background: "#fff", borderRadius: 16, overflow: "hidden", border: "1.5px solid #bfdbfe", transition: "transform 0.2s, box-shadow 0.2s", display: "flex", flexDirection: "column" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(26,86,219,0.12)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
    >
      {imageUrl && (
        <img src={imageUrl} alt={spot.spot_name} style={{ width: "100%", height: 190, objectFit: "cover", display: "block" }} />
      )}
      <div style={{ padding: "1.25rem", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <span className={`ta-badge ${badgeClass}`}>{catLabel}</span>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: "#1e3a8a" }}>
          {spot.spot_name}
        </div>
        <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.55 }}>
          {shortDesc}
          {truncated && (
            <>
              {" "}
              <a href="#" onClick={(e) => { e.preventDefault(); onSeeMore(spot); }} style={{ color: "#1a56db", fontWeight: 500, textDecoration: "none" }}>
                See more
              </a>
            </>
          )}
        </div>
        <div style={{ fontSize: 12 }}>
          <a href="#" onClick={(e) => { e.preventDefault(); onNavigate(spot); }} style={{ color: "#1a56db", fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}>
            📍 {spot.location}
          </a>
        </div>
        <div style={{ marginTop: 6 }}>
          <button
            onClick={() => onFavorite(spot)}
            style={{ background: "#fff", border: "1.5px solid #bfdbfe", color: "#1a56db", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "inline-flex", alignItems: "center", gap: 6, transition: "background 0.15s" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#eff6ff")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#fff")}
          >
            <i className="fas fa-heart" style={{ color: "#1a56db", fontSize: 13 }} /> Add to Favorites
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Category Pills ───────────────────────────────────────────────────────────
function CategoryPills({ active, onChange }: { active: Category; onChange: (c: Category) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "1.5rem" }}>
      {CATEGORIES.map((cat) => {
        const isActive = cat === active;
        return (
          <button key={cat} onClick={() => onChange(cat)} style={{ border: `1.5px solid ${isActive ? "#1a56db" : "#bfdbfe"}`, background: isActive ? "#1a56db" : "#fff", color: isActive ? "#fff" : "#1e3a8a", borderRadius: 20, padding: "6px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "background 0.15s, border-color 0.15s, color 0.15s", whiteSpace: "nowrap" }}>
            {cat === "all" ? "All" : cat}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function UserDashboard() {
  const history = useHistory();

  const [spots,      setSpots]      = useState<TouristSpot[]>([]);
  const [userInfo,   setUserInfo]   = useState<UserInfo>({ username: "" });
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [searchQuery,    setSearchQuery]     = useState("");
  const [descSpot,       setDescSpot]        = useState<TouristSpot | null>(null);
  const [navSpot,        setNavSpot]         = useState<TouristSpot | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; spotName: string; state: "added" | "exists" }>({ visible: false, spotName: "", state: "added" });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch dashboard data from API on mount ──
  useEffect(() => {
    const userId = localStorage.getItem("user_id");
    const username = localStorage.getItem("username") ?? "";

    // Set user info from localStorage immediately
    setUserInfo({ username });

    apiFetch<{ success: boolean; data: TouristSpot[] }>("/spots")
      .then((data) => {
        if (data.success) {
          console.log("Spots loaded:", data.data.length, data.data[0]); // ← ADD THIS
          setSpots(data.data);
        } else {
          setError("Failed to load spots.");
        }
      })
      .catch((err) => {
        setError(err.message ?? "Network error.");
      })
      .finally(() => setLoading(false));

    // Also try dashboard for profile photo (non-blocking)
    fetch(`${API_BASE}/dashboard?user_id=${userId ?? ""}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "success" && data.user) {
          setUserInfo({
            username: data.user.username || username,
            email: data.user.email,
            profile_photo: data.user.profile_photo,
          });
        }
      })
      .catch(() => {}); // silent fail — localStorage username already set
  }, []);

  // ── Search: hit /search endpoint, then filter locally ──
  const handleSearchSubmit = useCallback(() => {
    if (!searchQuery.trim()) { setActiveCategory("all"); return; }
    apiFetch<{ success: boolean; data: TouristSpot[] }>(
      `/spots?search=${encodeURIComponent(searchQuery)}`
    )
      .then((data) => { if (data.success) setSpots(data.data); })
      .catch(() => {});
  }, [searchQuery]);

  const handleSearchChange = (v: string) => {
    setSearchQuery(v);
    if (v.trim() === "") {
      apiFetch<{ success: boolean; data: TouristSpot[] }>("/spots")
        .then((data) => { if (data.success) setSpots(data.data); })
        .catch(() => {});
    }
  };

  // ── Add to favorites via API ──
  const handleFavorite = useCallback(async (spot: TouristSpot) => {
    try {
      const data = await apiFetch<{ status: "added" | "exists"; message: string }>("/favorite", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ spot_id: spot.spot_id, spot_name: spot.spot_name }),
      });
      const state = data.status;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToast({ visible: true, spotName: spot.spot_name, state });
      toastTimerRef.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3500);
    } catch {
      setToast({ visible: true, spotName: spot.spot_name, state: "added" });
    }
  }, []);

  const filtered = spots.filter((s) => {
    if (activeCategory === "all") return true;
    const catValue = typeof s.category === "string" ? s.category : s.category.value;
    return catValue === activeCategory;
  });

  // ── Logout ──
  const handleLogout = () => {
    fetch(`${API_BASE.replace("/API_main", "")}/index.php/user/logout`, {
      credentials: "include",
    }).finally(() => history.push("/login"));
  };

  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
      <script src="https://cdn.jsdelivr.net/npm/@turf/turf@6/turf.min.js" />
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body { font-family: 'DM Sans', sans-serif; background: #f8f9fc; margin: 0; padding: 0; }
        html { margin: 0; padding: 0; }
        .ta-badge          { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; letter-spacing: 0.03em; }
        .badge-beach       { background: #e0f2fe; color: #0369a1; }
        .badge-mountain    { background: #dcfce7; color: #166534; }
        .badge-historical  { background: #fef9c3; color: #854d0e; }
        .badge-park        { background: #f0fdf4; color: #15803d; }
        .badge-museum      { background: #ede9fe; color: #5b21b6; }
        .badge-festival    { background: #fff1f2; color: #9f1239; }
        .badge-other       { background: #f1f5f9; color: #475569; }
        .spots-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 1.5rem; }
        .nav-user-marker  { position: relative; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; pointer-events: none; }
        .nav-user-pulse   { position: absolute; inset: 0; border-radius: 50%; background: rgba(99,102,241,0.18); animation: nav-user-pulse 2s ease-out infinite; }
        @keyframes nav-user-pulse { 0% { transform: scale(0.7); opacity: 0.8; } 100% { transform: scale(1.5); opacity: 0; } }
        .nav-user-icon    { position: relative; z-index: 2; width: 36px; height: 36px; background: #6366f1; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 3px 12px rgba(99,102,241,0.45); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 15px; }
        .nav-user-chevron { position: absolute; top: -2px; left: 50%; transform: translateX(-50%); z-index: 3; color: #6366f1; font-size: 11px; filter: drop-shadow(0 0 2px #fff); }
        .nav-dest-marker  { display: flex; flex-direction: column; align-items: center; pointer-events: none; }
        .nav-dest-pin     { width: 38px; height: 38px; background: #22c55e; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 3px solid #fff; box-shadow: 0 4px 14px rgba(34,197,94,0.4); }
        .nav-dest-pin i   { transform: rotate(45deg); color: #fff; font-size: 16px; }
        .nav-dest-stem    { width: 3px; height: 10px; background: #22c55e; border-radius: 0 0 3px 3px; }
        .nav-start-marker { display: flex; flex-direction: column; align-items: center; pointer-events: none; }
        .nav-start-pin    { width: 34px; height: 34px; background: #3b82f6; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 3px solid #fff; box-shadow: 0 4px 14px rgba(59,130,246,0.4); }
        .nav-start-pin i  { transform: rotate(45deg); color: #fff; font-size: 14px; }
        .nav-start-stem   { width: 3px; height: 8px; background: #3b82f6; border-radius: 0 0 3px 3px; }

        .content-wrapper::-webkit-scrollbar { width: 8px; }
        .content-wrapper::-webkit-scrollbar-track { background: #f1f5f9; }
        .content-wrapper::-webkit-scrollbar-thumb { background: #bfdbfe; border-radius: 4px; }
        .content-wrapper::-webkit-scrollbar-thumb:hover { background: #93c5fd; }
      `}</style>

      <FavToast
        visible={toast.visible}
        spotName={toast.spotName}
        state={toast.state}
        onClose={() => setToast((t) => ({ ...t, visible: false }))}
      />
      <DescModal spot={descSpot} onClose={() => setDescSpot(null)} />
      <NavModal  spot={navSpot}  onClose={() => setNavSpot(null)}  />

      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        <Sidebar activePath="/userdashboard" onNavigate={(path) => history.push(path)} />

        <div className="content-wrapper" style={{
          marginLeft: 225, flex: 1,
          display: "flex", flexDirection: "column",
          height: "100vh", overflowY: "auto", overflowX: "hidden",
          scrollbarWidth: "thin", scrollbarColor: "#bfdbfe #f1f5f9"
        }}>
          <Topbar
            username={userInfo.username}
            profilePhoto={userInfo.profile_photo}
            onLogout={handleLogout}
            searchValue={searchQuery}
            onSearchChange={handleSearchChange}
            onSearchSubmit={handleSearchSubmit}
          />

          <div style={{ padding: "1.5rem", flex: 1, fontFamily: "'DM Sans', sans-serif" }}>
            <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #bfdbfe", boxShadow: "0 2px 8px rgba(26,86,219,0.07)", overflow: "hidden" }}>
              <div style={{ padding: "1rem 1.25rem", borderBottom: "1.5px solid #bfdbfe", background: "#fff" }}>
                <h6 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#1a56db", borderLeft: "4px solid #1a56db", paddingLeft: 12 }}>
                  Tourist Spots
                </h6>
              </div>
              <div style={{ padding: "1.25rem" }}>

                {/* Loading state */}
                {loading && (
                  <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#6b8ab8", fontSize: 14 }}>
                    <i className="fas fa-spinner fa-spin" style={{ fontSize: 28, color: "#bfdbfe", display: "block", marginBottom: "0.75rem" }} />
                    Loading tourist spots…
                  </div>
                )}

                {/* Error state */}
                {!loading && error && (
                  <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#dc2626", fontSize: 14 }}>
                    <i className="fas fa-triangle-exclamation" style={{ fontSize: 28, display: "block", marginBottom: "0.75rem" }} />
                    {error}
                  </div>
                )}

                {/* Content */}
                {!loading && !error && (
                  <>
                    <CategoryPills active={activeCategory} onChange={setActiveCategory} />

                    {filtered.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#6b8ab8", fontSize: 14 }}>
                        <i className="fas fa-search" style={{ fontSize: 32, color: "#bfdbfe", display: "block", marginBottom: "0.75rem" }} />
                        No spots found in this category.
                      </div>
                    ) : (
                      <div className="spots-grid">
                        {filtered.map((spot) => (
                          <SpotCard
                            key={spot.spot_id}
                            spot={spot}
                            onSeeMore={setDescSpot}
                            onNavigate={setNavSpot}
                            onFavorite={handleFavorite}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}