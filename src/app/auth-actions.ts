"use server";

import { redirect } from "next/navigation";
import { authenticate, createSession, destroySession, setupFirstInstallation } from "@/lib/auth";

function value(formData: FormData, name: string) {
  const raw = formData.get(name);
  return typeof raw === "string" ? raw.trim() : "";
}

function loginError(message: string, setup = false) {
  redirect(`/login?${setup ? "setup=1&" : ""}error=${encodeURIComponent(message)}`);
}

export async function setupDirectorAction(formData: FormData) {
  const username = value(formData, "username");
  const programName = value(formData, "programName");
  const password = value(formData, "password");
  const confirmation = value(formData, "confirmation");
  if (password !== confirmation) loginError("Passwords do not match.", true);
  let user;
  try {
    user = await setupFirstInstallation(programName, username, password);
  } catch (error) {
    loginError(error instanceof Error ? error.message : "Account setup failed.", true);
  }
  await createSession(user!.id);
  redirect("/today");
}

export async function loginAction(formData: FormData) {
  const user = await authenticate(value(formData, "username"), value(formData, "password"));
  if (!user) loginError("Username or password is incorrect.");
  redirect("/today");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
