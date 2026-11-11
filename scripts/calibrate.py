"""Fit the vote formula to real roll calls from the 119th Congress (Voteview).
Trains on a random 70% of roll calls and scores the other 30%.
Writes data/calibration.json with accuracy and fitted weights."""
import json, re, sys
import numpy as np, pandas as pd
from sklearn.linear_model import LogisticRegression

rng = np.random.default_rng(7)
LEADERS = {"House": {"R": ["S001176", "E000294"], "D": ["J000294", "C001101"]},
           "Senate": {"R": ["T000250", "B001261"], "D": ["S000148", "D000563"]}}

def margins():
    rows = {}
    for line in open("data/raw/downballot_pres_by_cd.csv", encoding="utf-8"):
        p = line.rstrip("\n").split(",")
        if re.match(r"^[A-Z]{2}-(AL|\d\d)$", p[0]) and len(p) > 5 and p[3] and p[4]:
            rows[p[0]] = float(p[3]) - float(p[4])   # Harris minus Trump, points
    return rows

def run(ch):
    P = ch[0]
    m = pd.read_csv(f"data/raw/{P}119_members.csv")
    m = m[m.chamber == ch].copy()
    m["party"] = m.party_code.map({100: "D", 200: "R", 328: "D"})
    m = m.dropna(subset=["nominate_dim1", "party"])
    if ch == "House":
        mg = margins()
        m["cd"] = m.apply(lambda r: f"{r.state_abbrev}-{'AL' if r.district_code in (0, 1) and f'{r.state_abbrev}-AL' in mg else str(int(r.district_code)).zfill(2)}", axis=1)
        m["lean"] = m.cd.map(mg)
    else:
        m["lean"] = np.nan
    m["lean"] = m.lean.fillna(0.0) / 100.0
    v = pd.read_csv(f"data/raw/{P}119_votes.csv")
    v = v[v.cast_code.isin([1, 2, 3, 4, 5, 6])].copy()
    v["yea"] = (v.cast_code <= 3).astype(int)
    r = pd.read_csv(f"data/raw/{P}119_rollcalls.csv").dropna(subset=["nominate_mid_1", "nominate_spread_1"])
    d = v.merge(m[["icpsr", "party", "nominate_dim1", "nominate_dim2", "lean", "bioguide_id"]], on="icpsr").merge(
        r[["rollnumber", "nominate_mid_1", "nominate_mid_2", "nominate_spread_1", "nominate_spread_2", "vote_question"]], on="rollnumber")
    # Each party's leadership position on each roll call: its floor leaders' votes, else the party majority.
    lead = {}
    for p in "DR":
        lv = d[d.bioguide_id.isin(LEADERS[ch][p])].groupby("rollnumber").yea.mean()
        maj = d[d.party == p].groupby("rollnumber").yea.mean()
        pos = maj.copy()
        pos[:] = np.where(maj > 0.5, 1, -1)
        pos.update(lv.map(lambda x: 1 if x > 0.5 else -1 if x < 0.5 else 0))
        lead[p] = pos
    d["own"] = np.where(d.party == "D", d.rollnumber.map(lead["D"]), d.rollnumber.map(lead["R"]))
    d["other"] = np.where(d.party == "D", d.rollnumber.map(lead["R"]), d.rollnumber.map(lead["D"]))
    dirD = (d.rollnumber.map(lead["D"]) - d.rollnumber.map(lead["R"])) / 2      # +1 = Democrats' side of a party-line vote
    d["conv1"] = d.nominate_spread_1 * (d.nominate_mid_1 - d.nominate_dim1)       # own convictions, economic axis
    d["conv2"] = d.nominate_spread_2 * (d.nominate_mid_2 - d.nominate_dim2)       # second axis
    d["district"] = d.lean * dirD                                                # district lean toward the bill's side
    proc = d.vote_question.fillna("").str.contains("Previous Question|Recommit|Rule|Table|Adjourn|Journal|Cloture|Proceed", regex=True)
    d["own_proc"] = d.own * proc                                                 # procedural votes follow leadership harder
    d["bipart"] = ((d.own == 1) & (d.other == 1)).astype(int)
    feats = ["conv1", "conv2", "own", "other", "district", "own_proc", "bipart"]
    rolls = d.rollnumber.unique(); rng.shuffle(rolls)
    test = set(rolls[: int(len(rolls) * 0.3)])
    tr, te = d[~d.rollnumber.isin(test)], d[d.rollnumber.isin(test)]
    def fit(cols):
        lr = LogisticRegression(C=10, max_iter=2000).fit(tr[cols], tr.yea)
        return lr, float((lr.predict(te[cols]) == te.yea).mean())
    full, acc = fit(feats)
    _, acc_party = fit(["own", "other", "own_proc", "bipart"])
    _, acc_ideo = fit(["conv1", "conv2"])
    base = float(((te.own >= 0).astype(int) == te.yea).mean())
    # Close votes are where it matters: roll calls decided by under 10% of those voting.
    marg = te.groupby("rollnumber").yea.mean()
    close = te[te.rollnumber.isin(marg[(marg - 0.5).abs() < 0.05].index)]
    acc_close = float((full.predict(close[feats]) == close.yea).mean()) if len(close) else None
    # Defectors: members who voted against their own leadership.
    defect = te[(te.own != 0) & ((te.own > 0).astype(int) != te.yea)]
    caught = float((full.predict(defect[feats]) == defect.yea).mean()) if len(defect) else None
    return {"chamber": ch, "members": int(m.shape[0]), "rollcalls": int(len(rolls)), "votes_cast": int(len(d)),
            "test_rollcalls": len(test), "accuracy": round(acc, 4), "party_line_baseline": round(base, 4),
            "leadership_only": round(acc_party, 4), "ideology_only": round(acc_ideo, 4),
            "accuracy_close_votes": None if acc_close is None else round(acc_close, 4),
            "defections_in_test": int(len(defect)), "defections_caught": None if caught is None else round(caught, 4),
            "weights": {k: round(float(w), 3) for k, w in zip(feats, full.coef_[0])}, "intercept": round(float(full.intercept_[0]), 3)}

out = {"source": "Voteview roll calls, 119th Congress, through " + pd.read_csv("data/raw/H119_rollcalls.csv").date.max(),
       "method": "Logistic fit on a random 70% of roll calls, scored on the held-out 30%. Bill positions are Voteview's own estimates.",
       "results": [run("House"), run("Senate")]}
json.dump(out, open("data/calibration.json", "w"), indent=1)
print(json.dumps(out, indent=1))
