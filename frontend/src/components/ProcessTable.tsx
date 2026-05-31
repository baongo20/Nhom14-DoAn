import React, { useState } from 'react';
import { Search, ShieldAlert, Cpu, HardDrive } from 'lucide-react';

interface ProcessItem {
  pid: number;
  name: string;
  status: string;
  cpu_percent: number;
  memory_percent: number;
  username: string | null;
}

interface ProcessTableProps {
  processes: ProcessItem[];
}

export const ProcessTable: React.FC<ProcessTableProps> = ({ processes }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'cpu' | 'memory'>('cpu');

  const filteredProcesses = processes
    .filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'cpu') {
        return b.cpu_percent - a.cpu_percent || b.memory_percent - a.memory_percent;
      } else {
        return b.memory_percent - a.memory_percent || b.cpu_percent - a.cpu_percent;
      }
    });

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('running')) return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    if (s.includes('sleeping')) return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    if (s.includes('stopped') || s.includes('zombie')) return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
  };

  return (
    <div className="glass-panel rounded-2xl p-6 flex flex-col h-full min-h-[380px]">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-100 tracking-wide">Top System Processes</h3>
          <p className="text-xs text-slate-400 mt-0.5">Live running processes sorted by active impact</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 sm:flex-initial">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search process..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-48 glass-input py-1.5 pl-9 pr-4 rounded-xl text-xs text-slate-200 placeholder-slate-500"
            />
          </div>

          {/* Sort Selector */}
          <div className="flex bg-slate-900/60 p-1 rounded-xl border border-slate-800/80 gap-1">
            <button
              onClick={() => setSortBy('cpu')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all duration-300 flex items-center gap-1 ${
                sortBy === 'cpu'
                  ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" /> CPU
            </button>
            <button
              onClick={() => setSortBy('memory')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all duration-300 flex items-center gap-1 ${
                sortBy === 'memory'
                  ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" /> RAM
            </button>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-y-auto max-h-[300px] pr-1">
        {filteredProcesses.length === 0 ? (
          <div className="h-full py-12 flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
            <ShieldAlert className="w-8 h-8 text-slate-600" />
            <span>No matching processes found</span>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 pb-3">
                <th className="py-2.5 font-medium">NAME</th>
                <th className="py-2.5 font-medium text-center hidden md:table-cell">PID</th>
                <th className="py-2.5 font-medium text-center">STATUS</th>
                <th className="py-2.5 font-medium">CPU LOAD</th>
                <th className="py-2.5 font-medium">MEMORY USAGE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-xs">
              {filteredProcesses.map((proc) => (
                <tr key={proc.pid} className="hover:bg-slate-800/25 transition-colors duration-150">
                  {/* Name and User */}
                  <td className="py-3 font-semibold text-slate-200">
                    <span className="truncate max-w-[150px] block" title={proc.name}>
                      {proc.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium block mt-0.5 truncate max-w-[120px]">
                      {proc.username || 'SYSTEM'}
                    </span>
                  </td>
                  
                  {/* PID */}
                  <td className="py-3 text-center text-slate-400 font-mono hidden md:table-cell">
                    {proc.pid}
                  </td>
                  
                  {/* Status */}
                  <td className="py-3 text-center">
                    <span className={`inline-flex px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium tracking-wide uppercase ${getStatusColor(proc.status)}`}>
                      {proc.status}
                    </span>
                  </td>
                  
                  {/* CPU gauge bar */}
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="w-8 text-right font-semibold text-indigo-400">{proc.cpu_percent}%</span>
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden min-w-[50px]">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(proc.cpu_percent, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  
                  {/* Memory gauge bar */}
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-8 text-right font-semibold text-purple-400">{proc.memory_percent}%</span>
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden min-w-[50px]">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(proc.memory_percent * 5, 100)}%` }} // Scaled relative meter (typically memory percent per process is small)
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
export default ProcessTable;
