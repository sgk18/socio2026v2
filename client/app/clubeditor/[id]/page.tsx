"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ClubRecord, removeClubApplicant, setClubRegistrations } from "@/app/actions/clubs";
import Footer from "@/app/_components/Home/Footer";
import { useAuth } from "@/context/AuthContext";
import supabase from "@/lib/supabaseClient";

type ClubApplicantEntry = {
  regno: string;
  name: string;
  email: string;
  role_applied_for: string;
  applied_at?: string;
};

const parseClubApplicants = (value: unknown): ClubApplicantEntry[] => {
  const parsed =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value);
          } catch {
            return [];
          }
        })()
      : value;

  if (!Array.isArray(parsed)) return [];

  const applicants: ClubApplicantEntry[] = [];

  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const regno = String(entry.regno ?? "").trim();
    const name = String(entry.name ?? "").trim();
    const email = String(entry.email ?? "").trim();
    const roleApplied = String(entry.role_applied_for ?? "").trim();
    const appliedAt = String(entry.applied_at ?? "").trim();

    if (!regno || !roleApplied) continue;

    applicants.push({
      regno,
      name,
      email,
      role_applied_for: roleApplied,
      applied_at: appliedAt || undefined,
    });
  }

  return applicants;
};

const toCsvCell = (value: unknown): string =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

const toCsvSafeFileName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "club-applicants";

