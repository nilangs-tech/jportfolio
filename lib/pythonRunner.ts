import "server-only";
import { spawn } from "child_process";
import { serverConfig } from "./config";

export interface PythonResult { ok: boolean; code: number; stdout: string; stderr: string; }

/**
 * Run a Python script (the existing reconciliation engine in the vault tools folder).
 * The PYTHON_BIN env var selects the interpreter. Used only in local mode.
 */
export function runPython(scriptPath: string, args: string[] = [], cwd?: string): Promise<PythonResult> {
  return new Promise((resolve) => {
    let stdout = "", stderr = "";
    try {
      const child = spawn(serverConfig.pythonBin, [scriptPath, ...args], { cwd, windowsHide: true });
      child.stdout.on("data", (d) => (stdout += d.toString()));
      child.stderr.on("data", (d) => (stderr += d.toString()));
      child.on("error", (e) => resolve({ ok: false, code: -1, stdout, stderr: stderr + String(e) }));
      child.on("close", (code) => resolve({ ok: code === 0, code: code ?? -1, stdout, stderr }));
    } catch (e) {
      resolve({ ok: false, code: -1, stdout, stderr: String(e) });
    }
  });
}
