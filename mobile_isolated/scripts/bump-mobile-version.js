#!/usr/bin/env node
/**
 * Bump mobile app version for the next release cycle.
 * Updates package.json, android/app/build.gradle, and src/core/config/appVersion.js.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PKG_PATH = path.join(ROOT, 'package.json');
const GRADLE_PATH = path.join(ROOT, 'android/app/build.gradle');
const APP_VERSION_PATH = path.join(ROOT, 'src/core/config/appVersion.js');

function parseVersion(name) {
  const parts = String(name || '0.0.0')
    .split('.')
    .map(part => parseInt(part, 10) || 0);
  while (parts.length < 3) parts.push(0);
  return parts;
}

function formatVersion(parts) {
  return parts.slice(0, 3).join('.');
}

function bumpPatch(name) {
  const parts = parseVersion(name);
  parts[2] += 1;
  return formatVersion(parts);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  const pkg = readJson(PKG_PATH);
  const currentName = String(pkg.version || '0.0.0').trim();
  const nextName = bumpPatch(currentName);

  const gradle = fs.readFileSync(GRADLE_PATH, 'utf8');
  const codeMatch = gradle.match(/versionCode\s+(\d+)/);
  if (!codeMatch) {
    throw new Error(`Could not find versionCode in ${GRADLE_PATH}`);
  }
  const currentCode = Number(codeMatch[1]);
  const nextCode = currentCode + 1;

  pkg.version = nextName;
  fs.writeFileSync(PKG_PATH, `${JSON.stringify(pkg, null, 2)}\n`);

  const nextGradle = gradle
    .replace(/versionCode\s+\d+/, `versionCode ${nextCode}`)
    .replace(/versionName\s+"[^"]*"/, `versionName "${nextName}"`);
  fs.writeFileSync(GRADLE_PATH, nextGradle);

  const appVersion = fs.readFileSync(APP_VERSION_PATH, 'utf8');
  const nextAppVersion = appVersion
    .replace(/export const APP_VERSION_NAME = '[^']*';/, `export const APP_VERSION_NAME = '${nextName}';`)
    .replace(/export const APP_VERSION_CODE = \d+;/, `export const APP_VERSION_CODE = ${nextCode};`);
  fs.writeFileSync(APP_VERSION_PATH, nextAppVersion);

  console.log(`Bumped mobile version: ${currentName} (${currentCode}) -> ${nextName} (${nextCode})`);
}

main();
