import { useState, useEffect, useRef } from "react";

interface CountdownProps {
  endTime: string;
  onEnd?: () => void;
  large?: boolean;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const Countdown = ({ endTime, onEnd, large }: CountdownProps) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [ended, setEnded] = useState(false);
  const [tick, setTick] = useState(false);
  const prevSeconds = useRef<number | null>(null);

  useEffect(() => {
    const calculate = () => {
      const diff = new Date(endTime).getTime() - Date.now();
      if (diff <= 0) {
        setEnded(true);
        setTimeLeft(null);
        onEnd?.();
        return;
      }
      const seconds = Math.floor((diff / 1000) % 60);
      if (prevSeconds.current !== null && prevSeconds.current !== seconds) {
        setTick(true);
        setTimeout(() => setTick(false), 150);
      }
      prevSeconds.current = seconds;
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds,
      });
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [endTime, onEnd]);

  if (ended) {
    return (
      <span className="text-[10px] font-medium text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded-sm">
        Finalizada
      </span>
    );
  }

  if (!timeLeft) return null;

  const totalSeconds = timeLeft.days * 86400 + timeLeft.hours * 3600 + timeLeft.minutes * 60 + timeLeft.seconds;
  const isUrgent = totalSeconds < 3600; // less than 1 hour
  const isCritical = totalSeconds < 300; // less than 5 minutes

  const units = [
    { value: timeLeft.days, label: "d" },
    { value: timeLeft.hours, label: "h" },
    { value: timeLeft.minutes, label: "m" },
    { value: timeLeft.seconds, label: "s", isSeconds: true },
  ];

  return (
    <div className={`flex items-center gap-0.5 transition-all duration-300 ${
      isCritical ? "countdown-critical" : isUrgent ? "countdown-urgent" : ""
    }`}>
      {units.map((unit) => (
        <div key={unit.label} className="flex items-center">
          <span className={`inline-flex items-center justify-center font-mono font-bold rounded-sm tabular-nums transition-all duration-150 ${
            large ? "text-lg px-2 py-1 min-w-[2rem]" : "text-[10px] px-1 py-0.5 min-w-[1.4rem]"
          } ${
            unit.isSeconds && tick
              ? "bg-primary/15 border-primary/40 text-primary scale-105 border"
              : isCritical
                ? "bg-destructive/10 border border-destructive/30 text-destructive"
                : isUrgent
                  ? "bg-accent/10 border border-accent/30 text-accent-foreground"
                  : "bg-secondary border border-border text-foreground"
          }`}>
            {String(unit.value).padStart(2, "0")}
          </span>
          <span className={`font-medium ml-0.5 ${large ? "text-xs" : "text-[9px]"} ${
            isCritical ? "text-destructive/70" : isUrgent ? "text-accent-foreground/70" : "text-muted-foreground"
          }`}>
            {unit.label}
          </span>
        </div>
      ))}
      {isCritical && (
        <span className="ml-1 text-[8px] font-bold text-destructive animate-pulse">
          🔥
        </span>
      )}
    </div>
  );
};

export default Countdown;
