#!/usr/bin/env node
/**
 * Lightweight post-start smoke: /api/health and optionally /es.
 * Usage: SITE_URL=https://example.com node scripts/smoke.mjs
 * Default base: http://localhost:3000
 */

const base = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);

async function check(path, { expectJson } = {}) {
  const url = `${base}${path}`;
  const res = await fetch(url, { redirect: "follow" });
  const ok = res.ok;
  let detail = `${res.status}`;
  if (expectJson) {
    const body = await res.json().catch(() => null);
    if (!body || body.ok !== true) {
      throw new Error(`${url} → expected { ok: true }, got ${JSON.stringify(body)} (${detail})`);
    }
    detail = JSON.stringify(body);
  }
  if (!ok) throw new Error(`${url} → HTTP ${detail}`);
  console.log(`ok  ${path}  ${detail}`);
}

async function main() {
  console.log(`smoke → ${base}`);
  await check("/api/health", { expectJson: true });
  try {
    await check("/es");
  } catch (err) {
    console.warn(`warn ${err instanceof Error ? err.message : err}`);
  }
  console.log("smoke passed");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
