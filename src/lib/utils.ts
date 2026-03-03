import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function maskName(name: string | null | undefined): string {
  if (!name) return "";
  if (name.length <= 3) return `${name[0]}***`;
  return `${name.slice(0, 2)}***${name.slice(-1)}`;
}
