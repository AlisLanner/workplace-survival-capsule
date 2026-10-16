import { prisma } from "../db/prisma";
/** Read the original scenario for an unversioned session even after the new entry is installed. */
export async function legacyScenario<T extends {id:string}>(scenario:T):Promise<T> {
  const archived=await prisma.assessmentInstallation.findUnique({where:{id:`legacy-scenario/${scenario.id}`}});
  return archived?JSON.parse(archived.manifestJson) as T:scenario;
}
