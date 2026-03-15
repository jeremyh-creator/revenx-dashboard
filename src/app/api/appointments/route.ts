import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/appointments
 *
 * Create an appointment. Use agent_email to identify the agent (resolves to agent_id).
 *
 * Body (JSON):
 * - agent_email: string (required) - matches agents.emails
 * - prospect_email?: string
 * - prospect_first_name?: string (or first_name)
 * - prospect_last_name?: string (or last_name)
 * - prospect_name?: string (or name)
 * - prospect_questions?: string
 * - appointment_datetime: string (ISO 8601, required)
 * - timezone?: string (default 'UTC')
 * - age_raw?: string
 * - assets_raw?: string
 * - utm_source?: string
 * - status?: string (default 'Confirmed')
 *
 * Optional: X-API-Key header for Zapier/webhook auth (set API_SECRET in .env.local)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agent_email,
      prospect_email,
      first_name,
      last_name,
      name,
      prospect_questions,
      appointment_datetime,
      timezone = "UTC",
      age_raw,
      assets_raw,
      utm_source,
      status = "Confirmed",
    } = body;

    if (!agent_email || !appointment_datetime) {
      return NextResponse.json(
        { error: "agent_email and appointment_datetime are required" },
        { status: 400 }
      );
    }

    const apiKey = request.headers.get("X-API-Key");
    const secret = process.env.API_SECRET;
    if (secret && apiKey !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // Resolve agent by email
    const normalizedEmail = String(agent_email).toLowerCase().trim();
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id")
      .overlaps("emails", [normalizedEmail])
      .limit(1)
      .maybeSingle();

    if (agentError || !agent) {
      return NextResponse.json(
        {
          error: "Agent not found",
          detail: `No agent found with email: ${agent_email}`,
        },
        { status: 404 }
      );
    }

    const { data: appointment, error } = await supabase
      .from("appointments")
      .insert({
        agent_id: agent.id,
        prospect_email: prospect_email || null,
        first_name: first_name || null,
        last_name: last_name || null,
        name: name || null,
        prospect_questions: prospect_questions || null,
        appointment_datetime,
        timezone,
        age_raw: age_raw || null,
        assets_raw: assets_raw || null,
        utm_source: utm_source || null,
        status,
      })
      .select("id, agent_id, appointment_datetime, status")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, appointment });
  } catch (e) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
