export type UserRole = 'user' | 'admin' | 'soc_lead';

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: 'ACTIVE' | 'MONITORED' | 'SOFT_BLOCKED' | 'FROZEN';
  threatScore: number; // 0.00 - 1.00 (or 0-100)
  totalRequests: number;
  blockedRequests: number;
  quotaRemaining: number;
  lastActive: string;
  ipAddress: string;
  twoFactorEnabled?: boolean;
}

export type ThreatClassification = 'Safe' | 'Prompt Injection' | 'PII Risk' | 'Jailbreak' | 'Anomaly' | 'Macro Exploit';

export type EnforcementAction = 'PASSED' | 'BLOCKED' | 'REDACTED' | 'FROZEN';

export interface ChatAttachment {
  name: string;
  type: string;
  size?: number;
  content: string;
  zeroWidthCount?: number;
  hasMacros?: boolean;
}

export interface ThreatInspectionResult {
  isThreat: boolean;
  modelUsed: string; // e.g. "Linear SVM Classifier v2.4", "Regex PII Filter v1.8", "Heuristic Anomaly Engine"
  classification: ThreatClassification;
  riskScore: number; // 0.00 - 1.00
  enforcementAction: EnforcementAction;
  latencyMs: number;
  details: {
    svmScore?: number;
    matchedSignatures?: string[];
    piiEntities?: Array<{ type: string; masked: string }>;
    decodedObfuscation?: string | null;
    entropyScore?: number;
  };
  reason: string;
  sanitizedPrompt?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  attachment?: ChatAttachment;
  isAudio?: boolean;
  threatResult?: ThreatInspectionResult;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface GlobalActivityLog {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  clientIp: string;
  modality: 'text' | 'document' | 'audio';
  promptSnippet: string;
  modelUsed: string;
  classification: ThreatClassification;
  riskScore: number; // 0.00 - 1.00
  enforcementAction: EnforcementAction;
  latencyMs: number;
  hash: string;
  previousHash: string;
  fileName?: string;
}

export interface SOCAnalytics {
  totalRequests: number;
  totalBlocked: number;
  avgLatencyMs: number;
  modelAccuracy: number; // e.g. 99.4
  activeFrozenUsers: number;
  trend24h: {
    labels: string[];
    safeCounts: number[];
    blockedCounts: number[];
  };
  modelBreakdown: {
    svm: number;
    regexPii: number;
    jailbreakHeuristic: number;
    anomalyEngine: number;
  };
}
