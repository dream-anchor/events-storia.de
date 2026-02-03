import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format date as DD.MM.YYYY (German standard)
 * @param dateStr - ISO date string (yyyy-MM-dd) or Date object
 * @returns Formatted date string (DD.MM.YYYY)
 */
export function formatDateDE(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '';

  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return '';

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();

  return `${day}.${month}.${year}`;
}

/**
 * Format date and time as DD.MM.YYYY HH:MM
 * @param dateStr - ISO date string or Date object
 * @param timeStr - Time string in HH:MM format (optional)
 * @returns Formatted date/time string
 */
export function formatDateTimeDE(
  dateStr: string | Date | null | undefined,
  timeStr?: string | null
): string {
  const formattedDate = formatDateDE(dateStr);
  if (!formattedDate) return '';

  if (timeStr) {
    return `${formattedDate} ${timeStr}`;
  }

  // If dateStr contains time info
  if (typeof dateStr === 'string' && dateStr.includes('T')) {
    const date = new Date(dateStr);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${formattedDate} ${hours}:${minutes}`;
  }

  return formattedDate;
}
