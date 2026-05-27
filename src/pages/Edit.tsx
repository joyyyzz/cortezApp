import { useState, useEffect } from "react";
import { useHistory, useLocation, useParams } from "react-router-dom";
import { CapacitorHttp } from "@capacitor/core";
import { Capacitor } from "@capacitor/core";

// ─── API Base ────────────────────────────────────────────────────────────────
const API_BASE = "https://itservicesph.com/IT383/CORTEZ/Cortez/index.php/API_main";

const CI3_ORIGIN = "https://itservicesph.com";
const APP_PATH   = "/IT383/CORTEZ/Cortez";
const UPLOADS    = `${CI3_ORIGIN}${APP_PATH}/uploads/profile/`;

// ─── Types ───────────────────────────────────────────────────────────────────
interface EditProps {
  username?:      string;
  profile_photo?: string;
}

interface SessionUser {
  username:      string;
  profile_photo: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  "Beach",
  "Mountain",
  "Historical / Heritage",
  "Park / Nature",
  "Museum",
  "Festival / Event",
  "Other",
];

const NAV_ITEMS = [
  { icon: "fa-tachometer-alt", label: "Dashboard", path: "/dashboard"   },
  { icon: "fa-users",          label: "Users",     path: "/users"        },
  { icon: "fa-user",           label: "Profile",   path: "/profileadmin" },
  { icon: "fa-map",            label: "Map",       path: "/mapadmin"     },
  { icon: "fa-archive",        label: "Archived",  path: "/archived"     },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const AVATAR_URL = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a56db&color=fff`;

function cleanPhoto(p: string | null | undefined): string | null {
  if (!p) return null;
  return p.includes("http") ? p.split("/").pop() ?? null : p;
}

function isApiSuccess(json: any): boolean {
  if (typeof json.success === "boolean") return json.success;
  return json.status === "success";
}

function getApiError(json: any): string {
  return json.error ?? json.message ?? "Unknown error";
}

// ─── Edit Page ───────────────────────────────────────────────────────────────
export default function Edit({
  username:      propUsername      = "",
  profile_photo: propProfilePhoto,
}: EditProps) {

  const { id }   = useParams<{ id: string }>();
  const history  = useHistory();
  const location = useLocation();

  // ── Session / avatar — mirrors Users.tsx exactly ─────────────────────────
  const savedPhoto    = localStorage.getItem("profile_photo");
  const savedUsername = localStorage.getItem("username") ?? propUsername;

  const [sessionUser, setSessionUser] = useState<SessionUser>({
    username:      savedUsername,
    profile_photo: savedPhoto,
  });

  const resolvedPhoto = cleanPhoto(sessionUser.profile_photo) ?? cleanPhoto(savedPhoto);
  const avatarSrc = resolvedPhoto
    ? `${UPLOADS}${resolvedPhoto}`
    : AVATAR_URL(sessionUser.username || savedUsername);

  const [userDropOpen, setUserDropOpen] = useState(false);
  const [flash, setFlash] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<{ total_users: number; tourist_spots: number } | null>(null);

  // ── Form state ────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    spot_name:   "",
    category:    "",
    description: "",
    location:    "",
    spot_image:  null as File | null,
  });
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // ── Fetch stats ───────────────────────────────────────────────────────────
  useEffect(() => {
    const doStats = async () => {
      try {
        let json: any;
        if (Capacitor.isNativePlatform()) {
          const response = await CapacitorHttp.get({
            url: `${API_BASE}/stats`,
            headers: { "Accept": "application/json" },
          });
          json = response.data;
        } else {
          const r = await fetch(`${API_BASE}/stats`, { credentials: "include" });
          json = await r.json();
        }
        if (isApiSuccess(json) && json.data) {
          setStats({
            total_users:   Number(json.data.total_users   ?? 0),
            tourist_spots: Number(json.data.tourist_spots ?? 0),
          });
        }
      } catch (err) {
        console.error("[Edit] stats fetch error:", err);
      }
    };
    doStats();
  }, []);

  // ── Fetch spot data ───────────────────────────────────────────────────────
  useEffect(() => {
    const doFetch = async () => {
      try {
        let json: any;
        if (Capacitor.isNativePlatform()) {
          const response = await CapacitorHttp.get({
            url: `${API_BASE}/spots/${id}`,
            headers: { "Accept": "application/json" },
          });
          json = response.data;
        } else {
          const r = await fetch(`${API_BASE}/spots/${id}`, { credentials: "include" });
          if (!r.ok) {
            const text = await r.text();
            throw new Error(`Server returned ${r.status}: ${text.slice(0, 120)}`);
          }
          json = await r.json();
        }
        if (isApiSuccess(json) && json.data) {
          const s = json.data;
          setForm({
            spot_name:   s.spot_name   ?? "",
            category:    typeof s.category === "object" ? (s.category.value ?? "") : (s.category ?? ""),
            description: s.description ?? "",
            location:    s.location    ?? "",
            spot_image:  null,
          });
          setCurrentImage(
            s.image_url
              ? s.image_url
              : s.spot_image
                ? `https://itservicesph.com/IT383/CORTEZ/Cortez/uploads/${s.spot_image}`
                : null
          );
        } else {
          setFlash({ msg: getApiError(json), type: "error" });
        }
      } catch (err: any) {
        console.error("[Edit] fetch error:", err.message);
        setFlash({ msg: `Could not load spot #${id}. (${err.message.slice(0, 80)})`, type: "error" });
      } finally {
        setLoading(false);
      }
    };
    doFetch();
  }, [id]);

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFlash(null);

    const fd = new FormData();
    fd.append("spot_id",     id);
    fd.append("spot_name",   form.spot_name);
    fd.append("category",    form.category);
    fd.append("description", form.description);
    fd.append("location",    form.location);
    if (form.spot_image) fd.append("spot_image", form.spot_image);

    try {
      const res = await fetch(`${API_BASE}/update/${id}`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`Non-JSON response: ${text.slice(0, 120)}`);
      }

      if (!isApiSuccess(json)) throw new Error(getApiError(json));

      setFlash({ msg: "Tourist spot updated successfully!", type: "success" });
      setTimeout(() => history.push("/dashboard"), 1500);
    } catch (err: any) {
      console.error("[Edit] submit error:", err.message);
      setFlash({ msg: err.message, type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

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
          width:225px; min-width:225px; flex-shrink:0;
          background:linear-gradient(180deg,#4e73df 10%,#224abe 100%);
          display:flex; flex-direction:column;
          height:100vh; position:fixed; top:0; left:0; z-index:100;
        }
        .sidebar-brand { display:flex; align-items:center; gap:10px; padding:1.25rem 1rem; color:#fff; text-decoration:none; }
        .sidebar-brand-icon { font-size:22px; transform:rotate(-15deg); display:inline-block; }
        .sidebar-brand-text { font-size:17px; font-weight:700; }
        hr.sidebar-divider { border:none; border-top:1px solid rgba(255,255,255,0.15); margin:0 1rem; }
        .sidebar-nav { list-style:none; padding:0; flex:1; }
        .sidebar-nav li a { display:flex; align-items:center; gap:10px; padding:12px 20px; color:rgba(255,255,255,0.75); font-size:13.5px; font-weight:500; text-decoration:none; transition:background 0.15s,color 0.15s; }
        .sidebar-nav li a:hover,.sidebar-nav li.active a { background:rgba(255,255,255,0.12); color:#fff; }
        .sidebar-nav li a i { width:18px; text-align:center; font-size:14px; }

        #content-wrapper {
          margin-left:225px; flex:1; display:flex; flex-direction:column;
          height:100vh; overflow-y:auto; overflow-x:hidden;
          scrollbar-width:thin; scrollbar-color:#bfdbfe #f1f5f9;
        }
        #content-wrapper::-webkit-scrollbar { width:8px; }
        #content-wrapper::-webkit-scrollbar-track { background:#f1f5f9; }
        #content-wrapper::-webkit-scrollbar-thumb { background:#bfdbfe; border-radius:4px; }
        #content-wrapper::-webkit-scrollbar-thumb:hover { background:#93c5fd; }

        #topbar {
          height:65px; background:#fff; box-shadow:0 2px 4px rgba(0,0,0,0.08);
          display:flex; align-items:center; padding:0 1.5rem; gap:1rem;
          position:sticky; top:0; z-index:99; flex-shrink:0;
        }
        .topbar-search { display:flex; }
        .topbar-search input { border:1px solid #d1d3e2; border-right:none; border-radius:5px 0 0 5px; padding:7px 14px; font-size:13px; font-family:'DM Sans',sans-serif; background:#f8f9fc; color:#333; width:240px; outline:none; }
        .topbar-search button { background:#4e73df; border:none; border-radius:0 5px 5px 0; padding:7px 14px; color:#fff; cursor:pointer; }
        .topbar-right { display:flex; align-items:center; gap:1rem; margin-left:auto; }
        .topbar-divider { border-left:1px solid #e3e6f0; height:36px; }

        /* ── Avatar / user-area — same as Users.tsx ── */
        .user-area { display:flex; align-items:center; gap:8px; cursor:pointer; position:relative; user-select:none; }
        .user-area span { font-size:13px; font-weight:600; color:#333; }
        .user-area img { width:32px; height:32px; border-radius:50%; object-fit:cover; border:2px solid #bfdbfe; }
        .user-dropdown { position:absolute; top:calc(100% + 10px); right:0; background:#fff; border:1px solid #e3e6f0; border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,0.1); min-width:160px; z-index:200; }
        .user-dropdown a { display:flex; align-items:center; gap:8px; padding:10px 16px; font-size:13px; color:#555; text-decoration:none; }
        .user-dropdown a:hover { background:#f8f9fc; }

        #page-content { padding:1.5rem; flex:1; }

        .ta-alert-success { background:#f0fdf4; border:1px solid #86efac; color:#166534; border-radius:10px; padding:10px 16px; margin-bottom:1rem; font-size:13px; display:flex; align-items:flex-start; gap:8px; }
        .ta-alert-error   { background:#fef2f2; border:1px solid #fca5a5; color:#991b1b; border-radius:10px; padding:10px 16px; margin-bottom:1rem; font-size:13px; display:flex; align-items:flex-start; gap:8px; }

        .stat-row { display:flex; gap:1.5rem; margin-bottom:1.5rem; flex-wrap:wrap; }
        .ta-stat { background:#fff; border-radius:16px; padding:1.1rem 1.5rem; display:inline-flex; align-items:center; gap:1rem; border:1.5px solid #bfdbfe; box-shadow:0 2px 8px rgba(26,86,219,0.07); min-width:200px; }
        .ta-stat-icon { width:44px; height:44px; border-radius:12px; background:#eff6ff; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ta-stat-icon i { color:#1a56db; font-size:20px; }
        .ta-stat-label { font-size:11px; font-weight:500; color:#6b8ab8; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:2px; }
        .ta-stat-num { font-family:'Playfair Display',serif; font-size:28px; color:#1e3a8a; line-height:1; }
        .ta-stat-loading { font-family:'Playfair Display',serif; font-size:28px; color:#bfdbfe; line-height:1; }

        .ta-card-section { background:#fff; border-radius:16px; border:1.5px solid #bfdbfe; box-shadow:0 2px 8px rgba(26,86,219,0.07); margin-bottom:1.5rem; overflow:hidden; max-width:780px; }
        .ta-card-header { background:#fff; border-bottom:1.5px solid #bfdbfe; padding:1rem 1.25rem; }
        .ta-section-title { font-family:'Playfair Display',serif; font-size:18px; color:#1a56db; margin:0; border-left:4px solid #1a56db; padding-left:12px; }
        .ta-card-body { padding:1.5rem; background:#fff; }

        .ta-form-label { font-size:12px; font-weight:500; color:#1e3a8a; margin-bottom:5px; display:block; }
        .ta-form-control { border:1.5px solid #bfdbfe; border-radius:8px; padding:9px 12px; font-size:13px; font-family:'DM Sans',sans-serif; width:100%; color:#334155; outline:none; transition:border-color 0.15s,box-shadow 0.15s; background:#fff; display:block; }
        .ta-form-control:focus { border-color:#1a56db; box-shadow:0 0 0 3px rgba(26,86,219,0.08); }
        .ta-form-hint { font-size:11px; color:#94a3b8; margin-top:4px; }
        .mb-3 { margin-bottom:14px; }
        .mb-4 { margin-bottom:1.5rem; }

        .ta-img-preview { border-radius:8px; display:block; margin-bottom:4px; }
        .ta-img-label { font-size:11px; color:#6b8ab8; margin-bottom:8px; }

        .ta-btn-primary { background:#1a56db; border:none; color:#fff; border-radius:8px; padding:10px; font-size:13px; font-weight:500; cursor:pointer; font-family:'DM Sans',sans-serif; transition:background 0.15s; display:inline-flex; align-items:center; justify-content:center; gap:6px; flex:1; }
        .ta-btn-primary:hover { background:#1648c0; }
        .ta-btn-primary:disabled { background:#93c5fd; cursor:not-allowed; }
        .ta-btn-cancel { background:#fff; border:1.5px solid #bfdbfe; color:#1a56db; border-radius:8px; padding:10px; font-size:13px; font-weight:500; cursor:pointer; font-family:'DM Sans',sans-serif; display:inline-flex; align-items:center; justify-content:center; gap:6px; flex:1; transition:background 0.15s; }
        .ta-btn-cancel:hover { background:#eff6ff; color:#1e3a8a; }
        .ta-btn-cancel:disabled { opacity:0.5; cursor:not-allowed; }

        .ta-loading { text-align:center; padding:2.5rem 0; color:#6b8ab8; font-size:14px; }
        .ta-loading i { font-size:28px; margin-bottom:8px; display:block; color:#1a56db; animation:spin 1s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }

        .ta-debug-box { background:#fafafa; border:1px dashed #e2e8f0; border-radius:8px; padding:12px 14px; margin-top:12px; font-size:11px; color:#64748b; font-family:monospace; word-break:break-all; }
      `}</style>

      <div id="wrapper">

        {/* SIDEBAR */}
        <div id="sidebar">
          <a className="sidebar-brand" href="#" onClick={(e) => { e.preventDefault(); history.push("/dashboard"); }}>
            <span className="sidebar-brand-icon"><i className="fas fa-laugh-wink"></i></span>
            <span className="sidebar-brand-text"><em><b>TOUR_</b></em>ISTA</span>
          </a>
          <hr className="sidebar-divider" />
          <ul className="sidebar-nav">
            {NAV_ITEMS.map(({ icon, label, path }) => (
              <li key={label} className={location.pathname === path ? "active" : ""}>
                <a href="#" onClick={(e) => { e.preventDefault(); history.push(path); }}>
                  <i className={`fas fa-fw ${icon}`}></i>
                  <span>{label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* CONTENT WRAPPER */}
        <div id="content-wrapper">

          {/* Topbar */}
          <div id="topbar">
            <div className="topbar-search">
              <input type="text" placeholder="Search for..." />
              <button><i className="fas fa-search fa-sm"></i></button>
            </div>
            <div className="topbar-right">
              <div className="topbar-divider" />
              {/* ── User area — mirrors Users.tsx: localStorage + cleanPhoto + onError ── */}
              <div className="user-area" onClick={() => setUserDropOpen(o => !o)}>
                <span>{sessionUser.username || savedUsername}</span>
                <img
                  src={avatarSrc}
                  alt={sessionUser.username || savedUsername}
                  onError={e => {
                    (e.target as HTMLImageElement).src = AVATAR_URL(sessionUser.username || savedUsername);
                  }}
                />
                {userDropOpen && (
                  <div className="user-dropdown">
                    <a href="#" onClick={(e) => { e.preventDefault(); history.push("/login"); }}>
                      <i className="fas fa-sign-out-alt fa-sm fa-fw" style={{ color: "#aaa" }}></i>
                      Logout
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PAGE CONTENT */}
          <div id="page-content">

            {flash && (
              <div className={`ta-alert-${flash.type}`}>
                <i className={`fas ${flash.type === "success" ? "fa-check-circle" : "fa-exclamation-circle"}`}></i>
                <span>{flash.msg}</span>
              </div>
            )}

            {/* Stat cards */}
            <div className="stat-row">
              <div className="ta-stat">
                <div className="ta-stat-icon"><i className="fas fa-users"></i></div>
                <div>
                  <div className="ta-stat-label">Total Users</div>
                  {stats
                    ? <div className="ta-stat-num">{stats.total_users}</div>
                    : <div className="ta-stat-loading">—</div>
                  }
                </div>
              </div>
              <div className="ta-stat">
                <div className="ta-stat-icon"><i className="fas fa-map-marker-alt"></i></div>
                <div>
                  <div className="ta-stat-label">Tourist Spots</div>
                  {stats
                    ? <div className="ta-stat-num">{stats.tourist_spots}</div>
                    : <div className="ta-stat-loading">—</div>
                  }
                </div>
              </div>
            </div>

            {/* Edit Form Card */}
            <div className="ta-card-section">
              <div className="ta-card-header">
                <h6 className="ta-section-title">Edit Tourist Spot</h6>
              </div>
              <div className="ta-card-body">

                {loading ? (
                  <div className="ta-loading">
                    <i className="fas fa-circle-notch"></i>
                    Loading spot #{id}…
                  </div>

                ) : flash?.type === "error" && !form.spot_name ? (
                  <>
                    <div style={{ color: "#991b1b", fontSize: 13, marginBottom: 12 }}>
                      <i className="fas fa-exclamation-triangle" style={{ marginRight: 6 }}></i>
                      Failed to load the tourist spot. Please check:
                    </div>
                    <div className="ta-debug-box">
                      <div>Fetched URL: <b>{API_BASE}/spots/{id}</b></div>
                      <div style={{ marginTop: 4 }}>Open the URL in a new tab to see the raw API response.</div>
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <button className="ta-btn-cancel" style={{ flex: "unset", padding: "9px 20px" }}
                        onClick={() => history.push("/dashboard")}>
                        <i className="fas fa-arrow-left"></i> Back to Dashboard
                      </button>
                    </div>
                  </>

                ) : (
                  <form onSubmit={handleSubmit}>

                    <div className="mb-3">
                      <label className="ta-form-label">Tourist Spot Name</label>
                      <input
                        type="text"
                        className="ta-form-control"
                        value={form.spot_name}
                        onChange={e => setForm(f => ({ ...f, spot_name: e.target.value }))}
                        required
                        disabled={submitting}
                      />
                    </div>

                    <div className="mb-3">
                      <label className="ta-form-label">Category</label>
                      <select
                        className="ta-form-control"
                        value={form.category}
                        onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                        required
                        disabled={submitting}
                      >
                        <option value="" disabled>Select a category</option>
                        {CATEGORIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="ta-form-label">Description</label>
                      <textarea
                        className="ta-form-control"
                        rows={3}
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        required
                        disabled={submitting}
                      />
                    </div>

                    <div className="mb-3">
                      <label className="ta-form-label">Address / Location</label>
                      <input
                        type="text"
                        className="ta-form-control"
                        value={form.location}
                        onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                        required
                        disabled={submitting}
                      />
                    </div>

                    <div className="mb-4">
                      <label className="ta-form-label">Photo</label>

                      {currentImage && !form.spot_image && (
                        <div style={{ marginBottom: 8 }}>
                          <img src={currentImage} alt="current" width={100} className="ta-img-preview" />
                          <div className="ta-img-label">Current image</div>
                        </div>
                      )}

                      {form.spot_image && (
                        <div style={{ marginBottom: 8 }}>
                          <img
                            src={URL.createObjectURL(form.spot_image)}
                            alt="preview"
                            width={100}
                            className="ta-img-preview"
                          />
                          <div className="ta-img-label">New image preview</div>
                        </div>
                      )}

                      <input
                        type="file"
                        accept="image/*"
                        className="ta-form-control"
                        onChange={e => setForm(f => ({ ...f, spot_image: e.target.files?.[0] ?? null }))}
                        disabled={submitting}
                      />
                      <div className="ta-form-hint">Leave blank to keep current image.</div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="submit" className="ta-btn-primary" disabled={submitting}>
                        <i className={`fas ${submitting ? "fa-circle-notch fa-spin" : "fa-save"}`}></i>
                        {submitting ? "Saving..." : "Save Changes"}
                      </button>
                      <button
                        type="button"
                        className="ta-btn-cancel"
                        onClick={() => history.push("/dashboard")}
                        disabled={submitting}
                      >
                        <i className="fas fa-times"></i> Cancel
                      </button>
                    </div>

                  </form>
                )}

              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}