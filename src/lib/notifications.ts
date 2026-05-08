// src/lib/notifications.ts
import { supabase } from './supabase';

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'order' | 'message' | 'proposal';

export const sendNotification = async (
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  link?: string,
  linkData?: any
) => {
  if (!userId) return;

  try {
    // ⚠️ NE PAS inclure d'éléments DOM dans linkData
    // S'assurer que linkData est sérialisable
    let safeLinkData = null;
    if (linkData && typeof linkData === 'object') {
      // Créer une copie propre sans références circulaires
      safeLinkData = JSON.parse(JSON.stringify({
        conversation_id: linkData.conversation_id,
        orderId: linkData.orderId,
        title: linkData.title,
        service_id: linkData.service_id,
        lead_id: linkData.lead_id,
        budget: linkData.budget,
        openItemId: linkData.openItemId
      }));
    }

    const payload: any = {
      user_id: userId,
      title: title.slice(0, 100),
      message: message.slice(0, 255),
      type,
      link: link || null,
      created_at: new Date().toISOString(),
      read: false
    };

    if (safeLinkData && Object.keys(safeLinkData).length > 0) {
      payload.link_data = safeLinkData;
    }

    const { error } = await supabase
      .from('notifications')
      .insert(payload);
    
    if (error) {
      console.error('[Notification] Error:', error);
    }
  } catch (err) {
    console.error('[Notification] Exception:', err);
  }
};