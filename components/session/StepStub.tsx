import { Construction } from "lucide-react";

/** 아직 구현되지 않은 단계 자리표시 (다음 단계에서 채움) */
export default function StepStub({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 p-12 text-center">
        <Construction className="h-7 w-7 text-gray-300" strokeWidth={1.5} />
        <p className="mt-3 max-w-md text-sm text-gray-500">{description}</p>
        <p className="mt-1 text-xs text-gray-400">
          이 단계는 다음 작업에서 구현됩니다.
        </p>
      </div>
    </div>
  );
}
