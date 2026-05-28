import { useState, useEffect, useRef } from "react";
import { useHistory } from "react-router-dom";
import { CapacitorHttp } from "@capacitor/core";
import { Capacitor } from "@capacitor/core";
import AppLayout from "../components/AppLayout";

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE_URL = "https://itservicesph.com/IT383/CORTEZ/Cortez/index.php";

const API = {
  getProfile:    (user_id: number) => `${BASE_URL}/API_profileadmin?user_id=${user_id}`,
  updateProfile: `${BASE_URL}/API_profileadmin/updateProfile`,
  uploadPhoto:   `${BASE_URL}/API_profileadmin/uploadProfilePhoto`,
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserInfo {
  user_id:        number;
  username:       string;
  fname?:         string;
  mname?:         string;
  lname?:         string;
  address?:       string;
  profile_photo?: string;
}

interface ApiResponse<T = unknown> {
  status?:    "success" | "error";
  success?:   boolean;
  message?:   string;
  data?:      T;
  photo_url?: string;
  url?:       string;
}

interface ProfileAdminProps {
  userId: number;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, isError }: { message: string; isError: boolean }) {
  return (
    <div style={{
      position:"fixed", bottom:24, right:24,
      background: isError ? "#dc2626" : "#1a56db",
      color:"#fff", padding:"10px 20px",
      borderRadius:8, fontSize:13,
      fontFamily:"'DM Sans',sans-serif",
      zIndex:9999, boxShadow:"0 4px 16px rgba(26,86,219,0.25)",
    }}>
      {message}
    </div>
  );
}

