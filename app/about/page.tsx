import { ChromePage } from "@/components/layout/ChromePage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <ChromePage>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            About
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            How LockedIn works — privacy, Rooms, and verification.
          </p>
        </div>

        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base">Sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>
              LOCK IN starts a timed focus session. BREAK pauses active time.
              TAP OUT ends early. Break minutes never count toward locked-in
              hours.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base">Rooms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>
              Rooms hold 2–6 people. Presence is text/UI only — no camera or
              mic. Drop below 2 members and the room warns for 60 seconds then
              closes. Vote rooms use shared break voting; Pomodoro rooms run a
              host-set cadence.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base">Privacy &amp; sharing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>
              Profiles are public by default. Session activity never auto-posts.
              Explore only shows sessions you explicitly share. Focus calendars
              on other profiles unlock after an accepted follow. Verification
              badges: GitHub Verified (linked GitHub account) vs Self-Reported.
            </p>
            <p>
              <a href="/privacy" className="font-medium text-slate-800 underline">
                Privacy Policy
              </a>
              {" · "}
              <a href="/terms" className="font-medium text-slate-800 underline">
                Terms of Service
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </ChromePage>
  );
}
