// Turn Vite's full HTML document into the fragment the Artifact page expects:
// <title> first, no doctype/html/head/body wrappers, classic (non-module) script.
import { readFileSync, writeFileSync } from "node:fs";
let html = readFileSync("dist/index.html", "utf8");
html = html
  .replace(/<!doctype html>/i, "")
  .replace(/<\/?html[^>]*>/gi, "")
  .replace(/<\/?head>/gi, "")
  .replace(/<\/?body>/gi, "")
  .replace(/<meta charset="utf-8">/i, "")
  .replace(/<script type="module" crossorigin>/g, "<script>");
// Module scripts in <head> run deferred; a classic script must run after #root exists.
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (m && html.indexOf(m[0]) < html.indexOf('id="root"')) {
  // Function replacers: a replacement *string* would treat "$$" in the code as "$".
  html = html.replace(m[0], () => "");
  html = html.replace('<div id="root"></div>', () => '<div id="root"></div>\n<script>' + m[1] + "</script>");
}
writeFileSync("dist/political-manager.html", html.trim() + "\n");
console.log("wrote dist/political-manager.html", (html.length / 1024).toFixed(0) + "KB");
