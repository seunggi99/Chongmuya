"use client";

import type { FC } from "react";
import StepStub from "@/components/session/StepStub";
import type { StepProps } from "@/components/session/SessionForm";

const Step5Cross: FC<StepProps> = () => (
  <StepStub
    title="교차·연회비"
    description="선입금/선지급 귀속회차 지정, 연회비 납부 회원 지정."
  />
);

export default Step5Cross;
