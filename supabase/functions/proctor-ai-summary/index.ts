import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const apiKey = Deno.env.get('GEMINI_API_KEY')
        const { studentName, assessmentTitle, riskScore, violations, durationMinutes } = await req.json()

        let summary = ""

        if (apiKey) {
            const prompt = `Analyze the following proctoring metrics for student "${studentName || 'Student'}" during the assessment "${assessmentTitle || 'Assessment'}":
- Total Risk Score: ${riskScore || 0}
- Duration: ${durationMinutes || 0} minutes
- Violations counts:
  * Tab Switch / Focus Lost: ${violations?.tabSwitch || 0}
  * Phone Detected: ${violations?.phoneDetected || 0}
  * Multiple Faces: ${violations?.multipleFaces || 0}
  * Face Lost: ${violations?.faceLost || 0}

Please write a professional, concise 2-3 sentence AI summary of the student's behavior and state if they should pass the security check or require manual review. Keep it direct and authoritative. Do not include markdown formatting or labels.`;

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
                    summary = data.candidates[0].content.parts[0].text.trim();
                }
            } else {
                console.error("Gemini API error. Status:", response.status);
            }
        }
        
        // If we don't have an API key or the request failed, use the fallback summary
        if (!summary) {
            if (riskScore === 0) {
                summary = "The student completed the assessment with zero violations. AI analysis indicates a fully compliant and secure exam session.";
            } else {
                const parts = [];
                if (violations?.tabSwitch) parts.push(`${violations.tabSwitch} tab switch(es)`);
                if (violations?.phoneDetected) parts.push(`${violations.phoneDetected} cell phone detection(s)`);
                if (violations?.multipleFaces) parts.push(`${violations.multipleFaces} multiple-face event(s)`);
                if (violations?.faceLost) parts.push(`${violations.faceLost} webcam face-loss event(s)`);

                const violationsDesc = parts.length > 0 ? parts.join(", ") : "minor environmental issues";
                summary = `Student displayed suspicious activity, accumulating a risk score of ${riskScore} across ${violationsDesc} over a duration of ${durationMinutes || 0} minutes. Repeated infractions during the session indicate potential security compromises. Manual review of the evidence logs is highly recommended.`;
            }
        }

        return new Response(JSON.stringify({ summary }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        console.error('AI summary function error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    }
})
