import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Activity, 
  Users, 
  Bot, 
  Lock, 
  Unlock, 
  Search, 
  Zap, 
  Cpu, 
  RefreshCw, 
  Clock, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle,
  FileText,
  Mic,
  Send,
  Database,
  Sliders
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { UserAccount, GlobalActivityLog, SOCAnalytics } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface AdminSocPortalProps {
  adminUser: UserAccount;
  onExitToUserPortal: () => void;
}

export const AdminSocPortal: React.FC<AdminSocPortalProps> = ({
  adminUser,
  onExitToUserPortal,
}) => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'analytics' | 'assistant' | 'users'>('monitor');
  const [logs, setLogs] = useState<GlobalActivityLog[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [analytics, setAnalytics] = useState<SOCAnalytics | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Natural Language Log Assistant state
  const [assistantQuery, setAssistantQuery] = useState('');
  const [assistantMessages, setAssistantMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string }>>([
    {
      sender: 'assistant',
      text: `Welcome to the SentinelLLM SOC Log Assistant. You can query any security event in plain English across all tenant logs (e.g., "Show blocked prompt injections by shadow_eval_8921" or "List recent PII exfiltration attempts").`,
    }
  ]);
  const [queryingAssistant, setQueryingAssistant] = useState(false);

  // Load telemetry data from server
  const loadData = async () => {
    setLoading(true);
    try {
      const [actRes, usersRes, analyticsRes] = await Promise.all([
        fetch('/api/admin/activity').then(r => r.json()),
        fetch('/api/admin/users').then(r => r.json()),
        fetch('/api/admin/analytics').then(r => r.json()),
      ]);
      if (actRes?.logs) setLogs(actRes.logs);
      if (usersRes?.users) setUsers(usersRes.users);
      if (analyticsRes?.analytics) setAnalytics(analyticsRes.analytics);
    } catch (err) {
      console.warn('Error loading admin SOC data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000); // Poll every 8s for live stream updates
    return () => clearInterval(interval);
  }, []);

  // Direct User Block / Unblock from the table with immediate effect
  const handleToggleBlockUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/toggle-block`, {
        method: 'POST',
      });
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error('Failed to toggle block:', err);
    }
  };

  // Submit Assistant Query
  const handleAssistantQuery = async (queryText?: string) => {
    const q = (queryText || assistantQuery).trim();
    if (!q || queryingAssistant) return;

    setAssistantMessages(prev => [...prev, { sender: 'user', text: q }]);
    setAssistantQuery('');
    setQueryingAssistant(true);

    try {
      const res = await fetch('/api/assistant/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      setAssistantMessages(prev => [...prev, { sender: 'assistant', text: data.answer || 'Query processed.' }]);
    } catch {
      setAssistantMessages(prev => [...prev, { sender: 'assistant', text: 'Gateway error querying logs.' }]);
    } finally {
      setQueryingAssistant(false);
    }
  };

  // Filter logs by search
  const filteredLogs = logs.filter(l => 
    l.username.toLowerCase().includes(filterQuery.toLowerCase()) ||
    l.clientIp.includes(filterQuery) ||
    l.classification.toLowerCase().includes(filterQuery.toLowerCase()) ||
    l.modelUsed.toLowerCase().includes(filterQuery.toLowerCase()) ||
    l.promptSnippet.toLowerCase().includes(filterQuery.toLowerCase())
  );

  // Chart.js Configuration for 24-Hour Threat Trends
  const chartData = {
    labels: analytics?.trend24h.labels || ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
    datasets: [
      {
        label: 'Safe Ingested Requests (Passed)',
        data: analytics?.trend24h.safeCounts || [120, 180, 420, 680, 590, 480, 310],
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.15)',
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointBackgroundColor: '#06b6d4',
      },
      {
        label: 'Adversarial Threats Neutralized (Blocked/Redacted)',
        data: analytics?.trend24h.blockedCounts || [12, 18, 54, 92, 85, 61, 38],
        borderColor: '#f43f5e',
        backgroundColor: 'rgba(244, 63, 94, 0.2)',
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointBackgroundColor: '#f43f5e',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#94a3b8',
          font: { family: 'Fira Code', size: 11 },
        },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        borderWidth: 1,
        titleColor: '#f1f5f9',
        bodyColor: '#cbd5e1',
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(30, 41, 59, 0.6)' },
        ticks: { color: '#64748b', font: { family: 'Fira Code', size: 11 } },
      },
      y: {
        grid: { color: 'rgba(30, 41, 59, 0.6)' },
        ticks: { color: '#64748b', font: { family: 'Fira Code', size: 11 } },
      },
    },
  };

  return (
    <div className="min-h-screen bg-[#040711] text-slate-100 font-sans selection:bg-rose-500/20 selection:text-rose-300">
      {/* Top SOC Cyber Command Header */}
      <header className="sticky top-0 z-40 border-b border-rose-950/60 bg-[#070b18]/90 backdrop-blur-md">
        <div className="px-4 py-1.5 bg-rose-950/40 border-b border-rose-900/40 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-3">
            <span className="flex items-center text-rose-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping mr-1.5" />
              SOC AIR-GAPPED COMMAND
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">DEFCON 2 • ACTIVE ISOLATION</span>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <span className="text-emerald-400 hidden sm:inline">PIPELINE LATENCY: 1.18ms</span>
          </div>

          <button
            onClick={onExitToUserPortal}
            className="flex items-center space-x-1 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Switch to Standard User View</span>
          </button>
        </div>

        <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-base tracking-tight text-white">
                    Sentinel<span className="text-rose-400">SOC</span>
                  </span>
                  <span className="text-[10px] font-mono uppercase bg-rose-950 px-1.5 py-0.5 rounded border border-rose-800 text-rose-300">
                    Admin Clearance
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">Global Cross-Tenant Threat Inspection & Control</div>
              </div>
            </div>

            {/* Sub-Nav Tabs */}
            <nav className="hidden md:flex items-center space-x-1 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('monitor')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
                  activeTab === 'monitor'
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-800 shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Global Threat Monitor</span>
              </button>

              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
                  activeTab === 'analytics'
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-800 shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>24h Chart.js Metrics</span>
              </button>

              <button
                onClick={() => setActiveTab('assistant')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
                  activeTab === 'assistant'
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-800 shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Log Assistant</span>
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
                  activeTab === 'users'
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-800 shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Tenants ({users.length})</span>
              </button>
            </nav>
          </div>

          <div className="flex items-center space-x-3 text-xs font-mono">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:text-white text-slate-400 transition-colors"
              title="Refresh Stream"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="text-right hidden sm:block">
              <div className="font-bold text-slate-200">{adminUser.username}</div>
              <div className="text-[10px] text-rose-400 font-mono">SOC Commander (2FA Active)</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main SOC Body */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50">
            <div className="text-slate-400 uppercase text-[10px]">TOTAL REQUESTS EVALUATED</div>
            <div className="text-2xl font-black text-white mt-1">
              {analytics?.totalRequests.toLocaleString() || '2,844'}
            </div>
            <div className="text-[10px] text-cyan-400 mt-0.5">Across all tenant streams</div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50">
            <div className="text-slate-400 uppercase text-[10px]">THREATS ISOLATED</div>
            <div className="text-2xl font-black text-rose-400 mt-1">
              {analytics?.totalBlocked.toLocaleString() || '516'}
            </div>
            <div className="text-[10px] text-rose-300/80 mt-0.5">Prompt Injections & Jailbreaks</div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50">
            <div className="text-slate-400 uppercase text-[10px]">MODEL ACCURACY</div>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {analytics?.modelAccuracy || 99.4}%
            </div>
            <div className="text-[10px] text-emerald-400/80 mt-0.5">Linear SVM + Heuristic Benchmark</div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50">
            <div className="text-slate-400 uppercase text-[10px]">FROZEN TENANT ACCOUNTS</div>
            <div className="text-2xl font-black text-red-500 mt-1">
              {users.filter(u => u.status === 'FROZEN').length}
            </div>
            <div className="text-[10px] text-red-400 mt-0.5">Immediate containment enforced</div>
          </div>
        </div>

        {/* VIEW 1: GLOBAL THREAT MONITORING TABLE */}
        {activeTab === 'monitor' && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden space-y-4 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center">
                  <Activity className="w-4 h-4 mr-2 text-rose-400 animate-pulse" />
                  Live Cross-Tenant Security Stream
                </h3>
                <p className="text-xs text-slate-400">
                  Real-time prompt submissions, uploaded files, and voice scans with exact model attribution & action buttons.
                </p>
              </div>

              {/* Filter */}
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filter by user, IP, classification, model..."
                  className="w-full bg-slate-950 border border-slate-800 pl-8 pr-3 py-1.5 rounded-lg text-xs font-mono text-slate-200 focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Activity Stream Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-slate-800 bg-slate-950/70 text-slate-400 uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp / ID</th>
                    <th className="py-2.5 px-3">Tenant & Origin IP</th>
                    <th className="py-2.5 px-3">Modality & Payload</th>
                    <th className="py-2.5 px-3">Exact ML Model Used</th>
                    <th className="py-2.5 px-3">Classification</th>
                    <th className="py-2.5 px-3">Risk Score</th>
                    <th className="py-2.5 px-3">Action Enforced</th>
                    <th className="py-2.5 px-3 text-right">User Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredLogs.map((log) => {
                    const userObj = users.find(u => u.id === log.userId);
                    const isFrozen = userObj?.status === 'FROZEN';

                    return (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 whitespace-nowrap text-slate-400">
                          <div className="text-slate-200 font-bold">{log.id}</div>
                          <div className="text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</div>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-semibold text-white flex items-center space-x-1.5">
                            <span>{log.username}</span>
                            {isFrozen && (
                              <span className="text-[9px] bg-red-950 text-red-400 border border-red-800 px-1 rounded">FROZEN</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500">{log.clientIp}</div>
                        </td>

                        <td className="py-3 px-3 max-w-xs truncate text-slate-300">
                          <div className="flex items-center space-x-1 text-[10px] text-slate-400 mb-0.5">
                            {log.modality === 'document' ? <FileText className="w-3 h-3 text-cyan-400" /> :
                             log.modality === 'audio' ? <Mic className="w-3 h-3 text-purple-400" /> : null}
                            <span className="uppercase">{log.modality}</span>
                            {log.fileName && <span className="text-cyan-300 font-semibold truncate">({log.fileName})</span>}
                          </div>
                          <span className="truncate">"{log.promptSnippet}"</span>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-300 text-[11px] font-semibold">
                            {log.modelUsed}
                          </span>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.classification === 'Safe' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                            log.classification === 'Prompt Injection' ? 'bg-red-950 text-red-400 border border-red-800' :
                            log.classification === 'PII Risk' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                            'bg-purple-950 text-purple-400 border border-purple-800'
                          }`}>
                            {log.classification}
                          </span>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`font-bold ${
                            log.riskScore > 0.7 ? 'text-red-400' :
                            log.riskScore > 0.3 ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {log.riskScore.toFixed(2)}
                          </span>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.enforcementAction === 'BLOCKED' ? 'bg-red-900/80 text-red-200 border border-red-700' :
                            log.enforcementAction === 'REDACTED' ? 'bg-amber-900/80 text-amber-200 border border-amber-700' :
                            'bg-emerald-900/50 text-emerald-300 border border-emerald-700'
                          }`}>
                            {log.enforcementAction}
                          </span>
                        </td>

                        {/* Direct User Block / Unblock action */}
                        <td className="py-3 px-3 whitespace-nowrap text-right">
                          <button
                            onClick={() => handleToggleBlockUser(log.userId)}
                            className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all flex items-center space-x-1 ml-auto ${
                              isFrozen
                                ? 'bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-800'
                                : 'bg-red-950 text-red-300 hover:bg-red-900 border border-red-800'
                            }`}
                            title={isFrozen ? 'Restore tenant access' : 'Immediately freeze user tenant'}
                          >
                            {isFrozen ? (
                              <>
                                <Unlock className="w-3 h-3" />
                                <span>Unblock User</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3 h-3" />
                                <span>Block User</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 2: INTERACTIVE 24H THREAT TREND CHART (CHART.JS) */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-white text-base">24-Hour Threat Trend & Ingestion Velocity</h3>
                  <p className="text-xs text-slate-400">
                    Real-time Chart.js rendering of safe payload throughput versus blocked adversarial injections.
                  </p>
                </div>
                <span className="text-xs font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                  Chart.js Interactive Engine
                </span>
              </div>

              {/* Chart.js Line Chart */}
              <div className="h-80 w-full pt-2">
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>

            {/* Model Architecture & Latency Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-2">
                <div className="font-bold text-cyan-300 flex items-center">
                  <Zap className="w-4 h-4 mr-1.5" /> Linear SVM v2.4 (OWASP LLM01)
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Inference latency calibrated at <strong>0.85ms - 1.25ms</strong>. Hyperplane separating vector boundary isolates delimiter tampering and system prompt leaks.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-2">
                <div className="font-bold text-amber-300 flex items-center">
                  <Lock className="w-4 h-4 mr-1.5" /> Regex PII Sanitizer v1.8
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Luhn algorithm verification on credit cards, active pattern matching for AWS / OpenAI keys, SSN, and session passwords with token replacement.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-2">
                <div className="font-bold text-purple-300 flex items-center">
                  <Cpu className="w-4 h-4 mr-1.5" /> Heuristic Anomaly Engine
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Shannon Entropy detector flags obfuscated and binary payloads; zero-width Unicode scanner removes invisible steganographic evasion strings.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: NATURAL LANGUAGE LOG ASSISTANT (CHATGPT-STYLE SEARCH) */}
        {activeTab === 'assistant' && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center">
                  <Bot className="w-4 h-4 mr-2 text-rose-400" />
                  Natural Language SOC Log Assistant
                </h3>
                <p className="text-xs text-slate-400">
                  Search cross-tenant audit trails in natural language (powered by Gemini neural forensics).
                </p>
              </div>
            </div>

            {/* Quick Query Chips */}
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              {[
                'Show blocked prompt injections by shadow_eval_8921',
                'Which tenant had the highest risk score in the last 2 hours?',
                'List all PII leaks containing AWS credentials',
                'Summarize model performance across all 4 defense layers',
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAssistantQuery(chip)}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-rose-500/50 text-slate-300 hover:text-white transition-all text-left"
                >
                  "{chip}"
                </button>
              ))}
            </div>

            {/* Chat Thread */}
            <div className="h-96 overflow-y-auto rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-3 font-mono text-xs">
              {assistantMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-2xl rounded-xl p-3.5 leading-relaxed whitespace-pre-wrap ${
                    msg.sender === 'user'
                      ? 'bg-rose-950/70 border border-rose-800 text-rose-100'
                      : 'bg-slate-900 border border-slate-800 text-slate-200'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}

              {queryingAssistant && (
                <div className="flex items-center space-x-2 text-xs text-rose-400 animate-pulse">
                  <Zap className="w-4 h-4 animate-spin" />
                  <span>Cross-referencing database audit logs and evaluating security query...</span>
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAssistantQuery();
              }}
              className="flex items-center space-x-2"
            >
              <input
                type="text"
                value={assistantQuery}
                onChange={(e) => setAssistantQuery(e.target.value)}
                placeholder="Ask plain English question about logs (e.g. 'Show attacks from IP 185.220.101.5')..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-xs font-mono text-slate-100 focus:border-rose-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={queryingAssistant || !assistantQuery.trim()}
                className="px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs font-mono uppercase tracking-wider disabled:opacity-50 transition-all flex items-center space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Search</span>
              </button>
            </form>
          </div>
        )}

        {/* VIEW 4: USER & TENANT MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Multi-Tenant User Management & Enforcement</h3>
              <p className="text-xs text-slate-400">
                Manage user isolation policies, view risk ratings, and apply immediate session isolation.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-slate-800 bg-slate-950/70 text-slate-400 uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Username</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Threat Score</th>
                    <th className="py-2.5 px-3">Requests (Blocked/Total)</th>
                    <th className="py-2.5 px-3">IP Address</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-semibold text-white">{u.username}</td>
                      <td className="py-3 px-3 text-slate-400">{u.email}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.role === 'admin' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-slate-900 text-slate-300'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.status === 'FROZEN' ? 'bg-red-950 text-red-400 border border-red-800' :
                          u.status === 'MONITORED' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                          'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-white">
                        {(u.threatScore * 100).toFixed(0)} / 100
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        <span className="text-rose-400 font-bold">{u.blockedRequests}</span> / {u.totalRequests}
                      </td>
                      <td className="py-3 px-3 text-slate-400">{u.ipAddress}</td>
                      <td className="py-3 px-3 text-right">
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => handleToggleBlockUser(u.id)}
                            className={`px-3 py-1 rounded text-[11px] font-bold transition-all ${
                              u.status === 'FROZEN'
                                ? 'bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-800'
                                : 'bg-red-950 text-red-300 hover:bg-red-900 border border-red-800'
                            }`}
                          >
                            {u.status === 'FROZEN' ? 'Unblock Tenant' : 'Freeze & Block'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
