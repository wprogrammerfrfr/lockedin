import { LockedInLogo } from "@/components/brand/LockedInLogo";

/** LinkedIn + Strava = LockedIn hero equation with brand-colored wordmarks. */

function LinkedInWordmark() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 sm:gap-1.5">
      <svg
        className="h-5 w-5 shrink-0 sm:h-7 sm:w-7 lg:h-8 lg:w-8"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <rect width="24" height="24" rx="3" fill="#0A66C2" />
        <path
          d="M7.1 10.2h2.55v8.3H7.1v-8.3zm1.27-4.05a1.48 1.48 0 1 1 0 2.96 1.48 1.48 0 0 1 0-2.96zM11.75 10.2h2.45v1.13c.35-.66 1.22-1.35 2.55-1.35 2.72 0 3.22 1.79 3.22 4.12v4.4H17.4v-3.9c0-.93-.02-2.12-1.29-2.12-1.3 0-1.5 1.01-1.5 2.05v3.97h-2.86V10.2z"
          fill="#fff"
        />
      </svg>
      <span
        className="text-sm font-bold leading-none tracking-tight sm:text-[1.35rem] lg:text-[1.65rem]"
        style={{
          color: "#0A66C2",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        LinkedIn
      </span>
    </span>
  );
}

function StravaWordmark() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 sm:gap-1.5">
      <svg
        className="h-5 w-5 shrink-0 sm:h-7 sm:w-7 lg:h-8 lg:w-8"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M12 2.5 17.8 15h-3.4L12 9.4 9.6 15H6.2L12 2.5z"
          fill="#FC4C02"
        />
        <path
          d="m14.4 15 2.6 5.5h-3.4L12 15h2.4z"
          fill="#FC4C02"
          opacity="0.45"
        />
      </svg>
      <span
        className="text-sm font-bold leading-none tracking-[0.06em] sm:text-[1.35rem] lg:text-[1.65rem]"
        style={{
          color: "#FC4C02",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        STRAVA
      </span>
    </span>
  );
}

export function WelcomeHeroEquation() {
  return (
    <div>
      <h1 className="sr-only">
        LinkedIn + Strava = LockedIn. For everyone who needs to LOCK TF IN.
      </h1>
      <div
        className="flex flex-nowrap items-center gap-x-1.5 whitespace-nowrap sm:gap-x-2.5 lg:gap-x-3.5"
        aria-hidden
      >
        <LinkedInWordmark />
        <span className="font-display text-lg font-bold text-slate-400 sm:text-2xl lg:text-3xl">
          +
        </span>
        <StravaWordmark />
        <span className="font-display text-lg font-bold text-slate-400 sm:text-2xl lg:text-3xl">
          =
        </span>
        <LockedInLogo className="text-xl tracking-tight sm:text-3xl lg:text-5xl" />
      </div>
      <p className="mt-4 font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">
        For everyone who needs to LOCK TF IN
      </p>
    </div>
  );
}
