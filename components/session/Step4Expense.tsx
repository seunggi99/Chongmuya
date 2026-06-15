"use client";

import type { FC } from "react";
import StepStub from "@/components/session/StepStub";
import type { StepProps } from "@/components/session/SessionForm";

const Step4Expense: FC<StepProps> = () => (
  <StepStub
    title="지출"
    description="은행내역 가져오기 또는 직접 입력 — 분류·상세항목, 상세별 영수증 첨부."
  />
);

export default Step4Expense;
