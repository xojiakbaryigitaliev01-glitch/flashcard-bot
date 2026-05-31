import { Router, type IRouter } from "express";
import healthRouter from "./health";
import cardsRouter from "./cards";
import botRouter from "./bot";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cardsRouter);
router.use(botRouter);

export default router;
