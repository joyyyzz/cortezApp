import React, { useState, useEffect, useRef } from 'react';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
export interface UserSession {
  username: string;
  profile_photo: string | null; // URL or null
}

// ─────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────
interface SidebarProps {
  activePage: 'dashboard' | 'favorite' | 'profilepage' | 'mappage';
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage }) => {
  const navItems = [
    { key: 'dashboard',   href: '/userdashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' },
    { key: 'favorite',    href: '/favorite',       icon: 'fa-heart',          label: 'Favorites' },
    { key: 'profilepage', href: '/profilepage',    icon: 'fa-user',           label: 'Profile' },
    { key: 'mappage',     href: '/mappage',        icon: 'fa-map',            label: 'Map' },
  ];

  return (
    <ul className="navbar-nav bg-gradient-primary sidebar sidebar-dark accordion" id="accordionSidebar">
      {/* Brand — NOT clickable */}
      <div className="sidebar-brand d-flex align-items-center justify-content-center" style={{ cursor: 'default' }}>
        <div className="sidebar-brand-icon rotate-n-15">
          <i className="fas fa-laugh-wink"></i>
        </div>
        <div className="sidebar-brand-text mx-3"><em><b>TOUR_</b></em>ista</div>
      </div>

      {navItems.map((item) => (
        <li key={item.key} className={`nav-item${activePage === item.key ? ' active' : ''}`}>
          <a className="nav-link" href={item.href}>
            <i className={`fas fa-fw ${item.icon}`}></i>
            <span>{item.label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
};

// ─────────────────────────────────────────
// Topbar
// ─────────────────────────────────────────
interface TopbarProps {
  user: UserSession;
}

export const Topbar: React.FC<TopbarProps> = ({ user }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <style>{`
        .topbar-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          background: #fff;
          border-radius: 10px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.12);
          min-width: 160px;
          z-index: 1000;
          overflow: hidden;
          border: 1px solid #e3e6f0;
          animation: fadeInDown 0.15s ease;
        }
        .topbar-dropdown a {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          font-size: 13px;
          color: #374151;
          text-decoration: none;
          transition: background 0.12s;
        }
        .topbar-dropdown a:hover {
          background: #f3f4f6;
          color: #1a56db;
        }
        .topbar-dropdown .dropdown-divider {
          height: 1px;
          background: #e3e6f0;
          margin: 0;
        }
        .topbar-avatar-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          background: none;
          border: none;
          padding: 4px 8px;
          border-radius: 8px;
          transition: background 0.12s;
        }
        .topbar-avatar-btn:hover { background: #f3f4f6; }
        .topbar-avatar-img {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #e3e6f0;
        }
        .topbar-avatar-placeholder {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #1a56db;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          border: 2px solid #e3e6f0;
          flex-shrink: 0;
        }
        .topbar-username {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          max-width: 120px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <nav className="navbar navbar-expand navbar-light bg-white topbar mb-4 static-top shadow" style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        {/* Search — fixed width, does NOT grow */}
        <div className="d-none d-sm-inline-block form-inline ml-md-3 my-2 my-md-0 navbar-search" style={{ width: '300px', flexShrink: 0 }}>
          <div className="input-group">
            <input
              type="text"
              className="form-control bg-light border-0 small"
              placeholder="Search tourist spot..."
            />
            <div className="input-group-append">
              <button className="btn btn-primary" type="button">
                <i className="fas fa-search fa-sm"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Spacer — pushes user to far right */}
        <div style={{ flex: 1 }}></div>

        {/* User Dropdown — far right */}
        <ul className="navbar-nav" style={{ marginRight: '1rem' }}>
          <li className="nav-item dropdown no-arrow">
            <div style={{ position: 'relative' }} ref={dropdownRef}>
              <button
                className="topbar-avatar-btn"
                onClick={() => setDropdownOpen((o) => !o)}
              >
                <span className="topbar-username">{user.username || 'User'}</span>
                {user.profile_photo ? (
                  <img
                    src={user.profile_photo}
                    alt={user.username}
                    className="topbar-avatar-img"
                  />
                ) : (
                  <div className="topbar-avatar-placeholder">
                    <i className="fas fa-user fa-sm"></i>
                  </div>
                )}
              </button>

              {dropdownOpen && (
                <div className="topbar-dropdown">
                  <a href="/profilepage">
                    <i className="fas fa-user fa-sm text-gray-400"></i>
                    Profile
                  </a>
                  <div className="dropdown-divider"></div>
                  <a href="/index.php/user/logout">
                    <i className="fas fa-sign-out-alt fa-sm text-gray-400"></i>
                    Logout
                  </a>
                </div>
              )}
            </div>
          </li>
        </ul>
      </nav>
    </>
  );
};