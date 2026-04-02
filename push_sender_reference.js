// Reference Script: Sending Push Notifications using Node.js
// Install dependency: npm install web-push

const webpush = require('web-push');

// Replace these with the keys I generated for you:
const vapidKeys = {
  publicKey: 'BMoLIbjN-o7XHbkgBYXBLdpno9Css3OtoY0oIJ44W296xrxhwKy_q6zbudE3v2ZQXTRGLT50cy5vlaGuG9zR2MY',
  privateKey: 'T4vhToYTygHAvBh0hA-nrbJWMItFyg2lcghmL2lLBOw'
};

webpush.setVapidDetails(
  'mailto:admin@edustream.com', // Replace with your email
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// This function sends a notification to a specific subscription (retrieved from your Supabase push_subscriptions table)
async function sendPush(subscription, title, body, url = '/') {
  const payload = JSON.stringify({
    title,
    body,
    url
  });

  try {
    await webpush.sendNotification(subscription, payload);
    console.log('Push sent successfully');
  } catch (error) {
    console.error('Error sending push:', error);
  }
}

// Example usage:
// const subscription = { ... }; // from database
// sendPush(subscription, 'New Material Added!', 'A new PDF has been uploaded to your course.', '/student/materials');
