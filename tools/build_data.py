"""Build the game's member file from public sources.

Sources (all public):
- unitedstates/congress-legislators: members, terms, committees, leadership
- Voteview (Lewis et al.): DW-NOMINATE ideology scores for the 119th Congress
- 2024 presidential vote by congressional district (compiled by J. Cervas)

The 120th Congress roster is not published yet, so this script starts from the
outgoing Congress and applies the 2026 result: named Senate winners, placeholder
newcomers for open seats, and the most Democratic-leaning Republican House seats
flipped until the House matches the projected 259-176 split.
"""
import csv, hashlib, json, random, re, yaml, os
R = os.path.join(os.path.dirname(__file__), "raw")
STATES = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split()
HOUSE_D_TARGET = 259

leg = yaml.safe_load(open(f"{R}/legislators-current.yaml"))
nom = {r["bioguide_id"]: r for r in csv.DictReader(open(f"{R}/HS119_members.csv"))}
cds = {r["district"]: float(r["dem_share"]) for r in csv.DictReader(open(f"{R}/pres_by_cd_2024.csv"))}
cm = yaml.safe_load(open(f"{R}/committee-membership-current.yaml"))
comms = {c["thomas_id"]: c for c in yaml.safe_load(open(f"{R}/committees-current.yaml"))}

# 2024 two-party Democratic share by state (certified margins, from Fix the Deficit's states file).
STATE_MARGIN = {"AK":13.1,"ME":-7.1,"WI":0.9,"VT":-31.5,"NH":-2.8,"WA":-18.2,"ID":36.5,"MT":20.0,"ND":36.5,"MN":-4.2,"IL":-10.9,"MI":1.4,"NY":-12.6,"MA":-25.2,"OR":-14.3,"NV":3.1,"WY":45.8,"SD":29.2,"IA":13.2,"IN":19.0,"OH":11.2,"PA":1.7,"NJ":-5.9,"CT":-14.5,"RI":-13.8,"CA":-20.2,"UT":21.6,"CO":-11.0,"NE":20.5,"MO":18.4,"KY":30.5,"WV":41.9,"VA":-5.8,"MD":-28.5,"DE":-14.7,"AZ":5.5,"NM":-6.0,"KS":16.1,"AR":30.6,"TN":29.7,"NC":3.2,"SC":17.8,"OK":34.3,"LA":22.0,"MS":22.9,"AL":30.5,"GA":2.2,"HI":-23.1,"TX":13.7,"FL":13.1}
state_dem = {s: 50 - m / 2 for s, m in STATE_MARGIN.items()}

VOW = "aeiou"
def onset(w):
    m = re.match(r"[^aeiouAEIOU]*", w)
    return m.group(0)
def cap(w):
    return w[:1].upper() + w[1:].lower() if w else w
def swap(first, last):
    """Swap the opening sounds: Hakeem Jeffries -> Jakeem Heffries, Chuck Schumer -> Schuck Chumer."""
    f, l = first.split()[0], last
    of, ol = onset(f), onset(l)
    if of.lower() == ol.lower():
        # same opening: swap the first vowel sounds instead
        mf, ml = re.search(r"[aeiouAEIOU]+", f), re.search(r"[aeiouAEIOU]+", l)
        if not mf or not ml or mf.group(0).lower() == ml.group(0).lower():
            return f, l[::-1].capitalize() if len(l) > 3 else l + "son"
        nf = f[:mf.start()] + ml.group(0).lower() + f[mf.end():]
        nl = l[:ml.start()] + mf.group(0).lower() + l[ml.end():]
        fx = lambda w: " ".join("-".join(cap(p) for p in part.split("-")) for part in w.split(" "))
        return fx(nf), fx(nl)
    fix = lambda w: " ".join("-".join(cap(p) for p in part.split("-")) for part in w.split(" "))
    if not of and not ol:
        return fix(l[0] + f[1:]), fix(f[0] + l[1:])
    nf, nl = ol + f[len(of):], of + l[len(ol):]
    return fix(nf), fix(nl)

