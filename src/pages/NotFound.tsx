import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-7xl font-heading font-bold text-primary">404</p>
          <h1 className="text-xl font-heading font-bold text-foreground">Página no encontrada</h1>
          <p className="text-sm text-muted-foreground">
            Lo sentimos, la página que buscas no existe o fue movida.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" className="rounded-sm" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Volver
            </Button>
            <Button size="sm" asChild className="bg-primary text-primary-foreground rounded-sm">
              <Link to="/"><Home className="h-4 w-4 mr-1" /> Ir al Inicio</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default NotFound;
