import { BolaoApp } from "@/components/bolao-app";
import {
  ensureAppSeedData,
  getAllUsersForApp,
  getAppPredictionsForApp,
  getAppSpecialPicksForApp,
  getOfficialResultsForApp,
} from "@/db/queries";

export type BolaoPageKey = "menu" | "acesso" | "palpites" | "ranking" | "admin";

export async function BolaoAppEntry({
  currentPage,
}: {
  currentPage: BolaoPageKey;
}) {
  await ensureAppSeedData();

  const [
    initialRemoteUsers,
    initialOfficialResults,
    initialAppPredictions,
    initialAppSpecialPicks,
  ] = await Promise.all([
      getAllUsersForApp(),
      getOfficialResultsForApp(),
      getAppPredictionsForApp(),
      getAppSpecialPicksForApp(),
    ]);

  return (
    <BolaoApp
      currentPage={currentPage}
      initialRemoteUsers={initialRemoteUsers}
      initialOfficialResults={initialOfficialResults}
      initialAppPredictions={initialAppPredictions}
      initialAppSpecialPicks={initialAppSpecialPicks}
    />
  );
}
