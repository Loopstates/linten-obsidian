// Obsidian API Client for Linten Cloud
// Cross-platform compatibility using Web Crypto (Desktop & Mobile) and Obsidian requestUrl

import { requestUrl, RequestUrlParam } from 'obsidian';

const CLIENT_SECRET = 'linten_loopstates_sec_handshake_2026';

export interface LintenValidationResponse {
  ok: boolean;
  error?: string;
  report?: {
    scores?: {
      overall: number;
      structure: number;
      links: number;
      bestPractices: number;
    };
    findings?: Array<{
      id: string;
      severity: 'success' | 'warning' | 'error';
      category: string;
      title: string;
      detail?: string;
      recommendation?: string;
    }>;
    document?: {
      title?: string;
      hasTitle?: boolean;
      summary?: string;
      hasSummary?: boolean;
      sections?: Array<{
        name: string;
        optional: boolean;
        links: Array<{
          text: string;
          url: string;
          desc?: string;
          line?: number;
        }>;
      }>;
    };
  };
  linkStats?: {
    total: number;
    ok: number;
    broken: number;
    redirect: number;
    skipped?: number;
  };
  specialist?: {
    metrics?: {
      estimatedTokens: number;
      wordCount: number;
      tokenStatus: string;
      tokenRecommendation: string;
    };
    dualFileParity?: {
      hasCompanion: boolean;
      companionRecommendation: string;
    };
  };
}

export interface LintenGenerateResponse {
  input: string;
  content: string;
  error?: string;
}

export interface LintenSynthesizeResponse {
  ok: boolean;
  title: string;
  linkCount: number;
  fullContent: string;
  metrics: {
    estimatedTokens: number;
    wordCount: number;
    fitsGpt4o: boolean;
    fitsClaudeSonnet: boolean;
    fitsGemini: boolean;
  };
  error?: string;
}

export interface LinkAuditItem {
  title: string;
  url: string;
  statusType: 'ok' | 'redirect' | 'broken' | 'timeout';
  statusCode: number;
  statusMessage: string;
  latencyMs: number;
  finalUrl?: string;
  isRedirect?: boolean;
}

export interface LintenCheckLinksResponse {
  ok: boolean;
  auditedAt: string;
  healthScore: number;
  totalAudited: number;
  totalInputCount: number;
  isTruncated: boolean;
  truncationNotice?: string;
  summary: {
    okCount: number;
    redirectCount: number;
    brokenCount: number;
    timeoutCount: number;
  };
  results: LinkAuditItem[];
  error?: string;
}

/**
 * Computes HMAC-SHA256 signature using browser/Node Web Crypto API
 */
async function generateAuthHeaders(): Promise<Record<string, string>> {
  const ts = Date.now().toString();
  const message = `${ts}:obsidian`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(CLIENT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const hashArray = Array.from(new Uint8Array(signature));
  const token = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    'Content-Type': 'application/json',
    'x-linten-client': 'obsidian',
    'x-linten-timestamp': ts,
    'x-linten-token': token,
    'User-Agent': 'Linten-Obsidian/1.0 (+https://loopstates.com)'
  };
}

/**
 * Normalizes error messages from Obsidian requestUrl failures or raw JSON responses
 */
function extractErrorMessage(err: any): string {
  if (err?.json && typeof err.json === 'object' && err.json.error) {
    return err.json.error;
  }
  if (typeof err?.text === 'string') {
    try {
      const parsed = JSON.parse(err.text);
      if (parsed.error) return parsed.error;
    } catch {}
  }
  return err?.message || 'Network communication error';
}

export async function validateNoteContent(
  apiUrl: string,
  content: string
): Promise<LintenValidationResponse> {
  const endpoint = `${apiUrl.replace(/\/$/, '')}/validate?source=linten-obsidian`;
  const headers = await generateAuthHeaders();

  try {
    const res = await requestUrl({
      url: endpoint,
      method: 'POST',
      headers,
      body: JSON.stringify({ content })
    });
    return res.json as LintenValidationResponse;
  } catch (err: any) {
    throw new Error(extractErrorMessage(err));
  }
}

export async function auditRemoteUrlNote(
  apiUrl: string,
  targetUrl: string
): Promise<LintenValidationResponse> {
  let url = targetUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  const endpoint = `${apiUrl.replace(/\/$/, '')}/validate?url=${encodeURIComponent(url)}&source=linten-obsidian`;
  const headers = await generateAuthHeaders();

  try {
    const res = await requestUrl({
      url: endpoint,
      method: 'GET',
      headers
    });
    return res.json as LintenValidationResponse;
  } catch (err: any) {
    throw new Error(extractErrorMessage(err));
  }
}

export async function generateStarterNote(
  apiUrl: string,
  domain: string
): Promise<LintenGenerateResponse> {
  const cleanDomain = domain.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
  const endpoint = `${apiUrl.replace(/\/$/, '')}/generate?url=${encodeURIComponent(cleanDomain)}&source=linten-obsidian`;
  const headers = await generateAuthHeaders();

  try {
    const res = await requestUrl({
      url: endpoint,
      method: 'GET',
      headers
    });
    return res.json as LintenGenerateResponse;
  } catch (err: any) {
    throw new Error(extractErrorMessage(err));
  }
}

export async function synthesizeFullNote(
  apiUrl: string,
  content: string
): Promise<LintenSynthesizeResponse> {
  const endpoint = `${apiUrl.replace(/\/$/, '')}/synthesize?source=linten-obsidian`;
  const headers = await generateAuthHeaders();

  try {
    const res = await requestUrl({
      url: endpoint,
      method: 'POST',
      headers,
      body: JSON.stringify({ content })
    });
    return res.json as LintenSynthesizeResponse;
  } catch (err: any) {
    throw new Error(extractErrorMessage(err));
  }
}

export async function checkNoteLinks(
  apiUrl: string,
  content: string
): Promise<LintenCheckLinksResponse> {
  const endpoint = `${apiUrl.replace(/\/$/, '')}/check-links?source=linten-obsidian`;
  const headers = await generateAuthHeaders();

  try {
    const res = await requestUrl({
      url: endpoint,
      method: 'POST',
      headers,
      body: JSON.stringify({ content })
    });
    return res.json as LintenCheckLinksResponse;
  } catch (err: any) {
    throw new Error(extractErrorMessage(err));
  }
}
