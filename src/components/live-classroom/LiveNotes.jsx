import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../Toast';
import { Save, Loader2 } from 'lucide-react';

export default function LiveNotes({ videoId, isOrganizer, channel }) {
    const { profile } = useAuth();
    const toast = useToast();
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Use refs to access latest values in intervals
    const notesRef = useRef(notes);
    const lastSavedNotesRef = useRef('');

    useEffect(() => {
        notesRef.current = notes;
    }, [notes]);

    // 1. Load Initial Notes
    useEffect(() => {
        async function fetchNotes() {
            const { data, error } = await supabase
                .from('live_class_notes')
                .select('content')
                .eq('video_id', videoId)
                .maybeSingle();
            
            if (data?.content) {
                setNotes(data.content);
                lastSavedNotesRef.current = data.content;
            } else if (error && error.code !== 'PGRST116') {
                console.error("Failed to load notes:", error);
            }
            setLoading(false);
        }
        fetchNotes();
    }, [videoId]);

    // 2. Realtime Sync (Receiving)
    useEffect(() => {
        if (!channel) return;
        
        channel.on('broadcast', { event: 'notes_sync' }, (payload) => {
            if (!isOrganizer) { // Students receive updates
                setNotes(payload.payload.content);
            }
        });

        return () => {
            // cleanup is handled in parent
        };
    }, [channel, isOrganizer]);

    // 3. Organizer Auto-save and Broadcast
    useEffect(() => {
        if (!isOrganizer) return;

        // Broadcast every 2 seconds if changed
        const broadcastInterval = setInterval(() => {
            if (notesRef.current !== lastSavedNotesRef.current) {
                 channel.send({ type: 'broadcast', event: 'notes_sync', payload: { content: notesRef.current } });
            }
        }, 2000);

        // Save to DB every 15 seconds if changed
        const saveInterval = setInterval(async () => {
            if (notesRef.current !== lastSavedNotesRef.current) {
                setSaving(true);
                const currentContent = notesRef.current;
                const { error } = await supabase
                    .from('live_class_notes')
                    .upsert({
                        video_id: videoId,
                        content: currentContent,
                        updated_by: profile?.id,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'video_id' });
                
                if (!error) {
                    lastSavedNotesRef.current = currentContent;
                }
                setSaving(false);
            }
        }, 15000);

        const handleBeforeUnload = () => {
            if (notesRef.current !== lastSavedNotesRef.current) {
                // Best effort save on unload/unmount
                supabase.from('live_class_notes').upsert({
                    video_id: videoId,
                    content: notesRef.current,
                    updated_by: profile?.id,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'video_id' }).then();
                lastSavedNotesRef.current = notesRef.current;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            clearInterval(broadcastInterval);
            clearInterval(saveInterval);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            handleBeforeUnload(); // Save on component unmount as well
        };
    }, [isOrganizer, videoId, profile, channel]);

    // Manual Save
    const handleManualSave = async () => {
        if (!isOrganizer) return;
        setSaving(true);
        const currentContent = notesRef.current;
        await supabase
            .from('live_class_notes')
            .upsert({
                video_id: videoId,
                content: currentContent,
                updated_by: profile?.id,
                updated_at: new Date().toISOString()
            }, { onConflict: 'video_id' });
        
        lastSavedNotesRef.current = currentContent;
        setSaving(false);
        toast.success("Notes saved manually");
    };

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="animate-spin text-slate-500" /></div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>Class Notes</h3>
                {isOrganizer && (
                    <button 
                        onClick={handleManualSave}
                        style={{ 
                            background: saving ? 'var(--text-secondary)' : '#6366f1', 
                            color: 'white', 
                            border: 'none', 
                            padding: '0.4rem 0.8rem', 
                            borderRadius: '6px',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.85rem'
                        }}
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {saving ? 'Saving...' : 'Force Save'}
                    </button>
                )}
            </div>
            
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                {isOrganizer 
                    ? "Notes auto-save every 15s and sync to students instantly."
                    : "Notes are updated live by the instructor."}
            </p>

            <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                readOnly={!isOrganizer}
                placeholder={isOrganizer ? "Start typing notes here... Markdown is supported by convention." : "Waiting for instructor notes..."}
                style={{
                    flex: 1,
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: 'white',
                    padding: '1rem',
                    fontSize: '0.95rem',
                    fontFamily: 'monospace',
                    resize: 'none',
                    outline: 'none',
                    lineHeight: '1.5'
                }}
            />
        </div>
    );
}

LiveNotes.propTypes = {
    videoId: PropTypes.string.isRequired,
    isOrganizer: PropTypes.bool.isRequired,
    channel: PropTypes.shape({
        on: PropTypes.func,
        send: PropTypes.func
    })
};
