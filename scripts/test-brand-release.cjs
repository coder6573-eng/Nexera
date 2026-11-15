"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = path => fs.readFileSync(path, "utf8");
const packageJson = JSON.parse(read("package.json"));
const androidGradle = read("app/build.gradle.kts");
const manifest = read("app/src/main/AndroidManifest.xml");
const html = read("index.html");
const adaptiveIcon = read("app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml");
const roundIcon = read("app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml");
const foreground = read("app/src/main/res/drawable/ic_nexera_foreground.xml");
const monochrome = read("app/src/main/res/drawable/ic_nexera_monochrome.xml");

assert.equal(packageJson.version, "21.0.0", "Desktop package version should match v21.");
assert.match(androidGradle, /versionCode\s*=\s*200/);
assert.match(androidGradle, /versionName\s*=\s*"20\.0\.0"/);
assert.match(manifest, /android:icon="@mipmap\/ic_launcher"/);
assert.match(manifest, /android:roundIcon="@mipmap\/ic_launcher_round"/);
assert.match(adaptiveIcon, /@drawable\/ic_nexera_foreground/);
assert.match(adaptiveIcon, /@drawable\/ic_nexera_monochrome/);
assert.match(roundIcon, /@drawable\/ic_nexera_foreground/);
assert.match(foreground, /android:pathData=/);
assert.match(monochrome, /android:pathData=/);
assert.equal((html.match(/class="nexera-mark"/g) || []).length, 2,
  "Header and home screen should use the shared Nexera N mark.");
assert.match(html, /Nexera AI/);
console.log("Brand/release tests passed: v21 version metadata, adaptive/round/monochrome launcher icons, and shared in-app logo.");
