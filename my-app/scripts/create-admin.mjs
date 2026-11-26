#!/usr/bin/env node
/**
 * Create (or promote) a Sukimart administrator from the terminal.
 *
 *   npm run create-admin -- --email you@example.com --name "Your Name"
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local. The key is read only by
 * this local script and is never exposed to the browser.
 */

import { createInterface } from "node:readline/promises";
import { readFile } from "node:fs/promises";
import { stdin, stdout } from "node:process";

const ENV_PATH = ".env.local";

function parseEnv(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

async function loadEnv() {
  let fileValues = {};
  try {
    fileValues = parseEnv(await readFile(ENV_PATH, "utf8"));
  } catch {
    // Missing .env.local is reported below with the other missing settings.
  }
  return { ...fileValues, ...process.env };
}

function parseArgs(argv) {
  const args = { email: "", password: "", name: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [flag, inline] = arg.includes("=") ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const next = () => inline ?? argv[++index] ?? "";
    if (flag === "--email" || flag === "-e") args.email = next();
    else if (flag === "--password" || flag === "-p") args.password = next();
    else if (flag === "--name" || flag === "-n") args.name = next();
    else if (flag === "--help" || flag === "-h") args.help = true;
    else if (!arg.startsWith("-") && !args.email) args.email = arg;
  }
  return args;
}

function printHelp() {
  console.log(`Sukimart admin account creator

Usage:
  npm run create-admin -- --email you@example.com --name "Your Name"

Options:
  -e, --email     Admin account email (required)
  -p, --password  Password for a new account (prompted if omitted)
  -n, --name      Display name (defaults to the email name)
  -h, --help      Show this help

Setup:
  Add SUPABASE_SERVICE_ROLE_KEY to .env.local. Find it in
  Supabase Dashboard -> Project Settings -> API keys -> secret key.
  Never commit this key or put it in a NEXT_PUBLIC_ variable.`);
}

function askHidden(question) {
  if (!stdin.isTTY) {
    return Promise.resolve("");
  }
  return new Promise((resolve) => {
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (char) => {
      if (char === "\u0003") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        stdout.write("\n");
        process.exit(1);
      }
      if (char === "\r" || char === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        stdout.write("\n");
        resolve(value);
        return;
      }
      if (char === "\u007f" || char === "\b") {
        value = value.slice(0, -1);
        return;
      }
      value += char;
    };
    stdin.on("data", onData);
  });
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function describeError(body, status) {
  if (!body) return `HTTP ${status}`;
  if (typeof body === "string") return body;
  return body.msg || body.message || body.error_description || body.error || `HTTP ${status}`;
}

async function adminRequest(baseUrl, key, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { ok: response.ok, status: response.status, body };
}

async function findUserByEmail(baseUrl, key, email) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 50; page += 1) {
    const result = await adminRequest(
      baseUrl,
      key,
      `/auth/v1/admin/users?page=${page}&per_page=200`,
    );
    if (!result.ok) {
      fail(`Could not list users: ${describeError(result.body, result.status)}`);
    }
    const users = result.body?.users ?? [];
    const match = users.find((user) => (user.email ?? "").toLowerCase() === target);
    if (match) return match;
    if (users.length < 200) return null;
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const env = await loadEnv();
  const baseUrl = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").replace(
    /\/+$/,
    "",
  );
  const serviceKey =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_KEY ||
    env.SUPABASE_SECRET_KEY ||
    "";

  if (!baseUrl) {
    fail(
      "No Supabase URL found. Set NEXT_PUBLIC_SUPABASE_URL in .env.local (see .env.example).",
    );
  }
  if (!serviceKey) {
    fail(
      "No service role key found. Add this line to .env.local:\n\n" +
        "  SUPABASE_SERVICE_ROLE_KEY=your-secret-key\n\n" +
        "Find it in Supabase Dashboard -> Project Settings -> API keys -> secret key.\n" +
        "Keep it out of Git and never use a NEXT_PUBLIC_ prefix for it.",
    );
  }

  const rl = createInterface({ input: stdin, output: stdout });

  let email = args.email.trim();
  if (!email) email = (await rl.question("Admin email: ")).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    rl.close();
    fail("Enter a valid email address.");
  }

  let name = args.name.trim();
  if (!name) {
    const suggestion = email.split("@")[0].replace(/[._-]+/g, " ");
    name = (
      await rl.question(`Display name [${suggestion}]: `)
    ).trim() || suggestion;
  }

  rl.close();

  let password = args.password;
  if (!password) {
    password = await askHidden("Password (min 8 characters, hidden): ");
  }
  if (password && password.length < 8) {
    fail("Use a password with at least 8 characters.");
  }

  console.log(`\n→ Looking up ${email} in Supabase Auth…`);
  const existing = await findUserByEmail(baseUrl, serviceKey, email);

  let userId;
  let action;

  if (existing) {
    userId = existing.id;
    action = "updated";
    console.log("→ Account exists. Promoting it to administrator…");
    const update = await adminRequest(
      baseUrl,
      serviceKey,
      `/auth/v1/admin/users/${userId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          email_confirm: true,
          ...(password ? { password } : {}),
          user_metadata: { ...(existing.user_metadata ?? {}), full_name: name },
        }),
      },
    );
    if (!update.ok) {
      fail(`Could not update the account: ${describeError(update.body, update.status)}`);
    }
  } else {
    if (!password) {
      fail(
        "This email is not registered yet, so a password is required.\n" +
          "Re-run with --password, or create the account in the app first.",
      );
    }
    console.log("→ Creating a new confirmed account…");
    const created = await adminRequest(baseUrl, serviceKey, "/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name },
      }),
    });
    if (!created.ok) {
      fail(`Could not create the account: ${describeError(created.body, created.status)}`);
    }
    userId = created.body.id;
    action = "created";
  }

  console.log("→ Saving the admin profile…");
  const profile = await adminRequest(
    baseUrl,
    serviceKey,
    "/rest/v1/profiles?on_conflict=user_id",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([
        {
          user_id: userId,
          full_name: name,
          email: email.toLowerCase(),
          role: "admin",
        },
      ]),
    },
  );
  if (!profile.ok) {
    fail(
      `The account exists but the admin profile could not be saved: ${describeError(
        profile.body,
        profile.status,
      )}\nRun supabase/admin-dashboard.sql first if the profiles.email column is missing.`,
    );
  }

  console.log(`
✔ Administrator ${action}: ${email}
  Name: ${name}
  User: ${userId}

Next:
  1. Start the app (npm run dev) and sign in with this email and password.
  2. You will land on /admin.
`);
}

main().catch((error) => {
  console.error("\n✖ Unexpected error:", error.message ?? error);
  process.exit(1);
});
