import Link from "next/link";
import { ChromePage } from "@/components/layout/ChromePage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <ChromePage>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Privacy Policy
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Last updated: August 14, 2026
          </p>
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">What we collect</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              LockedIn stores your account email (or OAuth identity), username,
              optional bio and avatar, focus session timings, room membership,
              follows, and posts you explicitly share. We use Supabase for
              authentication, database, and storage.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">How we use data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Session activity never auto-posts to Explore. Public profiles show
              your username and bio; focus calendars and day details are visible
              to you and people you accept as followers. Rooms use text/UI
              presence only — no camera or microphone.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Your controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              You can edit your profile, unfollow or block users, unshare posts,
              and permanently delete your account from Profile → Settings. Account
              deletion removes your profile, sessions, posts, and uploaded
              avatars/post cards.
            </p>
            <p>
              Questions: contact the LockedIn team via the email on your account
              provider or open an issue on the project repository.
            </p>
            <p>
              See also{" "}
              <Link href="/terms" className="font-medium text-foreground underline">
                Terms of Service
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </ChromePage>
  );
}
