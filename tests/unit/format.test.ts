import { test, expect } from 'vitest'
import { formatRemaining } from '../../src/lib/time/format'
test.each([[900, '15:00'], [899.2, '15:00'], [59, '0:59'], [0, '0:00'], [3599, '59:59'], [3600, '1:00:00'], [5400, '1:30:00']])(
  'formatRemaining(%s) = %s', (s, e) => expect(formatRemaining(s)).toBe(e))
test('formatRemaining clamps negatives', () => expect(formatRemaining(-3)).toBe('0:00'))
