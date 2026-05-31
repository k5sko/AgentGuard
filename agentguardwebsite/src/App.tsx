/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from "react";
import { 
  GitFork, 
  Terminal, 
  Layers, 
  Bot, 
  Sparkles, 
  Send, 
  Cpu, 
  HelpCircle, 
  FileText, 
  Key, 
  History,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { ParsedBugReport } from "./types";
import { PRESET_ISSUES, PresetIssue } from "./data/mockIssues";
import { PRESET_ANALYSES, generateOfflineCustomAnalysis } from "./utils/fallbackParser";

import MetricCards from "./components/MetricCards";
import BlueprintViewer from "./components/BlueprintViewer";
import TerminalSimulator from "./components/TerminalSimulator";
import ArchitectureGuide from "./components/ArchitectureGuide";

export default function App() {
  const [selectedPresetId, setSelectedPresetId] = useState<string>("uuid-postgres-django");
  const [customTitle, setCustomTitle] = useState<string>("");
  const [customDescription, setCustomDescription] = useState<string>("");
  const [report, setReport] = useState<ParsedBugReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState<boolean>(true);

  // GitHub URL Importer States
  const [inputTab, setInputTab] = useState<"presets" | "github" | "manual">("presets");
  const [githubUrl, setGithubUrl] = useState<string>("");
  const [fetchingGitHub, setFetchingGitHub] = useState<boolean>(false);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [currentGitRepo, setCurrentGitRepo] = useState<string>("");
  const [currentGitIssueNum, setCurrentGitIssueNum] = useState<string>("");

  // API Reproduction States (POST /api/reproduce)
  const [apiReproductionUrl, setApiReproductionUrl] = useState<string>("https://github.com/django/django/issues/423");
  const [loadingReproduction, setLoadingReproduction] = useState<boolean>(false);
  const [reproductionResult, setReproductionResult] = useState<any | null>(null);
  const [reproductionError, setReproductionError] = useState<string | null>(null);

  // Initialize with the first preset's detailed analysis
  useEffect(() => {
    if (inputTab === "presets" && PRESET_ANALYSES[selectedPresetId]) {
      setReport(PRESET_ANALYSES[selectedPresetId]);
      setUsingFallback(true);
      setApiKeyError(null);
    }
  }, [selectedPresetId, inputTab]);

  const handleSelectPreset = (id: string) => {
    setInputTab("presets");
    setIsCustomMode(false);
    setSelectedPresetId(id);
    setCustomTitle("");
    setCustomDescription("");
    setCurrentGitRepo("");
    setCurrentGitIssueNum("");

    // Sync API Reproduction URL too for easier testing
    if (id === "uuid-postgres-django") {
      setApiReproductionUrl("https://github.com/django/django/issues/423");
    } else if (id === "legacy-node-safari") {
      setApiReproductionUrl("https://github.com/vitejs/vite/issues/3210");
    } else if (id === "go-oom-alpine") {
      setApiReproductionUrl("https://github.com/golang/go/issues/1215");
    } else if (id === "fastapi-redis-cache") {
      setApiReproductionUrl("https://github.com/fastapi/fastapi/issues/1000");
    }
  };

  const executeAnalysis = async (
    e?: FormEvent,
    overrideTitle?: string,
    overrideDesc?: string,
    overrideRepo?: string,
    overrideNum?: string
  ) => {
    if (e) e.preventDefault();

    const titleVal = overrideTitle !== undefined ? overrideTitle : customTitle;
    const descVal = overrideDesc !== undefined ? overrideDesc : customDescription;
    const repoVal = overrideRepo !== undefined ? overrideRepo : currentGitRepo;
    const numVal = overrideNum !== undefined ? overrideNum : currentGitIssueNum;

    if (!descVal.trim()) return;

    setLoading(true);
    setApiKeyError(null);

    const titleToSend = titleVal.trim() || "Analyzed Live Issue Report";
    const bodyToSend = descVal.trim();

    try {
      const response = await fetch("/api/parse-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueTitle: titleToSend,
          issueDescription: bodyToSend,
          githubRepo: repoVal,
          githubIssueNumber: numVal
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === "GEMINI_API_KEY_MISSING") {
          // Fall back gracefully with local custom analysis engine
          const localMockReport = generateOfflineCustomAnalysis(titleToSend, bodyToSend, repoVal, numVal);
          setReport(localMockReport);
          setApiKeyError("No custom API key configured. Utilizing local offline parameter parsing to synthesize blueprints.");
          setUsingFallback(true);
        } else {
          throw new Error(data.message || "Failed to analyze bug report from server.");
        }
      } else {
        // True live Gemini results success!
        setReport(data);
        setUsingFallback(false);
        setApiKeyError(null);
      }
    } catch (err: any) {
      console.warn("Backend API issue, running local offline synthesis fallback:", err);
      const localMockReport = generateOfflineCustomAnalysis(titleToSend, bodyToSend, repoVal, numVal);
      setReport(localMockReport);
      setApiKeyError(`Connecting error: Using local synthesis pipeline to generate blueprints.`);
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchAndAnalyze = async () => {
    if (!githubUrl.trim()) return;

    setFetchingGitHub(true);
    setGithubError(null);
    setReport(null);

    try {
      const response = await fetch("/api/fetch-github-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: githubUrl })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to fetch GitHub issue.");
      }

      // Success! Update custom input states
      setCustomTitle(data.title);
      setCustomDescription(data.body);
      setCurrentGitRepo(data.repo);
      setCurrentGitIssueNum(data.number);
      setApiReproductionUrl(githubUrl); // Sync reproduction url!

      // Programmatically trigger Gemini analysis using the fetched issue parameters
      await executeAnalysis(undefined, data.title, data.body, data.repo, data.number);

    } catch (err: any) {
      console.error("Error fetching GitHub issue:", err);
      setGithubError(err.message || "An error occurred while fetching the issue from GitHub API.");
    } finally {
      setFetchingGitHub(false);
    }
  };

  const handleTriggerReproductionApi = async () => {
    if (!apiReproductionUrl.trim()) return;

    setLoadingReproduction(true);
    setReproductionResult(null);
    setReproductionError(null);

    try {
      const res = await fetch("/api/reproduce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: apiReproductionUrl })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to parse and reproduce issue.");
      }

      setReproductionResult(data);
    } catch (err: any) {
      console.error("API Reproduction Failed:", err);
      setReproductionError(err.message || "Failed to execute reproduction pipeline.");
    } finally {
      setLoadingReproduction(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-200 antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Top Banner with Glow Header */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600/10 border border-indigo-500/20 w-10 h-10 rounded-xl flex items-center justify-center text-indigo-400 shadow-md shadow-indigo-900/10">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-white p-0 m-0">Bug Environment Parser</h1>
                <span className="bg-emerald-950/40 border border-emerald-900/50 text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                  v1.2 - Prototyping Active
                </span>
              </div>
              <p className="text-slate-400 text-[11px] font-mono mt-0.5">Automated Docker / Vagrant Blueprint Synthesizer</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-400 hidden sm:inline-block">API Sync:</span>
            <div className={`px-2.5 py-1 rounded border flex items-center gap-1.5 font-mono ${
              usingFallback 
                ? "bg-slate-950/80 border-slate-800/80 text-amber-400" 
                : "bg-emerald-950/20 border-emerald-900/40 text-emerald-400"
            }`}>
              <Bot className="w-3.5 h-3.5" />
              <span>{usingFallback ? "Playground fallback" : "Gemini AI Active"}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Core Question & App Context Header */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <GitFork className="w-48 h-48 text-indigo-400" />
          </div>
          <div className="max-w-3xl">
            <div className="flex items-center gap-1.5 text-indigo-400 font-mono text-xs font-semibold uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" />
              Developer Question Addressed
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white mt-2 leading-snug">
              "Can we expose an API endpoint that fetches any GitHub issue URL, spins up an isolated sandbox, and replies with a boolean True/False indicating if the bug was successfully reproduced?"
            </h2>
            <p className="text-slate-400 text-sm mt-3 leading-relaxed">
              Yes! By exposing the custom endpoint <code className="text-emerald-400 bg-slate-950 px-1.5 py-0.5 rounded font-mono font-semibold">POST /api/reproduce</code>, developers can send any public GitHub URL. The backend leverages <strong className="text-indigo-300">Gemini 3.5</strong> and local sandbox virtualization to spin up codebases, execute reproduction traces, and return standard JSON containing a strict <code className="text-indigo-400 font-mono">"reproduced": true/false</code> verification boolean.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <a href="#terminal-simulator" className="bg-indigo-600/10 text-indigo-300 hover:bg-indigo-600/20 border border-indigo-900/30 px-3.5 py-1.5 rounded-lg font-medium transition-all">
                Try VM Simulator ↓
              </a>
              <a href="#architecture-guide" className="bg-slate-800/50 text-slate-300 hover:bg-slate-800 border border-slate-700/50 px-3.5 py-1.5 rounded-lg font-medium transition-all">
                Read SysOps Blueprint Guide →
              </a>
            </div>
          </div>
        </div>

        {/* Outer Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                 {/* LEFT PANEL: Bug Report Input Workspace (Lg: 5/12 columns) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3.5 mb-4">
                <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  Select & Test Bug Reports
                </h3>
                <span className="text-[10px] bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono uppercase font-semibold">
                  Source Control
                </span>
              </div>

              {/* Segmented Tab Switcher */}
              <div className="flex p-1 bg-slate-950 border border-slate-800/80 rounded-lg mb-5">
                <button
                  onClick={() => {
                    setInputTab("presets");
                    setApiKeyError(null);
                  }}
                  className={`flex-1 text-center py-1.5 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider transition-all duration-150 ${
                    inputTab === "presets"
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-950/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Presets
                </button>
                <button
                  onClick={() => {
                    setInputTab("github");
                    setApiKeyError(null);
                  }}
                  className={`flex-1 text-center py-1.5 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider transition-all duration-150 ${
                    inputTab === "github"
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-950/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  GitHub URL
                </button>
                <button
                  onClick={() => {
                    setInputTab("manual");
                    setApiKeyError(null);
                  }}
                  className={`flex-1 text-center py-1.5 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider transition-all duration-150 ${
                    inputTab === "manual"
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-950/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Manual Paste
                </button>
              </div>

              {/* Tab Content 1: Presets list */}
              {inputTab === "presets" && (
                <div className="space-y-2.5 animate-fadeIn">
                  {PRESET_ISSUES.map((issue) => (
                    <button
                      key={issue.id}
                      onClick={() => handleSelectPreset(issue.id)}
                      className={`w-full text-left p-3.5 rounded-lg border text-xs transition-all flex flex-col justify-between hover:bg-slate-800/30 hover:border-slate-700 group ${
                        selectedPresetId === issue.id
                          ? "bg-indigo-950/35 border-indigo-800/60 shadow-lg"
                          : "bg-slate-950/70 border-slate-800/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={`font-semibold text-xs leading-snug group-hover:text-indigo-400 transition-colors ${
                          selectedPresetId === issue.id ? "text-indigo-300" : "text-slate-200"
                        }`}>
                          {issue.title}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-3 text-xxs font-mono text-slate-500 border-t border-slate-800/40 pt-2">
                        <span>repo: {issue.repo}</span>
                        <span>{issue.createdAt}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Tab Content 2: Live GitHub URL importer */}
              {inputTab === "github" && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-lg text-xxs font-mono text-slate-400 space-y-1.5 leading-relaxed">
                    <p className="font-semibold text-slate-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-400" />
                      Automatic Repo Isolation
                    </p>
                    <p>
                      Paste any public GitHub issue URL. We will live-fetch its details via server-side API proxy, parse the codebase dependencies, and customize blueprints targeted towards isolating and mimicking that exact repository structure!
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xxs font-mono font-bold tracking-wider text-slate-400 uppercase">
                      GitHub Issue URL
                    </label>
                    <div className="relative">
                      <input
                        type="url"
                        value={githubUrl}
                        onChange={(e) => {
                          setGithubUrl(e.target.value);
                          setGithubError(null);
                        }}
                        placeholder="e.g. https://github.com/django/django/issues/12345"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-600 transition-colors font-mono"
                      />
                      <GitFork className="w-4 h-4 text-slate-600 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                    {githubError && (
                      <p className="text-xxs text-rose-400 font-mono flex items-center gap-1 pt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {githubError}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={handleFetchAndAnalyze}
                    disabled={fetchingGitHub || !githubUrl.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed hover:border-indigo-400 text-white font-semibold font-mono text-xs px-4 py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/10"
                  >
                    {fetchingGitHub ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-slate-100 border-t-transparent rounded-full animate-spin"></div>
                        <span>Retrieving GitHub parameters...</span>
                      </>
                    ) : (
                      <>
                        <Bot className="w-3.5 h-3.5" />
                        <span>Isolate & Build blueprints</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Tab Content 3: Manual raw copy & paste */}
              {inputTab === "manual" && (
                <form onSubmit={(e) => executeAnalysis(e)} className="space-y-4 animate-fadeIn">
                  <div>
                    <label className="block text-xxs font-mono font-bold tracking-wider text-slate-400 uppercase mb-1.5">
                      1. Issue Title or Summary
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Django Raw SQL breaks under UUID types"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-600 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xxs font-mono font-bold tracking-wider text-slate-400 uppercase mb-1.5">
                      2. Paste Bug/Issue Description (Include OS and code where possible)
                    </label>
                    <textarea
                      required
                      rows={8}
                      placeholder={`Paste reporter logs or instructions here:
OS: macOS Sonoma 14
Language: Python 3.11
Dependencies: requests==2.31.0
Steps: Execute pip install and load requests.`}
                      value={customDescription}
                      onChange={(e) => setCustomDescription(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white placeholder-slate-600 font-mono focus:outline-none focus:border-indigo-600 transition-colors resize-y leading-relaxed"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !customDescription.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed hover:border-indigo-400 text-white font-semibold font-mono text-xs px-4 py-2.5 rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-slate-100 border-t-transparent rounded-full animate-spin"></div>
                        <span>Analyzing & Structuring environments...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Synthesize Replica blueprints</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
            
            {/* Environment Credentials notice if configured fallbacks */}
            {apiKeyError && (
              <div className="bg-amber-950/20 border border-amber-900/40 p-4 rounded-xl text-xs flex gap-3 text-slate-200">
                <Key className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-300">Playground Sandbox Active</p>
                  <p className="text-slate-400 leading-relaxed text-xxs">
                    To trigger live, custom, fully parsed AI analyzes on arbitrary issue descriptions, set up a real key in the <strong>Settings &gt; Secrets</strong> panel. For now, enjoy full high-fidelity blueprint generation on preset systems!
                  </p>
                </div>
              </div>
            )}

            {/* API Bug Reproducer Playground Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4" />
                  API REPRODUCTION SANDBOX
                </h3>
                <span className="text-[9px] bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold">
                  POST /api/reproduce
                </span>
              </div>
              
              <p className="text-slate-400 text-xxs leading-relaxed font-sans">
                Test the newly added reproduction pipeline endpoint. Input any public GitHub issue URL to attempt virtualization mimicking, and get a structured result back containing a boolean status (True/False) signaling success.
              </p>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-slate-400 font-semibold block">
                  GitHub Issue URL to Reproduce
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={apiReproductionUrl}
                    onChange={(e) => setApiReproductionUrl(e.target.value)}
                    placeholder="e.g. https://github.com/django/django/issues/423"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xxs text-white placeholder-slate-700 font-mono focus:outline-none focus:border-emerald-600 transition-colors"
                  />
                  <button
                    onClick={handleTriggerReproductionApi}
                    disabled={loadingReproduction || !apiReproductionUrl.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed hover:border-emerald-400 text-white font-semibold font-mono text-[10px] px-3.5 rounded-lg transition-all flex items-center gap-1 shadow-md shrink-0"
                  >
                    {loadingReproduction ? "Running..." : "Test Bug"}
                  </button>
                </div>
              </div>

              {reproductionError && (
                <div className="bg-rose-950/20 border border-rose-900/30 p-2.5 rounded-lg text-xxs font-mono text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 opacity-90" />
                  <span>{reproductionError}</span>
                </div>
              )}

              {reproductionResult && (
                <div className="space-y-3 animate-fadeIn border-t border-slate-800/60 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-slate-400">Reproduction Status:</span>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded border uppercase shrink-0 ${
                      reproductionResult.reproduced
                        ? "bg-emerald-950/60 border-emerald-800 text-emerald-400"
                        : "bg-rose-950/60 border-rose-800 text-rose-400"
                    }`}>
                      {reproductionResult.reproduced ? (
                        <>
                          <CheckCircle className="w-3" />
                          True - Succeeded
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3" />
                          False - Failed
                        </>
                      )}
                    </span>
                  </div>

                  <p className="text-xxs text-slate-300 bg-slate-950/50 border border-slate-800/40 p-2 rounded-lg leading-relaxed">
                    <strong>Sandbox response:</strong> {reproductionResult.message}
                  </p>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 uppercase tracking-widest">
                      <span>Live container virtualization logs</span>
                      <span className="text-emerald-500">EXIT_CODE: {reproductionResult.reproduced ? 1 : 0}</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-mono text-[9px] text-slate-300 overflow-x-auto max-h-36 space-y-1">
                      {reproductionResult.logs && reproductionResult.logs.map((log: string, idx: number) => (
                        <div key={idx} className="whitespace-pre">
                          <span className="text-slate-600 select-none mr-2">[{idx + 1}]</span>
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/80 space-y-1 font-mono text-[9px] text-slate-400">
                    <div className="text-[8px] text-slate-500 uppercase font-black">Raw API JSON Payload Returned</div>
                    <pre className="text-indigo-300 overflow-x-auto text-[8px] whitespace-pre-wrap">
                      {JSON.stringify({ reproduced: reproductionResult.reproduced, success: reproductionResult.success, repo: reproductionResult.repo, issueNumber: reproductionResult.issueNumber }, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL: Extracted environments, specifications & summaries (Lg: 7/12 columns) */}
          <div className="lg:col-span-7 space-y-6">
            {loading ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-indigo-900 border-t-indigo-500 rounded-full animate-spin"></div>
                  <Bot className="w-6 h-6 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                    SYNTHESIZING VIRTUAL Blueprints...
                  </h3>
                  <p className="text-slate-500 text-xs mt-1.5 max-w-sm">
                    Gemini AI is parsing issue semantics, structuring dependency trees, and drafting customized setup scripts for local and cloud environments.
                  </p>
                </div>
              </div>
            ) : report ? (
              <div className="space-y-6 animate-fadeIn">
                {/* Bug explanation card */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs font-semibold uppercase tracking-wider">
                      <History className="w-3.5 h-3.5" />
                      Extraction Summary
                    </div>
                    {report.githubRepo && (
                      <span className="flex items-center gap-1 text-[10px] bg-emerald-950/40 text-emerald-400 font-mono px-2 py-0.5 rounded border border-emerald-900/30">
                        <CheckCircle className="w-3 h-3" />
                        Live Repo Isolated
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-white tracking-tight leading-snug">
                    {report.title}
                  </h3>
                  <p className="text-slate-300 text-xs mt-3 leading-relaxed">
                    {report.summary}
                  </p>
                  {report.githubRepo && (
                    <div className="mt-4 pt-3.5 border-t border-slate-800/60 flex flex-wrap items-center gap-2 text-xxs font-mono">
                      <span className="text-slate-400">Isolated Context:</span>
                      <a
                        href={`https://github.com/${report.githubRepo}`}
                        target="_blank"
                        referrerPolicy="no-referrer"
                        className="inline-flex items-center gap-1 bg-slate-950 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-800/40 text-[11px] px-2.5 py-1 rounded transition-colors text-indigo-400 font-medium"
                      >
                        <GitFork className="w-3.5 h-3.5" />
                        {report.githubRepo}
                      </a>
                      {report.githubIssueNumber && (
                        <a
                          href={`https://github.com/${report.githubRepo}/issues/${report.githubIssueNumber}`}
                          target="_blank"
                          referrerPolicy="no-referrer"
                          className="inline-flex items-center gap-1 bg-slate-950 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-800/40 text-[11px] px-2.5 py-1 rounded transition-colors text-emerald-400 font-medium"
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          Issue #{report.githubIssueNumber}
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Specification grids from MetricCards.tsx */}
                <MetricCards report={report} />
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 py-24 select-none">
                <Terminal className="w-12 h-12 text-slate-700 mx-auto shrink-0 mb-4" />
                <h3 className="text-sm font-semibold text-slate-400">Environment extraction Queue Empty</h3>
                <p className="text-xs max-w-xs mx-auto text-slate-500 mt-1">
                  Select a preset issue report on the left or write custom logs to synthesize virtual blueprint clusters.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Blueprint Viewer (Full Width Row) */}
        {report && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
            {/* Replication Script code view tabs */}
            <div className="md:col-span-7">
              <BlueprintViewer report={report} />
            </div>

            {/* Simulated Live Sandbox Console */}
            <div className="md:col-span-5">
              <TerminalSimulator report={report} />
            </div>
          </div>
        )}

        {/* Complete Systems Engineering Architecture explanations */}
        <ArchitectureGuide />

      </main>

      <footer className="bg-slate-950 border-t border-slate-900 py-10 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 font-mono">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-600" />
            <span>Bug Environment Parser / VM Replicator</span>
          </div>
          <div className="flex items-center gap-4 text-xxs">
            <span>Server Ingress: Port 3000</span>
            <span>Agent Build: Connected</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
