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
    if "." in f:   # initials like "J.D.": keep them and swap the last name's opening sound for their first letter
        ol = onset(l); return f, (f[0] + l[len(ol):]).capitalize() if ol else f[0] + l.lower()
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
  ("OK",1): ("Mark","Tedford","R",0.55,None,""),
  # Members who retired, ran for something else or lost a primary, and who replaced them
  # (AP calls and primary results reported Mar-Nov 2026: Fox5 Atlanta, Roll Call, CalMatters, WSLS/AP,
  # HPPR/Texas Tribune, Greenberg Traurig FL overview, WAFB, Fox5 DC, 6abc, Cowboy State Daily, The Green Papers).
  ("TX",2): ("Steve","Toth","R",0.7,1959,""), ("TX",8): ("Jessica","Steinmann","R",0.6,None,""), ("TX",9): ("Leticia","Gutierrez","D",-0.3,None,""),
  ("TX",10): ("Chris","Gober","R",0.55,None,""), ("TX",19): ("Tom","Sell","R",0.6,None,""), ("TX",22): ("Trever","Nehls","R",0.6,1968,""),
  ("TX",35): ("Johnny","Garcia","D",-0.2,None,""), ("TX",38): ("Jon","Bonck","R",0.6,None,""),
  ("GA",1): ("Jim","Kingston","R",0.55,None,""), ("GA",10): ("Houston","Gaines","R",0.6,1985,""), ("GA",11): ("John","Cowan","R",0.6,None,""),
  ("GA",13): ("Jasmine","Clark","D",-0.4,None,""),
  ("MI",11): ("Jeremy","Moss","D",-0.4,1986,""), ("MI",13): ("Donavan","McKinney","D",-0.6,None,""), ("WI",7): ("Michael","Alfonso","R",0.6,None,""),
  ("NY",7): ("Claire","Valdez","D",-0.65,None,""), ("NY",10): ("Brad","Lander","D",-0.55,1969,""), ("NY",12): ("Micah","Lasher","D",-0.4,1981,""),
  ("NY",13): ("Darializa","Avila Chevalier","D",-0.65,None,""),
  ("NJ",12): ("Adam","Hamawy","D",-0.6,None,""), ("CO",1): ("Melat","Kiros","D",-0.6,None,""), ("MA",6): ("Dan","Koh","D",-0.3,1984,""),
  ("CT",1): ("Luke","Bronin","D",-0.3,1979,""), ("PA",3): ("Chris","Rabb","D",-0.65,1970,""), ("MD",5): ("Adrian","Boafo","D",-0.35,1990,""),
  ("CA",34): ("Angela","Gonzales-Torres","D",-0.55,None,""), ("CA",26): ("Jacqui","Irwin","D",-0.3,1962,"lead"),
  ("IL",2): ("Donna","Miller","D",-0.4,None,""), ("IL",4): ("Patty","Garcia","D",-0.5,None,""), ("IL",7): ("La Shawn","Ford","D",-0.45,1972,""),
  ("IL",8): ("Melissa","Bean","D",-0.15,1962,""), ("IL",9): ("Daniel","Biss","D",-0.5,1977,""),
  ("FL",2): ("Austin","Rogers","R",0.55,None,""), ("FL",11): ("Joe","Strada","R",0.55,None,""), ("FL",16): ("Sydney","Gruters","R",0.55,None,""),
  ("LA",5): ("Gabe","Firment","R",0.6,None,"lead"), ("LA",6): ("Blake","Miguez","R",0.65,1981,"lead"),   # Dec. 12 runoffs
  ("TN",5): ("Charlie","Hatcher","R",0.5,None,""), ("TN",6): ("Johnny","Garrett","R",0.6,None,""),
  ("AZ",5): ("Mark","Lamb","R",0.7,1972,""), ("IA",4): ("Chris","McGowan","R",0.55,None,""), ("MO",6): ("Chris","Stigall","R",0.65,None,""),
  ("SD",0): ("Marty","Jackley","R",0.5,1970,""), ("SC",5): ("Wes","Climer","R",0.6,1981,""), ("WY",0): ("Chuck","Gray","R",0.75,1990,""),
  ("WA",4): ("Amanda","McKinney","R",0.55,None,""),
}
# Incumbents who won in a renumbered seat: (to) <- (from)
MOVES = {("CA",3): ("CA",6), ("CA",40): ("CA",41), ("CA",41): ("CA",38), ("FL",20): ("FL",25), ("FL",25): ("FL",23), ("FL",23): ("FL",22),
         ("TX",37): ("TX",35),                                   # Casar won the new Austin seat Doggett left
         ("UT",2): ("UT",1), ("UT",3): ("UT",2), ("UT",4): ("UT",3)}   # Utah's court-drawn map: McAdams took the Salt Lake seat
