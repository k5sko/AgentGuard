/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GitPullRequest, Settings, Terminal, ShieldCheck, Cpu, PlayCircle, Layers, CheckCircle2 } from "lucide-react";

export default function ArchitectureGuide() {
  const workflowSteps = [
    {
      icon: <GitPullRequest className="w-5 h-5 text-indigo-400" />,
      title: "1. GitHub Webhook trigger",
      desc: "An issue is opened or edited in your GitHub Repo. A configured webhook triggers our reproduction service, passing the issue title and body payload."
    },
    {
      icon: <Terminal className="w-5 h-5 text-purple-400" />,
      title: "2. LLM Parsing & Blueprinting",
      desc: "Our reproduction backend queries Gemini (with structured JSON schema inputs) to parse the issue text, extract runtime parameters (OS, language versions, environment variables, test script, dependencies), and generate target blueprints."
    },
    {
      icon: <Layers className="w-5 h-5 text-emerald-400" />,
      title: "3. Ephemeral Environment Spawning",
      desc: "Our scheduler commands a VM runner (e.g., GCP Compute Engine, AWS EC2, or an on-premise Docker/Vagrant hypervisor pool) to spin up a isolated sandboxed environment matching the blueprint."
    },
    {
      icon: <PlayCircle className="w-5 h-5 text-pink-400" />,
      title: "4. Script Execution & Mock testing",
      desc: "Inside the isolated VM, dependencies are pre-installed, environmental variables are bound, and the custom test script is executed. Standard output, error logs, and exit status are captured."
    }
  ];

  return (
    <div id="architecture-guide" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl text-slate-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6 mb-8">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400 bg-indigo-950/70 border border-indigo-900/50 px-3 py-1 rounded-full">
            Technical Solution Design
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-white mt-3">
            How Continuous VM Bug Reproduction Works
          </h2>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            You can implement a fully automated pipeline by connecting GitHub Webhooks to the Gemini API and ephemeral cloud compute. Here is the architectural flow:
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-950 px-4 py-2.5 rounded-lg border border-slate-800/80">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-mono text-slate-400">Sandbox Isolation: Secure</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {workflowSteps.map((step, idx) => (
          <div key={idx} className="bg-slate-950/70 border border-slate-800/60 rounded-xl p-5 hover:border-slate-700/80 transition-all group">
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center border border-slate-800 mb-4 group-hover:scale-105 transition-transform duration-300">
              {step.icon}
            </div>
            <h3 className="text-sm font-semibold text-white tracking-tight leading-snug">
              {step.title}
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed mt-2.5">
              {step.desc}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-slate-950/90 border border-indigo-950/50 p-6 rounded-xl">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-indigo-300 mb-3">
          <Cpu className="w-4 h-4 text-indigo-400" />
          Recommended Deployment Platforms for VM Mimicry
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-300">
          <div className="space-y-2 border-r border-slate-900/80 pr-4 last:border-r-0">
            <h5 className="font-semibold text-white flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-sky-400 rounded-full"></span>
              GCP Compute Engine API
            </h5>
            <p className="text-slate-400 leading-relaxed">
              Create temporary virtual machine instances using startup scripts. Pass custom metadata scripts containing instructions to install Docker and execute the custom tests, then self-destruct.
            </p>
          </div>
          <div className="space-y-2 border-r border-slate-900/80 pr-4 last:border-r-0">
            <h5 className="font-semibold text-white flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
              GitHub Runners or Actions
            </h5>
            <p className="text-slate-400 leading-relaxed">
              Trigger repository dispatches that spins up ephemeral hosted environments. The generated test script can run isolated inside standard containers or runners on specific matrices.
            </p>
          </div>
          <div className="space-y-2 last:border-r-0">
            <h5 className="font-semibold text-white flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>
              Local Hypervisor VM Agent
            </h5>
            <p className="text-slate-400 leading-relaxed">
              Run a local daemon tool on a developer box that listens for parsed task queues and spawns instances using Vagrant/VirtualBox or docker-compose blueprints to test bugs offline.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
