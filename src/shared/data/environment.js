// The political environment the 2028 race starts from.
// The 2026 midterms had no presidential race, so there are no state-by-state
// presidential margins after 2024. The game starts from the certified 2024
// margins and shifts every state by the national change since then.

// Early national figures (votes still being counted as of Nov 8, 2026):
// Democrats won the House popular vote by about 13 points, roughly 15 points
// better than 2024 (Yahoo News summarizing early NYT estimates).
export const MIDTERM_SWING = 15;

// Midterm waves only partly carry into the next presidential race. Examples
// (game reading of national results): 2018's D wave of about 10 points left
// about 2-3 points by 2020 (~25%); 2010's R wave of about 17 points left about
// 3 by 2012 (~20%); 2006's D wave mostly held into 2008 (~90%), helped by a
// financial crisis. The game's default is 35%, an estimate.
export const DEFAULT_CARRY = 0.35;

export const ENV_SOURCE = "Yahoo News, \"Democrats' 2026 midterm rout was big\" (Nov 2026), citing early New York Times estimates; votes still being counted. Carryover to 2028 is a game estimate based on past midterm-to-presidential shifts.";
export const ENV_URL = "https://www.yahoo.com/news/politics/article/democrats-2026-midterm-rout-was-big--really-big-here-are-the-numbers-that-prove-it-225923613.html";
