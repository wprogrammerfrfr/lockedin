"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, KeyRound, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteOwnAccount, updateProfile } from "@/features/profile/api";
import {
  BREAK_TIMER_PRESETS,
  loadBreakTimerMinutes,
  saveBreakTimerMinutes,
} from "@/lib/preferences/break-timer";
import {
  type Locale,
  normalizeLocale,
  useTranslation,
} from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";
import { useAuth } from "@/components/auth/AuthProvider";

const DELETE_CONFIRM = "DELETE";

export function ProfileSettings({
  email,
  userId,
  initialLocale,
  initialBreakTimerMinutes,
}: {
  email?: string | null;
  userId?: string | null;
  initialLocale?: string | null;
  initialBreakTimerMinutes?: number | null;
}) {
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();
  const { refreshProfile } = useAuth();
  const [resetEmail, setResetEmail] = useState(email ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [language, setLanguage] = useState<Locale>(
    normalizeLocale(initialLocale ?? locale),
  );
  const [breakMinutes, setBreakMinutes] = useState(
    initialBreakTimerMinutes && initialBreakTimerMinutes >= 1
      ? initialBreakTimerMinutes
      : loadBreakTimerMinutes(),
  );
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsMessage, setPrefsMessage] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canConfirmDelete = deleteConfirm === DELETE_CONFIRM;

  useEffect(() => {
    if (initialLocale) setLanguage(normalizeLocale(initialLocale));
  }, [initialLocale]);

  useEffect(() => {
    if (initialBreakTimerMinutes && initialBreakTimerMinutes >= 1) {
      setBreakMinutes(initialBreakTimerMinutes);
    }
  }, [initialBreakTimerMinutes]);

  async function handlePasswordReset() {
    setError(null);
    setMessage(null);
    if (!email && !resetEmail) {
      setError("No email on this account.");
      return;
    }
    const target = email || resetEmail;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        target,
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
        },
      );
      if (resetError) {
        setError(userFacingError(resetError, "Could not send reset email."));
        return;
      }
      setMessage(t("settings.checkEmail"));
    } catch (err) {
      setError(userFacingError(err, "Reset failed."));
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePreferences() {
    setPrefsMessage(null);
    setPrefsSaving(true);
    try {
      setLocale(language);
      saveBreakTimerMinutes(breakMinutes);
      if (userId) {
        await updateProfile(createClient(), userId, {
          locale: language,
          break_timer_minutes: breakMinutes,
        });
        await refreshProfile();
      }
      setPrefsMessage(t("profile.saved"));
    } catch (err) {
      setPrefsMessage(userFacingError(err, t("common.saveFailed")));
    } finally {
      setPrefsSaving(false);
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function openDeleteDialog() {
    setDeleteConfirm("");
    setDeleteError(null);
    setDeleteOpen(true);
  }

  function closeDeleteDialog(open: boolean) {
    if (deleting) return;
    setDeleteOpen(open);
    if (!open) {
      setDeleteConfirm("");
      setDeleteError(null);
    }
  }

  async function handleDeleteAccount() {
    if (!canConfirmDelete || deleting) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      const supabase = createClient();
      await deleteOwnAccount(supabase);
      await supabase.auth.signOut();
      window.location.assign("/login");
    } catch (err) {
      setDeleteError(
        userFacingError(err, "Could not delete your account. Try again."),
      );
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="font-display text-sm font-semibold text-slate-900">
          {t("profile.language")}
        </h3>
        <select
          value={language}
          onChange={(e) => setLanguage(normalizeLocale(e.target.value))}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
        >
          <option value="en">{t("profile.lang.en")}</option>
          <option value="tr">{t("profile.lang.tr")}</option>
          <option value="ko">{t("profile.lang.ko")}</option>
        </select>
      </div>

      <div className="space-y-3">
        <h3 className="font-display text-sm font-semibold text-slate-900">
          {t("break.timerSetting")}
        </h3>
        <p className="text-xs text-slate-500">{t("break.timerSettingDesc")}</p>
        <select
          value={breakMinutes}
          onChange={(e) => setBreakMinutes(Number(e.target.value))}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
        >
          {BREAK_TIMER_PRESETS.map((m) => (
            <option key={m} value={m}>
              {t("common.minutes", { n: m })}
            </option>
          ))}
        </select>
        <Button
          type="button"
          className="rounded-xl bg-lime-500 text-slate-900 hover:bg-lime-400"
          disabled={prefsSaving}
          onClick={() => void handleSavePreferences()}
        >
          {prefsSaving ? t("profile.saving") : t("profile.saveProfile")}
        </Button>
        {prefsMessage ? (
          <p className="text-xs text-slate-500" role="status">
            {prefsMessage}
          </p>
        ) : null}
      </div>

      <div className="space-y-3 border-t border-slate-200 pt-4">
        <h3 className="font-display text-sm font-semibold text-slate-900">
          {t("settings.passwordReset")}
        </h3>
        {email ? (
          <p className="text-xs text-slate-500">
            {t("settings.sendResetLink", { email })}
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-500">{t("settings.oauthNoEmail")}</p>
            <div>
              <Label htmlFor="reset-email">{t("settings.email")}</Label>
              <Input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@school.edu"
              />
            </div>
          </>
        )}
        <Button
          type="button"
          variant="outline"
          className="rounded-xl border-slate-200"
          disabled={busy}
          onClick={handlePasswordReset}
        >
          <KeyRound className="h-4 w-4" />
          {t("settings.sendResetEmail")}
        </Button>
        {message && (
          <p className="text-xs text-emerald-600" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="border-t border-slate-200 pt-4">
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-xl border-slate-200 text-slate-700"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          {t("settings.logOut")}
        </Button>
      </div>

      <div className="space-y-3 border-t border-slate-200 pt-4">
        <h3 className="font-display text-sm font-semibold text-red-700">
          {t("settings.dangerZone")}
        </h3>
        <p className="text-xs text-slate-500">{t("settings.deleteWarning")}</p>
        <Button
          type="button"
          variant="destructive"
          className="w-full rounded-xl"
          onClick={openDeleteDialog}
        >
          <Trash2 className="h-4 w-4" />
          {t("settings.deleteAccount")}
        </Button>
      </div>

      <Dialog open={deleteOpen} onOpenChange={closeDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("settings.deleteConfirmDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="delete-confirm">{t("settings.typeDelete")}</Label>
            <Input
              id="delete-confirm"
              value={deleteConfirm}
              disabled={deleting}
              autoComplete="off"
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
            />
          </div>

          {deleteError && (
            <p
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {deleteError}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={deleting}
              onClick={() => closeDeleteDialog(false)}
            >
              {t("settings.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              disabled={!canConfirmDelete || deleting}
              onClick={handleDeleteAccount}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {t("settings.deleteMyAccount")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