# Redrawn seats where the 2024 number no longer fits: estimated 2024 presidential share on the new lines (Dem two-party %).
NEW_LEAN = {("TX",9): 45.0, ("TX",35): 46.0, ("TX",34): 46.0, ("TX",28): 46.0, ("TX",15): 46.5, ("TX",23): 45.5, ("TX",32): 40.0,
            ("LA",6): 42.0, ("NY",21): 39.0, ("UT",1): 54.0, ("NC",1): 47.0, ("MO",5): 41.0, ("OH",9): 45.0, ("OH",13): 47.0}
def inherit(prev):
    # A newcomer is expected to take the seats their predecessor held, at the bottom of the bench.
    return [{"c": c["c"], "n": c["n"], "rank": 90 + i, "title": "", "exp": True} for i, c in enumerate((prev or {}).get("comm", [])[:3])]
idx = {(m["st"], m["d"]): m for m in house}
before = {k: dict(v) for k, v in idx.items()}
for to, frm in MOVES.items():
    keep = {"st": to[0], "d": to[1], "dem": idx[to]["dem"]}
    idx[to].clear(); idx[to].update({**before[frm], **keep})
for (st, d), (fn, ln, party, x, born, note) in RESULTS.items():
    m = idx[(st, d)]; keep = {"ch": "H", "st": st, "d": d, "dem": m["dem"]}
    m.clear(); m.update({**keep, "id": f"E{st}{d}", "first": fn, "last": ln, "p": party, "x": x, "y": 0, "born": born, "since": 2027,
                         "comm": inherit(before[(st, d)]), "lead": [], "new": True, "est": True, "flip": party != before[(st, d)]["p"], "uncalled": note == "lead"})
# A winner in a seat that voted 15+ points the other way only happens on redrawn lines: use an estimated lean instead.
for m in house:
    own = m["dem"] if m["p"] == "D" else 100 - m["dem"]
    if m.get("new") and own < 42 and (m["p"] == "R" or m["st"] in ("CA", "UT", "TX")): m["dem"] = 54.0 if m["p"] == "D" else 45.0; m["newLines"] = True
    if (m["st"], m["d"]) in NEW_LEAN: m["dem"] = NEW_LEAN[(m["st"], m["d"])]; m["newLines"] = True
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
    s.update({"id": f"W{st}{ln[:3].upper()}", "first": fn, "last": ln, "p": "D", "x": x, "y": 0.1, "born": born, "since": 2027, "comm": inherit(s), "lead": [], "new": True, "est": True, "ind": False})
# Open Senate seats, winners as called Nov 3-4, 2026. Former House members carry their House record.
OPEN = [("KY", "McConnell", "Andy", "Barr", "R", ("KY", 6), 0.45, 1973), ("IL", "Durbin", "Juliana", "Stratton", "D", None, -0.42, 1965),
        ("NH", "Shaheen", "Chris", "Pappas", "D", ("NH", 1), -0.3, 1980), ("MN", "Smith", "Peggy", "Flanagan", "D", None, -0.5, 1979),
        ("AL", "Tuberville", "Barry", "Moore", "R", ("AL", 1), 0.65, 1966),
        ("OK", "Armstrong", "Kevin", "Hern", "R", ("OK", 1), 0.55, 1961),
        ("LA", "Cassidy", "Julia", "Letlow", "R", ("LA", 5), 0.5, 1981), ("MT", "Daines", "Kurt", "Alme", "R", None, 0.55, 1966),
        ("WY", "Lummis", "Harriet", "Hageman", "R", ("WY", 0), 0.75, 1962)]   # Mullin left for DHS in March; appointee Armstrong served to year's end
