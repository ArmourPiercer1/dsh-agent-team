import { publicThing } from '@fixture/host-core/public'
import { helper } from './helper.js'

export function apply() {
  return [publicThing, helper()]
}
