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

# ── The 2026 result, seat by seat ──
# Winners from AP/network calls and projections reported Nov 4-10, 2026 (CBS News flips list, Nov 6;
# NBC, KTVU, WGCU/WLRN, KUT, Press Herald/Maine Morning Star, California SOS). The game keeps the
# 2024 district numbers; where a state redrew its map, winners sit in the matching old seat and
# incumbents who moved districts move with them. "lead" = still uncalled, shown with the leader.
# new: (first, last, party, ideology estimate, born or None, note)
RESULTS = {
  # Democratic flips
  ("AZ",1): ("Amish","Shah","D",-0.28,1979,""), ("AZ",6): ("JoAnna","Mendoza","D",-0.2,None,""),
  ("CA",1): ("Mike","McGuire","D",-0.3,1979,""), ("CA",6): ("Richard","Pan","D",-0.35,1966,""),
  ("CA",22): ("Randy","Villegas","D",-0.4,None,""), ("CA",48): ("Marni","von Wilpert","D",-0.3,None,""),
  ("CA",38): ("Hilda","Solis","D",-0.45,1957,""),
  ("CO",5): ("Jessica","Killin","D",-0.22,None,""), ("CO",8): ("Manny","Rutinel","D",-0.3,None,""),
  ("IA",1): ("Christina","Bohannan","D",-0.22,None,""), ("IA",2): ("Lindsay","James","D",-0.22,None,""), ("IA",3): ("Sarah","Trone Garriott","D",-0.25,None,""),
  ("IN",5): ("J.D.","Ford","D",-0.25,None,""), ("KY",6): ("Zach","Dembo","D",-0.2,None,""),
  ("MI",4): ("Sean","McCann","D",-0.25,None,""), ("MI",7): ("William","Lawrence","D",-0.22,None,""), ("MI",10): ("Christina","Hines","D",-0.22,None,""),
  ("MO",2): ("Fred","Wellman","D",-0.18,None,""), ("MT",1): ("Sam","Forstag","D",-0.25,None,""),
  ("NC",6): ("Cyril","Jefferson","D",-0.3,None,""), ("NC",9): ("Richard","Ojeda","D",-0.15,1970,""), ("NC",11): ("Jamie","Ager","D",-0.2,None,""),
  ("NC",13): ("Paul","Barringer","D",-0.2,None,""), ("NC",14): ("Lakesha","Womack","D",-0.3,None,""),
  ("NE",2): ("Denise","Powell","D",-0.22,None,""), ("NJ",2): ("Zack","Mullock","D",-0.2,None,""), ("NJ",7): ("Rebecca","Bennett","D",-0.2,None,""),
  ("NV",2): ("Teresa","Benitez-Thompson","D",-0.25,None,""), ("NY",17): ("Cait","Conley","D",-0.2,None,""),
  ("OH",7): ("Brian","Poindexter","D",-0.2,None,""), ("OH",10): ("Kristina","Knickerbocker","D",-0.2,None,""), ("OH",15): ("Don","Leonard","D",-0.2,None,""),
  ("PA",1): ("Bob","Harvie","D",-0.2,None,""), ("PA",7): ("Bob","Brooks","D",-0.3,None,""), ("PA",8): ("Paige","Cognetti","D",-0.25,1981,""), ("PA",10): ("Janelle","Stelson","D",-0.22,None,""),
  ("SC",1): ("Nancy","Lacore","D",-0.2,None,""), ("TX",15): ("Bobby","Pulido","D",-0.12,None,""), ("TX",23): ("Katy","Padilla Stout","D",-0.18,None,""),
  ("UT",1): ("Ben","McAdams","D",-0.1,1974,""), ("VA",1): ("Shannon","Taylor","D",-0.2,None,""), ("VA",2): ("Elaine","Luria","D",-0.2,1975,""),
  ("WI",1): ("Mitchell","Berman","D",-0.22,None,""), ("WI",3): ("Rebecca","Cooke","D",-0.22,None,""),
  ("MN",1): ("Jake","Johnson","D",-0.2,None,"lead"),
  # Republican flips
  ("TX",32): ("Jace","Yarbrough","R",0.6,None,""), ("TN",9): ("Brent","Taylor","R",0.5,None,""), ("ME",2): ("Paul","LePage","R",0.6,1948,"lead"),
  # Open seats, same party
  ("CA",11): ("Scott","Wiener","D",-0.48,1970,""), ("TX",30): ("Frederick","Haynes","D",-0.5,1960,""), ("TX",33): ("Colin","Allred","D",-0.25,1983,""),
  ("TX",21): ("Mark","Teixeira","R",0.55,1980,""), ("KY",4): ("Ed","Gallrein","R",0.6,None,""), ("FL",19): ("Jim","Schwartzel","R",0.5,None,""),
  ("FL",7): ("Ryan","Elijah","R",0.5,None,"lead"), ("FL",22): ("Pia","Dandiya","D",-0.35,None,""), ("FL",24): ("Oliver","Gilbert","D",-0.4,1962,""),
  ("NY",21): ("Anthony","Constantino","R",0.6,None,"lead"),
  # House members who won Senate seats, and who replaced them
  ("NH",1): ("Stefany","Shaheen","D",-0.3,1974,""), ("MN",2): ("Matt","Little","D",-0.25,1985,""), ("AL",1): ("Jerry","Carl","R",0.55,1958,""),
}
# Incumbents who won in a renumbered seat: (to) <- (from)
MOVES = {("CA",3): ("CA",6), ("CA",40): ("CA",41), ("CA",41): ("CA",38), ("FL",20): ("FL",25), ("FL",25): ("FL",23), ("FL",23): ("FL",22)}
idx = {(m["st"], m["d"]): m for m in house}
before = {k: dict(v) for k, v in idx.items()}
for to, frm in MOVES.items():
    keep = {"st": to[0], "d": to[1], "dem": idx[to]["dem"]}
    idx[to].clear(); idx[to].update({**before[frm], **keep})
