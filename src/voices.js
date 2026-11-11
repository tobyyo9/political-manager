import PERSONA from "./data/personas.json";
// Personalities and the press. Every character gets a voice, and the papers fill up with what they say.
// Everything here is invented for the game: in-character lines, not quotes. Names shown are the altered ones by default.
const hashN = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const pick = (arr, r) => arr[Math.floor(r() * arr.length) % arr.length];
const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => (k === "Bill" && v.bill ? v.bill[0].toUpperCase() + v.bill.slice(1) : v[k] ?? ""));

export const VOICES = {
  bombast: { label: "Bombastic", desc: "Superlatives, nicknames and wild tangents. Says what nobody else would, at any hour." },
  firebrand: { label: "Firebrand", desc: "Picks fights with the other side and the press. Every statement is a punch." },
  pro: { label: "Professional", desc: "Measured, prepared, on message. Rarely makes news by accident." },
  dodger: { label: "Artful dodger", desc: "Never gives a straight answer. Can talk for four minutes and commit to nothing." },
  folksy: { label: "Beer buddy", desc: "Down to earth and funny. The member you'd want at your cookout." },
  devotee: { label: "True devotee", desc: "Treats the President like a hero. Defends him on everything, loudly." },
  showboat: { label: "Show horse", desc: "Lives for the camera. Every remark is built to go viral." },
  wonk: { label: "Wonk", desc: "Speaks in charts and footnotes. Corrects your math." },
  oldguard: { label: "Old bull", desc: "Decades in the building and grumpy about how things are done now." },
  gaffe: { label: "Gaffe machine", desc: "Means well. Says the strangest things anyway." },
};
const LOUD = new Set(["bombast", "firebrand", "devotee", "showboat", "gaffe"]);

// A voice from who they are: their traits, how far out they sit, how long they've been here.
export function voiceOf(m, presParty = "R") {
  if (m.voice) return m.voice;
  // Well-known members: set by hand from their public style. Devotees only while their party holds the White House.
  const set = !m.fictional && !m.custom && PERSONA[m.id];
  if (set) return set === "devotee" && m.p !== presParty ? "firebrand" : set;
  if (m.id === "POTUS") return m.fictional ? pick(["pro", "folksy", "dodger", "bombast"], () => hashN(m.first + m.last)) : "bombast";
  const t = m.t || {}, h = hashN(m.id + ":voice"), x = Math.abs(m.x || 0), sen = (m.seniority || 0);
  let v = "pro";
  if (m.p === "R" && presParty === "R" && (t.label === "follower" || (m.x > 0.55 && t.loyalty > 0.6)) && h < 0.8) v = "devotee";
  else if (t.label === "showhorse") v = h < 0.6 ? "showboat" : "pro";
  else if (t.label === "believer" && x > 0.6) v = h < 0.6 ? "firebrand" : "pro";
  else if (t.label === "wonk") v = "wonk";
  else if (sen >= 20 && h < 0.6) v = "oldguard";
  else if (t.ego > 0.8 && t.ethics < 0.4) v = "bombast";
  else if (t.label === "dealmaker") v = h < 0.6 ? "folksy" : "pro";
  else if (t.label === "loyalist") v = h < 0.5 ? "dodger" : "pro";
  else if (t.label === "vain") v = h < 0.3 ? "showboat" : h < 0.5 ? "firebrand" : "pro";
  else if (t.label === "grudge") v = h < 0.3 ? "firebrand" : h < 0.5 ? "oldguard" : "dodger";
  else if (t.label === "follower") v = "dodger";
  else v = h < 0.3 ? "folksy" : h < 0.55 ? "dodger" : "pro";
  if (hashN(m.id + ":gaffe") < 0.035) v = "gaffe";
  // Real people not set by hand never get the two labels that read as mockery; fictional characters can.
  if (!m.fictional && !m.custom && (v === "gaffe" || v === "bombast")) v = v === "bombast" ? "firebrand" : "pro";
  return v;
}

