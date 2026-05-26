import { useState, useMemo, useEffect } from "react";
import { useHistory } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserInfo {
  info_id: number;
  user_id: number;
  fname:   string;
  mname:   string;
  lname:   string;
  address: string;
}

interface SessionUser {
  username:      string;
  profile_photo: string | null;
}

interface ApiResponse {
  status: "success" | "error";
  count:  number;
  search: string | null;
  data:   UserInfo[];
}

interface UsersProps {
  username?:      string;
  profile_photo?: string;
}

const CI3_ORIGIN = "https://itservicesph.com";
const APP_PATH   = "/IT383/CORTEZ/Cortez";
const CI_BASE    = `${CI3_ORIGIN}${APP_PATH}/index.php`;
const UPLOADS    = `${CI3_ORIGIN}${APP_PATH}/uploads/profile/`;

const AVATAR_URL = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a56db&color=fff`;

// ✅ Helper para ma-extract ang filename lang mula sa buong URL o filename
function cleanPhoto(p: string | null | undefined): string | null {
  if (!p) return null;
  return p.includes("http") ? p.split("/").pop() ?? null : p;
}

function highlight(text: string, keyword: string): React.ReactNode {
  if (!keyword) return text;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts   = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === keyword.toLowerCase()
      ? <mark key={i} className="ta-highlight">{part}</mark>
      : part
  );
}

export default function Users({
  username:      propUsername      = "Admin",
  profile_photo: propProfilePhoto,
}: UsersProps) {

  const history = useHistory();

  // ✅ Read localStorage FIRST, before any state declarations
  const savedPhoto    = localStorage.getItem("profile_photo");
  const savedUsername = localStorage.getItem("username") ?? propUsername;

  const [info,         setInfo]        = useState<UserInfo[]>([]);
  const [sessionUser,  setSessionUser] = useState<SessionUser>({
    username:      savedUsername,   // ← was propUsername (wrong)
    profile_photo: savedPhoto,      // ← was propProfilePhoto ?? null (wrong)
  });
  const [loading,      setLoading]     = useState(true);
  const [error,        setError]       = useState<string | null>(null);
  const [searchQuery,  setSearchQuery] = useState("");
  const [userDropOpen, setUserDropOpen]= useState(false);

  // resolvedPhoto stays the same
  const resolvedPhoto = cleanPhoto(sessionUser.profile_photo) ?? cleanPhoto(savedPhoto);
  const avatarSrc = resolvedPhoto
    ? `${UPLOADS}${resolvedPhoto}`
    : AVATAR_URL(sessionUser.username || savedUsername);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${CI_BASE}/main/API_users`, { credentials: "include" })
      .then(res => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const ct = res.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) throw new Error("Server returned HTML instead of JSON. Check the API URL.");
        return res.json() as Promise<ApiResponse>;
      })
      .then(json => { if (json.status !== "success") throw new Error("API returned error status."); setInfo(json.data); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const q = searchQuery.toLowerCase().trim();
  const filtered = useMemo(() =>
    q ? info.filter(r =>
      String(r.user_id).includes(q) ||
      r.fname.toLowerCase().includes(q) ||
      r.mname.toLowerCase().includes(q) ||
      r.lname.toLowerCase().includes(q) ||
      r.address.toLowerCase().includes(q)
    ) : info,
    [info, q]
  );

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
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body,#root{height:100%;overflow:hidden}
        body{font-family:'DM Sans',sans-serif;background:#f8f9fc}

        #wrapper{display:flex;height:100vh;overflow:hidden}

        #sidebar{
          width:225px;min-width:225px;
          background:linear-gradient(180deg,#4e73df 10%,#224abe 100%);
          display:flex;flex-direction:column;
          height:100vh;
          position:fixed;top:0;left:0;
          flex-shrink:0;
          z-index:100;
        }
        .sidebar-brand{display:flex;align-items:center;gap:10px;padding:1.25rem 1rem;color:#fff;text-decoration:none}
        .sidebar-brand-icon{font-size:22px;transform:rotate(-15deg);display:inline-block}
        .sidebar-brand-text{font-size:17px;font-weight:700}
        hr.sidebar-divider{border:none;border-top:1px solid rgba(255,255,255,0.15);margin:0 1rem}
        .sidebar-nav{list-style:none;padding:0;flex:1}
        .sidebar-nav li a{display:flex;align-items:center;gap:10px;padding:12px 20px;color:rgba(255,255,255,0.75);font-size:13.5px;font-weight:500;text-decoration:none;transition:background 0.15s,color 0.15s}
        .sidebar-nav li a:hover,.sidebar-nav li.active a{background:rgba(255,255,255,0.12);color:#fff}
        .sidebar-nav li a i{width:18px;text-align:center;font-size:14px}

        #content-wrapper{
          margin-left:225px;
          flex:1;
          display:flex;
          flex-direction:column;
          height:100vh;
          overflow-y:auto;
          overflow-x:hidden;
          scrollbar-width:thin;
          scrollbar-color:#bfdbfe #f1f5f9;
        }
        #content-wrapper::-webkit-scrollbar{width:8px}
        #content-wrapper::-webkit-scrollbar-track{background:#f1f5f9}
        #content-wrapper::-webkit-scrollbar-thumb{background:#bfdbfe;border-radius:4px}
        #content-wrapper::-webkit-scrollbar-thumb:hover{background:#93c5fd}

        #topbar{
          height:65px;flex-shrink:0;
          background:#fff;
          box-shadow:0 2px 4px rgba(0,0,0,0.08);
          display:flex;align-items:center;
          padding:0 1.5rem;gap:1rem;
          position:sticky;top:0;z-index:99;
        }
        .topbar-search{display:flex}
        .topbar-search input{border:1px solid #d1d3e2;border-right:none;border-radius:5px 0 0 5px;padding:7px 14px;font-size:13px;font-family:'DM Sans',sans-serif;background:#f8f9fc;color:#333;width:280px;outline:none}
        .topbar-search button{background:#4e73df;border:none;border-radius:0 5px 5px 0;padding:7px 14px;color:#fff;cursor:pointer}
        .topbar-right{display:flex;align-items:center;gap:1rem;margin-left:auto}
        .topbar-divider{border-left:1px solid #e3e6f0;height:36px}
        .user-area{display:flex;align-items:center;gap:8px;cursor:pointer;position:relative;user-select:none}
        .user-area span{font-size:13px;font-weight:600;color:#333}
        .user-area img{width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid #bfdbfe}
        .user-dropdown{position:absolute;top:calc(100% + 10px);right:0;background:#fff;border:1px solid #e3e6f0;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.1);min-width:160px;z-index:200}
        .user-dropdown a{display:flex;align-items:center;gap:8px;padding:10px 16px;font-size:13px;color:#555;text-decoration:none}
        .user-dropdown a:hover{background:#f8f9fc}

        #page-content{padding:1.5rem;flex:1}

        .ta-card-section{background:#fff;border-radius:16px;border:1.5px solid #bfdbfe;box-shadow:0 2px 8px rgba(26,86,219,0.07);overflow:hidden}
        .ta-card-header{background:#fff;border-bottom:1.5px solid #bfdbfe;padding:1rem 1.25rem;display:flex;align-items:center;gap:10px}
        .ta-section-title{font-family:'Playfair Display',serif;font-size:18px;color:#1a56db;margin:0;border-left:4px solid #1a56db;padding-left:12px}
        .ta-card-body{padding:1.25rem;background:#fff;overflow-x:auto}
        .ta-count-badge{background:#eff6ff;border:1px solid #bfdbfe;color:#1a56db;border-radius:20px;padding:3px 12px;font-size:12px;font-weight:500;white-space:nowrap;margin-left:auto}
        .ta-table{width:100%;font-size:13px;border-collapse:collapse}
        .ta-table thead tr{background:#eff6ff}
        .ta-table thead th{padding:10px 14px;color:#1e3a8a;font-weight:500;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1.5px solid #bfdbfe;text-align:left}
        .ta-table tbody tr{border-bottom:1px solid #e8f0fe;transition:background 0.15s}
        .ta-table tbody tr:hover{background:#f5f9ff}
        .ta-table tbody td{padding:11px 14px;color:#334155;vertical-align:middle}
        .ta-id-badge{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;background:#1a56db;color:#fff;border-radius:7px;font-size:12px;font-weight:500}
        .ta-loading{text-align:center;padding:3rem 1rem;color:#6b8ab8}
        .ta-loading i{font-size:32px;color:#bfdbfe;display:block;margin-bottom:0.75rem;animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .ta-loading p{font-size:13px;color:#94a3b8;margin:0}
        .ta-error{text-align:center;padding:2.5rem 1rem;color:#ef4444}
        .ta-error i{font-size:36px;color:#fca5a5;display:block;margin-bottom:0.75rem}
        .ta-error p{font-size:13px;margin:0 0 1rem;word-break:break-all}
        .ta-error button{background:#1a56db;color:#fff;border:none;border-radius:8px;padding:8px 18px;font-size:13px;cursor:pointer}
        .ta-error button:hover{background:#1741a6}
        .ta-no-results{text-align:center;padding:2.5rem 1rem;color:#6b8ab8}
        .ta-no-results i{font-size:36px;color:#bfdbfe;display:block;margin-bottom:0.75rem}
        .ta-no-results p{font-size:13px;color:#94a3b8;margin:0}
        .ta-empty{text-align:center;padding:3rem 1rem;color:#6b8ab8}
        .ta-empty i{font-size:48px;color:#bfdbfe;display:block;margin-bottom:1rem}
        .ta-empty p{font-size:14px;color:#94a3b8;margin:0}
        mark.ta-highlight{background:#fde68a;color:#1e3a8a;border-radius:3px;padding:0 2px}
      `}</style>

      <div id="wrapper">

        {/* SIDEBAR */}
        <div id="sidebar">
          <a className="sidebar-brand" href="/dashboard">
            <span className="sidebar-brand-icon"><i className="fas fa-laugh-wink"></i></span>
            <span className="sidebar-brand-text"><em><b>TOUR_</b></em>ISTA</span>
          </a>
          <hr className="sidebar-divider" />
          <ul className="sidebar-nav">
            {NAV_ITEMS.map(({ icon, label, path }) => (
              <li key={label} className={path === "/users" ? "active" : ""}>
                <a href="#" onClick={e => { e.preventDefault(); history.push(path); }}>
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
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoComplete="off"
              />
              <button type="button"><i className="fas fa-search fa-sm"></i></button>
            </div>
            <div className="topbar-right">
              <div className="topbar-divider" />
              {/* ✅ FIXED: gumagamit na ng localStorage para sa username at avatar */}
              <div className="user-area" onClick={() => setUserDropOpen(o => !o)}>
                <span>{sessionUser.username || savedUsername}</span>
                <img
                  src={avatarSrc}
                  alt={sessionUser.username || savedUsername}
                  onError={e => { (e.target as HTMLImageElement).src = AVATAR_URL(sessionUser.username || savedUsername); }}
                />
                {userDropOpen && (
                  <div className="user-dropdown">
                    <a href="#" onClick={e => { e.preventDefault(); history.push("/login"); }}>
                      <i className="fas fa-sign-out-alt fa-sm fa-fw" style={{ color:"#aaa" }}></i>
                      Logout
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Page content */}
          <div id="page-content">
            <div className="ta-card-section">
              <div className="ta-card-header">
                <h6 className="ta-section-title">Users List</h6>
                {!loading && !error && info.length > 0 && (
                  <span className="ta-count-badge">
                    <i className="fas fa-users" style={{ marginRight:4 }}></i>
                    {filtered.length} user{filtered.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div className="ta-card-body">

                {loading && (
                  <div className="ta-loading">
                    <i className="fas fa-circle-notch"></i>
                    <p>Loading users...</p>
                  </div>
                )}

                {!loading && error && (
                  <div className="ta-error">
                    <i className="fas fa-exclamation-circle"></i>
                    <p>{error}</p>
                    <button onClick={() => window.location.reload()}>
                      <i className="fas fa-redo" style={{ marginRight:6 }}></i>Retry
                    </button>
                  </div>
                )}

                {!loading && !error && info.length === 0 && (
                  <div className="ta-empty">
                    <i className="fas fa-users"></i>
                    <p>No data found.</p>
                  </div>
                )}

                {!loading && !error && info.length > 0 && filtered.length === 0 && (
                  <div className="ta-no-results">
                    <i className="fas fa-search"></i>
                    <p>No user found matching "<strong>{searchQuery}</strong>".</p>
                  </div>
                )}

                {!loading && !error && filtered.length > 0 && (
                  <table className="ta-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>User ID</th>
                        <th>First Name</th>
                        <th>Middle Name</th>
                        <th>Last Name</th>
                        <th>Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(row => (
                        <tr key={row.info_id}>
                          <td><span className="ta-id-badge">{row.info_id}</span></td>
                          <td style={{ color:"#6b8ab8",fontWeight:500 }}>{highlight(String(row.user_id), q)}</td>
                          <td style={{ fontWeight:500,color:"#1e3a8a" }}>{highlight(row.fname, q)}</td>
                          <td style={{ color:"#64748b" }}>{highlight(row.mname, q)}</td>
                          <td>{highlight(row.lname, q)}</td>
                          <td style={{ color:"#475569",fontSize:12 }}>{highlight(row.address, q)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}