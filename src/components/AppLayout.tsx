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

        /* ✅ DAGDAG ITO — force show hamburger sa Capacitor/native */
        ${isMobile ? `
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
          .hamburger-btn {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
        ` : ""}
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