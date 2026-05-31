/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ExtractedDependency {
  name: string;
  version: string;
  type: string; // e.g., 'npm', 'pip', 'apt', 'system'
}

export interface EnvironmentVariable {
  key: string;
  value: string;
}

export interface BlueprintFile {
  filename: string;
  language: string; // e.g. dockerfile, ruby, nix, bash, yaml
  content: string;
  explanation: string;
}

export interface ParsedBugReport {
  title: string;
  githubRepo?: string;
  githubIssueNumber?: string;
  systemOs: string;     // e.g. macOS, Ubuntu Linux, Windows, Alpine Linux
  systemVersion: string; // e.g. 22.04, 14 (Sonoma), 11, etc.
  runtimeLanguage: string; // e.g. Node.js, Python, Ruby, Go, Rust, Java
  runtimeVersion: string; // e.g. 18.20.0, 3.11.2, etc.
  browser: string;       // e.g. Chrome 124, Firefox, Safari, N/A
  dependencies: ExtractedDependency[];
  envVariables: EnvironmentVariable[];
  reproduceSteps: string[]; // shell commands or actions
  testScript: {
    filename: string;
    content: string;
    language: string;
  } | null;
  blueprints: {
    docker: BlueprintFile;
    vagrant: BlueprintFile;
    nix: BlueprintFile;
    codespace: BlueprintFile;
  };
  confidence: "High" | "Medium" | "Low";
  parsingErrors: string[];
  summary: string;
}

export interface SimulationStep {
  id: string;
  type: "info" | "success" | "warning" | "error" | "command";
  message: string;
  timestamp: string;
}
