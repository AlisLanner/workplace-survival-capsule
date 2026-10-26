import type { Request, Response } from "express";
import {
  createSimpleScenario,
  deleteScenario,
  exportScenarioDocument,
  generateScenarioFromBrief,
  getDashboardData,
  getScenarioDetail,
  getSessionDetail,
  importScenarioDocument,
  listPrompts,
  listScenarios,
  listSessions,
  reviseScenario,
  updatePrompt,
  updateScenario,
  updateScenarioWeights
} from "../services/admin.service";

export async function getDashboardController(_req: Request, res: Response) {
  res.json(await getDashboardData());
}

export async function listScenariosController(_req: Request, res: Response) {
  res.json(await listScenarios());
}

export async function updateScenarioController(req: Request, res: Response) {
  res.json(await updateScenario(req.params.id, req.body));
}

export async function createSimpleScenarioController(req: Request, res: Response) {
  res.json(await createSimpleScenario(req.body));
}

export async function generateScenarioController(req: Request, res: Response) {
  res.json(await generateScenarioFromBrief(req.body ?? {}));
}

export async function getScenarioDetailController(req: Request, res: Response) {
  res.json(await getScenarioDetail(req.params.id));
}

export async function updateScenarioWeightsController(req: Request, res: Response) {
  res.json(await updateScenarioWeights(req.params.id, req.body ?? {}));
}

export async function deleteScenarioController(req: Request, res: Response) {
  res.json(await deleteScenario(req.params.id));
}

export async function reviseScenarioController(req: Request, res: Response) {
  res.json(await reviseScenario(req.params.id, req.body ?? {}));
}

export async function exportScenarioDocumentController(req: Request, res: Response) {
  const result = await exportScenarioDocument(req.params.id);
  if (req.query.download === "1") {
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`);
    res.send(result.markdown);
    return;
  }
  res.json(result);
}

export async function importScenarioDocumentController(req: Request, res: Response) {
  res.json(await importScenarioDocument(req.params.id, req.body?.markdown));
}

export async function listPromptsController(_req: Request, res: Response) {
  res.json(await listPrompts());
}

export async function updatePromptController(req: Request, res: Response) {
  res.json(await updatePrompt(req.params.key, req.body));
}

export async function listSessionsController(_req: Request, res: Response) {
  res.json(await listSessions());
}

export async function getSessionDetailController(req: Request, res: Response) {
  res.json(await getSessionDetail(req.params.id));
}
