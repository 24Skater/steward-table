#!/usr/bin/env node
/**
 * Audit every `_bypassTenancyCheck` call site.
 *
 * The guard in lib/db.ts throws on an unscoped read of a tenanted model, and
 * `_bypassTenancyCheck: true` is the escape hatch. An escape hatch nobody
 * reviews stops being an escape hatch and becomes the default, so this makes
 * each use answer for itself.
 *
 * A bypass passes when any of these is true:
 *
 *   - the enclosing query mentions `churchId` or `church`, so it is scoped
 *     after all and the bypass exists only to satisfy a type or a nested shape
 *   - the model is global or parent-scoped, where the guard never applied
 *   - a comment above it explains why reading across churches is correct
 *
 * What fails the build is a bypass on a tenanted model with no scoping and no
 * explanation — the shape that reads another church's rows.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const NEWLINE = String.fromCharCode(10);

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "coverage",
  "playwright-report",
  "test-results",
  "StewardTable_Starter_MD",
]);

/** Kept in step with lib/db.ts by tests/unit/tenancy/model-classification.test.ts. */
const TENANTED = new Set([
  "catalog",
  "kitchen",
  "ministry",
  "volunteerlink",
  "item",
  "modifiergroup",
  "customer",
  "order",
  "ordercounter",
  "deliveryzone",
  "inventoryitem",
  "auditlog",
  "webhookevent",
  "emaillog",
  "smslog",
  "notification",
  "membership",
  "invitation",
  "apikey",
  "churchsettings",
  "stripeaccount",
]);

/** How far above a bypass a justifying comment may sit. */
const COMMENT_LOOKBACK = 8;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.tsx?$/.test(entry)) yield full;
  }
}

/**
 * The whole `db.model.method({ ... })` call containing a bypass.
 *
 * Found by walking back to the call and forward to its balanced close, rather
 * than guessing a line window. A long `select` can put the `where` twenty lines
 * above the bypass, and a window short enough to be meaningful would report
 * every one of those as unscoped.
 */
function enclosingCall(lines, index) {
  let start = null;
  let model = null;

  for (let i = index; i >= 0 && i > index - 60; i -= 1) {
    const match = lines[i].match(/\bdb\.([a-zA-Z]+)\s*\.\s*[a-zA-Z]+/);
    if (match) {
      start = i;
      model = match[1].toLowerCase();
      break;
    }
  }

  if (start === null) return { model: null, text: "" };

  let depth = 0;
  let seen = false;
  let end = start;

  for (let i = start; i < lines.length && i < start + 90; i += 1) {
    for (const char of lines[i]) {
      if (char === "(" || char === "{") {
        depth += 1;
        seen = true;
      } else if (char === ")" || char === "}") {
        depth -= 1;
      }
    }
    end = i;
    if (seen && depth <= 0) break;
  }

  return { model, text: lines.slice(start, end + 1).join(NEWLINE) };
}

function hasJustification(lines, index) {
  for (let i = index - 1; i >= Math.max(0, index - COMMENT_LOOKBACK); i -= 1) {
    const line = lines[i].trim();
    const isComment = line.startsWith("//") || line.startsWith("*") || line.startsWith("/*");

    if (isComment) {
      // A comment that only restates the code justifies nothing.
      if (!/^[/*\s]*(bypass|_bypassTenancyCheck)[\s.:]*$/i.test(line)) return true;
    }
  }
  return false;
}

const findings = [];
let total = 0;

for (const file of walk(ROOT)) {
  if (file.endsWith(`lib${sep}db.ts`)) continue;

  const text = readFileSync(file, "utf8");
  if (!text.includes("_bypassTenancyCheck")) continue;

  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!line.includes("_bypassTenancyCheck")) return;
    total += 1;

    const { model, text: call } = enclosingCall(lines, index);
    if (model && !TENANTED.has(model)) return;
    if (/\bchurchId\b|\bchurch\s*:/.test(call)) return;
    if (hasJustification(lines, index)) return;

    findings.push({
      file: relative(ROOT, file).replace(/\\/g, "/"),
      line: index + 1,
      model: model ?? "unknown",
    });
  });
}

console.log(`Checked ${total} tenancy bypasses.`);

if (findings.length === 0) {
  console.log("ok: every bypass is scoped, on a non-tenanted model, or explained.");
  process.exit(0);
}

console.log("");
console.log("FAIL: these bypass the tenancy guard on a tenanted model with no");
console.log("      churchId in the query and no comment saying why:");
console.log("");
for (const finding of findings) {
  console.log(`  ${finding.file}:${finding.line}  (${finding.model})`);
}
console.log("");
console.log("Either scope the query, or write a comment above it explaining why");
console.log("reading across churches is correct here.");
process.exit(1);
