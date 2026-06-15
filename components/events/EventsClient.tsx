"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import EventCalendar from "@/components/events/EventCalendar";
import AddEventModal from "@/components/events/AddEventModal";
import type { Session } from "@/types";

export default function EventsClient({
  initialSessions,
  today,
}: {
  initialSessions: Session[];
  today: string;
}) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [modalOpen, setModalOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState<string | undefined>(undefined);
  // 열 때마다 모달을 remount 해 클릭한 날짜를 기본값으로 반영
  const [openSeq, setOpenSeq] = useState(0);

  function openAdd(date?: string) {
    setPickedDate(date);
    setOpenSeq((n) => n + 1);
    setModalOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          행사를 먼저 등록해두면, 나중에 그 행사에 일지를 작성합니다.
        </p>
        <button
          type="button"
          onClick={() => openAdd(today)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <CalendarPlus className="h-4 w-4" />
          행사 등록
        </button>
      </div>

      <EventCalendar
        sessions={sessions}
        today={today}
        onPickDate={(date) => openAdd(date)}
      />

      <AddEventModal
        key={openSeq}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultDate={pickedDate}
        onCreated={setSessions}
      />
    </div>
  );
}
