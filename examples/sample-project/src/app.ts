export function runLegacyJob(): void {
  // TODO Replace legacy auth flow @assignee(riku) @due(2025-11-10) @tags(backend,infra) @p(high)
  console.log("Running legacy job...");
}

export function calculateTotal(values: number[]): number {
  let result = 0;
  for (const value of values) {
    result += value;
  }
  return result;
}

/*
 * FIXME Update retry strategy for payment gateway
 * @tags(payments,alerts) @p(med)
 */
export function retryPayment(): void {
  console.log("Retry payment TODO");
}
