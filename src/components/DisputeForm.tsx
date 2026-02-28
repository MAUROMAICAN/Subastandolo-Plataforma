import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle, Upload, Loader2, X, Camera, Video, Image, UserCheck } from "lucide-react";

interface DisputeFormProps {
  onSubmit: (category: string, description: string, files: File[], desiredResolution: string, signatureData: string) => Promise<any>;
  onCancel: () => void;
}

const DISPUTE_CATEGORIES = [
  { value: "no_coincide_fotos", label: "Producto no coincide con las fotos", desc: "Diferencias estéticas entre lo publicado y lo recibido." },
  { value: "defectuoso", label: "Producto defectuoso o no funciona", desc: "Falla técnica no mencionada en la publicación." },
  { value: "faltan_piezas", label: "Faltan piezas o accesorios descritos", desc: "Accesorios o componentes faltantes." },
  { value: "danado_envio", label: "El producto llegó dañado por el envío", desc: "Daños causados durante el transporte." },
];

const RESOLUTION_OPTIONS = [
  { value: "refund_full", label: "Devolución total del dinero", desc: "Retorno del producto al Dealer y reembolso completo." },
  { value: "refund_partial", label: "Reembolso parcial", desc: "Te quedas con el producto pero recibes compensación por daño menor." },
];

