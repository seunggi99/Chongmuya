import PagePlaceholder from "@/components/common/PagePlaceholder";

export default async function EditSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PagePlaceholder title="일지 수정" description={`회차 ID: ${id}`} />
  );
}