def h(key, salt):
    return int(hashlib.sha256(f"{key}:{salt}".encode()).hexdigest()[:8], 16) / 0xFFFFFFFF
TRAITS = ["dealmaker", "believer", "grudge", "vain", "loyalist", "follower", "wonk", "showhorse"]
def traits(key, party, dim1):
    t = {k: round(0.15 + 0.7 * h(key, k), 2) for k in ["ambition", "loyalty", "ego", "ethics", "deal"]}
    # the most ideological members are less open to deals; the President's party has more followers
    t["deal"] = round(max(0.05, min(0.95, t["deal"] - 0.35 * (abs(dim1) - 0.4))), 2)
    pool = TRAITS if party == "R" else [x for x in TRAITS if x != "follower"]
    if abs(dim1) > 0.6 and h(key, "bel") < 0.6: label = "believer"
    elif t["deal"] > 0.7: label = "dealmaker"
    elif t["ego"] > 0.75: label = "vain"
    elif t["loyalty"] > 0.75: label = "loyalist"
    else: label = pool[int(h(key, "label") * len(pool)) % len(pool)]
    t["label"] = label
    return t

FIRST = "Maya Daniel Priya Marcus Elena Jordan Aisha Tyler Sofia Caleb Naomi Andre Leah Mateo Hannah Darius Claire Omar Grace Wes Ines Malik Tessa Rafael Joy Colin Amara Dev Paige Luis Renee Kofi Brooke Tomas Nadia Reid Carmen Isaac Lena Xavier".split()
LAST = "Whitfield Navarro Okoye Brandt Castellano Pruitt Mbeki Halloran Vasquez Lindqvist Tran Abernathy Rosales Keating Dlamini Mercer Fontaine Osei Kowalczyk Barros Thackeray Nakamura Delacroix Hollis Ferreira Stanhope Ibarra Calloway Petrov Adeyemi Winslow Zamora Beckett Oyelaran Marchetti Sandoval Hargreaves Bui Lockhart Esparza".split()
def newcomer_name(key):
    return FIRST[int(h(key, "fn") * len(FIRST)) % len(FIRST)], LAST[int(h(key, "ln") * len(LAST)) % len(LAST)]

def comm_list(bio, chamber):
    out = []
    for cid, members in cm.items():
        if len(cid) != 4 or cid not in comms: continue
        if comms[cid]["type"] != chamber: continue
        for m in members:
            if m.get("bioguide") == bio:
                nm = comms[cid]["name"].replace("House Committee on ", "").replace("Senate Committee on ", "").replace("Committee on ", "")
                out.append({"c": cid, "n": nm, "rank": m.get("rank", 99), "title": m.get("title", ""), "side": m.get("party")})
    return sorted(out, key=lambda x: x["rank"])[:5]

def first_year(l, typ):
    ts = [t for t in l["terms"] if t["type"] == typ]
    return int(ts[0]["start"][:4]) if ts else 2025

members = []
# ── House ──
seats = {}
for l in leg:
    t = l["terms"][-1]
    if t["type"] != "rep" or t["state"] not in STATES: continue
    seats[(t["state"], int(t.get("district", 0)))] = l
all_cd = sorted(cds.keys())
house = []
for code in all_cd:
    st, d = code.split("-"); d = int(d)
    key = (st, d if (st, d) in seats else (0 if (st, 0) in seats else d))
    l = seats.get(key) or seats.get((st, d or 1))
    dem = cds[code]
    rec = {"ch": "H", "st": st, "d": d, "dem": round(dem, 1)}
    if l:
        t = l["terms"][-1]; bio = l["id"]["bioguide"]; n = nom.get(bio, {})
        party = "D" if t["party"].startswith("D") or (t["party"] == "Independent") else "R"
        dim1 = float(n.get("nominate_dim1") or (-0.35 if party == "D" else 0.45))
        rec.update({"id": bio, "first": l["name"].get("nickname") or l["name"]["first"], "last": l["name"]["last"], "p": party, "x": round(dim1, 3),
                    "y": round(float(n.get("nominate_dim2") or 0), 3), "born": int(float(n["born"])) if n.get("born") else None,
                    "since": first_year(l, "rep"), "comm": comm_list(bio, "house"),
                    "lead": [r["title"] for r in l.get("leadership_roles", []) if not r.get("end") or r["end"] > "2026-06"]})
    else:
        party = "D" if dem >= 50 else "R"
        rec.update({"id": f"V{st}{d}", "p": party, "x": -0.3 if party == "D" else 0.45, "y": 0, "since": 2027, "comm": [], "lead": [], "gen": True})
    house.append(rec)
