import { cookies } from "next/headers";
import { requireApiUser } from "@/lib/auth";
import { CALENDAR_REVEAL_COOKIE } from "@/lib/calendar-reveal";

export async function DELETE() {
  const user = await requireApiUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const store = await cookies();
  store.set(CALENDAR_REVEAL_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/events",
    maxAge: 0,
  });
  return new Response(null, { status: 204 });
}
