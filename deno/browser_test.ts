import { assertEquals, assertThrows } from "jsr:@std/assert";
import { browserBackend } from "./browser.ts";

Deno.test("browser backend defaults to CDP and accepts supported adapters", () => {
  assertEquals(browserBackend(undefined), "cdp");
  assertEquals(browserBackend("cdp"), "cdp");
  assertEquals(browserBackend("ws"), "ws");
  assertEquals(browserBackend("crx"), "crx");
});

Deno.test("browser backend rejects unknown adapter names", () => {
  assertThrows(() => browserBackend("selenium"), Error, "unsupported browser backend");
});
