import { useEffect, useRef, useState } from 'react';
import { Room, LocalVideoTrack, LocalAudioTrack, Track, RoomEvent } from 'livekit-client';
import { supabase } from '../lib/supabase';

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://meet.learnova.com';

/**
 * Hook for students to silently connect and publish their camera/mic to a LiveKit room.
 * The connection is completely invisible to the student.
 */
export function useLiveKitProctoring(assessmentId, studentId, isScreenSharing = false, screenStream = null, cameraStream = null) {
    const roomRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionQuality, setConnectionQuality] = useState('excellent');
    const videoTrackRef = useRef(null);
    const audioTrackRef = useRef(null);
    const screenTrackRef = useRef(null);

    // 1. Manage Room Connection Lifecycle
    useEffect(() => {
        if (!assessmentId || !studentId) return;

        let isMounted = true;
        const roomName = `assessment-${assessmentId}`;

        const connectRoom = async () => {
            try {
                // Fetch token
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                const response = await supabase.functions.invoke('livekit-token', {
                    body: { roomName, proctoringMode: true }
                });

                if (!response.data || !response.data.token) {
                    console.error('[LiveKit Proctoring] Failed to get token. Response:', response);
                    return;
                }

                if (!isMounted) return;

                const room = new Room({
                    adaptiveStream: true,
                    dynacast: true,
                });
                roomRef.current = room;

                // Register connection quality listener
                room.on(RoomEvent.ConnectionQualityChanged, (participant, quality) => {
                    if (participant === room.localParticipant) {
                        const qualityStr = typeof quality === 'string' ? quality : String(quality);
                        setConnectionQuality(qualityStr.toLowerCase());
                    }
                });

                await room.connect(LIVEKIT_URL, response.data.token);
                if (!isMounted) return;

                setIsConnected(true);
                const initialQuality = room.localParticipant.connectionQuality;
                const initialQualityStr = typeof initialQuality === 'string' ? initialQuality : String(initialQuality);
                setConnectionQuality(initialQualityStr.toLowerCase());
                console.log('[LiveKit Proctoring] Silently connected to room:', roomName);
            } catch (err) {
                console.error('[LiveKit Proctoring] Connection error:', err);
            }
        };

        connectRoom();

        return () => {
            isMounted = false;
            setIsConnected(false);
            if (roomRef.current) {
                console.log('[LiveKit Proctoring] Disconnecting from room');
                roomRef.current.disconnect();
                roomRef.current = null;
            }
        };
    }, [assessmentId, studentId]);

    // 2. Manage Camera and Microphone Tracks publishing
    useEffect(() => {
        if (!roomRef.current || !isConnected) return;

        const room = roomRef.current;
        let activeVideoPub = null;
        let activeAudioPub = null;

        const publishCamera = async () => {
            if (cameraStream) {
                const videoTrack = cameraStream.getVideoTracks()[0];
                const audioTrack = cameraStream.getAudioTracks()[0];

                if (videoTrack) {
                    try {
                        const lkVideoTrack = new LocalVideoTrack(videoTrack);
                        videoTrackRef.current = lkVideoTrack;
                        activeVideoPub = await room.localParticipant.publishTrack(lkVideoTrack, { 
                            source: Track.Source.Camera,
                            simulcast: false, // Disables multi-quality layers for simple proctoring
                            videoEncoding: {
                                maxBitrate: 120000, // 120 kbps (extremely low bandwidth)
                                maxFramerate: 10,  // 10 FPS (sufficient for proctoring feeds)
                            }
                        });
                        console.log('[LiveKit Proctoring] Camera video track published with low-bandwidth profile (120kbps, 10fps)');
                    } catch (err) {
                        console.error('[LiveKit Proctoring] Error publishing video track:', err);
                    }
                }

                if (audioTrack) {
                    try {
                        const lkAudioTrack = new LocalAudioTrack(audioTrack);
                        audioTrackRef.current = lkAudioTrack;
                        activeAudioPub = await room.localParticipant.publishTrack(lkAudioTrack, { source: Track.Source.Microphone });
                        console.log('[LiveKit Proctoring] Camera audio track published successfully');
                    } catch (err) {
                        console.error('[LiveKit Proctoring] Error publishing audio track:', err);
                    }
                }
            }
        };

        publishCamera();

        return () => {
            const cleanup = async () => {
                if (activeVideoPub) {
                    try {
                        await room.localParticipant.unpublishTrack(activeVideoPub.track);
                    } catch (e) {
                        console.warn('[LiveKit Proctoring] Error unpublishing camera video:', e);
                    }
                }
                if (activeAudioPub) {
                    try {
                        await room.localParticipant.unpublishTrack(activeAudioPub.track);
                    } catch (e) {
                        console.warn('[LiveKit Proctoring] Error unpublishing camera audio:', e);
                    }
                }
                videoTrackRef.current = null;
                audioTrackRef.current = null;
            };
            cleanup();
        };
    }, [cameraStream, isConnected]);

    // 3. Manage Screen Share Track publishing
    useEffect(() => {
        if (!roomRef.current || !isConnected) return;

        const room = roomRef.current;
        let activeScreenPub = null;

        const publishScreen = async () => {
            if (isScreenSharing && screenStream) {
                const nativeTrack = screenStream.getVideoTracks()[0];
                if (nativeTrack) {
                    try {
                        const lkTrack = new LocalVideoTrack(nativeTrack);
                        screenTrackRef.current = lkTrack;
                        activeScreenPub = await room.localParticipant.publishTrack(lkTrack, { source: Track.Source.ScreenShare });
                        console.log('[LiveKit Proctoring] Screen share track published successfully');
                    } catch (err) {
                        console.error('[LiveKit Proctoring] Error publishing screen track:', err);
                    }
                }
            }
        };

        publishScreen();

        return () => {
            const cleanup = async () => {
                if (activeScreenPub) {
                    try {
                        await room.localParticipant.unpublishTrack(activeScreenPub.track);
                    } catch (e) {
                        console.warn('[LiveKit Proctoring] Error unpublishing screen share:', e);
                    }
                }
                screenTrackRef.current = null;
            };
            cleanup();
        };
    }, [isScreenSharing, screenStream, isConnected]);

    return { isConnected, connectionQuality };
}
