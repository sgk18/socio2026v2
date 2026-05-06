/**
 * OneSignal Service Utility
 * Used for sending push notifications to mobile devices via OneSignal REST API.
 */

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

/**
 * Send a push notification to a specific user identified by their email.
 * This assumes the user has logged in to the mobile app and is identified by their email as external_id.
 */
export async function sendOneSignalToEmail(email, { title, body, actionUrl, data = {} }) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.warn("[OneSignal] Missing configuration. Skipping mobile push.");
    return { success: false, error: "Missing config" };
  }

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_external_user_ids: [email.toLowerCase()],
        channel_for_external_user_ids: "push",
        headings: { en: title },
        contents: { en: body },
        data: {
          ...data,
          route: actionUrl || "/notifications"
        },
        // Optional: specific styling for Android/iOS
        android_accent_color: "011F7B",
        small_icon: "ic_stat_onesignal_default"
      })
    });

    const result = await response.json();
    if (result.errors) {
      console.error("[OneSignal] Error sending to email:", result.errors);
      return { success: false, errors: result.errors };
    }

    return { success: true, id: result.id };
  } catch (error) {
    console.error("[OneSignal] Fetch error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a broadcast push notification to all subscribed mobile users.
 */
export async function sendOneSignalToAll({ title, body, actionUrl, data = {} }) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.warn("[OneSignal] Missing configuration. Skipping broadcast.");
    return { success: false, error: "Missing config" };
  }

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ["Total Subscriptions"],
        headings: { en: title },
        contents: { en: body },
        data: {
          ...data,
          route: actionUrl || "/notifications"
        },
        android_accent_color: "011F7B"
      })
    });

    const result = await response.json();
    if (result.errors) {
      console.error("[OneSignal] Error sending broadcast:", result.errors);
      return { success: false, errors: result.errors };
    }

    return { success: true, id: result.id };
  } catch (error) {
    console.error("[OneSignal] Fetch error:", error);
    return { success: false, error: error.message };
  }
}
