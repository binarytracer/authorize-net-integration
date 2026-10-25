import { BadRequestException, ValidationPipe, type ValidationError } from '@nestjs/common';

function flatten(errors: ValidationError[], path = ''): { path: string; messages: string[] }[] {
  return errors.flatMap((e) => {
    const here = path ? `${path}.${e.property}` : e.property;
    const own = e.constraints ? [{ path: here, messages: Object.values(e.constraints) }] : [];
    return [...own, ...flatten(e.children ?? [], here)];
  });
}

export const requestValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  exceptionFactory: (errors) =>
    new BadRequestException({ error: 'invalid_request', details: flatten(errors) }),
});
