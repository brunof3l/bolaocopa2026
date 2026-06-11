import { BolaoApp } from "@/components/bolao-app";
import { getAllUserNamesForApp } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialRemoteUserNames = await getAllUserNamesForApp();

  return <BolaoApp initialRemoteUserNames={initialRemoteUserNames} />;
}
