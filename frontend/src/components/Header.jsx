export default function Header() {
  return (
    <header className="border-b border-gray-800 bg-gray-900 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-blue-400 text-2xl font-bold tracking-tight">
          TEST<span className="text-white">-ARCHON</span>
        </span>
        <span className="text-xs text-gray-500 border border-gray-700 rounded px-2 py-0.5">
          IBM Bob Hackathon 2.0
        </span>
      </div>
      <p className="text-xs text-gray-500 hidden sm:block">
        Multi-Agent QA Orchestrator · Hexagonal Architecture
      </p>
    </header>
  )
}
