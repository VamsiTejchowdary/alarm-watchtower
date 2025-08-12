import React, { useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  className?: string;
  iconClassName?: string;
  onClick?: () => void;
};

export function RotatingIconButton({ title = "Rotate", className, iconClassName, onClick }: Props) {
  const [rotationDeg, setRotationDeg] = useState(0);

  const handleClick = () => {
    setRotationDeg((deg) => deg + 360);
    onClick?.();
  };

  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      onClick={handleClick}
      className={cn(
        "h-10 w-10 rounded-full border border-gray-300 bg-white hover:bg-gray-50 flex items-center justify-center shadow-sm transition-colors",
        className
      )}
    >
      <RefreshCw
        className={cn("h-4 w-4 text-gray-700", iconClassName)}
        style={{ transform: `rotate(${rotationDeg}deg)`, transition: "transform 500ms ease" }}
      />
    </button>
  );
}

export default RotatingIconButton;


