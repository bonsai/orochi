import { api, ApiError } from "./http.ts";

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

async function call(path: string, method = "GET", body?: unknown) {
  try {
    return await api(baseUrl(), path, method, body);
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`${error.status}: ${error.message}`);
    } else {
      console.error(String(error));
    }
    Deno.exit(1);
  }
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
    console.log(JSON.stringify(await call("/resolve", "POST", { url: value }), null, 2));
    break;
  }
  case "session open": {
    if (!value) usage();
    console.log(JSON.stringify(await call("/sessions", "POST", { url: value }), null, 2));
    break;
  }
  case "session ls": {
    const sessions = (await call("/sessions")) as { id: string; project: { repo: string }; status: string; tabGroupId?: number; lastActiveAt: number }[];
    for (const s of sessions) {
      console.log(
        `${s.id}\t${s.project.repo}\t${s.status}\t${s.tabGroupId ?? "-"}\t${s.lastActiveAt}`,
      );
    }
    break;
  }
  case "session close": {
    if (!value) usage();
    console.log(JSON.stringify(await call(`/sessions/${value}`, "DELETE")));
    break;
  }
  case "session focus": {
    if (!value) usage();
    console.log(JSON.stringify(await call(`/sessions/${value}`), null, 2));
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
    console.log(JSON.stringify(await call("/browser/commands", "POST", { op })));
    break;
  }
  default:
    usage();
}