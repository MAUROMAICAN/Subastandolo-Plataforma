import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const BackButton = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 pt-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="text-muted-foreground hover:text-foreground gap-1.5"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Button>
    </div>
  );
};

export default BackButton;
