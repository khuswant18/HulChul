// Tiny helpers for server-rendered pages. No template engine needed for this size.

export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const rupees = (n: number) => "₹" + n.toLocaleString("en-IN");

export function stipendText(min: number, max: number) {
  return min === max ? `${rupees(min)} /month` : `${rupees(min)} - ${max.toLocaleString("en-IN")} /month`;
}

export function shortDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function daysAgoText(d: Date) {
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}
