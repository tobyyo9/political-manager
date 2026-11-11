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
    const mod = anchor(MODS, msg.id), oppFace = { id: sc.oppId || "opp" + sc.opp, g: sc.oppG || (/a$|e$/.test(sc.opp.split(" ")[0]) ? "F" : "M"), born: 1972, p: other(you.p) };
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
  if (sc.type === "sotu") {
    const spk = S.MEMBERS.find((m) => /^Speaker/.test(m.lead?.[0] || "")), opp = other(P);
    return { setting: "chamber", network: `State of the Union · ${sc.year}`, lower: [`President ${S.nameOf(you, real)}`, "Joint session of Congress"], cast: [{ name: spk ? `Speaker ${S.nameOf(spk, real)}` : "The Speaker", title: spk ? `${spk.p}-${spk.seat}` : "Speaker", face: spk || { id: "spk", g: "M", born: 1970, p: opp }, stat: 13, id: spk?.id }, { name: `President ${S.nameOf(you, real)}`, title: "The President", face: you, you: true }],
      intro: `"Madam Speaker, Mr. Vice President, members of Congress..." Half the chamber stands. The other half stays seated with arms folded.`,
      beats: [
        { who: 1, line: "Forty million people are watching. How do you open?",
          choices: [
            { label: "The state of our union is strong", stat: "Policy", aud: { swing: 1 }, good: "A clean opening, and a list of numbers that mostly hold up.", bad: "The fact-checkers are already typing." },
            { label: "Call for unity", stat: "Integrity", aud: { swing: 1.3, base: -0.4 }, good: "Even some across the aisle applaud. The pundits call it presidential.", bad: "Nobody across the aisle moves. It looks naive." },
            { label: "Go after the other party", stat: "Media", risk: true, aud: { base: 1.8, swing: -0.6, profile: 1 }, good: `Your side roars. ${partyName(opp)} sit stone-faced, which is the shot everyone shares.`, bad: "Someone shouts back from the floor. The heckle becomes the story." },
          ] },
        { who: 1, line: "Now the ask: what do you want from this Congress this year?",
          choices: [
            { label: "One bipartisan deal, by name", stat: "Negotiation", aud: { swing: 1, profile: 0.5 }, good: "Members from both parties stand. Leadership will have to schedule it.", bad: "Half-hearted applause. Nobody believes it's coming." },
            { label: "Demand your agenda", stat: "Loyalty", aud: { base: 1.4 }, good: "Your party leaps up on every line.", bad: "It reads as a list of things that won't pass." },
            { label: "Dare them to stop you", stat: "Media", risk: true, aud: { base: 1.6, profile: 1.5, swing: -0.3 }, good: "'Send me the bill or get out of the way.' It lands.", bad: "It sounds like a threat. Moderates in your party wince." },
          ] },
        { who: 1, line: "The gallery. Your guest is waiting for the camera.",
          choices: [
            { label: "Tell their story, quietly", stat: "Integrity", aud: { swing: 1.2 }, good: "The chamber goes silent, then stands. It's the moment of the night.", bad: "It runs long, and the camera cuts away early." },
            { label: "Go off script", stat: "Media", risk: true, aud: { base: 1.2, profile: 2, swing: -0.2 }, good: "Twenty unplanned minutes, and they're the best of the speech.", bad: "Twenty unplanned minutes. The networks cut to commentary." },
          ] },
      ],
      headline: (score) => score >= 3 ? "A State of the Union that moves the numbers" : score <= -3 ? "State of the Union falls flat; heckles steal the night" : "President delivers a combative State of the Union" };
  }
  if (sc.type === "confirm") {
    const mine = you.p === sc.by, nom = { id: "nom" + sc.nom, g: /a$|i$|e$/.test(sc.nom.split(" ")[0]) ? "F" : "M", born: 1976, p: sc.by };
    return { setting: "hearing", network: "Senate Judiciary Committee · Live", lower: [sc.nom, "Supreme Court nominee"], cast: [{ name: `Judge ${sc.nom}`, title: "Nominee", face: nom, stat: 14 - Math.round(sc.cont * 4) }, { name: yourName, title: `${you.p}-${you.st}`, face: you, you: true }],
      intro: `The nominee sits alone at the witness table, family behind. You have ten minutes.`,
      beats: mine ? [
        { who: 0, line: `"Senator, I'm grateful for the chance to answer the committee's questions."`,
          choices: [
            { label: "Walk through the record", stat: "Policy", aud: { base: 0.6, swing: 0.6 }, good: "A careful tour of their best opinions. It looks bulletproof.", bad: "You land on an opinion that's harder to defend than you thought." },
            { label: "Let them tell their story", stat: "Integrity", aud: { swing: 1 }, good: "Humble roots, hard work. Even critics soften.", bad: "It feels rehearsed." },
            { label: "Attack the other side's tactics", stat: "Media", risk: true, aud: { base: 1.6, profile: 1.5, swing: -0.4 }, good: "You call out the smears. Your base loves it.", bad: "It turns the hearing into a food fight." },
          ] },
        { who: 0, line: `"I can't comment on cases that may come before the Court."`,
          choices: [
            { label: "Defend their silence", stat: "Policy", aud: { base: 0.6 }, good: "The Ginsburg rule, explained well.", bad: "It sounds like you're hiding something too." },
            { label: "Ask an easy one on precedent", stat: "Negotiation", aud: { swing: 0.8 }, good: "A safe, warm answer about respecting precedent. Moderates relax.", bad: "Their answer is so careful it worries everyone." },
          ] },
      ] : [
        { who: 0, line: `"Senator, I'm grateful for the chance to answer the committee's questions."`,
          choices: [
            { label: "Read their most extreme opinion back", stat: "Policy", aud: { base: 1, swing: 0.6 }, good: "They squirm, then try to explain. The clip runs everywhere.", bad: "They explain it calmly. You come off as the aggressor." },
            { label: "Ask about the President", stat: "Media", risk: true, aud: { base: 1.6, profile: 2 }, good: "'Would you recuse in a case involving the man who nominated you?' They hesitate a beat too long.", bad: "They answer smoothly. Your moment fizzles." },
            { label: "Ask a fair, hard question", stat: "Integrity", aud: { swing: 1.2 }, good: "Respectful and pointed. Moderates take note of the answer.", bad: "It's so fair that it's forgettable." },
          ] },
        { who: 0, line: `"I can't comment on cases that may come before the Court."`,
          choices: [
            { label: "Press them on precedent", stat: "Policy", aud: { swing: 0.8, base: 0.4 }, good: "You pin down an answer that will follow them.", bad: "They give nothing away." },
            { label: "Make it about the stakes", stat: "Media", risk: true, aud: { base: 1.4, profile: 1 }, good: "You speak past the nominee to the cameras. It works.", bad: "It's a speech, not a question. The chair cuts you off." },
          ] },
      ],
      headline: (score) => mine ? (score >= 2 ? "Senator gives the nominee a strong showing" : score <= -2 ? "Friendly questioning backfires on the nominee" : "Senator defends the nominee at hearing") : (score >= 2 ? "Senator lands blows on the Supreme Court nominee" : score <= -2 ? "Senator's grilling of the nominee falls flat" : "Senator presses the nominee at hearing") };
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

// Variety for long careers: alternative middle beats (and openers) rotate in, so the same scene type
// rarely plays the same way twice. n = how many of this scene type you've had before.
const C = (label, stat, aud, good, bad, risk) => ({ label, stat, aud, good, bad, ...(risk ? { risk: true } : {}) });
const EXTRA = {
  tv: [
    (x) => ({ who: 0, line: `"Your opponents back home are already cutting an ad out of this vote. What do you say to the people who'll see it?"`, choices: [
      C("Look into the camera and explain", "Integrity", { swing: 1.2 }, "Plain words, straight to camera. It's the clip your district director wanted.", "You look at the wrong camera for the first ten seconds."),
      C("Dare them to run it", "Media", { base: 1.4, profile: 1.5, swing: -0.3 }, "'Run it. I'll pay for the airtime.' The host laughs.", "Bravado on cable reads as arrogance back home.", true),
      C("Talk about what's in the bill", "Policy", { swing: 0.8 }, "Section by section, without notes. Impressive.", "Too much detail. Viewers drift.") ] }),
    (x) => ({ who: 0, line: `"Some of your own colleagues say privately that you're grandstanding. Are you?"`, choices: [
      C("Name the colleagues' real gripe", "Negotiation", { swing: 0.6, base: 0.4 }, "You make it about policy, not personalities. Smart.", "You end up arguing with people who aren't in the room."),
      C("Laugh it off", "Media", { profile: 1.5, swing: 0.3 }, "Easy, warm, unbothered. It plays.", "The laugh goes on a beat too long.", true),
      C("Say they should say it to your face", "Media", { base: 1.6, profile: 2, swing: -0.5 }, "A line every cable producer replays.", "Now it's a feud story, and you started it.", true) ] }),
    (x) => ({ who: 0, line: `"Let me read you a post from a constituent: 'I voted for you and I feel betrayed.' Your response?"`, choices: [
      C("Thank them and explain", "Integrity", { swing: 1.2, base: -0.2 }, "Respectful, specific, human. The host softens.", "It sounds like a form letter."),
      C("Point to what you delivered at home", "Policy", { swing: 0.9 }, "You have a list of local wins ready.", "The list is thin, and the host notices."),
      C("Say you can't please everyone", "Media", { base: 0.8 }, "Honest enough. It moves on.", "It sounds dismissive of a real person.") ] }),
    (x) => ({ who: 0, line: `"Is there anything about this vote you'd do differently?"`, choices: [
      C("No, and here's why", "Policy", { base: 0.8, swing: 0.4 }, "Firm, reasoned, done.", "Firm, and a little defensive."),
      C("Admit one thing", "Integrity", { swing: 1.2, base: -0.3 }, "A rare moment of candor on cable. It stands out.", "The chyron reads 'Has regrets.'"),
      C("Turn it back on the host", "Media", { base: 1, profile: 1 }, "'Would you have done better?' It lands, barely.", "It's rude, and the host gets the last word.", true) ] }),
  ],
  briefing: [
    (x) => ({ who: 0, line: `"Mr. President, ${x.s.econ.inflation > 3.2 ? `prices are still up ${x.s.econ.inflation.toFixed(1)} percent` : `growth is at ${x.s.econ.growth.toFixed(1)} percent`}. Is your economic plan working?"`, choices: [
      C("Yes, and here's the proof", "Policy", { swing: 1 }, "You have three numbers and a chart. It holds up.", "One of your numbers is from last year."),
      C("Blame the last Congress", "Media", { base: 1.4, swing: -0.4 }, "A clean pivot. Your side cheers.", "Reporters point out you signed those bills.", true),
      C("It's not working fast enough", "Integrity", { swing: 1.3, base: -0.5 }, "Candor from the podium. It leads the evening news.", "Your own party winces.") ] }),
    (x) => ({ who: 0, line: `"Will you rule out a government shutdown?"`, choices: [
      C("Rule it out", "Negotiation", { swing: 1 }, "Calm and firm. Markets like it.", "You just gave away your leverage."),
      C("Nothing's off the table", "Media", { base: 1.3 }, "Your base hears strength.", "Federal workers hear a threat.", true),
      C("That's up to Congress", "Policy", { swing: 0.4 }, "Technically true.", "Technically true and obviously evasive.") ] }),
    (x) => ({ who: 0, line: `"Did you know about the report before it was published?"`, choices: [
      C("No, and I want answers", "Integrity", { swing: 1 }, "It sounds sincere.", "Nobody believes it."),
      C("Attack the reporter's outlet", "Media", { base: 1.5, profile: 1, swing: -0.6 }, "A two-minute riff. The base loves it.", "The outlet's subscriptions spike. Thanks to you.", true),
      C("Refer it to counsel", "Policy", { swing: 0.3 }, "Lawyerly. It stops the follow-ups.", "Lawyerly. It invites ten more.") ] }),
  ],
  hearingA: [
    (x) => ({ who: 0, line: `"I've already answered that question in my written testimony."`, choices: [
      C("Read the written answer back", "Policy", { swing: 0.6, base: 0.8 }, "It doesn't answer the question, and now everyone sees that.", "It actually does answer it. Awkward."),
      C("Ask it again, slower", "Media", { base: 1.4, profile: 1.5 }, "The pause before their answer is the clip.", "They answer it again, slower. Now you look petty.", true),
      C("Ask for the documents instead", "Negotiation", { swing: 0.4, base: 0.4 }, "A records request on the spot. Staff love you.", "It's a reasonable ask nobody will remember.") ] }),
    (x) => ({ who: 0, line: `"With respect, ${x.you.ch === "S" ? "Senator" : x.you.g === "F" ? "Congresswoman" : "Congressman"}, you've never run anything this large."`, choices: [
      C("No, but I read the inspector general's report", "Policy", { swing: 0.8, base: 0.8 }, "Then you quote page 14. Silence.", "You quote the wrong page."),
      C("That's not an answer", "Media", { base: 1.5, profile: 2 }, "It's exactly the line people will share.", "It sounds rehearsed because it was.", true),
      C("Fair. Then help me understand", "Integrity", { swing: 1 }, "Disarming. They relax and say too much.", "They take the opening and run out your clock.") ] }),
  ],
  debate: [
    (x) => ({ who: 2, line: `"Would you support your party's leader for another term?"`, choices: [
      C("Yes, without hesitation", "Loyalty", { base: 1, swing: -0.5 }, "Clear. Your party's voters like it.", "Your opponent says 'There it is.'"),
      C("I'll decide after the election", "Negotiation", { swing: 1 }, "Independent-minded. Swing voters notice.", "It sounds like a dodge, because it is."),
      C("I answer to this district", "Integrity", { swing: 1.2, base: -0.2 }, "Applause from the room. The moderator moves on.", "Applause from your opponent's side too, sarcastically.") ] }),
    (x) => ({ who: 2, line: `"Name one thing your opponent has done that you admire."`, choices: [
      C("Name something real", "Integrity", { swing: 1.4 }, "Gracious and specific. The best moment of the night.", "You struggle for a beat too long."),
      C("Joke your way through it", "Media", { swing: 0.6, profile: 1 }, "The room laughs, including your opponent.", "The joke lands as a dig.", true),
      C("Pivot to a contrast", "Policy", { base: 0.8 }, "Polite, then pointed.", "The moderator says 'That wasn't the question.'") ] }),
    (x) => ({ who: 0, line: `${x.sc.opp}: "You've taken more from special interests than anyone in this race."`, choices: [
      C(x.s.pledge ? "I took the no-corporate-PAC pledge" : "Every dollar is disclosed", "Integrity", { swing: x.s.pledge ? 1.4 : 0.6 }, x.s.pledge ? "Your opponent didn't know. It shows." : "Transparent, if not exciting.", "The numbers on the screen don't help you."),
      C("Turn it on their donors", "Media", { base: 1.4, profile: 1.2 }, "You name their biggest donor. They freeze.", "You get the donor's name wrong.", true),
      C("Talk about your small donors", "Policy", { swing: 0.8 }, "Thousands of people at twenty dollars each. Good line.", "They point out it's a fraction of your total.") ] }),
  ],
};
const EXTRA_KEY = (sc) => sc.type === "hearing" ? (sc.mine ? "hearingA" : null) : sc.type;
export function stageScene(s, msg, real) {
  const scene = build(s, msg, real), key = EXTRA_KEY(msg.scene), pool = key && EXTRA[key];
  if (!pool || !scene || scene.beats.length < 3) return scene;
  const n = msg.scene.n || 0, you = S.memberById[s.youId], x = { s, you, real, sc: msg.scene };
  const mids = [scene.beats[1], ...pool.map((f) => f(x))];
  scene.beats = [scene.beats[0], mids[n % mids.length], ...scene.beats.slice(2)];
  // Every other time, a second fresh beat replaces the opener too (briefings and hearings, whose openers are generic).
  if ((key === "briefing" || key === "hearingA") && n % 2 === 1) scene.beats[0] = mids[(n + 2) % mids.length] === scene.beats[1] ? scene.beats[0] : mids[(n + 2) % mids.length];
  return scene;
}
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
