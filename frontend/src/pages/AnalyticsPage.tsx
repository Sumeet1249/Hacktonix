import React from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useProject } from "../hooks/useProject";
import { Plus, History, Shield, Bell, Settings, Terminal, ShieldCheck, Wrench, TrendingDown, RefreshCw, Layers, Image as ImageIcon, Mic, Send, Activity, ChevronRight } from "lucide-react";
import TopNavBar from "../components/TopNavBar";

export default function AnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { project, loading } = useProject(id!, 3000);

  if (loading) return <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center font-headline uppercase tracking-widest text-xs text-primary animate-pulse">Synchronizing Intelligence Node...</div>;
  if (!project) return <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center"><button onClick={() => navigate('/projects')}>Node Not Found - Return</button></div>;

  return (
    <div className="bg-[#f7f9fb] font-body text-[#191c1e] selection:bg-tertiary-fixed selection:text-on-tertiary-fixed relative min-h-screen overflow-x-hidden">
      {/* Background Decoration */}
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#c5c6cf 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.15 }}></div>
      <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* SideNavBar */}
      <aside className="fixed left-0 top-0 h-full w-64 border-r border-slate-200/20 bg-slate-50/70 backdrop-blur-xl z-50 flex flex-col p-4 shadow-[0_0_40px_rgba(38,58,97,0.05)]">
        <div className="mb-12 px-4 cursor-pointer" onClick={() => navigate('/')}>
          <h1 className="text-xl font-bold tracking-tighter text-slate-900">AxiomSynth</h1>
          <p className="font-headline uppercase tracking-widest text-[10px] text-slate-500">AI Defense Core</p>
        </div>
        <nav className="flex-1 space-y-2">
          <button onClick={() => navigate('/projects')} className="w-full flex items-center gap-3 text-slate-500 px-4 py-2 hover:bg-slate-100 transition-all duration-300 rounded-lg group">
            <Plus size={18} />
            <span className="font-headline uppercase tracking-widest text-[10px]">New Project</span>
          </button>
          <button onClick={() => navigate('/projects')} className="w-full flex items-center gap-3 text-slate-500 px-4 py-2 hover:bg-slate-100 transition-all duration-300 rounded-lg group">
            <History size={18} />
            <span className="font-headline uppercase tracking-widest text-[10px]">Recent Scans</span>
          </button>
          <div className="flex items-center gap-3 bg-indigo-50 text-indigo-600 rounded-lg px-4 py-2 group">
            <Shield size={18} fill="currentColor" />
            <span className="font-headline uppercase tracking-widest text-[10px]">{project.name}</span>
          </div>
        </nav>
        <div className="mt-auto p-4 flex items-center gap-3 bg-slate-100 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold">OP7</div>
          <div className="overflow-hidden">
            <p className="text-xs font-bold truncate">Operator 07-X</p>
            <p className="text-[10px] text-slate-400 truncate uppercase tracking-tighter">Level 4 Clearance</p>
          </div>
        </div>
      </aside>

      <TopNavBar projectId={id} />

      {/* Main Content Area */}
      <main className="ml-64 p-12 pt-24 pb-32 relative z-10">
        <header className="flex justify-between items-end mb-12">
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-primary/60 font-bold font-headline">Axiom Operational Environment</span>
            <h2 className="text-5xl font-bold tracking-tighter text-on-surface font-headline uppercase mt-2">ROBUSTNESS INTELLIGENCE</h2>
          </div>
          <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-lg flex items-center gap-3 border border-slate-100 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="font-headline text-xs font-medium tracking-widest text-[#00423c]">CORE STATUS: OPTIMAL</span>
          </div>
        </header>

        {/* Top Section: Analysis Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          <div className="bg-white/70 backdrop-blur-md p-8 rounded-xl shadow-sm border border-slate-200/50 flex flex-col justify-between h-44 group hover:scale-[1.02] transition-all duration-300">
            <div className="flex justify-between items-start">
              <p className="text-[10px] font-bold font-headline uppercase tracking-widest text-slate-500">Global Defense Score</p>
              <ShieldCheck size={18} className="text-primary" />
            </div>
            <div className="flex items-end justify-between">
              <span className="text-4xl font-bold font-headline text-primary">94.2%</span>
              <div className="relative w-12 h-12">
                <svg className="w-full h-full transform -rotate-90">
                  <circle className="text-emerald-100" cx="24" cy="24" fill="transparent" r="20" stroke="currentColor" strokeWidth="4"></circle>
                  <circle className="text-emerald-500" cx="24" cy="24" fill="transparent" r="20" stroke="currentColor" strokeDasharray="125.6" strokeDashoffset="7.3" strokeWidth="4"></circle>
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-md p-8 rounded-xl shadow-sm border border-slate-200/50 flex flex-col justify-between h-44 group hover:scale-[1.02] transition-all duration-300">
            <div className="flex justify-between items-start">
              <p className="text-[10px] font-bold font-headline uppercase tracking-widest text-slate-500">Edge-Cases Generated</p>
              <Wrench size={18} className="text-primary" />
            </div>
            <span className="text-4xl font-bold font-headline text-primary">{project.image_count || 0}</span>
            <p className="text-[10px] text-emerald-600 font-medium font-headline uppercase tracking-widest">+1,240 since last audit</p>
          </div>

          <div className="bg-white/70 backdrop-blur-md p-8 rounded-xl shadow-sm border border-slate-200/50 flex flex-col justify-between h-44 group hover:scale-[1.02] transition-all duration-300">
            <div className="flex justify-between items-start">
              <p className="text-[10px] font-bold font-headline uppercase tracking-widest text-slate-500">Drift Delta</p>
              <TrendingDown size={18} className="text-primary" />
            </div>
            <span className="text-4xl font-bold font-headline text-primary">-12%</span>
            <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 w-[12%]"></div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-md p-8 rounded-xl shadow-sm border border-slate-200/50 flex flex-col justify-between h-44 group hover:scale-[1.02] transition-all duration-300 overflow-hidden">
            <div className="flex justify-between items-start">
              <p className="text-[10px] font-bold font-headline uppercase tracking-widest text-slate-500">Active Pipeline Loops</p>
              <RefreshCw size={18} className="text-primary" />
            </div>
            <span className="text-4xl font-bold font-headline text-primary">4</span>
            <div className="flex gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-10">
          {/* Vulnerability Heatmap */}
          <div className="lg:col-span-3 bg-white/70 backdrop-blur-md rounded-xl p-10 min-h-[480px] relative overflow-hidden border border-slate-200/50 shadow-sm">
            <div className="flex justify-between items-start mb-10 relative z-10">
              <div>
                <h3 className="text-2xl font-bold font-headline text-primary tracking-tight">Vulnerability Heatmap</h3>
                <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">3D Matrix of Failure Clusters & Edge Proximity</p>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1 rounded bg-primary/5 text-primary text-[10px] font-bold font-headline tracking-widest">LAYER: GEOMETRY</span>
                <span className="px-3 py-1 rounded bg-emerald-50 text-emerald-600 text-[10px] font-bold font-headline tracking-widest uppercase">Active Node</span>
              </div>
            </div>
            
            <div className="relative w-full h-72 flex items-center justify-center">
              <div className="absolute inset-0 grid grid-cols-8 grid-rows-6 gap-6 opacity-10 pointer-events-none">
                {Array.from({ length: 48 }).map((_, i) => (
                  <div key={i} className="border border-primary"></div>
                ))}
              </div>
              {/* Failure Clusters Mock */}
              <div className="relative z-10 w-full h-full">
                <div className="absolute top-1/4 left-1/3 group cursor-help">
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-500/40 to-primary/40 blur-2xl rounded-full animate-pulse"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3 h-3 bg-emerald-600 rounded-full shadow-[0_0_15px_#059669]"></div>
                  </div>
                </div>
                <div className="absolute bottom-1/4 right-1/4 group cursor-help">
                  <div className="w-28 h-28 bg-gradient-to-br from-primary/30 to-emerald-500/20 blur-3xl rounded-full"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-4 h-4 bg-primary rounded-full shadow-[0_0_20px_#263a61]"></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute bottom-4 left-4 text-[9px] font-headline uppercase tracking-[0.2em] text-slate-400">Dim: Sensor Occlusion</div>
            <div className="absolute top-4 right-4 text-[9px] font-headline uppercase tracking-[0.2em] text-slate-400">Dim: Chromatic Aberration</div>
          </div>

          {/* Spline Chart */}
          <div className="lg:col-span-2 bg-white/70 backdrop-blur-md rounded-xl p-10 border-r-4 border-indigo-500/20 shadow-sm border-y border-l border-slate-200/50">
            <div className="mb-10">
              <h3 className="text-2xl font-bold font-headline text-primary tracking-tight">Accuracy vs Probing</h3>
              <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">AxiomSynth Probing Difficulty Coefficient</p>
            </div>
            <div className="h-64 relative">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 400 200">
                <line stroke="#f1f5f9" strokeWidth="1" x1="0" x2="400" y1="180" y2="180"></line>
                <line stroke="#f1f5f9" strokeWidth="1" x1="0" x2="400" y1="130" y2="130"></line>
                <line stroke="#f1f5f9" strokeWidth="1" x1="0" x2="400" y1="80" y2="80"></line>
                <line stroke="#f1f5f9" strokeWidth="1" x1="0" x2="400" y1="30" y2="30"></line>
                <path className="opacity-80" d="M0,160 Q50,140 100,100 T200,60 T300,120 T400,40" fill="none" stroke="#6366f1" strokeLinecap="round" strokeWidth="4"></path>
                <path d="M0,40 Q80,50 150,70 T250,90 T350,85 T400,100" fill="none" stroke="#10b981" strokeLinecap="round" strokeWidth="4"></path>
                <circle className="animate-pulse" cx="200" cy="60" fill="#6366f1" r="5"></circle>
                <circle cx="250" cy="90" fill="#10b981" r="5"></circle>
              </svg>
            </div>
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-4 h-1 bg-indigo-500 rounded-full"></span>
                  <span className="text-[10px] font-bold font-headline text-slate-600 uppercase tracking-widest">Probing Intensity</span>
                </div>
                <span className="text-sm font-mono font-bold text-primary">0.84 μ</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-4 h-1 bg-emerald-500 rounded-full"></span>
                  <span className="text-[10px] font-bold font-headline text-slate-600 uppercase tracking-widest">Target Accuracy</span>
                </div>
                <span className="text-sm font-mono font-bold text-primary">96.8%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Patch Logs Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-12 border border-slate-200/50">
          <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-lg font-bold font-headline uppercase tracking-widest text-primary">Recent Robustness Patches</h3>
            <button className="text-slate-400 hover:text-primary transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-10 py-5 text-[10px] font-bold font-headline uppercase tracking-widest text-slate-400">Patch ID</th>
                  <th className="px-10 py-5 text-[10px] font-bold font-headline uppercase tracking-widest text-slate-400">Classification</th>
                  <th className="px-10 py-5 text-[10px] font-bold font-headline uppercase tracking-widest text-slate-400">Status</th>
                  <th className="px-10 py-5 text-[10px] font-bold font-headline uppercase tracking-widest text-slate-400">Accuracy Impact</th>
                  <th className="px-10 py-5 text-[10px] font-bold font-headline uppercase tracking-widest text-slate-400 text-right">Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { id: '402', type: 'Sensor Occlusion - Mud', impact: '+4.2%' },
                  { id: '398', type: 'Reflective Glare - Dusk', impact: '+2.1%' },
                  { id: '395', type: 'Geometric Ambiguity - Fog', impact: 'TBD' }
                ].map((patch) => (
                  <tr key={patch.id} className="hover:bg-slate-50 transition-colors group cursor-default">
                    <td className="px-10 py-6 text-sm font-bold text-primary font-mono">#{patch.id}</td>
                    <td className="px-10 py-6">
                      <p className="text-sm font-medium text-slate-700">{patch.type}</p>
                    </td>
                    <td className="px-10 py-6">
                      <span className="inline-flex items-center px-3 py-1 rounded bg-emerald-50 text-emerald-600 text-[10px] font-bold font-headline uppercase tracking-widest border border-emerald-100">
                        {patch.impact === 'TBD' ? 'Evaluating' : 'Deployed'}
                      </span>
                    </td>
                    <td className="px-10 py-6 text-sm font-mono text-emerald-600 font-bold">{patch.impact}</td>
                    <td className="px-10 py-6 text-right relative">
                      <ImageIcon size={18} className="text-slate-300 ml-auto group-hover:text-primary transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Control Console */}
      <nav className="fixed bottom-0 left-64 right-0 z-50 flex justify-around items-center px-12 py-4 h-24 bg-white/70 backdrop-blur-2xl border-t border-indigo-500/20 shadow-[0_-10px_30px_rgba(98,0,238,0.1)]">
        <div className="flex-1 max-w-2xl bg-slate-50 border border-slate-200 rounded-2xl px-6 py-2 flex items-center gap-4 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
          <Terminal size={18} className="text-slate-400" />
          <input className="bg-transparent border-none focus:ring-0 w-full text-sm font-body tracking-wide placeholder:text-slate-400" placeholder="Initialize robustness audit command..." type="text" />
          <div className="flex gap-2">
            <Mic size={18} className="text-primary cursor-pointer hover:scale-110 transition-transform" />
            <Send size={18} className="text-primary cursor-pointer hover:scale-110 transition-transform" />
          </div>
        </div>
        <div className="flex gap-8 ml-12">
          <div className="flex flex-col items-center justify-center text-indigo-600 ring-1 ring-indigo-500/50 rounded-xl p-2 bg-indigo-50/50">
            <Terminal size={20} />
            <span className="font-headline text-[11px] font-bold tracking-tight uppercase mt-1">Audit</span>
          </div>
          <div className="flex flex-col items-center justify-center text-slate-400 p-2 hover:bg-slate-100 transition-all rounded-xl">
            <Activity size={20} />
            <span className="font-headline text-[11px] font-bold tracking-tight uppercase mt-1">Live</span>
          </div>
        </div>
      </nav>
    </div>
  );
}
