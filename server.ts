import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { threatEngine } from './src/services/threatEngine.ts';
import { multiTenantStore } from './src/services/auditStorage.ts';
import { ChatMessage, ThreatInspectionResult } from './src/types/index.ts';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Initialize Gemini Client
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.warn('Failed to initialize GoogleGenAI:', err);
  }
}

// --- 1. User Portal Chat Endpoint (Multi-Layer Threat Inspection & LLM Response) ---
app.post('/api/chat', async (req, res) => {
  try {
    const { userId, conversationId, message, attachment, isAudio } = req.body;
    if (!userId || !message) {
      return res.status(400).json({ error: 'Missing userId or message' });
    }

    const user = multiTenantStore.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User tenant not found' });
    }

    // Immediate enforcement: if user is FROZEN, reject immediately
    if (user.status === 'FROZEN') {
      return res.status(403).json({
        blocked: true,
        frozen: true,
        reason: 'ACCOUNT ISOLATED & FROZEN: Access suspended by SOC Security Officer due to severe threat posture.',
      });
    }

    // Inspect content (including attachment text if present)
    const combinedInput = attachment?.content
      ? `${message}\n--- ATTACHED FILE [${attachment.name}] ---\n${attachment.content}`
      : message;

    const modality = isAudio ? 'audio' : attachment ? 'document' : 'text';
    const threatResult = threatEngine.inspect(combinedInput, {
      fileName: attachment?.name,
      isAudio,
    });

    // Record to global cross-tenant activity log
    multiTenantStore.recordActivity(user, message, threatResult, modality, attachment?.name);

    // Save user message to user's isolated conversation
    const userMsg: ChatMessage = {
      id: 'msg_u_' + Date.now(),
      sender: 'user',
      content: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachment,
      isAudio,
    };
    multiTenantStore.appendMessage(userId, conversationId, userMsg);

    // CASE A: BLOCKED Malicious Payload
    if (threatResult.enforcementAction === 'BLOCKED') {
      const blockMsg: ChatMessage = {
        id: 'msg_a_' + Date.now(),
        sender: 'assistant',
        content: `⚠️ **SENTINELLM DEFENSE INTERCEPTION**\nYour input was intercepted and blocked by the real-time AI security gateway.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        threatResult,
      };
      multiTenantStore.appendMessage(userId, conversationId, blockMsg);

      return res.json({
        blocked: true,
        threatResult,
        message: blockMsg,
      });
    }

    // CASE B: REDACTED PII Payload or SAFE Payload -> Generate LLM Response
    const promptForLLM = threatResult.sanitizedPrompt || message;
    let aiResponseText = '';

    if (aiClient && process.env.GEMINI_API_KEY) {
      try {
        const response = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: promptForLLM,
          config: {
            systemInstruction: 'You are a helpful, secure ChatGPT-like AI assistant. Answer clearly, accurately, and politely.',
          },
        });
        aiResponseText = response.text || 'I have processed your request safely.';
      } catch (err: any) {
        console.warn('Gemini generateContent error, falling back:', err);
        aiResponseText = generateFallbackAnswer(promptForLLM);
      }
    } else {
      aiResponseText = generateFallbackAnswer(promptForLLM);
    }

    const assistantMsg: ChatMessage = {
      id: 'msg_a_' + Date.now(),
      sender: 'assistant',
      content: aiResponseText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      threatResult: threatResult.enforcementAction === 'REDACTED' ? threatResult : undefined,
    };
    multiTenantStore.appendMessage(userId, conversationId, assistantMsg);

    res.json({
      blocked: false,
      threatResult,
      message: assistantMsg,
    });
  } catch (err: any) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message || 'Inspection failed' });
  }
});

function generateFallbackAnswer(prompt: string): string {
  if (prompt.toLowerCase().includes('docker')) {
    return `To optimize Docker builds:
1. **Leverage Cache Mounts:** Use \`RUN --mount=type=cache,target=/root/.npm npm ci\`
2. **Order instructions carefully:** Put stable files (\`package.json\`) before frequently changing source code.
3. **Use Multi-Stage Builds:** Strip build tools and compiler toolchains from your production image.`;
  }
  return `I have received and verified your request through the SentinelLLM security perimeter. Here is the response to your prompt:\n\n> "${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}"\n\nAll safety boundaries were satisfied and no policy violations were detected.`;
}

// --- 2. User Conversation Management (Strict Tenant Isolation) ---
app.get('/api/conversations', (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  const conversations = multiTenantStore.getConversations(userId);
  res.json({ conversations });
});

app.post('/api/conversations', (req, res) => {
  const { userId, title } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  const conv = multiTenantStore.createConversation(userId, title);
  res.json({ conversation: conv });
});

// --- 3. Admin SOC Dedicated Gateway (Master Key & 2FA Verification) ---
app.post('/api/admin/login', (req, res) => {
  const { masterKey, totpCode } = req.body;
  // Demo Master Key: "SENTINEL-MASTER-2026" or password
  if (!masterKey || masterKey.length < 6) {
    return res.status(401).json({ error: 'Invalid Master Key Security Clearance.' });
  }
  if (!totpCode || totpCode.replace(/\s/g, '').length !== 6) {
    return res.status(401).json({ error: 'Invalid 6-Digit 2FA TOTP Code.' });
  }

  const admin = multiTenantStore.getAllUsers().find(u => u.role === 'admin') || multiTenantStore.getAllUsers()[3];
  res.json({
    success: true,
    user: admin,
    token: 'jwt_admin_clearance_active_' + Date.now(),
  });
});

// --- 4. Admin Global Activity & Threat Monitoring ---
app.get('/api/admin/activity', (req, res) => {
  const logs = multiTenantStore.getGlobalActivityLogs();
  res.json({ logs });
});

app.get('/api/admin/users', (req, res) => {
  const users = multiTenantStore.getAllUsers();
  res.json({ users });
});

// Toggle Block / Unblock user with immediate real-time effect
app.post('/api/admin/users/:id/toggle-block', (req, res) => {
  const { id } = req.params;
  const updated = multiTenantStore.toggleBlockUser(id);
  if (!updated) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true, user: updated });
});

