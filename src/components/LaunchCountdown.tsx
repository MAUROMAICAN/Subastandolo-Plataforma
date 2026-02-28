import { useState, useEffect } from "react";
import { Rocket } from "lucide-react";

const LAUNCH_DATE = new Date("2026-03-01T09:00:00-04:00"); // 9 AM Venezuela time

const LaunchCountdown = () => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [launched, setLaunched] = useState(false);

  useEffect(() => {
    const calc = () => {
      const diff = LAUNCH_DATE.getTime() - Date.now();
      if (diff <= 0) { setLaunched(true); return; }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff / 3600000) % 24),
        minutes: Math.floor((diff / 60000) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, []);

  if (launched) return null;

  const units = [
    { value: timeLeft.days, label: "Días" },
    { value: timeLeft.hours, label: "Horas" },
    { value: timeLeft.minutes, label: "Min" },
    { value: timeLeft.seconds, label: "Seg" },
  ];

  return (
    <section className="relative overflow-hidden bg-accent text-accent-foreground isolate">
      {/* Animated background particles */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-2 left-[10%] w-1 h-1 rounded-full bg-accent-foreground animate-pulse" />
        <div className="absolute top-4 left-[30%] w-1.5 h-1.5 rounded-full bg-accent-foreground animate-pulse delay-300" />
        <div className="absolute top-1 left-[50%] w-1 h-1 rounded-full bg-accent-foreground animate-pulse delay-700" />
        <div className="absolute top-3 left-[70%] w-1.5 h-1.5 rounded-full bg-accent-foreground animate-pulse delay-500" />
        <div className="absolute top-2 left-[90%] w-1 h-1 rounded-full bg-accent-foreground animate-pulse delay-200" />
      </div>

      <div className="container mx-auto px-4 py-5 sm:py-6 relative">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
          {/* Left: label */}
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 sm:h-6 sm:w-6 animate-bounce" />
            <div className="text-center sm:text-left">
              <p className="text-[10px] sm:text-xs font-medium uppercase tracking-widest opacity-80">
                Gran Inauguración
              </p>
              <p className="text-sm sm:text-base font-heading font-bold leading-tight">
                1 de Marzo · 9:00 AM
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-10 bg-accent-foreground/20" />

          {/* Countdown digits */}
          <div className="flex items-center gap-2 sm:gap-3">
            {units.map((u, i) => (
              <div key={u.label} className="flex items-center gap-2 sm:gap-3">
                <div className="flex flex-col items-center">
                  <span className="bg-accent-foreground/10 border border-accent-foreground/20 font-mono font-black text-xl sm:text-3xl rounded-md px-3 py-2 sm:px-4 sm:py-3 min-w-[3rem] sm:min-w-[4rem] text-center tabular-nums shadow-sm">
                    {String(u.value).padStart(2, "0")}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold mt-1 uppercase tracking-wider opacity-80">
                    {u.label}
                  </span>
                </div>
                {i < units.length - 1 && (
                  <span className="opacity-60 font-black text-lg sm:text-2xl -mt-4 animate-pulse">
                    :
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default LaunchCountdown;
