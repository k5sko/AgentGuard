/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Copy, Check, FileCode, Server, ListFilter, HelpCircle } from "lucide-react";
import { ParsedBugReport, BlueprintFile } from "../types";

interface BlueprintViewerProps {
  report: ParsedBugReport;
}

type BlueprintKey = "docker" | "vagrant" | "nix" | "codespace";

export default function BlueprintViewer({ report }: BlueprintViewerProps) {
  const [activeTab, setActiveTab] = useState<BlueprintKey>("docker");
  const [copied, setCopied] = useState<boolean>(false);

  const tabsConfig = [
    { key: "docker", label: "Dockerfile", icon: <FileCode className="w-3.5 h-3.5" /> },
    { key: "vagrant", label: "Vagrantfile", icon: <Server className="w-3.5 h-3.5" /> },
    { key: "nix", label: "Nix Environment", icon: <ListFilter className="w-3.5 h-3.5" /> },
    { key: "codespace", label: "Devcontainer", icon: <HelpCircle className="w-3.5 h-3.5" /> }
  ];

  const getActiveFileObj = (): BlueprintFile => {
    switch (activeTab) {
      case "docker":
        return report.blueprints.docker;
      case "vagrant":
        return report.blueprints.vagrant;
      case "nix":
        return report.blueprints.nix;
      case "codespace":
        return report.blueprints.codespace;
    }
  };

  const activeFile = getActiveFileObj();

  const handleCopy = () => {
    if (!activeFile?.content) return;
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="blueprint-viewer" className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header bar and tabs selector */}
      <div className="bg-slate-950 border-b border-slate-800 px-4 pt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
          <span className="text-xs font-semibold text-slate-300 font-mono">REPLICATION BLUEPRINTS</span>
        </div>
        <div className="flex overflow-x-auto gap-1 border-b border-slate-800 sm:border-0 pb-2 sm:pb-0">
          {tabsConfig.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as BlueprintKey);
                setCopied(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium font-mono rounded-t-md transition-all duration-150 shrink-0 ${
                activeTab === tab.key
                  ? "bg-slate-900 border-t border-x border-slate-800 text-indigo-400 font-semibold"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main body of code viewer */}
      <div className="flex-1 flex flex-col p-5 min-h-[350px]">
        {/* Copy bar */}
        <div className="flex items-center justify-between bg-slate-950 px-4 py-2 rounded-t-lg border-t border-x border-slate-800">
          <div className="flex items-center gap-1.5 font-mono text-xxs text-slate-400">
            <span className="text-indigo-400">file:</span> {activeFile?.filename || "config"}
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded text-xxs font-mono text-slate-400 hover:text-white hover:border-slate-600 transition-all font-medium py-1"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy Draft</span>
              </>
            )}
          </button>
        </div>

        {/* Code Content */}
        <div className="flex-1 bg-slate-950 border-x border-b border-slate-800 rounded-b-lg p-4 font-mono text-xs text-slate-300 overflow-y-auto max-h-[400px] leading-relaxed whitespace-pre-wrap select-text">
          {activeFile?.content || "No blueprint content available."}
        </div>

        {/* Blueprint Explanation summary */}
        {activeFile?.explanation && (
          <div className="mt-5 bg-indigo-950/20 border border-indigo-900/40 rounded-xl p-4 text-xs">
            <span className="text-indigo-300 font-semibold uppercase font-mono tracking-wider text-xxs block mb-1">
              PROVISIONING STRATEGY
            </span>
            <p className="text-slate-300 leading-relaxed">
              {activeFile.explanation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
