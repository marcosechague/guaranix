import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Bancard signs every request and confirmation with MD5 over the private key
 * and a few fields, in an order fixed per operation. MD5 is Bancard's choice,
 * not ours; it is the only proof a confirmation came from them.
 */
export const md5 = (text: string) => createHash('md5').update(text, 'utf8').digest('hex');

export const bancardTokens = {
  singleBuy: (key: string, order: number, amount: string) => md5(`${key}${order}${amount}PYG`),
  confirmation: (key: string, order: number) => md5(`${key}${order}get_confirmation`),
  rollback: (key: string, order: number) => md5(`${key}${order}rollback0.00`),
  newCard: (key: string, cardRef: string, customerRef: string) =>
    md5(`${key}${cardRef}${customerRef}request_new_card`),
  userCards: (key: string, customerRef: string) => md5(`${key}${customerRef}request_user_cards`),
  deleteCard: (key: string, customerRef: string, aliasToken: string) =>
    md5(`${key}delete_card${customerRef}${aliasToken}`),
  charge: (key: string, order: number, amount: string, aliasToken: string) =>
    md5(`${key}${order}charge${amount}PYG${aliasToken}`),
  /** What Bancard sends with a confirmation: the amount exactly as it appears in the body. */
  webhook: (key: string, order: string, amount: string, currency: string) =>
    md5(`${key}${order}confirm${amount}${currency}`),
};

export function sameToken(received: string, expected: string): boolean {
  const left = Buffer.from(received.toLowerCase());
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
