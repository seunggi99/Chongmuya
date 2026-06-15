import PagePlaceholder from "@/components/common/PagePlaceholder";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PagePlaceholder
      title="일지 상세"
      description={`회차 ID: ${id} — 미리보기 및 PDF/JPG 출력`}
    />
  );
}