for (st, d), (fn, ln, party, x, born, note) in RESULTS.items():
    m = idx[(st, d)]; keep = {"ch": "H", "st": st, "d": d, "dem": m["dem"]}
    m.clear(); m.update({**keep, "id": f"E{st}{d}", "first": fn, "last": ln, "p": party, "x": x, "y": 0, "born": born, "since": 2027,
                         "comm": [], "lead": [], "new": True, "est": True, "flip": party != before[(st, d)]["p"], "uncalled": note == "lead"})
flips = [m for m in house if m.get("flip")]
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
# Open Senate seats, winners as called Nov 3-4, 2026. Former House members carry their House record.
OPEN = [("KY", "McConnell", "Andy", "Barr", "R", ("KY", 6), 0.45, 1973), ("IL", "Durbin", "Juliana", "Stratton", "D", None, -0.42, 1965),
        ("NH", "Shaheen", "Chris", "Pappas", "D", ("NH", 1), -0.3, 1980), ("MN", "Smith", "Peggy", "Flanagan", "D", None, -0.5, 1979),
        ("AL", "Tuberville", "Barry", "Moore", "R", ("AL", 1), 0.65, 1966)]
for st, old, fn, ln, party, house_seat, x, born in OPEN:
    s = next((m for m in senate if m["st"] == st and m["last"].startswith(old)), None)
    if not s: print("missing senate seat", st, old); continue
    hr = before.get(house_seat) if house_seat else None
    est = not (hr and hr.get("last") == ln)
    if not est: x, born = hr["x"], hr.get("born") or born
    s.update({"id": hr["id"] if not est else f"W{st}{ln[:3].upper()}", "first": fn, "last": ln, "p": party, "x": x, "y": hr["y"] if not est else 0.1, "born": born,
              "since": 2027, "comm": [], "lead": [], "new": True, "est": est, "ind": False})

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
