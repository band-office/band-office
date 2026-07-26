"use server";

import { redirect } from "next/navigation";
import {
  authenticatePortal,
  destroyPortalSession,
  requestPortalPasswordReset,
  resetPortalPassword,
} from "@/lib/portal-auth";
import { getDb } from "@/lib/db";

function value(formData: FormData, name: string) {
  const raw = formData.get(name);
  return typeof raw === "string" ? raw.trim() : "";
}

function portalRedirect(path: string, kind: "success" | "error", message: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(message)}`);
}

export async function portalLoginAction(formData: FormData) {
  const user = await authenticatePortal(value(formData, "email"), value(formData, "password"));
  if (!user) portalRedirect("/portal/login", "error", "Email or password is incorrect.");
  redirect("/portal");
}

export async function requestPortalPasswordResetAction(formData: FormData) {
  await requestPortalPasswordReset(getDb(), value(formData, "email"));
  portalRedirect(
    "/portal/forgot-password",
    "success",
    "If an eligible portal account uses that email, a one-time code has been sent.",
  );
}

export async function resetPortalPasswordAction(formData: FormData) {
  const password = value(formData, "password");
  const confirmation = value(formData, "confirmation");
  if (password !== confirmation) portalRedirect("/portal/reset-password", "error", "Passwords do not match.");
  try {
    await resetPortalPassword(getDb(), {
      email: value(formData, "email"),
      code: value(formData, "code"),
      password,
    });
  } catch (error) {
    portalRedirect(
      "/portal/reset-password",
      "error",
      error instanceof Error ? error.message : "The password could not be reset.",
    );
  }
  portalRedirect("/portal/login", "success", "Password updated. You can sign in now.");
}

export async function portalLogoutAction() {
  await destroyPortalSession();
  redirect("/portal/login");
}
