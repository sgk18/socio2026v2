"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { QRScanner } from "./QRScanner";
import supabase from "@/lib/supabaseClient";

interface Participant {
  id: string;
  name: string;
  email: string;
  registerNumber?: string;
  teamName?: string;
  status: "registered" | "attended" | "absent";
  attendedAt?: string;
}

interface AttendanceManagerProps {
  eventId: string;
  eventTitle: string;
}

export const AttendanceManager: React.FC<AttendanceManagerProps> = ({
  eventId,
  eventTitle,
}) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const { userData, session } = useAuth();

  useEffect(() => {
    if (!showExportMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showExportMenu]);

  useEffect(() => {
    fetchParticipants();
  }, [eventId]);

  const fetchParticipants = async () => {
    if (!session?.access_token) return;
    
    setLoading(true);
    setError(null);
    const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");
    
    try {
      const response = await fetch(
        `${API_URL}/api/events/${eventId}/participants`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch participants");
      }

      const data = await response.json();
      
      // Map API response to Participant interface
      const mappedParticipants = data.participants?.map((p: any) => ({
        id: p.id,
        name: p.individual_name || p.team_leader_name || 'Unknown',
        email: p.individual_email || p.team_leader_email || '',
        registerNumber: p.individual_register_number || p.team_leader_register_number || '',
        teamName: p.registration_type === 'team' ? p.team_name : undefined,
        status: p.attendance_status === 'attended' ? 'attended' : 
               p.attendance_status === 'absent' ? 'absent' : 'registered',
        attendedAt: p.marked_at || undefined
      })) || [];
      
      setParticipants(mappedParticipants);
    } catch (err: any) {
      setError(err.message || "Failed to load participants");
      console.error("Error fetching participants:", err);
    } finally {
      setLoading(false);
    }
  };

  const markAttendance = async (participantId: string, status: "attended" | "absent") => {
    if (!session?.access_token) return;

    const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");

    try {
      const response = await fetch(
        `${API_URL}/api/events/${eventId}/attendance`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            participantIds: [participantId],
            status,
            markedBy: userData?.email,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to mark attendance");
      }

      // Update local state
      setParticipants(prev =>
        prev.map(p =>
          p.id === participantId
            ? {
                ...p,
                status,
                attendedAt: status === "attended" ? new Date().toISOString() : undefined,
              }
            : p
        )
      );
    } catch (err: any) {
      console.error("Error marking attendance:", err);
      // You might want to show a toast notification here
    }
  };

  const buildAttendanceExportData = async () => {
    const periodSlots: { label: string; startMin: number; endMin: number }[] = [
      { label: "Period07_45AM", startMin: 7 * 60 + 45,  endMin: 8 * 60 + 45 },
      { label: "Period08_45AM", startMin: 8 * 60 + 45,  endMin: 9 * 60 + 45 },
      { label: "Period09_45AM", startMin: 9 * 60 + 45,  endMin: 10 * 60 + 45 },
      { label: "Period10_45AM", startMin: 10 * 60 + 45, endMin: 11 * 60 + 45 },
      { label: "Period11_45AM", startMin: 11 * 60 + 45, endMin: 12 * 60 + 45 },
      { label: "Period12_45PM", startMin: 12 * 60 + 45, endMin: 13 * 60 + 45 },
      { label: "Period01_45PM", startMin: 13 * 60 + 45, endMin: 14 * 60 + 45 },
      { label: "Period02_45PM", startMin: 14 * 60 + 45, endMin: 15 * 60 + 45 },
      { label: "Period03_45PM", startMin: 15 * 60 + 45, endMin: 16 * 60 + 45 },
      { label: "Period04_45PM", startMin: 16 * 60 + 45, endMin: 17 * 60 + 45 },
      { label: "Period05_45PM", startMin: 17 * 60 + 45, endMin: 18 * 60 + 45 },
    ];
    const periodColumns = periodSlots.map((s) => s.label);
    const headers = ["Date", "Name", "Register Number", "Class", ...periodColumns];

    const parseTimeToMinutes = (raw: unknown): number | null => {
      if (raw == null) return null;
      const s = String(raw).trim();
      if (!s) return null;
      const m = s.match(/^(\d{1,2}):(\d{2})/);
      if (!m) return null;
      const hh = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
      return hh * 60 + mm;
    };

    let eventStartMin: number | null = null;
    let eventEndMin: number | null = null;
    let eventDateFormatted = "";
    try {
      const { data: ev } = await supabase
        .from("events")
        .select("event_date, event_time, end_time")
        .eq("event_id", eventId)
        .maybeSingle();
      if (ev) {
        eventStartMin = parseTimeToMinutes((ev as any).event_time);
        eventEndMin = parseTimeToMinutes((ev as any).end_time);
        const evDate = (ev as any).event_date as string | null;
        if (evDate) {
          const m = evDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (m) eventDateFormatted = `${m[3]}/${m[2]}/${m[1]}`;
        }
      }
    } catch (err) {
      console.error("Failed to fetch event timing for export:", err);
    }

    const dateForRow = eventDateFormatted || (() => {
      const t = new Date();
      return `${String(t.getDate()).padStart(2, "0")}/${String(t.getMonth() + 1).padStart(2, "0")}/${t.getFullYear()}`;
    })();

    const matchedSet = new Set<string>(
      eventStartMin != null && eventEndMin != null && eventEndMin > eventStartMin
        ? periodSlots
            .filter((s) => s.startMin < eventEndMin! && s.endMin > eventStartMin!)
            .map((s) => s.label)
        : []
    );

    const attendedParticipants = participants.filter((p) => p.status === "attended");

    const dataRows = attendedParticipants.map((p) => [
      dateForRow,
      p.name || "",
      p.registerNumber || "",
      "",
      ...periodColumns.map((label) => (matchedSet.has(label) ? label : "")),
    ]);

    return { headers, periodColumns, dataRows };
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const baseFilename = () =>
    `attendance_${eventTitle}_${new Date().toISOString().split("T")[0]}`;

  const exportAsExcel = async () => {
    setShowExportMenu(false);
    const { headers, dataRows } = await buildAttendanceExportData();

    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Attendance");

    const totalCols = headers.length;
    const firstPeriodCol = 5;
    const lastPeriodCol = totalCols;

    const bannerRow = worksheet.addRow(
      Array.from({ length: totalCols }, (_, i) =>
        i === firstPeriodCol - 1 ? "Hours missed(please specify - Period9_45)" : ""
      )
    );
    bannerRow.height = 26;
    const navyBorder = {
      top: { style: "thin" as const, color: { argb: "FF1F2937" } },
      left: { style: "thin" as const, color: { argb: "FF1F2937" } },
      bottom: { style: "thin" as const, color: { argb: "FF1F2937" } },
      right: { style: "thin" as const, color: { argb: "FF1F2937" } },
    };
    worksheet.mergeCells(1, 1, 1, firstPeriodCol - 1);
    const eventCell = worksheet.getCell(1, 1);
    eventCell.value = eventTitle || "";
    eventCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
    eventCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    eventCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF063168" },
    };
    eventCell.border = navyBorder;
    worksheet.mergeCells(1, firstPeriodCol, 1, lastPeriodCol);
    const bannerCell = worksheet.getCell(1, firstPeriodCol);
    bannerCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
    bannerCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    bannerCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF063168" },
    };
    bannerCell.border = navyBorder;

    const headerRow = worksheet.addRow(headers);
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF154CB3" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF1F2937" } },
        left: { style: "thin", color: { argb: "FF1F2937" } },
        bottom: { style: "thin", color: { argb: "FF1F2937" } },
        right: { style: "thin", color: { argb: "FF1F2937" } },
      };
    });

    dataRows.forEach((rowValues) => {
      const row = worksheet.addRow(rowValues);
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FFD1D5DB" } },
          left: { style: "thin", color: { argb: "FFD1D5DB" } },
          bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
          right: { style: "thin", color: { argb: "FFD1D5DB" } },
        };
      });
    });

    headers.forEach((header, idx) => {
      const col = worksheet.getColumn(idx + 1);
      let max = header.length;
      for (let r = 2; r <= worksheet.rowCount; r++) {
        const cell = worksheet.getCell(r, idx + 1);
        const value = cell.value == null ? "" : String(cell.value);
        if (value.length > max) max = value.length;
      }
      col.width = Math.min(Math.max(max + 4, 14), 40);
    });

    worksheet.views = [{ state: "frozen", ySplit: 2 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    triggerDownload(blob, `${baseFilename()}.xlsx`);
  };

  const exportAsCsv = async () => {
    setShowExportMenu(false);
    const { headers, dataRows } = await buildAttendanceExportData();

    const escapeCsv = (value: unknown) => {
      const s = value == null ? "" : String(value);
      const needsQuoting = /[",\n\r]/.test(s);
      const escaped = s.replace(/"/g, '""');
      return needsQuoting ? `"${escaped}"` : escaped;
    };

    const lines = [
      headers.map(escapeCsv).join(","),
      ...dataRows.map((row) => row.map(escapeCsv).join(",")),
    ];
    const csv = "﻿" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    triggerDownload(blob, `${baseFilename()}.csv`);
  };

  const exportAsGoogleSheet = async () => {
    await exportAsExcel();
    window.open("https://docs.google.com/spreadsheets/u/0/", "_blank", "noopener,noreferrer");
  };

  const handleQRScanSuccess = (result: any) => {
    // Refresh participants list to show updated attendance
    fetchParticipants();
  };

  const filteredParticipants = participants.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (p.registerNumber && p.registerNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterStatus === "all" || p.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const attendanceStats = {
    total: participants.length,
    attended: participants.filter(p => p.status === "attended").length,
    absent: participants.filter(p => p.status === "absent").length,
    pending: participants.filter(p => p.status === "registered").length,
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#154CB3]"></div>
        <span className="ml-3 text-gray-600">Loading participants...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="ml-2 text-red-700 font-medium">Error loading participants</span>
        </div>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button
          onClick={fetchParticipants}
          className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-[#063168]">
            Attendance - {eventTitle}
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowQRScanner(true)}
              className="px-4 py-2 bg-[#154CB3] text-white rounded-lg hover:bg-[#063168] transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 16h4m-4-4h4m-4-4v1m0 0h-1m1-1V8a5 5 0 00-10 0v.01M8 7a3 3 0 016 0v.01M12 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              QR Scanner
            </button>
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu((v) => !v)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                aria-haspopup="menu"
                aria-expanded={showExportMenu}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
                <svg
                  className={`w-4 h-4 transition-transform ${showExportMenu ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showExportMenu && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden"
                >
                  <button
                    onClick={exportAsGoogleSheet}
                    role="menuitem"
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                    Google Sheet
                  </button>
                  <button
                    onClick={exportAsExcel}
                    role="menuitem"
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100"
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-700" />
                    Excel (.xlsx)
                  </button>
                  <button
                    onClick={exportAsCsv}
                    role="menuitem"
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100"
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-gray-500" />
                    CSV (.csv)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-[#154CB3]">{attendanceStats.total}</div>
            <div className="text-sm text-blue-700">Total</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{attendanceStats.attended}</div>
            <div className="text-sm text-green-700">Attended</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{attendanceStats.absent}</div>
            <div className="text-sm text-red-700">Absent</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{attendanceStats.pending}</div>
            <div className="text-sm text-yellow-700">Pending</div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name, email, or register number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-transparent"
            />
          </div>
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="registered">Registered</option>
              <option value="attended">Attended</option>
              <option value="absent">Absent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Participants List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredParticipants.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {participants.length === 0 ? "No participants registered yet" : "No participants match your search"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Participant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredParticipants.map((participant) => (
                  <tr key={participant.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{participant.name}</div>
                        <div className="text-sm text-gray-500">{participant.email}</div>
                        {participant.registerNumber && (
                          <div className="text-sm text-gray-500">Reg: {participant.registerNumber}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {participant.teamName || "Individual"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        participant.status === "attended"
                          ? "bg-green-100 text-green-800"
                          : participant.status === "absent"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {participant.status === "registered" ? "Pending" : participant.status}
                      </span>
                      {participant.attendedAt && (
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(participant.attendedAt).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      {participant.status !== "attended" && (
                        <button
                          onClick={() => markAttendance(participant.id, "attended")}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                        >
                          Mark Present
                        </button>
                      )}
                      {participant.status !== "absent" && (
                        <button
                          onClick={() => markAttendance(participant.id, "absent")}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                        >
                          Mark Absent
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <QRScanner
          eventId={eventId}
          eventTitle={eventTitle}
          onScanSuccess={handleQRScanSuccess}
          onClose={() => setShowQRScanner(false)}
        />
      )}
    </div>
  );
};