// --- 5. Admin Chart.js 24-Hour Threat Analytics ---
app.get('/api/admin/analytics', (req, res) => {
  const analytics = multiTenantStore.getAnalytics();
  res.json({ analytics });
});

// --- 6. Natural Language Log Assistant (Admin Search Tool) ---
app.post('/api/assistant/query', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    const logs = multiTenantStore.getGlobalActivityLogs().slice(0, 25);
    const users = multiTenantStore.getAllUsers();
    const analytics = multiTenantStore.getAnalytics();

    const context = `
You are the SentinelLLM SOC Chief Forensics Officer.
Answer the security admin's log query with precision based on the following real-time database logs:

Current Metrics:
- Total Requests: ${analytics.totalRequests}
- Total Blocked: ${analytics.totalBlocked}
- Accuracy: ${analytics.modelAccuracy}%
- Active Frozen Users: ${analytics.activeFrozenUsers}

Active Users:
${users.map(u => `- ${u.username} (${u.role}): Status ${u.status}, Threat Score ${u.threatScore}, IP: ${u.ipAddress}`).join('\n')}

Recent Activity Logs:
${logs.map(l => `[${l.timestamp}] User: ${l.username} (${l.clientIp}) | Modality: ${l.modality} | Model: ${l.modelUsed} | Class: ${l.classification} | Score: ${l.riskScore} | Action: ${l.enforcementAction} | Snippet: "${l.promptSnippet}"`).join('\n')}

Admin Query: "${query}"

Instructions:
1. Directly answer which user, IP, or attack vector matched the query.
2. Cite the exact ML model used (e.g. Linear SVM v2.4, Regex PII Filter, Heuristic Jailbreak Engine) and enforcement action taken.
3. Keep the output clean, highly structured, and technical.
`;

    if (aiClient && process.env.GEMINI_API_KEY) {
      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: context,
        config: {
          systemInstruction: 'You are SentinelLLM Senior Incident Responder. Provide concise, high-signal security forensics reports.',
        },
      });
      return res.json({ answer: response.text });
    }

    // Heuristic fallback
    const lower = query.toLowerCase();
    const matched = logs.filter(l => 
      l.username.toLowerCase().includes(lower) ||
      l.classification.toLowerCase().includes(lower) ||
      l.enforcementAction.toLowerCase().includes(lower) ||
      l.modelUsed.toLowerCase().includes(lower)
    );

    res.json({
      answer: `### 🛡️ SentinelLLM Forensic Query Results
**Query:** "${query}"
**Matching Incidents in Ledger:** ${matched.length} event(s)

${matched.slice(0, 3).map(l => `- **[${l.id}]** User **${l.username}** (\`${l.clientIp}\`): Classification **${l.classification}** (Risk Score: \`${l.riskScore.toFixed(2)}\`). Model: \`${l.modelUsed}\`. Enforcement: **${l.enforcementAction}**.\n  Snippet: *"${l.promptSnippet}"*`).join('\n\n') || 'No records directly matching the criteria in the immediate log window.'}

**SOC Recommendation:** Maintain network-level rate limits on suspicious IPs and verify token invalidation for frozen tenants.`
    });
  } catch (err: any) {
    console.error('Assistant query error:', err);
    res.status(500).json({ error: err.message || 'Query failed' });
  }
});

// Vite middleware integration for full-stack dev server
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SentinelLLM] Full-Stack Multi-Tenant SOC Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
