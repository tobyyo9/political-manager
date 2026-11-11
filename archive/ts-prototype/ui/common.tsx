import type { Member } from "../engine/types";

export const STATE_NAMES: Record<string, string> = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming" };

export const seat = (m: Member) => `${m.state}-${m.district === 0 ? "AL" : String(m.district).padStart(2, "0")}`;
export const partyWord = (p: string) => (p === "D" ? "Democrat" : p === "R" ? "Republican" : "Independent");
export const initials = (n: string) => n.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

// Blue to red by ideology, so each party shows its own left and right wings.
export function ideoColor(m: Member) {
  const t = Math.max(0, Math.min(1, (m.dim1 + 0.85) / 1.7));
  const stops = [[27, 63, 143], [61, 123, 217], [157, 184, 240], [240, 163, 150], [196, 71, 59], [122, 31, 26]];
  const x = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export const TRAIT: Record<string, [string, string]> = {
  dealmaker: ["Dealmaker", "Easier to move, but always wants something back."],
  believer: ["True believer", "Moves only on the merits as they see them."],
  grudge: ["Holds grudges", "Remembers a broken promise for years."],
  vain: ["Vain", "Likes to be asked personally, and to get the credit."],
  loyalist: ["Party loyalist", "Follows leadership unless the district objects loudly."],
  ambitious: ["Ambitious", "Every vote is a step toward a bigger job."],
  cautious: ["Cautious", "Waits to see which way the wind blows."],
  showboat: ["Showboat", "Votes for the cameras as much as the bill."],
};

export function safety(m: Member) {
  const o = m.ownLean;
  if (o == null) return ["Unknown", "muted"];
  if (o >= 15) return ["Safe seat", "safe"];
  if (o >= 6) return ["Likely safe", "safe"];
  if (o >= 0) return ["Competitive", "warn"];
  return ["Hostile ground", "bad"];
}

// Seats in arcs, left to right.
export function arcSeats(total: number) {
  const rows = total > 200 ? 10 : 5;
  const radii = Array.from({ length: rows }, (_, i) => 0.42 + 0.58 * (i / (rows - 1)));
  const sumR = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map((r) => Math.round((total * r) / sumR));
  counts[rows - 1] += total - counts.reduce((a, b) => a + b, 0);
  const seats: { a: number; x: number; y: number }[] = [];
  radii.forEach((r, i) => { for (let k = 0; k < counts[i]; k++) { const a = Math.PI * (1 - k / (counts[i] - 1)); seats.push({ a, x: r * Math.cos(a), y: r * Math.sin(a) }); } });
  seats.sort((p, q) => q.a - p.a);
  return { seats, dotR: (Math.PI * sumR) / total / 2.35 };
}
