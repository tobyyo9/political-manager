// Scenes: short staged moments built from templates and the game's current state.
// Each beat offers 2-4 choices. A choice rolls your attribute against the other side's;
// risky choices swing harder both ways. Lines are generic and invented: nobody is quoted.
import * as S from "./sim.js";

const sig = (z) => 1 / (1 + Math.exp(-z));
const hashN = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const HOSTS = [["Morgan", "Hale"], ["Sam", "Ortega"], ["Priya", "Lindqvist"], ["Grant", "Calloway"]];
const MODS = [["Elena", "Marchetti"], ["Desmond", "Fontaine"]];
const anchor = (list, seed) => { const [f, l] = list[Math.floor(hashN(seed) * list.length)]; return { name: `${f} ${l}`, face: { id: "host" + l, g: /a$|ie$/.test(f) ? "F" : "M", born: 1972, p: "N" } }; };
const partyName = (p) => (p === "D" ? "Democrats" : "Republicans");
const other = (p) => (p === "D" ? "R" : "D");

// choice: { label, stat, risk, mod, aud: {base, swing, profile}, good, bad, tag }
function build(s, msg, real) {
  const sc = msg.scene, you = S.memberById[s.youId], role = S.roleOf(s), yourName = `${S.titleOf(you)} ${S.nameOf(you, real)}`;
  const P = S.presParty();
  if (sc.type === "tv") {
    const host = anchor(HOSTS, msg.id), bill = S.byId[sc.pid]?.name || "the bill", info = S.billInfo(sc.pid, you.p);
    return { setting: "studio", network: "WNC · Washington News Channel", lower: [`${host.name}`, "Host, The Briefing"], cast: [{ name: host.name, title: "Host", face: host.face, stat: 13 }, { name: yourName, title: `${you.p}-${you.seat}`, face: you, you: true }],
      intro: `Tonight, ${host.name} has you live for six minutes.`,
      beats: [
        { who: 0, line: sc.off ? `You broke with your own party on ${bill}. ${partyName(you.p)} in leadership are not happy. Why did you do it?` : `You voted ${sc.vote ? "for" : "against"} ${bill} this week. Walk our viewers through that.`,
          choices: [
            { label: "My district comes first", stat: "Integrity", aud: { swing: 1.2, base: sc.off ? -0.6 : 0.2 }, good: "You tell the story of a family back home. It sounds like you mean it.", bad: "It sounds like a line your staff wrote. The host lets the silence sit." },
            { label: "Pivot to what it costs", stat: "Policy", aud: { swing: 0.8, base: 0.3 }, good: "You walk through the numbers cleanly. The host nods along.", bad: "You lose the thread halfway through a figure. The host jumps in." },
            { label: "Hit back at the other side", stat: "Media", risk: true, aud: { base: 1.6, swing: -0.6, profile: 1.5 }, good: "It's sharp and it's quotable. The clip is already moving.", bad: "It comes off angry. The host asks if you're dodging the question." },
          ] },
        { who: 0, line: `Polls say ${info.pop > 0.03 ? "most voters like" : info.pop < -0.03 ? "most voters dislike" : "voters are split on"} this bill. Are you out of step with the country?`,
          choices: [
            { label: "Cite the numbers", stat: "Policy", aud: { swing: 0.8 }, good: "You know the crosstabs better than the host does.", bad: "You cite a poll the host has never heard of. It doesn't help." },
            { label: "Polls aren't votes", stat: "Media", risk: true, aud: { base: 1, profile: 1 }, good: "Delivered with a smile. It plays.", bad: "It sounds dismissive of the voters you're supposed to represent." },
            { label: "Concede it, then explain", stat: "Integrity", aud: { swing: 1.2, base: -0.3 }, good: "Honest and calm. The host thanks you for a straight answer.", bad: "You concede too much. The chyron reads 'Admits bill is unpopular.'" },
          ] },
        { who: 0, line: P === you.p ? "Last question. Does the President have your back on this?" : "Last question. The President has been attacking members who vote like you. Are you worried?",
          choices: [
            { label: "Laugh it off", stat: "Media", risk: true, aud: { profile: 2, swing: 0.4 }, good: "The laugh is real and so is the line. It ends up on late-night TV.", bad: "The laugh lands wrong. Nobody else is laughing." },
            { label: "Stay on message", stat: "Policy", aud: { swing: 0.5 }, good: "Disciplined. Your communications director exhales.", bad: "Disciplined to the point of robotic." },
            P === you.p ? { label: "Praise the President", stat: "Loyalty", aud: { base: 1.4, swing: -0.4 }, good: "Warm words for the White House. Someone there is watching.", bad: "It sounds like you're auditioning for a job." }
              : { label: "Take a shot at the President", stat: "Media", risk: true, aud: { base: 1.8, swing: -0.2, profile: 2 }, good: "A clean, cutting line. Your fundraising email writes itself.", bad: "It's a cheap shot, and the host says so." },
          ] },
      ],
      headline: (score) => score >= 3 ? `${S.nameOf(you, real)} wins the night on cable: "${bill}" defense goes viral` : score <= -3 ? `${S.nameOf(you, real)} stumbles through tense interview on ${bill}` : `${S.nameOf(you, real)} defends ${bill} vote in cable interview` };
  }
  if (sc.type === "hearing") {
    const c = s.cab.find((x) => x.id === sc.cab), wit = S.cabName(c, real), chairLike = anchor(MODS, msg.id + "chair");
    const face = { id: "cab" + c.last, g: /Susie|Brooke|Linda|Pam|Jeanine|Kari/.test(c.first) ? "F" : "M", born: c.born || 1970, p: P, look: c.tone !== undefined ? { skin: c.tone } : undefined };
    const atk = sc.mine;
    return { setting: "hearing", network: "C-SPAN 3 · Live", lower: [wit, c.post], cast: [{ name: wit, title: c.post, face, stat: 9 + Math.round((1 - c.heat) * 6) }, { name: yourName, title: `${you.p}-${you.seat}`, face: you, you: true }],
      intro: atk ? `${wit} is at the witness table. The room is full. You have five minutes.` : `Your party's ${c.short} chief has taken an hour of fire. You have five minutes to help.`,
      beats: atk ? [
        { who: 0, line: `"Thank you. I'm proud of the work our department has done, and I look forward to your questions."`,
          choices: [
            { label: "Lay out the paper trail", stat: "Policy", aud: { swing: 0.8, base: 0.6 }, good: "Exhibit A, B and C. The witness reads along and goes pale.", bad: "Your staff mislabeled an exhibit. The witness corrects you, politely." },
            { label: "Go for the viral moment", stat: "Media", risk: true, aud: { base: 1.6, profile: 2.5, swing: -0.3 }, good: "A question built for the clip. It works.", bad: "The question is clever, the answer is better. The clip is theirs." },
            { label: "Ask a simple yes or no", stat: "Integrity", aud: { swing: 1 }, good: "Plain and fair. The witness can't wriggle out.", bad: "They answer 'it's more complicated than that' and run out your clock." },
          ] },
        { who: 0, line: `"I'd have to check with my staff on that, and I'll get back to the committee."`,
          choices: [
            { label: "Read their own words back", stat: "Policy", aud: { swing: 0.6, base: 0.8 }, good: "You quote their memo back to them. The room murmurs.", bad: "You misquote by a word. They pounce on it." },
            { label: "Demand a yes or no", stat: "Media", risk: true, aud: { base: 1.4, profile: 1.5 }, good: "'Yes or no.' Three times. They finally say no. That's the clip.", bad: "You talk over them. Now you look like the bully." },
            { label: "Enter it into the record", stat: "Negotiation", aud: { swing: 0.4 }, good: "Quiet, methodical, and it sets up the subpoena.", bad: "Procedurally fine. Nobody will remember it." },
          ] },
        { who: 0, line: `The chair: "The time of the member has expired."`,
          choices: [
            { label: "Call for a resignation", stat: "Media", risk: true, aud: { base: 2, swing: -0.4, profile: 2 }, good: "It's on every network within the hour.", bad: "It feels like overreach after a so-so hearing." },
            { label: "Promise a subpoena", stat: "Policy", aud: { base: 1, swing: 0.3 }, good: "It sounds like the start of something.", bad: "It sounds like a threat you can't back up." },
            { label: "Thank the witness", stat: "Integrity", aud: { swing: 0.8, base: -0.4 }, good: "Measured. The local paper calls you serious.", bad: "Your own side calls it soft." },
          ] },
      ] : [
        { who: 0, line: `"I appreciate the chance to finally answer some of these questions."`,
          choices: [
            { label: "Give them room to explain", stat: "Policy", aud: { swing: 0.6, base: 0.5 }, good: "Your softball lets them deliver their best answer of the day.", bad: "They ramble. You burn two minutes for nothing." },
            { label: "Attack the investigation", stat: "Media", risk: true, aud: { base: 1.8, swing: -0.5, profile: 1.5 }, good: "'A witch hunt dressed up as oversight.' Your side loves it.", bad: "It sounds like you're hiding something on their behalf." },
            { label: "Change the subject", stat: "Media", aud: { base: 0.6 }, good: "You steer to the department's wins. It takes the heat off.", bad: "Obvious, and the press says so." },
          ] },
        { who: 0, line: `"I want to be clear that nothing improper happened."`,
          choices: [
            { label: "Build their alibi", stat: "Policy", aud: { base: 0.8 }, good: "Step by step, you walk the timeline. It holds.", bad: "Step three of the timeline doesn't match the documents." },
            { label: "Praise their record", stat: "Loyalty", aud: { base: 1 }, good: "The White House sends a thank-you text before you sit down.", bad: "Laying it on thick. The other side smirks." },
          ] },
      ],
      headline: (score) => atk ? (score >= 3 ? `${S.nameOf(you, real)} corners ${wit} at heated hearing` : score <= -3 ? `${wit} parries ${S.nameOf(you, real)}'s questions at hearing` : `${S.nameOf(you, real)} presses ${wit} at oversight hearing`) : (score >= 2 ? `${S.nameOf(you, real)} mounts strong defense of ${wit}` : `${wit} hearing goes on; ${S.nameOf(you, real)}'s defense falls flat` ) };
  }
  if (sc.type === "leader") {
    const boss = S.memberById[sc.boss], b = s.bills.find((x) => x.id === sc.bill), bill = b ? S.byId[b.pid].name : "the bill", w = b ? S.whipCount(s, b, you.ch) : { yes: 0 };
    return { setting: "office", network: "Leadership offices · Closed door", lower: [S.nameOf(boss, real), boss.lead?.[0] || "Party leadership"], cast: [{ name: S.nameOf(boss, real), title: boss.lead?.[0] || "Leadership", face: boss, stat: S.attrs(boss).Negotiation, id: boss.id }, { name: yourName, title: `${you.p}-${you.seat}`, face: you, you: true }],
      intro: `The door closes. ${S.nameOf(boss, real)} doesn't sit down.`,
      beats: [
        { who: 0, line: `"I need you on ${bill}. Our count is about ${w.yes}. It's going to be close, and I'm not going to forget who was there."`,
          choices: [
            { label: "I'll be there", stat: "Loyalty", tag: "deal", end: true, aud: { base: 0.6, swing: -0.4 }, good: "A handshake. You'll be remembered for it.", bad: "They expected you to say yes. It earns you less than you hoped." },
            { label: "What's in it for my district?", stat: "Negotiation", tag: "ask", aud: {}, good: "A pause, then a smile. 'Let's talk.'", bad: "'This isn't a bazaar.' The temperature drops." },
            { label: "My district won't take it", stat: "Integrity", tag: "refuse", end: true, aud: { swing: 1, base: -0.5 }, good: "They don't like it, but they respect it.", bad: "'Then I hope your district raises your money too.'" },
          ] },
        { who: 0, line: `"Here's what I can do: your bill gets a floor slot, and I'll come campaign for you. But I need a yes by Thursday."`,
          choices: [
            { label: "Deal", stat: "Negotiation", tag: "deal", aud: { base: 0.4 }, good: "Done. You walk out with something to show for it.", bad: "Done, though you'll wonder if you could have gotten more." },
            { label: "Ask for a committee seat too", stat: "Negotiation", risk: true, tag: "deal", aud: { profile: 1 }, good: "They laugh, then agree. You overplayed it and it worked.", bad: "'Don't push it.' You get the deal, and a reputation." },
            { label: "Walk away", stat: "Integrity", tag: "refuse", aud: { swing: 0.8, base: -0.6 }, good: "You leave on decent terms.", bad: "The door closes harder than it opened." },
          ] },
      ],
      headline: (score, tags) => tags.includes("refuse") ? `${S.nameOf(you, real)} won't commit on ${bill}, leadership sources say` : `${S.nameOf(you, real)} cuts a deal with leadership on ${bill}` };
  }
  if (sc.type === "debate") {
    const mod = anchor(MODS, msg.id), oppFace = { id: "opp" + sc.opp, g: /a$|e$/.test(sc.opp.split(" ")[0]) ? "F" : "M", born: 1978, p: other(you.p) };
    const boss = MEMBERS_TOP(you);
    return { setting: "debate", network: `Debate · ${sc.ch === "S" ? `U.S. Senate, ${you.st}` : you.seat}`, lower: [mod.name, "Moderator"], cast: [{ name: sc.opp, title: `${other(you.p)} challenger`, face: oppFace, stat: 12 }, { name: yourName, title: `${you.p}-${you.seat}`, face: you, you: true }, { name: mod.name, title: "Moderator", face: mod.face, mod: true }],
      intro: `Two podiums, one camera each, ninety minutes. ${sc.opp} has been waiting for this.`,
      beats: [
        { who: 2, line: `"First question. Prices are still high and people are worried. What have you done about it?"`,
          choices: [
            { label: "Run on your record", stat: "Policy", aud: { swing: 1 }, good: "Specific and confident. You name the bills.", bad: "You list bills nobody's heard of." },
            { label: "Blame Washington", stat: "Media", aud: { swing: 0.6, base: 0.6 }, good: "You run against the city you work in. It still works.", bad: "'You ARE Washington,' your opponent says. Ouch." },
            { label: "Tell a story from home", stat: "Integrity", aud: { swing: 1.2 }, good: "A real person, a real problem, a real fix. The room is quiet.", bad: "The story drags. The moderator cuts you off." },
          ] },
        { who: 0, line: `${sc.opp}: "My opponent votes with ${boss} nine times out of ten. You're not sending a fighter for this ${sc.ch === "S" ? "state" : "district"}, you're sending a rubber stamp."`,
          choices: [
            { label: "Point to your independent votes", stat: "Integrity", mod: s.loyalty < 0 ? 0.6 : -0.4, aud: { swing: 1.2, base: -0.3 }, good: "You name the times you broke ranks. It's a real list.", bad: "Your list is short and your opponent knows it." },
            { label: "Counterattack", stat: "Media", risk: true, aud: { base: 1.5, profile: 1.5 }, good: "You turn their own donors against them. The crowd reacts.", bad: "It's a swing and a miss. The fact-checkers will have fun." },
            { label: "Stay above it", stat: "Policy", aud: { swing: 0.5 }, good: "You look like the incumbent. That's the point.", bad: "You look like you didn't hear the question." },
          ] },
        { who: 2, line: `"Closing statements. You have one minute."`,
          choices: [
            { label: "Hopeful", stat: "Media", aud: { swing: 1 }, good: "It builds to the right last line.", bad: "It's fine. It's forgettable." },
            { label: "Draw the contrast", stat: "Policy", aud: { base: 1, swing: 0.4 }, good: "Clear choice, clearly laid out.", bad: "It sounds like a mailer read aloud." },
            { label: "Talk about home", stat: "Integrity", aud: { swing: 1.2 }, good: "You end on a street name everyone in the room knows.", bad: "You get the street name wrong." },
          ] },
      ],
      headline: (score) => score >= 3 ? `${S.nameOf(you, real)} dominates debate against ${sc.opp}` : score <= -3 ? `${sc.opp} lands blows on ${S.nameOf(you, real)} in debate` : `${S.nameOf(you, real)} and ${sc.opp} trade jabs in debate` };
  }
  if (sc.type === "briefing") {
    const rep1 = anchor(HOSTS, msg.id + "a"), b = s.bills.filter((x) => !x.dead && x.stage === "committee").sort((a, z) => a.floorWeek - z.floorWeek)[0], bill = b ? S.byId[b.pid].name : "the next bill";
    return { setting: "briefing", network: "The White House · Briefing Room", lower: ["The President", "Briefing Room"], cast: [{ name: rep1.name, title: "White House correspondent", face: rep1.face, stat: 13 }, { name: `President ${S.nameOf(you, real)}`, title: "The President", face: you, you: true }],
      intro: "Forty reporters, six cameras, and a podium with the seal on it.",
      beats: [
        { who: 0, line: `"Mr. President, your approval is at ${Math.round(s.presApproval)} percent. Why should Americans trust your judgment?"`,
          choices: [
            { label: "Point to the economy", stat: "Policy", aud: { swing: 1 }, good: "Growth, jobs, prices. You have the numbers ready.", bad: "The numbers aren't great, and everyone in the room knows it." },
            { label: "Attack the poll", stat: "Media", risk: true, aud: { base: 1.6, swing: -0.5 }, good: "'Fake numbers from a fake pollster.' Your base eats it up.", bad: "The pollster responds within the hour with the methodology." },
            { label: "Own the mistakes", stat: "Integrity", aud: { swing: 1.4, base: -0.6 }, good: "A rare admission. It's the most-watched clip of the week.", bad: "It reads as weakness to your own side." },
          ] },
        { who: 0, line: `"On ${bill}: will you sign it or not?"`,
          choices: [
            { label: "Keep them guessing", stat: "Negotiation", aud: { profile: 1 }, good: "Leverage preserved. Both sides keep calling.", bad: "Everyone thinks you don't know." },
            { label: "Draw a red line", stat: "Media", risk: true, aud: { base: 1.2 }, good: "Clear and strong. Your party falls in line.", bad: "You just boxed yourself in." },
            { label: "Praise the work so far", stat: "Policy", aud: { swing: 0.8 }, good: "Statesmanlike. Congress takes note.", bad: "Vague enough to anger everyone." },
          ] },
        { who: 0, line: `"One more. Is it true you've been talking about a ballroom at the White House again?"`,
          choices: [
            { label: "Go off script", stat: "Media", risk: true, aud: { base: 1.5, profile: 2, swing: -0.4 }, good: "Ten minutes, wildly entertaining. Ratings spike.", bad: "Ten minutes, wildly off topic. It's the only story tomorrow." },
            { label: "End the briefing", stat: "Integrity", aud: {}, good: "'Thank you all.' Clean exit.", bad: "Reporters shout questions at your back. It's a bad look." },
          ] },
      ],
      headline: (score) => score >= 3 ? "President commands the briefing room" : score <= -3 ? "Combative briefing leaves White House scrambling" : "President spars with press at briefing" };
  }
  if (sc.type === "oval") {
    const m = S.memberById[sc.who], b = s.bills.find((x) => x.id === sc.bill), bill = b ? S.byId[b.pid].name : "the bill";
    return { setting: "oval", network: "The Oval Office · Private", lower: [S.nameOf(m, real), `${m.p}-${m.seat}`], cast: [{ name: `${S.titleOf(m)} ${S.nameOf(m, real)}`, title: `${m.p}-${m.seat}`, face: m, stat: S.attrs(m).Negotiation, id: m.id }, { name: "The President", title: "The President", face: you, you: true }],
      intro: `${S.nameOf(m, real)} sits on the couch, looking at the Resolute Desk. They're in a tough seat, and they know why they're here.`,
      beats: [
        { who: 0, line: `"Mr. President, I want to be with you. But ${bill} polls well back home, and I have to win there."`,
          choices: [
            { label: "Promise a campaign visit", stat: "Negotiation", tag: "won", aud: {}, good: "Their eyes light up. 'You'd do that?'", bad: "'In my district? With respect, that might hurt.'" },
            { label: "Lean on them", stat: "Media", risk: true, tag: "won", aud: {}, good: "You remind them who helped them win. They fold.", bad: "They stiffen. This will leak." },
            { label: "Appeal to the party", stat: "Loyalty", tag: "won", aud: {}, good: "'We're a team.' They nod slowly.", bad: "'The party isn't on my ballot, I am.'" },
          ] },
      ],
      rel: m.id,
      headline: (score) => score > 0 ? `${S.nameOf(m, real)} leaves the Oval Office sounding like a no on ${bill}` : `${S.nameOf(m, real)} won't commit after Oval Office meeting on ${bill}` };
  }
  return null;
}
const MEMBERS_TOP = (you) => { const boss = S.MEMBERS.find((m) => m.ch === you.ch && m.p === you.p && /Leader|Speaker/.test(m.lead?.[0] || "")); return boss ? (boss.lead[0].includes("Speaker") ? "the Speaker" : "party leaders") : "party leaders"; };

