import { Transform } from 'class-transformer';

export const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export const ToBoolean = () =>
  Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value));
