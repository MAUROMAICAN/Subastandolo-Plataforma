import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import BackButton from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, CheckCircle, XCircle, Clock, Send, User, Camera, CreditCard,
  Home, Instagram, FileCheck, Upload, X, ImageIcon
} from "lucide-react";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface FileUploadProps {
  label: string;
  hint: string;
  file: File | null;
  preview: string | null;
  onSelect: (f: File | null) => void;
  icon: React.ReactNode;
}

const FileUploadField = ({ label, hint, file, preview, onSelect, icon }: FileUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ACCEPTED_TYPES.includes(f.type)) {
      alert("Solo se permiten imágenes JPG, PNG o WEBP.");
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      alert("El archivo no puede superar 5MB.");
      return;
    }
    onSelect(f);
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium flex items-center gap-1.5">
        {icon} {label} *
      </Label>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      {preview ? (
        <div className="relative w-full max-w-xs">
          <img src={preview} alt="Preview" className="w-full rounded-sm border border-border object-cover max-h-48" />
          <button
            type="button"
            onClick={() => { onSelect(null); if (inputRef.current) inputRef.current.value = ""; }}
            className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <label className="flex items-center gap-2 px-4 py-3 rounded-sm border border-dashed border-primary/40 text-sm text-primary cursor-pointer hover:bg-primary/5 transition-colors justify-center">
          <Upload className="h-4 w-4" />
          <span>Seleccionar imagen</span>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleChange} />
        </label>
      )}
    </div>
  );
};

