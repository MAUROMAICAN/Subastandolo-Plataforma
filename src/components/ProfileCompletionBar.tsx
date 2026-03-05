import { CheckCircle, ShieldCheck, ChevronRight } from "lucide-react";

interface ProfileData {
    full_name?: string | null;
    avatar_url?: string | null;
    city?: string | null;
    state?: string | null;
    cedula_number?: string | null;
    cedula_photo_url?: string | null;
}

interface ProfileCompletionBarProps {
    profile: ProfileData;
    compact?: boolean;
    onGoToProfile?: () => void;
}

export function getProfileCompletion(profile: ProfileData) {
    const fields = [
        { key: "full_name", label: "Nombre completo", value: !!profile?.full_name?.trim() },
        { key: "avatar_url", label: "Foto de perfil", value: !!profile?.avatar_url },
        { key: "address", label: "Dirección completa", value: !!(profile?.city?.trim() && profile?.state?.trim()) },
        { key: "cedula_number", label: "Número de cédula", value: !!profile?.cedula_number?.trim() },
        { key: "cedula_photo", label: "Foto de cédula", value: !!profile?.cedula_photo_url },
    ];
    const completed = fields.filter(f => f.value).length;
    const percentage = Math.round((completed / fields.length) * 100);
    return { fields, completed, total: fields.length, percentage };
}

export default function ProfileCompletionBar({
    profile,
    compact = false,
    onGoToProfile,
}: ProfileCompletionBarProps) {
    const { fields, completed, total, percentage } = getProfileCompletion(profile);
    const isVerified = percentage === 100;

    const barColor = isVerified
        ? "bg-green-500 dark:bg-[#A6E300]"
        : percentage >= 60
            ? "bg-amber-400"
            : "bg-red-400";

    if (compact) {
        return (
            <button
                onClick={onGoToProfile}
                className="w-full text-left"
                disabled={!onGoToProfile}
            >
                <div className="flex items-center gap-2">
                    {isVerified ? (
                        <ShieldCheck className="h-4 w-4 text-green-500 dark:text-[#A6E300] shrink-0" />
                    ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-semibold text-muted-foreground">
                                {isVerified ? "Perfil Verificado ✓" : `Perfil ${percentage}% completo`}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{completed}/{total}</span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                    </div>
                    {onGoToProfile && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                </div>
            </button>
        );
    }

    return (
        <div className="space-y-3">
            {/* Header + Badge */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {isVerified ? (
                        <div className="flex items-center gap-1.5 bg-green-500/10 dark:bg-[#A6E300]/10 border border-green-500/30 dark:border-[#A6E300]/30 rounded-full px-3 py-1">
                            <CheckCircle className="h-4 w-4 text-green-500 dark:text-[#A6E300]" />
                            <span className="text-xs font-bold text-green-600 dark:text-[#A6E300]">Perfil Verificado</span>
                        </div>
                    ) : (
                        <span className="text-sm font-semibold">Completar perfil</span>
                    )}
                </div>
                <span className="text-sm font-bold">{percentage}%</span>
            </div>

            {/* Progress bar */}
            <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>

            {/* Field checklist */}
            <div className="grid grid-cols-1 gap-1.5 mt-2">
                {fields.map(f => (
                    <div key={f.key} className="flex items-center gap-2 text-xs">
                        {f.value ? (
                            <CheckCircle className="h-3.5 w-3.5 text-green-500 dark:text-[#A6E300] shrink-0" />
                        ) : (
                            <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                        )}
                        <span className={f.value ? "text-foreground" : "text-muted-foreground"}>{f.label}</span>
                    </div>
                ))}
            </div>

            {!isVerified && (
                <p className="text-[10px] text-muted-foreground mt-1">
                    Completa tu perfil para obtener la insignia de <strong>Perfil Verificado</strong> y generar mayor confianza en la plataforma.
                </p>
            )}
        </div>
    );
}
