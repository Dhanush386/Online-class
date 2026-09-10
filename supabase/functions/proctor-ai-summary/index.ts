// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function fetchGeminiSummary(apiKey: string | undefined, payload: any): Promise<string> {
    if (!apiKey) return "";
    const { studentName, assessmentTitle, riskScore, violations, durationMinutes } = payload;
    const sanitizedStudent = String(studentName || 'Student').replace(/[^\w\s-]/g, '').slice(0, 50);
    const sanitizedTitle = String(assessmentTitle || 'Assessment').replace(/[^\w\s-]/g, '').slice(0, 100);

    const prompt = `Analyze the following proctoring metrics for student "${sanitizedStudent}" during the assessment "${sanitizedTitle}":
- Total Risk Score: ${Number(riskScore) || 0}
- Duration: ${Number(durationMinutes) || 0} minutes
- Violations counts:
  * Tab Switch / Focus Lost: ${Number(violations?.tabSwitch) || 0}
  * Phone Detected: ${Number(violations?.phoneDetected) || 0}
  * Multiple Faces: ${Number(violations?.multipleFaces) || 0}
  * Face Lost: ${Number(violations?.faceLost) || 0}

Please write a professional, concise 2-3 sentence AI summary of the student's behavior and state if they should pass the security check or require manual review. Keep it direct and authoritative. Do not include markdown formatting or labels.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.4 }
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                return data.candidates[0].content.parts[0].text.trim();
            }
        } else {
            console.error("Gemini API error. Status:", response.status);
        }
    } catch (e) {
        console.error("Fetch error to Gemini API:", e);
    }
    return "";
}

function generateFallbackSummary(riskScore: number, violations: any, durationMinutes: number): string {
    if (riskScore === 0) {
        return "The student completed the assessment with zero violations. AI analysis indicates a fully compliant and secure exam session.";
    } 
    
    const parts = [];
    if (violations?.tabSwitch) parts.push(`${violations.tabSwitch} tab switch(es)`);
    if (violations?.phoneDetected) parts.push(`${violations.phoneDetected} cell phone detection(s)`);
    if (violations?.multipleFaces) parts.push(`${violations.multipleFaces} multiple-face event(s)`);
    if (violations?.faceLost) parts.push(`${violations.faceLost} webcam face-loss event(s)`);

    const violationsDesc = parts.length > 0 ? parts.join(", ") : "minor environmental issues";
    return `Student displayed suspicious activity, accumulating a risk score of ${riskScore} across ${violationsDesc} over a duration of ${durationMinutes || 0} minutes. Repeated infractions during the session indicate potential security compromises. Manual review of the evidence logs is highly recommended.`;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            })
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: { headers: { Authorization: authHeader } },
                auth: { persistSession: false }
            }
        )

        const jwtToken = authHeader.replace(/^Bearer\s+/i, '').trim()
        const { data: { user }, error: authError } = await supabase.auth.getUser(jwtToken)
        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized user session' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            })
        }

        const payload = await req.json()
        const apiKey = Deno.env.get('GEMINI_API_KEY')
        
        let summary = await fetchGeminiSummary(apiKey, payload)
        
        if (!summary) {
            summary = generateFallbackSummary(Number(payload.riskScore) || 0, payload.violations, Number(payload.durationMinutes) || 0)
        }

        return new Response(JSON.stringify({ summary }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        console.error('AI summary function error:', error)
        return new Response(JSON.stringify({ error: error?.message || 'Server error' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
