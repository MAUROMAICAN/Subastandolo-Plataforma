import { forwardRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, Grid3X3, ShoppingBag, Menu } from "lucide-react";

const tabs = [
  { label: "Inicio", icon: Home, path: "/" },
  { label: "Subastas", icon: Grid3X3, path: "/#subastas" },
  { label: "Compras", icon: ShoppingBag, path: "/mi-panel" },
  { label: "Más", icon: Menu, path: "/menu" },
];

const BottomNav = forwardRef<HTMLElement>((_, ref) => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    if (path === "/#subastas") return false;
    return location.pathname === path;
  };

  const handleClick = (path: string) => {
    if (path === "/#subastas") {
      if (location.pathname === "/") {
        document.getElementById("subastas")?.scrollIntoView({ behavior: "smooth" });
      } else {
        navigate("/");
        setTimeout(() => {
          document.getElementById("subastas")?.scrollIntoView({ behavior: "smooth" });
        }, 300);
      }
    } else {
      navigate(path);
    }
  };

  return (
    <nav ref={ref} className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => handleClick(tab.path)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {active && (
                <div className="absolute top-0 left-1/3 right-1/3 h-[2px] bg-primary rounded-b-full" />
              )}
              <tab.icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.5} />
              <span className={`text-[10px] leading-tight ${active ? "font-bold" : "font-medium"}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});

BottomNav.displayName = "BottomNav";

export default BottomNav;
