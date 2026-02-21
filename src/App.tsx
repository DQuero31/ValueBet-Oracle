import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Shield, 
  History, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Wallet,
  Target,
  BarChart3,
  ChevronRight,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeEvent } from './services/geminiService';
import { Sport, EventOdds, Bankroll, Bet, Bookmaker, Market, Odd } from './types';

// --- Components ---

const Card = ({ children, className = "", ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) => (
  <div className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-6 ${className}`} {...props}>
    {children}
  </div>
);

const Badge = ({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "danger" | "warning" }) => {
  const variants = {
    default: "bg-zinc-800 text-zinc-400",
    success: "bg-emerald-500/10 text-emerald-500",
    danger: "bg-rose-500/10 text-rose-500",
    warning: "bg-amber-500/10 text-amber-500",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${variants[variant]}`}>
      {children}
    </span>
  );
};

// --- Main App ---

export default function App() {
  const [bankroll, setBankroll] = useState<Bankroll | null>(null);
  const [sports, setSports] = useState<Sport[]>([]);
  const [selectedSport, setSelectedSport] = useState<string>('soccer_uefa_champs_league');
  const [events, setEvents] = useState<EventOdds[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeAnalysis, setActiveAnalysis] = useState<{
    event: EventOdds;
    outcome: Odd;
    marketKey: string;
    bookmaker: string;
    fairOdd?: number;
    probability?: number;
    edge?: number;
    stake?: number;
    notes?: string;
  } | null>(null);
  const [history, setHistory] = useState<Bet[]>([]);
  const [view, setView] = useState<'dashboard' | 'history' | 'settings'>('dashboard');
  const [riskModel, setRiskModel] = useState<'Fractional Kelly' | 'Full Kelly' | 'Safe'>('Fractional Kelly');
  const [manualOdd, setManualOdd] = useState<string>('');

  useEffect(() => {
    fetchBankroll();
    fetchSports();
    fetchHistory();
  }, []);

  useEffect(() => {
    if (selectedSport) fetchOdds(selectedSport);
  }, [selectedSport]);

  const fetchBankroll = async () => {
    const res = await fetch('/api/bankroll');
    const data = await res.json();
    setBankroll(data);
  };

  const fetchSports = async () => {
    const res = await fetch('/api/sports');
    const data = await res.json();
    setSports(data.filter((s: Sport) => s.active));
  };

  const fetchOdds = async (sport: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/odds?sport=${sport}`);
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    const res = await fetch('/api/bets');
    const data = await res.json();
    setHistory(data);
  };

  const handleAnalyze = async (event: EventOdds, bookmaker: Bookmaker, market: Market, outcome: Odd) => {
    setAnalyzing(true);
    setActiveAnalysis({ event, outcome, marketKey: market.key, bookmaker: bookmaker.title });
    
    const currentOdd = manualOdd ? parseFloat(manualOdd) : outcome.price;
    const analysis = await analyzeEvent(
      `${event.home_team} vs ${event.away_team}`,
      `${market.key}: ${outcome.name}`,
      currentOdd
    );

    const edge = ((currentOdd / analysis.fairOdd) - 1) * 100;
    
    // Kelly Criterion
    // Stake % = [ (Prob * (Odds - 1) - (1 - Prob)) / (Odds - 1) ] * Multiplier
    const prob = analysis.probability;
    const odds = currentOdd;
    const multiplier = riskModel === 'Full Kelly' ? 1 : riskModel === 'Safe' ? 0.1 : 0.25;
    
    let stakePct = ((prob * (odds - 1) - (1 - prob)) / (odds - 1)) * multiplier;
    if (stakePct < 0) stakePct = 0;
    
    const stakeAmount = bankroll ? bankroll.amount * stakePct : 0;

    setActiveAnalysis(prev => prev ? ({
      ...prev,
      fairOdd: analysis.fairOdd,
      probability: analysis.probability,
      edge: edge,
      stake: stakeAmount,
      notes: analysis.notes
    }) : null);
    
    setAnalyzing(false);
  };

  const placeBet = async () => {
    if (!activeAnalysis || !activeAnalysis.stake) return;

    const res = await fetch('/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: `${activeAnalysis.event.home_team} vs ${activeAnalysis.event.away_team}`,
        market: `${activeAnalysis.marketKey}: ${activeAnalysis.outcome.name}`,
        odds: manualOdd ? parseFloat(manualOdd) : activeAnalysis.outcome.price,
        fair_odds: activeAnalysis.fairOdd,
        edge: activeAnalysis.edge,
        stake: activeAnalysis.stake
      })
    });

    if (res.ok) {
      fetchBankroll();
      fetchHistory();
      setActiveAnalysis(null);
      setManualOdd('');
    }
  };

  const updateResult = async (id: number, status: string) => {
    await fetch(`/api/bets/${id}/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    fetchBankroll();
    fetchHistory();
  };

  const resetBankroll = async (amount: number) => {
    await fetch('/api/bankroll/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    });
    fetchBankroll();
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Navigation */}
      <nav className="border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-black" />
            </div>
            <span className="font-bold text-lg tracking-tight">ValueBet Oracle</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => setView('dashboard')} className={`text-sm font-medium transition-colors ${view === 'dashboard' ? 'text-emerald-500' : 'text-zinc-400 hover:text-zinc-100'}`}>Dashboard</button>
            <button onClick={() => setView('history')} className={`text-sm font-medium transition-colors ${view === 'history' ? 'text-emerald-500' : 'text-zinc-400 hover:text-zinc-100'}`}>History</button>
            <button onClick={() => setView('settings')} className={`text-sm font-medium transition-colors ${view === 'settings' ? 'text-emerald-500' : 'text-zinc-400 hover:text-zinc-100'}`}>Settings</button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Stats Header */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Wallet className="w-12 h-12" />
                  </div>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Current Bankroll</p>
                  <h2 className="text-3xl font-mono font-bold text-emerald-500">
                    ${bankroll?.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h2>
                  <div className="mt-4 flex items-center gap-2">
                    <Badge variant={((bankroll?.amount || 0) >= (bankroll?.initial_amount || 0)) ? "success" : "danger"}>
                      {(((bankroll?.amount || 0) / (bankroll?.initial_amount || 1) - 1) * 100).toFixed(1)}% Total ROI
                    </Badge>
                  </div>
                </Card>

                <Card className="relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Target className="w-12 h-12" />
                  </div>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Active Bets</p>
                  <h2 className="text-3xl font-mono font-bold">
                    {history.filter(b => b.status === 'pending').length}
                  </h2>
                  <p className="text-zinc-500 text-xs mt-4">Total Stake: ${history.filter(b => b.status === 'pending').reduce((acc, b) => acc + b.stake, 0).toFixed(2)}</p>
                </Card>

                <Card className="relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <BarChart3 className="w-12 h-12" />
                  </div>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Risk Strategy</p>
                  <h2 className="text-3xl font-bold">{riskModel}</h2>
                  <p className="text-zinc-500 text-xs mt-4">Multiplier: {riskModel === 'Full Kelly' ? '1.0x' : riskModel === 'Safe' ? '0.1x' : '0.25x'}</p>
                </Card>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Odds Feed */}
                <div className="lg:col-span-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <select 
                        value={selectedSport}
                        onChange={(e) => setSelectedSport(e.target.value)}
                        className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {sports.map(s => (
                          <option key={s.key} value={s.key}>{s.title}</option>
                        ))}
                      </select>
                      <button 
                        onClick={() => fetchOdds(selectedSport)}
                        className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors"
                      >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-24 bg-zinc-900/50 animate-pulse rounded-2xl border border-zinc-800" />
                      ))
                    ) : events.length === 0 ? (
                      <div className="text-center py-12 text-zinc-500">No active events found for this sport.</div>
                    ) : (
                      events.map(event => (
                        <Card key={event.id} className="hover:border-zinc-700 transition-colors">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">
                                {new Date(event.commence_time).toLocaleString()}
                              </p>
                              <h3 className="text-lg font-bold">
                                {event.home_team} <span className="text-zinc-500 font-normal">vs</span> {event.away_team}
                              </h3>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {event.bookmakers.slice(0, 3).map(bm => (
                                <div key={bm.key} className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                                  <p className="text-[9px] text-zinc-500 font-bold uppercase mb-2">{bm.title}</p>
                                  <div className="flex gap-2">
                                    {bm.markets[0]?.outcomes.map(outcome => (
                                      <button 
                                        key={outcome.name}
                                        onClick={() => handleAnalyze(event, bm, bm.markets[0], outcome)}
                                        className="px-3 py-1 bg-zinc-900 hover:bg-emerald-500 hover:text-black transition-all rounded-lg text-xs font-mono font-bold border border-zinc-800"
                                      >
                                        {outcome.name.split(' ').pop()}: {outcome.price.toFixed(2)}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </div>

                {/* Right Column: Analysis & Oracle */}
                <div className="lg:col-span-4">
                  <div className="sticky top-24 space-y-6">
                    <Card className="border-emerald-500/20 bg-emerald-500/[0.02]">
                      <div className="flex items-center gap-2 mb-6">
                        <Shield className="w-5 h-5 text-emerald-500" />
                        <h3 className="font-bold">Oracle Analysis</h3>
                      </div>

                      {!activeAnalysis ? (
                        <div className="text-center py-12">
                          <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-6 h-6 text-zinc-700" />
                          </div>
                          <p className="text-sm text-zinc-500">Select a market outcome to begin AI analysis.</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="border-b border-zinc-800 pb-4">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                              🏟️ EVENT: {activeAnalysis.event.home_team} vs {activeAnalysis.event.away_team}
                            </h3>
                            <p className="text-sm mt-1">
                              <strong>Market:</strong> {activeAnalysis.marketKey}: {activeAnalysis.outcome.name}
                            </p>
                            <ul className="mt-3 space-y-1 text-sm">
                              <li>• <strong>Best Market Odd:</strong> {activeAnalysis.outcome.price.toFixed(2)} ({activeAnalysis.bookmaker})</li>
                              <li>• <strong>AI Fair Odd:</strong> {analyzing ? '...' : activeAnalysis.fairOdd?.toFixed(2)}</li>
                              <li>• <strong>Calculated Edge:</strong> {analyzing ? '...' : <span className={(activeAnalysis.edge || 0) > 0 ? 'text-emerald-500' : 'text-rose-500'}>{(activeAnalysis.edge || 0).toFixed(2)}%</span>}</li>
                            </ul>
                          </div>

                          <div className="border-b border-zinc-800 pb-4">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                              📈 STRATEGY & STAKE
                            </h3>
                            <ul className="mt-3 space-y-1 text-sm">
                              <li>• <strong>Current Bankroll:</strong> ${bankroll?.amount.toFixed(2)}</li>
                              <li>• <strong>Risk Model:</strong> {riskModel}</li>
                              <li>• <strong>Recommended Stake:</strong> <strong className="text-emerald-500">${activeAnalysis.stake?.toFixed(2) || '0.00'}</strong> ({((activeAnalysis.stake || 0) / (bankroll?.amount || 1) * 100).toFixed(1)}% of Bank)</li>
                            </ul>
                          </div>

                          <div>
                            <h3 className="text-lg font-bold flex items-center gap-2">
                              🧠 ANALYST NOTES
                            </h3>
                            <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                              {analyzing ? 'Oracle is processing advanced metrics...' : activeAnalysis.notes}
                            </p>
                          </div>

                          <div className="space-y-3 pt-4 border-t border-zinc-800">
                            <div className="flex flex-col gap-2">
                              <label className="text-[10px] text-zinc-500 font-bold uppercase">Manual Odd Override</label>
                              <input 
                                type="number" 
                                step="0.01"
                                value={manualOdd}
                                onChange={(e) => setManualOdd(e.target.value)}
                                placeholder="Enter current odd..."
                                className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </div>
                            <button 
                              disabled={analyzing || !activeAnalysis.stake || activeAnalysis.stake <= 0}
                              onClick={placeBet}
                              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                              {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                              Place Value Bet
                            </button>
                            <p className="text-[10px] text-center text-zinc-600 italic">
                              "Is this the odd you see in your bookmaker? If not, tell me the current odd to recalculate."
                            </p>
                          </div>
                        </div>
                      )}
                    </Card>

                    {/* Quick Stats */}
                    <Card>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Performance Log</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-zinc-400">Win Rate</span>
                          <span className="text-xs font-mono font-bold">
                            {history.filter(b => b.status !== 'pending').length > 0 
                              ? ((history.filter(b => b.status === 'win').length / history.filter(b => b.status !== 'pending' && b.status !== 'void').length) * 100).toFixed(1)
                              : '0.0'}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-zinc-400">Avg. Edge</span>
                          <span className="text-xs font-mono font-bold text-emerald-500">
                            {history.length > 0 ? (history.reduce((acc, b) => acc + b.edge, 0) / history.length).toFixed(2) : '0.00'}%
                          </span>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Betting History</h2>
                <div className="flex gap-4">
                  <Badge variant="success">Wins: {history.filter(b => b.status === 'win').length}</Badge>
                  <Badge variant="danger">Losses: {history.filter(b => b.status === 'loss').length}</Badge>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                      <th className="py-4 px-4">Date</th>
                      <th className="py-4 px-4">Event / Market</th>
                      <th className="py-4 px-4">Odds (Fair)</th>
                      <th className="py-4 px-4">Edge</th>
                      <th className="py-4 px-4">Stake</th>
                      <th className="py-4 px-4">Status</th>
                      <th className="py-4 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {history.map(bet => (
                      <tr key={bet.id} className="hover:bg-zinc-900/50 transition-colors group">
                        <td className="py-4 px-4 text-xs text-zinc-500 font-mono">
                          {new Date(bet.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-sm font-bold">{bet.event}</p>
                          <p className="text-[10px] text-zinc-500">{bet.market}</p>
                        </td>
                        <td className="py-4 px-4 font-mono text-sm">
                          {bet.odds.toFixed(2)} <span className="text-zinc-600">({bet.fair_odds.toFixed(2)})</span>
                        </td>
                        <td className={`py-4 px-4 font-mono text-sm ${bet.edge > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {bet.edge.toFixed(2)}%
                        </td>
                        <td className="py-4 px-4 font-mono text-sm">
                          ${bet.stake.toFixed(2)}
                        </td>
                        <td className="py-4 px-4">
                          {bet.status === 'pending' ? (
                            <Badge variant="warning">Pending</Badge>
                          ) : bet.status === 'win' ? (
                            <Badge variant="success">Win</Badge>
                          ) : bet.status === 'loss' ? (
                            <Badge variant="danger">Loss</Badge>
                          ) : (
                            <Badge>Void</Badge>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right">
                          {bet.status === 'pending' && (
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => updateResult(bet.id, 'win')} className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500 hover:text-black transition-all">
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => updateResult(bet.id, 'loss')} className="p-1.5 bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-black transition-all">
                                <XCircle className="w-4 h-4" />
                              </button>
                              <button onClick={() => updateResult(bet.id, 'void')} className="p-1.5 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 transition-all">
                                <AlertCircle className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {view === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <h2 className="text-2xl font-bold">Settings & Configuration</h2>
              
              <Card className="space-y-6">
                <div>
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-500" />
                    Risk Management
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    {(['Safe', 'Fractional Kelly', 'Full Kelly'] as const).map(model => (
                      <button 
                        key={model}
                        onClick={() => setRiskModel(model)}
                        className={`p-4 rounded-xl border transition-all text-center ${riskModel === model ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-700'}`}
                      >
                        <p className="text-xs font-bold uppercase tracking-widest">{model}</p>
                        <p className="text-[10px] mt-1 opacity-60">
                          {model === 'Safe' ? '0.1x Multiplier' : model === 'Full Kelly' ? '1.0x Multiplier' : '0.25x Multiplier'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-zinc-800">
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-500" />
                    Bankroll Management
                  </h3>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => resetBankroll(1000)}
                      className="flex-1 py-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors text-sm font-bold"
                    >
                      Reset to $1,000
                    </button>
                    <button 
                      onClick={() => resetBankroll(5000)}
                      className="flex-1 py-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors text-sm font-bold"
                    >
                      Reset to $5,000
                    </button>
                  </div>
                </div>
              </Card>

              <Card className="border-amber-500/20 bg-amber-500/[0.02]">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-amber-500 mb-1">Responsible Betting</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Value betting is a long-term strategy based on statistical edges. Variance is real, and losing streaks can happen even with +EV bets. Never bet more than you can afford to lose.
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
