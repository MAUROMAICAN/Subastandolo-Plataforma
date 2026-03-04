import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBCVRate } from "@/hooks/useBCVRate";
import {
    X, ChevronLeft, ChevronRight, Eye, Clock, ImageIcon,
    AlertTriangle, Tag, Calendar, Images,
} from "lucide-react";
import type { AuctionWithImages } from "./types";

interface Props {
    auction: AuctionWithImages;
    onClose: () => void;
}

export default function AuctionPreviewModal({ auction, onClose }: Props) {
    const bcvRate = useBCVRate();
    const [currentImage, setCurrentImage] = useState(0);

    // Build image list: cover first, then gallery images
    const images: string[] = [];
    if (auction.image_url) images.push(auction.image_url);
    auction.images.forEach((img: any) => {
        const url = img.image_url;
        if (url && url !== auction.image_url) images.push(url);
    });

    const displayPrice = auction.current_price > 0 ? auction.current_price : auction.starting_price;
    const hasBids = auction.current_price > 0;

    const fmtUSD = (n: number) =>
        n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtBs = (n: number) =>
        n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const durationLabel = (h: number) => {
        if (h < 24) return `${h} hora${h !== 1 ? "s" : ""}`;
        const d = Math.round(h / 24);
        return `${d} día${d !== 1 ? "s" : ""}`;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div
                className="relative bg-background border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 z-20 flex items-center justify-between px-5 py-3 bg-background/95 backdrop-blur-md border-b border-border rounded-t-2xl">
                    <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-primary" />
                        <span className="text-sm font-bold">Vista Previa de Publicación</span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={onClose} className="h-7 w-7 p-0 rounded-full">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Pending watermark banner */}
                <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/25">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        Esta es una <strong>vista previa</strong>. La publicación aún está <strong>pendiente de revisión</strong> y no es visible para los compradores.
                    </p>
                </div>

                <div className="p-5 space-y-5">
                    {/* Title */}
                    <h2 className="text-xl font-heading font-bold leading-tight">{auction.title}</h2>

                    {/* Image gallery */}
                    {images.length > 0 ? (
                        <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
                            <img
                                src={images[currentImage]}
                                alt={`Foto ${currentImage + 1}`}
                                className="w-full h-full object-cover"
                            />
                            {/* Coverage gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                            {/* Nav arrows */}
                            {images.length > 1 && (
                                <>
                                    <button
                                        onClick={() => setCurrentImage(i => (i - 1 + images.length) % images.length)}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-sm text-white rounded-full p-1.5 hover:bg-black/70 transition-colors"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => setCurrentImage(i => (i + 1) % images.length)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-sm text-white rounded-full p-1.5 hover:bg-black/70 transition-colors"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </>
                            )}

                            {/* Image counter */}
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                                {images.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentImage(i)}
                                        className={`w-2 h-2 rounded-full transition-colors ${i === currentImage ? "bg-white" : "bg-white/40"}`}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="aspect-video rounded-xl bg-muted/40 border border-border flex items-center justify-center text-muted-foreground">
                            <ImageIcon className="h-10 w-10 opacity-30" />
                        </div>
                    )}

                    {/* Thumbnail strip */}
                    {images.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                            {images.map((url, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCurrentImage(i)}
                                    className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${i === currentImage ? "border-primary" : "border-border"}`}
                                >
                                    <img src={url} alt={`thumb-${i}`} className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Price block */}
                    <div className="bg-card border border-border rounded-xl p-4 space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                            {hasBids ? "Puja actual" : "Precio inicial"}
                        </p>
                        <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-3xl font-black tracking-tight text-foreground">
                                US$ {fmtUSD(displayPrice)}
                            </span>
                            {hasBids && (
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-400/30">
                                    Pujado
                                </Badge>
                            )}
                        </div>
                        {bcvRate && bcvRate > 0 && (
                            <p className="text-sm text-muted-foreground font-medium">
                                Bs. {fmtBs(displayPrice * bcvRate)}
                                <span className="ml-1.5 text-[10px] text-muted-foreground/70">(Tasa BCV: {bcvRate.toFixed(2)} Bs/$)</span>
                            </p>
                        )}
                        {auction.starting_price > 0 && hasBids && (
                            <p className="text-xs text-muted-foreground mt-1">
                                Precio inicial: US$ {fmtUSD(auction.starting_price)}
                            </p>
                        )}
                    </div>

                    {/* Info chips */}
                    <div className="flex flex-wrap gap-2">
                        {(auction as any).requested_duration_hours && (
                            <div className="flex items-center gap-1.5 text-xs bg-secondary/60 border border-border rounded-full px-3 py-1.5">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="text-foreground font-medium">
                                    Duración: {durationLabel((auction as any).requested_duration_hours)}
                                </span>
                            </div>
                        )}
                        {images.length > 0 && (
                            <div className="flex items-center gap-1.5 text-xs bg-secondary/60 border border-border rounded-full px-3 py-1.5">
                                <Images className="h-3 w-3 text-muted-foreground" />
                                <span className="text-foreground font-medium">{images.length} foto{images.length !== 1 ? "s" : ""}</span>
                            </div>
                        )}
                        {(auction as any).start_time && (
                            <div className="flex items-center gap-1.5 text-xs bg-secondary/60 border border-border rounded-full px-3 py-1.5">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span className="text-foreground font-medium">
                                    Inicio programado: {new Date((auction as any).start_time).toLocaleString("es-VE")}
                                </span>
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 text-xs bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5">
                            <Tag className="h-3 w-3 text-amber-500" />
                            <span className="text-amber-600 dark:text-amber-400 font-medium">Pendiente de revisión</span>
                        </div>
                    </div>

                    {/* Description */}
                    {auction.description && (
                        <div className="space-y-2">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Descripción</p>
                            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{auction.description}</p>
                        </div>
                    )}

                    {/* Admin notes (if any) */}
                    {(auction as any).admin_notes && (
                        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 space-y-1">
                            <p className="text-xs font-bold text-warning flex items-center gap-1.5">
                                <AlertTriangle className="h-3.5 w-3.5" /> Notas del Administrador
                            </p>
                            <p className="text-xs text-muted-foreground">{(auction as any).admin_notes}</p>
                        </div>
                    )}

                    {/* Footer note */}
                    <div className="text-center pt-2 border-t border-border">
                        <p className="text-[11px] text-muted-foreground">
                            La apariencia final puede variar ligeramente una vez aprobada y publicada.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
