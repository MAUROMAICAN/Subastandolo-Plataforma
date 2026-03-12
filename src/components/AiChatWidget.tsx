import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Loader2, ArrowDown, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}

const SUBA_AVATAR = "/suba-avatar.png";

const SubaAvatar = ({ size = 28, radius = 10 }: { size?: number; radius?: number }) => {
    const [err, setErr] = useState(false);
    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: radius,
                overflow: "hidden",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            {err ? (
                <span style={{ fontSize: size * 0.5, fontWeight: 900, color: "#B5FB05" }}>S</span>
            ) : (
                <img
                    src={SUBA_AVATAR}
                    alt="Suba"
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    onError={() => setErr(true)}
                />
            )}
        </div>
    );
};

const STORAGE_KEY = "suba-btn-pos";
const HIDDEN_KEY = "suba-hidden";

const getStoredPos = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw) as { x: number; y: number };
    } catch { /* ignore */ }
    return null;
};

const AiChatWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipDismissed, setTooltipDismissed] = useState(false);
    const [isHidden, setIsHidden] = useState(() => localStorage.getItem(HIDDEN_KEY) === "1");
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { user } = useAuth();

    // ─── Drag state ───
    const btnRef = useRef<HTMLButtonElement>(null);
    const [pos, setPos] = useState<{ x: number; y: number }>(() => {
        const stored = getStoredPos();
        return stored || { x: window.innerWidth - 70, y: window.innerHeight - 130 };
    });
    const dragState = useRef({
        dragging: false,
        wasDragged: false,
        startX: 0,
        startY: 0,
        startPosX: 0,
        startPosY: 0,
    });

    // Clamp position to viewport
    const clamp = useCallback((x: number, y: number) => {
        const btnSize = window.innerWidth < 640 ? 56 : 80;
        return {
            x: Math.max(0, Math.min(window.innerWidth - btnSize, x)),
            y: Math.max(0, Math.min(window.innerHeight - btnSize, y)),
        };
    }, []);

    // ─── Mouse drag handlers ───
    const onPointerDown = useCallback((e: React.PointerEvent) => {
        if (isOpen) return;
        dragState.current = {
            dragging: true,
            wasDragged: false,
            startX: e.clientX,
            startY: e.clientY,
            startPosX: pos.x,
            startPosY: pos.y,
        };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, [isOpen, pos]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragState.current.dragging) return;
        const dx = e.clientX - dragState.current.startX;
        const dy = e.clientY - dragState.current.startY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            dragState.current.wasDragged = true;
        }
        const newPos = clamp(dragState.current.startPosX + dx, dragState.current.startPosY + dy);
        setPos(newPos);
    }, [clamp]);

    const onPointerUp = useCallback((e: React.PointerEvent) => {
        if (!dragState.current.dragging) return;
        dragState.current.dragging = false;
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        // Snap to nearest edge
        const btnSize = window.innerWidth < 640 ? 56 : 80;
        const midX = window.innerWidth / 2;
        const snappedX = pos.x + btnSize / 2 < midX ? 4 : window.innerWidth - btnSize - 4;
        const finalPos = clamp(snappedX, pos.y);
        setPos(finalPos);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(finalPos));
        if (!dragState.current.wasDragged) {
            setIsOpen(true);
            setShowTooltip(false);
            setTooltipDismissed(true);
        }
    }, [pos, clamp]);

    // Reset position on window resize
    useEffect(() => {
        const handleResize = () => {
            setPos(prev => clamp(prev.x, prev.y));
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [clamp]);

    // Show/hide the widget
    const hideWidget = useCallback(() => {
        setIsHidden(true);
        setIsOpen(false);
        localStorage.setItem(HIDDEN_KEY, "1");
    }, []);

    const showWidget = useCallback(() => {
        setIsHidden(false);
        localStorage.removeItem(HIDDEN_KEY);
    }, []);

    // Show tooltip after 3 seconds if not dismissed and chat not open
    useEffect(() => {
        if (tooltipDismissed || isOpen || isHidden) return undefined;
        const timer = setTimeout(() => setShowTooltip(true), 3000);
        return () => clearTimeout(timer);
    }, [tooltipDismissed, isOpen, isHidden]);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Detect scroll position for scroll-down button
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return undefined;
        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100);
        };
        container.addEventListener("scroll", handleScroll);
        return () => container.removeEventListener("scroll", handleScroll);
    }, [isOpen]);

    // Welcome message on first open
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([{
                id: "welcome",
                role: "assistant",
                content: "¡Hola! 👋 Soy **Suba**, tu asistente de Subastandolo. ¿En qué te puedo ayudar?",
                timestamp: new Date(),
            }]);
        }
    }, [isOpen, messages.length]);

    const sendMessage = async () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: "user",
            content: trimmed,
            timestamp: new Date(),
        };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInput("");
        setIsLoading(true);

        // Reset textarea height
        if (inputRef.current) inputRef.current.style.height = "40px";

        try {
            const historyToSend = updatedMessages.slice(-10).map(m => ({
                role: m.role,
                content: m.content,
            }));

            const { data, error } = await supabase.functions.invoke("ai-assistant", {
                body: {
                    message: trimmed,
                    history: historyToSend.slice(0, -1),
                    userId: user?.id || null,
                },
            });

            if (error) {
                console.error("[Suba] Functions error:", error);
                // Try to extract response body from FunctionsHttpError
                let detail = error.message || "Error desconocido";
                if (error.context?.body) {
                    try {
                        const reader = error.context.body.getReader();
                        const { value } = await reader.read();
                        detail = new TextDecoder().decode(value);
                    } catch { /* ignore */ }
                }
                throw new Error(detail);
            }

            // Check if edge function returned an error in the response body
            if (data?.error) {
                throw new Error(data.error);
            }

            setMessages(prev => [...prev, {
                id: `suba-${Date.now()}`,
                role: "assistant",
                content: data?.reply || "Lo siento, no pude procesar tu mensaje.",
                timestamp: new Date(),
            }]);
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error("[Suba] Error:", errMsg);
            setMessages(prev => [...prev, {
                id: `error-${Date.now()}`,
                role: "assistant",
                content: "⚠️ Hubo un error. Intenta de nuevo o escribe a soporte@subastandolo.com",
                timestamp: new Date(),
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Auto-resize textarea
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        const ta = e.target;
        ta.style.height = "40px";
        ta.style.height = Math.min(ta.scrollHeight, 100) + "px";
    };

    const clearChat = () => {
        setMessages([{
            id: "welcome-new",
            role: "assistant",
            content: "Chat reiniciado. ¿En qué te puedo ayudar? 😊",
            timestamp: new Date(),
        }]);
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });
    };

    // Markdown-like rendering
    const renderContent = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith("**") && part.endsWith("**")) {
                return <strong key={i} className="text-[#B5FB05] font-bold">{part.slice(2, -2)}</strong>;
            }
            return part.split("\n").map((line, j) => (
                <span key={`${i}-${j}`}>
                    {j > 0 && <br />}
                    {line}
                </span>
            ));
        });
    };

    // If hidden, show a tiny re-activate pill at bottom-right
    if (isHidden) {
        return (
            <button
                onClick={showWidget}
                className="fixed z-40 bottom-2 right-2 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all hover:scale-105"
                style={{
                    background: "rgba(0,0,0,0.5)",
                    color: "rgba(255,255,255,0.5)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    backdropFilter: "blur(8px)",
                }}
            >
                💬 Suba
            </button>
        );
    }

    // Compute chat panel position based on button
    const btnSize = typeof window !== "undefined" && window.innerWidth < 640 ? 56 : 80;
    const isOnLeft = pos.x < (typeof window !== "undefined" ? window.innerWidth / 2 : 500);

    return (
        <>
            {/* ── Floating tooltip bubble ── */}
            {showTooltip && !isOpen && (
                <div
                    className="fixed z-50"
                    style={{
                        left: pos.x - 60,
                        top: pos.y - 40,
                        animation: "subaTooltipIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                    onClick={() => { setTooltipDismissed(true); setShowTooltip(false); setIsOpen(true); }}
                >
                    <span className="suba-typewriter"
                        style={{
                            background: "#000",
                            color: "#fff",
                            fontSize: "13px",
                            fontWeight: 700,
                            padding: "6px 14px",
                            borderRadius: "20px",
                            cursor: "pointer",
                            display: "inline-block",
                            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                        }}
                    >Hoy soy Suba ✋</span>
                </div>
            )}

            {/* ── Floating close button (when chat is open) ── */}
            {isOpen && (
                <button
                    onClick={() => { setIsOpen(false); setShowTooltip(false); setTooltipDismissed(true); }}
                    aria-label="Cerrar chat"
                    className="fixed z-[60] flex items-center justify-center"
                    style={{
                        left: pos.x + btnSize / 2 - 20,
                        top: pos.y + btnSize / 2 - 20,
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        border: "none",
                        cursor: "pointer",
                        background: "#ef4444",
                        boxShadow: "0 4px 20px rgba(239,68,68,0.4)",
                        padding: 0,
                    }}
                >
                    <X size={18} color="#fff" strokeWidth={2.5} />
                </button>
            )}

            {/* ── Draggable Avatar trigger ── */}
            {!isOpen && (
                <button
                    ref={btnRef}
                    id="suba-chat-trigger"
                    aria-label="Hablar con Suba"
                    className="fixed z-50 touch-none select-none"
                    style={{
                        left: pos.x,
                        top: pos.y,
                        width: btnSize,
                        height: btnSize,
                        borderRadius: "0",
                        border: "none",
                        cursor: "grab",
                        background: "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                        filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))",
                        transition: dragState.current.dragging ? "none" : "left 0.3s ease, top 0.05s ease",
                    }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onContextMenu={(e) => { e.preventDefault(); hideWidget(); }}
                >
                    <img
                        src={SUBA_AVATAR}
                        alt="Suba"
                        style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }}
                    />
                    {/* Dismiss hint pill */}
                    <span
                        className="absolute -top-1 -right-1 flex items-center justify-center"
                        style={{
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: "rgba(0,0,0,0.7)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            cursor: "pointer",
                            fontSize: 10,
                            color: "rgba(255,255,255,0.6)",
                            lineHeight: 1,
                        }}
                        onClick={(e) => { e.stopPropagation(); hideWidget(); }}
                    >
                        ✕
                    </span>
                </button>
            )}

            {/* ── Chat Panel ── */}
            {isOpen && (
                <div
                    id="suba-chat-panel"
                    className="fixed z-50 flex flex-col w-[calc(100vw-24px)] max-w-[340px] h-[min(440px,calc(100vh-180px))] sm:w-[340px] sm:h-[min(500px,calc(100vh-200px))] rounded-2xl border border-[rgba(181,251,5,0.12)]"
                    style={{
                        ...(isOnLeft
                            ? { left: Math.max(8, pos.x) }
                            : { right: Math.max(8, (typeof window !== "undefined" ? window.innerWidth : 1024) - pos.x - btnSize) }),
                        bottom: Math.max(8, (typeof window !== "undefined" ? window.innerHeight : 800) - pos.y + 10),
                        overflow: "hidden",
                        background: "#0a0a14",
                        boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
                        animation: "subaSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                >
                    {/* ── Header ── */}
                    <div
                        style={{
                            background: "linear-gradient(135deg, #0f1525 0%, #141830 100%)",
                            padding: "14px 16px",
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            borderBottom: "1px solid rgba(181,251,5,0.08)",
                        }}
                    >
                        {/* Avatar */}
                        <div style={{ border: "2px solid rgba(181,251,5,0.3)", borderRadius: "16px", flexShrink: 0 }}>
                            <SubaAvatar size={40} radius={14} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ color: "#fff", fontSize: "15px", fontWeight: 800, letterSpacing: "-0.01em" }}>Suba</span>
                                <span style={{
                                    fontSize: "8px",
                                    fontWeight: 700,
                                    color: "#B5FB05",
                                    background: "rgba(181,251,5,0.1)",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    letterSpacing: "0.05em",
                                    textTransform: "uppercase",
                                }}>IA</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "1px" }}>
                                <span style={{
                                    width: "6px",
                                    height: "6px",
                                    borderRadius: "50%",
                                    background: "#22c55e",
                                    boxShadow: "0 0 6px rgba(34,197,94,0.5)",
                                    display: "inline-block",
                                }} />
                                <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "11px", fontWeight: 500 }}>En línea · Responde al instante</span>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: "4px" }}>
                            <button
                                onClick={clearChat}
                                title="Reiniciar chat"
                                style={{
                                    background: "rgba(255,255,255,0.05)",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: "6px",
                                    borderRadius: "8px",
                                    display: "flex",
                                    transition: "background 0.2s",
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                            >
                                <Trash2 size={14} color="#9ca3af" />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                style={{
                                    background: "rgba(255,255,255,0.05)",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: "6px",
                                    borderRadius: "8px",
                                    display: "flex",
                                    transition: "background 0.2s",
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                            >
                                <X size={14} color="#9ca3af" />
                            </button>
                        </div>
                    </div>

                    {/* ── Messages ── */}
                    <div
                        ref={messagesContainerRef}
                        className="flex-1 overflow-y-auto"
                        style={{
                            padding: "16px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "16px",
                            background: "linear-gradient(180deg, #0a0a14 0%, #0d0d1a 100%)",
                        }}
                    >
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                style={{
                                    display: "flex",
                                    gap: "10px",
                                    flexDirection: msg.role === "user" ? "row-reverse" : "row",
                                    alignItems: "flex-end",
                                }}
                            >
                                {/* Avatar */}
                                {msg.role === "assistant" && (
                                    <SubaAvatar />
                                )}
                                {/* Bubble */}
                                <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", gap: "3px", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                                    <div
                                        style={{
                                            padding: "10px 14px",
                                            borderRadius: msg.role === "user"
                                                ? "16px 16px 4px 16px"
                                                : "16px 16px 16px 4px",
                                            background: msg.role === "user"
                                                ? "linear-gradient(135deg, #B5FB05, #9EE206)"
                                                : "rgba(255,255,255,0.05)",
                                            border: msg.role === "user"
                                                ? "none"
                                                : "1px solid rgba(255,255,255,0.06)",
                                            color: msg.role === "user" ? "#0a0a14" : "#e2e8f0",
                                            fontSize: "13px",
                                            lineHeight: "1.65",
                                            wordBreak: "break-word",
                                            overflowWrap: "anywhere",
                                            fontWeight: msg.role === "user" ? 600 : 400,
                                            backdropFilter: msg.role === "assistant" ? "blur(8px)" : "none",
                                        }}
                                    >
                                        {renderContent(msg.content)}
                                    </div>
                                    <span style={{
                                        fontSize: "9px",
                                        color: "rgba(255,255,255,0.2)",
                                        padding: "0 4px",
                                        fontWeight: 500,
                                    }}>
                                        {formatTime(msg.timestamp)}
                                    </span>
                                </div>
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {isLoading && (
                            <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
                                <SubaAvatar />
                                <div
                                    style={{
                                        padding: "12px 18px",
                                        borderRadius: "16px 16px 16px 4px",
                                        background: "rgba(255,255,255,0.05)",
                                        border: "1px solid rgba(255,255,255,0.06)",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "4px",
                                    }}
                                >
                                    <span className="suba-dot" style={{ animationDelay: "0s" }} />
                                    <span className="suba-dot" style={{ animationDelay: "0.15s" }} />
                                    <span className="suba-dot" style={{ animationDelay: "0.3s" }} />
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Scroll to bottom button */}
                    {showScrollBtn && (
                        <button
                            onClick={scrollToBottom}
                            style={{
                                position: "absolute",
                                bottom: "76px",
                                left: "50%",
                                transform: "translateX(-50%)",
                                width: "32px",
                                height: "32px",
                                borderRadius: "50%",
                                background: "rgba(181,251,5,0.15)",
                                border: "1px solid rgba(181,251,5,0.2)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                backdropFilter: "blur(8px)",
                                transition: "all 0.2s",
                            }}
                        >
                            <ArrowDown size={14} color="#B5FB05" />
                        </button>
                    )}

                    {/* ── Input area ── */}
                    <div
                        style={{
                            padding: "10px 14px",
                            borderTop: "1px solid rgba(255,255,255,0.05)",
                            background: "#0c0c18",
                            display: "flex",
                            gap: "8px",
                            alignItems: "flex-end",
                        }}
                    >
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder="Pregúntale algo a Suba..."
                            disabled={isLoading}
                            rows={1}
                            style={{
                                flex: 1,
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.06)",
                                borderRadius: "14px",
                                padding: "10px 14px",
                                color: "#e2e8f0",
                                fontSize: "13px",
                                outline: "none",
                                resize: "none",
                                minHeight: "40px",
                                maxHeight: "100px",
                                lineHeight: "1.5",
                                fontFamily: "inherit",
                                transition: "border-color 0.2s",
                            }}
                            onFocus={e => (e.target.style.borderColor = "rgba(181,251,5,0.3)")}
                            onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.06)")}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim() || isLoading}
                            style={{
                                width: "40px",
                                height: "40px",
                                borderRadius: "12px",
                                background: input.trim() && !isLoading
                                    ? "linear-gradient(135deg, #B5FB05, #9EE206)"
                                    : "rgba(255,255,255,0.04)",
                                border: "none",
                                cursor: input.trim() && !isLoading ? "pointer" : "default",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.2s",
                                flexShrink: 0,
                                transform: input.trim() && !isLoading ? "scale(1)" : "scale(0.95)",
                            }}
                        >
                            {isLoading ? (
                                <Loader2 size={16} color="#B5FB05" className="animate-spin" />
                            ) : (
                                <Send size={16} color={input.trim() ? "#0a0a14" : "#555"} />
                            )}
                        </button>
                    </div>

                    {/* Powered by line */}
                    <div style={{
                        textAlign: "center",
                        padding: "4px 0 6px",
                        background: "#0c0c18",
                        borderTop: "1px solid rgba(255,255,255,0.02)",
                    }}>
                        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.15)", fontWeight: 500 }}>
                            Impulsado por Subastandolo IA
                        </span>
                    </div>
                </div>
            )}

            {/* ── Animations ── */}
            <style>{`
        @keyframes subaSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes subaTooltipIn {
          from { opacity: 0; transform: translateY(8px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .suba-float {
          animation: subaFloatBounce 3s ease-in-out infinite;
        }
        @keyframes subaFloatBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .suba-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #B5FB05;
          animation: subaDotBounce 1.2s ease-in-out infinite;
        }
        @keyframes subaDotBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.3; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        /* Typewriter-like reveal */
        .suba-typewriter {
          overflow: hidden;
          white-space: nowrap;
          animation: subaTypewriter 0.8s steps(16) forwards;
          max-width: 0;
        }
        @keyframes subaTypewriter {
          from { max-width: 0; opacity: 0; padding: 6px 0; }
          to { max-width: 200px; opacity: 1; padding: 6px 14px; }
        }
      `}</style>
        </>
    );
};

export default AiChatWidget;
