/**
 * The subset of the environment the platform modules read.
 *
 * Narrower than NodeJS.ProcessEnv on purpose: a function that reads two
 * variables should not demand a type carrying every variable Node defines, and
 * a test should be able to pass a two-key object without a cast.
 */
export type EnvBag = Record<string, string | undefined>;
