import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { message, projectContext } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];
    const todayReadable = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const membersText = (projectContext?.members || [])
      .map((m: any) => `- ${m.name} (${m.role})`)
      .join('\n') || 'No members listed';

    const modulesText = (projectContext?.modules || []).join(', ') || 'None';
    const meetingsText = (projectContext?.meetings || [])
      .map((m: any) => `- ID: ${m.id}, Name: "${m.name}", Date: ${m.date}`)
      .join('\n') || 'No recent meetings';

    const prompt = `You are an AI Project Coordinator for a software project management system. 
Your job is to convert a user's casual/natural language message into a professional, structured software task.

TODAY'S DATE: ${today} (${todayReadable})

PROJECT CONTEXT:
Team Members:
${membersText}

Available Modules:
${modulesText}

Recent Meetings:
${meetingsText}

USER'S MESSAGE (may be in Tamil, Tanglish, broken English, or mixed):
"${message}"

INSTRUCTIONS:
1. Understand the intent from the message, even if it's in Tamil, Tanglish, or casual English.
2. Generate a professional task in English.
3. Auto-detect all fields intelligently.

TASK TYPE DETECTION:
- "bug" → crashes, errors, not working, fix, broken, varala (didn't come), aagala (not happening)
- "feature" → new thing, add, implement, create, build
- "improvement" → enhance, optimize, update, change, better

MODULE DETECTION from keywords:
- login/auth/otp/password → "Authentication"
- attendance/location/map → "Attendance"
- dashboard/home/stats → "Dashboard"
- report/export/pdf/excel → "Reports"
- meeting/sync/standup → "Meetings"
- task/assign/kanban → "Task Management"
- notification/alert → "Notifications"
- ai/bot/assistant → "AI System"
- mobile/app → "Mobile App"
- chat/message → "Chat"
- profile/user/account → "User Profile"
- github/commit/deploy/repo → "GitHub Integration"
- payment/billing → "Billing"
- settings/config → "Settings"
If none match, infer intelligently or create a new module name.

PRIORITY DETECTION:
- "critical" → production down, payment issue, login blocked, security issue, data loss, urgent, asapuu
- "high" → important, customer issue, major bug, blocked
- "medium" → normal feature, UI changes, enhancement (DEFAULT)
- "low" → minor text fix, styling, small change

DUE DATE DETECTION:
- "today" / "indha" → ${today}
- "tomorrow" / "naalaikki" → ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}
- "next week" → ${new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}
- "in 2 days" → ${new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]}
- "in 3 days" → ${new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]}
- If no date mentioned: suggest a reasonable date (1 day for critical/high, 3 days for medium, 7 days for low)

ASSIGNEE DETECTION:
- Match names or roles mentioned in the message to the team members list above
- If user says "me" or "naan" assign to the person who created the task (leave assigneeId as null, assigneeName as "Self")
- If no clear match, leave assigneeId as null and assigneeName as ""

MEETING DETECTION:
- If the message mentions a meeting, try to match it to the recent meetings list
- Otherwise use meetingId: null

TAGS:
- Extract 2-4 relevant lowercase technical tags from the task content

OUTPUT FORMAT (respond with ONLY this JSON, no markdown, no explanation):
{
  "taskType": "bug" | "feature" | "improvement",
  "module": "string",
  "title": "string (short, professional, max 8 words)",
  "description": "string (2-4 sentences, professional developer-friendly English, explain problem/goal, expected behavior, current issue if bug)",
  "priority": "low" | "medium" | "high" | "urgent",
  "status": "pending",
  "dueDate": "YYYY-MM-DD",
  "assigneeId": null | "string (exact uid from members)",
  "assigneeName": "string",
  "meetingId": null | "string",
  "tags": ["tag1", "tag2"],
  "confidence": 0-100,
  "detectedLanguage": "Tamil" | "Tanglish" | "English" | "Mixed"
}`;

    let response;
    let rawText = '';
    let success = false;
    let lastError = '';

    // Retry up to 3 times
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await fetch('https://text.pollinations.ai/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'system', content: prompt }],
            jsonMode: true
          }),
        });

        if (response.ok) {
          rawText = await response.text();
          success = true;
          break; // Success, exit retry loop
        } else {
          lastError = await response.text();
          console.error(`AI service error (Attempt ${attempt}/3):`, lastError);
        }
      } catch (err: any) {
        lastError = err.message || 'Fetch failed';
        console.error(`AI fetch error (Attempt ${attempt}/3):`, err);
      }

      if (attempt < 3) {
        // Wait 1 second before retrying
        await new Promise(res => setTimeout(res, 1000));
      }
    }

    if (!success) {
      console.error('AI service failed after 3 attempts. Last error:', lastError);
      return NextResponse.json({ error: 'AI service is temporarily unavailable. Please try again later.' }, { status: 502 });
    }

    // Strip markdown fences if present
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse AI response:', rawText);
      return NextResponse.json({ error: 'AI returned an unexpected format. Please try again.' }, { status: 422 });
    }

    return NextResponse.json({ task: parsed });
  } catch (error: any) {
    console.error('AI task route error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
