import { randomBytes } from 'crypto';

export {
  listVerifiedComments,
  insertPendingComment,
  verifyComment,
} from './store.js';

export function createToken() {
  return randomBytes(32).toString('hex');
}