// What they say about a bill, the President, or the press.
const LINES = {
  bombast: {
    for: ["{Bill} is a beautiful bill, maybe the best bill, people are crying when they read it.", "Nobody has seen a bill like {bill}. I've seen a lot of bills. This one is tremendous."],
    against: ["{Bill} is a disaster. A total disaster. Even the people who wrote it don't like it, they tell me privately.", "Whoever wrote {bill} should be ashamed. Low IQ bill. Very low."],
    press: ["The fake news won't report this, but I was right about everything.", "These reporters, they're the worst people. Not all of them. Most of them."],
  },
  firebrand: {
    for: ["Anyone voting against {bill} is telling working people to drop dead. Put that on the record.", "{Bill} passes or we stay here all weekend. I brought snacks."],
    against: ["{Bill} is a scam written by lobbyists and I will say that on every channel that will have me.", "I'd rather eat the paper {bill} is printed on than vote for it."],
    press: ["Write that down. Spell my name right this time.", "Your network has been lying about this for a year and you know it."],
  },
  pro: {
    for: ["I've read {bill} closely. On balance it moves us in the right direction, and I'll support it.", "{Bill} isn't perfect, but it's a serious answer to a serious problem."],
    against: ["I have real concerns about how {bill} is paid for, and I can't support it in its current form.", "We can do better than {bill}, and I've shared specific fixes with the sponsors."],
    press: ["I'll let the record speak for itself.", "That's a fair question. Here's what we know so far."],
  },
  dodger: {
    for: ["I think what's important about {bill} is that we continue to have the conversation, and I look forward to that conversation.", "I'm going to keep listening to my constituents on {bill}, and I think that's what they expect."],
    against: ["Well, there's a lot in {bill}, and there's a process, and I respect the process.", "I don't want to get ahead of where we are on {bill}. It's a fluid situation."],
    press: ["I'm not going to engage in hypotheticals.", "I haven't seen that, so I wouldn't want to comment."],
  },
  folksy: {
    for: ["Back home they don't care whose name is on {bill}. They care if it works. This one works.", "{Bill}? My uncle would say it's about as useful as a screen door on a submarine. And I'm voting yes anyway, because it beats doing nothing."],
    against: ["I read {bill} on the plane twice and I still can't explain it to my neighbors. That's a no from me.", "{Bill} is all hat and no cattle."],
    press: ["Y'all want to grab a beer after this? Off the record. Mostly.", "Ask me anything. Just not about my fantasy football team."],
  },
  devotee: {
    for: ["The President supports {bill}, and the President has never been wrong. Not once.", "If the President says {bill} is great, it's great. Simple as that."],
    against: ["The President sees {bill} for what it is. A trap. He's always three steps ahead.", "Voting for {bill} is voting against the greatest President of our lifetimes."],
    press: ["You people have been wrong about him for a decade and you're wrong now.", "History will put him on Mount Rushmore. Write that down."],
  },
  showboat: {
    for: ["I'll be wearing a T-shirt about {bill} on the floor tomorrow. Merch link in my bio.", "{Bill} is happening. I'm going live in ten minutes to explain why."],
    against: ["I printed {bill} out. It's 900 pages. I'm going to drop it on the floor of the chamber. Cameras ready?", "I'll read {bill} out loud on my stream tonight. All of it. Bring popcorn."],
    press: ["Is this going out live? Let me fix my hair.", "Tag me in that."],
  },
  wonk: {
    for: ["{Bill}'s ten-year cost is lower than the headline number once you account for the offsets on page 412.", "The distributional tables on {bill} are actually quite good. I'll send you the spreadsheet."],
    against: ["The scoring on {bill} assumes a growth rate we haven't seen since 1999.", "{Bill} has a cliff in year six that nobody is talking about. I made a chart."],
    press: ["Your graphic last night had the y-axis wrong.", "It's in the footnotes. It's always in the footnotes."],
  },
  oldguard: {
    for: ["In my day we'd have passed {bill} by voice vote before lunch.", "I've seen forty versions of {bill}. This is one of the better ones. Don't tell anybody I said that."],
    against: ["Nobody read {bill}. Nobody reads anything anymore. They read their phones.", "We used to hold hearings on bills like {bill}. Remember hearings?"],
    press: ["I was doing this before you were born, son.", "Back when we had real newspapers, I'd have had time to answer that."],
  },
  gaffe: {
    for: ["{Bill} is the most important bill since, uh, the last important bill. Which I also voted for. I think.", "I support {bill} one hundred and ten percent, which my staff says isn't a real number."],
    against: ["I'm against {bill}, or I'm for the amendment that's against it. One of those.", "I said I'd vote no on {bill}. Or did I say yes? Let me check my notes, which I left in the car."],
    press: ["Is this thing on? Oh. It's been on.", "Sorry, I thought you were from the gift shop."],
  },
};
export function line(voice, kind, vars, rnd) { const set = LINES[voice] || LINES.pro; return fill(pick(set[kind] || set.press, rnd), vars); }

