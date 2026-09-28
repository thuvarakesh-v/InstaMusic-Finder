import { AlbumScreen } from "@/features/catalog/album-screen";

export const metadata = { title: "Album" };

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AlbumScreen albumId={id} />;
}