const DisputeForm = ({ onSubmit, onCancel }: DisputeFormProps) => {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [desiredResolution, setDesiredResolution] = useState("");
  const [productPhotos, setProductPhotos] = useState<File[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Signature: name + legal acceptance
  const [signatureName, setSignatureName] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);

  const handleProductPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setProductPhotos(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setVideoFile(e.target.files[0]);
  };

  const handleScreenshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setScreenshotFile(e.target.files[0]);
  };

  const removeProductPhoto = (index: number) => {
    setProductPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const allFiles = [
    ...productPhotos,
    ...(videoFile ? [videoFile] : []),
    ...(screenshotFile ? [screenshotFile] : []),
  ];

  const isValid =
    category &&
    description.trim() &&
    desiredResolution &&
    productPhotos.length >= 3 &&
    signatureName.trim() &&
    legalAccepted;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    const signatureData = `Firmado por: ${signatureName.trim()} — Fecha: ${new Date().toLocaleString("es-MX")}`;
    const categoryLabel = DISPUTE_CATEGORIES.find(c => c.value === category)?.label || category;
    await onSubmit(categoryLabel, description.trim(), allFiles, desiredResolution, signatureData);
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-5 w-5" />
        <h3 className="font-heading font-bold text-lg">Formulario de Apertura de Disputa</h3>
      </div>

      {/* Step 1 - Category */}
      <div className="space-y-3 bg-card border border-border rounded-sm p-4">
        <Label className="text-sm font-bold flex items-center gap-2">
          <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">1</span>
          Motivo de la Disputa
        </Label>
        <RadioGroup value={category} onValueChange={setCategory} className="space-y-2">
          {DISPUTE_CATEGORIES.map(cat => (
            <label
              key={cat.value}
              className={`flex items-start gap-3 p-3 border rounded-sm cursor-pointer transition-colors ${
                category === cat.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
              }`}
            >
              <RadioGroupItem value={cat.value} className="mt-0.5" />
              <div>
                <span className="text-sm font-medium">{cat.label}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{cat.desc}</p>
              </div>
            </label>
          ))}
        </RadioGroup>
      </div>

      {/* Step 2 - Evidence */}
      <div className="space-y-4 bg-card border border-border rounded-sm p-4">
        <Label className="text-sm font-bold flex items-center gap-2">
          <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">2</span>
          Evidencia Visual (Obligatorio)
        </Label>

        {/* Product photos - min 3 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-1">
              <Camera className="h-3.5 w-3.5" /> Fotos del producto recibido
            </span>
            <span className={`text-[10px] font-mono ${productPhotos.length >= 3 ? "text-emerald-600" : "text-destructive"}`}>
              {productPhotos.length}/3 mínimo
            </span>
          </div>
          <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-sm cursor-pointer hover:border-primary/50 transition-colors">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Subir fotos (mínimo 3 ángulos diferentes)</span>
            <input type="file" multiple accept="image/*" onChange={handleProductPhotos} className="hidden" />
          </label>
          {productPhotos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {productPhotos.map((f, i) => (
                <div key={i} className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-sm text-xs">
                  <Camera className="h-3 w-3" />
                  <span className="truncate max-w-[100px]">{f.name}</span>
                  <button onClick={() => removeProductPhoto(i)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Video */}
        <div className="space-y-2">
          <span className="text-xs font-semibold flex items-center gap-1">
            <Video className="h-3.5 w-3.5" /> Video corto mostrando la falla
          </span>
          <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-sm cursor-pointer hover:border-primary/50 transition-colors">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{videoFile ? videoFile.name : "Subir video del detalle o falla"}</span>
            <input type="file" accept="video/*" onChange={handleVideo} className="hidden" />
          </label>
          {videoFile && (
            <div className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-sm text-xs w-fit">
              <Video className="h-3 w-3" />
              <span className="truncate max-w-[150px]">{videoFile.name}</span>
              <button onClick={() => setVideoFile(null)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Screenshot of original listing */}
        <div className="space-y-2">
          <span className="text-xs font-semibold flex items-center gap-1">
            <Image className="h-3.5 w-3.5" /> Captura de la publicación original (para comparar)
          </span>
          <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-sm cursor-pointer hover:border-primary/50 transition-colors">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{screenshotFile ? screenshotFile.name : "Subir captura de pantalla"}</span>
            <input type="file" accept="image/*" onChange={handleScreenshot} className="hidden" />
          </label>
          {screenshotFile && (
            <div className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-sm text-xs w-fit">
              <Image className="h-3 w-3" />
              <span className="truncate max-w-[150px]">{screenshotFile.name}</span>
              <button onClick={() => setScreenshotFile(null)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Step 3 - Description */}
      <div className="space-y-2 bg-card border border-border rounded-sm p-4">
        <Label className="text-sm font-bold flex items-center gap-2">
          <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">3</span>
          Descripción del Reclamo
        </Label>
        <Textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Explica detalladamente por qué el producto no cumple con lo prometido en la publicación..."
          rows={5}
          maxLength={1500}
        />
        <p className="text-xs text-muted-foreground text-right">{description.length}/1500</p>
      </div>

      {/* Step 4 - Desired Resolution */}
      <div className="space-y-3 bg-card border border-border rounded-sm p-4">
        <Label className="text-sm font-bold flex items-center gap-2">
          <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">4</span>
          Solución Deseada
        </Label>
        <RadioGroup value={desiredResolution} onValueChange={setDesiredResolution} className="space-y-2">
          {RESOLUTION_OPTIONS.map(opt => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 border rounded-sm cursor-pointer transition-colors ${
                desiredResolution === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
              }`}
            >
              <RadioGroupItem value={opt.value} className="mt-0.5" />
              <div>
                <span className="text-sm font-medium">{opt.label}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </RadioGroup>
      </div>

      {/* Resolution rules */}
      <div className="bg-muted/50 border border-border rounded-sm p-4 text-xs text-muted-foreground space-y-3">
        <p className="font-semibold text-foreground flex items-center gap-1">⚖️ Reglas de Resolución (Política de Protección)</p>
        <div className="space-y-2">
          <p><strong>1. El "Match" de Fotos:</strong> Si la foto del Dealer mostraba un producto impecable y el cliente demuestra con una foto real que tiene rayones o golpes, el Dealer pierde la disputa automáticamente.</p>
          <p><strong>2. Tiempo de Reporte:</strong> El cliente tiene 48 horas desde que retira el producto de la agencia para abrir una disputa. Pasado ese tiempo, los fondos se liberan al Dealer.</p>
          <p><strong>3. Logística de Devolución:</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Si gana el Comprador:</strong> El Dealer paga el flete de regreso. Una vez recibido el producto, Subastándolo devuelve el 100% al Comprador.</li>
            <li><strong>Si gana el Dealer:</strong> Se liberan los fondos de inmediato y se puede sancionar al comprador por reporte falso.</li>
          </ul>
        </div>
      </div>

      {/* Step 5 - Firma y Aceptación Legal */}
      <div className="space-y-4 bg-card border border-border rounded-sm p-4">
        <Label className="text-sm font-bold flex items-center gap-2">
          <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">5</span>
          Firma y Declaración Jurada
        </Label>

        <div className="space-y-2">
          <Label className="text-xs">Nombre completo (como firma digital)</Label>
          <div className="relative">
            <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={signatureName}
              onChange={e => setSignatureName(e.target.value)}
              placeholder="Escribe tu nombre completo"
              className="pl-9"
              maxLength={100}
            />
          </div>
        </div>

        <div className="bg-muted/50 border border-border rounded-sm p-3 text-xs text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground">📜 Declaración Jurada</p>
          <p>Al marcar la casilla siguiente, declaro bajo juramento que:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Toda la información proporcionada en este formulario es veraz y comprobable.</li>
            <li>Las evidencias adjuntas (fotos, videos, capturas) corresponden fielmente al producto recibido.</li>
            <li>No he alterado ni manipulado el producto con la intención de generar un reclamo fraudulento.</li>
            <li>Acepto que, de comprobarse falsedad en mi declaración, podré ser sancionado con la suspensión de mi cuenta y la pérdida de cualquier derecho a reembolso.</li>
            <li>Acepto los términos de la Política de Protección al Comprador de Subastándolo.</li>
          </ul>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox
            checked={legalAccepted}
            onCheckedChange={(checked) => setLegalAccepted(checked === true)}
            className="mt-0.5"
          />
          <span className="text-xs leading-relaxed">
            Yo, <strong>{signatureName.trim() || "_______________"}</strong>, confirmo que toda la información es fiel y acepto todos los cargos legales en caso de declaración falsa.
          </span>
        </label>
      </div>

      {/* Validation summary */}
      {!isValid && (
        <div className="bg-amber-500/10 border border-amber-200 rounded-sm p-3 text-xs space-y-1">
          <p className="font-semibold text-amber-700">⚠️ Para enviar la disputa necesitas:</p>
          <ul className="list-disc pl-5 text-amber-600 space-y-0.5">
            {!category && <li>Seleccionar un motivo de disputa</li>}
            {productPhotos.length < 3 && <li>Subir al menos 3 fotos del producto recibido</li>}
            {!description.trim() && <li>Escribir la descripción del reclamo</li>}
            {!desiredResolution && <li>Seleccionar la solución deseada</li>}
            {!signatureName.trim() && <li>Escribir tu nombre completo</li>}
            {!legalAccepted && <li>Aceptar la declaración jurada</li>}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar Disputa"}
        </Button>
      </div>
    </div>
  );
};

export default DisputeForm;