for st, old, fn, ln, party, house_seat, x, born in OPEN:
    s = next((m for m in senate if m["st"] == st and m["last"].startswith(old)), None)
    if not s: print("missing senate seat", st, old); continue
    hr = before.get(house_seat) if house_seat else None
    est = not (hr and hr.get("last") == ln)
    if not est: x, born = hr["x"], hr.get("born") or born
    s.update({"id": hr["id"] if not est else f"W{st}{ln[:3].upper()}", "first": fn, "last": ln, "p": party, "x": x, "y": hr["y"] if not est else 0.1, "born": born,
              "since": 2027, "comm": inherit(s), "lead": [], "new": True, "est": est, "ind": False})

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
# Leadership for the 120th Congress: elected or expected as of Nov 10, 2026.
LEAD = {("H", "Katherine", "Clark"): "House Majority Leader (expected)", ("H", "Jim", "Jordan"): "Running for House Republican Leader",
        ("S", "Chuck", "Grassley"): None, ("S", "Patty", "Murray"): "President Pro Tempore (expected)",
        ("S", "Brian", "Schatz"): "Senate Majority Whip (expected)"}
for m in house + senate:
    k = (m["ch"], m.get("first"), m.get("last"))
    if k in LEAD: m["lead"] = [LEAD[k]] if LEAD[k] else []
# Committees: the new majority (Democrats) chairs every panel. Where the chair or ranking member left,
# the next member of that party by seniority on the panel takes the post (marked expected).
for ch, pool in (("H", house), ("S", senate)):
    panels = {}
    for m in pool:
        for c in m.get("comm", []): panels.setdefault(c["c"], []).append((m, c))
    for code, rows in panels.items():
        for party, post in (("D", "Chair"), ("R", "Ranking Member")):
            mine = [(m, c) for m, c in rows if m["p"] == party]
            for m, c in mine:
                if c["title"] in ("Chair", "Ranking Member") and c["title"] != post: c["title"] = ""
            if mine and not any(c["title"] == post for m, c in mine):
                vice = [(m, c) for m, c in mine if c["title"].startswith("Vice")]   # select panels: the vice chair moves up
                m, c = vice[0] if vice else min(mine, key=lambda r: (r[0].get("since") or 2027, r[1]["rank"]))
                c["title"] = post; c["exp"] = True

# Portrait skin tone and hair for real members (palette index 0 = lightest .. 6 = darkest), so faces aren't random.
# Groups follow members' own public identification (Congressional Black Caucus, Hispanic and Asian Pacific American
# caucuses, tribal citizenship, family background); everyone else defaults to the lighter end of the palette.
import unicodedata
def _n(x): return unicodedata.normalize("NFKD", x).encode("ascii", "ignore").decode().lower()
LOOKS = {
  "b": "Adams NC;Bishop GA;Beatty OH;Bell MO;Brown OH-11;Carson IN;Carter LA;Gilbert FL-24;Clarke NY;Cleaver MO;Clyburn SC;Figures AL;Frost FL;Hayes CT;Horsford NV;Ivey MD;Jackson IL;Jeffries NY;Johnson GA;Lee PA;Mfume MD;Moore WI;McClellan VA;McIver NJ;Meeks NY;Pressley MA;Scott VA;Sewell AL;Simon CA;Thompson MS;Williams GA;Kamlager-Dove CA;Waters CA;Omar MN;McBath GA;Menefee TX;Foushee NC;Davis NC;Sykes OH;Amo RI;Clark GA;Boafo MD;Miller IL-2;Ford IL;Haynes TX;Allred TX;Kiros CO;Womack NC;Jefferson NC;Rabb PA;Booker NJ;Warnock GA;Blunt Rochester DE;Alsobrooks MD;Scott SC;Stratton IL",
  "al": "Torres NY;Avila Chevalier NY",
  "h": "Aguilar CA;Barragan CA;Castro TX;Correa CA;Cuellar TX;Garcia CA;Garcia TX;Garcia IL;Gonzalez TX;Grijalva AZ;Leger Fernandez NM;Menendez NJ;Ramirez IL;Ruiz CA;Salinas OR;Sanchez CA;Soto FL;Torres CA;Vargas CA;Vasquez NM;Casar TX;Rivas CA;Escobar TX;Cisneros CA;Ocasio-Cortez NY;Diaz-Balart FL;Salazar FL;Gimenez FL;Luna FL;Padilla Stout TX;Pulido TX;Mendoza AZ;Rutinel CO;Solis CA;Villegas CA;Benitez-Thompson NV;Gutierrez TX;Gonzales-Torres CA;Padilla CA;Cortez Masto NV;Lujan NM;Gallego AZ;Cruz TX;Moreno OH;Talarico TX",
  "a": "Chu CA;Meng NY;Matsui CA;Takano CA;Tokuda HI;Lieu CA;Tran CA;Min CA;Kim NJ;Hirono HI;Duckworth IL",
  "s": "Dandiya FL;Bera CA;Jayapal WA;Khanna CA;Subramanyam VA",
  "m": "Tlaib MI;Ansari AZ;Wahab CA;Hamawy NJ;El-Sayed MI;LaHood IL",
  "n": "Davids KS;Peltola AK;Cole OK",
}
# Hand-set where a group's range would be wrong for a well-known face.
SKIN_FIX = {(_n(k.rsplit(" ", 1)[0]), k.rsplit(" ", 1)[1]): v for k, v in {"Cruz TX": 1, "Moreno OH": 1, "Ocasio-Cortez NY": 1, "Talarico TX": 1, "Diaz-Balart FL": 1, "Gimenez FL": 1, "Salazar FL": 1, "Menendez NJ": 1, "Luna FL": 1,
  "Cortez Masto NV": 1, "Lujan NM": 1, "Padilla CA": 2, "Gallego AZ": 2, "Castro TX": 2, "Aguilar CA": 2, "Cole OK": 1, "Duckworth IL": 1, "Booker NJ": 4, "Warnock GA": 5, "Jeffries NY": 5, "Clyburn SC": 5, "Stratton IL": 4, "Alsobrooks MD": 4, "Blunt Rochester DE": 5}.items()}
