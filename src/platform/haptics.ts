// A light tap under the finger when a dragged chapter lands, or a long press
// starts selecting (style.md §14). Silent in browsers.

import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { isNative } from './native';

export function tap(): void {
  if (isNative) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
  else navigator.vibrate?.(8);
}

export function select(): void {
  if (isNative) void Haptics.selectionChanged().catch(() => undefined);
}
