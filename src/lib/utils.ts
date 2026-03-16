import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isContentAllowedForProfile(classification: string | undefined, isKids: boolean): boolean {
  if (!isKids) return true;
  if (!classification) return true;

  const blockedClassifications = ['12', '14', '16', '18'];
  return !blockedClassifications.includes(classification);
}
