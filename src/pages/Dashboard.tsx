import { useState, useEffect, useCallback } from "react";
import { useHistory } from "react-router-dom";

// ─── Config ───────────────────────────────────────────────────────────────────
const API_BASE = "https://itservicesph.com/IT383/CORTEZ/Cortez/index.php/API_main";
const BASE_UPLOADS = "https://itservicesph.com/IT383/CORTEZ/Cortez/uploads/profile/";

// ─── Types ───────────────────────────────────────────────────────────────────
interface CategoryInfo {
  value: string;
  label: string;
  badge_class: string;
}

interface TouristSpot {
  spot_id: number;
  spot_name: string;
  category: CategoryInfo;
  description: string;
  location: string;
  spot_image?: string | null;
  is_archived: boolean;
}

interface StatsData {
  total_users: number;
  tourist_spots: number;
}

interface DashboardProps {
  username?: string;
  profile_photo?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getCategoryLabel(cat: CategoryInfo | string): string {
  return typeof cat === "string" ? cat : cat.label;
}
function getCategoryBadge(cat: CategoryInfo | string): string {
  if (typeof cat !== "string") return cat.badge_class;
  const c = cat.toLowerCase();
  if (c.includes("beach"))                                 return "badge-beach";
  if (c.includes("mountain"))                              return "badge-mountain";
  if (c.includes("historical") || c.includes("heritage")) return "badge-historical";
  if (c.includes("park"))                                  return "badge-park";
  if (c.includes("museum"))                                return "badge-museum";
  if (c.includes("festival") || c.includes("event"))      return "badge-festival";
  return "badge-other";
}

// ✅ Helper para ma-extract ang filename lang mula sa buong URL o filename
function cleanPhoto(p: string | null | undefined): string | null {
  if (!p) return null;
  return p.includes("http") ? p.split("/").pop() ?? null : p;
}

// ─── API calls ────────────────────────────────────────────────────────────────
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Unknown error");
  return json as T;
}

async function fetchStats(): Promise<StatsData> {
  const r = await apiFetch<{ success: boolean; data: StatsData }>("/stats");
  return r.data;
}

async function fetchSpots(search = ""): Promise<TouristSpot[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  const r  = await apiFetch<{ success: boolean; data: TouristSpot[] }>(`/spots${qs}`);
  return r.data;
}

async function archiveSpot(id: number): Promise<void> {
  await apiFetch(`/archive/${id}`, { method: "POST" });
}

async function addSpot(formData: FormData): Promise<TouristSpot> {
  const r = await apiFetch<{ success: boolean; data: TouristSpot }>("/spots", {
    method: "POST",
    body: formData,
  });
  return r.data;
}

