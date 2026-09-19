import { resolveProject } from "./core/project.ts";

const [command, value] = Deno.args;

if (command === "resolve" && value) {
  console.log(JSON.stringify(resolveProject(value), null, 2));
} else {
  console.log("orochi <resolve|open|group>");
}
