interface DisplayNameInput {
  clientDisplayName?: string | null;
  email?: string | null;
  metadata: unknown;
}

function getAuthDisplayName(email: string | null | undefined, metadata: unknown): string {
  if (metadata && typeof metadata === "object") {
    const typed = metadata as {
      full_name?: unknown;
      name?: unknown;
      user_name?: unknown;
    };

    if (typeof typed.full_name === "string" && typed.full_name.trim()) {
      return typed.full_name.trim();
    }

    if (typeof typed.name === "string" && typed.name.trim()) {
      return typed.name.trim();
    }

    if (typeof typed.user_name === "string" && typed.user_name.trim()) {
      return typed.user_name.trim();
    }
  }

  if (!email) {
    return "there";
  }

  const [localPart] = email.split("@");
  if (!localPart) {
    return "there";
  }

  return localPart;
}

export function getUserDisplayName(input: DisplayNameInput): string {
  if (typeof input.clientDisplayName === "string" && input.clientDisplayName.trim()) {
    return input.clientDisplayName.trim();
  }

  return getAuthDisplayName(input.email, input.metadata);
}
