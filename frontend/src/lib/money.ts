/** Presentation only. Authoritative calculations belong to the server. */
export function money(value: string): string {
  if (!/^-?\d+(\.\d{1,2})?$/.test(value)) return "Unavailable";
  const [whole, fraction = ""] = value.split(".");
  return `PKR ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction.padEnd(2, "0")}`;
}
export function businessToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function displayDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${value}T12:00:00Z`))
    : value;
}
