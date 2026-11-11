// Opening bills for the vote lab. Positions are design estimates, not fitted values.
import type { Bill } from "./types";

const base = { dir2: 0, cut2: 0, sharp2: 0, base: 0, president: 0 as const, kind: "passage" as const };

export const BILLS: Bill[] = [
  { ...base, id: "recon_d", title: "Democratic budget reconciliation bill", blurb: "Raises taxes on corporations and high earners to fund health subsidies. Written by one party.",
    dir1: -1, cut1: 0.02, sharp1: 9, lead: { D: 1, R: -1 }, president: -1, taxHike: true },
  { ...base, id: "kids", title: "Kids online safety bill", blurb: "Teen privacy and limits on addictive app features. Co-written by both parties.",
    dir1: -1, cut1: 0.75, sharp1: 2.5, dir2: 1, cut2: -0.9, sharp2: 0.8, base: 0.6, lead: { D: 1, R: 0 }, president: 0 },
  { ...base, id: "ukraine", title: "Military aid to Ukraine", blurb: "Splits Republicans between hawks and America First members; most Democrats back it.",
    dir1: -1, cut1: 0.55, sharp1: 5, dir2: 1, cut2: -0.1, sharp2: 2.5, lead: { D: 1, R: 0 }, president: -1 },
  { ...base, id: "deport", title: "National deportation funding", blurb: "The President's priority. Republicans whip for it; a few swing-seat Democrats are tempted.",
    dir1: 1, cut1: -0.12, sharp1: 8, lead: { D: -1, R: 1 }, president: 1 },
  { ...base, id: "debt", title: "Raise the debt limit", blurb: "Must-pass. Each party's fiscal hawks and hardliners peel off; the middle carries it.",
    dir1: -1, cut1: 0.45, sharp1: 3.5, dir2: 1, cut2: 0.1, sharp2: 2, lead: { D: 1, R: 0 }, president: 1, kind: "mustpass" },
  { ...base, id: "warpowers", title: "War powers resolution on Iran", blurb: "Directs the President to end hostilities. Libertarian-leaning Republicans join most Democrats.",
    dir1: -1, cut1: 0.1, sharp1: 6, dir2: -1, cut2: -0.45, sharp2: 3, lead: { D: 1, R: -1 }, president: -1 },
  { ...base, id: "stockban", title: "Ban stock trading by members", blurb: "Popular with voters in both parties. Leadership on both sides is lukewarm.",
    dir1: -1, cut1: 0.9, sharp1: 1.2, dir2: -1, cut2: 0.5, sharp2: 1.5, base: 0.3, lead: { D: 0, R: 0 }, president: 0 },
  { ...base, id: "override", title: "Override the veto: background checks", blurb: "The bill passed with Republican votes. Now each of them must defy the President.",
    dir1: -1, cut1: 0.38, sharp1: 5, lead: { D: 1, R: -1 }, president: -1, kind: "override" },
];
