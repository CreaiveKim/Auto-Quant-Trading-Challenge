// src/app/(app)/weeklyReport/page.tsx

export default function WeeklyReportPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Weekly Report</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="h-28 rounded-xl border border-slate-800/70 bg-[#0F1A2A]/80 flex items-center justify-center text-slate-400">
          Weekly PnL
        </div>
        <div className="h-28 rounded-xl border border-slate-800/70 bg-[#0F1A2A]/80 flex items-center justify-center text-slate-400">
          Win Rate
        </div>
        <div className="h-28 rounded-xl border border-slate-800/70 bg-[#0F1A2A]/80 flex items-center justify-center text-slate-400">
          Drawdown
        </div>
        <div className="h-28 rounded-xl border border-slate-800/70 bg-[#0F1A2A]/80 flex items-center justify-center text-slate-400">
          Trade Count
        </div>
      </div>

      <div className="h-64 rounded-xl border border-slate-800/70 bg-[#0F1A2A]/80 flex items-center justify-center text-slate-500">
        Weekly Performance Chart Placeholder
      </div>
    </div>
  );
}
