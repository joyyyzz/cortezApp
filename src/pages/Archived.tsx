import { useState, useEffect, useRef } from "react";
import { useHistory } from "react-router-dom";
import { CapacitorHttp } from "@capacitor/core";
import { Capacitor } from "@capacitor/core";
import AppLayout from "../components/AppLayout";

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE_UPLOADS         = "https://itservicesph.com/IT383/CORTEZ/Cortez/uploads/profile/";
const BASE_SPOT_UPLOADS    = "https://itservicesph.com/IT383/CORTEZ/Cortez/uploads/";
const API_BASE             = "https://itservicesph.com/IT383/CORTEZ/Cortez/index.php/API_archived";

// ─── Types ────────────────────────────────────────────────────────────────────
interface APIResponse {
  status: string;
  total_users: number;
  tourist_spots: number;
  archived_count: number;
  archived_spots: APISpot[];
}

interface APISpot {
  spot_id: string;
  spot_name: string;
  description: string;
  location: string;
  spot_image: string;
  date_added: string;
  status: string;
  category: string;
}

interface ArchivedSpot {
  spot_id: number;
  spot_name: string;
  category: string;
  location: string;
  description: string;
  spot_image?: string;
  date_added?: string;
}

interface ArchivedProps {
  username?: string;
  profile_photo?: string;
  spotsEndpoint?: string;
  unarchiveEndpoint?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normaliseSpot(s: APISpot): ArchivedSpot {
  return {
    spot_id:    parseInt(s.spot_id, 10),
    spot_name:  s.spot_name,
    category:   s.category,
    location:   s.location,
    description:s.description,
    spot_image: s.spot_image || undefined,
    date_added: s.date_added,
  };
}

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

function cleanPhoto(p: string | null | undefined): string | null {
  if (!p) return null;
  return p.includes("http") ? p.split("/").pop() ?? null : p;
}

// ─── Unarchive Modal ──────────────────────────────────────────────────────────
function UnarchiveModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1040 }} onClick={onCancel} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 1050, width: 340 }}>
        <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #bfdbfe", padding: "2rem 1.5rem", textAlign: "center" }}>
          <div style={{ fontSize: 38, color: "#1a56db", marginBottom: 10 }}>
            <i className="fas fa-question-circle"></i>
          </div>
          <h5 style={{ fontFamily: "'Playfair Display',serif", color: "#1a56db", marginBottom: 8, fontSize: 18 }}>
            Unarchive this spot?
          </h5>
          <p style={{ color: "#475569", fontSize: 13, marginBottom: 20 }}>
            This tourist spot will be moved back to the active list.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button className="ta-btn-primary" onClick={onConfirm}>Yes, Unarchive it!</button>
            <button className="ta-btn-secondary" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Flash Alert ──────────────────────────────────────────────────────────────
