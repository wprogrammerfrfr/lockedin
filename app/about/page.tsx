"use client";

import { ChromePage } from "@/components/layout/ChromePage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export default function AboutPage() {
  const { t } = useTranslation();

  return (
    <ChromePage>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {t("about.title")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t("about.subtitle")}</p>
        </div>

        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base">
              {t("about.sessions.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>{t("about.sessions.body")}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base">{t("about.rooms.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>{t("about.rooms.body")}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base">
              {t("about.privacy.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>{t("about.privacy.body")}</p>
            <p>
              <a href="/privacy" className="font-medium text-slate-800 underline">
                {t("about.privacyPolicy")}
              </a>
              {" · "}
              <a href="/terms" className="font-medium text-slate-800 underline">
                {t("about.termsOfService")}
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </ChromePage>
  );
}
