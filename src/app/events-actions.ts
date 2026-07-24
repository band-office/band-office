"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  AttendanceStatus,
  EventReminderAudience,
  EventResourceKind,
  EventRsvpStatus,
  EventStatus,
  EventVisibility,
  VolunteerOpportunityStatus,
} from "@/generated/prisma/client";
import { requirePermission } from "@/lib/auth";
import { CALENDAR_REVEAL_COOKIE, encodeCalendarReveal } from "@/lib/calendar-reveal";
import { getDb } from "@/lib/db";
import { deleteEventFile, storeEventFile } from "@/lib/event-storage";
import {
  addEventEquipmentItem,
  addEventGroup,
  addEventParticipant,
  addEventResource,
  addVolunteerSignup,
  cancelVolunteerSignup,
  createCalendarSubscription,
  createEvent,
  createEventReminderAnnouncement,
  createVolunteerOpportunity,
  recordAttendance,
  recordEventRsvp,
  refreshEventRoster,
  removeEventEquipmentItem,
  removeEventGroup,
  removeEventParticipant,
  removeEventResource,
  revokeCalendarSubscription,
  setEventStatus,
  setVolunteerOpportunityStatus,
  updateEvent,
  updateEventEquipmentPacking,
} from "@/lib/events-service";
import { getProgramContext } from "@/lib/program-context";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optional(formData: FormData, key: string) {
  return text(formData, key) || null;
}

