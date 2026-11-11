#!/bin/sh
# Copy the game into the Lovable project (tobyyo9/campaign-manager): src/game, keeping its React import line on JSX files.
set -e
P=/home/claude/political-manager; L=/home/claude/campaign-manager
for f in App.jsx Pages.jsx RollCall.jsx Scene.jsx; do { echo 'import * as React from "react";'; cat $P/src/$f; } > $L/src/game/$f; done
cp $P/src/Portrait.jsx $P/src/sim.js $P/src/scenes.js $P/src/exec.js $P/src/groups.js $P/src/voices.js $P/src/pm.css $L/src/game/
cp $P/src/data/*.json $L/src/game/data/; cp -r $P/src/shared/. $L/src/game/shared/
cp $P/tests/careers.mjs $L/tests/political-manager/careers.mjs; cp $P/README.md $L/src/game/README.md