const DealerApply = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [cedulaNumber, setCedulaNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  // File states
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [cedulaFrontFile, setCedulaFrontFile] = useState<File | null>(null);
  const [cedulaFrontPreview, setCedulaFrontPreview] = useState<string | null>(null);
  const [cedulaBackFile, setCedulaBackFile] = useState<File | null>(null);
  const [cedulaBackPreview, setCedulaBackPreview] = useState<string | null>(null);
  const [addressProofFile, setAddressProofFile] = useState<File | null>(null);
  const [addressProofPreview, setAddressProofPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const fetchApplication = async () => {
      const { data } = await supabase
        .from("dealer_verification")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setApplication(data);
      if (profile?.phone) setPhone(profile.phone);
      if (profile?.full_name) setFullName(profile.full_name);
      setLoading(false);
    };
    fetchApplication();
  }, [user, profile]);

  // Generate previews
  const setFileWithPreview = (
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void
  ) => (file: File | null) => {
    setFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  const uploadFile = async (file: File, type: string): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/${type}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("dealer-documents").upload(path, file);
    if (error) throw error;
    return path;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validations
    if (!selfieFile || !cedulaFrontFile || !cedulaBackFile || !addressProofFile) {
      toast({ title: "Faltan documentos", description: "Debes subir todos los documentos requeridos.", variant: "destructive" });
      return;
    }
    if (!termsAccepted) {
      toast({ title: "Términos requeridos", description: "Debes aceptar los términos y condiciones.", variant: "destructive" });
      return;
    }
    if (instagramUrl && !/^https?:\/\/(www\.)?instagram\.com\/.+/i.test(instagramUrl)) {
      toast({ title: "URL inválida", description: "Ingresa una URL de Instagram válida.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    setUploadProgress(10);

    try {
      // Upload files
      const selfieUrl = await uploadFile(selfieFile, "selfie");
      setUploadProgress(30);
      const cedulaFrontUrl = await uploadFile(cedulaFrontFile, "cedula_front");
      setUploadProgress(50);
      const cedulaBackUrl = await uploadFile(cedulaBackFile, "cedula_back");
      setUploadProgress(70);
      const addressProofUrl = await uploadFile(addressProofFile, "address_proof");
      setUploadProgress(90);

      const { error } = await supabase.from("dealer_verification").insert({
        user_id: user.id,
        business_name: businessName,
        business_description: businessDescription || null,
        phone,
        full_name: fullName,
        birth_date: birthDate || null,
        cedula_number: cedulaNumber,
        selfie_url: selfieUrl,
        cedula_front_url: cedulaFrontUrl,
        cedula_back_url: cedulaBackUrl,
        address_proof_url: addressProofUrl,
        instagram_url: instagramUrl || null,
        terms_accepted: termsAccepted,
      } as any);

      if (error) throw error;

      setUploadProgress(100);
      toast({ title: "¡Solicitud enviada!", description: "Un administrador revisará tu verificación pronto." });

      const { data } = await supabase
        .from("dealer_verification")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setApplication(data);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSubmitting(false);
    setUploadProgress(0);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <BackButton />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-xl font-heading font-bold mb-6">Verificación de Dealer — Fase 1</h1>

        {application ? (
          <Card className="border border-border rounded-sm">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                {application.status === "pending" && (
                  <>
                    <Clock className="h-8 w-8 text-warning" />
                    <div>
                      <h2 className="font-heading font-bold text-lg">Solicitud en revisión</h2>
                      <p className="text-sm text-muted-foreground">Tu verificación está siendo evaluada por un administrador.</p>
                    </div>
                  </>
                )}
                {application.status === "approved" && (
                  <>
                    <CheckCircle className="h-8 w-8 text-primary" />
                    <div>
                      <h2 className="font-heading font-bold text-lg text-primary">¡Aprobada!</h2>
                      <p className="text-sm text-muted-foreground">Ya puedes crear subastas. Ve a tu panel de dealer.</p>
                    </div>
                  </>
                )}
                {application.status === "rejected" && (
                  <>
                    <XCircle className="h-8 w-8 text-destructive" />
                    <div>
                      <h2 className="font-heading font-bold text-lg text-destructive">Rechazada</h2>
                      <p className="text-sm text-muted-foreground">
                        {application.admin_notes || "Tu solicitud fue rechazada. Puedes intentar nuevamente."}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="bg-secondary/50 rounded-sm p-3 text-sm space-y-1">
                <p><strong>Nombre:</strong> {application.full_name || application.business_name}</p>
                <p><strong>Negocio:</strong> {application.business_name}</p>
                <p><strong>Teléfono:</strong> {application.phone}</p>
                <p><strong>Fecha:</strong> {new Date(application.created_at).toLocaleDateString("es-MX")}</p>
              </div>

              {application.status === "approved" && (
                <Button onClick={() => navigate("/dealer")} className="w-full bg-primary text-primary-foreground rounded-sm">
                  Ir a mi Panel de Dealer
                </Button>
              )}

              {application.status === "rejected" && (
                <Button onClick={() => setApplication(null)} variant="outline" className="w-full rounded-sm">
                  Enviar nueva solicitud
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Datos Personales */}
            <Card className="border border-border rounded-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-heading flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  1. Datos Personales
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nombre completo *</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Nombre y apellido" className="rounded-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fecha de nacimiento *</Label>
                    <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required className="rounded-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Número de cédula *</Label>
                    <Input value={cedulaNumber} onChange={(e) => setCedulaNumber(e.target.value)} required placeholder="Ej: V16480075" className="rounded-sm" />
                    <p className="text-[11px] text-muted-foreground">Formato: V o E seguido de los números. Ej: V16480075</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Teléfono WhatsApp *</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="Ej: +58 412 1234567" className="rounded-sm" />
                    <p className="text-[11px] text-muted-foreground">Incluye código de país. Ej: +58 412 1234567</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nombre que aparecerá en tu identificador de dealer *</Label>
                  <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required placeholder="Ej: maurovip" className="rounded-sm" />
                  <p className="text-[11px] text-muted-foreground">Este será tu nombre público como dealer en la plataforma.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Propuesta de valor</Label>
                  <Textarea value={businessDescription} onChange={(e) => setBusinessDescription(e.target.value)} placeholder="Escribe una breve propuesta de por qué es mejor comprar en tus subastas." rows={3} className="rounded-sm" />
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Selfie */}
            <Card className="border border-border rounded-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-heading flex items-center gap-2">
                  <Camera className="h-4 w-4 text-primary" />
                  2. Selfie de Verificación
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-secondary/50 rounded-sm p-4 space-y-3">
                  <p className="text-xs font-medium">Guía para tu Selfie de Verificación</p>
                  <p className="text-[11px] text-muted-foreground">Sigue estos pasos para que tu cuenta sea aprobada en menos de 24 horas.</p>
                  <ul className="text-[11px] text-muted-foreground space-y-2 list-none">
                    <li className="flex gap-2"><span className="text-primary font-bold">•</span><span><strong>Sin accesorios:</strong> Retira gorras, lentes de sol o mascarillas. Tu rostro debe estar totalmente visible.</span></li>
                    <li className="flex gap-2"><span className="text-primary font-bold">•</span><span><strong>Sujeta tu Cédula:</strong> Sostén tu documento de identidad original a un lado de tu cara (sin tapar tu rostro).</span></li>
                    <li className="flex gap-2"><span className="text-primary font-bold">•</span><span><strong>Claridad total:</strong> Asegúrate de que los datos de la cédula y tu rostro estén enfocados. Si el texto del documento no se lee, no podremos verificarlo.</span></li>
                    <li className="flex gap-2"><span className="text-primary font-bold">•</span><span><strong>Fondo Neutro:</strong> De preferencia, colócate frente a una pared de color claro y con buena luz natural.</span></li>
                  </ul>
                  <div className="flex items-start gap-2 bg-warning/10 border border-warning/30 rounded-sm p-2.5">
                    <span className="text-warning text-xs mt-0.5">⚠️</span>
                    <p className="text-[11px] text-muted-foreground"><strong>Importante:</strong> No aceptamos fotocopias, fotos de pantallas ni imágenes editadas digitalmente. El documento debe ser el físico original.</p>
                  </div>
                </div>
                <FileUploadField
                  label="Selfie sosteniendo tu cédula"
                  hint="Sube tu selfie siguiendo la guía anterior."
                  file={selfieFile}
                  preview={selfiePreview}
                  onSelect={setFileWithPreview(setSelfieFile, setSelfiePreview)}
                  icon={<Camera className="h-3.5 w-3.5" />}
                />
              </CardContent>
            </Card>

            {/* Section 3: Cédula */}
            <Card className="border border-border rounded-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-heading flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  3. Cédula de Identidad
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FileUploadField
                  label="Foto frontal de la cédula"
                  hint="Foto nítida del anverso de tu cédula de identidad."
                  file={cedulaFrontFile}
                  preview={cedulaFrontPreview}
                  onSelect={setFileWithPreview(setCedulaFrontFile, setCedulaFrontPreview)}
                  icon={<ImageIcon className="h-3.5 w-3.5" />}
                />
                <FileUploadField
                  label="Foto reverso de la cédula"
                  hint="Foto nítida del reverso de tu cédula de identidad."
                  file={cedulaBackFile}
                  preview={cedulaBackPreview}
                  onSelect={setFileWithPreview(setCedulaBackFile, setCedulaBackPreview)}
                  icon={<ImageIcon className="h-3.5 w-3.5" />}
                />
              </CardContent>
            </Card>

            {/* Section 4: Comprobante de Domicilio */}
            <Card className="border border-border rounded-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-heading flex items-center gap-2">
                  <Home className="h-4 w-4 text-primary" />
                  4. Comprobante de Domicilio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FileUploadField
                  label="Recibo de servicios públicos"
                  hint="Sube un recibo de luz, agua, internet o estado de cuenta bancaria. No debe tener más de 3 meses de antigüedad."
                  file={addressProofFile}
                  preview={addressProofPreview}
                  onSelect={setFileWithPreview(setAddressProofFile, setAddressProofPreview)}
                  icon={<Home className="h-3.5 w-3.5" />}
                />
              </CardContent>
            </Card>

            {/* Section 5: Redes Sociales */}
            <Card className="border border-border rounded-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-heading flex items-center gap-2">
                  <Instagram className="h-4 w-4 text-primary" />
                  5. Redes Sociales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  <Label className="text-xs">Perfil de Instagram</Label>
                  <Input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/tu_perfil" className="rounded-sm" />
                  <p className="text-[11px] text-muted-foreground">Esto ayuda a verificar tu trayectoria como vendedor.</p>
                </div>
              </CardContent>
            </Card>

            {/* Section 6: Términos */}
            <Card className="border border-border rounded-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-heading flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-primary" />
                  6. Aceptación de Términos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-secondary/50 rounded-sm p-4 space-y-3">
                  <p className="text-xs font-medium">Declaración de Veracidad y Consentimiento de Datos</p>
                  <p className="text-[11px] text-muted-foreground">Al hacer clic en "Enviar para Verificación", usted como Dealer acepta y declara lo siguiente:</p>
                  <ul className="text-[11px] text-muted-foreground space-y-2.5 list-none">
                    <li className="flex gap-2">
                      <span className="text-primary font-bold shrink-0">1.</span>
                      <span><strong>Veracidad de la Información:</strong> Certifico que todos los datos y documentos proporcionados son auténticos, vigentes y me pertenecen legalmente. El uso de documentos falsos o de terceros es motivo de expulsión inmediata y permanente de la plataforma.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary font-bold shrink-0">2.</span>
                      <span><strong>Protección de Compradores:</strong> Entiendo que mi verificación es el primer paso para garantizar la seguridad de la comunidad. Me comprometo a describir mis productos con total honestidad y a cumplir con las entregas en los tiempos pactados.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary font-bold shrink-0">3.</span>
                      <span><strong>Tratamiento de Datos Personales:</strong> Autorizo a SUBASTA AQUI a almacenar y procesar mis documentos de identidad únicamente con fines de validación de seguridad. Mis datos sensibles (como la foto de mi cédula) no serán públicos para los compradores.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary font-bold shrink-0">4.</span>
                      <span><strong>Responsabilidad en Subastas:</strong> Acepto que cualquier intento de fraude, manipulación de pujas o incumplimiento de venta resultará en la retención de fondos y, de ser necesario, la entrega de mi información a las autoridades competentes.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary font-bold shrink-0">5.</span>
                      <span><strong>Actualización de Datos:</strong> Me comprometo a notificar cualquier cambio en mi residencia o estatus legal que pueda afectar mi perfil de vendedor.</span>
                    </li>
                  </ul>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(v) => setTermsAccepted(v === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                    He leído y acepto la Declaración de Veracidad y Consentimiento de Datos descrita anteriormente. *
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Upload progress */}
            {submitting && uploadProgress > 0 && (
              <div className="space-y-1">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">Subiendo documentos... {uploadProgress}%</p>
              </div>
            )}

            <Button type="submit" disabled={submitting} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-sm">
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enviando verificación...</> : <><Send className="h-4 w-4 mr-2" />Enviar Verificación</>}
            </Button>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default DealerApply;