// The President's outlandish riffs: the kind of thing that makes the papers every week.
const P_SUBJ = ["windmills", "sharks", "the White House ballroom", "Greenland", "Canada", "paper straws", "dishwashers", "the Moon", "electric boats", "Mount Rushmore", "golf carts", "the Super Bowl halftime show", "magnets", "the Panama Canal", "gold", "showerheads", "a military parade", "the Washington Monument", "light bulbs", "penguins"];
const P_FULL = [
  ["If a shark is next to your electric boat, I'd take the electrocution. People say I'm right about that. Many people.", "sharks"],
  ["We're going to build the most beautiful ballroom ever built. Maybe on the Moon, we'll see. NASA is very excited.", "the ballroom"],
  ["Canada would make a gorgeous 51st state. Their hockey is very good. Not great. Very good.", "Canada"],
  ["Windmills are killing the birds. The birds are very sad. I know a lot about birds, more than anybody.", "windmills"],
  ["Paper straws don't work. I tried one. It melted like the Democrats on election night.", "paper straws"],
  ["Some people say I'm the greatest President since Lincoln. Others say greater. I don't say it. Others say it.", "Lincoln"],
  ["The showerheads are a disaster. You turn it on, drip, drip, drip. I want water. Beautiful water.", "showerheads"],
  ["Greenland is a very big piece of real estate. Very cold. Tremendous potential. We're looking at it, strongly.", "Greenland"],
  ["I would like a parade. A big one. Tanks, planes, maybe some of the better generals. Not the bad ones.", "a parade"],
  ["Nobody had ever heard of tariffs until I came along. Now everyone says the word. Beautiful word.", "tariffs"],
  ["The Washington Monument would look much better in gold. Gold is a very underrated color.", "the Washington Monument"],
  ["I was told by a big, strong man, a very tough guy, tears in his eyes, 'Sir, you saved the dishwashers.'", "dishwashers"],
  ["Magnets. Nobody knows how they work. I asked a scientist. He didn't know either. Very interesting.", "magnets"],
  ["Penguins are very smart, very loyal. They'd vote for me if they could. Maybe we look at that.", "penguins"],
  ["We should rename the Gulf after America, the Moon after America. Why not? Who's going to stop us?", "the Moon"],
  ["The halftime show was terrible. Nobody watched. I watched. It was terrible.", "the halftime show"],
  ["I'm the healthiest President in history. My doctor said 'Sir, you have the heart of a much younger, very handsome man.'", "his health"],
  ["They want to take away your gas stoves. Next it'll be your grills. I will protect your grills.", "gas stoves"],
  ["I know more about the Panama Canal than the people who built it. They did a nice job, though. Nice job.", "the Panama Canal"],
  ["The light bulbs today make you look orange. That's the problem. It's the bulbs.", "light bulbs"]
];
const P_CLAIM = ["Total disaster. Maybe the worst in the history of our country.", "Should be renamed after me. A lot of people want it. I don't ask for it.", "Much better with tariffs. Big ones.", "Never this good under the previous administration. Never.", "Rigged. Totally rigged. Everybody knows it.", "Needs a lot more gold. Everything needs more gold.", "My idea. Nobody gives me credit, which is fine.", "I know more about it than the experts. The experts call me."];
const P_OPEN = ["People ask me about", "Nobody talks about", "Let's talk about", "I was the first to talk about", "Let me tell you about"];
const P_DEK = ["Aides declined to clarify.", "Asked to explain, the press secretary said the President 'speaks for himself.'", "It was the third post before 6 a.m.", "Republicans on the Hill said they had not seen it.", "Markets did not react.", "The remark came midway through an unrelated speech on trade.", "Fact-checkers have asked for comment.", "He repeated it twice at a rally that evening."];
export function presRiff(rnd) {
  const first = (t) => t.split(/(?<=[.!?])\s/)[0];
  if (rnd() < 0.6) { const [q, subject] = pick(P_FULL, rnd); return { quote: q, subject, head: first(q), dek: pick(P_DEK, rnd) }; }
  const subj = pick(P_SUBJ, rnd), claim = pick(P_CLAIM, rnd); return { quote: `${pick(P_OPEN, rnd)} ${subj}. ${claim}`, subject: subj, head: `${subj[0].toUpperCase()}${subj.slice(1)}? ${first(claim)}`, dek: pick(P_DEK, rnd) };
}
const NICK = ["Low Energy", "Crying", "Little", "Sleepy", "Crazy", "Shifty", "Liddle'", "Lyin'", "Nervous"];
export const nickname = (last, rnd) => `${pick(NICK, rnd)} ${last}`;