function FlashAlert({ message, type }: { message: string; type: "success" | "info" | "danger" }) {
  const icons   = { success: "fa-check-circle", info: "fa-info-circle", danger: "fa-exclamation-circle" };
  const styles: Record<string, React.CSSProperties> = {
    success: { background: "#f0fdf4", border: "1px solid #86efac", color: "#166534" },
    info:    { background: "#eff6ff", border: "1px solid #93c5fd", color: "#1e3a8a" },
    danger:  { background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b" },
  };
  return (
    <div style={{
      position: "fixed", top: "1rem", right: "1rem", zIndex: 9999, minWidth: 260,
      borderRadius: 10, padding: "10px 16px", fontSize: 13, fontFamily: "'DM Sans',sans-serif",
      ...styles[type],
    }}>
      <i className={`fas ${icons[type]}`} style={{ marginRight: 6 }}></i>{message}
    </div>
  );
}

// ─── Archived Page ────────────────────────────────────────────────────────────
export default function Archived({
  username = "Admin",
  profile_photo,
  spotsEndpoint,
  unarchiveEndpoint,
}: ArchivedProps) {

  const history = useHistory();

  // ── Sidebar mobile state ──
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const [spots, setSpots]                     = useState<ArchivedSpot[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState<string | null>(null);
  const [searchQuery, setSearchQuery]         = useState("");
  const [userDropOpen, setUserDropOpen]       = useState(false);
  const [unarchiveTarget, setUnarchiveTarget] = useState<number | null>(null);
  const [flash, setFlash]                     = useState<{ message: string; type: "success" | "info" | "danger" } | null>(null);
  const userAreaRef                           = useRef<HTMLDivElement>(null);

  const savedPhoto    = localStorage.getItem("profile_photo");
  const savedUsername = localStorage.getItem("username") ?? username;
  const resolvedPhoto = cleanPhoto(profile_photo) ?? cleanPhoto(savedPhoto);
  const avatarSrc     = resolvedPhoto
    ? `${BASE_UPLOADS}${resolvedPhoto}`
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(savedUsername)}&background=1a56db&color=fff`;

  useEffect(() => {
    const url = spotsEndpoint ?? API_BASE;
    setLoading(true);
    setError(null);

    const doFetch = async () => {
      try {
        let data: APIResponse;
        if (Capacitor.isNativePlatform()) {
          const response = await CapacitorHttp.get({
            url,
            headers: { "Accept": "application/json" },
          });
          data = response.data as APIResponse;
        } else {
          const r = await fetch(url, { credentials: "include" });
          if (!r.ok) throw new Error(`Failed to load archived spots (${r.status})`);
          data = await r.json() as APIResponse;
        }
        const raw: APISpot[] = data.archived_spots ?? [];
        setSpots(raw.map(normaliseSpot));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    doFetch();
  }, [spotsEndpoint]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (userAreaRef.current && !userAreaRef.current.contains(e.target as Node))
        setUserDropOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(t);
  }, [flash]);

  const q = searchQuery.toLowerCase().trim();
  const filtered = q
    ? spots.filter(s =>
        s.spot_name.toLowerCase().includes(q)   ||
        s.category.toLowerCase().includes(q)    ||
        s.location.toLowerCase().includes(q)    ||
        s.description.toLowerCase().includes(q)
      )
    : spots;

  async function handleUnarchive(id: number) {
    setUnarchiveTarget(null);
    const url = unarchiveEndpoint ?? `${API_BASE}/unarchive`;

    try {
      const body = new URLSearchParams({ spot_id: String(id) });
      if (Capacitor.isNativePlatform()) {
        await CapacitorHttp.post({
          url,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          data: `spot_id=${id}`,
        });
      } else {
        const res = await fetch(url, { method: "POST", body });
        if (!res.ok) throw new Error(`Unarchive failed (${res.status})`);
      }
    } catch (e: unknown) {
      setFlash({ message: (e as Error).message, type: "danger" });
      return;
    }

    setSpots(prev => prev.filter(s => s.spot_id !== id));
    setFlash({ message: "Tourist spot moved back to active list.", type: "success" });
  }

  const NAV_ITEMS = [
    { icon: "fa-tachometer-alt", label: "Dashboard", path: "/dashboard"   },
    { icon: "fa-users",          label: "Users",     path: "/users"        },
    { icon: "fa-user",           label: "Profile",   path: "/profileadmin" },
    { icon: "fa-map",            label: "Map",       path: "/mapadmin"     },
    { icon: "fa-archive",        label: "Archived",  path: "/archived"     },
  ];

  return (
    <AppLayout isMobileOpen={isMobileOpen} onMobileToggle={() => setIsMobileOpen(o => !o)}>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@400;500&display=swap');

        *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
        html,body,#root { height:100%; overflow:hidden; }
        body { font-family:'DM Sans',sans-serif; background:#f8f9fc; }

        #wrapper { display:flex; height:100vh; overflow:hidden; }

        #sidebar {
          width:225px; min-width:225px;
          background:linear-gradient(180deg,#4e73df 10%,#224abe 100%);
          display:flex; flex-direction:column;
          height:100vh; position:fixed; top:0; left:0; flex-shrink:0; z-index:100;
        }
        .sidebar-brand { display:flex; align-items:center; gap:10px; padding:1.25rem 1rem; color:#fff; text-decoration:none; }
        .sidebar-brand-icon { font-size:22px; transform:rotate(-15deg); display:inline-block; }
        .sidebar-brand-text { font-size:17px; font-weight:700; }
        hr.sidebar-divider { border:none; border-top:1px solid rgba(255,255,255,0.15); margin:0 1rem; }
        .sidebar-nav { list-style:none; padding:0; flex:1; }
        .sidebar-nav li a {
          display:flex; align-items:center; gap:10px; padding:12px 20px;
          color:rgba(255,255,255,0.75); font-size:13.5px; font-weight:500;
          text-decoration:none; transition:background 0.15s, color 0.15s;
        }
        .sidebar-nav li a:hover,
        .sidebar-nav li.active a { background:rgba(255,255,255,0.12); color:#fff; }
        .sidebar-nav li a i { width:18px; text-align:center; font-size:14px; }

        #content-wrapper {
          flex:1; display:flex; flex-direction:column;
          height:100vh; overflow-y:auto; overflow-x:hidden;
          scrollbar-width:thin; scrollbar-color:#bfdbfe #f1f5f9;
        }
        #content-wrapper::-webkit-scrollbar { width:8px; }
        #content-wrapper::-webkit-scrollbar-track { background:#f1f5f9; }
        #content-wrapper::-webkit-scrollbar-thumb { background:#bfdbfe; border-radius:4px; }
        #content-wrapper::-webkit-scrollbar-thumb:hover { background:#93c5fd; }

        #topbar {
          height:65px; flex-shrink:0;
          background:#fff; box-shadow:0 2px 4px rgba(0,0,0,0.08);
          display:flex; align-items:center; padding:0 1.5rem; gap:1rem;
          position:sticky; top:0; z-index:99;
        }

        /* ── Hamburger ── */
        .hamburger-btn { display:none; background:none; border:none; cursor:pointer; padding:6px 8px; color:#4e73df; font-size:20px; border-radius:6px; line-height:1; flex-shrink:0; }
        @media(max-width:768px) { .hamburger-btn { display:flex; align-items:center; justify-content:center; } }

        .topbar-search { display:flex; }
        .topbar-search input {
          border:1px solid #d1d3e2; border-right:none; border-radius:5px 0 0 5px;
          padding:7px 14px; font-size:13px; font-family:'DM Sans',sans-serif;
          background:#f8f9fc; color:#333; width:280px; outline:none;
        }
        .topbar-search button { background:#4e73df; border:none; border-radius:0 5px 5px 0; padding:7px 14px; color:#fff; cursor:pointer; }
        .topbar-right { display:flex; align-items:center; gap:1rem; margin-left:auto; }
        .topbar-divider { border-left:1px solid #e3e6f0; height:36px; }
        .user-area { display:flex; align-items:center; gap:8px; cursor:pointer; position:relative; }
        .user-area > span { font-size:13px; font-weight:600; color:#333; }
        .user-area img { width:32px; height:32px; border-radius:50%; object-fit:cover; }
        .user-dropdown {
          position:absolute; top:calc(100% + 10px); right:0; background:#fff;
          border:1px solid #e3e6f0; border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,0.1);
          min-width:160px; z-index:200;
        }
        .user-dropdown a { display:flex; align-items:center; gap:8px; padding:10px 16px; font-size:13px; color:#555; text-decoration:none; }
        .user-dropdown a:hover { background:#f8f9fc; }

        #page-content { flex:1; padding:1.5rem; }

        .ta-stat {
          background:#fff; border-radius:16px; padding:1.1rem 1.5rem;
          display:inline-flex; align-items:center; gap:1rem;
          border:1.5px solid #bfdbfe; margin-bottom:1.5rem;
          box-shadow:0 2px 8px rgba(26,86,219,0.07); width:100%;
        }
        .ta-stat-icon { width:44px; height:44px; border-radius:12px; background:#eff6ff; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ta-stat-icon i { color:#1a56db; font-size:20px; }
        .ta-stat-label { font-size:11px; font-weight:500; color:#6b8ab8; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:2px; }
        .ta-stat-num { font-family:'Playfair Display',serif; font-size:28px; color:#1e3a8a; line-height:1; }

        .ta-card { background:#fff; border-radius:14px; border:1.5px solid #bfdbfe; box-shadow:0 2px 8px rgba(26,86,219,0.07); overflow:hidden; }
        .ta-card-header { padding:1rem 1.25rem; border-bottom:1.5px solid #bfdbfe; display:flex; align-items:center; justify-content:space-between; }
        .ta-section-title { font-family:'Playfair Display',serif; font-size:17px; color:#1a56db; margin:0; border-left:4px solid #1a56db; padding-left:12px; }
        .ta-card-header-meta { font-size:12px; color:#6b8ab8; }
        .ta-card-body { padding:1.25rem; overflow-x:auto; }

        .ta-table { width:100%; font-size:13px; border-collapse:collapse; }
        .ta-table thead tr { background:#eff6ff; }
        .ta-table thead th {
          padding:10px 12px; color:#1e3a8a; font-weight:500; font-size:12px;
          text-transform:uppercase; letter-spacing:0.05em;
          border-bottom:1.5px solid #bfdbfe; white-space:nowrap;
        }
        .ta-table tbody tr { border-bottom:1px solid #e8f0fe; transition:background 0.15s; }
        .ta-table tbody tr:hover { background:#f5f9ff; }
        .ta-table tbody td { padding:10px 12px; color:#334155; vertical-align:middle; }
        .ta-table img { border-radius:8px; display:block; }

        .ta-badge-category { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:500; letter-spacing:0.03em; white-space:nowrap; }
        .badge-beach      { background:#e0f2fe; color:#0369a1; }
        .badge-mountain   { background:#dcfce7; color:#166534; }
        .badge-historical { background:#fef9c3; color:#854d0e; }
        .badge-park       { background:#f0fdf4; color:#15803d; }
        .badge-museum     { background:#ede9fe; color:#5b21b6; }
        .badge-festival   { background:#fff1f2; color:#9f1239; }
        .badge-other      { background:#f1f5f9; color:#475569; }

        .ta-btn-unarchive {
          background:#f0fdf4; border:1px solid #86efac; color:#166534;
          border-radius:7px; padding:4px 12px; font-size:12px; font-weight:500;
          cursor:pointer; font-family:'DM Sans',sans-serif;
        }
        .ta-btn-unarchive:hover { background:#dcfce7; }
        .ta-btn-primary { background:#1a56db; border:none; color:#fff; border-radius:8px; padding:8px 22px; font-size:13px; font-weight:500; cursor:pointer; font-family:'DM Sans',sans-serif; }
        .ta-btn-primary:hover { background:#1648c0; }
        .ta-btn-secondary { background:#fff; border:1.5px solid #bfdbfe; color:#1a56db; border-radius:8px; padding:8px 22px; font-size:13px; font-weight:500; cursor:pointer; font-family:'DM Sans',sans-serif; }
        .ta-btn-secondary:hover { background:#eff6ff; }

        .ta-empty { text-align:center; padding:3rem 1rem; color:#6b8ab8; font-size:15px; }
        .ta-empty i { font-size:48px; color:#bfdbfe; display:block; margin-bottom:1rem; }
        .no-results { text-align:center; padding:20px; color:#6b8ab8; font-size:13px; }

        .state-center { display:flex; align-items:center; justify-content:center; padding:3rem; gap:8px; color:#6b8ab8; font-size:14px; }
        .map-error { background:#fef2f2; border:1px solid #fca5a5; color:#b91c1c; border-radius:8px; padding:12px 16px; font-size:13px; }
        .no-img { color:#94a3b8; font-size:12px; }

        @media(max-width:768px){
          .topbar-search input { width:150px; }
        }
      `}</style>

      {flash && <FlashAlert message={flash.message} type={flash.type} />}

      {unarchiveTarget !== null && (
        <UnarchiveModal
          onCancel={() => setUnarchiveTarget(null)}
          onConfirm={() => handleUnarchive(unarchiveTarget)}
        />
      )}

      <div id="wrapper">

        {/* ── SIDEBAR ── */}
        <div id="sidebar" className={isMobileOpen ? "mobile-open" : ""}>
          <a className="sidebar-brand" href="/dashboard">
            <span className="sidebar-brand-icon"><i className="fas fa-laugh-wink"></i></span>
            <span className="sidebar-brand-text"><em><b>TOUR_</b></em>ISTA</span>
          </a>
          <hr className="sidebar-divider" />
          <ul className="sidebar-nav">
            {NAV_ITEMS.map(({ icon, label, path }) => (
              <li key={label} className={path === "/archived" ? "active" : ""}>
                <a href="#" onClick={e => {
                  e.preventDefault();
                  setIsMobileOpen(false);
                  history.push(path);
                }}>
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
            {/* ── Hamburger ── */}
            <button
              className="hamburger-btn"
              onClick={() => setIsMobileOpen(o => !o)}
              aria-label="Toggle sidebar"
            >
              <i className={`fas ${isMobileOpen ? "fa-times" : "fa-bars"}`}></i>
            </button>

            <div className="topbar-search">
              <input
                type="text"
                placeholder="Search archived spots..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <button type="button"><i className="fas fa-search fa-sm"></i></button>
            </div>
            <div className="topbar-right">
              <div className="topbar-divider" />
              <div className="user-area" ref={userAreaRef} onClick={() => setUserDropOpen(o => !o)}>
                <span>{savedUsername}</span>
                <img src={avatarSrc} alt="avatar" />
                {userDropOpen && (
                  <div className="user-dropdown">
                    <a href="#" onClick={e => { e.preventDefault(); history.push("/login"); }}>
                      <i className="fas fa-sign-out-alt fa-sm fa-fw" style={{ color: "#aaa" }}></i>
                      Logout
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Page content */}
          <div id="page-content">

            <div style={{ maxWidth: 280 }}>
              <div className="ta-stat">
                <div className="ta-stat-icon"><i className="fas fa-archive"></i></div>
                <div>
                  <div className="ta-stat-label">Archived Spots</div>
                  <div className="ta-stat-num">{spots.length}</div>
                </div>
              </div>
            </div>

            <div className="ta-card">
              <div className="ta-card-header">
                <h6 className="ta-section-title">Archived Tourist Spots</h6>
                <span className="ta-card-header-meta">
                  <i className="fas fa-archive" style={{ marginRight: 4 }}></i>
                  {spots.length > 0 ? `${spots.length} spot(s) archived` : "No archived spots"}
                </span>
              </div>
              <div className="ta-card-body">

                {loading && (
                  <div className="state-center">
                    <i className="fas fa-spinner fa-spin"></i> Loading archived spots…
                  </div>
                )}

                {error && (
                  <div className="map-error">
                    <i className="fas fa-exclamation-circle" style={{ marginRight: 6 }}></i>{error}
                  </div>
                )}

                {!loading && !error && spots.length === 0 && (
                  <div className="ta-empty">
                    <i className="fas fa-archive"></i>
                    No archived tourist spots found.
                  </div>
                )}

                {!loading && !error && spots.length > 0 && (
                  <table className="ta-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Spot Name</th>
                        <th>Category</th>
                        <th>Location</th>
                        <th>Description</th>
                        <th>Image</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={7}>
                            <div className="no-results">
                              <i className="fas fa-search" style={{ marginRight: 6 }}></i>
                              No archived spots found matching your search.
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filtered.map((spot, idx) => {
                          const shortDesc = spot.description.length > 80
                            ? spot.description.slice(0, 80) + "..."
                            : spot.description;

                          return (
                            <tr key={spot.spot_id}>
                              <td style={{ color: "#6b8ab8", fontWeight: 500 }}>{idx + 1}</td>
                              <td style={{ fontWeight: 500, color: "#1e3a8a" }}>{spot.spot_name}</td>
                              <td>
                                <span className={`ta-badge-category ${getBadgeClass(spot.category)}`}>
                                  {spot.category}
                                </span>
                              </td>
                              <td>{spot.location}</td>
                              <td style={{ maxWidth: 220, color: "#475569" }}>{shortDesc}</td>
                              <td>
                                {spot.spot_image
                                  ? (
                                    <img
                                      src={`${BASE_SPOT_UPLOADS}${spot.spot_image}`}
                                      alt={spot.spot_name}
                                      width={80}
                                    />
                                  )
                                  : <span className="no-img">No image</span>
                                }
                              </td>
                              <td>
                                <button
                                  className="ta-btn-unarchive"
                                  onClick={() => setUnarchiveTarget(spot.spot_id)}
                                >
                                  <i className="fas fa-undo" style={{ marginRight: 4 }}></i>Unarchive
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}

              </div>
            </div>

          </div>
        </div>
      </div>
    </AppLayout>
  );
}