import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const ignoredDirectories = new Set([".git", ".npm-cache", "node_modules", "coverage", "dist", "test-vault"]);
const ignoredFiles = new Set(["package-lock.json", "main.js"]);
const textExtensions = new Set([".ts", ".js", ".mjs", ".json", ".md", ".yml", ".yaml", ".css", ".html"]);
const forbiddenExtensions = new Set([".pem", ".key", ".p12", ".pfx", ".crt", ".cer", ".jks", ".keystore"]);
const patterns = [
  { name: "private key block", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "real-looking WeChat AppID", regex: /\bwx[a-f0-9]{16}\b/i },
  { name: "assigned WeChat secret", regex: /(?:WECHAT_APP_SECRET|APPSECRET|app_secret)\s*[:=]\s*["']?(?!your|test|fake|example|redacted)[a-z0-9_\-]{20,}/i },
  { name: "access token", regex: /access_token\s*[:=]\s*["']?(?!ACCESS_TOKEN|test|fake|redacted)[a-z0-9_\-]{40,}/i }
];

const failures = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    const relative = path.relative(root, fullPath).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (/^\.env(?:\.|$)/.test(entry.name) || forbiddenExtensions.has(path.extname(entry.name).toLowerCase())) {
      failures.push(`${relative}: forbidden secret/certificate filename`);
      continue;
    }
    if (ignoredFiles.has(entry.name) || !textExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    const content = fs.readFileSync(fullPath, "utf8");
    for (const pattern of patterns) {
      if (pattern.regex.test(content)) failures.push(`${relative}: ${pattern.name}`);
    }
  }
}

walk(root);
if (failures.length) {
  process.stderr.write(`Secret scan failed:\n${failures.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write("Secret scan passed.\n");
