// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

        const body = await req.json()
        const { studentId, studentName, metrics, rawSubmissions } = body

        // IDOR Prevention: Ensure requesting user owns this student data or has staff role
        if (studentId && studentId !== user.id) {
            const { data: requesterProfile } = await supabase
                .from('users')
                .select('role')
                .eq('id', user.id)
                .single()

            const isStaff = ['organizer', 'main_admin', 'sub_admin'].includes(requesterProfile?.role)
            if (!isStaff) {
                return new Response(JSON.stringify({ error: 'Forbidden: Cannot access another student learning data' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 403,
                })
            }
        }

        const apiKey = Deno.env.get('GEMINI_API_KEY')

        // 1. Deterministic Health Score Calculation
        const attendance = Math.min(100, Math.max(0, Number(metrics?.attendance) || 0));
        const assessments = Math.min(100, Math.max(0, Number(metrics?.assessments) || 0));
        const coding = Math.min(100, Math.max(0, Number(metrics?.coding) || 0));
        const progress = Math.min(100, Math.max(0, Number(metrics?.progress) || 0));

        const healthScore = Math.round(
            (attendance * 0.25) +
            (assessments * 0.3) +
            (coding * 0.25) +
            (progress * 0.2)
        );

        let aiResponse = null;

        if (apiKey) {
            // Sanitize student name and prompt context
            const sanitizedName = String(studentName || 'Student').replace(/[^\w\s-]/g, '').slice(0, 50);
            const sanitizedSubmissions = String(rawSubmissions || 'No recent activity data provided.').slice(0, 1000);

            const prompt = `You are the AI Learning Coach for an e-learning platform called Learnova.
Analyze this student's data and return a JSON object with weak/strong topics and recommendations.

Student Name: ${sanitizedName}
Health Score: ${healthScore}/100
Metrics: Attendance=${attendance}%, Assessments=${assessments}%, Coding=${coding}%, Course Progress=${progress}%
Recent Submissions / Activity:
${sanitizedSubmissions}

Provide your response strictly in the following JSON format:
{
  "weakTopics": [
    { "topic": "Topic Name", "confidence": 90 }
  ],
  "strongTopics": [
    { "topic": "Topic Name", "confidence": 85 }
  ],
  "recommendationText": "A 2-3 sentence personalized greeting and explanation of what they should focus on.",
  "actionItems": ["Short actionable task 1", "Short actionable task 2", "Short actionable task 3"]
}

Guidelines:
- If metrics are very low, advise them strongly but encouragingly.
- "confidence" should be 0-100 based on how sure you are they are weak/strong in that topic.
- Return ONLY valid JSON, no markdown formatting.`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { 
                        temperature: 0.4,
                        responseMimeType: "application/json"
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    try {
                        aiResponse = JSON.parse(data.candidates[0].content.parts[0].text.trim());
                    } catch(e) {
                        console.error("Failed to parse Gemini JSON:", e);
                    }
                }
            } else {
                console.error("Gemini API error. Status:", response.status);
            }
        }
        
        // 2. Fallback response if AI fails or no key
        if (!aiResponse) {
            aiResponse = {
                weakTopics: [{ topic: "General Review", confidence: 50 }],
                strongTopics: [{ topic: "Basics", confidence: 70 }],
                recommendationText: `Hi ${studentName || 'there'}, your learning health is at ${healthScore}%. Keep up the good work and focus on maintaining steady attendance and practice.`,
                actionItems: ["Review recent modules", "Attempt a practice quiz", "Join the next live class"]
            };
        }

        // 3. Construct Final Response Payload
        const finalResponse = {
            healthScore,
            healthScoreBreakdown: {
                attendance,
                assessments,
                coding,
                progress
            },
            weakTopics: aiResponse.weakTopics || [],
            strongTopics: aiResponse.strongTopics || [],
            recommendationText: aiResponse.recommendationText || "",
            actionItems: aiResponse.actionItems || []
        };

        return new Response(JSON.stringify(finalResponse), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        console.error('ai-study-coach function error:', error)
        return new Response(JSON.stringify({ error: error?.message || 'Internal error' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
