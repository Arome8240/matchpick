export function formatDuration(ms: number): string {
  if (ms <= 0) return "Locked";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function formatAddress(address: string): string {
  return address;
}

export function formatSimTimestamp(ms: number): string {
  const totalHours = Math.floor(ms / 3600000);
  const day = Math.floor(totalHours / 24) + 1;
  const hour = totalHours % 24;
  return `Day ${day}, ${String(hour).padStart(2, "0")}:00`;
}
