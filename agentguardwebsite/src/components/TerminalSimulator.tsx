/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { Terminal, Play, Pause, RotateCcw, AlertOctagon, TerminalSquare, ServerCrash } from "lucide-react";
import { ParsedBugReport, SimulationStep } from "../types";

interface TerminalSimulatorProps {
  report: ParsedBugReport;
}

export default function TerminalSimulator({ report }: TerminalSimulatorProps) {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [status, setStatus] = useState<"idle" | "spawning" | "provisioning" | "executing" | "reproduced" | "stopped">("idle");
  const [logs, setLogs] = useState<SimulationStep[]>([]);
  const [executionProgress, setExecutionProgress] = useState<number>(0);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll inside terminal logger
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Clean log structure generator based on report details
  const getSimulatedStepSequence = (): Omit<SimulationStep, "id" | "timestamp">[] => {
    const osName = report.systemOs || "Ubuntu Linux";
    const osVer = report.systemVersion || "Latest";
    const lang = report.runtimeLanguage || "Node.js";
    const langVer = report.runtimeVersion || "18";

    // Standard pre-build logs
    const bootSteps: Omit<SimulationStep, "id" | "timestamp">[] = [
      { type: "info", message: `Initializing Ephemeral Environment Replicator pipeline...` },
      { type: "info", message: `Connecting to secure VM host hypervisor daemon...` },
      { type: "command", message: `gcloud compute instances create replica-sandbox-task --image-family=debian-11 --metadata-from-file startup-script=bootstrap.sh` },
      { type: "info", message: `[HypeVM] Spawning isolated cloud virtualization layer: ${osName} (${osVer})` },
      { type: "success", message: `[HypeVM] Sandbox online. Bound internal physical instance ID: vm-task-${Math.floor(Math.random() * 900000 + 100000)}` },
    ];

    // Env vars injection
    if (report.envVariables.length > 0) {
      bootSteps.push({ type: "info", message: "Injected reporter-supplied environment configurations:" });
      report.envVariables.forEach((env) => {
        bootSteps.push({ type: "command", message: `export ${env.key}="${env.value}"` });
      });
    }

    // Language runtime setup
    bootSteps.push(
      { type: "info", message: `Validating language runtime environment: "${lang} (target: ${langVer})"` },
      { type: "command", message: `${lang.toLowerCase() === "node.js" ? "node" : lang.toLowerCase()} --version` },
      { type: "success", message: `Installed dynamic environment match: ${lang} v${langVer}` }
    );

    // Dependencies installation
    if (report.dependencies.length > 0) {
      bootSteps.push({ type: "info", message: `Provisioning third-party package dependencies via package catalog...` });
      const pipDeps = report.dependencies.filter((d) => d.type === "pip").map((d) => `${d.name}==${d.version || "latest"}`).join(" ");
      const npmDeps = report.dependencies.filter((d) => d.type === "npm").map((d) => `${d.name}@${d.version || "latest"}`).join(" ");
      const aptDeps = report.dependencies.filter((d) => d.type === "apt").map((d) => d.name).join(" ");

      if (pipDeps) {
        bootSteps.push({ type: "command", message: `pip install ${pipDeps}` });
        bootSteps.push({ type: "success", message: `Successfully installed pip requirements: [${pipDeps}]` });
      }
      if (npmDeps) {
        bootSteps.push({ type: "command", message: `npm install ${npmDeps} --no-audit` });
        bootSteps.push({ type: "success", message: `Successfully installed npm requirements: [${npmDeps}]` });
      }
      if (aptDeps) {
        bootSteps.push({ type: "command", message: `sudo apt-get install -y ${aptDeps}` });
        bootSteps.push({ type: "success", message: `Successfully loaded Debian/Ubuntu apt systems: [${aptDeps}]` });
      }
    }

    // Creating test script file
    const testFile = report.testScript?.filename || "test_reproducer.sh";
    bootSteps.push(
      { type: "info", message: `Writing custom replication harness code into local disk: ${testFile}` },
      { type: "command", message: `cat << 'EOF' > ${testFile}\n${report.testScript?.content || "# execute test trigger"}\nEOF` },
      { type: "success", message: `Test replication handler compiled cleanly on sandbox disk.` }
    );

    // Trigger execution
    bootSteps.push(
      { type: "info", message: "Launching reproduction executable harness inside target container..." },
      { type: "command", message: `chmod +x ${testFile} && ./${testFile}` }
    );

    // Dynamic error trace logs depending on issue
    if (report.title.toLowerCase().includes("django") || report.summary.toLowerCase().includes("django") || report.summary.toLowerCase().includes("sql")) {
      bootSteps.push(
        { type: "command", message: "python test_uuid.py" },
        { type: "info", message: "Connection cursor initiated to PostgreSQL pool..." },
        { type: "error", message: "Traceback (most recent call last):" },
        { type: "error", message: "  File \"test_uuid.py\", line 7, in <module>" },
        { type: "error", message: "    cursor.execute(\"SELECT '%s'::uuid\" % uuid.uuid4())" },
        { type: "error", message: "  File \"django/db/backends/utils.py\", line 67, in execute" },
        { type: "error", message: "    return self._execute_with_wrappers(sql, params, many, executor)" },
        { type: "error", message: "django.db.utils.InterfaceError: bad transaction block: Postgres active transaction protocol rejected UUID format parsing validation" },
        { type: "warning", message: "Database connection entered inconsistent block state." }
      );
    } else if (report.title.toLowerCase().includes("safari") || report.title.toLowerCase().includes("node") || report.summary.toLowerCase().includes("safari") || report.summary.toLowerCase().includes("node")) {
      bootSteps.push(
        { type: "command", message: "npm run build" },
        { type: "info", message: "vite v3.2.10 building for production..." },
        { type: "success", message: "Vite build completed. Output static index in dist/" },
        { type: "command", message: "npx static-server dist" },
        { type: "info", message: "Static server online on port 8080." },
        { type: "info", message: "Spawning automated headless browser mimicking Safari 16 (macOS Ventura User-Agent)..." },
        { type: "error", message: "Browser console error captured at http://localhost:8080/assets/index.js:42:" },
        { type: "error", message: "TypeError: Cannot use 'in' operator to search for 'module' in undefined (es2022 ESModule strict build polyfill failure)" },
        { type: "warning", message: "Engine Failure: Execution rendered blank white page load status." }
      );
    } else if (report.title.toLowerCase().includes("oom") || report.title.toLowerCase().includes("go") || report.title.toLowerCase().includes("memory") || report.summary.toLowerCase().includes("oom") || report.summary.toLowerCase().includes("memory")) {
      bootSteps.push(
        { type: "command", message: "go build -o processor && ./processor" },
        { type: "info", message: "Go engine running worker mode ingest..." },
        { type: "info", message: "[Heap Status] Alloc=124MB, System=210MB - Active goroutines: 12" },
        { type: "info", message: "[Heap Status] Alloc=298MB, System=340MB - Active goroutines: 48" },
        { type: "info", message: "[Heap Status] Alloc=476MB, System=490MB - Active goroutines: 120" },
        { type: "warning", message: "[System Warning] Native hypervisor memory threshold crossed standard 512MB limit." },
        { type: "error", message: "Kernel message captured: [ 602.433] out_of_memory: Kill process 1248 (processor) score 955 or sacrifice child" },
        { type: "error", message: "Killed (SIGKILL - process terminated recursively by Linux OOM manager)" },
        { type: "warning", message: "Application abruptly crashed with exit status code 137." }
      );
    } else if (report.title.toLowerCase().includes("redis") || report.title.toLowerCase().includes("fastapi")) {
      bootSteps.push(
        { type: "command", message: "uvicorn app:app --port 8000" },
        { type: "info", message: "Starting uvicorn server on port 8000 (workers: 1)..." },
        { type: "info", message: "Triggering concurrency loader: 1000 requests/sec..." },
        { type: "error", message: "Internal Server Exception generated (500 Internal Server Error)" },
        { type: "error", message: "Traceback (most recent call last):" },
        { type: "error", message: "  File \"redis/asyncio/connection.py\", line 124, in get_connection" },
        { type: "error", message: "    raise ConnectionTimeout(\"Timeout waiting for connection from Redis connection pool\")" },
        { type: "error", message: "redis.exceptions.ConnectionTimeout: Timeout waiting for connection from Redis connection pool" }
      );
    } else {
      // Fallback generic reproduction error logs
      bootSteps.push(
        { type: "info", message: "Running localized replication triggers..." },
        { type: "error", message: "Runtime exception captured. Standard execution exited with non-zero status:" },
        { type: "error", message: `Process ended unexpectedly: Code 1. Unhandled compilation traceback.` }
      );
    }

    // Concluding standard result logs
    bootSteps.push(
      { type: "info", message: `Stopping sandbox container instance...` },
      { type: "info", message: `Dumping VM environment metrics...` },
      { type: "success", message: `[REPRODUCER STATUS] Target bug successfully isolated and reproduced inside ephemeral environment!` }
    );

    return bootSteps;
  };

  const startSimulation = () => {
    setIsRunning(true);
    setStatus("spawning");
    setLogs([]);
    setExecutionProgress(0);

    const steps = getSimulatedStepSequence();
    let currentStepIndex = 0;

    const interval = setInterval(() => {
      if (currentStepIndex >= steps.length) {
        clearInterval(interval);
        setIsRunning(false);
        setStatus("reproduced");
        setExecutionProgress(100);
        return;
      }

      // Read next step
      const nextStep = steps[currentStepIndex];
      const timestamp = new Date().toLocaleTimeString();

      setLogs((prev) => [
        ...prev,
        {
          id: `step-${currentStepIndex}`,
          type: nextStep.type,
          message: nextStep.message,
          timestamp: timestamp,
        } as SimulationStep
      ]);

      // State transitions based on progress list
      if (currentStepIndex < 4) {
        setStatus("spawning");
      } else if (currentStepIndex < 12) {
        setStatus("provisioning");
      } else {
        setStatus("executing");
      }

      setExecutionProgress(Math.floor((currentStepIndex / steps.length) * 100));
      currentStepIndex++;
    }, 450); // Clean readable scrolling pace

    return () => clearInterval(interval);
  };

  const handleReset = () => {
    setIsRunning(false);
    setStatus("idle");
    setLogs([]);
    setExecutionProgress(0);
  };

  return (
    <div id="terminal-simulator" className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col h-[520px]">
      {/* Terminal Title Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TerminalSquare className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold font-mono tracking-wider text-slate-100">
            EPHEMERAL REPRODUCTION CONSOLE
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
        </div>
      </div>

      {/* Control panel and progress bar */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {status === "idle" || status === "reproduced" || status === "stopped" ? (
            <button
              onClick={startSimulation}
              disabled={isRunning}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold font-mono px-3.5 py-1.5 rounded transition-all shadow-sm shadow-emerald-950/20 active:scale-95"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Instantiate Sandbox</span>
            </button>
          ) : (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800/50 text-xs font-semibold font-mono px-3.5 py-1.5 rounded transition-all active:scale-95"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Cancel / Destroy</span>
            </button>
          )}

          <button
            onClick={handleReset}
            disabled={logs.length === 0}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700/50 text-slate-300 text-xs font-mono px-2.5 py-1.5 rounded transition-all"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Logs</span>
          </button>
        </div>

        {/* Dynamic status indicators */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Pipeline State:</span>
            {status === "idle" && <span className="text-slate-400 font-semibold uppercase">Idle</span>}
            {status === "spawning" && (
              <span className="text-sky-400 font-semibold animate-pulse uppercase">
                Spawning VM...
              </span>
            )}
            {status === "provisioning" && (
              <span className="text-indigo-400 font-semibold animate-pulse uppercase">
                Installing requirements...
              </span>
            )}
            {status === "executing" && (
              <span className="text-amber-400 font-semibold animate-pulse uppercase">
                Running reproducer...
              </span>
            )}
            {status === "reproduced" && (
              <span className="text-rose-400 font-bold uppercase flex items-center gap-1">
                <AlertOctagon className="w-3.5 h-3.5 animate-bounce" />
                Bug Reproduced (137)
              </span>
            )}
          </div>
          <div className="w-24 bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                status === "reproduced" ? "bg-rose-500" : "bg-emerald-500"
              }`}
              style={{ width: `${executionProgress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Code CLI display */}
      <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-slate-300 space-y-2 select-text selection:bg-slate-700 selection:text-white">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 py-10 text-center font-sans">
            <Terminal className="w-10 h-10 text-slate-700 shrink-0" />
            <p className="text-sm font-semibold text-slate-400">Sandbox Replicator Terminal Offline</p>
            <p className="text-xs max-w-xs text-slate-500">
              Click "Instantiate Sandbox" above to simulate launching the ephemeral container, building packages, running the reproduction code file, and parsing crash dumps.
            </p>
          </div>
        ) : (
          logs.map((log) => {
            let cl = "text-slate-300";
            let prefix = "";

            if (log.type === "command") {
              cl = "text-amber-300 italic";
              prefix = "$ ";
            } else if (log.type === "success") {
              cl = "text-emerald-400 font-semibold";
              prefix = "[✓] ";
            } else if (log.type === "error") {
              cl = "text-rose-400 font-semibold font-bold border-l-2 border-rose-500/40 pl-2 bg-rose-950/10 py-0.5";
              prefix = "stderr: ";
            } else if (log.type === "warning") {
              cl = "text-amber-400";
              prefix = "[!] ";
            } else {
              cl = "text-slate-400";
              prefix = "[i] ";
            }

            return (
              <div key={log.id} className="leading-relaxed hover:bg-slate-900/40 px-1 py-0.5 rounded transition-all">
                <span className="text-slate-600 text-xxs font-normal mr-2 select-none">
                  [{log.timestamp}]
                </span>
                <span className={cl}>
                  {prefix}
                  {log.message}
                </span>
              </div>
            );
          })
        )}
        <div ref={terminalEndRef}></div>
      </div>
    </div>
  );
}
