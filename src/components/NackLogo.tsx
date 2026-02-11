import { cn } from "@/lib/utils";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

interface NackLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showAdminButton?: boolean;
  pulse?: boolean;
  variant?: "nack" | "affiliate";
}

const NackLogo = ({ className, size = "md", showAdminButton = true, pulse = false, variant = "nack" }: NackLogoProps) => {
  const [showAdminAccess, setShowAdminAccess] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const sizeClasses = {
    sm: "h-8 w-auto",
    md: "h-12 w-auto",
    lg: "h-16 w-auto",
    xl: "h-24 w-auto"
  };

  const handleDoubleClick = () => {
    if (showAdminButton && user) {
      setShowAdminAccess(true);
      // Masquer après 5 secondes
      setTimeout(() => setShowAdminAccess(false), 5000);
    }
  };

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <img
        src={variant === "affiliate" ? "/Design sans titre12.svg" : "/Design sans titre.svg"}
        alt="nack! logo"
        className={cn(
          "object-contain animate-fade-in cursor-pointer",
          sizeClasses[size],
          pulse && "animate-pulse brightness-110",
          className
        )}
        onDoubleClick={handleDoubleClick}
        title={showAdminButton ? "Double-cliquez pour accès admin" : undefined}
      />

      {showAdminAccess && showAdminButton && user && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="bg-white border-2 border-blue-500 rounded-lg shadow-xl p-3 flex flex-col gap-2 min-w-[200px]">
            <p className="text-xs font-semibold text-blue-900 text-center">Accès Admin</p>
            <Button
              size="sm"
              variant="default"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                navigate('/admin-check');
                setShowAdminAccess(false);
              }}
            >
              <Shield size={14} className="mr-2" />
              Vérifier Admin
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-blue-500 text-blue-600 hover:bg-blue-50"
              onClick={() => {
                navigate('/admin');
                setShowAdminAccess(false);
              }}
            >
              Tableau Admin
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground"
              onClick={() => setShowAdminAccess(false)}
            >
              Fermer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NackLogo;