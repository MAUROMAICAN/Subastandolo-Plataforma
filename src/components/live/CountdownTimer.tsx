import { useState, useEffect, useRef } from "react";

interface CountdownTimerProps {
    targetDate: string | Date;
    className?: string;
}

interface TimeLeft {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    total: number;
}

function calcTimeLeft(target: Date): TimeLeft {
    const now = new Date().getTime();
    const diff = target.getTime() - now;
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };

    return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
        total: diff,
    };
}

export default function CountdownTimer({ targetDate, className = "" }: CountdownTimerProps) {
    const target = useRef(new Date(targetDate));
    const [timeLeft, setTimeLeft] = useState<TimeLeft>(calcTimeLeft(target.current));

    useEffect(() => {
        target.current = new Date(targetDate);
        setTimeLeft(calcTimeLeft(target.current));
        const interval = setInterval(() => {
            setTimeLeft(calcTimeLeft(target.current));
        }, 1000);
        return () => clearInterval(interval);
    }, [targetDate]);

    if (timeLeft.total <= 0) {
        return (
            <span className={`text-red-400 font-bold text-xs animate-pulse ${className}`}>
                🔴 ¡Empieza ahora!
            </span>
        );
    }

    const parts: { value: number; label: string }[] = [];
    if (timeLeft.days > 0) parts.push({ value: timeLeft.days, label: "d" });
    parts.push({ value: timeLeft.hours, label: "h" });
    parts.push({ value: timeLeft.minutes, label: "m" });
    parts.push({ value: timeLeft.seconds, label: "s" });

    return (
        <div className={`flex items-center gap-1 ${className}`}>
            {parts.map(({ value, label }, i) => (
                <div key={label} className="flex items-center">
                    <span className="bg-nav text-white font-mono font-bold text-xs px-1.5 py-0.5 rounded min-w-[28px] text-center">
                        {String(value).padStart(2, "0")}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-semibold ml-0.5">
                        {label}
                    </span>
                    {i < parts.length - 1 && (
                        <span className="text-muted-foreground/50 text-xs mx-0.5">:</span>
                    )}
                </div>
            ))}
        </div>
    );
}