// ─── ProfileAdmin Page ────────────────────────────────────────────────────────
export default function ProfileAdmin({ userId: propUserId }: ProfileAdminProps) {
  const userId = propUserId || Number(localStorage.getItem("user_id"));

  const history = useHistory();

  // ── Sidebar mobile state ──
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const [userInfo, setUserInfo]           = useState<UserInfo | null>(null);
  const [loading, setLoading]             = useState(true);
  const [editOpen, setEditOpen]           = useState(false);
  const [uploading, setUploading]         = useState(false);
  const [userDropOpen, setUserDropOpen]   = useState(false);
  const [toast, setToast]                 = useState<{ message: string; isError: boolean } | null>(null);
  const [searchQuery, setSearchQuery]     = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [form, setForm] = useState({ fname:"", mname:"", lname:"", address:"" });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const userAreaRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    const doFetch = async () => {
      try {
        let res: ApiResponse<UserInfo>;
        if (Capacitor.isNativePlatform()) {
          const response = await CapacitorHttp.get({
            url: API.getProfile(userId),
            headers: { "Accept": "application/json" },
          });
          res = response.data as ApiResponse<UserInfo>;
        } else {
          const r = await fetch(API.getProfile(userId));
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          res = await r.json() as ApiResponse<UserInfo>;
        }
        if (res.status === "success" && res.data) {
          setUserInfo(res.data);
          setForm({ fname: res.data.fname ?? "", mname: res.data.mname ?? "", lname: res.data.lname ?? "", address: res.data.address ?? "" });
          if (res.data.profile_photo) {
            const filename = res.data.profile_photo.split("/").pop() ?? res.data.profile_photo;
            localStorage.setItem("profile_photo", filename);
            setUserInfo(prev => prev ? { ...prev, profile_photo: filename } : prev);
          }
          if (res.data.username) localStorage.setItem("username", res.data.username);
        }
      } catch (e: any) {
        showToast(e.message, true);
      } finally {
        setLoading(false);
      }
    };
    doFetch();
  }, [userId]);

  useEffect(() => {
    if (!userInfo) return;
    setForm({ fname: userInfo.fname ?? "", mname: userInfo.mname ?? "", lname: userInfo.lname ?? "", address: userInfo.address ?? "" });
  }, [userInfo]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (userAreaRef.current && !userAreaRef.current.contains(e.target as Node))
        setUserDropOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function showToast(message: string, isError = false) {
    setToast({ message, isError });
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg","image/png","image/gif","image/webp"];
    if (!allowed.includes(file.type)) { showToast("Only JPG, PNG, GIF, or WEBP images are allowed.", true); e.target.value = ""; return; }
    if (file.size > 2 * 1024 * 1024) { showToast("Image must be under 2 MB.", true); e.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = ev => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    if (!userInfo) return;
    const formData = new FormData();
    formData.append("profile_photo", file);
    formData.append("user_id", String(userInfo.user_id));
    setUploading(true);
    fetch(API.uploadPhoto, { method:"POST", body:formData })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<ApiResponse>; })
      .then(res => {
        if (res.success === true) {
          if (res.url) {
            const filename = res.url.split("/").pop() ?? "";
            setUserInfo(prev => prev ? { ...prev, profile_photo: filename } : prev);
            localStorage.setItem("profile_photo", filename);
          }
          setAvatarPreview(null);
          showToast(res.message ?? "Profile photo updated!");
        } else {
          setAvatarPreview(null);
          showToast(res.message ?? "Upload failed.", true);
        }
      })
      .catch((err: Error) => { setAvatarPreview(null); showToast(`Upload error: ${err.message}`, true); })
      .finally(() => { setUploading(false); if (photoInputRef.current) photoInputRef.current.value = ""; });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userInfo) return;
    try {
      let data: ApiResponse;
      if (Capacitor.isNativePlatform()) {
        const response = await CapacitorHttp.post({
          url: API.updateProfile,
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          data: {
            user_id: String(userInfo.user_id),
            fname: form.fname,
            mname: form.mname,
            lname: form.lname,
            address: form.address,
          },
        });
        data = response.data as ApiResponse;
      } else {
        const body = new FormData();
        body.append("user_id", String(userInfo.user_id));
        body.append("fname", form.fname);
        body.append("mname", form.mname);
        body.append("lname", form.lname);
        body.append("address", form.address);
        const r = await fetch(API.updateProfile, { method:"POST", body });
        data = await r.json() as ApiResponse;
      }
      if (data.status === "success") {
        setUserInfo(prev => prev ? { ...prev, ...form } : prev);
        setEditOpen(false);
        showToast(data.message ?? "Profile updated successfully!");
      } else {
        showToast(data.message ?? "Update failed.", true);
      }
    } catch {
      showToast("Update error. Please try again.", true);
    }
  }

  const fullName    = userInfo ? [userInfo.fname, userInfo.mname, userInfo.lname].filter(Boolean).join(" ").trim() : "";
  const displayName = fullName || userInfo?.username || "—";

  const savedPhoto   = localStorage.getItem("profile_photo");
  const BASE_UPLOADS = "https://itservicesph.com/IT383/CORTEZ/Cortez/uploads/profile/";
  const cleanPhoto   = (p: string | null | undefined) => { if (!p) return null; return p.includes("http") ? p.split("/").pop() ?? null : p; };
  const currentAvatar = avatarPreview ?? (cleanPhoto(userInfo?.profile_photo) ? `${BASE_UPLOADS}${cleanPhoto(userInfo?.profile_photo)}` : cleanPhoto(savedPhoto) ? `${BASE_UPLOADS}${cleanPhoto(savedPhoto)}` : null);
  const topbarAvatar  = currentAvatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(userInfo?.username ?? "A")}&background=1a56db&color=fff`;

  const NAV_ITEMS = [
    { icon:"fa-tachometer-alt", label:"Dashboard", path:"/dashboard"   },
    { icon:"fa-users",          label:"Users",     path:"/users"        },
    { icon:"fa-user",           label:"Profile",   path:"/profileadmin" },
    { icon:"fa-map",            label:"Map",       path:"/mapadmin"     },
    { icon:"fa-archive",        label:"Archived",  path:"/archived"     },
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
        #sidebar { width:225px; min-width:225px; background:linear-gradient(180deg,#4e73df 10%,#224abe 100%); display:flex; flex-direction:column; height:100vh; position:fixed; top:0; left:0; flex-shrink:0; z-index:100; }
        .sidebar-brand { display:flex; align-items:center; gap:10px; padding:1.25rem 1rem; color:#fff; text-decoration:none; }
        .sidebar-brand-icon { font-size:22px; transform:rotate(-15deg); display:inline-block; }
        .sidebar-brand-text { font-size:17px; font-weight:700; }
        hr.sidebar-divider { border:none; border-top:1px solid rgba(255,255,255,0.15); margin:0 1rem; }
        .sidebar-nav { list-style:none; padding:0; flex:1; }
        .sidebar-nav li a { display:flex; align-items:center; gap:10px; padding:12px 20px; color:rgba(255,255,255,0.75); font-size:13.5px; font-weight:500; text-decoration:none; transition:background 0.15s, color 0.15s; }
        .sidebar-nav li a:hover, .sidebar-nav li.active a { background:rgba(255,255,255,0.12); color:#fff; }
        .sidebar-nav li a i { width:18px; text-align:center; font-size:14px; }
        #content-wrapper { margin-left:225px; flex:1; display:flex; flex-direction:column; height:100vh; overflow-y:auto; overflow-x:hidden; scrollbar-width:thin; scrollbar-color:#bfdbfe #f1f5f9; }
        #content-wrapper::-webkit-scrollbar { width:8px; }
        #content-wrapper::-webkit-scrollbar-track { background:#f1f5f9; }
        #content-wrapper::-webkit-scrollbar-thumb { background:#bfdbfe; border-radius:4px; }
        #content-wrapper::-webkit-scrollbar-thumb:hover { background:#93c5fd; }
        #topbar { height:65px; flex-shrink:0; background:#fff; box-shadow:0 2px 4px rgba(0,0,0,0.08); display:flex; align-items:center; padding:0 1.5rem; gap:1rem; position:sticky; top:0; z-index:99; }

        /* ── Hamburger ── */
        .hamburger-btn { display:none; background:none; border:none; cursor:pointer; padding:6px 8px; color:#4e73df; font-size:20px; border-radius:6px; line-height:1; flex-shrink:0; }
        @media(max-width:768px) { .hamburger-btn { display:flex; align-items:center; justify-content:center; } }

        .topbar-search { display:flex; }
        .topbar-search input { border:1px solid #d1d3e2; border-right:none; border-radius:5px 0 0 5px; padding:7px 14px; font-size:13px; font-family:'DM Sans',sans-serif; background:#f8f9fc; color:#333; width:280px; outline:none; }
        .topbar-search button { background:#4e73df; border:none; border-radius:0 5px 5px 0; padding:7px 14px; color:#fff; cursor:pointer; }
        .topbar-right { display:flex; align-items:center; gap:1rem; margin-left:auto; }
        .topbar-divider { border-left:1px solid #e3e6f0; height:36px; }
        .user-area { display:flex; align-items:center; gap:8px; cursor:pointer; position:relative; }
        .user-area > span { font-size:13px; font-weight:600; color:#333; }
        .user-area img { width:32px; height:32px; border-radius:50%; object-fit:cover; }
        .user-dropdown { position:absolute; top:calc(100% + 10px); right:0; background:#fff; border:1px solid #e3e6f0; border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,0.1); min-width:160px; z-index:200; }
        .user-dropdown a { display:flex; align-items:center; gap:8px; padding:10px 16px; font-size:13px; color:#555; text-decoration:none; }
        .user-dropdown a:hover { background:#f8f9fc; }
        #page-content { flex:1; padding:1.5rem; display:flex; align-items:flex-start; justify-content:center; }
        .profile-card { background:#fff; border:1.5px solid #bfdbfe; border-radius:20px; width:100%; max-width:560px; padding:2.5rem 2.25rem 2rem; box-shadow:0 4px 20px rgba(26,86,219,0.08); text-align:center; }
        .profile-avatar-wrap { position:relative; width:110px; height:110px; margin:0 auto 1rem; cursor:pointer; }
        .profile-avatar-wrap img { width:110px; height:110px; border-radius:50%; border:3px solid #bfdbfe; object-fit:cover; display:block; }
        .profile-avatar-fallback { width:110px; height:110px; border-radius:50%; border:3px solid #bfdbfe; background:#eff6ff; display:flex; align-items:center; justify-content:center; }
        .profile-avatar-fallback i { font-size:46px; color:#1a56db; }
        .avatar-overlay { position:absolute; inset:0; border-radius:50%; background:rgba(26,86,219,0.55); display:flex; flex-direction:column; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s; color:#fff; font-size:11px; gap:4px; }
        .avatar-overlay i { font-size:22px; }
        .profile-avatar-wrap:hover .avatar-overlay { opacity:1; }
        .progress { height:4px; border-radius:4px; background:#e8f0fe; }
        .progress-bar { height:100%; border-radius:4px; background:#1a56db; background-image:linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent); background-size:20px 100%; animation:progress-stripes 1s linear infinite; }
        @keyframes progress-stripes { 0%{background-position:20px 0} 100%{background-position:0 0} }
        .profile-name { font-family:'Playfair Display',serif; font-size:22px; color:#1e3a8a; margin:0 0 4px; }
        .profile-handle { font-size:13px; color:#6b8ab8; margin:0 0 0.75rem; font-weight:500; }
        .ta-divider { border:none; border-top:1px dashed #bfdbfe; margin:0 0 1.25rem; }
        .info-block { background:#f8fbff; border-radius:10px; padding:12px 18px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; border:1px solid #e8f0fe; text-align:left; }
        .info-key { font-size:11px; color:#6b8ab8; font-weight:500; text-transform:uppercase; letter-spacing:0.07em; }
        .info-val { font-size:14px; color:#1e3a8a; font-weight:500; }
        .info-val.muted { color:#bfdbfe; font-style:italic; font-weight:400; }
        .btn-edit-profile { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; margin-top:1.5rem; padding:12px; background:#1a56db; color:#fff; border:none; border-radius:10px; font-size:14px; font-family:'DM Sans',sans-serif; font-weight:500; cursor:pointer; transition:background 0.15s; }
        .btn-edit-profile:hover { background:#1648c0; }
        .edit-form-panel { margin-top:1.25rem; background:#f8fbff; border:1.5px solid #bfdbfe; border-radius:14px; padding:1.25rem; text-align:left; }
        .ta-form-label { font-size:11px; font-weight:500; color:#1e3a8a; margin-bottom:5px; display:block; text-transform:uppercase; letter-spacing:0.06em; }
        .ta-form-control { border:1.5px solid #bfdbfe; border-radius:8px; padding:9px 12px; font-size:13px; font-family:'DM Sans',sans-serif; width:100%; color:#334155; outline:none; transition:border-color 0.15s; background:#fff; display:block; }
        .ta-form-control:focus { border-color:#1a56db; box-shadow:0 0 0 3px rgba(26,86,219,0.08); }
        .mb-3 { margin-bottom:14px; }
        .ta-btn-save { background:#1a56db; border:none; color:#fff; border-radius:8px; padding:9px 20px; font-size:13px; font-weight:500; cursor:pointer; font-family:'DM Sans',sans-serif; display:inline-flex; align-items:center; gap:6px; }
        .ta-btn-save:hover { background:#1648c0; }
        .ta-btn-cancel { background:#fff; border:1.5px solid #bfdbfe; color:#1a56db; border-radius:8px; padding:9px 20px; font-size:13px; font-weight:500; cursor:pointer; font-family:'DM Sans',sans-serif; }
        .ta-btn-cancel:hover { background:#eff6ff; }
        .state-center { display:flex; align-items:center; justify-content:center; padding:3rem; gap:8px; color:#6b8ab8; font-size:14px; }

        @media(max-width:768px){
          .topbar-search input { width:140px; }
        }
      `}</style>

      {toast && <Toast message={toast.message} isError={toast.isError} />}

      <div id="wrapper">
        <div id="sidebar" className={isMobileOpen ? "mobile-open" : ""}>
          <a className="sidebar-brand" href="/dashboard">
            <span className="sidebar-brand-icon"><i className="fas fa-laugh-wink"></i></span>
            <span className="sidebar-brand-text"><em><b>TOUR_</b></em>ISTA</span>
          </a>
          <hr className="sidebar-divider" />
          <ul className="sidebar-nav">
            {NAV_ITEMS.map(({ icon, label, path }) => (
              <li key={label} className={path === "/profileadmin" ? "active" : ""}>
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

        <div id="content-wrapper">
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
              <input type="text" placeholder="Search for..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              <button type="button"><i className="fas fa-search fa-sm"></i></button>
            </div>
            <div className="topbar-right">
              <div className="topbar-divider" />
              <div className="user-area" ref={userAreaRef} onClick={() => setUserDropOpen(o => !o)}>
                <span>{userInfo?.username ?? "—"}</span>
                <img src={topbarAvatar} alt="avatar" />
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

          <div id="page-content">
            {loading ? (
              <div className="state-center">
                <i className="fas fa-spinner fa-spin"></i> Loading profile…
              </div>
            ) : (
              <div className="profile-card">
                <div className="profile-avatar-wrap" onClick={() => photoInputRef.current?.click()} title="Click to change photo">
                  {currentAvatar
                    ? <img src={currentAvatar} alt="Profile" />
                    : <div className="profile-avatar-fallback"><i className="fas fa-user-shield"></i></div>
                  }
                  <div className="avatar-overlay">
                    <i className="fas fa-camera"></i>
                    <span>Change</span>
                  </div>
                </div>

                <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" style={{ display:"none" }} onChange={handlePhotoChange} />

                {uploading && (
                  <div style={{ margin:"0 auto 10px", width:110 }}>
                    <div className="progress"><div className="progress-bar" style={{ width:"100%" }} /></div>
                  </div>
                )}

                <div className="profile-name">{displayName}</div>
                <div className="profile-handle">@{userInfo?.username ?? "—"}</div>
                <hr className="ta-divider" />

                {[
                  { key:"Username",    val: userInfo?.username },
                  { key:"First Name",  val: userInfo?.fname    },
                  { key:"Middle Name", val: userInfo?.mname    },
                  { key:"Last Name",   val: userInfo?.lname    },
                  { key:"Address",     val: userInfo?.address  },
                ].map(({ key, val }) => (
                  <div className="info-block" key={key}>
                    <span className="info-key">{key}</span>
                    <span className={`info-val${!val ? " muted" : ""}`}>{val || "N/A"}</span>
                  </div>
                ))}

                <button className="btn-edit-profile" onClick={() => setEditOpen(o => !o)}>
                  <i className="fas fa-pen" style={{ fontSize:13 }}></i>
                  {editOpen ? "Close Edit" : "Edit Profile"}
                </button>

                {editOpen && (
                  <div className="edit-form-panel">
                    <form onSubmit={handleSave}>
                      {(["fname","mname","lname"] as const).map(name => (
                        <div className="mb-3" key={name}>
                          <label className="ta-form-label">
                            {name === "fname" ? "First Name" : name === "mname" ? "Middle Name" : "Last Name"}
                          </label>
                          <input type="text" className="ta-form-control"
                            value={form[name]}
                            onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))} />
                        </div>
                      ))}
                      <div className="mb-3">
                        <label className="ta-form-label">Address</label>
                        <textarea className="ta-form-control" rows={3} value={form.address}
                          onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                      </div>
                      <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                        <button type="submit" className="ta-btn-save">
                          <i className="fas fa-save"></i> Save
                        </button>
                        <button type="button" className="ta-btn-cancel" onClick={() => setEditOpen(false)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}