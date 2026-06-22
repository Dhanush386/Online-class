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
        const { studentName, metrics, rawSubmissions } = await req.json()

        // 1. Deterministic Health Score Calculation
        const attendance = metrics?.attendance || 0;
        const assessments = metrics?.assessments || 0;
        const coding = metrics?.coding || 0;
        const progress = metrics?.progress || 0;

        const healthScore = Math.round(
            (attendance * 0.25) +
            (assessments * 0.30) +
            (coding * 0.25) +
            (progress * 0.20)
        );

        let aiResponse = null;

        if (apiKey) {
            const prompt = `You are the AI Learning Coach for an e-learning platform called Learnova.
Analyze this student's data and return a JSON object with weak/strong topics and recommendations.

Student Name: ${studentName || 'Student'}
Health Score: ${healthScore}/100
Metrics: Attendance=${attendance}%, Assessments=${assessments}%, Coding=${coding}%, Course Progress=${progress}%
Recent Submissions / Activity:
${rawSubmissions || 'No recent activity data provided.'}

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
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
