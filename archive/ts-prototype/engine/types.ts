// Core types for the simulation. The engine has no screen code and no randomness
// of its own: every roll comes from a seeded generator passed in.

export type Party = "D" | "R" | "I";

export interface Member {
  id: string;            // bioguide id
  name: string;          // real name (shown only when the setting is on)
  alias: string;         // swapped-initial name used in the game
  party: Party;
  state: string;
  district: number;      // 0 = at large
  dim1: number;          // DW-NOMINATE, economic left (-1) to right (+1)
  dim2: number;          // DW-NOMINATE second dimension
  presD: number | null;  // 2024 presidential vote in the district, percent
  presR: number | null;
  lean: number | null;   // presR - presD
  ownLean: number | null;// lean toward the member's own party
  terms: number;
  since: number;
  unity: number | null;  // share of party-split votes cast with their party (real)
  votesCast: number;
  traits: string[];      // invented, game-only
  ambition: number;      // invented
  ethics: number;        // invented
  media: number;         // invented
}

export type Stance = -1 | 0 | 1;   // whip against, free vote, whip for

export interface Bill {
  id: string;
  title: string;
  blurb: string;
  // Where the bill sits. direction +1 means a yes is the conservative side on that line.
  dir1: number;          // -1 | 0 | 1
  cut1: number;          // the point on the economic line where members flip
  sharp1: number;        // how strongly the economic line divides the chamber (0 = not at all)
  dir2: number;
  cut2: number;
  sharp2: number;
  base: number;          // general appeal: lifts everyone toward yes (popular, bipartisan-written)
  lead: { D: Stance; R: Stance };   // what each party's leadership does
  president: Stance;     // the President's public position
  kind: "passage" | "procedural" | "override" | "mustpass";
  taxHike?: boolean;     // triggers the anti-tax pledge for signers
}

export interface Pressure { label: string; value: number }

export interface MemberVote {
  id: string;
  lean: number;          // L in the formula
  p: number;             // probability of yes
  yes: boolean;          // what happened when the roll was called
  pressures: Pressure[]; // itemized, largest first
  crossed: boolean;      // voted against their party's majority
}

export interface RollCallResult {
  bill: Bill;
  votes: MemberVote[];
  yes: number; no: number; need: number; passed: boolean;
  byParty: Record<string, { yes: number; no: number }>;
}