export default function ClubEditorDashboardPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const { userData, session, isLoading } = useAuth();

  const [club, setClub] = useState<ClubRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState("all");
  const [isUpdatingToggle, setIsUpdatingToggle] = useState(false);
  const [showToggleWarning, setShowToggleWarning] = useState(false);
  const [removingRegno, setRemovingRegno] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{
    regno: string;
    email: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchClub = async () => {
      setLoading(true);
      setError(null);

      try {
        const byId = await supabase.from("clubs").select("*").eq("club_id", id).maybeSingle();
        const resolved = byId.data
          ? byId
          : await supabase.from("clubs").select("*").eq("slug", id).maybeSingle();

        if (!isMounted) return;
        if (resolved.error) throw new Error(resolved.error.message);
        if (!resolved.data) {
          setClub(null);
          setError("Club not found.");
          return;
        }

        setClub(resolved.data as ClubRecord);
      } catch (fetchError) {
        if (!isMounted) return;
        setClub(null);
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load club dashboard.");
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };

    if (id) {
      void fetchClub();
    } else {
      setLoading(false);
      setError("Club ID is missing from URL.");
    }

    return () => {
      isMounted = false;
    };
  }, [id]);

  const currentEmail = String(userData?.email || session?.user?.email || "")
    .trim()
    .toLowerCase();

  const applicants = useMemo(
    () => parseClubApplicants(club?.clubs_applicants ?? club?.clubs_applicant),
    [club?.clubs_applicants, club?.clubs_applicant]
  );
  const roleOptions = useMemo(
    () =>
      Array.from(
        new Set(
          applicants
            .map((entry) => entry.role_applied_for.trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [applicants]
  );
  const filteredApplicants = useMemo(() => {
    if (selectedRole === "all") return applicants;
    return applicants.filter(
      (entry) => entry.role_applied_for.toLowerCase() === selectedRole.toLowerCase()
    );
  }, [applicants, selectedRole]);

  const exportApplicantsToCsv = () => {
    const header = ["Register Number", "Name", "Email", "Role Applied for"];
    const rows = applicants.map((entry) =>
      [
        toCsvCell(entry.regno),
        toCsvCell(entry.name),
        toCsvCell(entry.email),
        toCsvCell(entry.role_applied_for),
      ].join(",")
    );
    const csv = [header.map(toCsvCell).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${toCsvSafeFileName(club?.club_name || "club")}-applicants.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Applicant list exported.");
  };

  const updateApplicationToggle = async (nextValue: boolean) => {
    if (!club) return;

    try {
      setIsUpdatingToggle(true);
      const { ok, error: updateError } = await setClubRegistrations(club.club_id, nextValue);

      if (!ok) throw new Error(updateError || "Failed to update application toggle.");

      setClub((prev) => (prev ? { ...prev, club_registrations: nextValue } : prev));
      toast.success(`Applications ${nextValue ? "opened" : "closed"}.`);
    } catch (toggleError) {
      toast.error(
        toggleError instanceof Error ? toggleError.message : "Failed to update application toggle."
      );
    } finally {
      setIsUpdatingToggle(false);
    }
  };

  const handleApplicationToggleClick = () => {
    if (!club || isUpdatingToggle) return;
    if (club.club_registrations) {
      setShowToggleWarning(true);
      return;
    }
    void updateApplicationToggle(true);
  };

   const removeApplicant = async (applicantRegno: string, applicantEmail: string) => {
    if (!club) return;

    try {
      setRemovingRegno(applicantRegno);
      
      const currentApplicants = parseClubApplicants(club.clubs_applicants ?? club.clubs_applicant);
      const updatedApplicants = currentApplicants.filter(
        (entry) => !(entry.regno === applicantRegno && entry.email === applicantEmail)
      );

      const { ok, error: updateError } = await removeClubApplicant(
        club.club_id,
        updatedApplicants
      );

      if (!ok) {
        throw new Error(updateError || "Failed to remove applicant");
      }

      setClub((prev) => {
        if (!prev) return prev;
        const currentApplicants = parseClubApplicants(prev.clubs_applicants ?? prev.clubs_applicant);
        const updatedApplicants = currentApplicants.filter(
          (entry) => !(entry.regno === applicantRegno && entry.email === applicantEmail)
        );
        return {
          ...prev,
          clubs_applicants: updatedApplicants,
        };
      });

      setConfirmRemove(null);
      toast.success("Applicant removed successfully.");
    } catch (removeError) {
      toast.error(removeError instanceof Error ? removeError.message : "Failed to remove applicant.");
    } finally {
      setRemovingRegno(null);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#154CB3]" />
      </div>
    );
  }

  if (error || !club) {
    return (
      <div className="min-h-screen bg-white px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-[#063168]">Unable to open club dashboard</h1>
        <p className="mt-3 text-gray-600">{error || "Club not found."}</p>
        <Link href="/clubs" className="mt-6 inline-flex rounded-md bg-[#154CB3] px-5 py-2 text-white">
          Back to clubs
        </Link>
      </div>
    );
  }

  const editors = Array.isArray(club.club_editors) ? club.club_editors : [];
  const canAccessDashboard =
    Boolean(userData?.is_masteradmin) ||
    editors.some((editor) => String(editor || "").trim().toLowerCase() === currentEmail);

  if (!canAccessDashboard) {
    return (
      <div className="min-h-screen bg-white px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-[#063168]">Access denied</h1>
        <p className="mt-3 text-gray-600">Only assigned club editors or masteradmins can access this dashboard.</p>
        <Link href="/clubs" className="mt-6 inline-flex rounded-md bg-[#154CB3] px-5 py-2 text-white">
          Back to clubs
        </Link>
      </div>
    );
  }

  const publicClubHref = `/club/${club.slug ?? club.club_id}`;

  return (
    <div className="min-h-screen bg-[#f3f5f9]">
      <section className="bg-[#0b3879] px-6 py-10 text-white">
        <div className="mx-auto w-full max-w-6xl">
          <Link href={publicClubHref} className="inline-flex items-center text-[#f3c83a] transition-colors hover:text-[#ffe187]">
            ← Back to club
          </Link>
          <h1 className="mt-5 text-4xl font-bold sm:text-5xl">Club Dashboard</h1>
          <p className="mt-2 text-base text-white/90">
            Review applicants and manage when applications are open or closed.
          </p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <section className="rounded-xl border border-[#ced6e0] bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5b6d86]">
                Application Toggle
              </p>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleApplicationToggleClick}
                  disabled={isUpdatingToggle}
                  aria-label="Application Toggle"
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-200 ${
                    club.club_registrations ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                  } ${isUpdatingToggle ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                >
                  <span
                    className={`inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      club.club_registrations ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
                <span
                  className={`text-sm font-semibold ${
                    club.club_registrations ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {club.club_registrations ? "ON" : "OFF"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={exportApplicantsToCsv}
              className="inline-flex items-center justify-center rounded-lg border border-[#154CB3] px-4 py-2 text-sm font-semibold text-[#154CB3] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#eff4ff] cursor-pointer"
            >
              Export to CSV
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-bold text-[#0e3f84]">Applicants</h2>
            <label className="flex items-center gap-2 text-sm font-medium text-[#4f6482]">
              Role Applied for
              <select
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value)}
                className="h-10 min-w-[190px] rounded-md border border-[#c7d3e7] bg-white px-3 text-sm text-[#1f3556] focus:outline-none focus:ring-2 focus:ring-[#7aa3e8]"
              >
                <option value="all">All roles</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filteredApplicants.length === 0 ? (
            <p className="mt-4 rounded-md border border-dashed border-[#c7d3e7] bg-[#f8fbff] px-4 py-4 text-sm text-[#4f6482]">
              {applicants.length === 0
                ? "No applications received yet."
                : "No applicants match the selected role."}
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-lg border border-[#d7e3f9] bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-[#f1f6ff] text-left text-[#23467f]">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Register Number</th>
                    <th className="px-4 py-2.5 font-semibold">Name</th>
                    <th className="px-4 py-2.5 font-semibold">Email</th>
                    <th className="px-4 py-2.5 font-semibold">Role Applied for</th>
                    <th className="px-4 py-2.5 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplicants.map((entry, index) => (
                    <tr
                      key={`${entry.regno}-${entry.role_applied_for}-${index}`}
                      className="border-t border-[#edf2fb] transition-colors duration-150 hover:bg-[#f8fbff]"
                    >
                      <td className="px-4 py-2.5 font-semibold text-[#163c77]">{entry.regno}</td>
                      <td className="px-4 py-2.5 text-[#344a6a]">{entry.name || "-"}</td>
                      <td className="px-4 py-2.5 text-[#344a6a]">
                        {entry.email ? (
                          <a
                            href={`mailto:${entry.email}`}
                            className="font-medium text-[#154CB3] underline decoration-[#154CB3]/40 underline-offset-2 transition-colors duration-150 hover:text-[#0f3f95]"
                          >
                            {entry.email}
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[#344a6a]">{entry.role_applied_for}</td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => setConfirmRemove({ regno: entry.regno, email: entry.email, name: entry.name || "this applicant" })}
                          disabled={removingRegno === entry.regno}
                          className="inline-flex items-center justify-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {removingRegno === entry.regno ? (
                            <>
                              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              Removing...
                            </>
                          ) : (
                            "Remove"
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {showToggleWarning ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#dbe6f7] bg-white shadow-2xl">
            <div className="border-b border-[#e7eef9] px-6 py-4">
              <h3 className="text-xl font-bold text-[#063168]">Turn off applications?</h3>
              <p className="mt-2 text-sm text-[#4f6482]">
                Once the application forms are turned off, the applicant list will be deleted after
                2 months. It is better to export now, though you can still export later.
              </p>
            </div>
            <div className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => setShowToggleWarning(false)}
                className="rounded-md border border-[#c7d3e7] px-4 py-2 text-sm font-semibold text-[#355173] transition-colors duration-150 hover:bg-[#f4f8ff] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={exportApplicantsToCsv}
                className="rounded-md border border-[#154CB3] px-4 py-2 text-sm font-semibold text-[#154CB3] transition-colors duration-150 hover:bg-[#ecf2ff] cursor-pointer"
              >
                Export to CSV
              </button>
              <button
                type="button"
                disabled={isUpdatingToggle}
                onClick={async () => {
                  setShowToggleWarning(false);
                  await updateApplicationToggle(false);
                }}
                className="rounded-md bg-[#154CB3] px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#0f3f95] disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {confirmRemove ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#dbe6f7] bg-white shadow-2xl">
            <div className="border-b border-[#e7eef9] px-6 py-4">
              <h3 className="text-xl font-bold text-[#063168]">Remove applicant?</h3>
              <p className="mt-2 text-sm text-[#4f6482]">
                Are you sure you want to remove <span className="font-semibold">{confirmRemove.name}</span> from the applicant list? This action cannot be undone.
              </p>
            </div>
            <div className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmRemove(null)}
                disabled={removingRegno === confirmRemove.regno}
                className="rounded-md border border-[#c7d3e7] px-4 py-2 text-sm font-semibold text-[#355173] transition-colors duration-150 hover:bg-[#f4f8ff] disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => removeApplicant(confirmRemove.regno, confirmRemove.email)}
                disabled={removingRegno === confirmRemove.regno}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
              >
                {removingRegno === confirmRemove.regno ? (
                  <>
                    <div className="inline-block mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Removing...
                  </>
                ) : (
                  "Yes"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <Footer />
    </div>
  );
}
