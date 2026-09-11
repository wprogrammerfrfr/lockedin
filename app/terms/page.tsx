import Link from "next/link";
import { ChromePage } from "@/components/layout/ChromePage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <ChromePage>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Terms of Service
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Last updated: August 14, 2026
          </p>
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Using LockedIn</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              LockedIn is a focus tracking and social accountability product for
              students. By creating an account you agree to use the service
              lawfully, respect other members, and not harass, spam, or attempt
              to abuse rooms, follows, or the feed.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Content &amp; moderation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              You are responsible for captions, comments, and profile content you
              post. We may remove content or suspend accounts that violate these
              terms. You can report profiles, posts, and comments from the app.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Disclaimer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              LockedIn is provided as-is without warranties. Focus hours and
              badges (including Self-Reported vs GitHub Verified) are
              informational and not academic credentials. We may update these
              terms; continued use after changes means you accept the updated
              terms.
            </p>
            <p>
              Privacy details:{" "}
              <Link
                href="/privacy"
                className="font-medium text-foreground underline"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </ChromePage>
  );
}
