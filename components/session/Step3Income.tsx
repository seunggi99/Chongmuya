"use client";

import type { FC } from "react";
import StepStub from "@/components/session/StepStub";
import type { StepProps } from "@/components/session/SessionForm";

const Step3Income: FC<StepProps> = () => (
  <StepStub
    title="수입"
    description="은행내역 가져오기 또는 직접 입력 — 분류·상세, 당일회비·찬조·연회비(회원 선택형), 물품찬조."
  />
);

export default Step3Income;
