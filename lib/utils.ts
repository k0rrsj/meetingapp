import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | null): string {
  if (!date) return '—';
  try {
    return format(parseISO(date), 'd MMMM yyyy', { locale: ru });
  } catch {
    return date;
  }
}

export function formatShortDate(date: string | null): string {
  if (!date) return '—';
  try {
    return format(parseISO(date), 'dd.MM.yyyy', { locale: ru });
  } catch {
    return date;
  }
}

export function formatDateTime(date: string | null): string {
  if (!date) return '—';
  try {
    return format(parseISO(date), 'd MMM yyyy, HH:mm', { locale: ru });
  } catch {
    return date;
  }
}
