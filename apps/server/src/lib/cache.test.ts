import test from "node:test";
import assert from "node:assert/strict";
import { AppCache } from "./cache.js";

test("AppCache stores and expires values in memory mode", async () => {
  let now = 1_000;
  const cache = new AppCache({
    useRedis: false,
    now: () => now
  });

  await cache.set("key", { ok: true }, 500);
  assert.deepEqual(await cache.get("key"), { ok: true });

  now += 1_100;
  assert.equal(await cache.get("key"), null);
});

test("AppCache getOrSet caches factory output", async () => {
  const cache = new AppCache({ useRedis: false });
  let calls = 0;

  const first = await cache.getOrSet("expensive", 1_000, async () => {
    calls += 1;
    return { value: "A" };
  });
  const second = await cache.getOrSet("expensive", 1_000, async () => {
    calls += 1;
    return { value: "B" };
  });

  assert.deepEqual(first, { value: "A" });
  assert.deepEqual(second, { value: "A" });
  assert.equal(calls, 1);
});

test("AppCache delByPrefix removes matching entries", async () => {
  const cache = new AppCache({ useRedis: false });
  await cache.set("wf:list", [1], 5_000);
  await cache.set("wf:detail:1", { id: "1" }, 5_000);
  await cache.set("other", true, 5_000);

  await cache.delByPrefix("wf:");
  assert.equal(await cache.get("wf:list"), null);
  assert.equal(await cache.get("wf:detail:1"), null);
  assert.equal(await cache.get("other"), true);
});
