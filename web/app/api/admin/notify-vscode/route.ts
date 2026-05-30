import { NextResponse } from 'next/server';
import { adminDb, admin } from '@/lib/firebase/admin';

export async function GET() {
  try {
    const usersSnapshot = await adminDb.collection('users').get();
    
    let count = 0;
    const batch = adminDb.batch();
    
    usersSnapshot.forEach((userDoc) => {
      const notifRef = adminDb
        .collection('notifications')
        .doc(userDoc.id)
        .collection('items')
        .doc();
        
      batch.set(notifRef, {
        type: 'system_announcement',
        title: 'New to coding? Supercharge your workflow!',
        body: 'Naanga pudhusa code pandravangalukkagave oru VS Code Extension create pannirukom. Try it out now!',
        link: 'vscode:extension/jofra-shiva.ms-dev',
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      count++;
    });
    
    await batch.commit();
    
    return NextResponse.json({ success: true, count, message: `Sent ${count} notifications.` });
  } catch (error: any) {
    console.error('Failed to send notifications:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
