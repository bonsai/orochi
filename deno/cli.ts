import type { Session } from "./core/types.ts";

const DEFAULT_PORT = Number(Deno.env.get("OROCHI_PORT") || 8787);

function parseArgs(): { port: number; positional: string[] } {
  const raw = Deno.args.slice();
  let port = DEFAULT_PORT;
  const positional: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a === "--port") {
      port = Number(raw[i + 1]);
      i += 1;
      continue;
    }
    if (a.startsWith("--port=")) {
      port = Number(a.slice(7));
      continue;
    }
    positional.push(a);
  }
  return { port, positional };
}

function baseUrl(): string {
  return `http://127.0.0.1:${parseArgs().port}`;
}

async function api(path: string, method = "GET", body?: unknown) {
  const res = await fetch(baseUrl() + path, {
    method,
    headers: body !== undefined
      ? { "content-type": "application/json" }
      : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`${res.status}: ${text}`);
    Deno.exit(1);
  }
  return text ? JSON.parse(text) : null;
}

function usage(): never {
  console.log(`orochi — CLI (talks to local runtime :${DEFAULT_PORT})

  orochi resolve <url>
  orochi session open <url>
  orochi session ls
  orochi session close <id>
  orochi session focus <id>
  orochi browser open <id> [url...]   # CLI → runtime → CRX でブラウザ操作
  orochi browser group <id>
  orochi browser focus <id>
  orochi browser close <id>

  --port <n>   override runtime port`);
  Deno.exit(0);
}

const { positional } = parseArgs();
const [command, sub, value] = positional;

switch (`${command} ${sub ?? ""}`) {
  case "resolve": {
    if (!value) usage();
    const project = await api("/resolve", "POST", { url: value });
    console.log(JSON.stringify(project, null, 2));
    break;
  }
  case "session open": {
    if (!value) usage();
    const session = await api("/sessions", "POST", { url: value });
    console.log(JSON.stringify(session, null, 2));
    break;
  }
  case "session ls": {
    const sessions = (await api("/sessions")) as Session[];
    for (const s of sessions) {
      console.log(
        `${s.id}\t${s.project.repo}\t${s.status}\t${s.tabGroupId ?? "-"}\t${s.lastActiveAt}`,
      );
    }
    break;
  }
  case "session close": {
    if (!value) usage();
    console.log(JSON.stringify(await api(`/sessions/${value}`, "DELETE")));
    break;
  }
  case "session focus": {
    if (!value) usage();
    const session = await api(`/sessions/${value}`);
    console.log(JSON.stringify(session, null, 2));
    break;
  }
  case "browser open":
  case "browser group":
  case "browser focus":
  case "browser close": {
    if (!value) usage();
    const urls = positional.slice(positional.indexOf(value) + 1);
    const op: Record<string, unknown> = { kind: sub, sessionId: value };
    if (urls.length) op.urls = urls;
    console.log(JSON.stringify(await api("/browser/commands", "POST", { op })));
    break;
  }
  default:
    usage();
}