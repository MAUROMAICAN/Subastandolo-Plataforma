import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

const sizeMap = { sm: 12, md: 16, lg: 20 };

const StarRating = ({ rating, maxStars = 5, size = "md", interactive = false, onChange }: StarRatingProps) => {
  const iconSize = sizeMap[size];

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: maxStars }, (_, i) => {
        const filled = i < rating;
        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(i + 1)}
            className={`${interactive ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default"} shrink-0`}
          >
            <Star
              width={iconSize}
              height={iconSize}
              className={filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}
            />
          </button>
        );
      })}
    </div>
  );
};

export default StarRating;
