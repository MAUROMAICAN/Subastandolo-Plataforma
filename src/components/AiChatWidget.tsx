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

const AiChatWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipDismissed, setTooltipDismissed] = useState(false);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { user } = useAuth();

    // Show tooltip after 3 seconds if not dismissed and chat not open
    useEffect(() => {
        if (tooltipDismissed || isOpen) return;
        const timer = setTimeout(() => setShowTooltip(true), 3000);
        return () => clearTimeout(timer);
    }, [tooltipDismissed, isOpen]);

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
        if (!container) return;
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

    return (
        <>
            {/* ── Floating tooltip bubble ── */}
            {showTooltip && !isOpen && (
                <div
                    className="fixed z-50 bottom-[120px] sm:bottom-[148px] right-3 sm:right-5"
                    style={{ animation: "subaTooltipIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}
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

            {/* ── Floating trigger button ── */}
            {/* Floating close button — hidden on mobile (header X is used instead) */}
            {isOpen && (
                <button
                    id="suba-chat-trigger"
                    onClick={() => { setIsOpen(false); setShowTooltip(false); setTooltipDismissed(true); }}
                    aria-label="Cerrar chat"
                    className="fixed z-50 transition-all duration-300 hover:scale-110 active:scale-95 hidden sm:flex"
                    style={{
                        bottom: "80px",
                        right: "16px",
                        width: "48px",
                        height: "48px",
                        borderRadius: "50%",
                        border: "none",
                        cursor: "pointer",
                        background: "#ef4444",
                        boxShadow: "0 4px 20px rgba(239,68,68,0.4)",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                    }}
                >
                    <X size={20} color="#fff" strokeWidth={2.5} />
                </button>
            )}
            {/* Avatar trigger — smaller on mobile */}
            {!isOpen && (
                <button
                    id="suba-chat-trigger"
                    onClick={() => { setIsOpen(true); setShowTooltip(false); setTooltipDismissed(true); }}
                    aria-label="Hablar con Suba"
                    className="fixed z-50 transition-all duration-300 hover:scale-110 active:scale-95 suba-float w-[56px] h-[56px] sm:w-[80px] sm:h-[80px] bottom-[58px] sm:bottom-[68px] right-1 sm:right-1.5"
                    style={{
                        borderRadius: "0",
                        border: "none",
                        cursor: "pointer",
                        background: "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                        filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))",
                    }}
                >
                    <img
                        src={SUBA_AVATAR}
                        alt="Suba"
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                </button>
            )}

            {/* ── Chat Panel ── */}
            {isOpen && (
                <div
                    id="suba-chat-panel"
                    className="fixed z-50 flex flex-col inset-0 sm:inset-auto sm:bottom-[152px] sm:right-4"
                    style={{
                        width: undefined,
                        maxWidth: "100%",
                        overflow: "hidden",
                        border: "none",
                        background: "#0a0a14",
                        boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
                        animation: "subaSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                >
                    {/* Desktop-only sizing via inline style override */}
                    <style>{`
                        @media (min-width: 640px) {
                            #suba-chat-panel {
                                width: min(400px, calc(100vw - 32px)) !important;
                                height: min(560px, calc(100vh - 200px)) !important;
                                border-radius: 20px !important;
                                border: 1px solid rgba(181,251,5,0.12) !important;
                                inset: auto !important;
                            }
                        }
                    `}</style>
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
