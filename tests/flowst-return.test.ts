import { expect, test } from 'vitest'
import { flowstReturnDestination } from '../shared/flowstReturn'
test('Flowst return rejects token carriers and unsafe production destinations', () => {
 expect(flowstReturnDestination('https://flowst.example/airs')).toBe('https://flowst.example/airs')
 expect(flowstReturnDestination('http://localhost:3000/airs', true)).toBe('http://localhost:3000/airs')
 for (const value of ['//outside.example', 'javascript:alert(1)', 'https://user:secret@flowst.example/', 'https://flowst.example/?token=private', 'https://flowst.example/#token', 'http://localhost:3000/airs']) expect(flowstReturnDestination(value)).toBeNull()
})
