import { expect, test } from 'vitest'
import { staleEntries } from '../../src/lib/offline/meditations'

const base = 'https://example.test/ruhe/audio/meditations/'
const url = (name: string, version?: string) => `${base}${name}.mp3${version ? `?v=${version}` : ''}`

test('entries of an old recording are stale, the current versions are not', () => {
  const current = [url('a', 'new1'), url('b', 'new2')]
  const cached = [url('a', 'old1'), url('a', 'new1'), url('b', 'new2'), url('c', 'old3')]

  expect(staleEntries(cached, current)).toEqual([url('a', 'old1'), url('c', 'old3')])
})

test('an entry without version is stale, because the current address always carries one', () => {
  expect(staleEntries([url('a')], [url('a', 'v1')])).toEqual([url('a')])
})

test('nothing is stale when the cache holds exactly the current files, or is empty', () => {
  const current = [url('a', 'v1'), url('b', 'v2')]
  expect(staleEntries(current, current)).toEqual([])
  expect(staleEntries([], current)).toEqual([])
  expect(staleEntries([url('a', 'v1')], current)).toEqual([])
})

test('the order of the cache is kept and the inputs are not changed', () => {
  const cached = [url('z', 'o'), url('a', 'v1'), url('m', 'o')]
  const current = [url('a', 'v1')]
  expect(staleEntries(cached, current)).toEqual([url('z', 'o'), url('m', 'o')])
  expect(cached).toHaveLength(3)
  expect(current).toHaveLength(1)
})
