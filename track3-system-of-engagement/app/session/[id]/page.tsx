import { SessionDebriefClient } from "./SessionDebriefClient";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SessionDebriefPage({ params }: Props) {
  const { id } = await params;
  return <SessionDebriefClient sessionId={id} />;
}