export function stageScene(s, msg, real) { return build(s, msg, real); }
// Roll one choice. Your stat: blend of who you are and what you've built; prep with your communications director helps.
export function roll(s, msg, scene, beatIdx, choiceIdx) {
  const ch = scene.beats[beatIdx].choices[choiceIdx], mine = S.yourAttrs(s), base = S.attrs(S.memberById[s.youId]);
  const stat = ((mine[ch.stat] || 10) + (base[ch.stat] || 10)) / 2;
  const opp = scene.cast[0].stat || 12, comms = (s.staff || []).find((x) => x.role === "comms")?.skill || 10;
  const p = sig((stat - opp) / 4 + (msg.prep ? 0.4 + comms / 40 : 0) + (ch.mod || 0) + (ch.risk ? -0.2 : 0.35));
  const ok = hashN(`${s.seed}:${msg.id}:${beatIdx}:${choiceIdx}`) < p;
  const mag = ch.risk ? 2 : 1;
  return { ok, delta: ok ? mag : -mag, text: ok ? ch.good : ch.bad, p };
}
// Turn the played beats into effects for the engine.
export function tally(scene, picks) {
  const out = { score: 0, base: 0, swing: 0, profile: 0, rel: {}, tags: [] };
  for (const pk of picks) {
    const ch = pk.choice, f = pk.res.ok ? 1 : -0.6;
    out.score += pk.res.delta; out.base += (ch.aud.base || 0) * f; out.swing += (ch.aud.swing || 0) * f; out.profile += (ch.aud.profile || 0) * (pk.res.ok ? 1 : 0.3) + 0.3;
    if (ch.tag) out.tags.push(ch.tag);
  }
  if (scene.cast[0].id && scene.setting === "office") out.rel[scene.cast[0].id] = out.tags.includes("refuse") ? -0.15 : 0.12;
  if (scene.setting === "oval") { const okAll = picks.every((p) => p.res.ok); out.tags = okAll ? ["won"] : []; out.rel[scene.cast[0].id] = okAll ? 0.15 : -0.1; out.score = okAll ? 2 : -1; }
  out.headline = scene.headline(out.score, out.tags);
  return out;
}
