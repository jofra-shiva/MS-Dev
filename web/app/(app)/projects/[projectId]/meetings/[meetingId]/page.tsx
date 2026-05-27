'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Meeting } from '@/types';
import Link from 'next/link';

export default function MeetingDetailsPage() {
  const { projectId, meetingId } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || !meetingId) return;
    
    const fetchMeetingDetails = async () => {
      try {
        const pSnap = await getDoc(doc(db, 'projects', projectId as string));
        if (pSnap.exists()) {
          setProject(pSnap.data());
        }
        
        const mSnap = await getDoc(doc(db, 'projects', projectId as string, 'meetings', meetingId as string));
        if (mSnap.exists()) {
          setMeeting({ id: mSnap.id, ...mSnap.data() } as Meeting);
        } else {
          setMeeting(null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMeetingDetails();
  }, [projectId, meetingId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 20px', color: 'var(--text-3)' }}>
        Loading meeting details...
      </div>
    );
  }

  if (!meeting || !project) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '100px 20px', gap: 16 }}>
        <h2 style={{ color: 'var(--text-1)', fontSize: 24, fontWeight: 700 }}>Meeting Not Found</h2>
        <p style={{ color: 'var(--text-3)', fontSize: 15 }}>This meeting may have been deleted or the link is incorrect.</p>
        <Link href={`/projects/${projectId}/meetings`} className="btn btn-primary" style={{ textDecoration: 'none' }}>
          Back to Meetings
        </Link>
      </div>
    );
  }

  const isEnded = !!meeting.endedAt;
  const joinedByArray: string[] = (meeting as any).joinedBy || [];

  return (
    <div style={{ padding: '32px 40px', maxWidth: 800, margin: '0 auto', width: '100%' }}>
      <Link href={`/projects/${projectId}/meetings`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, marginBottom: 24 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back to Dashboard
      </Link>
      
      <div style={{ background: 'var(--bg-elevated)', padding: 40, borderRadius: 24, border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>{meeting.name || 'Unnamed Meeting'}</h1>
              {isEnded ? (
                <span style={{ fontSize: 13, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '4px 10px', borderRadius: 99, fontWeight: 700 }}>ENDED</span>
              ) : (
                <span style={{ fontSize: 13, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 10px', borderRadius: 99, fontWeight: 700 }}>ACTIVE</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 16, color: 'var(--text-3)', fontSize: 14, fontWeight: 500 }}>
              <span>{new Date(meeting.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              {meeting.endedAt && (
                <span>Ended at: {new Date(meeting.endedAt).toLocaleTimeString()}</span>
              )}
            </div>
          </div>
          
          {meeting.link && (
            <a href={meeting.link} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', background: 'var(--accent)' }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
              Join Call
            </a>
          )}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          {/* Invited List */}
          <div>
            <h3 style={{ fontSize: 14, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16, fontWeight: 600 }}>Invited Members ({meeting.attendees?.length || 0})</h3>
            {meeting.attendees?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {meeting.attendees.map(uid => {
                  const member = project.members?.[uid];
                  if (!member) return null;
                  return (
                    <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-primary)', padding: '8px 16px', borderRadius: 12 }}>
                      {member.photoURL ? (
                        <img src={member.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>
                          {member.displayName?.charAt(0)}
                        </div>
                      )}
                      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>{member.displayName}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: 'var(--text-3)', fontSize: 14 }}>No members were specifically invited.</p>
            )}
          </div>
          
          {/* Joined List */}
          <div>
            <h3 style={{ fontSize: 14, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16, fontWeight: 600 }}>Actually Joined ({joinedByArray.length})</h3>
            {joinedByArray.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {joinedByArray.map(uid => {
                  const member = project.members?.[uid];
                  if (!member) return null;
                  return (
                    <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-primary)', padding: '8px 16px', borderRadius: 12, border: '1px solid rgba(16,185,129,0.2)' }}>
                      {member.photoURL ? (
                        <img src={member.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>
                          {member.displayName?.charAt(0)}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>{member.displayName}</span>
                        <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>✓ Present</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: 24, background: 'var(--bg-primary)', borderRadius: 12, border: '1px dashed var(--border)', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-3)', fontSize: 14, margin: 0 }}>No one has joined this meeting via the app yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
