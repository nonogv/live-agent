import { describe, it, expect, afterEach } from "vitest";
import { Storage } from "./storage.js";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const tmpDirs: string[] = [];

function makeStorage(): Storage {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "live-agent-test-"));
  tmpDirs.push(dir);
  return new Storage(dir);
}

function makeStorageAt(dir: string): Storage {
  return new Storage(dir);
}

afterEach(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
  tmpDirs.length = 0;
});

describe("Storage — API keys", () => {
  it("returns undefined for an unset provider key", () => {
    const s = makeStorage();
    expect(s.getApiKey("openai")).toBeUndefined();
    expect(s.getApiKey("anthropic")).toBeUndefined();
    expect(s.getApiKey("gemini")).toBeUndefined();
  });

  it("sets and gets an API key", () => {
    const s = makeStorage();
    s.setApiKey("openai", "sk-test-123");
    expect(s.getApiKey("openai")).toBe("sk-test-123");
  });

  it("sets keys for multiple providers independently", () => {
    const s = makeStorage();
    s.setApiKey("openai", "sk-openai");
    s.setApiKey("gemini", "AIza-gemini");
    expect(s.getApiKey("openai")).toBe("sk-openai");
    expect(s.getApiKey("gemini")).toBe("AIza-gemini");
    expect(s.getApiKey("anthropic")).toBeUndefined();
  });

  it("overwrites an existing key", () => {
    const s = makeStorage();
    s.setApiKey("openai", "sk-old");
    s.setApiKey("openai", "sk-new");
    expect(s.getApiKey("openai")).toBe("sk-new");
  });
});

describe("Storage — persistence", () => {
  it("persists a key to disk and reloads it on next instantiation", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "live-agent-test-"));
    tmpDirs.push(dir);

    const s1 = makeStorageAt(dir);
    s1.setApiKey("gemini", "AIza-persistent");

    const s2 = makeStorageAt(dir);
    expect(s2.getApiKey("gemini")).toBe("AIza-persistent");
  });

  it("persists defaults to disk and reloads them", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "live-agent-test-"));
    tmpDirs.push(dir);

    const s1 = makeStorageAt(dir);
    s1.setDefaults("anthropic", "claude-opus-4-8");

    const s2 = makeStorageAt(dir);
    expect(s2.getDefaultProvider()).toBe("anthropic");
    expect(s2.getDefaultModel()).toBe("claude-opus-4-8");
  });

  it("returns default settings when no file exists", () => {
    const s = makeStorage();
    expect(s.getDefaultProvider()).toBe("openai");
    expect(s.getDefaultModel()).toBe("gpt-4o-mini");
  });
});

describe("Storage — defaults", () => {
  it("sets and gets default provider and model", () => {
    const s = makeStorage();
    s.setDefaults("gemini", "gemini-3.5-flash");
    expect(s.getDefaultProvider()).toBe("gemini");
    expect(s.getDefaultModel()).toBe("gemini-3.5-flash");
  });
});

describe("Storage — masked keys", () => {
  it("returns empty strings for all unset keys", () => {
    const s = makeStorage();
    const masked = s.getMaskedKeys();
    expect(masked.openai).toBe("");
    expect(masked.anthropic).toBe("");
    expect(masked.gemini).toBe("");
  });

  it("returns a mask for set keys and empty string for unset", () => {
    const s = makeStorage();
    s.setApiKey("openai", "sk-very-secret");
    const masked = s.getMaskedKeys();
    expect(masked.openai).toBe("••••••••");
    expect(masked.anthropic).toBe("");
    expect(masked.gemini).toBe("");
  });

  it("masks all three providers when all are set", () => {
    const s = makeStorage();
    s.setApiKey("openai", "sk-a");
    s.setApiKey("anthropic", "sk-b");
    s.setApiKey("gemini", "sk-c");
    const masked = s.getMaskedKeys();
    expect(masked.openai).toBe("••••••••");
    expect(masked.anthropic).toBe("••••••••");
    expect(masked.gemini).toBe("••••••••");
  });
});
