import type { StrikerTool } from "../types";

/** No-op tool (safe default) */
export const NoopTool: StrikerTool<{ note?: string }, { note?: string }> = {
  name: "noop",
  description: "Do nothing and succeed.",
  async call(input) {
    return { ok: true, output: { note: input?.note } };
  },
};

/** Stub “command exec” tool – echoes command only */
export const CmdExecTool: StrikerTool<
  { cmd: string; args?: string[] },
  { cmd: string; args?: string[] }
> = {
  name: "cmd.exec",
  description: "Stub: echoes the command instead of executing it.",
  async call(input) {
    return { ok: true, output: { cmd: input.cmd, args: input.args ?? [] } };
  },
};

/** Stub “file.read” – returns placeholder content */
export const FileReadTool: StrikerTool<
  { path: string },
  { path: string; content: string }
> = {
  name: "file.read",
  description: "Stub: returns placeholder content (no filesystem access).",
  async call(input) {
    return {
      ok: true,
      output: { path: input.path, content: "// stub file content" },
    };
  },
};

// small UTF-8 byte length helper (no Node Buffer)
function utf8ByteLength(str: string): number {
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      i++;
      bytes += 4;
    } else bytes += 3;
  }
  return bytes;
}

/** Stub “file.write” – does NOT write, just returns byte length */
export const FileWriteTool: StrikerTool<
  { path: string; content: string },
  { path: string; bytes: number }
> = {
  name: "file.write",
  description: "Stub: pretends to write content and returns byte length.",
  async call(input) {
    const bytes = utf8ByteLength(input.content ?? "");
    return { ok: true, output: { path: input.path, bytes } };
  },
};
