import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";

interface AppLayoutProps {
  children: React.ReactNode;
  isMobileOpen?: boolean;
  onMobileToggle?: () => void;
}

export default function AppLayout({ children, isMobileOpen, onMobileToggle }: AppLayoutProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(Capacitor.isNativePlatform() || window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <>
      <style>{`
        .app-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 99;
        }
        .app-overlay.open { display: block; }
        @media (max-width: 768px) {
          #sidebar {
            transform: translateX(-225px) !important;
            transition: transform 0.3s ease !important;
            position: fixed !important;
            z-index: 200 !important;
          }
          #sidebar.mobile-open {
            transform: translateX(0) !important;
          }
          .content-wrapper, #content-wrapper, #fav-content-wrapper {
            margin-left: 0 !important;
          }
        }
      `}</style>

      {isMobile && (
        <div
          className={`app-overlay ${isMobileOpen ? "open" : ""}`}
          onClick={onMobileToggle}
        />
      )}

      {children}
    </>
  );
}