import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Trash2, AlertTriangle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";

interface ProfileAvatarUploadProps {
  avatarUrl: string | null;
  userName: string;
  onAvatarChange: (url: string | null) => void;
  size?: "sm" | "md" | "lg";
}

const AVATAR_POLICIES = [
  "No se permiten datos personales (cédula, dirección, etc.)",
  "No se permiten códigos QR",
  "No se permiten cuentas de redes sociales",
  "No se permiten números de teléfono ni correos",
  "Solo fotos personales o logos de emprendimiento",
];

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export default function ProfileAvatarUpload({ avatarUrl, userName, onAvatarChange, size = "md" }: ProfileAvatarUploadProps) {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: "h-14 w-14",
    md: "h-20 w-20",
    lg: "h-28 w-28",
  };

  const iconSize = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const initials = (userName || "?")
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate type
    if (!file.type.startsWith("image/")) {
      toast({ title: "Solo se permiten imágenes", variant: "destructive" });
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "La imagen debe ser menor a 2MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${user.id}/avatar.${ext}`;

      // Delete old avatar if exists
      await supabase.storage.from("avatars").remove([`${user.id}/avatar.jpg`, `${user.id}/avatar.png`, `${user.id}/avatar.webp`, `${user.id}/avatar.jpeg`]);

      // Upload new
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl + `?t=${Date.now()}`;

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl } as any)
        .eq("id", user.id);

      if (updateError) throw updateError;

      onAvatarChange(publicUrl);
      await refreshProfile();
      toast({ title: "✅ Foto actualizada" });
    } catch (err: any) {
      toast({ title: "Error al subir imagen", description: err.message, variant: "destructive" });
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      await supabase.storage.from("avatars").remove([`${user.id}/avatar.jpg`, `${user.id}/avatar.png`, `${user.id}/avatar.webp`, `${user.id}/avatar.jpeg`]);
      await supabase.from("profiles").update({ avatar_url: null } as any).eq("id", user.id);
      onAvatarChange(null);
      await refreshProfile();
      toast({ title: "Foto eliminada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setDeleting(false);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative group">
        <Avatar className={`${sizeClasses[size]} border-2 border-border shadow-sm`}>
          {avatarUrl && <AvatarImage src={avatarUrl} alt={userName} className="object-cover" />}
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* Upload overlay */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
        >
          {uploading ? (
            <Loader2 className={`${iconSize[size]} text-white animate-spin`} />
          ) : (
            <Camera className={`${iconSize[size]} text-white`} />
          )}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="text-[10px] h-7 gap-1 rounded-sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
          {avatarUrl ? "Cambiar" : "Subir foto"}
        </Button>

        {avatarUrl && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1 rounded-sm text-destructive border-destructive/30" disabled={deleting}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar foto de perfil?</AlertDialogTitle>
                <AlertDialogDescription>Se eliminará tu foto actual y se mostrará tu inicial.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={handleDelete}>
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Content policy */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3 max-w-[280px]">
        <p className="text-[10px] font-semibold text-amber-700 flex items-center gap-1 mb-1.5">
          <AlertTriangle className="h-3 w-3 shrink-0" /> Políticas de imagen
        </p>
        <ul className="space-y-0.5">
          {AVATAR_POLICIES.map((p, i) => (
            <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
              <span className="text-amber-600 shrink-0">•</span>
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
