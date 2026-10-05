const NON_SAFARI_IOS =
  /CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV|FB_IAB|Messenger|TikTok|musical_ly|LinkedInApp|Slack|Discord|MicroMessenger|Line\/|Snapchat|Twitter|Pinterest|GSA\/|WhatsApp|Telegram|BytedanceWebview/i;

export type IosInstallSurface = "safari" | "other";

/** Safari can add to the Home Screen. Every other iOS browser has to open Safari first. */
export function iosInstallSurface(
  ua: string,
  platform = "",
  maxTouchPoints = 0,
): IosInstallSurface | null {
  const ios =
    /iPad|iPhone|iPod/.test(ua) ||
    (platform === "MacIntel" && maxTouchPoints > 1);
  if (!ios) return null;
  if (NON_SAFARI_IOS.test(ua)) return "other";
  return "safari";
}
