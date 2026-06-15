"use client";

import type { FC } from "react";
import StepStub from "@/components/session/StepStub";
import type { StepProps } from "@/components/session/SessionForm";

const Step6Confirm: FC<StepProps> = () => (
  <StepStub
    title="확인·출력"
    description="잔액체인·이월금(자동/수동 보정) 확인, 저장 → 미리보기 → PDF/JPG."
  />
);

export default Step6Confirm;