// Newsroom: fictional outlets and article shapes.
export const OUTLETS = ["The Capitol Ledger", "Beltway Daily", "The National Desk", "Washington Wire", "The Morning Gavel", "Main Street Gazette", "The Pundit Post", "Cable Clips", "The Hill Herald", "Roll Call Sheet"];
const FOLKSY_ACT = ["wins the pie-eating contest at the county fair", "fixes a constituent's tractor on a district tour, posts the video", "shotguns a root beer at a high school football game", "brings homemade chili to a bipartisan lunch; it's a hit", "admits to crying at a farm-bill markup", "is caught singing karaoke with a member of the other party"];
const SHOW_ACT = ["brings a cardboard cutout of the President to a hearing", "livestreams a vote from a treadmill", "drops a 900-page bill on the House floor for the cameras", "wears a costume to make a point about spending", "launches a podcast about launching a podcast"];
const DODGE_Q = ["whether it is raining", "what they had for breakfast", "whether they support the bill they wrote", "who won the last election", "what day it is"];
const GAFFE_MIX = [["Iowa", "Ohio"], ["the Senate", "the Olive Garden"], ["inflation", "inflatables"], ["the deficit", "the debt ceiling fan"], ["NATO", "NASA"], ["the filibuster", "a filet mignon"]];
const OLD_LINE = ["In my day, we read the bills.", "I miss when the cloakroom had ashtrays and compromise.", "These new members think a hearing is a TikTok.", "I've outlasted six Speakers and I'll outlast the next one."];
const WONK_TOPIC = ["the CBO score", "the inflation numbers", "the jobs report", "a chart on cable news"];
// A piece about a member, in their voice.
export function memberStory(m, v, ctx, rnd) {
  const name = ctx.name, title = ctx.title, bill = ctx.bill || "the spending bill", party = m.p === "D" ? "Democrats" : "Republicans", other = m.p === "D" ? "Republicans" : "Democrats";
  switch (v) {
    case "firebrand": return { headline: `${title} ${name} tears into ${pick(["the press", other, "party leaders", "the White House"], rnd)}`, quote: line(v, rnd() < 0.5 ? "press" : ctx.stance, { bill }, rnd) };
    case "devotee": return { headline: `${title} ${name} calls the President ${pick(["'the greatest leader since Washington'", "'a gift from heaven'", "'basically never wrong'", "'stronger than any President in history'", "'the most handsome man to hold the office'"], rnd)}`, quote: line(v, ctx.stance, { bill }, rnd) };
    case "folksy": return { headline: `${title} ${name} ${pick(FOLKSY_ACT, rnd)}`, quote: line(v, rnd() < 0.5 ? "press" : ctx.stance, { bill }, rnd) };
    case "showboat": return { headline: `${title} ${name} ${pick(SHOW_ACT, rnd)}`, quote: line(v, ctx.stance, { bill }, rnd) };
    case "dodger": return { headline: `${title} ${name} takes four minutes to not answer whether ${pick(DODGE_Q, rnd)}`, quote: line(v, ctx.stance, { bill }, rnd) };
    case "wonk": return { headline: `${title} ${name} corrects ${pick(WONK_TOPIC, rnd)}, live, with a whiteboard`, quote: line(v, ctx.stance, { bill }, rnd) };
    case "oldguard": return { headline: `${title} ${name}: "${pick(OLD_LINE, rnd)}"`, quote: line(v, ctx.stance, { bill }, rnd) };
    case "gaffe": { const [a, b] = pick(GAFFE_MIX, rnd); return { headline: `${title} ${name} confuses ${a} with ${b} in floor speech`, quote: line(v, ctx.stance, { bill }, rnd) }; }
    case "bombast": return { headline: `${title} ${name} says ${bill} is "the worst thing since the invention of Mondays"`, quote: line(v, ctx.stance, { bill }, rnd) };
    default: return { headline: `${title} ${name} lays out ${party === "Democrats" ? "a" : "a"} detailed case on ${bill}`, quote: line("pro", ctx.stance, { bill }, rnd) };
  }
}
export const isLoud = (v) => LOUD.has(v);
export const pickN = pick;

