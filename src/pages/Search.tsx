import { useState, useEffect, useRef } from "react";
import { useHistory, useLocation } from "react-router-dom";

// ─── Types ───────────────────────────────────────────────────────────────────
interface TouristSpot {
  spot_id: number;
  spot_name: string;
  category: string;
  description: string;
  location: string;
  spot_image?: string;
}

interface SearchResultsProps {
  keyword?: string;
  spots?: TouristSpot[];
  username?: string;
  profile_photo?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getBadgeClass(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("beach"))                                  return "badge-beach";
  if (c.includes("mountain"))                               return "badge-mountain";
  if (c.includes("historical") || c.includes("heritage"))  return "badge-historical";
  if (c.includes("park"))                                   return "badge-park";
  if (c.includes("museum"))                                 return "badge-museum";
  if (c.includes("festival") || c.includes("event"))       return "badge-festival";
  return "badge-other";
}

// ─── Desc Modal ───────────────────────────────────────────────────────────────
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
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 1040,
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          zIndex: 1050,
          width: "100%",
          maxWidth: 500,
          padding: "0 1rem",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1.5px solid #bfdbfe",
          }}
        >
          <div
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1.5px solid #bfdbfe",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h5
              style={{
                margin: 0,
                fontFamily: "'Playfair Display',serif",
                color: "#1a56db",
                fontSize: 18,
              }}
            >
              {spot.spot_name}
            </h5>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                fontSize: 22,
                cursor: "pointer",
                color: "#666",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
          <div style={{ padding: "1.25rem" }}>
            {spot.spot_image && (
              <div style={{ textAlign: "center", marginBottom: 12 }}>
                <img
                  src={spot.spot_image}
                  alt={spot.spot_name}
                  style={{ maxWidth: "70%", borderRadius: 12 }}
                />
              </div>
            )}
            <p
              style={{
                fontSize: 14,
                color: "#334155",
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
              textAlign: "right",
            }}
          >
            <button className="ta-btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Nav Modal ────────────────────────────────────────────────────────────────
