// 트리거가 나중에 들어와도 여기만 호출하면 되게 만든다.

import { executePaperOrder } from "./engine";
import { getMockPrice } from "./market";
import { getPortfolio, savePortfolio } from "./store";
import { ExecutePaperOrderInput, ExecutePaperOrderResult } from "./types";

export async function placePaperOrder(
  input: ExecutePaperOrderInput,
): Promise<ExecutePaperOrderResult> {
  const portfolio = getPortfolio(input.accountId);

  if (!portfolio) {
    return {
      success: false,
      message: "계좌를 찾을 수 없음",
      portfolio: null,
    };
  }

  const market = await getMockPrice(input.symbol);

  const result = executePaperOrder({
    portfolio,
    order: input,
    marketPrice: market.price,
  });

  if (result.success && result.portfolio) {
    savePortfolio(result.portfolio);
  }

  return result;
}
