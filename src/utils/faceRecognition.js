import * as faceapi from '@vladmandic/face-api'

let modelsLoaded = false

export async function loadModels() {
    if (modelsLoaded) return
    const MODEL_URL = '/models'
    try {
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ])
        modelsLoaded = true
        console.log('FaceAPI Models Loaded')
    } catch (err) {
        console.error('Error loading face-api models:', err)
        throw err
    }
}

export async function getFaceDescriptor(videoElement) {
    if (!modelsLoaded) await loadModels()
    
    const detection = await faceapi.detectSingleFace(videoElement)
        .withFaceLandmarks()
        .withFaceDescriptor()
    
    return detection ? Array.from(detection.descriptor) : null
}

export function compareFaces(descriptor1, descriptor2) {
    if (!descriptor1 || !descriptor2) return false
    
    // Convert back to Float32Array if they are arrays from JSON
    const d1 = new Float32Array(descriptor1)
    const d2 = new Float32Array(descriptor2)
    
    const distance = faceapi.euclideanDistance(d1, d2)
    // 0.6 is a common threshold for face recognition, 
    // smaller is more strict
    return distance < 0.5 
}