# Missing districts (states the district file skipped): add from the roster with the state lean.
have = {(m["st"], m["d"]) for m in house}
for (st, d), l in seats.items():
    if (st, d) in have: continue
    t = l["terms"][-1]; bio = l["id"]["bioguide"]; n = nom.get(bio, {})
    party = "D" if t["party"].startswith("D") else "R"
    dim1 = float(n.get("nominate_dim1") or (-0.35 if party == "D" else 0.45))
    house.append({"ch": "H", "st": st, "d": d, "dem": round(state_dem[st], 1), "id": bio, "first": l["name"].get("nickname") or l["name"]["first"], "last": l["name"]["last"], "p": party,
                  "x": round(dim1, 3), "y": round(float(n.get("nominate_dim2") or 0), 3), "born": int(float(n["born"])) if n.get("born") else None,
                  "since": first_year(l, "rep"), "comm": comm_list(bio, "house"), "lead": [r["title"] for r in l.get("leadership_roles", []) if not r.get("end") or r["end"] > "2026-06"]})

# Members known to be leaving whose successors this file does not know: placeholder newcomers, same party.
for m in house:
    if m.get("last") == "Massie":
        key = f"H{m['st']}{m['d']}"; fn, ln = newcomer_name(key)
        m.update({"id": "N" + key, "first": fn, "last": ln, "x": 0.5, "born": 1975, "since": 2027, "comm": [], "lead": [], "gen": True})

# The 2026 wave: flip the Republican seats that lean most Democratic until the House is 259 D.
nD = sum(1 for m in house if m["p"] == "D")
flips = sorted([m for m in house if m["p"] == "R"], key=lambda m: -m["dem"])[:max(0, HOUSE_D_TARGET - nD)]
for m in flips:
    key = f"H{m['st']}{m['d']}"
    fn, ln = newcomer_name(key)
    m.update({"id": "N" + key, "first": fn, "last": ln, "p": "D", "x": round(-0.12 - 0.22 * h(key, "x"), 3), "y": round(0.3 * h(key, "y") - 0.1, 3),
              "born": 1968 + int(h(key, "b") * 24), "since": 2027, "comm": [], "lead": [], "gen": True, "flip": True})
for m in house:
    if m.get("gen") and "first" not in m:
        fn, ln = newcomer_name(m["id"]); m.update({"first": fn, "last": ln, "born": 1970})

# ── Senate ──
senate = []
for l in leg:
    t = l["terms"][-1]
    if t["type"] != "sen": continue
    bio = l["id"]["bioguide"]; n = nom.get(bio, {})
    party = "R" if t["party"] == "Republican" else "D"
    senate.append({"ch": "S", "st": t["state"], "cls": t["class"], "dem": round(state_dem[t["state"]], 1), "id": bio,
                   "first": l["name"].get("nickname") or l["name"]["first"], "last": l["name"]["last"], "p": party,
                   "x": round(float(n.get("nominate_dim1") or (-0.35 if party == "D" else 0.45)), 3), "y": round(float(n.get("nominate_dim2") or 0), 3),
                   "born": int(float(n["born"])) if n.get("born") else None, "since": first_year(l, "sen"), "comm": comm_list(bio, "senate"),
                   "lead": [r["title"] for r in l.get("leadership_roles", []) if not r.get("end") or r["end"] > "2026-06"], "ind": t["party"] == "Independent"})
