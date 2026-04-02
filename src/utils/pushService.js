import { supabase } from '../lib/supabase'

const PUBLIC_VAPID_KEY = 'BMoLIbjN-o7XHbkgBYXBLdpno9Css3OtoY0oIJ44W296xrxhwKy_q6zbudE3v2ZQXTRGLT50cy5vlaGuG9zR2MY'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function subscribeToPush(userId) {
  if (!('serviceWorker' in navigator)) return

  const registration = await navigator.serviceWorker.ready
  
  // Subscribe to push
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
  })

  // Save to Supabase
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      subscription_json: subscription
    }, { onConflict: 'user_id, subscription_json' })

  if (error) throw error
  return subscription
}

export async function checkPushSubscription() {
  if (!('serviceWorker' in navigator)) return false
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  return !!subscription
}
