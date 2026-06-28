import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, Brain, TrendingUp, AlertTriangle, 
  Target, Zap, RefreshCw, ChevronRight, CheckCircle, Activity
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ProgressRing } from '../../design-system';
import useLearningHealth from '../../hooks/useLearningHealth';

export default function AIStudyAssistant() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [activeCourseId, setActiveCourseId] = useState(null);
  const { healthScore, breakdown, weakTopics, mastery, loading: healthLoading } = useLearningHealth(activeCourseId);

  // Load active course
  useEffect(() => {
    async function loadActiveCourse() {
      if (!profile?.id) return;
      const { data } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', profile.id)
        .limit(1)
        .maybeSingle();
      if (data) setActiveCourseId(data.course_id);
    }
    loadActiveCourse();
  }, [profile?.id]);

  useEffect(() => {
    if (profile?.id) {
      loadAIData();
    }
  }, [profile?.id]);

  const loadAIData = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      if (!forceRefresh) {
        // 1. Check for cached recommendations
        const { data: cached } = await supabase
          .from('ai_recommendations')
          .select('*')
          .eq('student_id', profile.id)
          .eq('status', 'active')
          .maybeSingle();

        if (cached) {
          // If cached within last 24h, use it
          const hoursSince = (new Date() - new Date(cached.generated_at)) / (1000 * 60 * 60);
          if (hoursSince < 24) {
            setAiData(cached);
            setLoading(false);
            setRefreshing(false);
            return;
          }
        }
      }

      // 2. Fetch raw telemetry (mocking actual aggregation for now)
      // In a real scenario, this would query enrollments, submissions, etc.
      // Use Web Crypto API to satisfy security linters, even though this is just mock data
      const getSecureRandom = () => {
        const array = new Uint32Array(1);
        window.crypto.getRandomValues(array);
        return array[0] / (0xffffffff + 1);
      };

      // Use REAL health data from useLearningHealth (not random values)
      const metrics = {
        attendance: breakdown.attendance || 0,
        assessments: breakdown.quiz || 0,
        coding: breakdown.coding || 0,
        progress: breakdown.progress || 0,
      };

      // Build real submission data from mastery
      const masteryInfo = mastery
        .map(m => `${m.topic}: ${m.effective_score || m.average_score}% (${m.mastery_level})`)
        .join('. ');
      const weakInfo = weakTopics
        .map(w => `WEAK: ${w.topic} (${w.effective_score}%, ${w.days_since_practiced}d since practice)`)
        .join('. ');
      const rawSubmissions = `Health Score: ${healthScore}%. ${masteryInfo}. ${weakInfo}`;

      // 3. Call Edge Function
      const { data, error } = await supabase.functions.invoke('ai-study-coach', {
        body: {
          studentName: profile.name,
          metrics,
          rawSubmissions,
          healthScore,
          weakTopics: weakTopics.map(w => w.topic),
          mastery: mastery.map(m => ({ topic: m.topic, score: m.effective_score || m.average_score, level: m.mastery_level }))
        }
      });

      if (error) throw error;

      // 4. Cache the result
      if (data) {
        // Archive old active records
        await supabase
          .from('ai_recommendations')
          .update({ status: 'archived' })
          .eq('student_id', profile.id)
          .eq('status', 'active');

        // Insert new
        const { data: newRecord } = await supabase
          .from('ai_recommendations')
          .insert({
            student_id: profile.id,
            health_score: data.healthScore,
            health_score_breakdown: data.healthScoreBreakdown,
            weak_topics: data.weakTopics,
            strong_topics: data.strongTopics,
            recommendation_text: data.recommendationText,
            action_items: data.actionItems,
            status: 'active'
          })
          .select()
          .single();

        setAiData(newRecord || data);
      }
    } catch (err) {
      console.error("AI Generation Error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', color: 'var(--text-muted)' }}>
        <Sparkles className="animate-pulse" size={48} color="var(--primary-500)" />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>Your AI Coach is analyzing your progress...</h2>
        <p>Crunching attendance, assessments, and coding telemetry.</p>
      </div>
    );
  }

  if (!aiData) return null;

  const { health_score, health_score_breakdown, weak_topics, strong_topics, recommendation_text, action_items } = aiData;
  const { attendance, assessments, coding, progress } = health_score_breakdown || {};

  const getHealthColor = (score) => score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <Sparkles size={28} color="#7c3aed" /> AI Learning Coach
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Personalized intelligence to accelerate your growth.</p>
        </div>
        <button 
          onClick={() => loadAIData(true)} 
          disabled={refreshing}
          className="btn-secondary" 
          style={{ gap: '0.5rem', background: 'white', border: '1px solid var(--sidebar-border)' }}
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> 
          {refreshing ? "Regenerating..." : "Refresh Insights"}
        </button>
      </div>

      {/* Row 1: Health Score & Risk Alert */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        
        {/* Health Score */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div style={{ position: 'relative', width: 120, height: 120 }}>
            <ProgressRing value={health_score} size={120} stroke={8} color={getHealthColor(health_score)} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{health_score}</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Health</span>
            </div>
          </div>
          
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} color={getHealthColor(health_score)} /> Score Breakdown
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {[
                { label: 'Attendance', val: attendance },
                { label: 'Assessments', val: assessments },
                { label: 'Coding', val: coding },
                { label: 'Course Progress', val: progress },
              ].map(metric => (
                <div key={metric.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{metric.label}</span>
                    <span style={{ color: 'var(--text-primary)' }}>{metric.val}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${metric.val}%`, background: getHealthColor(metric.val), borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Risk Alert */}
        {attendance < 75 && (
          <div className="glass-card" style={{ padding: '1.5rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.5rem', background: '#ef4444', borderRadius: '10px', color: 'white' }}>
                <AlertTriangle size={20} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#b91c1c', margin: 0 }}>AI Risk Alert</h3>
            </div>
            
            <p style={{ color: '#991b1b', fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem' }}>
              Attendance is critically below the 75% threshold.
            </p>
            
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#991b1b', opacity: 0.8, fontWeight: 600, textTransform: 'uppercase' }}>Current</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444' }}>{attendance}%</div>
              </div>
              <div style={{ width: 1, background: 'rgba(239,68,68,0.2)' }} />
              <div>
                <div style={{ fontSize: '0.85rem', color: '#991b1b', opacity: 0.8, fontWeight: 600, textTransform: 'uppercase' }}>Action Required</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#b91c1c', marginTop: '0.2rem' }}>Attend 4 more classes</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Row 2: Weak & Strong Topics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        
        {/* Weak Topics */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
            <Target size={18} /> Focus Areas (Weaknesses)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {weak_topics?.length > 0 ? weak_topics.map((item, i) => (
              <div key={i} style={{ padding: '0.85rem 1rem', background: 'var(--bg-primary)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{item.topic}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                  {item.confidence}% Match
                </span>
              </div>
            )) : <p style={{ color: 'var(--text-muted)' }}>No weak areas detected! Great job.</p>}
          </div>
        </div>

        {/* Strong Topics */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981' }}>
            <Zap size={18} /> Strengths
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {strong_topics?.length > 0 ? strong_topics.map((item, i) => (
              <div key={i} style={{ padding: '0.85rem 1rem', background: 'var(--bg-primary)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{item.topic}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                  {item.confidence}% Match
                </span>
              </div>
            )) : <p style={{ color: 'var(--text-muted)' }}>Keep practicing to build your strengths!</p>}
          </div>
        </div>

      </div>

      {/* Row 3: Today's AI Advice */}
      <div className="glass-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)', border: '1px solid rgba(124, 58, 237, 0.15)' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#7c3aed' }}>
          <Brain size={18} /> Today's AI Advice
        </h3>
        <p style={{ fontSize: '1rem', lineHeight: 1.6, color: 'var(--text-primary)', fontWeight: 500 }}>
          {recommendation_text}
        </p>
      </div>

      {/* Row 4: Recommended Actions */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TrendingUp size={18} color="var(--primary-600)" /> Recommended Actions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          {action_items?.map((action, i) => (
            <div key={i} tabIndex={0} style={{ 
              padding: '1rem', 
              background: 'var(--bg-primary)', 
              borderRadius: '12px', 
              border: '1px solid var(--sidebar-border)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary-400)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'var(--sidebar-border)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary-400)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--sidebar-border)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}>
              <CheckCircle size={18} color="var(--primary-500)" style={{ marginTop: '2px' }} />
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {action}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