# Winners of the 2026 Senate races (AP calls; Alaska and Mississippi were uncalled with these Democrats leading).
WON = [("TX", "Cornyn", "James", "Talarico", -0.30, 1989), ("KS", "Marshall", "Adam", "Hamilton", -0.20, 1975), ("SC", "Graham", "Annie", "Andrews", -0.30, 1980),
       ("OH", "Husted", "Sherrod", "Brown", -0.43, 1952), ("ME", "Collins", "Troy", "Jackson", -0.35, 1968), ("NC", "Tillis", "Roy", "Cooper", -0.22, 1957),
       ("IA", "Ernst", "Josh", "Turek", -0.25, 1979), ("MI", "Peters", "Abdul", "El-Sayed", -0.55, 1984), ("AK", "Sullivan", "Mary", "Peltola", -0.15, 1973),
       ("MS", "Hyde-Smith", "Scott", "Colom", -0.25, 1982)]
for st, old, fn, ln, x, born in WON:
    s = next((m for m in senate if m["st"] == st and m["last"].startswith(old)), None)
    if not s:
        print("seat not found by name, using the state's Republican seat:", st, old, [m["last"] for m in senate if m["st"] == st])
        s = next((m for m in senate if m["st"] == st and m["p"] == "R"), None) or next(m for m in senate if m["st"] == st)
    s.update({"id": f"W{st}{ln[:3].upper()}", "first": fn, "last": ln, "p": "D", "x": x, "y": 0.1, "born": born, "since": 2027, "comm": [], "lead": [], "new": True, "est": True, "ind": False})
# Retiring senators whose successors this file does not know: placeholder newcomers of the same party.
for st, old in [("KY", "McConnell"), ("IL", "Durbin"), ("NH", "Shaheen"), ("MN", "Smith"), ("AL", "Tuberville")]:
    s = next((m for m in senate if m["st"] == st and m["last"].startswith(old)), None)
    if not s: continue
    key = f"S{st}{old}"; fn, ln = newcomer_name(key)
    s.update({"id": "N" + key, "first": fn, "last": ln, "x": round(s["x"] * 0.8, 3), "born": 1965 + int(h(key, "b") * 20), "since": 2027, "comm": [], "lead": [], "gen": True})

# Control flipped in both chambers: majority and minority titles trade places, and so do chairs and ranking members.
def flip_title(t):
    return t.replace("Majority", "\0").replace("Minority", "Majority").replace("\0", "Minority")
for m in house + senate:
    m["lead"] = [flip_title(t) for t in m.get("lead", [])]
    for c in m.get("comm", []):
        if c["title"] in ("Chairman", "Chair", "Chairwoman"): c["title"] = "Ranking Member"
        elif c["title"] == "Ranking Member": c["title"] = "Chair"
        c.pop("side", None)
    if m.get("last") == "Jeffries" and m["ch"] == "H": m["lead"] = ["Speaker of the House (expected)"]
    if m.get("last") == "Johnson" and m.get("first") == "Mike" and m["ch"] == "H": m["lead"] = ["Former Speaker"]
    if m.get("last") == "Scalise": m["lead"] = ["House Republican Leader (contested)"]
    m["lead"] = m["lead"][:1]

out = []
for m in house + senate:
    key = m["id"]
    m["t"] = traits(key, m["p"], m["x"])
    if m.get("gen"):
        m["sf"], m["sl"] = m["first"], m["last"]   # invented people keep their names
    else:
        m["sf"], m["sl"] = swap(m["first"], m["last"])
    out.append(m)
json.dump(out, open(os.path.join(os.path.dirname(__file__), "..", "src", "data", "members.json"), "w"), separators=(",", ":"))
import collections
print("house", collections.Counter(m["p"] for m in house), len(house), "flips", len(flips))
print("senate", collections.Counter(m["p"] for m in senate), len(senate))
for n in ["Jeffries", "Schumer", "Ocasio-Cortez", "Johnson", "Thune", "Schiff", "Talarico", "Massie", "Greene"]:
    for m in out:
        if m["last"] == n: print(m["first"], m["last"], "->", m["sf"], m["sl"], m["p"], m["x"], m["t"]["label"], [c["n"] for c in m["comm"]][:2], m["lead"]); break
print(os.path.getsize(os.path.join(os.path.dirname(__file__), "..", "src", "data", "members.json")))
