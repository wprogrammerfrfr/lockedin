"use client";

import { useState } from "react";
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
import { deleteOwnAccount } from "@/features/profile/api";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/supabase/errors";

const DELETE_CONFIRM = "DELETE";

export function ProfileSettings({ email }: { email?: string | null }) {
  const router = useRouter();
  const [resetEmail, setResetEmail] = useState(email ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canConfirmDelete = deleteConfirm === DELETE_CONFIRM;

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
      setMessage("Check your email for a reset link.");
    } catch (err) {
      setError(userFacingError(err, "Reset failed."));
    } finally {
      setBusy(false);
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
          Password reset
        </h3>
        {email ? (
          <p className="text-xs text-slate-500">
            We will send a recovery link to <strong>{email}</strong>.
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-500">
              No email on this account (OAuth-only). Add an email below if you
              have one linked, or connect email auth.
            </p>
            <div>
              <Label htmlFor="reset-email">Email</Label>
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
          Send reset email
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
          Log out
        </Button>
      </div>

      <div className="border-t border-slate-200 pt-4 space-y-3">
        <h3 className="font-display text-sm font-semibold text-red-700">
          Danger zone
        </h3>
        <p className="text-xs text-slate-500">
          Permanently delete your account and all associated data. This cannot
          be undone.
        </p>
        <Button
          type="button"
          variant="destructive"
          className="w-full rounded-xl"
          onClick={openDeleteDialog}
        >
          <Trash2 className="h-4 w-4" />
          Delete account
        </Button>
      </div>

      <Dialog open={deleteOpen} onOpenChange={closeDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Are you absolutely sure?</DialogTitle>
            <DialogDescription>
              This will permanently delete your sessions, projects, posts,
              hosted rooms, and profile. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="delete-confirm">Type DELETE to confirm.</Label>
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
              Cancel
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
              Delete my account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
