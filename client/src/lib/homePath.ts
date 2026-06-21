type HomeUser = { isAdmin?: boolean } | null | undefined;

export function getHomePath(user?: HomeUser): string {
  if (!user) return "/";
  return user.isAdmin ? "/admin" : "/dashboard";
}
