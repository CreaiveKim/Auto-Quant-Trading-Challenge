// src/app/(app)/settings/page.tsx

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-40 rounded-xl border border-slate-800/70 bg-[#0F1A2A]/80 p-4">
          <div className="text-slate-300 mb-2">Account</div>
          <div className="text-slate-500 text-sm">
            Email / Plan / Subscription Placeholder
          </div>
        </div>

        <div className="h-40 rounded-xl border border-slate-800/70 bg-[#0F1A2A]/80 p-4">
          <div className="text-slate-300 mb-2">API Settings</div>
          <div className="text-slate-500 text-sm">
            Exchange API Key Placeholder
          </div>
        </div>
      </div>

      <div className="h-40 rounded-xl border border-slate-800/70 bg-[#0F1A2A]/80 flex items-center justify-center text-slate-500">
        Notification Settings Placeholder
      </div>
    </div>
  );
}
