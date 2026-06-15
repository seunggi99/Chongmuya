import { Construction } from "lucide-react";

export default function PagePlaceholder({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
      </header>
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 p-16 text-center">
        <Construction className="h-8 w-8 text-gray-300" strokeWidth={1.5} />
        <p className="mt-3 text-sm text-gray-500">
          이 화면은 다음 단계에서 구현됩니다.
        </p>
      </div>
    </div>
  );
}
