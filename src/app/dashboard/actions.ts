"use server";

import { getAuthWithAgent } from "@/lib/auth";
import { getAgentShowRate } from "@/lib/showRate";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const NO_SHOW_MIN_HOURS = 48;
const NO_SHOW_MAX_DAYS = 14;
const EVIDENCE_MAX_SIZE_MB = 10;
const EVIDENCE_MAX_FILES = 10;

export async function markAppointmentAsNoShow(appointmentId: string) {
  const auth = await getAuthWithAgent();
  if (!auth) {
    return { error: "Unauthorized" };
  }

  const supabase = await createClient();

  const { data: appointment, error: fetchError } = await supabase
    .from("appointments")
    .select("id, agent_id, appointment_datetime, status")
    .eq("id", appointmentId)
    .single();

  if (fetchError || !appointment) {
    return { error: "Appointment not found" };
  }

  if (appointment.agent_id !== auth.agent.id) {
    return { error: "Unauthorized" };
  }

  if (appointment.status !== "Confirmed" && appointment.status !== "Show") {
    return {
      error: "Only Confirmed or Show appointments can be marked as no-show",
    };
  }

  const appointmentTime = new Date(appointment.appointment_datetime);
  const now = new Date();
  const minTime = new Date();
  minTime.setHours(minTime.getHours() - NO_SHOW_MIN_HOURS);
  const maxTime = new Date(appointmentTime);
  maxTime.setDate(maxTime.getDate() + NO_SHOW_MAX_DAYS);

  if (appointmentTime > minTime) {
    return {
      error: `Appointment must be at least ${NO_SHOW_MIN_HOURS} hours old to mark as no-show`,
    };
  }
  if (now > maxTime) {
    return {
      error: `No-show cannot be marked more than ${NO_SHOW_MAX_DAYS} days after the appointment`,
    };
  }

  const showRate = await getAgentShowRate(auth.agent.id);
  if (showRate.requiresEvidence) {
    return {
      error: "Evidence required",
      requiresEvidence: true,
    };
  }

  const { error: updateError } = await supabase
    .from("appointments")
    .update({
      status: "No-Show (Approved)",
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentId);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

export async function markAppointmentAsNoShowWithEvidence(
  appointmentId: string,
  formData: FormData
) {
  const auth = await getAuthWithAgent();
  if (!auth) {
    return { error: "Unauthorized" };
  }

  const files = formData.getAll("evidence") as File[];
  const validFiles = files.filter((f) => f && f.size > 0);
  if (validFiles.length === 0) {
    return { error: "At least one evidence file is required" };
  }
  if (validFiles.length > EVIDENCE_MAX_FILES) {
    return { error: `Maximum ${EVIDENCE_MAX_FILES} files allowed` };
  }
  for (const file of validFiles) {
    if (file.size > EVIDENCE_MAX_SIZE_MB * 1024 * 1024) {
      return { error: `Each file must be under ${EVIDENCE_MAX_SIZE_MB}MB` };
    }
  }

  const supabase = await createClient();

  const { data: appointment, error: fetchError } = await supabase
    .from("appointments")
    .select("id, agent_id, appointment_datetime, status")
    .eq("id", appointmentId)
    .single();

  if (fetchError || !appointment) {
    return { error: "Appointment not found" };
  }

  if (appointment.agent_id !== auth.agent.id) {
    return { error: "Unauthorized" };
  }

  if (appointment.status !== "Confirmed" && appointment.status !== "Show") {
    return {
      error: "Only Confirmed or Show appointments can be marked as no-show",
    };
  }

  const appointmentTime = new Date(appointment.appointment_datetime);
  const now = new Date();
  const minTime = new Date();
  minTime.setHours(minTime.getHours() - NO_SHOW_MIN_HOURS);
  const maxTime = new Date(appointmentTime);
  maxTime.setDate(maxTime.getDate() + NO_SHOW_MAX_DAYS);

  if (appointmentTime > minTime) {
    return {
      error: `Appointment must be at least ${NO_SHOW_MIN_HOURS} hours old to mark as no-show`,
    };
  }
  if (now > maxTime) {
    return {
      error: `No-show cannot be marked more than ${NO_SHOW_MAX_DAYS} days after the appointment`,
    };
  }

  const showRate = await getAgentShowRate(auth.agent.id);
  if (!showRate.requiresEvidence) {
    return markAppointmentAsNoShow(appointmentId);
  }

  for (let i = 0; i < validFiles.length; i++) {
    const file = validFiles[i];
    const path = `${appointmentId}/${Date.now()}-${i}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("no-show-evidence")
      .upload(path, arrayBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return {
        error: `Upload failed: ${uploadError.message}. Create the "no-show-evidence" bucket in Supabase: Dashboard → Storage → New bucket.`,
      };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("no-show-evidence").getPublicUrl(path);

    const { error: evidenceError } = await supabase
      .from("no_show_evidence")
      .insert({
        appointment_id: appointmentId,
        uploaded_by: auth.userId,
        file_url: publicUrl,
      });

    if (evidenceError) {
      return { error: evidenceError.message };
    }
  }

  const { error: updateError } = await supabase
    .from("appointments")
    .update({
      status: "No-Show (Pending)",
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentId);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}
