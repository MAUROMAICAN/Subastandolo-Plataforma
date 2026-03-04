import { useState } from "react";
import { useBCVRate } from "@/hooks/useBCVRate";
import { X, ChevronLeft, ChevronRight, Clock, User, AlertTriangle, Eye } from "lucide-react";
import type { AuctionWithImages } from "./types";

const DescriptionToggle = ({ text, maxLength = 120 }: { text: string; maxLength?: number }) => {
    const [expanded, setExpanded] = useState(false);
    if (text.length <= maxLength) return <span>{text}</span>;
    return (
        <span>
            {expanded ? text : `${text.slice(0, maxLength).trimEnd()}…`}
            <button onClick={() => setExpanded(!expanded)} className="ml-1 text-primary font-medium hover:underline text-xs">
                {expanded ? "Ver menos" : "Ver más"}
            </button>
        </span>
    );
};

interface Props {
    auction: AuctionWithImages;
    onClose: () => void;
}

export default function AuctionPreviewModal({ auction, onClose }: Props) {
    const bcvRate = useBCVRate();
    const [currentImage, setCurrentImage] = useState(0);

    // Build image list
    const allImages: string[] = [];
    if (auction.image_url) allImages.push(auction.image_url);
    auction.images.forEach((img: any) => {
        const url = img.image_url;
        if (url && url !== auction.image_url) allImages.push(url);
    });

    const displayPrice = auction.starting_price; // pending = no bids yet
    const durationH = (auction as any).requested_duration_hours;

    const fmtUSD = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtBs = (n: number) => n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        /* Backdrop */
        <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
            onClick={onClose}
        >
            {/* Modal card — uses the same bg as the rest of the site */}
            <div
                className="relative w-full max-w-5xl rounded-2xl bg-background border border-border shadow-2xl my-auto animate-fade-in"
                onClick={e => e.stopPropagation()}
            >
                {/* ── Top bar: Preview watermark + Close ── */}
                <div className="flex items-center gap-2 px-5 py-3 border-b border-border rounded-t-2xl bg-amber-500/8">
                    <Eye className="h-4 w-4 text-amber-500 shrink-0" />
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        Vista previa — así verán tu publicación los compradores una vez aprobada
                    </p>
                    <button
                        onClick={onClose}
                        className="ml-auto h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all shrink-0"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* ── Replica of AuctionDetail main content ── */}
                <div className="p-5 sm:p-7">
                    {/* Breadcrumb (decorative) */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-5">
                        <span className="flex items-center gap-1 text-muted-foreground">
                            <ChevronLeft className="h-3 w-3" /> Inicio
                        </span>
                        <span className="text-border">/</span>
                        <span className="text-foreground truncate font-medium">{auction.title}</span>
                    </div>

                    {/* Two-column layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                        {/* ── LEFT: Image gallery ── */}
                        <div className="space-y-3">
                            <div className="aspect-square bg-card border border-border rounded-xl overflow-hidden relative shadow-sm">
                                {allImages.length > 0 ? (
                                    <>
                                        <img
                                            src={allImages[currentImage]}
                                            alt={auction.title}
                                            className="w-full h-full object-contain p-4"
                                        />
                                        {allImages.length > 1 && (
                                            <>
                                                <button
                                                    onClick={() => setCurrentImage(i => (i - 1 + allImages.length) % allImages.length)}
                                                    className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-card/80 hover:bg-card border border-border/50 text-foreground flex items-center justify-center shadow-md transition-colors"
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => setCurrentImage(i => (i + 1) % allImages.length)}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-card/80 hover:bg-card border border-border/50 text-foreground flex items-center justify-center shadow-md transition-colors"
                                                >
                                                    <ChevronRight className="h-4 w-4" />
                                                </button>
                                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-foreground/60 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">
                                                    {currentImage + 1} / {allImages.length}
                                                </div>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Sin imagen</div>
                                )}
                            </div>

                            {/* Thumbnails */}
                            {allImages.length > 1 && (
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                    {allImages.map((url, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setCurrentImage(i)}
                                            className={`w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${i === currentImage ? "border-primary shadow-md" : "border-border hover:border-primary/50"}`}
                                        >
                                            <img src={url} alt="" className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── RIGHT: Info ── */}
                        <div className="space-y-5">
                            {/* Title */}
                            <div className="flex items-start gap-3 flex-wrap">
                                <h1 className="text-2xl font-heading font-bold leading-tight">{auction.title}</h1>
                                {(auction as any).operation_number && (
                                    <span className="text-[10px] font-mono bg-secondary text-muted-foreground px-2.5 py-1 rounded-lg border border-border mt-1">
                                        {(auction as any).operation_number}
                                    </span>
                                )}
                            </div>

                            {/* Dealer info placeholder */}
                            <div className="bg-card border border-border rounded-xl px-5 py-4 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full border border-border bg-secondary flex items-center justify-center shrink-0 shadow-sm">
                                        <User className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-1.5 font-bold text-foreground text-sm">
                                            <span>Tu tienda</span>
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">Verificado</span>
                                        </div>
                                        <span className="text-xs text-muted-foreground mt-0.5">Tus ventas · Tu reputación</span>
                                    </div>
                                </div>
                            </div>

                            {/* Price highlight — shows "Precio inicial" because it's pending */}
                            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-medium">Precio inicial</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-sm text-foreground">US$</span>
                                    <span className="text-4xl font-black text-foreground tracking-tight">
                                        {Math.floor(displayPrice).toLocaleString("en-US")}
                                    </span>
                                    <span className="text-sm text-foreground">
                                        {(displayPrice % 1).toFixed(2).substring(1)}
                                    </span>
                                </div>
                                {bcvRate && bcvRate > 0 && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Bs. {fmtBs(displayPrice * bcvRate)}
                                    </p>
                                )}
                                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>Termina en</span>
                                    <span className="font-mono font-bold text-foreground">
                                        {durationH
                                            ? durationH < 24
                                                ? `${durationH}h 00min`
                                                : `${Math.round(durationH / 24)}d 00h`
                                            : "—"}
                                    </span>
                                    <span className="text-muted-foreground/50">(tiempo estimado)</span>
                                </div>
                            </div>

                            {/* Info table */}
                            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                                <table className="w-full text-sm">
                                    <tbody>
                                        <tr className="border-b border-border">
                                            <td className="px-4 py-3 text-muted-foreground bg-muted/50 font-medium w-1/3">Estado</td>
                                            <td className="px-4 py-3 font-medium">
                                                <span className="flex items-center gap-1.5 text-foreground">
                                                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> En vivo
                                                </span>
                                            </td>
                                        </tr>
                                        <tr className="border-b border-border">
                                            <td className="px-4 py-3 text-muted-foreground bg-muted/50 font-medium">Precio inicial</td>
                                            <td className="px-4 py-3">
                                                <span className="font-semibold text-foreground">US$ {fmtUSD(auction.starting_price)}</span>
                                                {bcvRate && bcvRate > 0 && (
                                                    <div className="text-xs text-muted-foreground mt-0.5">
                                                        Bs. {fmtBs(auction.starting_price * bcvRate)}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-border">
                                            <td className="px-4 py-3 text-muted-foreground bg-muted/50 font-medium">Puja actual</td>
                                            <td className="px-4 py-3">
                                                <span className="font-bold text-foreground text-lg">US$ {fmtUSD(auction.starting_price)}</span>
                                                {bcvRate && bcvRate > 0 && (
                                                    <div className="text-xs text-muted-foreground mt-0.5">
                                                        Bs. {fmtBs(auction.starting_price * bcvRate)}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-border">
                                            <td className="px-4 py-3 text-muted-foreground bg-muted/50 font-medium">Tiempo restante</td>
                                            <td className="px-4 py-3 font-mono font-bold text-foreground">
                                                {durationH
                                                    ? durationH < 24
                                                        ? `00h ${durationH}m 00s`
                                                        : `${Math.round(durationH / 24) * 24}h 00m 00s`
                                                    : "—"}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-border">
                                            <td className="px-4 py-3 text-muted-foreground bg-muted/50 font-medium">Total de pujas</td>
                                            <td className="px-4 py-3 font-semibold">0</td>
                                        </tr>
                                        <tr className="border-b border-border">
                                            <td className="px-4 py-3 text-muted-foreground bg-muted/50 font-medium">Fotos</td>
                                            <td className="px-4 py-3 font-semibold">{allImages.length}</td>
                                        </tr>
                                        {auction.description && (
                                            <tr>
                                                <td className="px-4 py-3 text-muted-foreground bg-muted/50 font-medium align-top">Descripción</td>
                                                <td className="px-4 py-3 text-sm text-muted-foreground leading-relaxed">
                                                    <DescriptionToggle text={auction.description} />
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Preview note */}
                            <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/8 px-4 py-3">
                                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
                                    <strong>Vista previa.</strong> Esta publicación aún está pendiente de revisión. El tiempo real del contador y la actividad de pujas comenzarán una vez que el administrador la apruebe.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
