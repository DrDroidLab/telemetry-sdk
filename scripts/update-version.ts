#!/usr/bin/env tsx

import fs from "fs";
import path from "path";

// Read package.json
const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const version = packageJson.version;

// Read constants file
const constantsPath = path.join(
  __dirname,
  "..",
  "src",
  "constants",
  "index.ts"
);
let constantsContent = fs.readFileSync(constantsPath, "utf8");

// Replace the SDK_VERSION line
const versionRegex = /export const SDK_VERSION = "[^"]*";/;
const newVersionLine = `export const SDK_VERSION = "${version}";`;

if (versionRegex.test(constantsContent)) {
  constantsContent = constantsContent.replace(versionRegex, newVersionLine);
  fs.writeFileSync(constantsPath, constantsContent);
  console.log(`✅ Updated SDK_VERSION to ${version} in constants file`);
} else {
  console.error("❌ Could not find SDK_VERSION in constants file");
  process.exit(1);
}
