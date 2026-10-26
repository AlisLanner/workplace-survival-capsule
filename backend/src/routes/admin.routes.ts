import { Router, type Request, type Response, type NextFunction } from "express";
import {
  createSimpleScenarioController,
  deleteScenarioController,
  exportScenarioDocumentController,
  generateScenarioController,
  getDashboardController,
  getScenarioDetailController,
  getSessionDetailController,
  importScenarioDocumentController,
  listPromptsController,
  listScenariosController,
  listSessionsController,
  reviseScenarioController,
  updatePromptController,
  updateScenarioController,
  updateScenarioWeightsController
} from "../controllers/admin.controller";
import { asyncHandler } from "../utils/asyncHandler";
import { recoverInterruptedTurn, retryScoring } from "../assessment/session";

function adminAuth(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    res.status(401).json({error:"ADMIN_SECRET未配置，后台私有记录不可访问；请在本机配置管理口令。"});
    return;
  }
  const token = req.headers["x-admin-secret"];
  if (token !== secret) {
    res.status(401).json({ error: "Unauthorized — invalid or missing admin token" });
    return;
  }
  next();
}

export const adminRouter = Router();

adminRouter.use(adminAuth);

adminRouter.get("/verify", (_req, res) => res.json({ ok: true }));
adminRouter.get("/dashboard", asyncHandler(getDashboardController));
adminRouter.get("/scenarios", asyncHandler(listScenariosController));
adminRouter.post("/scenarios", asyncHandler(createSimpleScenarioController));
adminRouter.post("/scenarios/generate", asyncHandler(generateScenarioController));
adminRouter.get("/scenarios/:id", asyncHandler(getScenarioDetailController));
adminRouter.put("/scenarios/:id", asyncHandler(updateScenarioController));
adminRouter.delete("/scenarios/:id", asyncHandler(deleteScenarioController));
adminRouter.put("/scenarios/:id/weights", asyncHandler(updateScenarioWeightsController));
adminRouter.post("/scenarios/:id/revise", asyncHandler(reviseScenarioController));
adminRouter.get("/scenarios/:id/document", asyncHandler(exportScenarioDocumentController));
adminRouter.post("/scenarios/:id/document", asyncHandler(importScenarioDocumentController));
adminRouter.get("/prompts", asyncHandler(listPromptsController));
adminRouter.put("/prompts/:key", asyncHandler(updatePromptController));
adminRouter.get("/sessions", asyncHandler(listSessionsController));
adminRouter.get("/sessions/:id", asyncHandler(getSessionDetailController));
adminRouter.post("/sessions/:id/retry-scoring", asyncHandler(async(req,res)=>{res.json(await retryScoring(req.params.id));}));
adminRouter.post("/sessions/:id/recover-turn", asyncHandler(async(req,res)=>{res.json(await recoverInterruptedTurn(req.params.id));}));
