import { describe, it, expect } from "vitest";
import { isSafePublicUrl } from "./ssrf.js";

describe("isSafePublicUrl", () => {
  it("blocks loopback, private, and metadata addresses", async () => {
    expect(await isSafePublicUrl("http://localhost/x")).toBe(false);
    expect(await isSafePublicUrl("http://127.0.0.1/x")).toBe(false);
    expect(await isSafePublicUrl("http://10.0.0.5/x")).toBe(false);
    expect(await isSafePublicUrl("http://192.168.1.1/x")).toBe(false);
    expect(await isSafePublicUrl("http://172.16.0.1/x")).toBe(false);
    expect(await isSafePublicUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(await isSafePublicUrl("http://[::1]/x")).toBe(false);
  });

  it("blocks non-http schemes and internal-looking hosts", async () => {
    expect(await isSafePublicUrl("file:///etc/passwd")).toBe(false);
    expect(await isSafePublicUrl("ftp://example.com")).toBe(false);
    expect(await isSafePublicUrl("http://db.internal/x")).toBe(false);
    expect(await isSafePublicUrl("http://printer.local/x")).toBe(false);
    expect(await isSafePublicUrl("not a url")).toBe(false);
  });

  it("allows a public IP literal", async () => {
    expect(await isSafePublicUrl("https://8.8.8.8/x")).toBe(true);
  });
});