TONES = {"b": [4, 5, 5, 6], "al": [3, 4], "h": [1, 2, 2, 3], "a": [1, 2], "s": [3, 4], "m": [1, 2], "n": [2, 3], "w": [0, 0, 1]}
GROUP = {}
for g, names in LOOKS.items():
    for k in names.split(";"):
        last, st = k.rsplit(" ", 1); GROUP[(_n(last), st)] = g
# Gender and age for portraits: the legislators file for sitting members; first names for 2026 newcomers.
BIO = {l["id"]["bioguide"]: l.get("bio", {}) for l in leg}
FEMALE = set("JoAnna Jacqui Angela Hilda Marni Melat Jessica Anna Laurel Sydney Pia Jasmine Christina Lindsay Sarah Donna Patty Melissa Lakesha Denise Stefany Rebecca Teresa Claire Darializa Cait Kristina Paige Janelle Nancy Leticia Katy Shannon Elaine Amanda Juliana Mary Peggy Annie Harriet Julia".split())
for m in house + senate:
    b = BIO.get(m["id"], {})
    if b.get("gender"): m["g"] = b["gender"]
    elif not m.get("gen"): m["g"] = "F" if m["first"].split()[0] in FEMALE else "M"
    if b.get("birthday"): m["born"] = int(b["birthday"][:4])
    elif not m.get("born") and not m.get("gen"): m["born"] = 1977; m["bornEst"] = True   # age unknown: about a typical freshman's
seen = set()
for m in house + senate:
    if m.get("gen"): continue
    kd = (_n(m["last"]), f'{m["st"]}-{m["d"]}') if m["ch"] == "H" else None
    key = kd if kd in GROUP else (_n(m["last"]), m["st"])
    g = GROUP.get(key, "w") if not (key[1] == m["st"] and any(k2[0] == key[0] and "-" in k2[1] and k2[1].startswith(m["st"] + "-") for k2 in GROUP)) else "w"
    if g != "w": seen.add(key)
    tones = TONES[g]; i = int(h(m["id"], "skin") * len(tones)) % len(tones)
    fixed = SKIN_FIX.get((_n(m["last"]), m["st"]))
    if fixed is not None: tones, i = [fixed], 0
    age = 2027 - (m.get("born") or 1970)
    look = {"skin": tones[i]}
    if g != "w": look["hair"] = "#d9d9d9" if age > 70 else "#9a9a9a" if age > 60 else ["#1f1a17", "#2b211b"][i % 2]
    m["look"] = look
missing = [k for k in GROUP if k not in seen]
if missing: print("skin table names not found:", missing)
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
