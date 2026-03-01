interface Props {
  mobile?: boolean;
}

export default function Sidebar({ mobile }: Props) {
  if (mobile) {
    return (
      <div className="flex justify-around items-center h-16 text-sm">
        <button>Home</button>
        <button>Markets</button>
        <button>Live</button>
        <button>Signals</button>
        <button>Settings</button>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-6 space-y-6">
      <button className="text-xl font-bold">2KQuant</button>
      <div className="space-y-4 text-slate-400">
        <button>Dashboard</button>
        <button>Markets</button>
        <button>Live Trading</button>
        <button>Signals</button>
        <button>Support</button>
      </div>
    </div>
  );
}