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
 * - external_source: string (required) - e.g. 'calendly' or 'custom'
 * - external_id: string (required) - Calendly Event UUID or custom calendar event ID
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
      external_source,
      external_id,
    } = body;

    if (!agent_email || !appointment_datetime) {
      return NextResponse.json(
        { error: "agent_email and appointment_datetime are required" },
        { status: 400 }
      );
    }
    if (!external_source || !external_id) {
      return NextResponse.json(
        {
          error:
            "external_source and external_id are required to create/update appointments",
        },
        { status: 400 }
      );
    }

    const source = String(external_source).toLowerCase().trim();
    if (source !== "calendly" && source !== "custom") {
      return NextResponse.json(
        { error: "external_source must be 'calendly' or 'custom'" },
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

    const basePayload = {
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
      external_source: source,
      external_id: String(external_id),
      updated_at: new Date().toISOString(),
    } as const;

    // If external identifiers are provided, update existing appointment instead of creating duplicates.
    let appointment:
      | { id: string; agent_id: string; appointment_datetime: string; status: string }
      | null = null;

    if (source && external_id) {
      const { data: existing, error: existingError } = await supabase
        .from("appointments")
        .select("id")
        .eq("external_source", source)
        .eq("external_id", String(external_id))
        .limit(1)
        .maybeSingle();

      if (existingError) {
        return NextResponse.json({ error: existingError.message }, { status: 500 });
      }

      if (existing?.id) {
        const { data: updated, error: updateError } = await supabase
          .from("appointments")
          .update(basePayload)
          .eq("id", existing.id)
          .select("id, agent_id, appointment_datetime, status")
          .single();
        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
        appointment = updated;
      }
    }

    if (!appointment) {
      const { data: inserted, error: insertError } = await supabase
        .from("appointments")
        .insert(basePayload)
        .select("id, agent_id, appointment_datetime, status")
        .single();
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      appointment = inserted;
    }

    return NextResponse.json({ success: true, appointment });
  } catch (e) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
