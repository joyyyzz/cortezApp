import { useState, useRef, useEffect, useCallback } from "react";
import { useHistory } from "react-router-dom";
import { CapacitorHttp } from "@capacitor/core";
import { Capacitor } from "@capacitor/core";

// ─── API Base ─────────────────────────────────────────────────────────────────
const API_BASE = "https://itservicesph.com/IT383/CORTEZ/Cortez/index.php/API_profile";

// ─── Types ────────────────────────────────────────────────────────────────────
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

interface ProfileUserProps {
  onLogout?: () => void;
}

const NAV_ITEMS = [
  { icon: "fa-tachometer-alt", label: "Dashboard", path: "/userdashboard" },
  { icon: "fa-heart",          label: "Favorites",  path: "/favorite"      },
  { icon: "fa-user",           label: "Profile",    path: "/profilepage"   },
  { icon: "fa-map",            label: "Map",        path: "/mappage"       },
];

function Sidebar({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div id="sidebar">
      <a className="sidebar-brand" href="#brand" onClick={e => { e.preventDefault(); onNavigate("/userdashboard"); }}>
        <span className="sidebar-brand-icon"><i className="fas fa-laugh-wink" /></span>
        <span style={{ fontSize: 17, fontWeight: 700 }}><em><b>TOUR_</b></em>ISTA</span>
      </a>
      <hr className="sidebar-divider" />
      <ul className="sidebar-nav">
        {NAV_ITEMS.map(({ icon, label, path }) => (
          <li key={label} className={path === "/profilepage" ? "active" : ""}>
            <a href={`#nav-${label}`} onClick={e => { e.preventDefault(); onNavigate(path); }}>
              <i className={`fas fa-fw ${icon}`} /><span>{label}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ProfilePage({ onLogout }: ProfileUserProps) {
  const history        = useHistory();
  const handleNavigate = (path: string) => history.push(path);
  const handleLogout   = onLogout ?? (() => history.push("/login"));

  const [userDropOpen, setUserDropOpen] = useState(false);
  const [searchQuery,  setSearchQuery]  = useState("");
  const [editOpen,     setEditOpen]     = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [apiLoading,   setApiLoading]   = useState(true);
  const [toast,        setToast]        = useState<{ msg: string; error: boolean } | null>(null);
  const [profile,      setProfile]      = useState<ApiProfileResponse | null>(null);
  const [avatarSrc,    setAvatarSrc]    = useState<string | null>(null);
  const [form,         setForm]         = useState({ fname: "", mname: "", lname: "", address: "" });
  const [displayed,    setDisplayed]    = useState({ fname: "", mname: "", lname: "", address: "" });

  const photoInputRef = useRef<HTMLInputElement>(null);

  const activeUsername = profile?.username ?? "";
  const activeUserId   = profile?.user_id  ?? null;
  const fullname       = [displayed.fname, displayed.mname, displayed.lname].filter(Boolean).join(" ").trim();
  const displayName    = fullname || activeUsername;

  function showToast(msg: string, error = false) {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3000);
  }

  // ✅ fetchProfile — CapacitorHttp sa mobile
  const fetchProfile = useCallback(async () => {
    setApiLoading(true);
    try {
      const storedUid = localStorage.getItem("user_id") || "";
      let data: ApiProfileResponse;

      if (Capacitor.isNativePlatform()) {
        const response = await CapacitorHttp.get({
          url: `${API_BASE}?user_id=${storedUid}`,
          headers: { "Accept": "application/json" },
        });
        data = response.data as ApiProfileResponse;
      } else {
        const res = await fetch(`${API_BASE}?user_id=${storedUid}`, {
          method: "GET",
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        try { data = JSON.parse(text); }
        catch { throw new Error("Server returned non-JSON response."); }
      }

      if (data.status === "success") {
        setProfile(data);
        const synced = {
          fname:   data.fname   ?? "",
          mname:   data.mname   ?? "",
          lname:   data.lname   ?? "",
          address: data.address ?? "",
        };
        setForm(synced);
        setDisplayed(synced);
        if (data.profile_photo) setAvatarSrc(data.profile_photo);
      } else {
        showToast("Could not load profile.", true);
      }
    } catch (err) {
      showToast(`Network error: ${err}`, true);
    } finally {
      setApiLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  useEffect(() => {
    if (!userDropOpen) return;
    const handler = () => setUserDropOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [userDropOpen]);

  // ✅ Photo upload — regular fetch lang (FormData)
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowed.includes(file.type)) { showToast("Only JPG, PNG, GIF, or WEBP images are allowed.", true); e.target.value = ""; return; }
    if (file.size > 2 * 1024 * 1024) { showToast("Image must be under 2 MB.", true); e.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = ev => setAvatarSrc(ev.target?.result as string);
    reader.readAsDataURL(file);
    const storedUid = localStorage.getItem("user_id") || String(activeUserId ?? "");
    const fd = new FormData();
    fd.append("profile_photo", file);
    fd.append("user_id", storedUid);
    setUploading(true);
    fetch(`${API_BASE}/upload_photo`, { method: "POST", body: fd, credentials: "include" })
      .then(r => r.json())
      .then((res: { status: string; message?: string }) => {
        setUploading(false);
        if (res.status === "success") { showToast("Profile photo updated!"); fetchProfile(); }
        else { showToast(res.message || "Upload failed.", true); fetchProfile(); }
      })
      .catch(() => { setUploading(false); showToast("Upload error. Please try again.", true); fetchProfile(); });
    e.target.value = "";
  }

  // ✅ Save edits — CapacitorHttp sa mobile
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const storedUid = localStorage.getItem("user_id") || String(activeUserId ?? "");
    try {
      let res: { status: string; message?: string };
      if (Capacitor.isNativePlatform()) {
        const response = await CapacitorHttp.post({
          url: `${API_BASE}/update_profile`,
          headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
          data: `fname=${encodeURIComponent(form.fname)}&mname=${encodeURIComponent(form.mname)}&lname=${encodeURIComponent(form.lname)}&address=${encodeURIComponent(form.address)}&user_id=${storedUid}`,
        });
        res = response.data;
      } else {
        const body = new URLSearchParams({ fname: form.fname, mname: form.mname, lname: form.lname, address: form.address, user_id: storedUid });
        const r = await fetch(`${API_BASE}/update_profile`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, credentials: "include" });
        res = await r.json();
      }
      if (res.status === "success") {
        setDisplayed({ ...form });
        setEditOpen(false);
        showToast("Profile updated successfully!");
        fetchProfile();
      } else {
        showToast(res.message || "Update failed.", true);
      }
    } catch {
      showToast("Error saving profile.", true);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) handleNavigate(`/search?keyword=${encodeURIComponent(searchQuery.trim())}`);
  }

  return (
    <>
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
        .topbar-search-wrap { display:flex; }
        .topbar-search-wrap input { border:1px solid #d1d3e2; border-right:none; border-radius:5px 0 0 5px; padding:7px 14px; font-size:13px; font-family:'DM Sans',sans-serif; background:#f8f9fc; color:#333; width:280px; outline:none; }
        .topbar-search-wrap button { background:#4e73df; border:none; border-radius:0 5px 5px 0; padding:7px 14px; color:#fff; cursor:pointer; }
        .topbar-right { display:flex; align-items:center; gap:1rem; margin-left:auto; }
        .topbar-divider { border-left:1px solid #e3e6f0; height:36px; }
        .user-area { display:flex; align-items:center; gap:8px; cursor:pointer; position:relative; }
        .user-area span { font-size:13px; font-weight:600; color:#333; }
        .user-area img { width:32px; height:32px; border-radius:50%; object-fit:cover; }
        .user-dropdown { position:absolute; top:calc(100% + 10px); right:0; background:#fff; border:1px solid #e3e6f0; border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,0.1); min-width:160px; z-index:200; }
        .user-dropdown a { display:flex; align-items:center; gap:8px; padding:10px 16px; font-size:13px; color:#555; text-decoration:none; }
        .user-dropdown a:hover { background:#f8f9fc; }
        #page-content { flex:1; padding:1.5rem; display:flex; align-items:flex-start; justify-content:center; }
        .profile-card { background:#fff; border:1.5px solid #bfdbfe; border-radius:20px; width:100%; max-width:560px; padding:2.5rem 2.25rem 2rem; box-shadow:0 4px 20px rgba(26,86,219,0.08); text-align:center; }
        .profile-avatar-wrap { position:relative; width:110px; height:110px; margin:0 auto 1rem; cursor:pointer; }
        .profile-avatar-wrap img, .profile-avatar-fallback { width:110px; height:110px; border-radius:50%; border:3px solid #bfdbfe; object-fit:cover; display:block; }
        .profile-avatar-fallback { background:#eff6ff; display:flex; align-items:center; justify-content:center; }
        .profile-avatar-fallback i { font-size:46px; color:#1a56db; }
        .avatar-overlay { position:absolute; inset:0; border-radius:50%; background:rgba(26,86,219,0.55); display:flex; flex-direction:column; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s; color:#fff; font-size:11px; gap:4px; }
        .avatar-overlay i { font-size:22px; }
        .profile-avatar-wrap:hover .avatar-overlay { opacity:1; }
        .progress { height:4px; border-radius:4px; background:#e8f0fe; margin:0 auto 10px; width:110px; }
        .progress-bar { height:100%; border-radius:4px; background:#1a56db; background-image:linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent); background-size:20px 100%; animation:progress-stripes 1s linear infinite; }
        @keyframes progress-stripes { 0%{background-position:20px 0} 100%{background-position:0 0} }
        .sk { border-radius:6px; background:linear-gradient(90deg,#e8f0fe 25%,#d0e4ff 50%,#e8f0fe 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .sk-name { height:22px; width:160px; margin:0 auto 8px; }
        .sk-handle { height:14px; width:100px; margin:0 auto 20px; }
        .sk-block { height:48px; margin-bottom:10px; }
        .profile-name { font-family:'Playfair Display',serif; font-size:22px; color:#1e3a8a; margin:0 0 4px; }
        .profile-handle { font-size:13px; color:#6b8ab8; margin:0 0 0.75rem; font-weight:500; }
        .ta-divider { border:none; border-top:1px dashed #bfdbfe; margin:0 0 1.25rem; }
        .info-block { background:#f8fbff; border-radius:10px; padding:12px 18px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; border:1px solid #e8f0fe; text-align:left; }
        .info-key { font-size:11px; color:#6b8ab8; font-weight:500; text-transform:uppercase; letter-spacing:0.07em; }
        .info-val { font-size:14px; color:#1e3a8a; font-weight:500; }
        .info-val.muted { color:#bfdbfe; font-style:italic; font-weight:400; }
        .btn-edit-profile { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; margin-top:1.5rem; padding:12px; background:#1a56db; color:#fff; border:none; border-radius:10px; font-size:14px; font-family:'DM Sans',sans-serif; font-weight:500; cursor:pointer; transition:background 0.15s, transform 0.12s; }
        .btn-edit-profile:hover { background:#1648c0; transform:translateY(-1px); }
        .edit-form-panel { margin-top:1.25rem; background:#f8fbff; border:1.5px solid #bfdbfe; border-radius:14px; padding:1.25rem; text-align:left; }
        .ta-form-label { font-size:11px; font-weight:500; color:#1e3a8a; margin-bottom:5px; display:block; text-transform:uppercase; letter-spacing:0.06em; }
        .ta-form-control { border:1.5px solid #bfdbfe; border-radius:8px; padding:9px 12px; font-size:13px; font-family:'DM Sans',sans-serif; width:100%; color:#334155; outline:none; background:#fff; transition:border-color 0.15s, box-shadow 0.15s; display:block; }
        .ta-form-control:focus { border-color:#1a56db; box-shadow:0 0 0 3px rgba(26,86,219,0.08); }
        .mb-3 { margin-bottom:1rem; }
        .ta-btn-save { background:#1a56db; border:none; color:#fff; border-radius:8px; padding:9px 20px; font-size:13px; font-weight:500; cursor:pointer; font-family:'DM Sans',sans-serif; display:inline-flex; align-items:center; gap:6px; transition:background 0.15s; }
        .ta-btn-save:hover { background:#1648c0; }
        .ta-btn-cancel { background:#fff; border:1.5px solid #bfdbfe; color:#1a56db; border-radius:8px; padding:9px 20px; font-size:13px; font-weight:500; cursor:pointer; font-family:'DM Sans',sans-serif; }
        .ta-btn-cancel:hover { background:#eff6ff; }
        .toast-msg { position:fixed; bottom:24px; right:24px; background:#1a56db; color:#fff; padding:10px 20px; border-radius:8px; font-size:13px; font-family:'DM Sans',sans-serif; z-index:9999; box-shadow:0 4px 16px rgba(26,86,219,0.25); animation:toast-in 0.25s ease; }
        .toast-msg.error { background:#dc2626; }
        @keyframes toast-in { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {toast && <div className={`toast-msg${toast.error ? " error" : ""}`}>{toast.msg}</div>}

      <div id="wrapper">
        <Sidebar onNavigate={handleNavigate} />

        <div id="content-wrapper">
          <div id="topbar">
            <form className="topbar-search-wrap" onSubmit={handleSearch}>
              <input type="text" placeholder="Search tourist spot..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoComplete="off" />
              <button type="submit"><i className="fas fa-search fa-sm" /></button>
            </form>
            <div className="topbar-right">
              <div className="topbar-divider" />
              <div className="user-area" onClick={e => { e.stopPropagation(); setUserDropOpen(o => !o); }}>
                <span>{activeUsername || "..."}</span>
                {avatarSrc
                  ? <img src={avatarSrc} alt="avatar" />
                  : <div style={{ width:32, height:32, borderRadius:"50%", background:"#eff6ff", border:"2px solid #bfdbfe", display:"flex", alignItems:"center", justifyContent:"center" }}><i className="fas fa-user" style={{ color:"#1a56db", fontSize:14 }} /></div>
                }
                {userDropOpen && (
                  <div className="user-dropdown">
                    <a href="#logout" onClick={e => { e.preventDefault(); handleLogout(); }}>
                      <i className="fas fa-sign-out-alt fa-sm fa-fw" style={{ color:"#aaa" }} /> Logout
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div id="page-content">
            <div className="profile-card">
              <div className="profile-avatar-wrap" onClick={() => photoInputRef.current?.click()} title="Click to change photo">
                {avatarSrc ? <img src={avatarSrc} alt="Profile Photo" /> : <div className="profile-avatar-fallback"><i className="fas fa-user" /></div>}
                <div className="avatar-overlay"><i className="fas fa-camera" /><span>Change</span></div>
              </div>

              <input type="file" ref={photoInputRef} accept="image/jpeg,image/png,image/gif,image/webp" style={{ display:"none" }} onChange={handlePhotoChange} />

              {uploading && <div className="progress"><div className="progress-bar" style={{ width:"100%" }} /></div>}

              {apiLoading
                ? <><div className="sk sk-name" /><div className="sk sk-handle" /></>
                : <><div className="profile-name">{displayName || "—"}</div><div className="profile-handle">@{activeUsername || "..."}</div></>
              }

              <hr className="ta-divider" />

              {apiLoading
                ? [1,2,3,4,5].map(i => <div key={i} className="sk sk-block" />)
                : [
                    { key:"Username",    val: activeUsername    },
                    { key:"First Name",  val: displayed.fname   },
                    { key:"Middle Name", val: displayed.mname   },
                    { key:"Last Name",   val: displayed.lname   },
                    { key:"Address",     val: displayed.address },
                  ].map(({ key, val }) => (
                    <div className="info-block" key={key}>
                      <span className="info-key">{key}</span>
                      <span className={`info-val${!val ? " muted" : ""}`}>{val || "N/A"}</span>
                    </div>
                  ))
              }

              {!apiLoading && (
                <button className="btn-edit-profile" onClick={() => setEditOpen(o => !o)}>
                  <i className="fas fa-pen" style={{ fontSize:13 }} />
                  {editOpen ? "Cancel Editing" : "Edit Profile"}
                </button>
              )}

              {editOpen && (
                <div className="edit-form-panel">
                  <form onSubmit={handleSave}>
                    {(["fname","mname","lname"] as const).map(name => (
                      <div className="mb-3" key={name}>
                        <label className="ta-form-label">{name === "fname" ? "First Name" : name === "mname" ? "Middle Name" : "Last Name"}</label>
                        <input type="text" className="ta-form-control" value={form[name]} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))} />
                      </div>
                    ))}
                    <div className="mb-3">
                      <label className="ta-form-label">Address</label>
                      <textarea className="ta-form-control" rows={3} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                    </div>
                    <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                      <button type="submit" className="ta-btn-save"><i className="fas fa-save" /> Save</button>
                      <button type="button" className="ta-btn-cancel" onClick={() => { setEditOpen(false); setForm({ ...displayed }); }}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}