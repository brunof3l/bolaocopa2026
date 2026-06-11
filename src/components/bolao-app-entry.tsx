import { BolaoApp } from "@/components/bolao-app";
import { getAllUserNamesForApp, getOfficialResultsForApp } from "@/db/queries";

export type BolaoPageKey = "menu" | "acesso" | "palpites" | "ranking" | "admin";

export async function BolaoAppEntry({
  currentPage,
}: {
  currentPage: BolaoPageKey;
}) {
  const [initialRemoteUserNames, initialOfficialResults] = await Promise.all([
    getAllUserNamesForApp(),
    getOfficialResultsForApp(),
  ]);

  return (
    <BolaoApp
      currentPage={currentPage}
      initialRemoteUserNames={initialRemoteUserNames}
      initialOfficialResults={initialOfficialResults}
    />
  );
}
