import { assert, assertEquals } from "jsr:@std/assert";
import { createHandler } from "./api.ts";
import { SessionStore, SESSION_CAP } from "./core/store.ts";
import { makeTools } from "./mcp.ts";
import { api } from "./http.ts";

function newTempStore(): SessionStore {
  const dir = Deno.makeTempDirSync();
  return new SessionStore(`${dir}/sessions.json`);
}

function startServer(store: SessionStore): Promise<{
  base: string;
  stop: () => void;
}> {
  const { handler } = createHandler(store);
  return new Promise((resolve) => {
    const server = Deno.serve(
      {
        port: 0,
        onListen: ({ port }) =>
          resolve({
            base: `http://127.0.0.1:${port}`,
            stop: () => server.shutdown(),
          }),
      },
      handler,
    );
  });
}

Deno.test("CLI / MCP / CRX が同じ Session を扱う（cross-interface consistency）", async () => {
  const server = await startServer(newTempStore());

  // CLI 相当: POST /sessions
  const viaCli = (await api(server.base, "/sessions", "POST", {
    url: "https://github.com/bonsai/orochi",
  })) as { id: string; project: { repo: string }; engine: string };
  assertEquals(viaCli.id, "s1");
  assertEquals(viaCli.project.repo, "bonsai/orochi");
  assertEquals(viaCli.engine, "chatgpt"); // engine 既定値

  // engine 指定で suno セッションを作る
  const viaCli2 = (await api(server.base, "/sessions", "POST", {
    url: "https://github.com/bonsai/orochi",
    engine: "suno",
  })) as { id: string; engine: string };
  assertEquals(viaCli2.id, "s2");
  assertEquals(viaCli2.engine, "suno");

  // MCP 相当: tools で同一リストが見える
  const tools = makeTools(server.base);
  const viaMcp = (await tools.session_list()) as Array<{ id: string; engine?: string }>;
  assertEquals(viaMcp.length, 2);
  assertEquals(viaMcp[0].id, "s1");

  // MCP 相当: 3つ目を開く → cli 側からも s3 として見える
  const viaMcp2 = (await tools.session_open(
    "https://github.com/bonsai/gh-obs-crx",
  )) as { id: string };
  assertEquals(viaMcp2.id, "s3");
  assertEquals(((await api(server.base, "/sessions")) as unknown[]).length, 3);

  // CRX 相当: browser op を enqueue → poll (GET) で drain され空になる
  const queued = (await api(server.base, "/browser/commands", "POST", {
    op: { kind: "open", sessionId: "s1", urls: ["https://github.com/bonsai/orochi/issues"] },
  })) as { queued: number };
  assertEquals(queued.queued, 1);
  const drained = (await api(server.base, "/browser/commands")) as unknown[];
  assertEquals(drained.length, 1);
  assertEquals(
    ((await api(server.base, "/browser/commands")) as unknown[]).length,
    0,
  );

  server.stop();
});

Deno.test("snapshot 永続: 再生成 store で復元される", () => {
  const store = newTempStore();
  store.create("https://github.com/bonsai/orochi");
  store.create("https://github.com/bonsai/gh-obs-crx");

  const reloaded = new SessionStore(store.path);
  reloaded.load();
  assertEquals(reloaded.list().length, 2);
  assertEquals(reloaded.list()[0].id, "s1");
});

Deno.test("上限 8: 満杯時はエラー", () => {
  const store = newTempStore();
  for (let i = 1; i <= SESSION_CAP; i++) {
    store.create(`https://github.com/owner/repo${i}`);
  }
  assert(store.list().length === 8);
  let threw = false;
  try {
    store.create("https://github.com/owner/repo9");
  } catch (error) {
    threw = /full/.test(String(error));
  }
  assert(threw, "9番目のセッションは拒否されるべき");
});