import { useEffect, useState } from 'react';

class EMA {
  value: number | null = null;
  alpha: number;

  constructor(alpha = 0.4) {
    this.alpha = alpha;
  }

  update(newValue: number) {
    if (this.value === null) {
      this.value = newValue;
    } else {
      this.value = this.alpha * newValue + (1 - this.alpha) * this.value;
    }
    return this.value;
  }
  
  reset() {
    this.value = null;
  }
}

export function useEMA(alpha = 0.3) {
  const [ema] = useState(() => new EMA(alpha));
  return ema;
}
