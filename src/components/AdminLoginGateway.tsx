import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Key, 
  Smartphone, 
  Lock, 
  ArrowRight, 
  ChevronLeft, 
  AlertTriangle, 
  CheckCircle2 
} from 'lucide-react';
import { UserAccount } from '../types';

interface AdminLoginGatewayProps {
  onLoginSuccess: (adminUser: UserAccount) => void;
  onBackToUserPortal: () => void;
}

export const AdminLoginGateway: React.FC<AdminLoginGatewayProps> = ({
  onLoginSuccess,
  onBackToUserPortal,
}) => {
  const [masterKey, setMasterKey] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!masterKey || masterKey.length < 6) {
      setError('Invalid Master Key Password. Clearance denied.');
      return;
    }

    if (totpCode.replace(/\s/g, '').length !== 6) {
      setError('Please provide a valid 6-digit TOTP 2FA authentication code.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterKey, totpCode }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Authentication failure.');
      } else {
        onLoginSuccess(data.user);
      }
    } catch {
      setError('Security gateway connection error.');
    } finally {
      setLoading(false);
    }
  };

  const autoFillDemoCredentials = () => {
    setMasterKey('SENTINEL-MASTER-2026');
    setTotpCode('849201');
  };

  return (
    <div className="min-h-screen bg-[#050811] flex items-center justify-center p-4 text-slate-100 font-sans selection:bg-rose-500/20 selection:text-rose-300">
      <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#090d1a] p-6 sm:p-8 shadow-[0_0_50px_rgba(244,63,94,0.15)] relative overflow-hidden">
        {/* Cyber glow background */}
        <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />

        {/* Back to User Portal */}
        <button
          onClick={onBackToUserPortal}
          className="flex items-center space-x-1 text-xs font-mono text-slate-400 hover:text-white transition-colors mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Return to User Portal</span>
        </button>

        {/* Title & Badge */}
        <div className="space-y-2 text-center pb-4 border-b border-slate-800">
          <div className="mx-auto w-12 h-12 rounded-xl bg-rose-950/60 border border-rose-500/40 flex items-center justify-center shadow-lg">
            <ShieldAlert className="w-6 h-6 text-rose-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            SOC Admin Gateway
          </h1>
          <p className="text-xs text-rose-300/80 font-mono">
            RESTRICTED ACCESS • MANDATORY MASTER KEY & 2FA
          </p>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-950/80 border border-red-800 text-red-200 text-xs font-mono flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 font-mono text-xs">
          {/* Master Key Password */}
          <div>
            <label className="text-slate-300 flex items-center justify-between">
              <span className="flex items-center">
                <Key className="w-3.5 h-3.5 mr-1.5 text-rose-400" /> Master Key Password
              </span>
            </label>
            <input
              type="password"
              value={masterKey}
              onChange={(e) => setMasterKey(e.target.value)}
              placeholder="Enter Master Security Key..."
              required
              className="mt-1.5 w-full rounded-lg bg-slate-950 border border-slate-800 p-2.5 text-sm text-slate-100 focus:border-rose-500 focus:outline-none"
            />
          </div>

          {/* 2FA TOTP Code */}
          <div>
            <label className="text-slate-300 flex items-center justify-between">
              <span className="flex items-center">
                <Smartphone className="w-3.5 h-3.5 mr-1.5 text-cyan-400" /> 6-Digit 2FA TOTP Token
              </span>
              <button
                type="button"
                onClick={autoFillDemoCredentials}
                className="text-[11px] text-cyan-400 hover:underline"
              >
                [Auto-Fill Demo Credentials]
              </button>
            </label>
            <input
              type="text"
              maxLength={7}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              placeholder="e.g. 849 201"
              required
              className="mt-1.5 w-full rounded-lg bg-slate-950 border border-slate-800 p-2.5 text-center text-base font-bold tracking-widest text-cyan-300 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg transition-all"
            >
              {loading ? (
                <span>Validating Clearance...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Authenticate & Enter SOC Portal</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-[11px] text-slate-500 font-mono">
          Strict Multi-Tenant Isolation Enforced by SentinelLLM
        </div>
      </div>
    </div>
  );
};
