import { describe, expect, test } from '@jest/globals';
import policy from './passwordPolicy.cjs';

const { NEW_PASSWORD_MAX_LENGTH, evaluateNewPassword, validateNewPassword } = policy;

describe('canonical new-password policy', () => {
  test.each([
    ['empty', '', false],
    ['seven characters', 'Aa1!aaa', false],
    ['valid exactly eight', 'Aa1!aaaa', true],
    ['missing uppercase', 'aa1!aaaa', false],
    ['missing lowercase', 'AA1!AAAA', false],
    ['missing number', 'Aaa!aaaa', false],
    ['missing special', 'Aaa1aaaa', false],
    ['middle space', 'Aa1! aaab', false],
    ['leading space', ' Aa1!aaab', false],
    ['trailing space', 'Aa1!aaab ', false],
    ['tab', 'Aa1!\taaab', false],
    ['newline', 'Aa1!\naaab', false],
    ['strong valid password', 'Lilycrest2026#Secure', true],
    ['maximum boundary', `Aa1!${'x'.repeat(NEW_PASSWORD_MAX_LENGTH - 4)}`, true],
    ['over maximum', `Aa1!${'x'.repeat(NEW_PASSWORD_MAX_LENGTH - 3)}`, false],
  ])('%s', (_label, value, expected) => {
    expect(evaluateNewPassword(value).valid).toBe(expected);
    expect(validateNewPassword(value).length === 0).toBe(expected);
  });

  test('any non-alphanumeric non-whitespace character can satisfy special', () => {
    expect(evaluateNewPassword('ValidPass1©').valid).toBe(true);
  });
});
