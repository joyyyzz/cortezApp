import { useState, useRef, useCallback, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { CapacitorHttp } from "@capacitor/core";
import { Capacitor } from "@capacitor/core";
import AppLayout from "../components/AppLayout"; // ← adjust path if needed

// ─── API Base ─────────────────────────────────────────────────────────────────
const API_BASE         = "https://itservicesph.com/IT383/CORTEZ/Cortez/index.php/API_favorite";
const API_PROFILE_BASE = "https://itservicesph.com/IT383/CORTEZ/Cortez/index.php/API_profile";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FavoriteSpot {
  spot_id: number;
  spot_name: string;
  category: string;
  description: string;
  location: string;
  spot_image?: string;
  spot_image_url?: string;
  category_badge?: string;
  description_short?: string;
}

interface ApiIndexResponse {
  status?: string;
  success?: boolean;
  username?: string;
  total_favorites?: number;
  total?: number;
  favorite_spots?: FavoriteSpot[];
  favorites?: FavoriteSpot[];
  empty_message?: string;
  message?: string;
}

interface ApiProfileResponse {
  status: string;
  user_id: number | null;
  username: string;
  handle: string;
  profile_photo: string | null;
  fname: string | null;
  mname: string | null;
  lname: string | null;
  address: string | null;
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

// ─── Get user_id ──────────────────────────────────────────────────────────────
function getStoredUserId(): string | null {
  const KEYS = ["user_id", "userId", "id"];
  for (const store of [sessionStorage, localStorage]) {
    for (const key of KEYS) {
      const val = store.getItem(key);
      if (val && val !== "0" && val !== "null") return val;
    }
    for (const objKey of ["user", "userInfo", "auth"]) {
      try {
        const raw = store.getItem(objKey);
        if (raw) {
          const obj = JSON.parse(raw);
          for (const k of KEYS) { if (obj[k]) return String(obj[k]); }
        }
      } catch {}
    }
  }
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getBadgeClass(category: string): string {
  const c = (category ?? "").toLowerCase();
  if (c.includes("beach"))                                 return "badge-beach";
  if (c.includes("mountain"))                              return "badge-mountain";
  if (c.includes("historical") || c.includes("heritage")) return "badge-historical";
  if (c.includes("park"))                                  return "badge-park";
  if (c.includes("museum"))                                return "badge-museum";
  if (c.includes("festival") || c.includes("event"))      return "badge-festival";
  return "badge-other";
}

function normalizeSpots(raw: FavoriteSpot[]): FavoriteSpot[] {
  return (raw ?? []).map(s => ({
    ...s,
    spot_image:  s.spot_image_url ?? s.spot_image,
    category:    s.category    ?? "Other",
    description: s.description ?? "",
    location:    s.location    ?? "",
  }));
}

// ─── API calls ────────────────────────────────────────────────────────────────
async function apiFetch(path: string, options?: RequestInit): Promise<ApiIndexResponse> {
  const url = `${API_BASE}${path}`;
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.request({
      url, method: options?.method || "GET",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
    });
    if (response.status >= 400) throw new Error(`HTTP ${response.status}`);
    return response.data as ApiIndexResponse;
  }
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiGetFavorites(userId: string | null, search = "", category = ""): Promise<ApiIndexResponse> {
  const params = new URLSearchParams();
  if (userId)   params.set("user_id",  userId);
  if (search)   params.set("search",   search);
  if (category && category !== "all") params.set("category", category);
  const qs = params.toString() ? `?${params}` : "";
  return apiFetch(qs);
}

async function apiRemoveFavorite(spotId: number, userId: string | null): Promise<void> {
  const qs = userId ? `?user_id=${userId}` : "";
  let res: ApiIndexResponse;
  try {
    res = await apiFetch(`/remove/${spotId}${qs}`, { method: "POST" });
  } catch {
    res = await apiFetch(`/remove/${spotId}${qs}`, { method: "DELETE" });
  }
  if (res.success === false) throw new Error(res.message ?? "Remove failed");
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
// ✅ CHANGED: accepts isMobileOpen so the class can be toggled
function Sidebar({
  onNavigate,
  isMobileOpen,
}: {
  onNavigate: (path: string) => void;
  isMobileOpen: boolean;
}) {
  return (
    <div
      id="sidebar"
      className={isMobileOpen ? "mobile-open" : ""}
      style={{
        width: 225, minWidth: 225,
        background: "linear-gradient(180deg,#4e73df 10%,#224abe 100%)",
        display: "flex", flexDirection: "column",
        position: "fixed", top: 0, left: 0,
        height: "100vh", zIndex: 200,
      }}
    >
      <a
        href="#"
        onClick={e => { e.preventDefault(); onNavigate("/userdashboard"); }}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "1.25rem 1rem", color: "#fff", textDecoration: "none" }}
      >
        <span style={{ fontSize: 22, display: "inline-block", transform: "rotate(-15deg)" }}>
          <i className="fas fa-laugh-wink" />
        </span>
        <span style={{ fontSize: 17, fontWeight: 700 }}><em><b>TOUR_</b></em>ISTA</span>
      </a>
      <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.15)", margin: "0 1rem" }} />
      <ul style={{ listStyle: "none", padding: 0, flex: 1 }}>
        {NAV_ITEMS.map(({ icon, label, path }) => (
          <li key={label}>
            <a
              href="#"
              onClick={e => { e.preventDefault(); onNavigate(path); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "12px 20px",
                color: path === "/favorite" ? "#fff" : "rgba(255,255,255,0.75)",
                fontSize: 13.5, fontWeight: 500, textDecoration: "none",
                background: path === "/favorite" ? "rgba(255,255,255,0.12)" : "transparent",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              <i className={`fas fa-fw ${icon}`} style={{ width: 18, textAlign: "center", fontSize: 14 }} />
              <span>{label}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Topbar ───────────────────────────────────────────────────────────────────
// ✅ CHANGED: added onMenuToggle + hamburger button
function Topbar({
  username, avatarSrc, onLogout, searchValue, onSearchChange, onMenuToggle,
}: {
  username: string;
  avatarSrc: string | null;
  onLogout: () => void;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onMenuToggle: () => void; // ← NEW
}) {
  const [dropOpen, setDropOpen] = useState(false);

  useEffect(() => {
    if (!dropOpen) return;
    const handler = () => setDropOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [dropOpen]);

  return (
    <nav style={{
      height: 65, background: "#fff",
      boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
      display: "flex", alignItems: "center",
      padding: "0 1.5rem", gap: "1rem",
      position: "sticky", top: 0, zIndex: 99, flexShrink: 0,
    }}>
      {/* ✅ Hamburger button — only visible on mobile via CSS */}
      <button
        className="hamburger-btn"
        onClick={onMenuToggle}
        style={{
          display: "none", // AppLayout CSS overrides to flex on mobile
          background: "none", border: "none", cursor: "pointer",
          fontSize: 20, color: "#4e73df", padding: "4px 8px",
          alignItems: "center", justifyContent: "center",
        }}
      >
        <i className="fas fa-bars" />
      </button>

      {/* Search */}
      <div style={{ display: "flex" }}>
        <input
          type="text"
          placeholder="Search favorite spot..."
          value={searchValue}
          onChange={e => onSearchChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Escape") onSearchChange(""); }}
          style={{
            border: "1px solid #d1d3e2", borderRight: "none",
            borderRadius: "5px 0 0 5px", padding: "7px 14px",
            fontSize: 13, fontFamily: "'DM Sans', sans-serif",
            background: "#f8f9fc", color: "#333", width: 280, outline: "none",
          }}
        />
        <button style={{ background: "#4e73df", border: "none", borderRadius: "0 5px 5px 0", padding: "7px 14px", color: "#fff", cursor: "pointer" }}>
          <i className="fas fa-search fa-sm" />
        </button>
      </div>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginLeft: "auto" }}>
        <div style={{ borderLeft: "1px solid #e3e6f0", height: 36 }} />
        <div
          style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", position: "relative" }}
          onClick={e => { e.stopPropagation(); setDropOpen(o => !o); }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{username || "..."}</span>
          {avatarSrc ? (
            <img src={avatarSrc} alt="avatar" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#eff6ff", border: "2px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="fas fa-user" style={{ color: "#1a56db", fontSize: 14 }} />
            </div>
          )}
          {dropOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 10px)", right: 0, background: "#fff", border: "1px solid #e3e6f0", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", minWidth: 160, zIndex: 200 }}>
              <a href="#logout" onClick={e => { e.preventDefault(); onLogout(); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", fontSize: 13, color: "#555", textDecoration: "none" }}>
                <i className="fas fa-sign-out-alt fa-sm fa-fw" style={{ color: "#aaa" }} /> Logout
              </a>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

// ─── Remove Confirm Modal ─────────────────────────────────────────────────────
function RemoveConfirmModal({ spotName, onCancel, onConfirm }: { spotName: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <>
      <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1040 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 1050, width: "min(92vw,400px)" }}>
        <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #bfdbfe", boxShadow: "0 2px 8px rgba(26,86,219,0.07)", padding: "2rem 1.5rem", textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
          <div style={{ fontSize: 42, color: "#e53e3e", marginBottom: 10 }}><i className="fas fa-heart-broken" /></div>
          <h5 style={{ fontFamily: "'Playfair Display', serif", color: "#1a56db", fontSize: 20, marginBottom: 8 }}>Remove from favorites?</h5>
          <p style={{ color: "#475569", fontSize: 13, marginBottom: 24 }}><b>{spotName}</b> will be removed from your favorites list.</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={onConfirm} style={{ background: "#1a56db", border: "none", color: "#fff", borderRadius: 8, padding: "8px 22px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Yes, Remove it!</button>
            <button onClick={onCancel} style={{ background: "#fff", border: "1.5px solid #bfdbfe", color: "#6b8ab8", borderRadius: 8, padding: "8px 22px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Remove Toast ─────────────────────────────────────────────────────────────
function RemoveToast({ spotName, visible, onClose }: { spotName: string; visible: boolean; onClose: () => void }) {
  return (
    <div style={{
      position: "fixed", bottom: 30, right: 30, zIndex: 9999, minWidth: 280,
      background: "#fff", border: "1.5px solid #bfdbfe", borderRadius: 14,
      boxShadow: "0 8px 32px rgba(26,86,219,0.16)", padding: "14px 20px",
      display: "flex", alignItems: "center", gap: 12, fontFamily: "'DM Sans', sans-serif",
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)",
      transition: "opacity 0.3s ease, transform 0.3s ease", pointerEvents: visible ? "auto" : "none",
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: "#fff0f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <i className="fas fa-heart-broken" style={{ color: "#e53e3e", fontSize: 17 }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#1e3a8a", marginBottom: 2 }}>Removed from Favorites!</div>
        <div style={{ fontSize: 12, color: "#6b8ab8" }}>{spotName} has been removed from your favorites.</div>
      </div>
      <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b8ab8", fontSize: 16, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
    </div>
  );
}

// ─── Category Pills ───────────────────────────────────────────────────────────
function CategoryPills({ active, onChange }: { active: Category; onChange: (c: Category) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "1.5rem" }}>
      {CATEGORIES.map(cat => {
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

// ─── Favorite Card ────────────────────────────────────────────────────────────
function FavCard({ spot, onRemove }: { spot: FavoriteSpot; onRemove: (spot: FavoriteSpot) => void }) {
  const MAX = 100;
  const desc = spot.description_short ?? spot.description ?? "";
  const shortDesc = desc.length > MAX ? desc.slice(0, MAX) + "..." : desc;
  const badgeClass = spot.category_badge ? `badge-${spot.category_badge}` : getBadgeClass(spot.category);
  const imgSrc = spot.spot_image_url ?? spot.spot_image;
  return (
    <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", border: "1.5px solid #bfdbfe", transition: "transform 0.2s, box-shadow 0.2s", display: "flex", flexDirection: "column" }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(26,86,219,0.12)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
    >
      {imgSrc && <img src={imgSrc} alt={spot.spot_name} style={{ width: "100%", height: 190, objectFit: "cover", display: "block" }} />}
      <div style={{ padding: "1.25rem", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <span className={`ta-badge ${badgeClass}`}>{spot.category}</span>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: "#1e3a8a" }}>{spot.spot_name}</div>
        <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.55 }}>{shortDesc}</div>
        <div style={{ fontSize: 12, color: "#6b8ab8" }}>📍 {spot.location}</div>
        <div style={{ marginTop: 6 }}>
          <button onClick={() => onRemove(spot)} style={{ background: "#fff", border: "1px solid #fca5a5", color: "#dc2626", borderRadius: 6, padding: "5px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "inline-flex", alignItems: "center", gap: 6, transition: "background 0.15s" }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = "#fee2e2")}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = "#fff")}
          >
            <i className="fas fa-heart-broken" style={{ fontSize: 12 }} /> Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="fav-grid">
      {[1, 2, 3].map(i => (
        <div key={i} style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #bfdbfe", overflow: "hidden" }}>
          <div style={{ width: "100%", height: 190, background: "#f1f5f9", animation: "pulse 1.5s ease-in-out infinite" }} />
          <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: 10 }}>
            {[["40%",14],["70%",18],["90%",13],["55%",13]].map(([w, h], j) => (
              <div key={j} style={{ height: h as number, width: w as string, background: "#f1f5f9", borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Error Banner ─────────────────────────────────────────────────────────────
function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ background: "#fff5f5", border: "1.5px solid #fca5a5", borderRadius: 12, padding: "1rem 1.25rem", color: "#dc2626", fontSize: 13, display: "flex", alignItems: "center", gap: 12, marginBottom: "1rem" }}>
      <i className="fas fa-triangle-exclamation" style={{ fontSize: 18, flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onRetry} style={{ background: "#dc2626", border: "none", color: "#fff", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Retry</button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Favorite() {
  const history = useHistory();
  const handleNavigate = (path: string) => history.push(path);
  const handleLogout   = () => history.push("/login");

  // ✅ NEW: hamburger state
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const [userId] = useState<string | null>(() => getStoredUserId());
  const [spots,          setSpots]          = useState<FavoriteSpot[]>([]);
  const [username,       setUsername]       = useState("User");
  const [avatarSrc,      setAvatarSrc]      = useState<string | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [searchQuery,    setSearchQuery]    = useState("");
  const [removeTarget,   setRemoveTarget]   = useState<FavoriteSpot | null>(null);
  const [removing,       setRemoving]       = useState(false);
  const [toast,          setToast]          = useState({ visible: false, spotName: "" });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchFavorites = useCallback(async (search = "", category = "") => {
    setLoading(true); setError(null);
    try {
      const data = await apiGetFavorites(userId, search, category);
      const rawSpots = data.favorite_spots ?? data.favorites ?? [];
      setSpots(normalizeSpots(rawSpots));
      if (data.username && username === "User") setUsername(data.username);
    } catch (e: any) {
      setError("Failed to load favorites. " + (e?.message ?? "Please try again."));
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => {
    const fetchProfile = async () => {
      const storedUid = userId || localStorage.getItem("user_id") || "";
      if (!storedUid) return;
      try {
        const res = await fetch(`${API_PROFILE_BASE}?user_id=${storedUid}`, { method: "GET", credentials: "include" });
        if (!res.ok) return;
        const text = await res.text();
        let data: ApiProfileResponse;
        try { data = JSON.parse(text); } catch { return; }
        if (data.status === "success") {
          if (data.username) setUsername(data.username);
          if (data.profile_photo) setAvatarSrc(data.profile_photo);
        }
      } catch {}
    };
    fetchProfile();
  }, [userId]);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  const q = searchQuery.toLowerCase().trim();
  const filtered = spots.filter(s => {
    const matchesCat    = activeCategory === "all" || s.category === activeCategory;
    const combined      = ((s.spot_name ?? "") + " " + (s.location ?? "") + " " + (s.description ?? "")).toLowerCase();
    const matchesSearch = !q || combined.includes(q);
    return matchesCat && matchesSearch;
  });

  const handleConfirmRemove = useCallback(async () => {
    if (!removeTarget || removing) return;
    const spot = removeTarget;
    setRemoveTarget(null); setRemoving(true);
    setSpots(prev => prev.filter(s => s.spot_id !== spot.spot_id));
    try {
      await apiRemoveFavorite(spot.spot_id, userId);
    } catch (e: any) {
      setSpots(prev => [spot, ...prev]);
      setError(`Could not remove "${spot.spot_name}". ` + (e?.message ?? "Please try again."));
      setRemoving(false); return;
    }
    setRemoving(false);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ visible: true, spotName: spot.spot_name });
    toastTimerRef.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  }, [removeTarget, removing, userId]);

  return (
    // ✅ Wrapped with AppLayout
    <AppLayout isMobileOpen={isMobileOpen} onMobileToggle={() => setIsMobileOpen(o => !o)}>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
        html, body, #root { height:100%; overflow:hidden; }
        body { font-family:'DM Sans',sans-serif; background:#f8f9fc; }
        #fav-wrapper { display:flex; height:100vh; overflow:hidden; }
        #fav-content-wrapper {
          margin-left:225px; flex:1; display:flex; flex-direction:column;
          height:100vh; overflow-y:auto; overflow-x:hidden;
          scrollbar-width:thin; scrollbar-color:#bfdbfe #f1f5f9;
        }
        #fav-content-wrapper::-webkit-scrollbar { width:8px; }
        #fav-content-wrapper::-webkit-scrollbar-track { background:#f1f5f9; }
        #fav-content-wrapper::-webkit-scrollbar-thumb { background:#bfdbfe; border-radius:4px; }
        #fav-content-wrapper::-webkit-scrollbar-thumb:hover { background:#93c5fd; }
        .ta-badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:500; letter-spacing:0.03em; }
        .badge-beach      { background:#e0f2fe; color:#0369a1; }
        .badge-mountain   { background:#dcfce7; color:#166534; }
        .badge-historical { background:#fef9c3; color:#854d0e; }
        .badge-park       { background:#f0fdf4; color:#15803d; }
        .badge-museum     { background:#ede9fe; color:#5b21b6; }
        .badge-festival   { background:#fff1f2; color:#9f1239; }
        .badge-other      { background:#f1f5f9; color:#475569; }
        .fav-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(290px,1fr)); gap:1.5rem; }
        /* ✅ Show hamburger on mobile */
        @media (max-width: 768px) {
          .hamburger-btn { display:flex !important; }
        }
      `}</style>

      <RemoveToast spotName={toast.spotName} visible={toast.visible} onClose={() => setToast(t => ({ ...t, visible: false }))} />
      {removeTarget && (
        <RemoveConfirmModal spotName={removeTarget.spot_name} onCancel={() => setRemoveTarget(null)} onConfirm={handleConfirmRemove} />
      )}

      <div id="fav-wrapper">
        {/* ✅ Sidebar now gets isMobileOpen */}
        <Sidebar onNavigate={handleNavigate} isMobileOpen={isMobileOpen} />

        <div id="fav-content-wrapper">
          {/* ✅ Topbar now gets onMenuToggle */}
          <Topbar
            username={username}
            avatarSrc={avatarSrc}
            onLogout={handleLogout}
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            onMenuToggle={() => setIsMobileOpen(o => !o)}
          />

          <div style={{ padding: "1.5rem", flex: 1, fontFamily: "'DM Sans', sans-serif" }}>
            {!userId && !loading && (
              <div style={{ background: "#fef9c3", border: "1.5px solid #fde047", borderRadius: 12, padding: "0.85rem 1.25rem", color: "#854d0e", fontSize: 13, marginBottom: "1rem", display: "flex", alignItems: "center", gap: 10 }}>
                <i className="fas fa-triangle-exclamation" />
                Session not detected. Please <a href="/login" style={{ color: "#854d0e", fontWeight: 700 }}>log in</a> to see your favorites.
              </div>
            )}

            <div style={{ background: "#fff", borderRadius: 16, padding: "1.1rem 1.5rem", display: "inline-flex", alignItems: "center", gap: "1rem", border: "1.5px solid #bfdbfe", marginBottom: "2rem", boxShadow: "0 2px 8px rgba(26,86,219,0.07)" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="fas fa-heart" style={{ color: "#1a56db", fontSize: 20 }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: "#6b8ab8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Favorites</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#1e3a8a", lineHeight: 1 }}>{loading ? "—" : filtered.length}</div>
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #bfdbfe", boxShadow: "0 2px 8px rgba(26,86,219,0.07)", overflow: "hidden" }}>
              <div style={{ padding: "1rem 1.25rem", borderBottom: "1.5px solid #bfdbfe" }}>
                <h6 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#1a56db", borderLeft: "4px solid #1a56db", paddingLeft: 12 }}>Favorite Spots</h6>
              </div>
              <div style={{ padding: "1.25rem" }}>
                {error && <ErrorBanner message={error} onRetry={() => fetchFavorites(searchQuery, activeCategory !== "all" ? activeCategory : "")} />}
                {loading ? <LoadingSkeleton /> : spots.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#6b8ab8", fontSize: 15 }}>
                    <i className="fas fa-heart-broken" style={{ fontSize: 48, color: "#bfdbfe", display: "block", marginBottom: "1rem" }} />
                    No favorites yet. Go explore some tourist spots!
                  </div>
                ) : (
                  <>
                    <CategoryPills active={activeCategory} onChange={setActiveCategory} />
                    {filtered.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#6b8ab8" }}>
                        <i className="fas fa-search" style={{ fontSize: 36, color: "#bfdbfe", display: "block", marginBottom: "0.75rem" }} />
                        <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>No favorite spots found for &ldquo;{q || activeCategory}&rdquo;.</p>
                      </div>
                    ) : (
                      <div className="fav-grid">
                        {filtered.map(spot => <FavCard key={spot.spot_id} spot={spot} onRemove={setRemoveTarget} />)}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}