function integer(formData: FormData, key: string, fallback?: number) {
  const value = text(formData, key);
  if (!value && fallback !== undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error("Enter a whole number.");
  return parsed;
}

function dateTime(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Enter a valid date and time.");
  return parsed;
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "The event operation could not be completed.";
}

function withMessage(path: string, kind: "success" | "error", value: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(value)}`;
}

async function actor(permission: "MANAGE_EVENTS" | "RECORD_ATTENDANCE") {
  return (await requirePermission(permission)).username;
}

function eventVisibility(value: string) {
  if (!Object.values(EventVisibility).includes(value as EventVisibility)) throw new Error("Choose public or private visibility.");
  return value as EventVisibility;
}

export async function createEventAction(formData: FormData) {
  let eventId = "";
  try {
    const { program, operatingPeriod } = await getProgramContext(getDb());
    const startsAt = dateTime(formData, "startsAt");
    if (!startsAt) throw new Error("Event start is required.");
    const result = await createEvent(getDb(), {
      programId: program.id,
      operatingPeriodId: operatingPeriod.id,
      name: text(formData, "name"),
      description: optional(formData, "description"),
      startsAt,
      endsAt: dateTime(formData, "endsAt"),
      location: optional(formData, "location"),
      visibility: eventVisibility(text(formData, "visibility")),
      itinerary: optional(formData, "itinerary"),
      notes: optional(formData, "notes"),
      rsvpEnabled: checked(formData, "rsvpEnabled"),
      attendanceEnabled: checked(formData, "attendanceEnabled"),
      groupIds: formData.getAll("groupIds").filter((value): value is string => typeof value === "string"),
      seriesId: optional(formData, "seriesId"),
      seriesName: optional(formData, "seriesName"),
    }, await actor("MANAGE_EVENTS"));
    eventId = result.event.id;
  } catch (error) {
    redirect(withMessage("/events", "error", message(error)));
  }
  revalidatePath("/events");
  redirect(withMessage(`/events/${eventId}`, "success", "Event created with a roster snapshot from the selected groups."));
}

export async function updateEventAction(formData: FormData) {
  const eventId = text(formData, "eventId");
  try {
    const startsAt = dateTime(formData, "startsAt");
    if (!startsAt) throw new Error("Event start is required.");
    await updateEvent(getDb(), eventId, {
      name: text(formData, "name"),
      description: optional(formData, "description"),
      startsAt,
      endsAt: dateTime(formData, "endsAt"),
      location: optional(formData, "location"),
      visibility: eventVisibility(text(formData, "visibility")),
      itinerary: optional(formData, "itinerary"),
      notes: optional(formData, "notes"),
      rsvpEnabled: checked(formData, "rsvpEnabled"),
      attendanceEnabled: checked(formData, "attendanceEnabled"),
      seriesId: optional(formData, "seriesId"),
    }, await actor("MANAGE_EVENTS"));
  } catch (error) {
    redirect(withMessage(`/events/${eventId}`, "error", message(error)));
  }
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
  redirect(withMessage(`/events/${eventId}`, "success", "Event details updated."));
}

export async function setEventStatusAction(formData: FormData) {
  const eventId = text(formData, "eventId");
  try {
    const value = text(formData, "status");
    if (!Object.values(EventStatus).includes(value as EventStatus)) throw new Error("Choose a valid event status.");
    await setEventStatus(getDb(), eventId, value as EventStatus, await actor("MANAGE_EVENTS"));
  } catch (error) {
    redirect(withMessage(`/events/${eventId}`, "error", message(error)));
  }
  revalidatePath("/events");
  redirect(withMessage(`/events/${eventId}`, "success", "Event status updated."));
}

export async function addEventGroupAction(formData: FormData) {
  const eventId = text(formData, "eventId");
  let added = 0;
  try {
    added = await addEventGroup(getDb(), eventId, text(formData, "groupId"), await actor("MANAGE_EVENTS"));
  } catch (error) {
    redirect(withMessage(`/events/${eventId}`, "error", message(error)));
  }
  revalidatePath(`/events/${eventId}`);
  redirect(withMessage(`/events/${eventId}`, "success", `Group added; ${added} current members added to the roster snapshot.`));
}

export async function removeEventGroupAction(formData: FormData) {
  const eventId = text(formData, "eventId");
  try {
    await removeEventGroup(getDb(), eventId, text(formData, "groupId"), await actor("MANAGE_EVENTS"));
  } catch (error) {
    redirect(withMessage(`/events/${eventId}`, "error", message(error)));
  }
  revalidatePath(`/events/${eventId}`);
  redirect(withMessage(`/events/${eventId}`, "success", "Group source removed. Existing roster history was preserved."));
}

export async function refreshEventRosterAction(formData: FormData) {
  const eventId = text(formData, "eventId");
  let added = 0;
  try {
    added = await refreshEventRoster(getDb(), eventId, await actor("MANAGE_EVENTS"));
  } catch (error) {
    redirect(withMessage(`/events/${eventId}`, "error", message(error)));
  }
  revalidatePath(`/events/${eventId}`);
  redirect(withMessage(`/events/${eventId}`, "success", `${added} new current group member${added === 1 ? "" : "s"} added; nobody was removed.`));
}

export async function addEventParticipantAction(formData: FormData) {
  const eventId = text(formData, "eventId");
  try {
    await addEventParticipant(getDb(), eventId, text(formData, "personId"), await actor("MANAGE_EVENTS"));
  } catch (error) {
    redirect(withMessage(`/events/${eventId}`, "error", message(error)));
  }
  revalidatePath(`/events/${eventId}`);
  redirect(withMessage(`/events/${eventId}`, "success", "Person added to the event roster."));
}

export async function removeEventParticipantAction(formData: FormData) {
  const eventId = text(formData, "eventId");
  try {
    await removeEventParticipant(getDb(), text(formData, "participantId"), await actor("MANAGE_EVENTS"));
  } catch (error) {
    redirect(withMessage(`/events/${eventId}`, "error", message(error)));
  }
  revalidatePath(`/events/${eventId}`);
  redirect(withMessage(`/events/${eventId}`, "success", "Person removed from the active roster; prior RSVP and attendance history remain."));
}

export async function recordEventRsvpAction(formData: FormData) {
  const eventId = text(formData, "eventId");
  try {
    const value = text(formData, "status");
    if (!Object.values(EventRsvpStatus).includes(value as EventRsvpStatus)) throw new Error("Choose a valid RSVP status.");
    await recordEventRsvp(getDb(), text(formData, "participantId"), value as EventRsvpStatus, await actor("MANAGE_EVENTS"));
  } catch (error) {
    redirect(withMessage(`/events/${eventId}`, "error", message(error)));
  }
  revalidatePath(`/events/${eventId}`);
  redirect(withMessage(`/events/${eventId}`, "success", "RSVP updated."));
}

export async function recordAttendanceAction(formData: FormData) {
  const eventId = text(formData, "eventId");
  let count = 0;
  try {
    const event = await getDb().event.findUnique({ where: { id: eventId }, include: { participants: { where: { status: "ACTIVE" }, select: { id: true } } } });
    if (!event) throw new Error("Event not found.");
    const entries = event.participants.map((participant) => {
      const value = text(formData, `attendance_${participant.id}`);
      if (!Object.values(AttendanceStatus).includes(value as AttendanceStatus)) throw new Error("Choose a valid attendance status for every roster member.");
      return { participantId: participant.id, status: value as AttendanceStatus };
    });
    count = await recordAttendance(getDb(), eventId, entries, await actor("RECORD_ATTENDANCE"));
  } catch (error) {
    redirect(withMessage(`/events/${eventId}/attendance`, "error", message(error)));
  }
  revalidatePath(`/events/${eventId}`);
  redirect(withMessage(`/events/${eventId}/attendance`, "success", `Attendance saved for ${count} roster members.`));
}

export async function addEventEquipmentAction(formData: FormData) {
  const eventId = text(formData, "eventId");
  try {
    await addEventEquipmentItem(getDb(), { eventId, assetId: optional(formData, "assetId"), label: text(formData, "label"), quantity: integer(formData, "quantity", 1), notes: optional(formData, "notes") }, await actor("MANAGE_EVENTS"));
  } catch (error) {
    redirect(withMessage(`/events/${eventId}`, "error", message(error)));
  }
  revalidatePath(`/events/${eventId}`);
  redirect(withMessage(`/events/${eventId}`, "success", "Equipment item added."));
}

export async function updateEventEquipmentPackingAction(formData: FormData) {
  const eventId = text(formData, "eventId");
  try {
    await updateEventEquipmentPacking(getDb(), text(formData, "itemId"), integer(formData, "packedQuantity", 0), await actor("MANAGE_EVENTS"));
  } catch (error) {
    redirect(withMessage(`/events/${eventId}`, "error", message(error)));
  }
  revalidatePath(`/events/${eventId}`);
  redirect(withMessage(`/events/${eventId}`, "success", "Packing count updated."));
}

export async function removeEventEquipmentAction(formData: FormData) {
  const eventId = text(formData, "eventId");
  try {
    await removeEventEquipmentItem(getDb(), text(formData, "itemId"), await actor("MANAGE_EVENTS"));
  } catch (error) {
    redirect(withMessage(`/events/${eventId}`, "error", message(error)));
  }
  revalidatePath(`/events/${eventId}`);
  redirect(withMessage(`/events/${eventId}`, "success", "Equipment item removed."));
}

export async function addEventLinkAction(formData: FormData) {
  const eventId = text(formData, "eventId");
  try {
    await addEventResource(getDb(), { eventId, kind: EventResourceKind.EXTERNAL_LINK, label: text(formData, "label"), externalUrl: text(formData, "externalUrl") }, await actor("MANAGE_EVENTS"));
  } catch (error) {
    redirect(withMessage(`/events/${eventId}`, "error", message(error)));
  }
  revalidatePath(`/events/${eventId}`);
  redirect(withMessage(`/events/${eventId}`, "success", "Event link added."));
}

export async function addEventFileAction(formData: FormData) {
  const eventId = text(formData, "eventId");
  let stored: Awaited<ReturnType<typeof storeEventFile>> | null = null;
  try {
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Choose a file.");
    stored = await storeEventFile(eventId, file);
    await addEventResource(getDb(), { eventId, kind: EventResourceKind.LOCAL_FILE, label: text(formData, "label"), ...stored }, await actor("MANAGE_EVENTS"));
  } catch (error) {
    if (stored) await deleteEventFile(stored.storageKey).catch(() => undefined);
    redirect(withMessage(`/events/${eventId}`, "error", message(error)));
  }
  revalidatePath(`/events/${eventId}`);
  redirect(withMessage(`/events/${eventId}`, "success", "Event file stored in managed local storage."));
}

export async function removeEventResourceAction(formData: FormData) {
  const eventId = text(formData, "eventId");
  try {
    const resource = await getDb().eventResource.findUnique({ where: { id: text(formData, "resourceId") } });
    if (!resource) throw new Error("Event resource not found.");
    await removeEventResource(getDb(), resource.id, await actor("MANAGE_EVENTS"));
    if (resource.storageKey) await deleteEventFile(resource.storageKey).catch(() => undefined);
  } catch (error) {
    redirect(withMessage(`/events/${eventId}`, "error", message(error)));
  }
  revalidatePath(`/events/${eventId}`);
  redirect(withMessage(`/events/${eventId}`, "success", "Event resource removed."));
}

export async function createVolunteerOpportunityAction(formData: FormData) {
  const eventId = text(formData, "eventId");
  try {
    await createVolunteerOpportunity(getDb(), { eventId, title: text(formData, "title"), description: optional(formData, "description"), startsAt: dateTime(formData, "startsAt"), endsAt: dateTime(formData, "endsAt"), capacity: integer(formData, "capacity", 1) }, await actor("MANAGE_EVENTS"));
  } catch (error) {
    redirect(withMessage(`/events/${eventId}`, "error", message(error)));
  }
  revalidatePath(`/events/${eventId}`);
  redirect(withMessage(`/events/${eventId}`, "success", "Volunteer opportunity created."));
}

export async function setVolunteerOpportunityStatusAction(formData: FormData) {
  const eventId = text(formData, "eventId");
  try {
    const value = text(formData, "status");
    if (!Object.values(VolunteerOpportunityStatus).includes(value as VolunteerOpportunityStatus)) throw new Error("Choose a valid opportunity status.");
    await setVolunteerOpportunityStatus(getDb(), text(formData, "opportunityId"), value as VolunteerOpportunityStatus, await actor("MANAGE_EVENTS"));
  } catch (error) {
    redirect(withMessage(`/events/${eventId}`, "error", message(error)));
  }
  revalidatePath(`/events/${eventId}`);
  redirect(withMessage(`/events/${eventId}`, "success", "Volunteer opportunity updated."));
}

export async function addVolunteerSignupAction(formData: FormData) {
  const eventId = text(formData, "eventId");
  try {
    await addVolunteerSignup(getDb(), text(formData, "opportunityId"), text(formData, "personId"), await actor("MANAGE_EVENTS"));
  } catch (error) {
    redirect(withMessage(`/events/${eventId}`, "error", message(error)));
  }
  revalidatePath(`/events/${eventId}`);
  redirect(withMessage(`/events/${eventId}`, "success", "Volunteer assignment recorded."));
}

export async function cancelVolunteerSignupAction(formData: FormData) {
  const eventId = text(formData, "eventId");
  try {
    await cancelVolunteerSignup(getDb(), text(formData, "signupId"), await actor("MANAGE_EVENTS"));
  } catch (error) {
    redirect(withMessage(`/events/${eventId}`, "error", message(error)));
  }
  revalidatePath(`/events/${eventId}`);
  redirect(withMessage(`/events/${eventId}`, "success", "Volunteer assignment canceled."));
}

export async function createEventReminderAction(formData: FormData) {
  const eventId = text(formData, "eventId");
  let announcementId = "";
  try {
    const eventActor = await actor("MANAGE_EVENTS");
    await requirePermission("MANAGE_COMMUNICATIONS");
    const audienceValue = text(formData, "audience");
    if (!Object.values(EventReminderAudience).includes(audienceValue as EventReminderAudience)) throw new Error("Choose a reminder audience.");
    const audience = audienceValue as EventReminderAudience;
    const scheduledAt = dateTime(formData, "scheduledAt");
    const result = await createEventReminderAnnouncement(getDb(), { eventId, audience, scheduledFor: scheduledAt }, eventActor);
    announcementId = result.announcement.id;
  } catch (error) {
    redirect(withMessage(`/events/${eventId}`, "error", message(error)));
  }
  revalidatePath(`/events/${eventId}`);
  redirect(withMessage(`/communications/${announcementId}`, "success", "Event reminder created. Review its audience and delivery state in Email."));
}

export async function createCalendarSubscriptionAction(formData: FormData) {
  try {
    const user = await requirePermission("MANAGE_EVENTS");
    const result = await createCalendarSubscription(getDb(), user.programId, text(formData, "name"), user.username);
    const store = await cookies();
    store.set(CALENDAR_REVEAL_COOKIE, encodeCalendarReveal({ token: result.token, name: result.subscription.name }), {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/events",
      maxAge: 120,
    });
  } catch (error) {
    redirect(withMessage("/events", "error", message(error)));
  }
  revalidatePath("/events");
  redirect(withMessage("/events", "success", "Private calendar link created. It is shown once; store it in the approved calendar client."));
}

export async function revokeCalendarSubscriptionAction(formData: FormData) {
  try {
    await revokeCalendarSubscription(getDb(), text(formData, "subscriptionId"), await actor("MANAGE_EVENTS"));
  } catch (error) {
    redirect(withMessage("/events", "error", message(error)));
  }
  revalidatePath("/events");
  redirect(withMessage("/events", "success", "Private calendar link revoked."));
}
