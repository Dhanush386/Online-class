import { useEffect, useRef, useState, useCallback } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { supabase } from '../lib/supabase';
import { getLiveKitToken } from '../lib/livekitToken';

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
        console.log(`[LiveKit Viewer] Subscribed to ${track.kind} track from student:`, studentId);

        if (track.kind === 'video') {
            const mediaStream = new MediaStream([track.mediaStreamTrack]);
            setLiveStreams(prev => ({
                ...prev,
                [studentId]: mediaStream
            }));
        } else if (track.kind === 'audio') {
            const audioElement = track.attach();
            audioElement.style.display = 'none';
            document.body.appendChild(audioElement);
            console.log('[LiveKit Viewer] Audio track attached and playing for:', studentId);
        }
    }, []);

    const handleTrackUnsubscribed = useCallback((track, publication, participant) => {
        const studentId = participant.identity;
        console.log(`[LiveKit Viewer] Unsubscribed from ${track.kind} track for student:`, studentId);

        if (track.kind === 'video') {
            setLiveStreams(prev => {
                const next = { ...prev };
                delete next[studentId];
                return next;
            });
        } else if (track.kind === 'audio') {
            track.detach().forEach(el => el.remove());
            console.log('[LiveKit Viewer] Audio track detached for:', studentId);
        }
    }, []);

    const handleParticipantDisconnected = useCallback((participant) => {
        const studentId = participant.identity;
        console.log('[LiveKit Viewer] Student disconnected:', studentId);

        setLiveStreams(prev => {
            const next = { ...prev };
            delete next[studentId];
            return next;
        });

        setConnectionQualities(prev => {
            const next = { ...prev };
            delete next[studentId];
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

                const token = await getLiveKitToken({
                    roomName,
                    identity: session.user?.id,
                    role: 'organizer',
                    isOrganizer: true,
                    proctoringMode: true
                });

                if (!token) {
                    console.error('[LiveKit Viewer] Failed to get token.');
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
                await room.connect(LIVEKIT_URL, token);
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
