// src/app/(app)/dashboard/page.tsx

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-32 rounded-xl border border-slate-800/70 bg-[#0F1A2A]/80 flex items-center justify-center text-slate-400">
          Account Overview
        </div>

        <div className="h-32 rounded-xl border border-slate-800/70 bg-[#0F1A2A]/80 flex items-center justify-center text-slate-400">
          Portfolio Allocation
        </div>

        <div className="h-32 rounded-xl border border-slate-800/70 bg-[#0F1A2A]/80 flex items-center justify-center text-slate-400">
          Risk Summary
        </div>
      </div>

      <div className="h-64 rounded-xl border border-slate-800/70 bg-[#0F1A2A]/80 flex items-center justify-center text-slate-500">
        Dashboard Main Chart Placeholder
      </div>
    </div>
  );
}
