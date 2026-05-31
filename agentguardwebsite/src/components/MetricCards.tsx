/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Monitor, Cpu, Code2, Link, AlertTriangle } from "lucide-react";
import { ParsedBugReport } from "../types";

interface MetricCardsProps {
  report: ParsedBugReport;
}

export default function MetricCards({ report }: MetricCardsProps) {
  const getConfidenceColor = (level: "High" | "Medium" | "Low") => {
    switch (level) {
      case "High":
        return {
          bg: "bg-emerald-500/10 border-emerald-500/30",
          text: "text-emerald-400",
          barBg: "bg-emerald-500",
          width: "w-full"
        };
      case "Medium":
        return {
          bg: "bg-amber-500/10 border-amber-500/30",
          text: "text-amber-400",
          barBg: "bg-amber-500",
          width: "w-2/3"
        };
      case "Low":
        return {
          bg: "bg-rose-500/10 border-rose-500/30",
          text: "text-rose-400",
          barBg: "bg-rose-500",
          width: "w-1/3"
        };
    }
  };

  const confidence = getConfidenceColor(report.confidence);

  return (
    <div id="metric-cards" className="space-y-6">
      {/* Target specs summary header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Operating system */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transition-transform group-hover:scale-110">
            <Monitor className="w-16 h-16 text-white" />
          </div>
          <span className="text-xs font-medium text-slate-500 font-mono block">OPERATING SYSTEM</span>
          <span className="text-lg font-semibold text-white mt-1.5 block tracking-tight">
            {report.systemOs || "Unknown OS"}
          </span>
          <span className="text-xs font-mono text-indigo-400 font-medium mt-1 inline-block bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/30">
            Version {report.systemVersion || "Latest"}
          </span>
        </div>

        {/* Core Language Runtime */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transition-transform group-hover:scale-110">
            <Code2 className="w-16 h-16 text-white" />
          </div>
          <span className="text-xs font-medium text-slate-500 font-mono block">LANGUAGE RUNTIME</span>
          <span className="text-lg font-semibold text-white mt-1.5 block tracking-tight">
            {report.runtimeLanguage || "N/A"}
          </span>
          <span className="text-xs font-mono text-emerald-400 font-medium mt-1 inline-block bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/30">
            Version {report.runtimeVersion || "Unspecified"}
          </span>
        </div>

        {/* Browser Client */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm relative overflow-hidden group font-sans">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transition-transform group-hover:scale-110">
            <Cpu className="w-16 h-16 text-white" />
          </div>
          <span className="text-xs font-medium text-slate-500 font-mono block">BROWSER SCOPE</span>
          <span className="text-lg font-semibold text-white mt-1.5 block tracking-tight">
            {report.browser || "N/A"}
          </span>
          <span className="text-xs text-slate-400 mt-1 block">
            {report.browser !== "N/A" ? "Requires UI render context" : "Headless VM/Backend execution"}
          </span>
        </div>

        {/* Parsing confidence */}
        <div className={`border rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between ${confidence.bg}`}>
          <div>
            <span className="text-xs font-medium text-slate-500 font-mono block">PARSING CONFIDENCE</span>
            <span className={`text-lg font-semibold mt-1.5 block tracking-tight ${confidence.text}`}>
              {report.confidence} Confidence
            </span>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${confidence.barBg} ${confidence.width}`}></div>
            </div>
          </div>
        </div>
      </div>

      {report.parsingErrors.length > 0 && (
        <div className="bg-amber-950/35 border border-amber-900/40 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-amber-200">Replication Assumptions & Warnings</h4>
            <ul className="list-disc pl-4 text-xs text-slate-300 space-y-1">
              {report.parsingErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Dependencies & Env vars row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Identified Dependencies */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-white tracking-tight mb-4 flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-indigo-500"></span>
            Extracted Package Dependencies ({report.dependencies.length})
          </h3>
          {report.dependencies.length === 0 ? (
            <p className="text-slate-500 text-xs py-4 text-center">No third-party packages found in the issue summary.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-xxs font-mono tracking-wider">
                    <th className="pb-2 font-medium">NAME</th>
                    <th className="pb-2 font-medium">VERSION</th>
                    <th className="pb-2 font-medium text-right">MANAGER</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {report.dependencies.map((dep, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/20">
                      <td className="py-2.5 font-semibold text-slate-200">{dep.name}</td>
                      <td className="py-2.5 font-mono text-slate-400">{dep.version || "latest"}</td>
                      <td className="py-2.5 text-right">
                        <span className="inline-block px-1.5 py-0.5 font-mono rounded text-xxs bg-slate-950 border border-slate-800 text-slate-300">
                          {dep.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Environment variables */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight mb-4 flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
              Environment Variable Bindings ({report.envVariables.length})
            </h3>
            {report.envVariables.length === 0 ? (
              <p className="text-slate-500 text-xs py-10 text-center">No environment variables parsed in configuration.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {report.envVariables.map((env, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-950/70 border border-slate-800/60 px-3 py-2 rounded font-mono text-xs">
                    <span className="text-amber-400 font-semibold truncate max-w-[150px]">{env.key}</span>
                    <span className="text-slate-400 truncate max-w-[200px]" title={env.value}>
                      {env.value || `""`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-800/40 text-xxs text-slate-500 leading-relaxed font-mono">
            * These bindings will be injected automatically during sandbox instantiation using Docker ENV commands or Vagrant environment export configs.
          </div>
        </div>
      </div>
    </div>
  );
}
