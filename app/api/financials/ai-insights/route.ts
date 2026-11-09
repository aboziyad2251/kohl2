import { withAudit } from '@/lib/audit/server';
import { NextRequest, NextResponse } from 'next/server';
import { calculatedReport } from '@/lib/financial-report';
import { z } from 'zod';
import { requireIdentity, apiError } from '@/lib/portal/server';

interface Transaction {
  flow_type: 'INCOME' | 'EXPENSE';
  net_amount?: number;
  [key: string]: any;
}

interface OperationalStatus {
  vacantUnitsCount?: number | null;
  [key: string]: any;
}

interface RequestPayload {
  report_date?: string;
  grossIncome?: number;
  netIncome?: number;
  transactions?: Transaction[];
  operationalStatus?: OperationalStatus;
}

async function POSTHandler(req: NextRequest) {
  try { await requireIdentity(req, true); } catch (error) { return apiError(error); }
  try {
    const parsed = z.object({
      report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      grossIncome: z.number().finite().default(0), netIncome: z.number().finite().default(0),
      transactions: z.array(z.object({ flow_type: z.enum(['INCOME', 'EXPENSE']), net_amount: z.number().finite().optional() }).passthrough()).max(10000).default([]),
      operationalStatus: z.object({ vacantUnitsCount: z.number().nonnegative().nullable().optional(), managedPropertiesCount: z.number().nonnegative().optional() }).default({}),
    }).safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: 'بيانات التقرير غير صالحة' }, { status: 400 });
    const body = parsed.data;
    const {
      report_date = new Date().toISOString().split('T')[0],
      grossIncome = 0,
      netIncome = 0,
      transactions = [],
      operationalStatus = {},
    } = body;

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    let aiResult: {
      what_went_well: string[];
      what_went_bad: string[];
      ai_recommendations: string[];
      income_increment_strategy: string;
    } | null = null;

    const systemPrompt = `You are a Chief Financial Officer and Senior Real Estate Business Strategist for a Saudi Real Estate Office.
Analyze the daily financial ledger and operational data:
- Daily Gross Income: ${grossIncome} SAR
- Daily Net Income: ${netIncome} SAR
- Transactions Log: ${JSON.stringify(transactions)}
- Vacant Units & Pending Agreements: ${JSON.stringify(operationalStatus)}

Use only the supplied records. Do not invent transactions, properties, percentages, arrears, legal compliance, or pending powers of attorney. Distinguish suggestions from observed facts. Vacancy counts describe current managed properties only, not historical occupancy. Do not claim taxes were deducted unless the data proves it.
Respond with ONLY valid JSON (no markdown formatting, no explanation, no backticks) matching this exact schema:
{
  "what_went_well": ["point 1 in Arabic", "point 2 in Arabic"],
  "what_went_bad": ["point 1 in Arabic", "point 2 in Arabic"],
  "ai_recommendations": ["recommendation 1 in Arabic", "recommendation 2 in Arabic"],
  "income_increment_strategy": "2-sentence summary in Arabic of single highest-impact action"
}`;

    // 1. Try Claude AI (Anthropic) if API key exists
    if (anthropicApiKey) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicApiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            messages: [{ role: 'user', content: systemPrompt }],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const rawText = data?.content?.[0]?.text;
          if (rawText) {
            const cleanJson = rawText.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
            aiResult = JSON.parse(cleanJson);
          }
        } else {
          const errText = await res.text();
          console.warn('Claude API request returned non-OK status:', res.status, errText);
        }
      } catch (err) {
        console.warn('Claude API call error:', err);
      }
    }

    // 2. Fallback to Gemini if Claude not configured or failed
    if (!aiResult && geminiApiKey) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: systemPrompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
              },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const cleanJson = rawText.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
            aiResult = JSON.parse(cleanJson);
          }
        }
      } catch (err) {
        console.warn('Gemini API call failed, falling back to dynamic strategy engine:', err);
      }
    }

    const analysis = z.object({
      what_went_well: z.array(z.string().max(3000)).min(1).max(20),
      what_went_bad: z.array(z.string().max(3000)).min(1).max(20),
      ai_recommendations: z.array(z.string().max(3000)).min(1).max(20),
      income_increment_strategy: z.string().min(1).max(5000),
    }).safeParse(aiResult);
    const source = analysis.success ? 'ai' : 'calculated';
    const content = analysis.success ? analysis.data : calculatedReport(grossIncome, netIncome, transactions, operationalStatus);

    const report = {
      id: `adr-${Date.now()}`,
      report_date,
      gross_income: grossIncome,
      net_income: netIncome,
      ...content,
      analysis_source: source,
      created_at: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, report });
  } catch (error: any) {
    console.error('Error generating AI Insights:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate AI insights report' },
      { status: 500 }
    );
  }
}

export const POST=withAudit(POSTHandler);
