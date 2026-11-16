export function initialSocialTab(friendId?: string | null): "feed" | "friends" {
  return friendId ? "friends" : "feed";
}