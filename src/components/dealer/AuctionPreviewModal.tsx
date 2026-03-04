import { useState } from "react";
import { useBCVRate } from "@/hooks/useBCVRate";
import { X, ChevronLeft, ChevronRight, Clock, Images, Calendar, AlertTriangle, Sparkles } from "lucide-react";
import type { AuctionWithImages } from "./types";

interface Props {
    auction: AuctionWithImages;
    onClose: () => void;
}

export default function AuctionPreviewModal({ auction, onClose }: Props) {
    const bcvRate = useBCVRate();
    const [currentImage, setCurrentImage] = useState(0);

    const images: string[] = [];
    if (auction.image_url) images.push(auction.image_url);
    auction.images.forEach((img: any) => {
        const url = img.image_url;
        if (url && url !== auction.image_url) images.push(url);
    });

    const displayPrice = auction.current_price > 0 ? auction.current_price : auction.starting_price;
    const hasBids = auction.current_price > 0;
    const fmtUSD = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtBs = (n: number) => n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const durationH = (auction as any).requested_duration_hours;
    const durationLabel = durationH
        ? durationH < 24
            ? `${durationH}h`
            : `${Math.round(durationH / 24)} día${Math.round(durationH / 24) !== 1 ? "s" : ""}`
        : null;

    const prev = () => setCurrentImage(i => (i - 1 + images.length) % images.length);
    const next = () => setCurrentImage(i => (i + 1) % images.length);

    return (
        /* Backdrop */
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
            style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(16px)" }}
            onClick={onClose}
        >
            {/* Modal shell */}
            <div
                className="relative w-full max-w-2xl max-h-[94vh] overflow-y-auto rounded-3xl flex flex-col animate-fade-in"
                style={{
                    background: "linear-gradient(160deg, hsl(222 47% 9%) 0%, hsl(222 30% 13%) 100%)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset",
                }}
                onClick={e => e.stopPropagation()}
            >

                {/* ── Pending banner ── */}
                <div
                    className="flex items-center gap-2 px-5 py-2.5 rounded-t-3xl"
                    style={{ background: "linear-gradient(90deg, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.06) 100%)", borderBottom: "1px solid rgba(245,158,11,0.18)" }}
                >
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <p className="text-[11px] text-amber-300/80 font-medium">
                        <span className="font-bold text-amber-400">Vista previa</span> — pendiente de revisión por el administrador
                    </p>
                    <button
                        onClick={onClose}
                        className="ml-auto h-7 w-7 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all shrink-0"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* ── Image gallery ── */}
                <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
                    {images.length > 0 ? (
                        <>
                            <img
                                src={images[currentImage]}
                                alt={`Foto ${currentImage + 1}`}
                                className="w-full h-full object-cover transition-opacity duration-300"
                            />
                            {/* subtle bottom gradient for text readability */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                            {/* Nav buttons */}
                            {images.length > 1 && (
                                <>
                                    <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full flex items-center justify-center text-white transition-all" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)" }}>
                                        <ChevronLeft className="h-5 w-5" />
                                    </button>
                                    <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full flex items-center justify-center text-white transition-all" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)" }}>
                                        <ChevronRight className="h-5 w-5" />
                                    </button>
                                </>
                            )}

                            {/* Dot indicators */}
                            {images.length > 1 && (
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                                    {images.map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setCurrentImage(i)}
                                            className={`rounded-full transition-all duration-300 ${i === currentImage ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40"}`}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Image counter pill */}
                            <div className="absolute top-3 right-3 text-[10px] font-bold text-white/80 px-2.5 py-1 rounded-full" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}>
                                {currentImage + 1} / {images.length}
                            </div>
                        </>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20 text-sm" style={{ background: "rgba(255,255,255,0.03)" }}>
                            Sin imágenes
                        </div>
                    )}
                </div>

                {/* ── Thumbnail strip ── */}
                {images.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto px-5 pt-3 pb-1 scrollbar-none">
                        {images.map((url, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentImage(i)}
                                className={`shrink-0 w-12 h-12 rounded-xl overflow-hidden transition-all duration-200 ${i === currentImage ? "ring-2 ring-white/60 scale-105" : "opacity-40 hover:opacity-70"}`}
                            >
                                <img src={url} alt="" className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Content ── */}
                <div className="flex flex-col gap-5 px-6 py-5">

                    {/* Title */}
                    <h2 className="text-xl font-bold leading-snug text-white tracking-tight">{auction.title}</h2>

                    {/* Price block */}
                    <div
                        className="rounded-2xl p-4"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                        <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                            {hasBids ? "Puja actual" : "Precio inicial"}
                        </p>
                        <div className="flex items-end gap-3 flex-wrap">
                            <div className="flex items-baseline gap-1">
                                <span className="text-sm font-bold text-white/50">US$</span>
                                <span
                                    className="text-4xl font-black tracking-tight text-white"
                                    style={{ fontVariantNumeric: "tabular-nums" }}
                                >
                                    {fmtUSD(displayPrice)}
                                </span>
                            </div>
                            {hasBids && (
                                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full" style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
                                    Pujado
                                </span>
                            )}
                        </div>
                        {bcvRate && bcvRate > 0 && (
                            <p className="text-sm font-semibold mt-1.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                                Bs.&nbsp;{fmtBs(displayPrice * bcvRate)}
                                <span className="ml-2 text-[10px] font-normal" style={{ color: "rgba(255,255,255,0.25)" }}>
                                    Tasa BCV {bcvRate.toFixed(2)} Bs/$
                                </span>
                            </p>
                        )}
                    </div>

                    {/* Info chips */}
                    <div className="flex flex-wrap gap-2">
                        {durationLabel && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)" }}>
                                <Clock className="h-3 w-3" />
                                {durationLabel}
                            </div>
                        )}
                        {images.length > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)" }}>
                                <Images className="h-3 w-3" />
                                {images.length} foto{images.length !== 1 ? "s" : ""}
                            </div>
                        )}
                        {(auction as any).start_time && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)" }}>
                                <Calendar className="h-3 w-3" />
                                {new Date((auction as any).start_time).toLocaleString("es-VE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    {auction.description && (
                        <div
                            className="rounded-2xl p-4"
                            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                        >
                            <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                                Descripción
                            </p>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "rgba(255,255,255,0.7)" }}>
                                {auction.description}
                            </p>
                        </div>
                    )}

                    {/* Admin notes */}
                    {(auction as any).admin_notes && (
                        <div className="rounded-2xl p-4 flex gap-3" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-amber-400 mb-1">Notas del Administrador</p>
                                <p className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>{(auction as any).admin_notes}</p>
                            </div>
                        </div>
                    )}

                    {/* Footer note */}
                    <div className="flex items-center justify-center gap-2 pt-1 pb-2">
                        <Sparkles className="h-3 w-3" style={{ color: "rgba(255,255,255,0.2)" }} />
                        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                            La apariencia final puede variar una vez aprobada
                        </p>
                        <Sparkles className="h-3 w-3" style={{ color: "rgba(255,255,255,0.2)" }} />
                    </div>
                </div>
            </div>
        </div>
    );
}