// After a vote: what they say when their side won or lost.
const REACT = {
  bombast: { win: ["Huge win. Bigger than anyone thought. Some say the biggest.", "We won so big tonight. They're devastated. Look at their faces."], lose: ["Rigged vote. Everyone saw it.", "We'll be back, stronger than ever, maybe tomorrow."] },
  firebrand: { win: ["Told you. Every single person who doubted us, I have your names.", "This is what happens when you fight."], lose: ["Shameful. Every member who caved will hear from me, by name.", "They chose donors over people tonight. Remember it."] },
  pro: { win: ["A good day's work. Now we have to make it work in the real world.", "Grateful to colleagues on both sides who got this done."], lose: ["Disappointing, but we'll keep working to find the votes.", "We came up short. The issue isn't going away."] },
  dodger: { win: ["I think the vote speaks for itself, and I'll let it.", "It's a step. In a direction. We'll see."], lose: ["It's a process. Processes have outcomes. This was one.", "I'd want to see the final tally before characterizing it."] },
  folksy: { win: ["Well, the good Lord and a few Republicans came through. Drinks are on me. Root beer.", "Can't believe it worked. Calling my mom."], lose: ["Like my granddad said: you can't win 'em all, but you can complain about all of 'em.", "Back to the drawing board. Somebody find me a bigger board."] },
  devotee: { win: ["Another win for the President. Nobody's ever won this much.", "The President called it. He always calls it."], lose: ["The President was right and the swamp was wrong. Again.", "Everyone who voted against him tonight will regret it. He doesn't forget, and neither do I."] },
  showboat: { win: ["Going live in five. Victory stream. Bring snacks.", "Just posted the clip. Already a million views. You're welcome, America."], lose: ["They can't handle my content. Link in bio.", "Livestream tonight: everything they didn't want you to see."] },
  wonk: { win: ["The final text fixed the year-six cliff. I'm thrilled. Really.", "I'll be publishing a 30-page explainer by morning."], lose: ["The whip count was off by four. I said it was off by four.", "We'll need a better score from CBO next time."] },
  oldguard: { win: ["Took longer than it should've. Everything does now.", "In my day this would've passed on a Tuesday by voice vote. Good enough."], lose: ["Nobody counts votes anymore. They count followers.", "I've seen this movie. It comes back in two years."] },
  gaffe: { win: ["What a historic day for the, uh, this bill. Historic.", "I'm thrilled we passed it. We did pass it? We passed it."], lose: ["Well, we'll get them next time, whoever they are.", "I thought we won. Someone should've told me before I did the interview."] },
};
export const react = (voice, won, rnd) => pick((REACT[voice] || REACT.pro)[won ? "win" : "lose"], rnd);
// "Raise the federal minimum wage" -> "the bill to raise the federal minimum wage"; "Ratepayer Protection Act" -> "the Ratepayer Protection Act".
const VERB = /^(Raise|Reverse|Repeal|Expand|Restore|Cut|Increase|Reduce|End|Fund|Cancel|Double|Limit|Ban|Require|Make|Cap|Lower|Extend|Create|Allow|Codify|Abolish|Sustain|Withdraw|Enforce|Index|Tax|Close|Stop|Protect|Strengthen|Build|Means-test|Add|Eliminate|Impose|Let|Give|Return|Keep|Set|Shift|Slow|Pay|Hire|Federal)\b/;
export const billRef = (name) => (VERB.test(name) && !/^Federal/.test(name) ? `the bill to ${name[0].toLowerCase()}${name.slice(1)}` : /^the /i.test(name) ? name : `the ${name}`);
