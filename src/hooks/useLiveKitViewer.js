import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { supabase } from '../lib/supabase';

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://meet.learnova.com';

/**
 * Hook for organizers to connect to an assessment's LiveKit room and subscribe to all students.
 */
export function useLiveKitViewer(assessmentId) {
    const roomRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    
    // Maps studentId (identity) to their MediaStream
    const [liveStreams, setLiveStreams] = useState({});
    
    // Maps studentId (identity) to their ConnectionQuality
    const [connectionQualities, setConnectionQualities] = useState({});

    const handleConnectionQualityChanged = useCallback((participant, quality) => {
        const studentId = participant.identity;
        const qualityStr = typeof quality === 'string' ? quality : String(quality);
        setConnectionQualities(prev => ({
            ...prev,
            [studentId]: qualityStr.toLowerCase()
        }));
    }, []);

    const handleTrackSubscribed = useCallback((track, publication, participant) => {
        const studentId = participant.identity;
        
        if (track.kind === 'audio') {
            track.attach();
            console.log('[LiveKit Viewer] Audio track attached and playing for:', studentId);
        }
        
        setLiveStreams(prev => {
            const currentStream = prev[studentId] || new MediaStream();
            if (!currentStream.getTracks().includes(track.mediaStreamTrack)) {
                currentStream.addTrack(track.mediaStreamTrack);
            }
            return { ...prev, [studentId]: currentStream };
        });
    }, []);

    const handleTrackUnsubscribed = useCallback((track, publication, participant) => {
        const studentId = participant.identity;
        
        if (track.kind === 'audio') {
            track.detach();
            console.log('[LiveKit Viewer] Audio track detached for:', studentId);
        }
        
        setLiveStreams(prev => {
            const currentStream = prev[studentId];
            if (currentStream) {
                const newStream = new MediaStream(currentStream.getTracks().filter(t => t.id !== track.mediaStreamTrack.id));
                if (newStream.getTracks().length === 0) {
                    const next = { ...prev };
                    delete next[studentId];
                    return next;
                }
                return { ...prev, [studentId]: newStream };
            }
            return prev;
        });
    }, []);

    const handleParticipantDisconnected = useCallback((participant) => {
        setLiveStreams(prev => {
            const next = { ...prev };
            delete next[participant.identity];
            return next;
        });
        setConnectionQualities(prev => {
            const next = { ...prev };
            delete next[participant.identity];
            return next;
        });
    }, []);

    useEffect(() => {
        if (!assessmentId) return;

        let isMounted = true;
        const roomName = `assessment-${assessmentId}`;

        const connectAndSubscribe = async () => {
            try {
                // 1. Fetch Token (Proctoring Mode: Organizer gets subscribe-only permissions)
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                const response = await supabase.functions.invoke('livekit-token', {
                    body: { roomName, proctoringMode: true }
                });

                if (!response.data?.token) {
                    console.error('[LiveKit Viewer] Failed to get token. Response:', response);
                    return;
                }

                if (!isMounted) return;

                // Initialize Room with adaptive performance configurations
                const room = new Room({
                    adaptiveStream: true,
                    dynacast: true,
                });
                roomRef.current = room;

                // Handle participant connection quality changes
                room.on(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);

                // Handle incoming tracks
                room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
                room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
                room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

                // 3. Connect to Room
                await room.connect(LIVEKIT_URL, response.data.token);
                if (!isMounted) return;
                
                setIsConnected(true);
                console.log('[LiveKit Viewer] Connected to room:', roomName);

            } catch (err) {
                console.error('[LiveKit Viewer] Connection error:', err);
            }
        };

        connectAndSubscribe();

        return () => {
            isMounted = false;
            if (roomRef.current) {
                roomRef.current.disconnect();
                roomRef.current = null;
            }
        };
    }, [assessmentId, handleConnectionQualityChanged, handleTrackSubscribed, handleTrackUnsubscribed, handleParticipantDisconnected]);

    return { isConnected, liveStreams, connectionQualities };
}