function NavModal({
  open,
  onClose,
  initialAddress,
  initialName,
}: {
  open: boolean;
  onClose: () => void;
  initialAddress: string;
  initialName: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [searchVal, setSearchVal] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [gpsState, setGpsState] = useState<"acquiring" | "got" | "denied">("acquiring");
  const [gpsText, setGpsText] = useState("Getting your location…");
  const [destName, setDestName] = useState("");
  const [canStart, setCanStart] = useState(false);
  const [startLabel, setStartLabel] = useState("Select a destination first");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setSearchVal("");
      setSearchResults([]);
      setShowDrop(false);
      setCanStart(false);
      setStartLabel("Select a destination first");
      if (initialName && initialAddress) {
        setSearchVal(`${initialName} — ${initialAddress}`);
        setDestName(initialName);
        setStartLabel("Resolving destination…");
        // Simulate geocoding delay
        setTimeout(() => {
          setStartLabel(`Navigate to ${initialName}`);
          setCanStart(true);
        }, 1200);
      }
    }
  }, [open, initialAddress, initialName]);

  const handleSearch = (val: string) => {
    setSearchVal(val);
    setCanStart(false);
    setStartLabel("Select a destination first");
    if (timerRef.current) clearTimeout(timerRef.current);
    if (val.length < 3) { setShowDrop(false); return; }
    timerRef.current = setTimeout(async () => {
      setShowDrop(true);
      setSearchResults([{ loading: true }]);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val + " Philippines")}&limit=5&countrycodes=ph`,
          { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json();
        setSearchResults(data);
      } catch {
        setSearchResults([]);
      }
    }, 400);
  };

  const pickResult = (r: any) => {
    const name = r.display_name.split(",")[0];
    setSearchVal(name);
    setShowDrop(false);
    setDestName(name);
    setCanStart(true);
    setStartLabel(`Navigate to ${name}`);
  };

  if (!open) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 1040,
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          zIndex: 1050,
          width: "90%",
          maxWidth: 860,
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1.5px solid #bfdbfe",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1.5px solid #bfdbfe",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#fff",
            }}
          >
            <h5
              style={{
                margin: 0,
                fontFamily: "'Playfair Display',serif",
                color: "#1a56db",
                fontSize: 18,
              }}
            >
              <i
                className="fa-solid fa-location-arrow"
                style={{ color: "#6366f1", fontSize: 14, marginRight: 8 }}
              ></i>
              Navigate to Spot
            </h5>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                fontSize: 22,
                cursor: "pointer",
                color: "#666",
              }}
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div style={{ position: "relative", height: 520, overflow: "hidden" }}>
            {/* Map placeholder */}
            <div
              ref={mapRef}
              style={{
                position: "absolute",
                inset: 0,
                background: "#e8f0fe",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6b8ab8",
                fontSize: 14,
              }}
            >
              <div style={{ textAlign: "center" }}>
                <i
                  className="fas fa-map"
                  style={{ fontSize: 48, color: "#bfdbfe", marginBottom: 12, display: "block" }}
                ></i>
                Map renders here (MapLibre GL)
              </div>
            </div>

            {/* Idle overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 80,
                background: "rgba(15,23,42,0.3)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 20,
                backdropFilter: "blur(3px)",
              }}
            >
              <div
                style={{
                  background: "#fff",
                  borderRadius: 20,
                  width: "100%",
                  maxWidth: 440,
                  padding: "24px 20px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#0f172a",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <i
                    className="fa-solid fa-location-arrow"
                    style={{ color: "#6366f1", fontSize: 15 }}
                  ></i>
                  Navigator
                </div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: -4 }}>
                  {destName ? `Navigating to: ${destName}` : "Navigate to the selected tourist spot"}
                </div>

                {/* GPS chip */}
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    width: "fit-content",
                    background: gpsState === "got" ? "#dcfce7" : gpsState === "denied" ? "#fee2e2" : "#fef9c3",
                    color: gpsState === "got" ? "#166534" : gpsState === "denied" ? "#991b1b" : "#854d0e",
                    border: `1px solid ${gpsState === "got" ? "#86efac" : gpsState === "denied" ? "#fca5a5" : "#fde047"}`,
                  }}
                >
                  <i
                    className={`fa-solid ${gpsState === "acquiring" ? "fa-spinner fa-spin" : gpsState === "got" ? "fa-check" : "fa-triangle-exclamation"}`}
                  ></i>{" "}
                  {gpsText}
                </div>

                {/* Search */}
                <div style={{ position: "relative" }}>
                  <i
                    className="fa-solid fa-magnifying-glass"
                    style={{
                      position: "absolute",
                      left: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#94a3b8",
                      fontSize: 13,
                      pointerEvents: "none",
                    }}
                  ></i>
                  <input
                    type="text"
                    value={searchVal}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Or type a location..."
                    autoComplete="off"
                    style={{
                      width: "100%",
                      padding: "11px 14px 11px 36px",
                      border: "1.5px solid #e2e8f0",
                      borderRadius: 10,
                      fontSize: 14,
                      color: "#0f172a",
                      background: "#f8fafc",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  {showDrop && searchResults.length > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: 0,
                        right: 0,
                        background: "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        maxHeight: 180,
                        overflowY: "auto",
                        zIndex: 200,
                        boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
                      }}
                    >
                      {searchResults[0]?.loading ? (
                        <div style={{ padding: 16, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                          <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }}></i>
                          Searching…
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                          No results found.
                        </div>
                      ) : (
                        searchResults.map((r: any, i: number) => (
                          <div
                            key={i}
                            onClick={() => pickResult(r)}
                            style={{
                              padding: "10px 14px",
                              borderBottom: "1px solid #f1f5f9",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background = "#f8fafc")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = "")
                            }
                          >
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                background: "#eff6ff",
                                color: "#1a56db",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 13,
                                flexShrink: 0,
                              }}
                            >
                              <i className="fa-solid fa-location-dot"></i>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", display: "block" }}>
                                {r.display_name?.split(",")[0]}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: "#64748b",
                                  display: "block",
                                  marginTop: 2,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {r.display_name}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Start button */}
                <button
                  disabled={!canStart}
                  style={{
                    width: "100%",
                    padding: 13,
                    background: canStart ? "#6366f1" : "#e2e8f0",
                    color: canStart ? "#fff" : "#94a3b8",
                    border: "none",
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: canStart ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxSizing: "border-box",
                    transition: "background 0.2s",
                  }}
                >
                  <i className="fa-solid fa-location-dot"></i>
                  {startLabel}
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "0.75rem 1.25rem",
              borderTop: "1.5px solid #bfdbfe",
              textAlign: "right",
              background: "#fff",
            }}
          >
            <button className="ta-btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Topbar Search Dropdown ───────────────────────────────────────────────────
function TopbarSearch({
  onSearch,
}: {
  onSearch: (keyword: string) => void;
}) {
  const [val, setVal] = useState("");
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (val.trim()) onSearch(val.trim());
  };
  return (
    <form onSubmit={handleSubmit} style={{ display: "flex" }}>
      <input
        type="text"
        name="keyword"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Search tourist spot..."
        style={{
          border: "1px solid #d1d3e2",
          borderRight: "none",
          borderRadius: "5px 0 0 5px",
          padding: "7px 14px",
          fontSize: 13,
          fontFamily: "'DM Sans',sans-serif",
          background: "#f8f9fc",
          color: "#333",
          width: 280,
          outline: "none",
        }}
      />
      <button
        type="submit"
        style={{
          background: "#4e73df",
          border: "none",
          borderRadius: "0 5px 5px 0",
          padding: "7px 14px",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        <i className="fas fa-search fa-sm"></i>
      </button>
    </form>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SearchResults({
  keyword: initialKeyword = "",
  spots = [],
  username = "User",
  profile_photo,
}: SearchResultsProps) {
  const history  = useHistory();
  const location = useLocation();

  const [keyword, setKeyword]           = useState(initialKeyword);
  const [descModal, setDescModal]       = useState<TouristSpot | null>(null);
  const [navOpen, setNavOpen]           = useState(false);
  const [navAddress, setNavAddress]     = useState("");
  const [navSpotName, setNavSpotName]   = useState("");
  const [userDropOpen, setUserDropOpen] = useState(false);

  // Matches the exact route paths defined in App.tsx
  const NAV_ITEMS = [
    { icon: "fa-tachometer-alt", label: "Dashboard", path: "/userdashboard" },
    { icon: "fa-heart",          label: "Favorites",  path: "/favorite"      },
    { icon: "fa-user",           label: "Profile",    path: "/profilepage"   },
    { icon: "fa-map",            label: "Map",        path: "/mappage"       },
  ];

  const avatarSrc = profile_photo
    ? `/uploads/profile/${profile_photo}`
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=1a56db&color=fff`;

  const openNav = (address: string, spotName: string) => {
    setNavAddress(address);
    setNavSpotName(spotName);
    setNavOpen(true);
  };

  const handleSearch = (kw: string) => {
    setKeyword(kw);
    history.push(`/search?keyword=${encodeURIComponent(kw)}`);
  };

  const MAX_DESC = 100;

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
      />
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
          height:100vh; flex-shrink:0; z-index:100;
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
          transition:background 0.15s,color 0.15s;
        }
        .sidebar-nav li a:hover,
        .sidebar-nav li.active a { background:rgba(255,255,255,0.12); color:#fff; }
        .sidebar-nav li a i { width:18px; text-align:center; font-size:14px; }

        #content-wrapper {
          flex:1; display:flex; flex-direction:column;
          height:100vh; overflow:hidden;
        }

        #topbar {
          height:65px; flex-shrink:0; background:#fff;
          box-shadow:0 2px 4px rgba(0,0,0,0.08);
          display:flex; align-items:center; padding:0 1.5rem; gap:1rem; z-index:99;
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

        #page-content { flex:1; overflow-y:auto; padding:1.5rem; }

        /* ── Page heading ── */
        .ta-page-heading { margin-bottom:1.5rem; }
        .ta-page-heading h1 { font-family:'Playfair Display',serif; font-size:22px; color:#1e3a8a; margin:0 0 4px; }
        .ta-page-heading p { font-size:13px; color:#6b8ab8; margin:0; }

        /* ── Card section ── */
        .ta-card-section { background:#fff; border-radius:16px; border:1.5px solid #bfdbfe; box-shadow:0 2px 8px rgba(26,86,219,0.07); overflow:hidden; }
        .ta-card-header { background:#fff; border-bottom:1.5px solid #bfdbfe; padding:1rem 1.25rem; display:flex; align-items:center; gap:10px; }
        .ta-section-title { font-family:'Playfair Display',serif; font-size:18px; color:#1a56db; margin:0; border-left:4px solid #1a56db; padding-left:12px; }
        .ta-card-body { padding:1.25rem; background:#fff; }

        /* ── Spot cards grid ── */
        .ta-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(290px,1fr)); gap:1.5rem; }
        .ta-card { background:#fff; border-radius:16px; overflow:hidden; border:1.5px solid #bfdbfe; transition:transform 0.2s,box-shadow 0.2s; }
        .ta-card:hover { transform:translateY(-4px); box-shadow:0 8px 24px rgba(26,86,219,0.12); }
        .ta-card img { width:100%; height:190px; object-fit:cover; display:block; }
        .ta-card-inner { padding:1.25rem; }
        .ta-card-title { font-family:'Playfair Display',serif; font-size:17px; color:#1e3a8a; margin:0 0 0.4rem; }
        .ta-card-desc { font-size:13px; color:#475569; line-height:1.55; margin:0 0 0.75rem; }

        /* ── Badge ── */
        .ta-badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:500; letter-spacing:0.03em; margin-bottom:6px; }
        .badge-beach      { background:#e0f2fe; color:#0369a1; }
        .badge-mountain   { background:#dcfce7; color:#166534; }
        .badge-historical { background:#fef9c3; color:#854d0e; }
        .badge-park       { background:#f0fdf4; color:#15803d; }
        .badge-museum     { background:#ede9fe; color:#5b21b6; }
        .badge-festival   { background:#fff1f2; color:#9f1239; }
        .badge-other      { background:#f1f5f9; color:#475569; }

        /* ── Count badge ── */
        .ta-count-badge { background:#eff6ff; border:1px solid #bfdbfe; color:#1a56db; border-radius:20px; padding:3px 12px; font-size:12px; font-weight:500; }

        /* ── Location link ── */
        .ta-location-link { font-size:12px; color:#1a56db; font-weight:500; text-decoration:none; display:inline-flex; align-items:center; gap:5px; background:none; border:none; cursor:pointer; padding:0; font-family:'DM Sans',sans-serif; }
        .ta-location-link:hover { text-decoration:underline; }

        /* ── See more ── */
        .see-more-btn { background:none; border:none; padding:0; color:#1a56db; font-size:12px; font-weight:500; cursor:pointer; font-family:'DM Sans',sans-serif; }
        .see-more-btn:hover { text-decoration:underline; }

        /* ── Buttons ── */
        .ta-btn-secondary { background:#fff; border:1.5px solid #bfdbfe; color:#1a56db; border-radius:8px; padding:8px 22px; font-size:13px; font-weight:500; cursor:pointer; font-family:'DM Sans',sans-serif; }
        .ta-btn-secondary:hover { background:#eff6ff; }

        /* ── Empty state ── */
        .ta-empty { text-align:center; padding:3rem 1rem; color:#6b8ab8; }
        .ta-empty i { font-size:48px; color:#bfdbfe; display:block; margin-bottom:1rem; }
        .ta-empty p { font-size:14px; color:#94a3b8; margin:0; }
      `}</style>

      <DescModal spot={descModal} onClose={() => setDescModal(null)} />
      <NavModal
        open={navOpen}
        onClose={() => setNavOpen(false)}
        initialAddress={navAddress}
        initialName={navSpotName}
      />

      <div id="wrapper">

        {/* ── SIDEBAR ── */}
        <div id="sidebar">
          <a
            className="sidebar-brand"
            href="#"
            onClick={(e) => { e.preventDefault(); history.push("/userdashboard"); }}
          >
            <span className="sidebar-brand-icon">
              <i className="fas fa-laugh-wink"></i>
            </span>
            <span className="sidebar-brand-text">
              <em><b>TOUR_</b></em>ISTA
            </span>
          </a>
          <hr className="sidebar-divider" />
          <ul className="sidebar-nav">
            {NAV_ITEMS.map(({ icon, label, path }) => (
              <li key={label} className={location.pathname === path ? "active" : ""}>
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); history.push(path); }}
                >
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
            <TopbarSearch onSearch={handleSearch} />
            <div className="topbar-right">
              <div className="topbar-divider" />
              <div
                className="user-area"
                onClick={() => setUserDropOpen((o) => !o)}
              >
                <span>
                  <b>{username}</b>
                </span>
                <img src={avatarSrc} alt="avatar" />
                {userDropOpen && (
                  <div className="user-dropdown">
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); history.push("/login"); }}
                    >
                      <i
                        className="fas fa-sign-out-alt fa-sm fa-fw"
                        style={{ color: "#aaa" }}
                      ></i>{" "}
                      Logout
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Page content */}
          <div id="page-content">

            {/* Page heading */}
            <div className="ta-page-heading">
              <h1>
                <i
                  className="fas fa-search"
                  style={{ fontSize: 18, color: "#1a56db", marginRight: 8 }}
                ></i>
                Search Results
              </h1>
              <p>
                Showing results for{" "}
                <strong style={{ color: "#1e3a8a" }}>"{keyword}"</strong>
              </p>
            </div>

            {/* Results section */}
            <div className="ta-card-section">
              <div className="ta-card-header">
                <h6 className="ta-section-title">Tourist Spots Found</h6>
                {spots.length > 0 && (
                  <span className="ta-count-badge" style={{ marginLeft: "auto" }}>
                    {spots.length} result{spots.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="ta-card-body">
                {spots.length > 0 ? (
                  <div className="ta-grid">
                    {spots.map((spot) => {
                      const cat = spot.category || "Other";
                      const badgeClass = getBadgeClass(cat);
                      const truncated = spot.description.length > MAX_DESC;
                      const shortDesc = truncated
                        ? spot.description.slice(0, MAX_DESC) + "..."
                        : spot.description;

                      return (
                        <div className="ta-card" key={spot.spot_id}>
                          {spot.spot_image && (
                            <img
                              src={spot.spot_image}
                              alt={spot.spot_name}
                            />
                          )}
                          <div className="ta-card-inner">
                            <span className={`ta-badge ${badgeClass}`}>
                              {cat}
                            </span>
                            <div className="ta-card-title">{spot.spot_name}</div>
                            <div className="ta-card-desc">
                              {shortDesc}
                              {truncated && (
                                <>
                                  {" "}
                                  <button
                                    className="see-more-btn"
                                    onClick={() => setDescModal(spot)}
                                  >
                                    See more
                                  </button>
                                </>
                              )}
                            </div>
                            <button
                              className="ta-location-link"
                              onClick={() => openNav(spot.location, spot.spot_name)}
                            >
                              📍 {spot.location}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="ta-empty">
                    <i className="fas fa-search"></i>
                    <p>No tourist spots found for "{keyword}".</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}