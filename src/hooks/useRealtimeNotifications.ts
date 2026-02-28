import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useRealtimeNotifications = () => {
    const { toast } = useToast();
    const audioUnlocked = useRef(false);

    const pujandoSound = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        pujandoSound.current = new Audio("/sounds/pujando.mp3");

        // Attempt to unlock audio immediately (might work if user already interacted)
        const unlockAudio = () => {
            audioUnlocked.current = true;
            document.removeEventListener("click", unlockAudio);
            document.removeEventListener("touchstart", unlockAudio);
        };

        document.addEventListener("click", unlockAudio);
        document.addEventListener("touchstart", unlockAudio);

        return () => {
            document.removeEventListener("click", unlockAudio);
            document.removeEventListener("touchstart", unlockAudio);
        };
    }, []);

    useEffect(() => {
        const channel = supabase
            .channel('public:bids')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'bids' },
                (payload) => {
                    console.log("Nueva puja detectada:", payload);
                    if (audioUnlocked.current && pujandoSound.current) {
                        pujandoSound.current.currentTime = 0;
                        pujandoSound.current.play().catch(e => console.warn("Auto-play prevented", e));
                    }

                    toast({
                        title: "¡Nueva Puja Registrada!",
                        description: "Alguien acaba de pujar en una de nuestras subastas.",
                        duration: 4000,
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [toast]);
};