// ─── Desc Modal ───────────────────────────────────────────────────────────────
function DescModal({ spot, onClose }: { spot: TouristSpot | null; onClose: () => void }) {
  if (!spot) return null;
  return (
    <>
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:1040 }} onClick={onClose} />
      <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", zIndex:1050, width:"100%", maxWidth:500, padding:"0 1rem" }}>
        <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #bfdbfe" }}>
          <div style={{ padding:"1rem 1.25rem", borderBottom:"1.5px solid #bfdbfe", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <h5 style={{ margin:0, fontFamily:"'Playfair Display',serif", color:"#1a56db", fontSize:18 }}>
              {spot.spot_name} — Description
            </h5>
            <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#666", lineHeight:1 }}>×</button>
          </div>
          <div style={{ padding:"1.25rem" }}>
            {spot.spot_image && (
              <div style={{ textAlign:"center", marginBottom:12 }}>
                <img src={spot.spot_image} alt={spot.spot_name} style={{ maxWidth:"70%", borderRadius:12 }} />
              </div>
            )}
            <p style={{ fontSize:14, color:"#334155", lineHeight:1.6, margin:0 }}>{spot.description}</p>
          </div>
          <div style={{ padding:"0.75rem 1.25rem", borderTop:"1.5px solid #bfdbfe", textAlign:"right" }}>
            <button onClick={onClose} className="ta-btn-secondary">Close</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Archive Modal ────────────────────────────────────────────────────────────
function ArchiveModal({ onCancel, onConfirm, loading }: { onCancel: () => void; onConfirm: () => void; loading: boolean }) {
  return (
    <>
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:1040 }} onClick={onCancel} />
      <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", zIndex:1050, width:340 }}>
        <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #bfdbfe", padding:"2rem 1.5rem", textAlign:"center" }}>
          <div style={{ fontSize:38, color:"#1a56db", marginBottom:10 }}>?</div>
          <h5 style={{ fontFamily:"'Playfair Display',serif", color:"#1a56db", marginBottom:8 }}>Archive this spot?</h5>
          <p style={{ color:"#475569", fontSize:13, marginBottom:20 }}>This tourist spot will be moved to the archived list.</p>
          <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
            <button className="ta-btn-primary" onClick={onConfirm} disabled={loading}>
              {loading ? "Archiving..." : "Yes, Archive it!"}
            </button>
            <button className="ta-btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Flash ────────────────────────────────────────────────────────────────────
type FlashType = "success" | "error" | "info";
function Flash({ msg, type }: { msg: string; type: FlashType }) {
  const styles: Record<FlashType, React.CSSProperties> = {
    success: { background:"#f0fdf4", border:"1px solid #86efac", color:"#166534" },
    error:   { background:"#fef2f2", border:"1px solid #fca5a5", color:"#991b1b" },
    info:    { background:"#eff6ff", border:"1px solid #93c5fd", color:"#1e3a8a" },
  };
  const icons: Record<FlashType, string> = {
    success: "fa-check-circle",
    error:   "fa-exclamation-circle",
    info:    "fa-info-circle",
  };
  return (
    <div style={{ position:"fixed", top:"1rem", right:"1rem", zIndex:9999, minWidth:260,
      borderRadius:10, padding:"10px 16px", fontSize:13, fontFamily:"'DM Sans',sans-serif",
      ...styles[type] }}>
      <i className={`fas ${icons[type]}`} style={{ marginRight:6 }}></i>{msg}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard({
  username = "Admin",
  profile_photo,
}: DashboardProps) {

  const history = useHistory();

  // ── State ──
  const [spots, setSpots]               = useState<TouristSpot[]>([]);
  const [stats, setStats]               = useState<StatsData>({ total_users: 0, tourist_spots: 0 });
  const [loading, setLoading]           = useState(true);
  const [searchQuery, setSearchQuery]   = useState("");
  const [showCount, setShowCount]       = useState(4);
  const [descModal, setDescModal]       = useState<TouristSpot | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<number | null>(null);
  const [archiving, setArchiving]       = useState(false);
  const [userDropOpen, setUserDropOpen] = useState(false);
  const [flash, setFlash]               = useState<{ msg: string; type: FlashType } | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [form, setForm] = useState({
    spot_name: "", category: "", description: "", location: "",
    spot_image: null as File | null,
  });

  const CATEGORIES = [
    "Beach","Mountain","Historical / Heritage",
    "Park / Nature","Museum","Festival / Event","Other",
  ];

  // ✅ Basahin ang localStorage para sa profile photo at username
  const savedPhoto    = localStorage.getItem("profile_photo");
  const savedUsername = localStorage.getItem("username") ?? username;

  // ✅ Gamitin ang prop first, tapos localStorage fallback
  const resolvedPhoto = cleanPhoto(profile_photo) ?? cleanPhoto(savedPhoto);

  const avatarSrc = resolvedPhoto
    ? `${BASE_UPLOADS}${resolvedPhoto}`
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(savedUsername)}&background=1a56db&color=fff`;

  // ── Flash helper ──
  function showFlash(msg: string, type: FlashType = "success") {
    setFlash({ msg, type });
    setTimeout(() => setFlash(null), 3500);
  }

  // ── Load stats ──
  const loadStats = useCallback(async () => {
    try {
      const s = await fetchStats();
      setStats(s);
    } catch (e: any) {
      console.warn("Stats error:", e.message);
    }
  }, []);

  // ── Load spots ──
  const loadSpots = useCallback(async (search = "") => {
    setLoading(true);
    try {
      const data = await fetchSpots(search);
      setSpots(data);
    } catch (e: any) {
      showFlash("Failed to load spots: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Initial load ──
  useEffect(() => {
    const userId = localStorage.getItem("user_id");

    // Fetch dashboard user info, passing user_id as fallback since CI session
    // may not persist cross-origin between localhost and itservicesph.com
    fetch(`${API_BASE}/dashboard?user_id=${userId ?? ""}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "success" && data.user?.username) {
          localStorage.setItem("username", data.user.username);
          if (data.user.profile_photo) {
            const filename = data.user.profile_photo.split("/").pop() ?? "";
            localStorage.setItem("profile_photo", filename);
          }
        }
      })
      .catch((err) => console.warn("Dashboard fetch error:", err));

    loadStats();
    loadSpots();
  }, [loadStats, loadSpots]);

  // ── Search debounce ──
  useEffect(() => {
    const t = setTimeout(() => {
      setShowCount(4);
      loadSpots(searchQuery);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery, loadSpots]);

  // ── Pagination ──
  const visible    = spots.slice(0, showCount);
  const canSeeMore = showCount < spots.length;
  const canMin     = showCount > 4;

  // ── Archive ──
  async function handleArchive(id: number) {
    setArchiving(true);
    try {
      await archiveSpot(id);
      setSpots(prev => prev.filter(s => s.spot_id !== id));
      setStats(prev => ({ ...prev, tourist_spots: Math.max(0, prev.tourist_spots - 1) }));
      showFlash("Tourist spot archived successfully.");
    } catch (e: any) {
      showFlash("Archive failed: " + e.message, "error");
    } finally {
      setArchiving(false);
      setArchiveTarget(null);
    }
  }

  // ── Add spot ──
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("spot_name",   form.spot_name);
      fd.append("category",    form.category);
      fd.append("description", form.description);
      fd.append("location",    form.location);
      if (form.spot_image) fd.append("spot_image", form.spot_image);

      const newSpot = await addSpot(fd);
      setSpots(prev => [newSpot, ...prev]);
      setStats(prev => ({ ...prev, tourist_spots: prev.tourist_spots + 1 }));
      setForm({ spot_name:"", category:"", description:"", location:"", spot_image:null });
      const fileInput = document.getElementById("fileInput") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      showFlash("Tourist spot added successfully!");
    } catch (e: any) {
      showFlash("Failed to add spot: " + e.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  const NAV_ITEMS = [
    { icon:"fa-tachometer-alt", label:"Dashboard", path:"/dashboard"   },
    { icon:"fa-users",          label:"Users",     path:"/users"        },
    { icon:"fa-user",           label:"Profile",   path:"/profileadmin" },
    { icon:"fa-map",            label:"Map",       path:"/mapadmin"     },
    { icon:"fa-archive",        label:"Archived",  path:"/archived"     },
  ];

  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@400;500&display=swap');

        *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
        html, body, #root { height:100%; overflow:hidden; }
        body { font-family:'DM Sans',sans-serif; background:#f8f9fc; }

        #wrapper { display:flex; height:100vh; overflow:hidden; }

        #sidebar {
          width:225px; min-width:225px;
          background:linear-gradient(180deg,#4e73df 10%,#224abe 100%);
          display:flex; flex-direction:column;
          height:100vh; position:fixed; top:0; left:0;
          flex-shrink:0; z-index:100;
        }
        .sidebar-brand {
          display:flex; align-items:center; gap:10px;
          padding:1.25rem 1rem; color:#fff; text-decoration:none;
        }
        .sidebar-brand-icon { font-size:22px; transform:rotate(-15deg); display:inline-block; }
        .sidebar-brand-text { font-size:17px; font-weight:700; }
        hr.sidebar-divider { border:none; border-top:1px solid rgba(255,255,255,0.15); margin:0 1rem; }
        .sidebar-nav { list-style:none; padding:0; flex:1; }
        .sidebar-nav li a {
          display:flex; align-items:center; gap:10px;
          padding:12px 20px; color:rgba(255,255,255,0.75);
          font-size:13.5px; font-weight:500; text-decoration:none;
          transition:background 0.15s, color 0.15s;
        }
        .sidebar-nav li a:hover,
        .sidebar-nav li.active a { background:rgba(255,255,255,0.12); color:#fff; }
        .sidebar-nav li a i { width:18px; text-align:center; font-size:14px; }

        #content-wrapper {
          margin-left:225px; flex:1;
          display:flex; flex-direction:column;
          height:100vh; overflow-y:auto; overflow-x:hidden;
          scrollbar-width:thin; scrollbar-color:#bfdbfe #f1f5f9;
        }
        #content-wrapper::-webkit-scrollbar { width:8px; }
        #content-wrapper::-webkit-scrollbar-track { background:#f1f5f9; }
        #content-wrapper::-webkit-scrollbar-thumb { background:#bfdbfe; border-radius:4px; }
        #content-wrapper::-webkit-scrollbar-thumb:hover { background:#93c5fd; }

        #topbar {
          height:65px; flex-shrink:0; background:#fff;
          box-shadow:0 2px 4px rgba(0,0,0,0.08);
          display:flex; align-items:center;
          padding:0 1.5rem; gap:1rem;
          position:sticky; top:0; z-index:99;
        }
        .topbar-search { display:flex; }
        .topbar-search input {
          border:1px solid #d1d3e2; border-right:none;
          border-radius:5px 0 0 5px; padding:7px 14px; font-size:13px;
          font-family:'DM Sans',sans-serif; background:#f8f9fc; color:#333;
          width:280px; outline:none;
        }
        .topbar-search button {
          background:#4e73df; border:none;
          border-radius:0 5px 5px 0; padding:7px 14px; color:#fff; cursor:pointer;
        }
        .topbar-right { display:flex; align-items:center; gap:1rem; margin-left:auto; }
        .topbar-divider { border-left:1px solid #e3e6f0; height:36px; }
        .user-area { display:flex; align-items:center; gap:8px; cursor:pointer; position:relative; }
        .user-area span { font-size:13px; font-weight:600; color:#333; }
        .user-area img { width:32px; height:32px; border-radius:50%; object-fit:cover; }
        .user-dropdown {
          position:absolute; top:calc(100% + 10px); right:0;
          background:#fff; border:1px solid #e3e6f0;
          border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,0.1);
          min-width:160px; z-index:200;
        }
        .user-dropdown a {
          display:flex; align-items:center; gap:8px;
          padding:10px 16px; font-size:13px; color:#555; text-decoration:none;
        }
        .user-dropdown a:hover { background:#f8f9fc; }

        #page-content { padding:1.5rem; flex:1; }

        .stat-row { display:flex; gap:1.5rem; margin-bottom:1.5rem; flex-wrap:wrap; }
        .ta-stat {
          background:#fff; border-radius:14px; padding:1rem 1.5rem;
          display:flex; align-items:center; gap:1rem;
          border:1.5px solid #bfdbfe;
          box-shadow:0 2px 8px rgba(26,86,219,0.07); min-width:200px;
        }
        .ta-stat-icon {
          width:42px; height:42px; border-radius:10px; background:#eff6ff;
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
        }
        .ta-stat-icon i { color:#1a56db; font-size:18px; }
        .ta-stat-label { font-size:10px; font-weight:500; color:#6b8ab8; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:2px; }
        .ta-stat-num { font-family:'Playfair Display',serif; font-size:28px; color:#1e3a8a; line-height:1; }

        .main-grid { display:flex; gap:1.5rem; align-items:flex-start; }
        .col-table { flex:1 1 0; min-width:0; }
        .col-form  { width:340px; flex-shrink:0; }

        .ta-card {
          background:#fff; border-radius:14px; border:1.5px solid #bfdbfe;
          box-shadow:0 2px 8px rgba(26,86,219,0.07); overflow:hidden;
        }
        .ta-card-header { padding:1rem 1.25rem; border-bottom:1.5px solid #bfdbfe; }
        .ta-section-title {
          font-family:'Playfair Display',serif; font-size:17px; color:#1a56db; margin:0;
          border-left:4px solid #1a56db; padding-left:12px;
        }
        .ta-card-body { padding:1.25rem; }

        .ta-table { width:100%; border-collapse:collapse; font-size:13px; }
        .ta-table thead tr { background:#eff6ff; }
        .ta-table thead th {
          padding:9px 12px; color:#1e3a8a; font-weight:500; font-size:11px;
          text-transform:uppercase; letter-spacing:0.05em;
          border-bottom:1.5px solid #bfdbfe; white-space:nowrap;
        }
        .ta-table tbody tr { border-bottom:1px solid #e8f0fe; transition:background 0.15s; }
        .ta-table tbody tr:hover { background:#f5f9ff; }
        .ta-table tbody td { padding:10px 12px; color:#334155; vertical-align:middle; }
        .ta-table img { border-radius:6px; display:block; }

        .ta-badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:500; white-space:nowrap; }
        .badge-beach      { background:#e0f2fe; color:#0369a1; }
        .badge-mountain   { background:#dcfce7; color:#166534; }
        .badge-historical { background:#fef9c3; color:#854d0e; }
        .badge-park       { background:#f0fdf4; color:#15803d; }
        .badge-museum     { background:#ede9fe; color:#5b21b6; }
        .badge-festival   { background:#fff1f2; color:#9f1239; }
        .badge-other      { background:#f1f5f9; color:#475569; }

        .see-more-btn {
          background:none; border:none; padding:0; color:#1a56db;
          font-size:12px; font-weight:500; cursor:pointer; font-family:'DM Sans',sans-serif;
        }
        .see-more-btn:hover { text-decoration:underline; }

        .ta-btn-edit {
          display:block; background:#eff6ff; border:1px solid #93c5fd; color:#1a56db;
          border-radius:6px; padding:4px 12px; font-size:12px; font-weight:500;
          cursor:pointer; font-family:'DM Sans',sans-serif;
          text-decoration:none; text-align:center; margin-bottom:4px;
        }
        .ta-btn-edit:hover { background:#dbeafe; }
        .ta-btn-archive {
          display:block; background:#fff; border:1px solid #bfdbfe; color:#64748b;
          border-radius:6px; padding:4px 12px; font-size:12px; font-weight:500;
          cursor:pointer; font-family:'DM Sans',sans-serif; width:100%; text-align:center;
        }
        .ta-btn-archive:hover { background:#f1f5f9; }
        .ta-btn-primary {
          background:#1a56db; border:none; color:#fff; border-radius:8px;
          padding:8px 22px; font-size:13px; font-weight:500;
          cursor:pointer; font-family:'DM Sans',sans-serif;
        }
        .ta-btn-primary:hover { background:#1648c0; }
        .ta-btn-primary:disabled { background:#93c5fd; cursor:not-allowed; }
        .ta-btn-secondary {
          background:#fff; border:1.5px solid #bfdbfe; color:#1a56db;
          border-radius:8px; padding:8px 22px; font-size:13px; font-weight:500;
          cursor:pointer; font-family:'DM Sans',sans-serif;
        }
        .ta-btn-secondary:hover { background:#eff6ff; }
        .ta-btn-secondary:disabled { opacity:0.6; cursor:not-allowed; }

        .pagination-row { text-align:center; padding:1rem; display:flex; justify-content:center; gap:8px; }
        .no-results { text-align:center; padding:20px; color:#6b8ab8; font-size:13px; }
        .loading-row { text-align:center; padding:30px; color:#6b8ab8; font-size:13px; }

        .ta-form-label { font-size:12px; font-weight:500; color:#1e3a8a; margin-bottom:5px; display:block; }
        .ta-form-control {
          border:1.5px solid #bfdbfe; border-radius:8px; padding:8px 12px; font-size:13px;
          font-family:'DM Sans',sans-serif; width:100%; color:#334155; outline:none;
          background:#fff; transition:border-color 0.15s; display:block;
        }
        .ta-form-control:focus { border-color:#1a56db; box-shadow:0 0 0 3px rgba(26,86,219,0.08); }
        .form-group { margin-bottom:14px; }
        .no-img { color:#94a3b8; font-size:11px; }
      `}</style>

      {flash && <Flash msg={flash.msg} type={flash.type} />}

      <DescModal spot={descModal} onClose={() => setDescModal(null)} />
      {archiveTarget !== null && (
        <ArchiveModal
          loading={archiving}
          onCancel={() => setArchiveTarget(null)}
          onConfirm={() => handleArchive(archiveTarget)}
        />
      )}

      <div id="wrapper">

        {/* ── SIDEBAR ── */}
        <div id="sidebar">
          <a className="sidebar-brand" href="/dashboard">
            <span className="sidebar-brand-icon"><i className="fas fa-laugh-wink"></i></span>
            <span className="sidebar-brand-text"><em><b>TOUR_</b></em>ISTA</span>
          </a>
          <hr className="sidebar-divider" />
          <ul className="sidebar-nav">
            {NAV_ITEMS.map(({ icon, label, path }) => (
              <li key={label} className={path === "/dashboard" ? "active" : ""}>
                <a href="#" onClick={e => { e.preventDefault(); history.push(path); }}>
                  <i className={`fas fa-fw ${icon}`}></i>
                  <span>{label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* ── CONTENT WRAPPER ── */}
        <div id="content-wrapper">

          {/* Topbar */}
          <div id="topbar">
            <div className="topbar-search">
              <input
                type="text"
                placeholder="Search tourist spots..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowCount(4); }}
              />
              <button><i className="fas fa-search fa-sm"></i></button>
            </div>
            <div className="topbar-right">
              <div className="topbar-divider" />
              {/* ✅ FIXED: gumagamit na ng localStorage para sa username at avatar */}
              <div className="user-area" onClick={() => setUserDropOpen(o => !o)}>
                <span>{savedUsername}</span>
                <img src={avatarSrc} alt="avatar" />
                {userDropOpen && (
                  <div className="user-dropdown">
                    <a href="#" onClick={e => { e.preventDefault(); history.push("/login"); }}>
                      <i className="fas fa-sign-out-alt fa-sm fa-fw" style={{ color:"#aaa" }}></i>&nbsp;Logout
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Page content */}
          <div id="page-content">

            {/* Stats */}
            <div className="stat-row">
              <div className="ta-stat">
                <div className="ta-stat-icon"><i className="fas fa-users"></i></div>
                <div>
                  <div className="ta-stat-label">Total Users</div>
                  <div className="ta-stat-num">{stats.total_users}</div>
                </div>
              </div>
              <div className="ta-stat">
                <div className="ta-stat-icon"><i className="fas fa-map-marker-alt"></i></div>
                <div>
                  <div className="ta-stat-label">Tourist Spots</div>
                  <div className="ta-stat-num">{stats.tourist_spots}</div>
                </div>
              </div>
            </div>

            <div className="main-grid">

              {/* ── TABLE ── */}
              <div className="col-table">
                <div className="ta-card">
                  <div className="ta-card-header">
                    <h6 className="ta-section-title">Tourist Spots List</h6>
                  </div>
                  <div style={{ overflowX:"auto" }}>
                    <table className="ta-table">
                      <thead>
                        <tr>
                          <th>#</th><th>Spot Name</th><th>Category</th>
                          <th>Description</th><th>Location</th><th>Photo</th><th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr><td colSpan={7}>
                            <div className="loading-row">
                              <i className="fas fa-spinner fa-spin" style={{ marginRight:8 }}></i>Loading spots...
                            </div>
                          </td></tr>
                        ) : visible.length === 0 ? (
                          <tr><td colSpan={7}>
                            <div className="no-results">
                              <i className="fas fa-search" style={{ marginRight:6 }}></i>
                              {searchQuery ? "No tourist spots found matching your search." : "No tourist spots available."}
                            </div>
                          </td></tr>
                        ) : (
                          visible.map((spot, idx) => {
                            const MAX = 60;
                            const truncated  = spot.description.length > MAX;
                            const shortDesc  = truncated ? spot.description.slice(0, MAX) + "..." : spot.description;
                            const badgeCls   = getCategoryBadge(spot.category);
                            const catLabel   = getCategoryLabel(spot.category);
                            return (
                              <tr key={spot.spot_id}>
                                <td style={{ color:"#6b8ab8", fontWeight:500 }}>{idx + 1}</td>
                                <td style={{ fontWeight:500, color:"#1e3a8a" }}>{spot.spot_name}</td>
                                <td>
                                  <span className={`ta-badge ${badgeCls}`}>{catLabel}</span>
                                </td>
                                <td>
                                  {shortDesc}
                                  {truncated && (
                                    <> <button className="see-more-btn" onClick={() => setDescModal(spot)}>See more</button></>
                                  )}
                                </td>
                                <td>{spot.location}</td>
                                <td>
                                  {spot.spot_image
                                    ? <img src={spot.spot_image} width={70} alt={spot.spot_name} />
                                    : <span className="no-img">No image</span>
                                  }
                                </td>
                                <td style={{ minWidth:90 }}>
                                  <a
                                    href="#"
                                    className="ta-btn-edit"
                                    onClick={e => { e.preventDefault(); history.push(`/edit/${spot.spot_id}`); }}
                                  >Edit</a>
                                  <button
                                    className="ta-btn-archive"
                                    onClick={() => setArchiveTarget(spot.spot_id)}
                                  >Archive</button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>

                    {!loading && (canSeeMore || canMin) && (
                      <div className="pagination-row">
                        {canSeeMore && (
                          <button className="ta-btn-primary" onClick={() => setShowCount(c => c + 4)}>See More</button>
                        )}
                        {canMin && (
                          <button className="ta-btn-secondary" onClick={() => setShowCount(4)}>Minimize</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── FORM ── */}
              <div className="col-form">
                <div className="ta-card">
                  <div className="ta-card-header">
                    <h6 className="ta-section-title">Add Tourist Spot</h6>
                  </div>
                  <div className="ta-card-body">
                    <form onSubmit={handleAdd}>
                      <div className="form-group">
                        <label className="ta-form-label">Tourist Spot Name</label>
                        <input type="text" className="ta-form-control"
                          value={form.spot_name}
                          onChange={e => setForm(f => ({ ...f, spot_name: e.target.value }))}
                          required disabled={submitting} />
                      </div>
                      <div className="form-group">
                        <label className="ta-form-label">Category</label>
                        <select className="ta-form-control"
                          value={form.category}
                          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                          required disabled={submitting}>
                          <option value="" disabled>Select a category</option>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="ta-form-label">Description</label>
                        <textarea className="ta-form-control" rows={3}
                          value={form.description}
                          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                          required disabled={submitting} />
                      </div>
                      <div className="form-group">
                        <label className="ta-form-label">Address / Location</label>
                        <input type="text" className="ta-form-control"
                          placeholder="Tourist Spot Address"
                          value={form.location}
                          onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                          required disabled={submitting} />
                      </div>
                      <div className="form-group">
                        <label className="ta-form-label">Upload Photo</label>
                        <input id="fileInput" type="file" className="ta-form-control"
                          accept="image/*"
                          onChange={e => setForm(f => ({ ...f, spot_image: e.target.files?.[0] ?? null }))}
                          disabled={submitting} />
                      </div>
                      <button type="submit" className="ta-btn-primary"
                        style={{ width:"100%" }} disabled={submitting}>
                        {submitting
                          ? <><i className="fas fa-spinner fa-spin" style={{ marginRight:6 }}></i>Adding...</>
                          : <><i className="fas fa-plus" style={{ marginRight:6 }}></i>Add Tourist Spot</>
                        }
                      </button>
                    </form>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}