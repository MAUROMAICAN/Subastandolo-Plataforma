import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Bot, User, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Message {
    role: "user" | "assistant";
    content: string;
}

const AiChatWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { user } = useAuth();

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

    // Add welcome message on first open
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([{
                role: "assistant",
                content: "¡Hola! 👋 Soy **SubastBot**, tu asistente virtual de Subastandolo. ¿En qué puedo ayudarte hoy?\n\nPuedes preguntarme sobre:\n• 🔨 Cómo funcionan las subastas\n• 💳 Proceso de pago\n• 📦 Estado de envíos\n• 🛡️ Disputas y protección\n• 👤 Tu cuenta y perfil",
            }]);
        }
    }, [isOpen, messages.length]);

    const sendMessage = async () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading) return;

        const userMessage: Message = { role: "user", content: trimmed };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInput("");
        setIsLoading(true);

        try {
            // Send only last 10 messages as history to keep context manageable
            const historyToSend = updatedMessages.slice(-10).map(m => ({
                role: m.role,
                content: m.content,
            }));

            const { data, error } = await supabase.functions.invoke("ai-assistant", {
                body: {
                    message: trimmed,
                    history: historyToSend.slice(0, -1), // Don't include the current message in history
                    userId: user?.id || null,
                },
            });

            if (error) throw error;

            setMessages(prev => [...prev, {
                role: "assistant",
                content: data?.reply || "Lo siento, no pude procesar tu mensaje. Intenta de nuevo.",
            }]);
        } catch (err) {
            console.error("[AiChatWidget] Error:", err);
            setMessages(prev => [...prev, {
                role: "assistant",
                content: "⚠️ Hubo un error al procesar tu mensaje. Por favor intenta de nuevo o contacta a soporte@subastandolo.com.",
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

    // Simple markdown-like rendering for bold text
    const renderContent = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith("**") && part.endsWith("**")) {
                return <strong key={i} style={{ color: "#EAB308" }}>{part.slice(2, -2)}</strong>;
            }
            // Handle newlines
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
            {/* Floating Button */}
            <button
                id="ai-chat-toggle"
                onClick={() => setIsOpen(!isOpen)}
                className="fixed z-50 shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95"
                style={{
                    bottom: "80px",
                    right: "20px",
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #EAB308, #F59E0B)",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 24px rgba(234, 179, 8, 0.4)",
                }}
            >
                {isOpen ? (
                    <X size={24} color="#1a1a2e" strokeWidth={2.5} />
                ) : (
                    <MessageCircle size={24} color="#1a1a2e" strokeWidth={2.5} />
                )}
            </button>

            {/* Chat Panel */}
            {isOpen && (
                <div
                    className="fixed z-50 flex flex-col"
                    style={{
                        bottom: "148px",
                        right: "20px",
                        width: "min(380px, calc(100vw - 40px))",
                        height: "min(520px, calc(100vh - 200px))",
                        borderRadius: "16px",
                        overflow: "hidden",
                        border: "1px solid #2a2a4e",
                        background: "#0f0f1a",
                        boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
                        animation: "slideUp 0.3s ease-out",
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            background: "linear-gradient(135deg, #1a1a2e, #252550)",
                            padding: "16px 20px",
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            borderBottom: "1px solid #2a2a4e",
                        }}
                    >
                        <div
                            style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "50%",
                                background: "linear-gradient(135deg, #EAB308, #F59E0B)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                            }}
                        >
                            <Bot size={20} color="#1a1a2e" strokeWidth={2.5} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, color: "#fff", fontSize: "14px", fontWeight: 700 }}>SubastBot</p>
                            <p style={{ margin: 0, color: "#22c55e", fontSize: "11px", fontWeight: 600 }}>● En línea</p>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: "4px",
                                borderRadius: "8px",
                                display: "flex",
                            }}
                        >
                            <X size={18} color="#9ca3af" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div
                        className="flex-1 overflow-y-auto"
                        style={{
                            padding: "16px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                        }}
                    >
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                style={{
                                    display: "flex",
                                    gap: "8px",
                                    flexDirection: msg.role === "user" ? "row-reverse" : "row",
                                    alignItems: "flex-start",
                                }}
                            >
                                {/* Avatar */}
                                <div
                                    style={{
                                        width: "28px",
                                        height: "28px",
                                        borderRadius: "50%",
                                        background: msg.role === "assistant"
                                            ? "linear-gradient(135deg, #EAB308, #F59E0B)"
                                            : "linear-gradient(135deg, #3b82f6, #2563eb)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                    }}
                                >
                                    {msg.role === "assistant" ? (
                                        <Bot size={14} color="#1a1a2e" />
                                    ) : (
                                        <User size={14} color="#fff" />
                                    )}
                                </div>
                                {/* Bubble */}
                                <div
                                    style={{
                                        maxWidth: "78%",
                                        padding: "10px 14px",
                                        borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                                        background: msg.role === "user" ? "#2563eb" : "#1a1a2e",
                                        border: msg.role === "user" ? "none" : "1px solid #2a2a4e",
                                        color: "#e0e0e0",
                                        fontSize: "13px",
                                        lineHeight: "1.6",
                                        wordBreak: "break-word",
                                    }}
                                >
                                    {renderContent(msg.content)}
                                </div>
                            </div>
                        ))}

                        {/* Loading indicator */}
                        {isLoading && (
                            <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                                <div
                                    style={{
                                        width: "28px",
                                        height: "28px",
                                        borderRadius: "50%",
                                        background: "linear-gradient(135deg, #EAB308, #F59E0B)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                    }}
                                >
                                    <Bot size={14} color="#1a1a2e" />
                                </div>
                                <div
                                    style={{
                                        padding: "12px 16px",
                                        borderRadius: "14px 14px 14px 4px",
                                        background: "#1a1a2e",
                                        border: "1px solid #2a2a4e",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px",
                                    }}
                                >
                                    <Loader2 size={14} color="#EAB308" className="animate-spin" />
                                    <span style={{ color: "#9ca3af", fontSize: "12px" }}>SubastBot está escribiendo...</span>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div
                        style={{
                            padding: "12px 16px",
                            borderTop: "1px solid #2a2a4e",
                            background: "#0f0f1a",
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                        }}
                    >
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Escribe tu pregunta..."
                            disabled={isLoading}
                            style={{
                                flex: 1,
                                background: "#1a1a2e",
                                border: "1px solid #2a2a4e",
                                borderRadius: "12px",
                                padding: "10px 14px",
                                color: "#e0e0e0",
                                fontSize: "13px",
                                outline: "none",
                            }}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim() || isLoading}
                            style={{
                                width: "40px",
                                height: "40px",
                                borderRadius: "12px",
                                background: input.trim() && !isLoading
                                    ? "linear-gradient(135deg, #EAB308, #F59E0B)"
                                    : "#2a2a4e",
                                border: "none",
                                cursor: input.trim() && !isLoading ? "pointer" : "default",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.2s",
                                flexShrink: 0,
                            }}
                        >
                            <Send size={16} color={input.trim() && !isLoading ? "#1a1a2e" : "#555"} />
                        </button>
                    </div>
                </div>
            )}

            {/* CSS Animation */}
            <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </>
    );
};

export default AiChatWidget;
