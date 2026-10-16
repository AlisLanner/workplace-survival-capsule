import { Router, type Request, type Response, type NextFunction } from "express";
import {
  getDashboardController,
  getSessionDetailController,
  listPromptsController,
  listScenariosController,
  listSessionsController,
  updatePromptController,
  updateScenarioController
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

adminRouter.get("/dashboard", asyncHandler(getDashboardController));
adminRouter.get("/scenarios", asyncHandler(listScenariosController));
adminRouter.put("/scenarios/:id", asyncHandler(updateScenarioController));
adminRouter.get("/prompts", asyncHandler(listPromptsController));
adminRouter.put("/prompts/:key", asyncHandler(updatePromptController));
adminRouter.get("/sessions", asyncHandler(listSessionsController));
adminRouter.get("/sessions/:id", asyncHandler(getSessionDetailController));
adminRouter.post("/sessions/:id/retry-scoring", asyncHandler(async(req,res)=>{res.json(await retryScoring(req.params.id));}));
adminRouter.post("/sessions/:id/recover-turn", asyncHandler(async(req,res)=>{res.json(await recoverInterruptedTurn(req.params.id));}));

