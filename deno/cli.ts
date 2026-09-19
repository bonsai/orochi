import type { Session } from "./core/types.ts";

const DEFAULT_PORT = Number(Deno.env.get("OROCHI_PORT") || 8787);

function baseUrl(): string {
  const idx = Deno.args.indexOf("--port");
  const port = idx >= 0 && Deno.args[idx + 1]
    ? Number(Deno.args[idx + 1])
    : DEFAULT_PORT;
  return `http://127.0.0.1:${port}`;
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

  --port <n>   override runtime port`);
  Deno.exit(0);
}

const [command, sub, value] = Deno.args.filter((a) => !a.startsWith("--"));

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
  default:
    usage();
}