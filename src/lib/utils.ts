import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function maskName(name: string | null | undefined): string {
  if (!name) return "";
  const str = name.trim();
  if (str.length <= 2) return `${str[0]}*`;
  if (str.length <= 4) return `${str.slice(0, 2)}***`;
  return `${str.slice(0, 2)}${"*".repeat(str.length - 3)}${str.slice(-1)}`;
}
